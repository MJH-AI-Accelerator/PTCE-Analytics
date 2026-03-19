"use client";

import { useState } from "react";
import { connectors } from "@/lib/connectors/base";
import type { ConnectorInfo } from "@/lib/connectors/types";
import { Database, Wifi, WifiOff, AlertCircle } from "lucide-react";

const statusColors = {
  connected: "bg-green-100 text-teal-700",
  disconnected: "bg-gray-100 text-navy-600",
  error: "bg-red-100 text-red-700",
  not_configured: "bg-yellow-100 text-yellow-700",
};

const statusLabels = {
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
  not_configured: "Not Configured",
};

export default function DataSources() {
  const [infos] = useState<ConnectorInfo[]>(connectors.map((c) => c.getInfo()));
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const handleTest = async (name: string) => {
    const connector = connectors.find((c) => c.getName() === name);
    if (!connector) return;
    const result = await connector.testConnection();
    setTestResults((prev) => ({ ...prev, [name]: result.message }));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Data Sources</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {infos.map((info) => (
          <div key={info.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Database className="text-navy-300" size={24} />
                <div>
                  <h3 className="font-semibold">{info.name}</h3>
                  <p className="text-sm text-navy-400">{info.description}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[info.status]}`}>
                {statusLabels[info.status]}
              </span>
            </div>

            <div className="text-sm text-navy-400 space-y-1 mb-4">
              <div>Last sync: {info.lastSync ?? "Never"}</div>
              <div>Records: {info.recordCount ?? "—"}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTest(info.name)}
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-navy-50"
              >
                Test Connection
              </button>
              <button
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-navy-50 opacity-50 cursor-not-allowed"
                disabled
              >
                Refresh
              </button>
            </div>

            {testResults[info.name] && (
              <p className="mt-3 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">{testResults[info.name]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-3">Configuration</h2>
        <p className="text-sm text-navy-400">
          Connector implementations are stubs. To enable a connector, configure the corresponding
          credentials in your environment variables (.env.local) and implement the connector logic
          in <code className="bg-navy-50 px-1 rounded">lib/connectors/</code>.
        </p>
      </div>
    </div>
  );
}
