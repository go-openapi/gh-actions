# gh-actions

<!-- Badges: status  -->
[![Tests][test-badge]][test-url] <!--[![Coverage][cov-badge]][cov-url]--> [![CI vuln scan][vuln-scan-badge]][vuln-scan-url] [![CodeQL][codeql-badge]][codeql-url]
<!-- Badges: release & docker images  -->
<!-- Badges: code quality  -->
<!-- Badges: license & compliance -->
[![Release][release-badge]][release-url] [![Go Report Card][gocard-badge]][gocard-url] [![CodeFactor Grade][codefactor-badge]][codefactor-url] [![License][license-badge]][license-url]
<!-- Badges: documentation & support -->
<!-- Badges: others & stats -->
[![GoDoc][godoc-badge]][godoc-url] [![Discord Channel][discord-badge]][discord-url] [![go version][goversion-badge]][goversion-url] ![Top language][top-badge] ![Commits since latest release][commits-badge]

---

GitHub Actions used by go-openapi workflows.

<!--
## Announcements
-->

## Status

These actions are currently used by the CI workflows run at `github.com/go-openapi`.

## Usage

To use this action in your workflow, reference it using the standard GitHub Actions syntax:

* Install all tools

```yaml
- uses: go-openapi/gh-actions@v0.1.6
```

* Install each tool independently
```yaml
- uses: go-openapi/gh-actions/install/gotestsum@v0.1.6
- uses: go-openapi/gh-actions/install/go-junit-report@v0.1.6
- uses: go-openapi/gh-actions/install/go-ctrf-json-reporter@v0.1.6
- uses: go-openapi/gh-actions/install/svu@v0.1.6
```

* Download a specific version

```yaml
- uses: go-openapi/gh-actions/install/go-ctrf-json-reporter@v0.1.6
  with:
    version: v0.0.12
```

## Installed tools

All tools are currently installed using downloaded released binaries.

* [gotestsum](https://github.com/gotestyourself/gotestsum/)
* [go-junit-report](https://github.com/jstemmer/go-junit-report)
* [go-ctrf-json-reporter](https://github.com/ctrf-io/go-ctrf-json-reporter)
* [svu](https://github.com/caarlos0/svu)

### Background

CI workflows may use and pin released actions instead of resorting to a `go install ...@latest`
command.

This is mostly motivated by the need to pin CI dependencies to a specific commit and use only
vetted versions of the installed tooling.

Our actions try to install tools from binary releases whenever applicable.

Automated version tracking is obtained thanks to a dummy `go.mod` module declaration in this repo,
which allows dependabot to track our target tools and post updates.

A vulnerability scan on the source repo of the tools must be passed for such an update to be approved and merged.

## Additional reusable actions

### wait-pending-jobs

An action that waits for all jobs to have run (not just status checks) on a PR.

```yaml
- uses: go-openapi/gh-actions/ci-jobs/wait-pending-jobs@v0.2.0
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    # Optional: exclude the current run (default: true)
    exclude-current-run: 'true'
    # Optional: patterns to match workflow names for exclusion (default: 'auto-merge,contributors')
    exclude-workflow-patterns: 'auto-merge,release'
```

**Background:** This action solves a timing issue where auto-merge triggers as soon as required status checks pass, but non-required jobs (like coverage upload) are still running. The PR gets merged and branch deleted while jobs are still in progress, causing them to fail.

When multiple jobs in the same workflow use this action in parallel, they can end up waiting for each other. The action includes smart defaults to prevent deadlocks:

* `exclude-current-run`: Automatically excludes the current workflow run from the wait list (default: `true`)
* `exclude-workflow-patterns`: Case-insensitive pattern matching against workflow names (default: `'auto-merge,contributors'`)
  - Patterns use substring matching: `'auto-merge'` matches `'Dependabot auto-merge'`, `'PR auto-merge'`, etc.
  - Override the default by providing your own comma-separated list of patterns

### bot-credentials

Securely configures bot credentials for automated operations including GPG signing and GitHub App authentication. This action addresses the security vulnerability where using `secrets[inputs.secret-name]` exposes ALL organization secrets to the workflow runner.

**Features:**
* GPG signing for commits and tags
* GitHub App token generation
* Both features can be enabled independently
* Secure: only passes explicitly named secrets (not all secrets)
* Flexible: works with custom secret names for any organization

**Usage example 1: go-openapi repos (using default secret names)**

For go-openapi repositories, the action automatically uses the organization's standard secret names (`CI_BOT_GPG_PRIVATE_KEY`, `CI_BOT_GPG_PASSPHRASE`, `CI_BOT_SIGNING_KEY`, `CI_BOT_APP_ID`, `CI_BOT_APP_PRIVATE_KEY`) when called with `secrets: inherit`:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: go-openapi/gh-actions/ci-jobs/bot-credentials@master
        id: bot
        with:
          enable-gpg-signing: 'true'
          enable-github-app: 'true'
          # No secret parameters needed! Falls back to go-openapi defaults
          gpg-private-key: ${{ secrets.CI_BOT_GPG_PRIVATE_KEY }}
          gpg-passphrase: ${{ secrets.CI_BOT_GPG_PASSPHRASE }}
          gpg-fingerprint: ${{ secrets.CI_BOT_SIGNING_KEY }}
          github-app-id: ${{ secrets.CI_BOT_APP_ID }}
          github-app-private-key: ${{ secrets.CI_BOT_APP_PRIVATE_KEY }}
      - run: |
          git commit -m "Signed commit"  # Automatically GPG signed
      - uses: peter-evans/create-pull-request@v8
        with:
          token: ${{ steps.bot.outputs.app-token }}
```

**Usage example 2: Other organizations (using custom secret names)**

For other organizations with different secret names (e.g., personal repos on `github.com/fredbi`):

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: go-openapi/gh-actions/ci-jobs/bot-credentials@master
        id: bot
        with:
          enable-gpg-signing: 'true'
          enable-github-app: 'true'
          # Pass your custom secret names explicitly
          gpg-private-key: ${{ secrets.FREDBI_GPG_PRIVATE_KEY }}
          gpg-passphrase: ${{ secrets.FREDBI_GPG_PASSPHRASE }}
          gpg-fingerprint: ${{ secrets.FREDBI_SIGNING_KEY }}
          github-app-id: ${{ secrets.FREDBI_APP_ID }}
          github-app-private-key: ${{ secrets.FREDBI_APP_PRIVATE_KEY }}
      - run: |
          git commit -m "Signed commit"  # Automatically GPG signed
      - uses: peter-evans/create-pull-request@v8
        with:
          token: ${{ steps.bot.outputs.app-token }}
```

**Background:** This action was created to solve the security issue identified in [ci-workflows#43](https://github.com/go-openapi/ci-workflows/pull/43). Using `secrets[inputs.secret-name]` causes GitHub Actions to expose ALL organization and repository secrets to the workflow runner. This action requires secrets to be passed as actual values, ensuring only explicitly named secrets are accessible.

### detect-go-monorepo

This action detects the presence of multiple go modules in a git repo (i.e. a go mono-repo).

It returns a `is-monorepo` indicator and several ways to iterate over modules
(by module import name, by folder, as JSON - e.g. for matrix jobs -, as bash-compatible lists).

Requires: go setup, git checkout

```yaml
outputs:
  is-monorepo:
    description: |
      Indicates if the current repo is a go mono repo.

  modules-count:
    description: |
      Counts how many modules have been detected.

  modules:
    description: |
      A JSON array of modules with name (go import path) and path (folder in the current checkout).

  paths:
    description: |
      A JSON array of modules paths

  bash-paths:
    description: |
      A bash-compatible array of modules paths.

  bash-subpaths:
    description: |
      A bash-compatible array of modules paths with the "/..." suffix.

  names:
    description: |
      A JSON array of modules names (import paths)

  relative-names:
    description: |
      A JSON array of modules relative module names (relative imports).
      The root module always yields an empty string.
      These are pure relative paths without leading "." or "/".

      Example: github.com/go-openapi/swag/jsonutils yields "jsonutils"

  bash-relative-names:
    description: |
      A bash-compatible array of modules relative names (relative imports).
      The root module always yields an empty string.
      These are pure relative paths without leading "." or "/".

      Example: github.com/go-openapi/swag/jsonutils yields "jsonutils"

  root-module:
    description: |
      The name (go import path) of the root module in the go mono repo.
```

**Usage example**

```yaml
jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    outputs:
      is-monorepo: ${{ steps.detect-monorepo.outputs.is-monorepo }}
      bash-subpaths: ${{ steps.detect-monorepo.outputs.bash-subpaths }}
      module-names: ${{ steps.detect-monorepo.outputs.names }}
    steps:
      -
        uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
        with:
          fetch-depth: 0
      -
        uses: actions/setup-go@4dc6199c7b1a012772edbd06daecab0f50c9053c # v6.1.0
        with:
          go-version: stable
          check-latest: true
          cache: true
          cache-dependency-path: '**/go.sum'
      -
        name: Detect go mono-repo
        id: detect-monorepo
        uses: go-openapi/gh-actions/ci-jobs/detect-go-monorepo@master # v1.4.0
      -
        name: golangci-lint
        if: ${{ steps.detect-monorepo.outputs.is-monorepo != 'true' }}
        uses: golangci/golangci-lint-action@1e7e51e771db61008b38414a730f564565cf7c20 # v9.2.0
        with:
          version: latest
          only-new-issues: true
          skip-cache: true

      # Carry out the linting the traditional way, within a shell loop
      -
        name: Lint multiple modules
        if: ${{ steps.detect-monorepo.outputs.is-monorepo == 'true' }}
        # golangci-lint doesn't support go.work to lint multiple modules in one single pass
        run: |
          set -euxo pipefail
          git fetch origin master
          git show --no-patch --oneline origin/master
          while read -r module_location ; do
            pushd "${module_location}"
            golangci-lint run --new-from-rev origin/master
            popd
          done < <(echo ${{ steps.detect-monorepo.outputs.bash-paths }})
```

### detect-go-version

This action detects the current go version and reports the minor version.

Its intent is to report about the availability of certain features useful for testing,
that are not available in all instances of a matrix job spanning over multiple go versions.

At this moment, we are mostly interested about the possibility to run a simplified test script
using `go test work`.

Requires: go setup, git checkout

```yaml
outputs:
  go-minor-version:
    description: |
      The minor version of go that is installed.

      Example: go1.25.4 yields 25

  is-gotestwork-supported:
    description: |
      Tells if go test work is available (e.g. go1.25 and go.work exists)
```

**Usage example**

```yaml
jobs:
  test:
    name: Unit tests mono-repo
    needs: [ lint ]
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ ubuntu-latest, macos-latest, windows-latest ]
        go: ['oldstable', 'stable' ]
    steps:
      -
        uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
      -
        uses: actions/setup-go@4dc6199c7b1a012772edbd06daecab0f50c9053c # v6.1.0
        id: go-setup
        with:
          go-version: '${{ matrix.go }}'
          check-latest: true
          cache: true
          cache-dependency-path: '**/go.sum'
      -
        name: Detect go version capabilities
        id: detect-go-version
        uses: go-openapi/gh-actions/ci-jobs/detect-go-version@master # v1.4.0
      -
        name: Install gotestsum
        uses: go-openapi/gh-actions/install/gotestsum@eb161ed408645b24aaf6120cd5e4a893cf2c0af2 # v1.3.1
      -
        name: Run unit tests on all modules (go1.25+ with go.work) [monorepo]
        if: ${{ needs.lint.outputs.is-monorepo == 'true' && steps.detect-go-version.outputs.is-gotestwork-supported == 'true' }}
        # with go.work file enabled, go test recognizes sub-modules and collects all packages to be covered
        # without specifying -coverpkg.
        # ...
```

### Bump next tag

This action uses svu to compute the next release tag depending on the request kind of bump (patch, minor, major).

```yaml
inputs:
  bump-patch:
    description: Bump a patch version release
    type: string
    required: false
    default: 'true'
  bump-minor:
    description: Bump a minor version release
    type: string
    required: false
    default: 'false'
  bump-major:
    description: Bump a major version release
    type: string
    required: false
    default: 'false'
```

```yaml
outputs:
  next-tag:
    description: |
      The bumped release tag.
```

**Usage example**

```yaml
job:
  determine-next-tag:
    name: Determine next tag [monorepo]
    needs: [detect-modules]
    if: ${{ needs.detect-modules.outputs.is-monorepo == 'true' }}
    runs-on: ubuntu-latest
    outputs:
      next-tag: ${{ steps.bump-release.outputs.next-tag }}
    steps:
      -
        name: Checkout code
        uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
        with:
          fetch-depth: 0
      -
        name: Determine next tag
        id: bump-release
        uses: go-openapi/gh-actions/ci-jobs/next-tag@master # v1.4.0
        with:
          bump-patch: ${{ inputs.bump-patch }}
          bump-minor: ${{ inputs.bump-minor }}
          bump-major: ${{ inputs.bump-major }}
```

## Change log

See <https://github.com/go-openapi/gh-actions/releases>


## Licensing

This library ships under the [SPDX-License-Identifier: Apache-2.0](./LICENSE).

## Other documentation

* [All-time contributors](./CONTRIBUTORS.md)
* [Contributing guidelines][contributing-doc-site]
* [Maintainers documentation][maintainers-doc-site]
* [Code style][style-doc-site]
* [Contributing guidelines](.github/CONTRIBUTING.md)

## Cutting a new release

Maintainers can cut a new release by either:

* running [this workflow](https://github.com/go-openapi/gh-actions/actions/workflows/bump-release.yml)
* or pushing a semver tag
  * signed tags are preferred
  * The tag message is prepended to release notes

<!-- Badges: status  -->
[test-badge]: https://github.com/go-openapi/gh-actions/actions/workflows/test.yml/badge.svg
[test-url]: https://github.com/go-openapi/gh-actions/actions/workflows/test.yml
<!--
[cov-badge]: https://codecov.io/gh/go-openapi/gh-actions/branch/master/graph/badge.svg
[cov-url]: https://codecov.io/gh/go-openapi/gh-actions
-->
[vuln-scan-badge]: https://github.com/go-openapi/gh-actions/actions/workflows/scanner.yml/badge.svg
[vuln-scan-url]: https://github.com/go-openapi/gh-actions/actions/workflows/scanner.yml
[codeql-badge]: https://github.com/go-openapi/gh-actions/actions/workflows/codeql.yml/badge.svg
[codeql-url]: https://github.com/go-openapi/gh-actions/actions/workflows/codeql.yml
<!-- Badges: release & docker images  -->
[release-badge]: https://badge.fury.io/gh/go-openapi%2Fgh-actions.svg
[release-url]: https://badge.fury.io/gh/go-openapi%2Fgh-actions
[gomod-badge]: https://badge.fury.io/go/github.com%2Fgo-openapi%2Fgh-actions.svg
[gomod-url]: https://badge.fury.io/go/github.com%2Fgo-openapi%2Fgh-actions
<!-- Badges: code quality  -->
[gocard-badge]: https://goreportcard.com/badge/github.com/go-openapi/gh-actions
[gocard-url]: https://goreportcard.com/report/github.com/go-openapi/gh-actions
[codefactor-badge]: https://img.shields.io/codefactor/grade/github/go-openapi/gh-actions
[codefactor-url]: https://www.codefactor.io/repository/github/go-openapi/gh-actions
<!-- Badges: documentation & support -->
[doc-badge]: https://img.shields.io/badge/doc-site-blue?link=https%3A%2F%2Fgoswagger.io%2Fgo-openapi%2F
[doc-url]: https://goswagger.io/go-openapi
[godoc-badge]: https://pkg.go.dev/badge/github.com/go-openapi/gh-actions
[godoc-url]: http://pkg.go.dev/github.com/go-openapi/gh-actions
[discord-badge]: https://img.shields.io/discord/1446918742398341256?logo=discord&label=discord&color=blue
[discord-url]: https://discord.gg/FfnFYaC3k5

<!-- Badges: license & compliance -->
[license-badge]: http://img.shields.io/badge/license-Apache%20v2-orange.svg
[license-url]: https://github.com/go-openapi/gh-actions/?tab=Apache-2.0-1-ov-file#readme
<!-- Badges: others & stats -->
[goversion-badge]: https://img.shields.io/github/go-mod/go-version/go-openapi/gh-actions
[goversion-url]: https://github.com/go-openapi/gh-actions/blob/master/go.mod
[top-badge]: https://img.shields.io/github/languages/top/go-openapi/gh-actions
[commits-badge]: https://img.shields.io/github/commits-since/go-openapi/gh-actions/latest
<!-- Organization docs -->
[contributing-doc-site]: https://go-openapi.github.io/doc-site/contributing/contributing/index.html
[maintainers-doc-site]: https://go-openapi.github.io/doc-site/maintainers/index.html
[style-doc-site]: https://go-openapi.github.io/doc-site/contributing/style/index.html
