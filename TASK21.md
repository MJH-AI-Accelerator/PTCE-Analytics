# TASK21 — Data Sources Page (Connector Status UI)

## Phase
Phase 5: Advanced Features

## What to Build
Build the Data Sources page showing connection status cards for external data connectors (Snowflake, GlobalMeet, Array, Pigeonhole). Include test/refresh buttons and a BaseConnector interface with stub implementations.

## Reference
- `src/connectors/` — existing connector stubs for Snowflake, GlobalMeet, Array, Pigeonhole

## Steps

1. **Connector types** (`lib/connectors/types.ts`):
   - `ConnectorStatus`: "connected" | "disconnected" | "error" | "not_configured"
   - `ConnectorInfo`: name, description, status, lastSync, recordCount, errorMessage
   - `ConnectorConfig`: credentials shape per connector type

2. **Base connector interface** (`lib/connectors/base.ts`):
   - `BaseConnector` interface:
     - `getName(): string`
     - `getStatus(): Promise<ConnectorStatus>`
     - `testConnection(): Promise<{ success: boolean, message: string }>`
     - `refresh(): Promise<{ recordsImported: number }>`
   - Stub implementations for each connector:
     - `SnowflakeConnector` — returns "not_configured"
     - `GlobalMeetConnector` — returns "not_configured"
     - `ArrayConnector` — returns "not_configured"
     - `PigeonholeConnector` — returns "not_configured"

3. **Data Sources page** (`app/data-sources/page.tsx`):
   - Grid of connector status cards, each showing:
     - Connector name and icon
     - Status badge (color-coded: green=connected, gray=not configured, red=error)
     - Last sync timestamp (or "Never")
     - Record count from last sync
     - "Test Connection" button → shows success/failure toast
     - "Refresh" button → triggers data pull (stub: shows "not configured" message)
   - Configuration info section: instructions for setting up each connector
   - Note: "Connector implementations are stubs — configure credentials in environment variables"

## Files to Create/Modify
- `lib/connectors/types.ts` (new)
- `lib/connectors/base.ts` (new)
- `app/data-sources/page.tsx` (replace stub)

## Browser Verification
- Data Sources page shows 4 connector cards
- All show "Not Configured" status
- "Test Connection" shows appropriate message
- Status badges are color-coded
- Page layout is clean and informative
