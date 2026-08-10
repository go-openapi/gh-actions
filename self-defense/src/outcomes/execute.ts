// SPDX-License-Identifier: Apache-2.0

/**
 * Outcome execution and the hard gates in front of it.
 *
 * The gates are separate from the score on purpose. A score is a probability
 * and probabilities are occasionally wrong; the gates are policy and must hold
 * regardless of what the model believes. See DESIGN.md §4.
 */

import type { Assessment, Decision, EventContext, Outcome } from '../types/index.js';
import type { Config } from '../config/index.js';
import type { GithubClient } from '../github/client.js';
import type { LoadedKb } from '../storage/kb.js';

/**
 * Reasons an auto-close is refused even when `P(spam)` clears the threshold.
 * Each is checked independently and all matches are recorded on the decision,
 * so the audit trail says every reason, not just the first.
 */
export type Suppression =
  /** Author is OWNER / MEMBER / COLLABORATOR, or listed in trust.yaml. */
  | 'trusted-author'
  /** The manual-override label is present; survives across runs. */
  | 'manual-override'
  /** KB older than `safety.maxKbAgeDays`. */
  | 'stale-kb'
  /** Held-out precision below `safety.minPrecision`. */
  | 'kb-underperforming'
  /** Too many signals abstained; evidence too thin to act on. */
  | 'low-coverage'
  /** Evidence came only from stage 2. */
  | 'inconclusive-stage'
  /** `safety.shadowMode` — evaluate and record, act on nothing. */
  | 'shadow-mode';

/**
 * Apply the gates. Returns the outcome actually permitted, which is never more
 * severe than the one proposed, together with every reason it was downgraded.
 */
export declare function gate(
  cfg: Config,
  kb: LoadedKb,
  ctx: EventContext,
  proposed: Outcome,
  assessment: Assessment | undefined,
): { outcome: Outcome; suppressedBy: Suppression[] };

/**
 * Execute the gated outcome: comment, label, close, lock, in that order.
 *
 * Comment first so that the explanation is already in place when the close
 * notification reaches the author's inbox — closing first reads as a silent
 * slam and is the single biggest driver of appeals.
 */
export declare function execute(client: GithubClient, cfg: Config, decision: Decision): Promise<void>;

/**
 * Render the explanation comment.
 *
 * Names the signals that fired, in plain language, and always carries the
 * appeal path. A contributor wrongly closed must be able to tell what happened
 * and what to do about it — an opaque "score: 34/100" is not that.
 */
export declare function renderComment(decision: Decision, contactUrl: string): string;
