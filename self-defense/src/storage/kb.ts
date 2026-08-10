// SPDX-License-Identifier: Apache-2.0

/**
 * Knowledge-base loading.
 *
 * The KB is read from `$GITHUB_ACTION_PATH/self-defense/data/kb/`, which GitHub
 * has already unpacked to local disk before the first step runs. There is no
 * fetch, no cache restore and no database on the hot path — see DESIGN.md §2.
 *
 * The corollary is that KB freshness is bound to the ref a repo pins:
 * `@master` tracks nightly training, `@v1` is frozen until the tag moves.
 */

import type { EventKind, KbMeta, KbModel, KnowledgeBase } from '../types/index.js';

/** A KB with its vectors dequantised once, ready for scoring. */
export interface LoadedKb {
  readonly kb: KnowledgeBase;
  readonly meta: KbMeta;
  readonly idf: Float32Array;
  /** Dequantised centroids, keyed by kind then class. */
  readonly centroids: Readonly<Record<EventKind, { spam: Float32Array; ham: Float32Array }>>;
  /** Age at load time, used by the staleness guard. */
  readonly ageDays: number;
}

/**
 * Load and dequantise the knowledge base.
 *
 * Throws on a dimension mismatch between `kb.vectorizer.dims` and the actual
 * vectors: a KB trained under one spec and scored under another is silently
 * wrong, which is worse than failing loudly.
 */
export declare function loadKb(actionPath: string): Promise<LoadedKb>;

/** Serialise and quantise a freshly trained KB. Trainer side only. */
export declare function writeKb(dir: string, kb: KnowledgeBase, meta: KbMeta): Promise<void>;

/**
 * Whether this KB is fit to act on, per the safety policy.
 * A stale or under-performing KB downgrades every outcome to review-only
 * rather than being trusted to close anything.
 */
export declare function isActionable(
  loaded: LoadedKb,
  kind: EventKind,
  maxAgeDays: number,
  minPrecision: number,
): { ok: true } | { ok: false; reason: string };

/** The empty KB used before the first training run: abstains on everything. */
export declare function emptyKb(): KnowledgeBase;

export declare function modelFor(kb: KnowledgeBase, kind: EventKind): KbModel;
