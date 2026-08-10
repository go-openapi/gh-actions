// SPDX-License-Identifier: Apache-2.0

/**
 * Text scoring against the knowledge base — the stage-0 workhorse.
 *
 * Three contributions, all computed from vectors already on local disk, all
 * together well under a millisecond:
 *
 *  1. **Centroid margin.** Cosine to the spam centroid minus cosine to the ham
 *     centroid, converted to a llr. Captures overall register and phrasing.
 *  2. **Term weights.** A sparse set of interpretable tokens with fitted
 *     weights, so the breakdown we post in a comment can name what it saw
 *     rather than pointing at an opaque number.
 *  3. **Cross-post detection.** The same redacted text hash, or a near-duplicate
 *     by cosine, seen in a *different* repo in the org corpus. This is the most
 *     discriminative feature available to us and is structurally impossible for
 *     a single-repo tool. See DESIGN.md §6.
 */

import type { Evidence, EventKind, RedactedText, SparseVector } from '../types/index.js';
import type { LoadedKb } from '../storage/kb.js';

/**
 * Score redacted text against the KB.
 *
 * Returns one `Evidence` per contribution rather than a single fused number, so
 * each remains individually capped by the accumulator and individually visible
 * in the breakdown.
 */
export declare function scoreText(kb: LoadedKb, kind: EventKind, text: RedactedText): readonly Evidence[];

/** Cosine margin between the spam and ham centroids, in `[-1, 1]`. */
export declare function centroidMargin(kb: LoadedKb, kind: EventKind, v: SparseVector): number;

/**
 * Cross-post lookup against the org-wide corpus index.
 *
 * The index is a compact side-artifact built by the trainer — text hashes plus
 * minhash bands — so this stays a hash lookup rather than a scan over the
 * whole corpus.
 */
export declare function crossPostEvidence(
  kb: LoadedKb,
  text: RedactedText,
  currentRepo: string,
): Evidence;

/**
 * Host reputation from the org corpus: how often each host in `text.hosts` has
 * appeared in spam versus ham. The reason the redactor keeps bare hostnames.
 */
export declare function hostReputation(kb: LoadedKb, hosts: readonly string[]): Evidence;
