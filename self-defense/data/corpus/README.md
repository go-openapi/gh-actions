<!--
SPDX-License-Identifier: Apache-2.0
-->

# Corpus

Append-only JSONL, one labelled sample per line, shared by every go-openapi
repository. The files start empty; they fill as the action evaluates events.

| file | contents |
|---|---|
| `issues.jsonl` | one record per evaluated issue |
| `pulls.jsonl` | one record per evaluated pull request |
| `accounts.jsonl` | author-level verdicts and where each author has been seen |

Validated against [`../../schemas/corpus-record.schema.json`](../../schemas/corpus-record.schema.json).

## Text here is redacted, always

No record contains raw issue or PR text. URLs collapse to `«url»` with the bare
host kept in `text.hosts`, emails to `«email»`, mentions to `«user»`, code
fences to `«code:lang»`. A public repository accumulating verbatim spam bodies
would republish the payload and hand it search-engine indexing — this repo would
become part of the attack it is defending against.

The schema enforces this: `text.redacted` carries a `not`/`pattern` constraint
rejecting anything that still looks like a URL or an email address, and the
collector re-validates every dispatched record before writing. See
[DESIGN.md §3.1](../../DESIGN.md).

## Do not hand-edit

Records arrive by `repository_dispatch` and are appended by the collector
workflow, which is serialised by a `concurrency` group so concurrent appends
from many repos cannot race. Correcting a label means **appending** a new record
with the same `id` — dedup is last-write-wins, so the correction supersedes the
original without rewriting history.

## Health warning on the labels

Every record written today carries `label.source: "auto"` and
`label.confidence: ~0.4` — the system's own verdict, not ground truth. Training
on those labels alone is a self-reinforcing loop: the model learns to reproduce
its own decisions, errors included, and the held-out metrics in `kb.meta.json`
will look better than reality. Confidence weighting and the trainer's
boundary-drift gate bound the damage; they do not fix it. The fix is ground
truth, which arrives when a writer starts producing `label.source: "maintainer"`.
