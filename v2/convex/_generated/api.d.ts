/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as companies from "../companies.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as domains from "../domains.js";
import type * as feedback from "../feedback.js";
import type * as halopsa from "../halopsa.js";
import type * as lib_auth from "../lib/auth.js";
import type * as migration from "../migration.js";
import type * as ninjaone from "../ninjaone.js";
import type * as reports from "../reports.js";
import type * as syncMetadata from "../syncMetadata.js";
import type * as tickets from "../tickets.js";
import type * as twentyi from "../twentyi.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  companies: typeof companies;
  crons: typeof crons;
  dashboard: typeof dashboard;
  domains: typeof domains;
  feedback: typeof feedback;
  halopsa: typeof halopsa;
  "lib/auth": typeof lib_auth;
  migration: typeof migration;
  ninjaone: typeof ninjaone;
  reports: typeof reports;
  syncMetadata: typeof syncMetadata;
  tickets: typeof tickets;
  twentyi: typeof twentyi;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
