<!--
SPDX-License-Identifier: Apache-2.0
-->

# go-openapi self-defense — design

Automated triage of spam issues and pull requests across the go-openapi
organisation. This document is the architecture of record; the code under
`src/` is currently a typed skeleton that implements the *contracts* described
here (storage formats, vectoriser, quantisation) and stubs the rest.

## 1. Why not fossier

[fossier](https://github.com/PThorpe92/fossier) is the closest prior art and the
source of several ideas kept below. Its limits, and what we do instead:

| fossier | here |
|---|---|
| `setup-uv` + `setup-python` + `uv pip install` before the first API call | bundled JS, `using: node24`, `dist/index.js` — runtime starts in ~200ms |
| 17 signals, always, sequential HTTP (several on the 30/min Search pool) | staged evaluation; stage 0 uses **zero** network calls and settles most events |
| hand-tuned magic constants (`min(days/365,1)`, `score -= 0.15` for an em-dash) | per-signal **log-likelihood ratios fitted from the corpus**; hand values are priors, not verdicts |
| weighted mean of `0..1` "trust" values | log-odds evidence accumulation with explicit abstention and per-signal evidence caps |
| score 0–100 with 40/70 cut points | calibrated `P(spam)`; thresholds derived from an explicit false-positive cost |
| binary SQLite blob (`.fossier.db`) committed to the repo | append-only JSONL + a derived JSON artifact — diffable, reviewable, mergeable |
| single-repo database | one org-wide corpus, so a cross-posting spammer is known everywhere at once |
| PRs only | issues and PRs, with distinct rule sets and distinct trained models |
| static rules; no learning | scheduled trainer re-derives the knowledge base from the corpus and lands it via PR |

What is kept from fossier, because it is right:

- **The trust cascade short-circuits everything.** `blocked → trusted → known →
  unknown`; only `unknown` is ever scored.
- **Abstention must be first-class.** A signal that could not be evaluated is
  not the same as a signal that came back bad. fossier tracks this as
  `confidence` and forces manual review below a floor; we keep the idea and give
  it a cleaner algebra (§4).
- **A plaintext, human-editable trust file under review.** `VOUCHED.td` becomes
  `trust.yaml`, changed by PR.

## 2. Latency budget

Response time is the product requirement. The budget for a `deny` decision on an
obvious spam issue, from webhook to closed:

```
runner already warm, action tarball cached by GitHub
  node boot + dist/index.js parse                       ~120 ms
  read config / trust.yaml / kb.json from action_path    ~8 ms   (no network)
  redact + vectorise title+body                          ~3 ms
  KB score (2 cosines + sparse term weights)             ~1 ms
  stage-0 decision                                       ─────
                                                        ~132 ms
  close + comment + label (3 REST calls, pipelined)     ~400 ms
```

No `setup-*` steps, no package install, no model download, no database fetch.

The knowledge base ships **inside the action tarball**. When a repo says
`uses: go-openapi/gh-actions/self-defense@master`, GitHub unpacks this whole
repository to `$GITHUB_ACTION_PATH` before the first step runs — `data/kb/kb.json`
is already on local disk. There is no fetch on the hot path, ever. The corollary
is that KB freshness is tied to the ref a repo pins: `@master` tracks nightly
training, `@v1` is frozen until the tag moves. This is documented behaviour, not
an accident, and it is why `kb.json` must stay small (budget: **≤ 2 MB**).

### Staged evaluation

```
stage 0 — zero network. Payload + on-disk state only.
    trust cascade (trust.yaml, config lists, CODEOWNERS from action_path)
    text KB score on title+body
    payload-derived author facts (login, account type, association)
    cheap content rules (empty body, template bypass, link density, host blocklist)
  ├─ decisive?  → act. ~130 ms, 0 API calls.
  └─ otherwise  → stage 1

stage 1 — network. Signals in parallel, each with an individual timeout.
    account profile, org membership, cross-repo history, flood window,
    (PR only) files/commits/verification
  ├─ decisive?  → act.
  └─ otherwise  → stage 2

stage 2 — abstain. Label for human review. Never auto-close from here.
```

Stage 1 fans out with `Promise.allSettled` and a global deadline; a signal that
misses the deadline abstains rather than blocking. Under §4's algebra abstention
is arithmetically free, so a slow GitHub API degrades the *precision* of the
decision and never its latency.

## 3. Storage

Everything lives in this repository, is plain text, and changes by pull request.

```
self-defense/data/
  corpus/
    issues.jsonl      append-only, one labelled sample per line
    pulls.jsonl       idem
    accounts.jsonl    author-level verdicts, one per line
  kb/
    kb.json           derived artifact: idf, centroids, term weights, calibration
    kb.meta.json      provenance: trained-at, corpus digest, held-out metrics
  trust/
    trust.yaml        vouched / blocked, human-edited
```

### 3.1 Corpus records are redacted

A public repository accumulating verbatim spam bodies would republish the payload
and hand it indexing. Before anything is written, text passes through the
redactor (`src/text/redact.ts`), whose contract is:

| input | stored as | also recorded |
|---|---|---|
| `https://buy-now.example/aff?id=9` | `«url»` | `hosts: ["buy-now.example"]` |
| `spammer@example.com` | `«email»` | `emailDomains: ["example.com"]` |
| `@someuser` | `«user»` | — |
| ` ```go … ``` ` | `«code:go»` | `codeLangs: ["go"]` |
| `#1234`, `abc123def` (sha-ish) | `«ref»` | — |
| runs of ≥4 digits | `«num»` | — |

The redacted form retains everything the lexical model needs — structure, phrasing,
placeholder density, boilerplate — while the link juice, contact addresses and
reply-to targets are gone. `hosts[]` is kept deliberately: host reputation across
the org corpus is one of the strongest available signals, and a bare hostname in
a JSONL file is not a clickable backlink.

Raw text is **never** written to disk or to a log. A `sha256` of the original is
kept for exact-duplicate detection.

### 3.2 Corpus record

One JSON object per line, `self-defense/schemas/corpus-record.schema.json`:

```jsonc
{
  "v": 1,
  "id": "go-openapi/runtime#1234",        // dedup key; last write wins on replay
  "kind": "issue",                         // "issue" | "pull"
  "ts": "2026-08-10T21:14:03Z",
  "repo": "go-openapi/runtime",
  "author": { "login": "…", "id": 90210, "type": "User", "association": "FIRST_TIME_CONTRIBUTOR" },
  "text": {
    "sha256": "…",                         // of the ORIGINAL, for dedup only
    "redacted": "…",                       // see §3.1
    "hosts": ["buy-now.example"],
    "lang": "en"
  },
  "features": { "accountAgeDays": 3, "publicRepos": 0, /* … */ },
  "label": {
    "class": "spam",                       // "spam" | "ham"
    "source": "auto",                      // "auto" | "maintainer" | "backfill"
    "confidence": 0.4,                     // weak labels ≈0.4; maintainer verdicts 1.0
    "by": null,
    "at": "2026-08-10T21:14:05Z"
  },
  "decision": { "outcome": "deny", "pSpam": 0.981, "stage": 0, "kbVersion": 7 }
}
```

Every evaluation appends a record with `label.source = "auto"` and
`label.confidence ≈ 0.4` — a weak label equal to whatever the system itself
decided. The trainer weights samples by `label.confidence`, so weak labels
inform the model without letting it harden its own mistakes into truth. The
`source`/`confidence`/`by` fields are populated but unused by any high-confidence
writer today; they exist so that maintainer verdicts (`/guard spam`, close-as-spam
events) can be added later without a format migration.

> **Known limitation, stated plainly.** Training exclusively on labels the system
> generated is a self-reinforcing loop: it learns to reproduce its own decisions,
> including its errors, and its measured accuracy will look better than it is.
> The held-out metrics in `kb.meta.json` are therefore *not* an estimate of real
> accuracy until some ground truth enters the corpus. The mitigation currently in
> place is partial — confidence weighting, plus the trainer refusing to promote a
> KB whose decision boundary moved more than a configured amount in one run (§5).

### 3.3 Knowledge base artifact

`kb.json` is derived — never hand-edited, regenerated wholesale by the trainer.
Vectors are int8-quantised with a per-vector scale and base64-encoded, which is
what keeps a 4096-dimension model at ~30 KB rather than ~1 MB of JSON floats.

```jsonc
{
  "v": 1,
  "kbVersion": 7,
  "trainedAt": "2026-08-10T03:00:00Z",
  "vectorizer": { "dims": 4096, "word": [1, 2], "char": [3, 5], "sublinear": true },
  "idf": { "scale": 0.00042, "data": "<base64 int8[4096]>" },
  "models": {
    "issue": {
      "prior": 0.31,
      "centroids": {
        "spam": { "scale": 0.0011, "data": "<base64 int8[4096]>" },
        "ham":  { "scale": 0.0009, "data": "<base64 int8[4096]>" }
      },
      "termWeights": { "«url»": -0.81, "«url»·«url»": -1.24 },
      "calibration": { "kind": "platt", "a": -3.11, "b": 1.42 },
      "signalLLR": { "accountAgeDays": { "bins": [1, 7, 30, 365], "llr": [1.9, 1.1, 0.2, -0.8] } }
    },
    "pull": { /* … same shape, independently fitted … */ }
  }
}
```

`signalLLR` is the piece that removes the hand-tuned constants: each non-text
signal is discretised into bins and each bin carries a log-likelihood ratio
counted from the corpus (§4).

## 4. Scoring

fossier computes a weighted mean of per-signal "trust" values in `0..1`. That
formulation has three defects: it has no natural encoding for "no evidence"
(0.5 is a guess, not an abstention); its output is not a probability, so
thresholds are arbitrary; and a single mis-specified signal shifts the mean.

We accumulate evidence in log-odds instead — a naive-Bayes evidence model:

```
  logit(P(spam)) = logit(prior) + Σᵢ clamp(llrᵢ, ±CAP)
```

Consequences that matter:

- **Abstention is exactly `llr = 0`.** A signal that timed out, hit a rate limit
  or had no data contributes nothing and needs no weight redistribution. There
  is no rule to get wrong.
- **`llrᵢ` is fitted, not chosen.** For a binned signal it is
  `log( P(bin | spam) / P(bin | ham) )` counted over the corpus with Laplace
  smoothing. "Account younger than 7 days" carries whatever weight the data says
  it carries.
- **`CAP` bounds any single signal's influence** (default `±2.0`, ≈ 7.4:1). This
  is the structural answer to fossier's em-dash penalty: even a badly fitted
  signal cannot on its own carry an event across the closing threshold.
- **The output is a probability**, so thresholds mean something.

### Decision thresholds are a cost statement

Auto-closing a real first-time contributor's PR is far more damaging than
leaving a spam issue open for a maintainer to close by hand. That asymmetry is
configuration, not folklore:

```yaml
costs:
  falsePositive: 40   # closing a legitimate contributor
  falseNegative: 1    # letting spam through to a human
```

which yields `closeAbove = FP / (FP + FN) = 0.976`. Actions are gated as:

| condition | issues | pulls |
|---|---|---|
| `P(spam) ≥ closeAbove` **and** stage ≥ 0 decisive | close + comment + label | close + comment + label |
| `reviewAbove ≤ P(spam) < closeAbove` | label `self-defense:needs-review` | label + comment with breakdown |
| `P(spam) < reviewAbove` | nothing | nothing |

Additional hard gates, independent of score — an auto-close **never** fires when:

- the author is `MEMBER`, `OWNER`, `COLLABORATOR`, or listed in `trust.yaml`;
- the manual-override label is present (survives across runs);
- the KB is older than `maxKbAgeDays`, or `kb.meta.json` reports held-out
  precision below `minPrecision` — a stale or degraded model downgrades to
  review-only rather than acting on its own;
- evidence came only from stage 2.

## 5. Learning loop

```
  evaluate (hot path, per event)
      └─▶ redacted record ──▶ repository_dispatch ──▶ gh-actions
                                                        │
  collect (workflow in this repo, concurrency-serialised)
      └─▶ append to data/corpus/*.jsonl ──▶ commit to master
                                                        │
  train (scheduled, nightly)
      ├─ load corpus, dedup by id (last write wins), weight by label.confidence
      ├─ optional: ONNX MiniLM pass over redacted text — latency is irrelevant here
      ├─ distil into the hot-path format: idf, centroids, term weights, signal LLR bins
      ├─ fit Platt calibration on a held-out split
      ├─ evaluate: precision / recall / boundary drift vs the live KB
      ├─ refuse to promote if drift > maxBoundaryDrift or precision < minPrecision
      └─▶ PR: "chore(self-defense): retrain kb (kbVersion 7 → 8)"
                                                        │
  merge (human) ──▶ every repo on @master picks it up on its next event
```

The offline stage is where a real embedding model is allowed to run: it reads
redacted corpus text, produces dense embeddings, and **distils** them into the
compact artifact the hot path consumes — centroids in the hashed space, plus
term weights recovered from the embedding neighbourhood. The hot path never
loads a model and never makes a network call to score text.

### Cross-repo write path

The hot path must not block on writing to another repository, and concurrent
appends from many repos would race on a shared file. So the hot path fires a
single `POST /repos/go-openapi/gh-actions/dispatches` with the record as
`client_payload` and exits. A collector workflow in this repo, guarded by a
`concurrency` group, serialises the appends. If the dispatch fails the event is
dropped: corpus writes are best-effort by design and never affect the decision
already taken.

This requires a token with `contents: write` on `go-openapi/gh-actions`,
supplied as `corpus-token`. Without it the action still evaluates normally and
simply learns nothing.

## 6. Issues and pulls are different problems

Distinct signal sets, independently fitted models, distinct thresholds.

**Shared:** text KB score, author account facts, org-wide cross-post detection,
flood window, host reputation, trust cascade.

**Issues only:** issue-template compliance (a bypassed template is a strong
signal — spam tooling does not fill forms), title/body coherence, absence of any
repo-specific term (no package path, no symbol, no version), reply-bait phrasing.

**Pulls only:** diff shape (docs-only, whitespace-only, lockfile-only, generated
files), diff size vs description length, commit signature verification, commit
author-email domain vs profile, branch naming, base-branch targeting, and the
AI-co-author check — kept from fossier as an *optional, off-by-default* signal
because it is a policy choice rather than a spam indicator.

**Cross-post detection** deserves emphasis: the same redacted text hash, or a
cosine above threshold against a record from a *different* repo in the same
window, is the single most discriminative feature available to us and is
structurally impossible for a single-repo tool like fossier. It is cheap — it
reads the corpus already on disk in the action tarball.

## 7. Layout

```
self-defense/
  action.yml                evaluate — the hot path (node24)
  train/action.yml          scheduled trainer
  collect/action.yml        corpus append, runs in this repo only
  src/
    types/                  domain types; the contract everything else speaks
    config/                 per-repo config schema + loader
    storage/                corpus, kb, trust readers/writers
    text/                   redact, vectorise, quantise      ← implemented
    features/               signal extractors (account, content)
    rules/                  trust cascade, issue rules, pull rules
    scoring/                evidence accumulator, kb scorer, calibration
    github/                 REST client with deadline + abstain-on-failure
    outcomes/               close / comment / label execution
    entry/                  evaluate.ts, train.ts, collect.ts
  schemas/                  JSON Schema for every on-disk format
  data/                     corpus, kb, trust (see §3)
  dist/                     bundled output, committed
```

`dist/` is committed — that is what makes `using: node24` start instantly, and it
is the standard for JS actions. It is generated by `npm run build` (esbuild) and
CI verifies it is in sync with `src/`.

## 8. Implementation status

| area | state |
|---|---|
| storage formats, JSON Schemas | specified, schemas written |
| domain types | written |
| redaction, vectoriser, quantisation | **implemented**, 16 tests passing — they are the on-disk contract |
| evidence accumulator (§4 algebra) | **implemented** — accumulate, Platt, llr fitting, binning |
| bootstrap KB artifact | generated; 27.8 KB, abstains on everything |
| signal extractors | signatures only |
| trust cascade, issue/pull rules | signatures only |
| GitHub client, outcomes | signatures only |
| trainer | signatures only |
| action descriptors | written |

The implemented pieces are the ones that are expensive to change later: the
vectoriser and quantiser define bytes on disk, and the accumulator defines what
every signal must return. Everything still stubbed consumes those contracts and
can be written against them independently.

`npm run build` currently emits near-empty bundles — the entry points are
ambient declarations with no bodies yet. That is expected until the next pass.

Next pass: the stage-0 path end to end, which is enough to run in shadow mode
(evaluate and record, act on nothing) and start filling the corpus.

## 9. Open questions

Flagged rather than silently decided:

1. **The self-labelling loop is the weak point of the whole design.** Weak
   auto-labels plus a drift cap slow the wander; they do not give the model
   anything true to learn from. The cheapest ground truth is a maintainer
   closing an issue as spam — an `issues.closed` webhook with
   `state_reason: not_planned` is nearly free to capture. Worth reconsidering
   before the first training run rather than after.
2. **`data/` in the action tarball couples KB freshness to the pinned ref.**
   Repos on `@v1` get a frozen model. Either the org standardises on `@master`
   for this action, or the trainer moves the tag on every promotion.
3. **Corpus growth is unbounded.** At org scale this is tens of thousands of
   lines a year in a repo every CI run clones. `compact()` exists in the
   interface; the retention policy does not yet.
4. **Cross-post detection needs an index the trainer does not build yet.** The
   scorer assumes minhash bands in the KB; that artifact is specified in
   `scoring/kb.ts` but absent from the KB schema.
