// SPDX-License-Identifier: Apache-2.0

/**
 * Corpus collector — `collect/action.yml` → `dist/collect.js`.
 *
 * Runs in this repository only, triggered by `repository_dispatch` from an
 * evaluating repo. Serialised by a workflow `concurrency` group so concurrent
 * appends from many repos cannot race on the shared JSONL files.
 *
 * The payload arrived over the network from another repository, so this is the
 * last place un-redacted text can be stopped before it is committed to a public
 * repo. Validation is not optional and a failure drops the record rather than
 * writing a partially-trusted one.
 */

import type { CorpusRecord } from '../types/index.js';

export declare function main(): Promise<void>;

/**
 * Validate a dispatched record: schema shape, then `assertRedacted` over every
 * text field, then sanity bounds on the numeric features.
 *
 * Returns the reason on rejection rather than throwing — a malformed dispatch
 * is an expected event, not an error, and must not fail the collector run for
 * the other records in the batch.
 */
export declare function validate(raw: unknown): { ok: true; record: CorpusRecord } | { ok: false; reason: string };
