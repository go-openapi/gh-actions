# Copilot Instructions

This repository contains reusable GitHub composite actions for go-openapi CI/CD workflows.

## What This Repo Provides

Composite actions that install vetted Go testing/release tools from binary releases:

- **Root action** (`action.yml`) -- installs all tools (gotestsum, go-junit-report, go-ctrf-json-reporter, svu)
- **Tool installers** (`install/`) -- individual tool install actions
- **CI utilities** (`ci-jobs/`) -- bot-credentials, detect-go-monorepo, detect-go-version, next-tag, wait-pending-jobs

## Version Tracking

`release_tracker.go` is a dummy Go file that imports tool packages so Dependabot can track versions in `go.mod`. The `get-tool-version.sh` script resolves versions from `go.mod` without requiring Go.

## Conventions

Coding conventions are found beneath `.github/copilot`

### Summary

- Commits require DCO sign-off (`git commit -s`).
- Actions use composite action format with `action.yml` descriptors.

See `.github/copilot/` (symlinked to `.claude/rules/`) for detailed rules.
