import snowflake from 'snowflake-sdk';
import fs from 'fs';
import path from 'path';
import type { BaseConnector } from './base';
import type { ConnectorStatus } from './types';

// Disable ocsp checks for faster connection in dev
snowflake.configure({ ocspFailOpen: true });

let connectionInstance: snowflake.Connection | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getPrivateKey(): string {
  // Prefer env var (Vercel), fall back to file path (local dev)
  if (process.env.SNOWFLAKE_PRIVATE_KEY) {
    return process.env.SNOWFLAKE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  const keyPath = process.env.SNOWFLAKE_PRIVATE_KEY_PATH;
  if (!keyPath) throw new Error('Missing SNOWFLAKE_PRIVATE_KEY or SNOWFLAKE_PRIVATE_KEY_PATH');
  return fs.readFileSync(path.resolve(keyPath), 'utf-8');
}

function getConnection(): snowflake.Connection {
  if (connectionInstance) return connectionInstance;

  const privateKey = getPrivateKey();

  connectionInstance = snowflake.createConnection({
    account: requireEnv('SNOWFLAKE_ACCOUNT'),
    username: requireEnv('SNOWFLAKE_USER'),
    role: requireEnv('SNOWFLAKE_ROLE'),
    warehouse: requireEnv('SNOWFLAKE_WAREHOUSE'),
    database: requireEnv('SNOWFLAKE_DATABASE'),
    schema: requireEnv('SNOWFLAKE_SCHEMA'),
    authenticator: 'SNOWFLAKE_JWT',
    privateKey: privateKey,
  });

  return connectionInstance;
}

function connectAsync(conn: snowflake.Connection): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    conn.connect((err, conn) => {
      if (err) reject(err);
      else resolve(conn);
    });
  });
}

export async function ensureConnected(): Promise<snowflake.Connection> {
  const conn = getConnection();
  if (conn.isUp()) return conn;
  return connectAsync(conn);
}

export async function query<T = Record<string, unknown>>(sql: string, binds?: snowflake.Binds): Promise<T[]> {
  const conn = await ensureConnected();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      },
    });
  });
}

export function destroyConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connectionInstance || !connectionInstance.isUp()) {
      connectionInstance = null;
      resolve();
      return;
    }
    connectionInstance.destroy((err) => {
      connectionInstance = null;
      if (err) reject(err);
      else resolve();
    });
  });
}

export const snowflakeConnector: BaseConnector = {
  getName: () => 'Snowflake',
  getInfo: () => {
    const hasKey = (() => {
      try {
        getPrivateKey();
        return true;
      } catch {
        return false;
      }
    })();

    const status: ConnectorStatus = hasKey ? 'disconnected' : 'not_configured';

    return {
      name: 'Snowflake',
      description: 'Enterprise data warehouse for learner analytics (EDUCATION_DB.CORE, 14 tables)',
      status,
      lastSync: null,
      recordCount: null,
      errorMessage: hasKey ? null : 'Private key not found. Set SNOWFLAKE_PRIVATE_KEY env var or place .p8 key in keys/ directory.',
    };
  },
  testConnection: async () => {
    try {
      const conn = await ensureConnected();
      const rows = await query<{ CURRENT_VERSION: string }>('SELECT CURRENT_VERSION() AS CURRENT_VERSION');
      return { success: true, message: `Connected to Snowflake ${rows[0]?.CURRENT_VERSION}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Connection failed: ${message}` };
    }
  },
  refresh: async () => ({ recordsImported: 0 }),
};
