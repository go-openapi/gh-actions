// SPDX-License-Identifier: Apache-2.0

/**
 * Corpus reading and writing.
 *
 * The corpus is append-only JSONL, one labelled sample per line, living in
 * `go-openapi/gh-actions` and shared by every repo in the org. Plain text, so
 * every change is diffable and reviewable in a PR — unlike the binary SQLite
 * blob fossier commits.
 *
 * ## Write path
 *
 * The hot path never writes to the corpus directly. Two reasons: it runs in
 * another repository and would need write credentials there, and concurrent
 * appends from many repos would race on a shared file. Instead it fires a
 * single `repository_dispatch` and exits (`dispatchRecord`); a collector
 * workflow in this repo, serialised by a `concurrency` group, does the append
 * (`appendRecords`).
 *
 * Corpus writes are best-effort by design. A failed dispatch drops the sample
 * and never affects the decision already taken.
 */

import type { AccountRecord, CorpusRecord, EventKind } from '../types/index.js';

/**
 * Fire-and-forget a record to the collector.
 * Never throws: a learning failure must not surface as an evaluation failure.
 *
 * @param token needs `contents: write` on `corpusRepo`
 */
export declare function dispatchRecord(
  corpusRepo: string,
  token: string,
  record: CorpusRecord,
): Promise<{ delivered: boolean; error?: string }>;

/**
 * Append records to the on-disk corpus. Collector side only.
 * Re-validates redaction before writing — the last line of defence against a
 * raw-text leak, since the payload arrived over the network.
 */
export declare function appendRecords(dir: string, records: readonly CorpusRecord[]): Promise<void>;

/**
 * Stream the corpus for a given kind. Streaming rather than slurping: the
 * corpus grows without bound and the trainer runs on a hosted runner.
 */
export declare function readCorpus(dir: string, kind: EventKind): AsyncIterable<CorpusRecord>;

/**
 * Deduplicate by `id`, last write wins. Lets a maintainer verdict supersede the
 * weak auto-label for the same item by appending rather than rewriting history.
 */
export declare function dedupe(records: AsyncIterable<CorpusRecord>): Promise<CorpusRecord[]>;

export declare function readAccounts(dir: string): AsyncIterable<AccountRecord>;

/**
 * Compact: drop superseded duplicates and records past the retention window,
 * then rewrite. Run rarely, from the trainer, as its own reviewable PR.
 */
export declare function compact(dir: string, retentionDays: number): Promise<{ before: number; after: number }>;
