// SPDX-License-Identifier: Apache-2.0

/**
 * Issue-specific rules.
 *
 * Issues are the higher-volume spam vector and fossier does not handle them at
 * all. They also carry less evidence than a PR: no diff, no commits, no
 * signatures. So the text model and the org-wide corpus do proportionally more
 * of the work here, and the account signals matter more.
 *
 * Every extractor returns `Evidence` with a fitted llr, or abstains. None of
 * them decides anything on its own.
 */

import type { Evidence, EventContext, RedactedText } from '../types/index.js';
import type { LoadedKb } from '../storage/kb.js';

/** Signals computable from the payload alone. Stage 0, zero network. */
export declare function offlineSignals(
  kb: LoadedKb,
  ctx: EventContext,
  text: RedactedText,
): readonly Evidence[];

/**
 * Did the author bypass the issue template?
 *
 * One of the strongest issue signals: spam tooling posts a body, it does not
 * fill a form. Detected by comparing against the repo's `ISSUE_TEMPLATE`
 * headings — and abstaining entirely when the repo has no template, rather
 * than penalising a repo that never asked for one.
 */
export declare function templateCompliance(ctx: EventContext, templates: readonly string[]): Evidence;

/**
 * Does the body reference anything specific to this repository — a package
 * path, an exported symbol, a released version? Generic text that could have
 * been posted to any repo is the signature of a cross-posting campaign.
 */
export declare function repoSpecificity(ctx: EventContext, text: RedactedText): Evidence;

/** Link density and placeholder ratio, relative to body length. */
export declare function linkDensity(text: RedactedText): Evidence;

/** Signals requiring API calls: account profile, flood window, prior interaction. */
export declare function onlineSignals(
  kb: LoadedKb,
  ctx: EventContext,
  signal: AbortSignal,
): Promise<readonly Evidence[]>;

/** Number of signals that could speak at a given stage — the coverage denominator. */
export declare function expectedSignalCount(stage: 0 | 1): number;
