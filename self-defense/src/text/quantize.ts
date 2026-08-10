// SPDX-License-Identifier: Apache-2.0

/**
 * int8 quantisation for knowledge-base vectors.
 *
 * The KB ships inside the action tarball and GitHub downloads that tarball
 * before the first step of every run, so its size is on the critical path of
 * every evaluation in every repo. A 4096-dimension float64 centroid rendered as
 * JSON numbers is ~80 KB; the same vector int8-quantised and base64-encoded is
 * ~5.5 KB. With two classes across two event kinds plus the idf vector that is
 * the difference between ~400 KB and ~28 KB.
 *
 * The precision cost is negligible for our use: the vectors are L2-normalised,
 * so components sit in a narrow range, and the downstream consumer is a cosine
 * similarity whose result feeds a calibrated threshold. Symmetric per-vector
 * scaling keeps the maximum relative error under 0.4%.
 */

import type { QuantizedVector } from '../types/index.js';

/**
 * Quantise a dense float vector to int8 with a symmetric per-vector scale.
 *
 * An all-zero vector yields scale 1 and all-zero data rather than a division
 * by zero — that case is reachable when a class has no training samples yet.
 */
export function quantize(v: Float32Array | Float64Array): QuantizedVector {
  let max = 0;
  for (let i = 0; i < v.length; i++) {
    const a = Math.abs(v[i]);
    if (a > max) max = a;
  }
  const scale = max === 0 ? 1 : max / 127;
  const out = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) {
    // Round-half-away-from-zero, then clamp: Math.round(-0.5) is -0 in JS,
    // which would bias negative components toward zero.
    const q = Math.sign(v[i]) * Math.round(Math.abs(v[i]) / scale);
    out[i] = Math.max(-127, Math.min(127, q));
  }
  return { scale, data: Buffer.from(out.buffer, out.byteOffset, out.byteLength).toString('base64') };
}

/**
 * Recover a dense float vector. Called once per KB load on the hot path — the
 * whole KB dequantises in well under a millisecond.
 *
 * @param expectedDims when given, guards against a KB/vectoriser spec mismatch,
 *   which would otherwise score silently and wrongly.
 */
export function dequantize(q: QuantizedVector, expectedDims?: number): Float32Array {
  const buf = Buffer.from(q.data, 'base64');
  const src = new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  if (expectedDims !== undefined && src.length !== expectedDims) {
    throw new Error(`kb vector dimension mismatch: got ${src.length}, expected ${expectedDims}`);
  }
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] * q.scale;
  return out;
}
