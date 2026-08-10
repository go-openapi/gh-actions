// SPDX-License-Identifier: Apache-2.0

/**
 * Account-level feature extraction.
 *
 * These are the facts; the llr attached to each is fitted from the corpus, not
 * chosen here. That separation is the point — fossier bakes
 * `min(days/365, 1.0)` into the signal, so changing how much account age
 * matters means editing code. Here the extractor reports "3 days" and the KB
 * says what 3 days is worth this month.
 *
 * Every extractor abstains rather than guessing. A user whose profile could not
 * be fetched contributes nothing, which under the log-odds algebra is exactly
 * correct and needs no weight redistribution.
 */

import type { Evidence } from '../types/index.js';
import type { LoadedKb } from '../storage/kb.js';

/** Raw profile facts. Deliberately unopinionated — no scoring here. */
export interface AccountFacts {
  readonly ageDays: number | null;
  readonly publicRepos: number | null;
  readonly publicGists: number | null;
  readonly followers: number | null;
  readonly following: number | null;
  readonly hasBio: boolean | null;
  readonly hasAvatar: boolean | null;
  readonly orgCount: number | null;
  readonly emailDomain: string | null;
}

/** Fetch profile facts under a deadline. Returns nulls, never throws. */
export declare function fetchFacts(login: string, signal: AbortSignal): Promise<AccountFacts>;

/**
 * Turn facts into evidence via the KB's fitted bins.
 *
 * Note what is *not* here: fossier's "old but empty accounts shouldn't get full
 * credit" multiplier, and its `org_membership → 0.2` penalty for having no
 * public orgs. Both are guesses that punish ordinary developers — most
 * legitimate contributors belong to no public org. If those interactions are
 * real, the fitted bins will show them.
 */
export declare function toEvidence(kb: LoadedKb, kind: 'issue' | 'pull', facts: AccountFacts): readonly Evidence[];

/**
 * Flood detection: items opened by this author across the *org* in a window.
 * Org-wide rather than per-repo, which is where a shared corpus pays off — the
 * canonical spam pattern is one item in each of thirty repos, which no
 * per-repo threshold ever sees.
 */
export declare function floodEvidence(
  login: string,
  windowHours: number,
  signal: AbortSignal,
): Promise<Evidence>;

/** Bot detection from `type` and username shape. Bots are policy, not spam. */
export declare function isBot(login: string, type: string): boolean;
