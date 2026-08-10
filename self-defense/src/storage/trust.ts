// SPDX-License-Identifier: Apache-2.0

/**
 * `trust.yaml` — the human-owned trust list, replacing fossier's `VOUCHED.td`.
 *
 * YAML rather than a bespoke line format so it validates against a JSON Schema,
 * carries structured reasons and provenance, and needs no hand-written parser.
 * Entries change only by pull request; nothing in the automated path writes here.
 */

import type { TrustTier } from '../types/index.js';

export interface BlockedEntry {
  readonly login: string;
  readonly reason: string;
  readonly at: string;
  /** Who or what added the entry. Automated additions are never made today. */
  readonly source: 'manual' | 'auto';
}

export interface TrustFile {
  readonly version: 1;
  readonly trusted: { readonly users: readonly string[]; readonly orgs: readonly string[] };
  readonly blocked: readonly BlockedEntry[];
}

/** Read `data/trust/trust.yaml` from the action path. Zero network. */
export declare function loadTrust(actionPath: string): Promise<TrustFile>;

/**
 * Resolve a login against the trust file.
 * Blocked is checked before trusted so a blocked account cannot be elevated by
 * also appearing in a trusted org — order that fossier gets right and that is
 * worth preserving explicitly.
 */
export declare function resolve(trust: TrustFile, login: string): { tier: TrustTier; reason: string } | null;
