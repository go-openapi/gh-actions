// SPDX-License-Identifier: Apache-2.0

/**
 * The evidence accumulator.
 *
 * fossier computes a weighted mean of per-signal "trust" values in `0..1`. That
 * has three defects. It has no natural encoding for "no evidence" — 0.5 is a
 * guess, not an abstention, and fossier needs a separate weight-redistribution
 * pass to compensate. Its output is not a probability, so the 40/70 cut points
 * are arbitrary. And a single mis-specified signal shifts the mean, which is
 * how an em-dash in a PR description ends up costing a real contributor 0.15.
 *
 * We accumulate log-odds instead — a naive-Bayes evidence model:
 *
 *     logit(P(spam)) = logit(prior) + Σᵢ clamp(llrᵢ, ±CAP)
 *
 * Abstention is exactly `llr = 0`, so it needs no special case. Each `llr` is
 * fitted from corpus counts rather than chosen by hand. And `CAP` bounds any
 * one signal's influence, so a badly fitted signal cannot on its own carry an
 * event across the closing threshold.
 *
 * The naive-Bayes independence assumption is of course false here — account age
 * and public-repo count are strongly correlated, and summing their llr
 * double-counts one underlying fact. That miscalibration is absorbed by the
 * Platt stage fitted on held-out data, which is the standard remedy and the
 * reason calibration is not optional.
 */

import type { Assessment, Evidence, EventKind } from '../types/index.js';
import type { CalibrationPlatt } from '../types/index.js';

/**
 * Maximum absolute log-likelihood ratio any single signal may contribute.
 * ±2.0 ≈ 7.4:1 odds. Three independent capped signals still comfortably clear
 * the closing threshold; one rogue signal never does.
 */
export const EVIDENCE_CAP = 2.0;

export function logit(p: number): number {
  const c = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return Math.log(c / (1 - c));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** An abstaining Evidence. Sugar, but it keeps call sites honest about *why*. */
export function abstain(signal: string, why: NonNullable<Evidence['abstained']>): Evidence {
  return { signal, llr: 0, observed: null, abstained: why, provenance: 'fitted' };
}

/**
 * Combine evidence into a calibrated assessment.
 *
 * @param prior         base rate of spam for this kind, from the trained model
 * @param evidence      per-signal contributions; abstentions cost nothing
 * @param calibration   Platt parameters fitted on a held-out split
 * @param expectedSignals denominator for `coverage` — the number of signals
 *   that *could* have spoken at this stage, not the number that did
 */
export function accumulate(
  kind: EventKind,
  stage: Assessment['stage'],
  prior: number,
  evidence: readonly Evidence[],
  calibration: CalibrationPlatt,
  expectedSignals: number,
  kbVersion: number,
): Assessment {
  let logOdds = logit(prior);
  let speaking = 0;

  for (const e of evidence) {
    if (e.llr === 0) continue;
    logOdds += Math.max(-EVIDENCE_CAP, Math.min(EVIDENCE_CAP, e.llr));
    speaking++;
  }

  // Platt: map the raw log-odds through a fitted logistic. This is what turns
  // an uncalibrated naive-Bayes sum into something whose 0.976 means 0.976.
  const pSpam = sigmoid(calibration.a + calibration.b * logOdds);

  return {
    kind,
    stage,
    pSpam,
    logOdds,
    evidence,
    coverage: expectedSignals === 0 ? 0 : speaking / expectedSignals,
    kbVersion,
  };
}

/**
 * Fit a llr from corpus counts with Laplace smoothing.
 *
 * `log( P(bin|spam) / P(bin|ham) )`. Smoothing matters more than usual here:
 * early corpora are small, and an unsmoothed zero count yields ±Infinity, which
 * would let one unseen observation decide the outcome.
 */
export function fitLLR(spamCount: number, spamTotal: number, hamCount: number, hamTotal: number, alpha = 1): number {
  const pSpam = (spamCount + alpha) / (spamTotal + 2 * alpha);
  const pHam = (hamCount + alpha) / (hamTotal + 2 * alpha);
  return Math.log(pSpam / pHam);
}

/** Locate the bin index for `value` given upper edges. Returns `bins.length` for the tail. */
export function binIndex(bins: readonly number[], value: number): number {
  for (let i = 0; i < bins.length; i++) if (value <= bins[i]) return i;
  return bins.length;
}
