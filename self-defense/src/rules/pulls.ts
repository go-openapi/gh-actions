// SPDX-License-Identifier: Apache-2.0

/**
 * Pull-request-specific rules.
 *
 * PRs carry far more evidence than issues: a diff, commits, signatures, a
 * branch name, a base ref. The diff in particular is hard to fake cheaply —
 * a spammer optimising for volume produces recognisable diff shapes.
 *
 * The asymmetric-cost policy bites hardest here. Closing a first-time
 * contributor's genuine PR is the worst outcome this system can produce, and
 * the thresholds in `config` are set accordingly.
 */

import type { Evidence, EventContext, RedactedText } from '../types/index.js';
import type { LoadedKb } from '../storage/kb.js';

/**
 * Signals from the payload alone. The `pull_request` payload already carries
 * `changed_files`, `additions`, `deletions` and `commits`, so useful diff-shape
 * evidence is available at stage 0 without touching the files API.
 */
export declare function offlineSignals(
  kb: LoadedKb,
  ctx: EventContext,
  text: RedactedText,
): readonly Evidence[];

/**
 * Diff shape: docs-only, whitespace-only, lockfile-only, generated-files-only,
 * and diff size against description length. A one-character README change with
 * a 2000-word body is a recognisable pattern; so is a 40-file diff with an
 * empty description.
 */
export declare function diffShape(ctx: EventContext, files: readonly ChangedFile[]): Evidence;

export interface ChangedFile {
  readonly filename: string;
  readonly additions: number;
  readonly deletions: number;
  readonly status: string;
}

/**
 * Commit signature verification, and commit author-email domain against the
 * profile. Unsigned is weak evidence at most — most legitimate contributors do
 * not sign — so this must abstain rather than penalise, which is where
 * fossier's `0.3 + ratio * 0.7` floor gets it wrong by making "unsigned" a
 * permanent 0.3 tax.
 */
export declare function commitSignals(commits: readonly CommitInfo[]): readonly Evidence[];

export interface CommitInfo {
  readonly sha: string;
  readonly verified: boolean;
  readonly verificationReason: string;
  readonly authorEmail: string;
  readonly message: string;
}

/**
 * AI co-author detection. **Off by default and separated from the spam score**:
 * whether AI-assisted contributions are welcome is a project policy, not
 * evidence of spam. When enabled it produces a hard outcome of its own rather
 * than feeding llr into the accumulator, so it can never be confused with a
 * spam finding in the breakdown we post.
 */
export declare function aiCoauthored(commits: readonly CommitInfo[]): { found: boolean; agent: string | null };

/** Branch naming and base-ref targeting. Weak individually; cheap. */
export declare function branchSignals(ctx: EventContext): readonly Evidence[];

export declare function onlineSignals(
  kb: LoadedKb,
  ctx: EventContext,
  signal: AbortSignal,
): Promise<readonly Evidence[]>;

export declare function expectedSignalCount(stage: 0 | 1): number;
