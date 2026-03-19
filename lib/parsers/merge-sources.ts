import type {
  ParsedActivityData,
  ParsedLearner,
  ParsedQuestion,
  ParseWarning,
  DataSource,
  FileRole,
  MergeResult,
  SourceBreakdown,
} from "./types";

/** Classify a data source into its role. */
export function classifyFileRole(source: DataSource): FileRole {
  switch (source) {
    case "array":
    case "globalmeet":
    case "pigeonhole":
      return "assessment";
    case "snowflake_eval":
      return "evaluation";
    case "snowflake_ondemand":
      return "standalone";
  }
}

/**
 * Merge multiple ParsedActivityData from different sources into one.
 * Type 1 (assessment) + Type 2 (evaluation) merge by learner email.
 * Single file or Type 3 (standalone) passes through unchanged.
 */
export function mergeSources(parsedFiles: ParsedActivityData[]): MergeResult {
  const warnings: ParseWarning[] = [];

  if (parsedFiles.length === 0) {
    return emptyMergeResult(warnings);
  }

  // Single file — no merge needed
  if (parsedFiles.length === 1) {
    const file = parsedFiles[0];
    return {
      merged: file,
      sourceBreakdown: [{
        source: file.source,
        fileName: file.sourceFileName,
        learnerCount: file.learners.length,
        questionCount: file.questions.length,
      }],
      matchedCount: 0,
      assessmentOnlyCount: file.learners.length,
      evalOnlyCount: 0,
      warnings: file.warnings,
    };
  }

  // Classify files by role
  const assessmentFiles = parsedFiles.filter((f) => classifyFileRole(f.source) === "assessment");
  const evaluationFiles = parsedFiles.filter((f) => classifyFileRole(f.source) === "evaluation");
  const standaloneFiles = parsedFiles.filter((f) => classifyFileRole(f.source) === "standalone");

  // Validate combinations
  if (standaloneFiles.length > 0 && (assessmentFiles.length > 0 || evaluationFiles.length > 0)) {
    warnings.push({
      type: "data_quality",
      message: "On-demand data is standalone and already includes evaluations. Other files will be merged but may have overlapping data.",
    });
  }

  if (assessmentFiles.length > 1) {
    // Multiple assessment sources of different types
    const types = new Set(assessmentFiles.map((f) => f.source));
    if (types.size > 1) {
      warnings.push({
        type: "data_quality",
        message: `Multiple assessment source types detected (${[...types].join(", ")}). Using all — learners will be combined.`,
      });
    }
  }

  if (evaluationFiles.length > 1) {
    warnings.push({
      type: "data_quality",
      message: "Multiple evaluation files detected. All will be merged.",
    });
  }

  // Build the primary learner map from assessment sources
  const learnerMap = new Map<string, ParsedLearner>();
  const allQuestions: ParsedQuestion[] = [];
  const allWarnings: ParseWarning[] = [...warnings];
  let totalExcluded = 0;
  const mergedSources: DataSource[] = [];
  const sourceBreakdown: SourceBreakdown[] = [];
  let suggestedName: string | null = null;
  const allMetadata: Record<string, string> = {};
  const allFileNames: string[] = [];

  // Process assessment files first (they have the richer learner data)
  for (const file of assessmentFiles) {
    mergedSources.push(file.source);
    allFileNames.push(file.sourceFileName);
    allWarnings.push(...file.warnings);
    totalExcluded += file.excludedCount;
    Object.assign(allMetadata, file.metadata);
    if (!suggestedName && file.suggestedActivityName) {
      suggestedName = file.suggestedActivityName;
    }

    sourceBreakdown.push({
      source: file.source,
      fileName: file.sourceFileName,
      learnerCount: file.learners.length,
      questionCount: file.questions.length,
    });

    // Add questions (avoid duplicates by checking questionNumber + type)
    for (const q of file.questions) {
      const exists = allQuestions.some(
        (aq) => aq.questionNumber === q.questionNumber && aq.questionType === q.questionType
      );
      if (!exists) allQuestions.push(q);
    }

    // Add learners
    for (const learner of file.learners) {
      const key = learner.email.trim().toLowerCase();
      const existing = learnerMap.get(key);
      if (existing) {
        // Merge: combine responses, fill missing fields
        existing.responses.push(...learner.responses);
        existing.presenterResponses.push(...learner.presenterResponses);
        fillMissingFields(existing, learner);
      } else {
        learnerMap.set(key, { ...learner });
      }
    }
  }

  // Process standalone files
  for (const file of standaloneFiles) {
    mergedSources.push(file.source);
    allFileNames.push(file.sourceFileName);
    allWarnings.push(...file.warnings);
    totalExcluded += file.excludedCount;
    Object.assign(allMetadata, file.metadata);
    if (!suggestedName && file.suggestedActivityName) {
      suggestedName = file.suggestedActivityName;
    }

    sourceBreakdown.push({
      source: file.source,
      fileName: file.sourceFileName,
      learnerCount: file.learners.length,
      questionCount: file.questions.length,
    });

    for (const q of file.questions) {
      const exists = allQuestions.some(
        (aq) => aq.questionNumber === q.questionNumber && aq.questionType === q.questionType
      );
      if (!exists) allQuestions.push(q);
    }

    for (const learner of file.learners) {
      const key = learner.email.trim().toLowerCase();
      const existing = learnerMap.get(key);
      if (existing) {
        existing.responses.push(...learner.responses);
        existing.evaluationResponses.push(...learner.evaluationResponses);
        fillMissingFields(existing, learner);
      } else {
        learnerMap.set(key, { ...learner });
      }
    }
  }

  // Process evaluation files — merge by email into existing learners
  let matchedCount = 0;
  let evalOnlyCount = 0;

  for (const file of evaluationFiles) {
    mergedSources.push(file.source);
    allFileNames.push(file.sourceFileName);
    allWarnings.push(...file.warnings);
    Object.assign(allMetadata, file.metadata);
    if (!suggestedName && file.suggestedActivityName) {
      suggestedName = file.suggestedActivityName;
    }

    sourceBreakdown.push({
      source: file.source,
      fileName: file.sourceFileName,
      learnerCount: file.learners.length,
      questionCount: file.questions.length,
    });

    // Add evaluation questions (offset numbering to avoid conflicts)
    const maxQNum = allQuestions.length > 0
      ? Math.max(...allQuestions.map((q) => q.questionNumber))
      : 0;

    for (let i = 0; i < file.questions.length; i++) {
      const q = { ...file.questions[i] };
      q.questionNumber = maxQNum + 1 + i;
      allQuestions.push(q);
    }

    // Merge learners by email
    for (const evalLearner of file.learners) {
      const key = evalLearner.email.trim().toLowerCase();
      const existing = learnerMap.get(key);

      if (existing) {
        // Match found — merge evaluation data into assessment learner
        existing.evaluationResponses.push(...evalLearner.evaluationResponses);
        existing.comments = existing.comments || evalLearner.comments;
        fillMissingFields(existing, evalLearner);
        matchedCount++;
      } else {
        // Eval-only learner — no assessment data
        learnerMap.set(key, { ...evalLearner });
        evalOnlyCount++;
      }
    }
  }

  const assessmentOnlyCount = assessmentFiles.length > 0 && evaluationFiles.length > 0
    ? [...learnerMap.values()].filter((l) => l.responses.length > 0 && l.evaluationResponses.length === 0).length
    : 0;

  const merged: ParsedActivityData = {
    source: assessmentFiles[0]?.source ?? standaloneFiles[0]?.source ?? evaluationFiles[0]?.source ?? "array",
    sourceFileName: allFileNames.join(" + "),
    suggestedActivityName: suggestedName,
    questions: allQuestions,
    learners: Array.from(learnerMap.values()),
    warnings: allWarnings,
    excludedCount: totalExcluded,
    metadata: allMetadata,
    mergedSources: mergedSources.length > 1 ? mergedSources : undefined,
  };

  return {
    merged,
    sourceBreakdown,
    matchedCount,
    assessmentOnlyCount,
    evalOnlyCount,
    warnings: allWarnings,
  };
}

/** Fill null fields in `target` from `source`. */
function fillMissingFields(target: ParsedLearner, source: ParsedLearner): void {
  if (!target.firstName && source.firstName) target.firstName = source.firstName;
  if (!target.lastName && source.lastName) target.lastName = source.lastName;
  if (!target.employer && source.employer) target.employer = source.employer;
  if (!target.practiceSetting && source.practiceSetting) target.practiceSetting = source.practiceSetting;
  if (!target.role && source.role) target.role = source.role;
  // Merge demographics
  for (const [key, val] of Object.entries(source.demographics)) {
    if (val != null && !target.demographics[key]) {
      target.demographics[key] = val;
    }
  }
}

function emptyMergeResult(warnings: ParseWarning[]): MergeResult {
  return {
    merged: {
      source: "array",
      sourceFileName: "",
      suggestedActivityName: null,
      questions: [],
      learners: [],
      warnings,
      excludedCount: 0,
      metadata: {},
    },
    sourceBreakdown: [],
    matchedCount: 0,
    assessmentOnlyCount: 0,
    evalOnlyCount: 0,
    warnings,
  };
}

/** Format source name for display */
export function formatSourceLabel(source: DataSource): string {
  const labels: Record<DataSource, string> = {
    array: "Array Report",
    globalmeet: "GlobalMeet",
    pigeonhole: "Pigeonhole",
    snowflake_eval: "Live Evaluation Data (Snowflake)",
    snowflake_ondemand: "On-Demand Data (Snowflake)",
  };
  return labels[source] || source;
}
