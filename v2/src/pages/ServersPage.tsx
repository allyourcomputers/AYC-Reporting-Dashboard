import { useState, useEffect, useMemo } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Wifi, WifiOff, AlertTriangle } from "lucide-react";

// Type definitions based on ninjaone.ts ServerResult
interface DeviceInfo {
  id: number;
  name: string;
  organizationId: number;
  clientName: string;
  status: "ONLINE" | "OFFLINE";
  lastContact: string | null;
  uptime: string | null;
  os: {
    name: string;
    version: string;
    type: "windows" | "linux" | "mac" | "unknown";
  };
  patches: {
    osPending: number;
    softwarePending: number;
    lastScan: string | null;
  };
}

interface ServerResult {
  summary: {
    totalServers: number;
    onlineServers: number;
    offlineServers: number;
    serversNeedingPatches: number;
  };
  servers: DeviceInfo[];
  lastUpdated: string;
}

function StatusBadge({ status }: { status: "ONLINE" | "OFFLINE" }) {
  if (status === "ONLINE") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
      Offline
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: number;
  icon: typeof Server;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClassName || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function ServersPage() {
  const navigate = useNavigate();
  const getServers = useAction(api.ninjaone.getServers);
  const [data, setData] = useState<ServerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getServers()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [getServers]);

  // Sort servers by client name, then server name
  const sortedServers = useMemo(() => {
    if (!data?.servers) return [];
    return [...data.servers].sort((a, b) => {
      const clientCompare = a.clientName.localeCompare(b.clientName);
      if (clientCompare !== 0) return clientCompare;
      return a.name.localeCompare(b.name);
    });
  }, [data?.servers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-xl font-semibold">Failed to load servers</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Servers</h1>
        <p className="text-muted-foreground">
          Server health and patch status from NinjaOne
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Servers"
          value={data?.summary.totalServers ?? 0}
          icon={Server}
        />
        <SummaryCard
          title="Online Servers"
          value={data?.summary.onlineServers ?? 0}
          icon={Wifi}
          iconClassName="text-green-500"
        />
        <SummaryCard
          title="Offline Servers"
          value={data?.summary.offlineServers ?? 0}
          icon={WifiOff}
          iconClassName="text-red-500"
        />
        <SummaryCard
          title="Needing Patches"
          value={data?.summary.serversNeedingPatches ?? 0}
          icon={AlertTriangle}
          iconClassName="text-yellow-500"
        />
      </div>

      {/* Servers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Server List</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedServers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No servers found.
            </p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th scope="col" className="p-3 text-left font-medium">Name</th>
                    <th scope="col" className="p-3 text-left font-medium">Client</th>
                    <th scope="col" className="p-3 text-left font-medium">Status</th>
                    <th scope="col" className="p-3 text-left font-medium">OS</th>
                    <th scope="col" className="p-3 text-left font-medium">Uptime</th>
                    <th scope="col" className="p-3 text-left font-medium">Patches</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedServers.map((server) => {
                    const totalPending =
                      server.patches.osPending + server.patches.softwarePending;
                    return (
                      <tr
                        key={server.id}
                        className="border-b cursor-pointer hover:bg-muted/50 transition-colors focus:bg-muted/50 focus:outline-none"
                        onClick={() => navigate(`/servers/${server.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/servers/${server.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${server.name}`}
                      >
                        <td className="p-3">
                          <span className="font-medium">{server.name}</span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {server.clientName}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={server.status} />
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {server.os.name}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {server.uptime ? `${server.uptime} days` : "N/A"}
                        </td>
                        <td className="p-3">
                          {totalPending > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                              {totalPending} pending
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Up to date
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
