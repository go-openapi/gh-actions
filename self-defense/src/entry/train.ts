// SPDX-License-Identifier: Apache-2.0

/**
 * Scheduled trainer — `train/action.yml` → `dist/train.js`.
 *
 * Runs nightly in this repository only. Latency is irrelevant here, which is
 * the entire reason the hot path can stay model-free: everything expensive
 * happens once, offline, and is distilled into the compact artifact the action
 * reads from local disk.
 *
 *   1. stream + dedupe the corpus, weight samples by `label.confidence`
 *   2. optional dense pass: ONNX MiniLM over redacted text
 *   3. distil into hot-path form: idf, centroids, term weights, signal llr bins
 *   4. fit Platt calibration on a held-out split
 *   5. evaluate: precision, recall, AUC, boundary drift vs the live KB
 *   6. promotion gate — refuse if drift or precision regress
 *   7. open a PR: "chore(self-defense): retrain kb (kbVersion N → N+1)"
 *
 * The KB lands by pull request, not by direct push. A model that decides
 * whether to close other people's contributions should be reviewable before it
 * takes effect, and the diff of a JSON artifact with named term weights is
 * genuinely readable.
 */

import type { EventKind, KnowledgeBase, KbMeta } from '../types/index.js';

export declare function main(): Promise<void>;

export interface TrainOptions {
  readonly corpusDir: string;
  readonly kbDir: string;
  /** Fraction held out for calibration and metrics. */
  readonly holdout: number;
  /** Deterministic split seed, so a retrain on identical data is reproducible. */
  readonly seed: number;
  /** Skip the dense pass; centroids come from tf-idf means alone. */
  readonly lexicalOnly: boolean;
}

export declare function train(opts: TrainOptions): Promise<{ kb: KnowledgeBase; meta: KbMeta }>;

/**
 * The promotion gate.
 *
 * Refuses a new KB whose held-out precision falls below the floor, or whose
 * decision boundary moves more than `maxBoundaryDrift` in one run. The drift
 * check is the guard against the self-labelling feedback loop described in
 * DESIGN.md §3.2: a model training on its own verdicts can wander, slowly and
 * confidently, and a per-run cap on how far it may move bounds the damage
 * between human reviews.
 *
 * It is a mitigation, not a fix. The fix is ground truth in the corpus.
 */
export declare function shouldPromote(
  candidate: KbMeta,
  live: KbMeta | null,
  minPrecision: number,
  maxBoundaryDrift: number,
): { promote: true } | { promote: false; reason: string };

/**
 * Fit llr bins for one non-text signal from corpus counts.
 * Bin edges are chosen by quantile over the observed distribution rather than
 * hardcoded, so the bins stay informative as the corpus shifts.
 */
export declare function fitSignalBins(
  samples: readonly { value: number; spam: boolean; weight: number }[],
  binCount: number,
): import('../types/index.js').SignalBins;

/** Fit Platt scaling `sigmoid(a + b·x)` by weighted maximum likelihood. */
export declare function fitPlatt(
  samples: readonly { logOdds: number; spam: boolean; weight: number }[],
): import('../types/index.js').CalibrationPlatt;

export declare function trainKind(kind: EventKind, opts: TrainOptions): Promise<import('../types/index.js').KbModel>;
