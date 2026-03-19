export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMapping(mapping: Record<string, string | null>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Need at least email OR (first_name + last_name)
  if (!mapping.email && !(mapping.first_name && mapping.last_name)) {
    errors.push("Email column is required (or both First Name and Last Name).");
  }

  if (!mapping.pre_score && !mapping.post_score) {
    warnings.push("No score columns mapped. Score analysis will be unavailable.");
  }

  if (!mapping.pre_confidence && !mapping.post_confidence) {
    warnings.push("No confidence columns mapped. Confidence analysis will be unavailable.");
  }

  if (!mapping.employer) {
    warnings.push("No employer column mapped. Employer analysis will be unavailable.");
  }

  if (!mapping.activity_name && !mapping.activity_id) {
    warnings.push("No activity identifier mapped. Activity will use metadata from the form.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
