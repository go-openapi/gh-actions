// SPDX-License-Identifier: Apache-2.0

/**
 * Hot path entry point — `action.yml` → `dist/evaluate.js`.
 *
 * The whole flow, in the order it runs. Anything that can be done without a
 * network call is done before anything that cannot.
 *
 *   1. parse the webhook payload from GITHUB_EVENT_PATH        (no network)
 *   2. load config from the BASE ref, trust.yaml, kb.json      (no network)
 *   3. redact title + body                                     (no network)
 *   4. trust cascade, offline                                  (no network)
 *      └─ terminal? → act, record, exit                        ~130 ms total
 *   5. stage 0: text KB + payload signals → accumulate         (no network)
 *      └─ P(spam) decisive either way? → act, record, exit
 *   6. stage 1: fan out network signals under one deadline
 *      └─ accumulate again over stages 0+1 → act, record, exit
 *   7. stage 2: abstain. Label for review. Never auto-close.
 *   8. always: dispatch the redacted corpus record, fire-and-forget
 *
 * Step 8 runs on every path including the early exits, and its failure is never
 * allowed to surface: learning is best-effort, triage is not.
 */

export declare function main(): Promise<void>;

/**
 * Parse the webhook into a normalised `EventContext`.
 *
 * Handles the payload shapes of `issues`, `pull_request` and
 * `pull_request_target`. Returns null — a clean no-op exit — when the event is
 * not one we triage, or when the author is missing. A null author happens for
 * ghost, suspended and deleted accounts; there is nothing to evaluate and the
 * item is not the author's fault, so we must never act on it. fossier gets this
 * right and it is worth carrying over deliberately rather than rediscovering.
 */
export declare function parseEvent(eventPath: string, eventName: string): Promise<import('../types/index.js').EventContext | null>;

/**
 * Which actions re-trigger evaluation.
 *
 * `opened` and `reopened` only. A `synchronize` re-evaluation would post
 * duplicate comments and could re-close a PR a maintainer is mid-triage on.
 * `edited` is tempting — a spammer editing spam in after approval is a real
 * attack — but handling it needs the "already acted" state machine first, so it
 * is deliberately out of scope until then.
 */
export declare function shouldEvaluate(kind: string, action: string): boolean;
