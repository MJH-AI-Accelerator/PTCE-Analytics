import type { ConnectorInfo, ConnectorStatus } from "./types";
import { snowflakeConnector } from "./snowflake";

export interface BaseConnector {
  getName(): string;
  getInfo(): ConnectorInfo;
  testConnection(): Promise<{ success: boolean; message: string }>;
  refresh(): Promise<{ recordsImported: number }>;
}

function makeStub(name: string, description: string): BaseConnector {
  return {
    getName: () => name,
    getInfo: () => ({
      name,
      description,
      status: "not_configured" as ConnectorStatus,
      lastSync: null,
      recordCount: null,
      errorMessage: null,
    }),
    testConnection: async () => ({ success: false, message: `${name} connector is not configured. Set credentials in environment variables.` }),
    refresh: async () => ({ recordsImported: 0 }),
  };
}

export const connectors: BaseConnector[] = [
  snowflakeConnector,
  makeStub("GlobalMeet", "Webinar and virtual event platform"),
  makeStub("Array", "Survey and assessment data platform"),
  makeStub("Pigeonhole", "Audience engagement and polling platform"),
];
