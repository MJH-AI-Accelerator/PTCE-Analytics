import type { ConnectorInfo, ConnectorStatus } from "./types";

export interface BaseConnector {
  getName(): string;
  getInfo(): ConnectorInfo;
  testConnection(): Promise<{ success: boolean; message: string }>;
  refresh(): Promise<{ recordsImported: number }>;
}

function makeStub(name: string, description: string, status?: ConnectorStatus): BaseConnector {
  return {
    getName: () => name,
    getInfo: () => ({
      name,
      description,
      status: status || "not_configured" as ConnectorStatus,
      lastSync: null,
      recordCount: null,
      errorMessage: null,
    }),
    testConnection: async () => ({ success: false, message: `${name} connector is not configured. Set credentials in environment variables.` }),
    refresh: async () => ({ recordsImported: 0 }),
  };
}

// Note: The real Snowflake connector (lib/connectors/snowflake.ts) uses Node.js modules
// and must be imported server-side only. This stub is for the client-side UI.
export const connectors: BaseConnector[] = [
  makeStub("Snowflake", "Enterprise data warehouse for learner analytics (EDUCATION_DB.CORE, 14 tables)", "disconnected"),
  makeStub("GlobalMeet", "Webinar and virtual event platform"),
  makeStub("Array", "Survey and assessment data platform"),
  makeStub("Pigeonhole", "Audience engagement and polling platform"),
];
