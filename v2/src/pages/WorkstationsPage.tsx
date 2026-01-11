import { useState, useEffect, useMemo } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Wifi, WifiOff, AlertTriangle } from "lucide-react";

// Type definitions based on ninjaone.ts WorkstationResult
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

interface WorkstationResult {
  summary: {
    totalWorkstations: number;
    onlineWorkstations: number;
    offlineWorkstations: number;
    workstationsNeedingPatches: number;
  };
  workstations: DeviceInfo[];
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
  icon: typeof Monitor;
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

export function WorkstationsPage() {
  const navigate = useNavigate();
  const getWorkstations = useAction(api.ninjaone.getWorkstations);
  const [data, setData] = useState<WorkstationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWorkstations()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [getWorkstations]);

  // Sort workstations by client name, then workstation name
  const sortedWorkstations = useMemo(() => {
    if (!data?.workstations) return [];
    return [...data.workstations].sort((a, b) => {
      const clientCompare = a.clientName.localeCompare(b.clientName);
      if (clientCompare !== 0) return clientCompare;
      return a.name.localeCompare(b.name);
    });
  }, [data?.workstations]);

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
        <h2 className="text-xl font-semibold">Failed to load workstations</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workstations</h1>
        <p className="text-muted-foreground">
          Workstation health and patch status from NinjaOne
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Workstations"
          value={data?.summary.totalWorkstations ?? 0}
          icon={Monitor}
        />
        <SummaryCard
          title="Online Workstations"
          value={data?.summary.onlineWorkstations ?? 0}
          icon={Wifi}
          iconClassName="text-green-500"
        />
        <SummaryCard
          title="Offline Workstations"
          value={data?.summary.offlineWorkstations ?? 0}
          icon={WifiOff}
          iconClassName="text-red-500"
        />
        <SummaryCard
          title="Needing Patches"
          value={data?.summary.workstationsNeedingPatches ?? 0}
          icon={AlertTriangle}
          iconClassName="text-yellow-500"
        />
      </div>

      {/* Workstations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workstation List</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedWorkstations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No workstations found.
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
                  {sortedWorkstations.map((workstation) => {
                    const totalPending =
                      workstation.patches.osPending + workstation.patches.softwarePending;
                    return (
                      <tr
                        key={workstation.id}
                        className="border-b cursor-pointer hover:bg-muted/50 transition-colors focus:bg-muted/50 focus:outline-none"
                        onClick={() => navigate(`/workstations/${workstation.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/workstations/${workstation.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${workstation.name}`}
                      >
                        <td className="p-3">
                          <span className="font-medium">{workstation.name}</span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {workstation.clientName}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={workstation.status} />
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {workstation.os.name}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {workstation.uptime ? `${workstation.uptime} days` : "N/A"}
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
