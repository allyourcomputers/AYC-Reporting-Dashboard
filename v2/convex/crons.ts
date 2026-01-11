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

export default crons;
