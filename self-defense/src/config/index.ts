// SPDX-License-Identifier: Apache-2.0

/**
 * Per-repo configuration, read from `.github/self-defense.yml` in the
 * *consuming* repository.
 *
 * Security note: on `pull_request_target` the config MUST be read from the base
 * ref, never from the PR head. Reading it from the head would let a PR author
 * add themselves to `trusted.users` in the same PR being evaluated. This is the
 * same trap fossier documents for `pull_request_target`, and the loader below
 * takes the ref explicitly so the caller cannot get it wrong by omission.
 */

import type { EventKind, Outcome } from '../types/index.js';

/**
 * Cost of each error class, in arbitrary but comparable units. The closing
 * threshold is derived as `fp / (fp + fn)` rather than hand-picked, so the
 * operator states a policy ("closing a real contributor is 40x worse than
 * letting spam through") and the arithmetic follows.
 */
export interface Costs {
  readonly falsePositive: number;
  readonly falseNegative: number;
}

export interface ActionPolicy {
  readonly close: boolean;
  readonly comment: boolean;
  readonly label: string | null;
  readonly lock: boolean;
}

/** Guards that downgrade the action to review-only. See DESIGN.md §4. */
export interface SafetyPolicy {
  /** Refuse to act on a KB older than this. */
  readonly maxKbAgeDays: number;
  /** Refuse to act when held-out precision is below this. */
  readonly minPrecision: number;
  /** Minimum share of non-abstaining signals before a `deny` is permitted. */
  readonly minCoverage: number;
  /** Label that, when present, suppresses all automated action on the item. */
  readonly manualOverrideLabel: string;
  /** Evaluate and record, but take no action. The correct way to deploy. */
  readonly shadowMode: boolean;
}

export interface KindConfig {
  readonly enabled: boolean;
  readonly costs: Costs;
  readonly deny: ActionPolicy;
  readonly review: ActionPolicy;
}

export interface Config {
  readonly version: 1;
  readonly trusted: { readonly users: readonly string[]; readonly orgs: readonly string[] };
  readonly blocked: { readonly users: readonly string[] };
  readonly safety: SafetyPolicy;
  readonly issue: KindConfig;
  readonly pull: KindConfig;
  /** Deadline for the whole stage-1 fan-out. Signals past it abstain. */
  readonly networkDeadlineMs: number;
  /** Where corpus records are dispatched. Empty disables learning. */
  readonly corpusRepo: string;
  /** Off by default: a policy choice, not a spam indicator. See DESIGN.md §6. */
  readonly rejectAiCoauthored: boolean;
}

/** Conservative defaults: shadow mode on, nothing closes without opting in. */
export declare const DEFAULT_CONFIG: Config;

/**
 * Load and validate config from a repository.
 *
 * @param repoRoot checkout root of the consuming repo
 * @param ref      the ref the config was read from; must be the base ref on
 *                 `pull_request_target`. Recorded for audit.
 */
export declare function loadConfig(repoRoot: string, ref: string): Promise<Config>;

/** Derived closing threshold on `P(spam)`: `fp / (fp + fn)`. */
export declare function closeThreshold(costs: Costs): number;

/** Threshold above which an item is labelled for human review. */
export declare function reviewThreshold(costs: Costs): number;

/** Resolve the policy that applies to a given outcome and event kind. */
export declare function policyFor(cfg: Config, kind: EventKind, outcome: Outcome): ActionPolicy | null;
