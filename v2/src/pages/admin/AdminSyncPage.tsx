import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, RefreshCw, CheckCircle2, XCircle, Clock, Users, Ticket, MessageSquare, Globe } from "lucide-react";

type SyncType = "clients" | "tickets" | "feedback" | "domains";

interface SyncMetadata {
  lastSync: string;
  recordsSynced: number;
  status: "success" | "failed";
  errorMessage?: string;
}

interface SyncCardProps {
  title: string;
  description: string;
  syncType: SyncType;
  icon: React.ReactNode;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncData: SyncMetadata | null | undefined;
}

function SyncCard({ title, description, icon, onSync, isSyncing, lastSyncData }: SyncCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Button
          onClick={onSync}
          disabled={isSyncing}
          size="sm"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {lastSyncData ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {lastSyncData.status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${lastSyncData.status === "success" ? "text-green-600" : "text-red-600"}`}>
                {lastSyncData.status === "success" ? "Last sync successful" : "Last sync failed"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDate(lastSyncData.lastSync)}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Records synced: <span className="font-medium">{lastSyncData.recordsSynced.toLocaleString()}</span>
            </div>
            {lastSyncData.errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                Error: {lastSyncData.errorMessage}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No sync history available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSyncPage() {
  const currentUser = useQuery(api.users.me);

  // Get latest sync metadata for each type
  const clientsSync = useQuery(api.syncMetadata.getLatestByType, { syncType: "clients" });
  const ticketsSync = useQuery(api.syncMetadata.getLatestByType, { syncType: "tickets" });
  const feedbackSync = useQuery(api.syncMetadata.getLatestByType, { syncType: "feedback" });
  const domainsSync = useQuery(api.syncMetadata.getLatestByType, { syncType: "domains" });

  // Actions for syncing
  const syncClients = useAction(api.halopsa.syncClients);
  const syncTickets = useAction(api.halopsa.syncTickets);
  const syncFeedback = useAction(api.halopsa.syncFeedback);
  const syncDomains = useAction(api.twentyi.syncDomains);
  const performFullSync = useAction(api.halopsa.performFullSync);

  // Loading states
  const [syncingClients, setSyncingClients] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);
  const [syncingFeedback, setSyncingFeedback] = useState(false);
  const [syncingDomains, setSyncingDomains] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Super admin check
  const realUser = currentUser?.realUser ?? currentUser;
  const isSuperAdmin = realUser?.role === "super_admin";

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          Only super administrators can access this page.
        </p>
      </div>
    );
  }

  const handleSyncClients = async () => {
    setSyncingClients(true);
    try {
      const result = await syncClients({});
      if (result.success) {
        alert(`Successfully synced ${result.recordsSynced} clients`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sync clients");
    } finally {
      setSyncingClients(false);
    }
  };

  const handleSyncTickets = async () => {
    setSyncingTickets(true);
    try {
      const result = await syncTickets({});
      if (result.success) {
        alert(`Successfully synced ${result.recordsSynced} tickets`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sync tickets");
    } finally {
      setSyncingTickets(false);
    }
  };

  const handleSyncFeedback = async () => {
    setSyncingFeedback(true);
    try {
      const result = await syncFeedback({});
      if (result.success) {
        alert(`Successfully synced ${result.recordsSynced} feedback entries`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sync feedback");
    } finally {
      setSyncingFeedback(false);
    }
  };

  const handleSyncDomains = async () => {
    setSyncingDomains(true);
    try {
      const result = await syncDomains({});
      if (result.success) {
        alert(`Successfully synced ${result.recordsSynced} domains`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sync domains");
    } finally {
      setSyncingDomains(false);
    }
  };

  const handleFullSync = async () => {
    setSyncingAll(true);
    try {
      // Run performFullSync (clients, tickets, feedback) AND syncDomains together
      const [haloResult, domainsResult] = await Promise.all([
        performFullSync({}),
        syncDomains({})
      ]);

      const totalRecords =
        haloResult.clientsResult.recordsSynced +
        haloResult.ticketsResult.recordsSynced +
        haloResult.feedbackResult.recordsSynced +
        domainsResult.recordsSynced;

      const allSuccess =
        haloResult.clientsResult.success &&
        haloResult.ticketsResult.success &&
        haloResult.feedbackResult.success &&
        domainsResult.success;

      if (allSuccess) {
        alert(`Full sync complete!\n\nClients: ${haloResult.clientsResult.recordsSynced}\nTickets: ${haloResult.ticketsResult.recordsSynced}\nFeedback: ${haloResult.feedbackResult.recordsSynced}\nDomains: ${domainsResult.recordsSynced}\n\nTotal: ${totalRecords} records`);
      } else {
        const errors = [];
        if (!haloResult.clientsResult.success) errors.push(`Clients: ${haloResult.clientsResult.error}`);
        if (!haloResult.ticketsResult.success) errors.push(`Tickets: ${haloResult.ticketsResult.error}`);
        if (!haloResult.feedbackResult.success) errors.push(`Feedback: ${haloResult.feedbackResult.error}`);
        if (!domainsResult.success) errors.push(`Domains: ${domainsResult.error}`);
        alert(`Sync completed with errors:\n\n${errors.join("\n")}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to perform full sync");
    } finally {
      setSyncingAll(false);
    }
  };

  const isAnySyncing = syncingClients || syncingTickets || syncingFeedback || syncingDomains || syncingAll;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sync Management</h1>
          <p className="text-muted-foreground">
            Manually trigger and monitor data synchronization operations
          </p>
        </div>
        <Button
          onClick={handleFullSync}
          disabled={isAnySyncing}
          size="lg"
        >
          {syncingAll ? (
            <>
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Syncing All...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-5 w-5" />
              Full Sync All
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SyncCard
          title="HaloPSA Clients"
          description="Sync client/company data from HaloPSA"
          syncType="clients"
          icon={<Users className="h-5 w-5 text-blue-500" />}
          onSync={handleSyncClients}
          isSyncing={syncingClients || syncingAll}
          lastSyncData={clientsSync}
        />

        <SyncCard
          title="HaloPSA Tickets"
          description="Sync support tickets from HaloPSA"
          syncType="tickets"
          icon={<Ticket className="h-5 w-5 text-orange-500" />}
          onSync={handleSyncTickets}
          isSyncing={syncingTickets || syncingAll}
          lastSyncData={ticketsSync}
        />

        <SyncCard
          title="HaloPSA Feedback"
          description="Sync customer feedback/satisfaction data"
          syncType="feedback"
          icon={<MessageSquare className="h-5 w-5 text-green-500" />}
          onSync={handleSyncFeedback}
          isSyncing={syncingFeedback || syncingAll}
          lastSyncData={feedbackSync}
        />

        <SyncCard
          title="20i Domains"
          description="Sync domain and hosting data from 20i"
          syncType="domains"
          icon={<Globe className="h-5 w-5 text-purple-500" />}
          onSync={handleSyncDomains}
          isSyncing={syncingDomains || syncingAll}
          lastSyncData={domainsSync}
        />
      </div>
    </div>
  );
}
