import { useState, useEffect, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Server, AlertTriangle } from "lucide-react";

// Type definitions based on twentyi.ts DomainsResult
interface DomainInfo {
  id: string;
  name: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: "active" | "expiring-soon" | "expired";
  hasHosting: boolean;
  hostingPackageName: string | null;
}

interface DomainsResult {
  summary: {
    totalDomains: number;
    domainsWithHosting: number;
    domainsExpiringSoon: number;
  };
  domains: DomainInfo[];
  lastUpdated: string;
}

function StatusBadge({ status }: { status: "active" | "expiring-soon" | "expired" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        Active
      </span>
    );
  }
  if (status === "expiring-soon") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
        Expiring Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
      Expired
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
  icon: typeof Globe;
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

export function DomainsPage() {
  const getDomains = useAction(api.twentyi.getDomains);
  const [data, setData] = useState<DomainsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDomains()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [getDomains]);

  // Sort domains by name
  const sortedDomains = useMemo(() => {
    if (!data?.domains) return [];
    return [...data.domains].sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.domains]);

  // Format date for display
  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

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
        <h2 className="text-xl font-semibold">Failed to load domains</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Domains</h1>
        <p className="text-muted-foreground">
          Domain registration and hosting status from 20i
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Domains"
          value={data?.summary.totalDomains ?? 0}
          icon={Globe}
        />
        <SummaryCard
          title="With Hosting"
          value={data?.summary.domainsWithHosting ?? 0}
          icon={Server}
          iconClassName="text-blue-500"
        />
        <SummaryCard
          title="Expiring Soon"
          value={data?.summary.domainsExpiringSoon ?? 0}
          icon={AlertTriangle}
          iconClassName="text-yellow-500"
        />
      </div>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Domain List</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedDomains.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No domains found.
            </p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th scope="col" className="p-3 text-left font-medium">Domain Name</th>
                    <th scope="col" className="p-3 text-left font-medium">Status</th>
                    <th scope="col" className="p-3 text-left font-medium">Expiry Date</th>
                    <th scope="col" className="p-3 text-left font-medium">Days Left</th>
                    <th scope="col" className="p-3 text-left font-medium">Hosting Package</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDomains.map((domain) => (
                    <tr key={domain.id} className="border-b">
                      <td className="p-3">
                        <span className="font-medium">{domain.name}</span>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={domain.status} />
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(domain.expiryDate)}
                      </td>
                      <td className="p-3">
                        {domain.daysUntilExpiry < 0 ? (
                          <span className="text-red-600 font-medium">
                            {Math.abs(domain.daysUntilExpiry)} days ago
                          </span>
                        ) : (
                          <span
                            className={
                              domain.daysUntilExpiry <= 30
                                ? "text-yellow-600 font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {domain.daysUntilExpiry} days
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {domain.hostingPackageName || "No Hosting"}
                      </td>
                    </tr>
                  ))}
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
