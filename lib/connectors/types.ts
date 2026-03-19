export type ConnectorStatus = "connected" | "disconnected" | "error" | "not_configured";

export interface ConnectorInfo {
  name: string;
  description: string;
  status: ConnectorStatus;
  lastSync: string | null;
  recordCount: number | null;
  errorMessage: string | null;
}
