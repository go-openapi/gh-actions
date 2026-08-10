// SPDX-License-Identifier: Apache-2.0

/**
 * The trust cascade — kept from fossier, because it is right.
 *
 * `blocked → trusted → known → unknown`, short-circuiting. Only `unknown` is
 * ever scored, which is what keeps the common case (a maintainer opening an
 * issue) at zero API calls and near-zero latency.
 *
 * Ordering is load-bearing: blocked is resolved first so that a denounced
 * account cannot be elevated by also being a member of a trusted org.
 */

import type { EventContext, TrustResolution } from '../types/index.js';
import type { Config } from '../config/index.js';
import type { TrustFile } from '../storage/trust.js';

/**
 * Stage-0 resolution: `trust.yaml`, config lists, and the webhook payload's
 * `author_association`. No network.
 *
 * `author_association` alone settles most maintainer traffic —
 * `OWNER`/`MEMBER`/`COLLABORATOR` arrives in the payload and needs no
 * collaborators API call, which fossier spends on every evaluation.
 */
export declare function resolveOffline(
  cfg: Config,
  trust: TrustFile,
  ctx: EventContext,
): TrustResolution;

/**
 * Stage-1 resolution: CODEOWNERS, org membership, prior accepted contributions.
 * Only reached when `resolveOffline` returned `unknown`.
 */
export declare function resolveOnline(
  cfg: Config,
  ctx: EventContext,
  signal: AbortSignal,
): Promise<TrustResolution>;

/** True when the tier settles the event with no scoring required. */
export declare function isTerminal(t: TrustResolution): boolean;
