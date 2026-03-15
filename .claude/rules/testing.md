---
paths:
  - "**/*_test.go"
---

# Testing conventions (go-openapi)

## This repository

This repo is a collection of GitHub composite actions, not a Go project.
The single Go file (`release_tracker.go`) is a stub that imports tool dependencies
so Dependabot can track their versions — it has no tests and no testable logic.

To validate changes, test the composite actions by referencing them from a workflow
in another repo (e.g. via `uses: go-openapi/gh-actions@<branch>`).
