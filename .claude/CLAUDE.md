# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains reusable GitHub composite actions for go-openapi CI/CD workflows. The actions install vetted versions of Go testing and release tools from binary releases (not `go install`), enabling pinned CI dependencies with vulnerability scanning.

## Directory Structure

```
action.yml                 Root composite action (installs all tools at once)
get-tool-version.sh        Resolves tool versions from go.mod without Go installed
release_tracker.go         Dummy Go package importing all tracked tools (for Dependabot)
go.mod / go.sum            Track tool dependency versions

install/                   Individual tool installer actions
  gotestsum/action.yml
  go-junit-report/action.yml
  go-ctrf-json-reporter/action.yml
  svu/action.yml

ci-jobs/                   CI utility actions
  bot-credentials/         Configure GPG signing and GitHub App authentication
  detect-go-monorepo/      Detect multi-module repos, output module lists (JSON/bash)
  detect-go-version/       Detect Go version and feature support (e.g. go test work)
  next-tag/                Determine next semver tag using svu
  wait-pending-jobs/       Wait for all PR workflow runs to complete before merge
```

## Composite Actions

### Root action (`action.yml`)

Installs all tools at once with optional version overrides. Each tool can be individually enabled/disabled. Versions default to `auto` (resolved from `go.mod`).

### Tool installers (`install/`)

Each installs a single tool from its binary release:
- **gotestsum** -- test runner with JUnit/JSON output
- **go-junit-report** -- converts `go test` output to JUnit XML
- **go-ctrf-json-reporter** -- converts JUnit XML to CTRF JSON
- **svu** -- semantic version utility for tag bumping

### CI job actions (`ci-jobs/`)

- **bot-credentials** -- configures GPG signing (commit/tag) and GitHub App tokens for automated operations
- **detect-go-monorepo** -- scans for `go.mod` files, outputs module metadata as JSON arrays and bash-compatible lists
- **detect-go-version** -- reports Go minor version and whether `go test work` is supported
- **next-tag** -- determines next semver tag (patch/minor/major bump) using svu
- **wait-pending-jobs** -- polls GitHub API until all workflow runs for a PR's HEAD SHA complete (prevents auto-merge from deleting branches while non-required jobs are still running)

## Version Tracking Mechanism

1. `release_tracker.go` imports all tracked tools so they appear in `go.mod`
2. Dependabot monitors `go.mod` and proposes version updates
3. `get-tool-version.sh` extracts versions from `go.mod` by mapping tool names to Go import paths
4. Install actions call `get-tool-version.sh` when version is set to `auto`

Tool import path mapping (in `get-tool-version.sh`):
- `gotestsum` -> `gotest.tools/gotestsum`
- `go-junit-report` -> `github.com/jstemmer/go-junit-report/v2`
- `go-ctrf-json-reporter` -> `github.com/ctrf-io/go-ctrf-json-reporter`
- `svu` -> `github.com/caarlos0/svu`

## How Other go-openapi Repos Use These Actions

Other repos reference these actions via the `go-openapi/ci-workflows` reusable workflows, which in turn call:
```yaml
uses: go-openapi/gh-actions@master           # install all tools
uses: go-openapi/gh-actions/ci-jobs/...@master  # individual CI jobs
```

## Adding or Updating a Tool

1. Update `go.mod` with the new version
2. Add an import to `release_tracker.go` (for new tools)
3. Add a case to `get-tool-version.sh` with the correct Go import path
4. Create or update the corresponding `install/*/action.yml`

## Contributing

- Commits require DCO sign-off (`git commit -s`).
- Actions use composite action format with `action.yml` descriptors.
- SPDX license headers (Apache-2.0) on all files.
