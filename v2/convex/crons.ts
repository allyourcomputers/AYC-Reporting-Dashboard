import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run full HaloPSA sync every 6 hours
// This syncs clients, tickets, and feedback from HaloPSA
crons.interval(
  "sync_halopsa",
  { hours: 6 },
  internal.halopsa.scheduledFullSync,
  { monthsBack: 12 } // Sync last 12 months of tickets
);

// Run 20i domain sync daily at 2:00 AM UTC
// Domains don't change often, so daily sync is sufficient
crons.daily(
  "sync_twentyi_domains",
  { hourUTC: 2, minuteUTC: 0 },
  internal.twentyi.scheduledSyncDomains,
  {}
);

export default crons;
