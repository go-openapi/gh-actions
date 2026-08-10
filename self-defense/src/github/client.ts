// SPDX-License-Identifier: Apache-2.0

/**
 * GitHub REST client.
 *
 * Two properties the hot path depends on:
 *
 * **Every call is deadline-bound and abstains on failure.** A signal that times
 * out, rate-limits or errors returns `null`, the caller emits an abstaining
 * `Evidence`, and the decision proceeds with thinner evidence. Latency is
 * therefore bounded by the deadline regardless of how GitHub is behaving —
 * degraded API precision costs accuracy, never response time.
 *
 * **The Search API is treated as a scarce resource.** It shares a 30 req/min
 * pool across the whole installation; fossier spends four search calls per
 * evaluation, which is why it collapses under any real spam wave — exactly when
 * it is needed. Search calls here are stage-1 only, budgeted per run, and the
 * budget being exhausted is an abstention like any other.
 */

import type { ChangedFile, CommitInfo } from '../rules/pulls.js';

export interface ClientOptions {
  readonly token: string;
  readonly baseUrl: string;
  /** Wall-clock budget for the whole stage-1 fan-out. */
  readonly deadlineMs: number;
  /** Max Search API calls per run. Exceeding it abstains rather than queueing. */
  readonly searchBudget: number;
}

/**
 * All methods resolve to `null` on any failure — timeout, rate limit, 404,
 * transport error. Callers must not distinguish; they abstain either way.
 */
export interface GithubClient {
  getUser(login: string): Promise<UserProfile | null>;
  getUserOrgs(login: string): Promise<string[] | null>;
  getPullFiles(owner: string, repo: string, n: number): Promise<ChangedFile[] | null>;
  getPullCommits(owner: string, repo: string, n: number): Promise<CommitInfo[] | null>;
  getIssueTemplates(owner: string, repo: string): Promise<string[] | null>;
  /** Consumes search budget. */
  countRecentByAuthor(org: string, login: string, sinceIso: string): Promise<number | null>;

  // Mutations. These are the only calls allowed to throw: a failed close is a
  // real failure the operator needs to see.
  close(owner: string, repo: string, n: number, reason: 'not_planned'): Promise<void>;
  comment(owner: string, repo: string, n: number, body: string): Promise<void>;
  addLabels(owner: string, repo: string, n: number, labels: readonly string[]): Promise<void>;
  lock(owner: string, repo: string, n: number, reason: 'spam'): Promise<void>;
  /** Fire-and-forget corpus dispatch. Never throws. */
  dispatch(repo: string, eventType: string, payload: unknown): Promise<boolean>;
}

export interface UserProfile {
  readonly login: string;
  readonly id: number;
  readonly type: string;
  readonly createdAt: string;
  readonly publicRepos: number;
  readonly publicGists: number;
  readonly followers: number;
  readonly following: number;
  readonly bio: string | null;
  readonly email: string | null;
}

export declare function createClient(opts: ClientOptions): GithubClient;
