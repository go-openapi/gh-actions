// SPDX-License-Identifier: Apache-2.0

/**
 * Domain types for go-openapi self-defense.
 *
 * These are the contract between the hot path (`entry/evaluate.ts`), the
 * offline trainer (`entry/train.ts`) and everything on disk under `data/`.
 * Changing a type that appears in a `data/` artifact requires bumping the
 * corresponding schema version and the JSON Schema in `../schemas`.
 */

/** The two event kinds we triage. They have separate rules and separate models. */
export type EventKind = 'issue' | 'pull';

/** Classification label used by the corpus and the trainer. */
export type LabelClass = 'spam' | 'ham';

/** Where a corpus label came from. Drives the sample weight during training. */
export type LabelSource =
  /** The system's own decision. Weak — see DESIGN.md §3.2 on the feedback loop. */
  | 'auto'
  /** A maintainer verdict. Ground truth. No writer produces this yet. */
  | 'maintainer'
  /** Mined from repository history by a one-shot backfill. */
  | 'backfill';

/** Terminal decision for an event. */
export type Outcome = 'allow' | 'review' | 'deny';

/**
 * Trust tier, resolved by the cascade before any scoring happens.
 * Only `unknown` is ever scored — see DESIGN.md §2.
 */
export type TrustTier = 'blocked' | 'trusted' | 'known' | 'unknown';

/**
 * Which evaluation stage produced the decision.
 *
 * - 0: payload + on-disk state only, zero network calls
 * - 1: network signals fanned out under a deadline
 * - 2: inconclusive; abstained. Never auto-closes.
 */
export type Stage = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * One signal's contribution to the decision, expressed as a log-likelihood
 * ratio: `log( P(observation | spam) / P(observation | ham) )`.
 *
 * Positive means the observation favours spam. **Zero means abstention** — the
 * signal had no data, timed out, or was not applicable. That is the whole
 * reason for choosing log-odds over fossier's weighted mean: abstention needs
 * no special case and no weight redistribution.
 *
 * `llr` is clamped to ±`CAP` by the accumulator so that no single signal can
 * carry an event across the closing threshold on its own.
 */
export interface Evidence {
  /** Signal identifier, e.g. `account.ageDays`. Stable — it keys the fitted bins. */
  readonly signal: string;
  /** Log-likelihood ratio favouring spam. 0 = abstain. */
  readonly llr: number;
  /** Raw observation, for the human-readable breakdown. Never raw user text. */
  readonly observed: string | number | boolean | null;
  /** Why this signal abstained, when `llr === 0` and abstention was not the finding. */
  readonly abstained?: 'timeout' | 'rate-limited' | 'no-data' | 'not-applicable' | 'error';
  /** Where the llr came from: fitted from corpus, or a hand-set prior. */
  readonly provenance: 'fitted' | 'prior' | 'rule';
}

/** Accumulated evidence plus its calibrated interpretation. */
export interface Assessment {
  readonly kind: EventKind;
  readonly stage: Stage;
  /** Calibrated probability that this event is spam. */
  readonly pSpam: number;
  /** Prior-plus-sum of clamped llr, before calibration. Kept for debugging. */
  readonly logOdds: number;
  readonly evidence: readonly Evidence[];
  /** Fraction of expected signals that did *not* abstain. Low = thin evidence. */
  readonly coverage: number;
  /** Version of the knowledge base that produced this. */
  readonly kbVersion: number;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export interface TrustResolution {
  readonly tier: TrustTier;
  /** Human-readable justification, surfaced in comments and logs. */
  readonly reason: string;
  /** Which source settled it: `trust.yaml`, `config`, `codeowners`, `association`, … */
  readonly source: string;
}

export interface Decision {
  readonly kind: EventKind;
  readonly repo: RepoRef;
  readonly number: number;
  readonly author: Author;
  readonly trust: TrustResolution;
  readonly outcome: Outcome;
  readonly reason: string;
  /** Absent when the trust cascade settled the event without scoring. */
  readonly assessment?: Assessment;
  /**
   * Hard gates that suppressed a would-be `deny`. Non-empty means the score
   * said close but policy said do not — see DESIGN.md §4.
   */
  readonly suppressedBy: readonly string[];
}

// ---------------------------------------------------------------------------
// Event input
// ---------------------------------------------------------------------------

export interface RepoRef {
  readonly owner: string;
  readonly name: string;
}

export interface Author {
  readonly login: string;
  readonly id: number;
  readonly type: 'User' | 'Bot' | 'Organization';
  /**
   * `author_association` straight from the webhook payload. Available at
   * stage 0 with no API call, and `MEMBER`/`OWNER`/`COLLABORATOR` is an
   * immediate hard gate against auto-closing.
   */
  readonly association: AuthorAssociation;
}

export type AuthorAssociation =
  | 'OWNER'
  | 'MEMBER'
  | 'COLLABORATOR'
  | 'CONTRIBUTOR'
  | 'FIRST_TIME_CONTRIBUTOR'
  | 'FIRST_TIMER'
  | 'MANNEQUIN'
  | 'NONE';

/** Everything the hot path can see without making a network call. */
export interface EventContext {
  readonly kind: EventKind;
  readonly repo: RepoRef;
  readonly number: number;
  readonly action: string;
  readonly author: Author;
  /** Raw title. Redacted before it reaches storage or logs. */
  readonly title: string;
  /** Raw body. Redacted before it reaches storage or logs. */
  readonly body: string;
  readonly labels: readonly string[];
  readonly createdAt: string;
  /** Pull-request-only payload facts, absent for issues. */
  readonly pull?: PullContext;
}

export interface PullContext {
  readonly headRef: string;
  readonly baseRef: string;
  readonly changedFiles: number;
  readonly additions: number;
  readonly deletions: number;
  readonly commits: number;
  readonly draft: boolean;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Output of the redactor. This — never the original — is what may be written
 * to disk, to a log, or to a corpus record. See DESIGN.md §3.1.
 */
export interface RedactedText {
  /** Text with URLs, emails, mentions, code blocks and digit runs replaced. */
  readonly redacted: string;
  /** sha256 of the *original*, for exact-duplicate detection only. */
  readonly sha256: string;
  /** Bare hostnames lifted out of URLs. Not clickable; feeds host reputation. */
  readonly hosts: readonly string[];
  /** Domain parts of redacted email addresses. */
  readonly emailDomains: readonly string[];
  /** Languages of fenced code blocks, empty string when unfenced. */
  readonly codeLangs: readonly string[];
  /** Counts of each placeholder kind, a feature in its own right. */
  readonly placeholders: Readonly<Record<string, number>>;
}

/**
 * A sparse term-frequency vector in the hashed space. Index -> weight.
 * Dense arrays are avoided on the hot path: a typical issue touches a few
 * hundred of the 4096 dimensions.
 */
export type SparseVector = ReadonlyMap<number, number>;

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

/** An int8-quantised dense vector with its dequantisation scale. */
export interface QuantizedVector {
  /** Multiply each int8 component by this to recover the float value. */
  readonly scale: number;
  /** base64 of the underlying Int8Array. */
  readonly data: string;
}

export interface VectorizerSpec {
  readonly dims: number;
  /** Inclusive word n-gram range, e.g. `[1, 2]`. */
  readonly word: readonly [number, number];
  /** Inclusive character n-gram range, e.g. `[3, 5]`. */
  readonly char: readonly [number, number];
  /** Apply `1 + log(tf)` instead of raw term frequency. */
  readonly sublinear: boolean;
}

/**
 * A non-text signal discretised into bins, each carrying a fitted llr.
 * `bins` are upper edges; `llr` has one more entry than `bins` (the tail).
 */
export interface SignalBins {
  readonly bins: readonly number[];
  readonly llr: readonly number[];
}

export interface CalibrationPlatt {
  readonly kind: 'platt';
  readonly a: number;
  readonly b: number;
}

/** One trained model. There is one per `EventKind`, fitted independently. */
export interface KbModel {
  /** Base rate of spam in the training corpus for this kind. */
  readonly prior: number;
  readonly centroids: Readonly<Record<LabelClass, QuantizedVector>>;
  /** Sparse, interpretable term weights keyed by the redacted token. */
  readonly termWeights: Readonly<Record<string, number>>;
  readonly calibration: CalibrationPlatt;
  /** Fitted llr bins per non-text signal, keyed by `Evidence.signal`. */
  readonly signalLLR: Readonly<Record<string, SignalBins>>;
}

export interface KnowledgeBase {
  readonly v: 1;
  readonly kbVersion: number;
  readonly trainedAt: string;
  readonly vectorizer: VectorizerSpec;
  /** Inverse document frequency over the whole corpus, shared by both models. */
  readonly idf: QuantizedVector;
  readonly models: Readonly<Record<EventKind, KbModel>>;
}

/** Provenance and quality of a `KnowledgeBase`, kept in a sibling file. */
export interface KbMeta {
  readonly kbVersion: number;
  readonly trainedAt: string;
  /** sha256 over the corpus inputs, so a retrain on identical data is a no-op. */
  readonly corpusDigest: string;
  readonly samples: Readonly<Record<EventKind, { spam: number; ham: number }>>;
  /**
   * Held-out metrics. Not an estimate of real-world accuracy while the corpus
   * is self-labelled — see DESIGN.md §3.2.
   */
  readonly metrics: Readonly<Record<EventKind, HeldOutMetrics>>;
}

export interface HeldOutMetrics {
  readonly precision: number;
  readonly recall: number;
  readonly auc: number;
  /** Share of held-out samples whose decision flips vs the previous KB. */
  readonly boundaryDrift: number;
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

export interface CorpusLabel {
  readonly class: LabelClass;
  readonly source: LabelSource;
  /** Sample weight during training. Weak auto-labels ≈0.4; maintainer 1.0. */
  readonly confidence: number;
  /** Login of the maintainer who set the label, when `source === 'maintainer'`. */
  readonly by: string | null;
  readonly at: string;
}

/** One line of `data/corpus/{issues,pulls}.jsonl`. */
export interface CorpusRecord {
  readonly v: 1;
  /** `owner/name#number`. Dedup key; on replay the last write wins. */
  readonly id: string;
  readonly kind: EventKind;
  readonly ts: string;
  readonly repo: string;
  readonly author: {
    readonly login: string;
    readonly id: number;
    readonly type: string;
    readonly association: AuthorAssociation;
  };
  /** Redacted only. See DESIGN.md §3.1. */
  readonly text: {
    readonly sha256: string;
    readonly redacted: string;
    readonly hosts: readonly string[];
    readonly lang: string;
  };
  /** Flat numeric/boolean features as observed at decision time. */
  readonly features: Readonly<Record<string, number | boolean | null>>;
  readonly label: CorpusLabel;
  readonly decision: {
    readonly outcome: Outcome;
    readonly pSpam: number | null;
    readonly stage: Stage;
    readonly kbVersion: number;
  };
}

/** One line of `data/corpus/accounts.jsonl`: an author-level verdict. */
export interface AccountRecord {
  readonly v: 1;
  readonly login: string;
  readonly id: number;
  readonly ts: string;
  readonly label: CorpusLabel;
  /** Repos in the org where this author has been seen. Feeds cross-post detection. */
  readonly seenIn: readonly string[];
}
