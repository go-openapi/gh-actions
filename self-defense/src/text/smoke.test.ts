// SPDX-License-Identifier: Apache-2.0

/**
 * Smoke tests for the three modules that define the on-disk contract.
 * These must hold byte-for-byte between the trainer and the action: a KB
 * trained under one tokenisation and scored under another is silently wrong.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { redact, assertRedacted, PLACEHOLDER } from './redact.js';
import { vectorize, normalize, tokenize, applyIdfAndNormalize, dot, DEFAULT_SPEC } from './vectorize.js';
import { quantize, dequantize } from './quantize.js';

test('redact strips urls but keeps the host', () => {
  const r = redact('Check out https://buy-now.example/aff?id=9 now!');
  assert.ok(!r.redacted.includes('buy-now.example/aff'));
  assert.ok(r.redacted.includes(PLACEHOLDER.url));
  assert.deepEqual(r.hosts, ['buy-now.example']);
  assert.equal(r.placeholders.url, 1);
});

test('redact strips emails and mentions, keeping the email domain', () => {
  const r = redact('ping @octocat or mail spammer@evil.example');
  assert.ok(r.redacted.includes(PLACEHOLDER.user));
  assert.ok(r.redacted.includes(PLACEHOLDER.email));
  assert.ok(!r.redacted.includes('octocat'));
  assert.deepEqual(r.emailDomains, ['evil.example']);
});

test('redact removes fenced code before url matching', () => {
  // A URL inside a code fence is documentation, not link spam. It must not
  // inflate the host list or the url placeholder count.
  const r = redact('```go\nconst u = "https://inside.example/x"\n```\n');
  assert.deepEqual(r.hosts, []);
  assert.deepEqual(r.codeLangs, ['go']);
  assert.equal(r.placeholders.url, undefined);
});

test('redact catches schemeless link spam', () => {
  const r = redact('visit cheap-pills.example/buy today');
  assert.deepEqual(r.hosts, ['cheap-pills.example']);
});

test('assertRedacted rejects un-redacted text', () => {
  assert.throws(() => assertRedacted('go to https://x.example'), /un-redacted/);
  assert.throws(() => assertRedacted('mail a@b.example'), /un-redacted/);
  assert.doesNotThrow(() => assertRedacted(redact('https://x.example').redacted));
});

test('normalize strips diacritics and folds case', () => {
  assert.equal(normalize('Héllo   WÖRLD'), 'hello world');
});

test('tokenize keeps placeholders as single tokens', () => {
  assert.deepEqual(tokenize(normalize('see «url» and «code:go» here')), [
    'see', '«url»', 'and', '«code:go»', 'here',
  ]);
});

test('vectorize is deterministic and stays inside dims', () => {
  const a = vectorize('the quick brown fox');
  const b = vectorize('the quick brown fox');
  assert.deepEqual([...a].sort(), [...b].sort());
  for (const idx of a.keys()) {
    assert.ok(idx >= 0 && idx < DEFAULT_SPEC.dims, `index ${idx} out of range`);
  }
  assert.ok(a.size > 10, 'expected a non-trivial number of features');
});

test('vectorize sublinear scaling damps keyword stuffing', () => {
  const once = vectorize('spam');
  const many = vectorize(Array(500).fill('spam').join(' '));
  const maxOnce = Math.max(...once.values());
  const maxMany = Math.max(...many.values());
  // 500x the repetition must not produce anywhere near 500x the weight.
  assert.ok(maxMany < maxOnce * 10, `stuffing amplified ${maxMany / maxOnce}x`);
});

test('applyIdfAndNormalize yields a unit vector', () => {
  const idf = new Float32Array(DEFAULT_SPEC.dims).fill(1.5);
  const v = applyIdfAndNormalize(vectorize('hello world'), idf);
  let sumSq = 0;
  for (const w of v.values()) sumSq += w * w;
  assert.ok(Math.abs(Math.sqrt(sumSq) - 1) < 1e-6, `norm was ${Math.sqrt(sumSq)}`);
});

test('cosine of a vector with itself is 1', () => {
  const idf = new Float32Array(DEFAULT_SPEC.dims).fill(1);
  const v = applyIdfAndNormalize(vectorize('identical text here'), idf);
  const dense = new Float32Array(DEFAULT_SPEC.dims);
  for (const [i, w] of v) dense[i] = w;
  assert.ok(Math.abs(dot(v, dense) - 1) < 1e-5);
});

test('quantize round-trips within int8 precision', () => {
  const src = new Float32Array(4096);
  for (let i = 0; i < src.length; i++) src[i] = Math.sin(i) * 0.03;
  const back = dequantize(quantize(src), 4096);
  let maxErr = 0;
  for (let i = 0; i < src.length; i++) maxErr = Math.max(maxErr, Math.abs(src[i] - back[i]));
  // Symmetric per-vector scaling: error bounded by half a quantisation step.
  assert.ok(maxErr <= 0.03 / 127 / 2 + 1e-7, `max error ${maxErr}`);
});

test('quantize preserves sign of negative components', () => {
  const src = new Float32Array([-1, -0.5, 0, 0.5, 1]);
  const back = dequantize(quantize(src));
  assert.ok(back[0] < 0 && back[1] < 0 && back[3] > 0 && back[4] > 0);
});

test('quantize handles an all-zero vector', () => {
  const back = dequantize(quantize(new Float32Array(16)));
  assert.deepEqual([...back], new Array(16).fill(0));
});

test('dequantize rejects a dimension mismatch', () => {
  assert.throws(() => dequantize(quantize(new Float32Array(16)), 4096), /dimension mismatch/);
});

test('the shipped bootstrap KB loads and abstains', async () => {
  const fs = await import('node:fs/promises');
  // SELFDEF_DATA_DIR lets the bundled build locate the artifacts; unbundled
  // runs resolve relative to this source file.
  const dir = process.env.SELFDEF_DATA_DIR;
  const loc = dir ? `${dir}/kb/kb.json` : new URL('../../data/kb/kb.json', import.meta.url);
  const kb = JSON.parse(await fs.readFile(loc, 'utf8'));
  const idf = dequantize(kb.idf, kb.vectorizer.dims);
  const spamC = dequantize(kb.models.issue.centroids.spam, kb.vectorizer.dims);
  const hamC = dequantize(kb.models.issue.centroids.ham, kb.vectorizer.dims);
  const v = applyIdfAndNormalize(vectorize('buy cheap «url» now'), idf);
  // Zero centroids => zero margin => the untrained KB decides nothing.
  assert.equal(dot(v, spamC) - dot(v, hamC), 0);
});
