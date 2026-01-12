import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ExternalLink, AlertTriangle, Monitor, HardDrive, Shield } from "lucide-react";

// Type definition based on DeviceDetails from convex/ninjaone.ts
interface DeviceDetails {
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
    osPendingList: Array<{ name?: string; kb?: string; severity?: string; status: string }>;
    softwarePendingList: Array<{ name?: string; severity?: string; status: string }>;
    lastScan: string | null;
  };
  details: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    biosVersion?: string;
  };
  ninjaoneUrl: string | null;
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

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity) return null;

  const severityLower = severity.toLowerCase();
  let className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ";

  if (severityLower === "critical") {
    className += "bg-red-100 text-red-800 border border-red-200";
  } else if (severityLower === "important" || severityLower === "high") {
    className += "bg-orange-100 text-orange-800 border border-orange-200";
  } else if (severityLower === "moderate" || severityLower === "medium") {
    className += "bg-yellow-100 text-yellow-800 border border-yellow-200";
  } else {
    className += "bg-gray-100 text-gray-800 border border-gray-200";
  }

  return <span className={className}>{severity}</span>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-muted last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "N/A"}</span>
    </div>
  );
}

export function WorkstationDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const getWorkstationDetails = useAction(api.ninjaone.getWorkstationDetails);
  const [data, setData] = useState<DeviceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deviceId) {
      setLoading(true);
      setError(null);
      getWorkstationDetails({ deviceId: parseInt(deviceId, 10) })
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [deviceId, getWorkstationDetails]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          to="/workstations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Workstations
        </Link>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-16 w-16 text-destructive" />
          <h2 className="text-xl font-semibold">Failed to load workstation details</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          to="/workstations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Workstations
        </Link>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Workstation not found</h2>
        </div>
      </div>
    );
  }

  const hasHardwareDetails =
    data.details.manufacturer ||
    data.details.model ||
    data.details.serialNumber ||
    data.details.biosVersion;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <Link
          to="/workstations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Workstations
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{data.name}</h1>
            <StatusBadge status={data.status} />
          </div>

          {data.ninjaoneUrl && (
            <a
              href={data.ninjaoneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              Open in NinjaOne
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Workstation Info and Hardware Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Workstation Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Workstation Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <InfoRow label="Client" value={data.clientName} />
              <InfoRow
                label="Last Contact"
                value={data.lastContact ? new Date(data.lastContact).toLocaleString() : null}
              />
              <InfoRow label="Uptime" value={data.uptime ? `${data.uptime} days` : null} />
              <InfoRow label="Operating System" value={data.os.name} />
              <InfoRow label="OS Version" value={data.os.version} />
            </div>
          </CardContent>
        </Card>

        {/* Hardware Details Card */}
        {hasHardwareDetails && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Hardware Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <InfoRow label="Manufacturer" value={data.details.manufacturer} />
                <InfoRow label="Model" value={data.details.model} />
                <InfoRow label="Serial Number" value={data.details.serialNumber} />
                <InfoRow label="BIOS Version" value={data.details.biosVersion} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Patches Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* OS Patches Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">OS Patches</CardTitle>
            </div>
            {data.patches.osPending > 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                {data.patches.osPending} pending
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Up to date</span>
            )}
          </CardHeader>
          <CardContent>
            {data.patches.osPendingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending OS patches.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {data.patches.osPendingList.map((patch, index) => (
                  <div
                    key={patch.kb || patch.name || index}
                    className="flex items-start justify-between gap-2 py-2 border-b border-muted last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {patch.name || patch.kb || "Unknown patch"}
                      </p>
                      {patch.kb && patch.name && (
                        <p className="text-xs text-muted-foreground">{patch.kb}</p>
                      )}
                    </div>
                    <SeverityBadge severity={patch.severity} />
                  </div>
                ))}
              </div>
            )}
            {data.patches.lastScan && (
              <p className="text-xs text-muted-foreground mt-4">
                Last scan: {new Date(data.patches.lastScan).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Software Patches Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Software Patches</CardTitle>
            </div>
            {data.patches.softwarePending > 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                {data.patches.softwarePending} pending
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Up to date</span>
            )}
          </CardHeader>
          <CardContent>
            {data.patches.softwarePendingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending software patches.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {data.patches.softwarePendingList.map((patch, index) => (
                  <div
                    key={patch.name || index}
                    className="flex items-start justify-between gap-2 py-2 border-b border-muted last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {patch.name || "Unknown patch"}
                      </p>
                    </div>
                    <SeverityBadge severity={patch.severity} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
