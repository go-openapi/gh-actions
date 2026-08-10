// SPDX-License-Identifier: Apache-2.0

/**
 * Hashing vectoriser — the hot path's entire text pipeline.
 *
 * The feature space is fixed at `dims` and built by hashing n-grams into it
 * (the "hashing trick"). No vocabulary file, so nothing to load, nothing to
 * keep in sync between the trainer and the action, and no unbounded growth as
 * the corpus grows. A typical issue touches a few hundred of the 4096
 * dimensions, so vectors stay sparse and cosine similarity is a short loop.
 *
 * Both word and character n-grams are used. Character n-grams are what catch
 * the obfuscation that word tokens miss — spaced-out letters, homoglyphs,
 * inserted punctuation — and they degrade gracefully on non-English text.
 *
 * This must produce byte-identical output in the trainer and in the action:
 * a KB trained under one tokenisation and scored under another is silently
 * wrong. The spec lives in the KB (`VectorizerSpec`) and travels with it.
 */

import type { SparseVector, VectorizerSpec } from '../types/index.js';

export const DEFAULT_SPEC: VectorizerSpec = {
  dims: 4096,
  word: [1, 2],
  char: [3, 5],
  sublinear: true,
};

/**
 * FNV-1a, 32-bit. Chosen over a cryptographic hash because it is ~20x faster
 * and collision *quality* is irrelevant here — the hashing trick tolerates
 * collisions by design, they act as feature aliasing and the trainer sees the
 * same aliasing the scorer does.
 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // h *= 16777619, kept in 32-bit via shifts to avoid float precision loss.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Normalise before tokenising: lowercase, strip diacritics, collapse
 * whitespace. Placeholder tokens from the redactor (`«url»`) survive intact
 * because `«»` are kept as word characters by the tokeniser below.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word tokens. `«url»`-style placeholders are single tokens. */
export function tokenize(normalized: string): string[] {
  return normalized.match(/«[a-z:]+»|[a-z0-9_]+/g) ?? [];
}

/**
 * Vectorise redacted text into the hashed space.
 *
 * Word n-grams are prefixed `w:` and character n-grams `c:` so the two families
 * cannot collide with each other in a way that depends on n.
 *
 * @param text  redacted text — never raw user input
 * @param spec  must be the spec the KB was trained with
 */
export function vectorize(text: string, spec: VectorizerSpec = DEFAULT_SPEC): SparseVector {
  const norm = normalize(text);
  const tokens = tokenize(norm);
  const counts = new Map<number, number>();

  const add = (feature: string) => {
    const idx = fnv1a(feature) % spec.dims;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  };

  const [wMin, wMax] = spec.word;
  for (let n = wMin; n <= wMax; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      add(`w:${tokens.slice(i, i + n).join(' ')}`);
    }
  }

  // Character n-grams run over the normalised string with spaces retained, so
  // they straddle word boundaries and pick up phrasing, not just morphology.
  const [cMin, cMax] = spec.char;
  for (let n = cMin; n <= cMax; n++) {
    for (let i = 0; i + n <= norm.length; i++) {
      add(`c:${norm.slice(i, i + n)}`);
    }
  }

  if (!spec.sublinear) return counts;

  // Sublinear scaling: one term repeated 500 times should not outweigh 50
  // distinct terms. Keyword stuffing is exactly that failure mode.
  const scaled = new Map<number, number>();
  for (const [idx, tf] of counts) scaled.set(idx, 1 + Math.log(tf));
  return scaled;
}

/**
 * Apply idf weights and L2-normalise in place, yielding a unit vector so that
 * cosine similarity against a centroid is a plain dot product.
 *
 * @param idf dense array of length `spec.dims`, dequantised from the KB
 */
export function applyIdfAndNormalize(v: SparseVector, idf: Float32Array): SparseVector {
  const weighted = new Map<number, number>();
  let sumSq = 0;
  for (const [idx, tf] of v) {
    const w = tf * (idf[idx] ?? 1);
    weighted.set(idx, w);
    sumSq += w * w;
  }
  if (sumSq === 0) return weighted;
  const inv = 1 / Math.sqrt(sumSq);
  for (const [idx, w] of weighted) weighted.set(idx, w * inv);
  return weighted;
}

/**
 * Dot product of a sparse vector against a dense one. With both sides
 * L2-normalised this is the cosine similarity.
 */
export function dot(sparse: SparseVector, dense: Float32Array): number {
  let acc = 0;
  for (const [idx, w] of sparse) acc += w * (dense[idx] ?? 0);
  return acc;
}
