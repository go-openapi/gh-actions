# gh-actions

<!-- Badges: status  -->
[![Tests][test-badge]][test-url] <!--[![Coverage][cov-badge]][cov-url]--> [![CI vuln scan][vuln-scan-badge]][vuln-scan-url] [![CodeQL][codeql-badge]][codeql-url]
<!-- Badges: release & docker images  -->
<!-- Badges: code quality  -->
<!-- Badges: license & compliance -->
[![Release][release-badge]][release-url] [![Go Report Card][gocard-badge]][gocard-url] [![CodeFactor Grade][codefactor-badge]][codefactor-url] [![License][license-badge]][license-url]
<!-- Badges: documentation & support -->
<!-- Badges: others & stats -->
<!-- Slack badge disabled until I am able to restore a valid link to the chat -->
[![GoDoc][godoc-badge]][godoc-url] <!-- [![Slack Channel][slack-badge]][slack-url] -->[![go version][goversion-badge]][goversion-url] ![Top language][top-badge] ![Commits since latest release][commits-badge]

---

GitHub Actions used by go-openapi workflows.

## Status

This project is still in a very early stage. It is being actively developed and has not released yet.

## Usage

To use this action in your workflow, reference it using the standard GitHub Actions syntax:

* Install all tools

```yaml
- uses: go-openapi/gh-actions@v1
```

* Install each tool independently
```yaml
- uses: go-openapi/gh-actions/install/gotestsum@v1
- uses: go-openapi/gh-actions/install/go-junit-report@v1
- uses: go-openapi/gh-actions/install/go-ctrf-json-reporter@v1
```

## Motivation

This repository currently exposes "installer" actions for some testing go tools and
CI workflows may use and pin released actions instead of resorting to a `go install ...@latest`
command.

This is mostly motivated by the need to pin CI dependencies to a specific commit and use only
vetted versions of the installed tooling.

Our actions try to install tools from binary releases whenever applicable.

Automated version tracking is obtained thanks to a dummy `go.mod` module declaration in this repo,
which allows dependabot to track our target tools and post updates.

A vulnerability scan on the source repo of the tools must be passed for such an update to be approved and merged.

## Change log

See <https://github.com/go-openapi/gh-actions/releases>


## Licensing

This library ships under the [SPDX-License-Identifier: Apache-2.0](./LICENSE).

## Other documentation

* [All-time contributors](./CONTRIBUTORS.md)
* [Contributing guidelines](.github/CONTRIBUTING.md)

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
[release-badge]: https://badge.fury.io/go/github.com%2Fgo-openapi%2Fgh-actions.svg
[release-url]: https://badge.fury.io/go/github.com%2Fgo-openapi%2Fgh-actions
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
[slack-badge]: https://slackin.goswagger.io/badge.svg
[slack-url]: https://slackin.goswagger.io
<!-- Badges: license & compliance -->
[license-badge]: http://img.shields.io/badge/license-Apache%20v2-orange.svg
[license-url]: https://github.com/go-openapi/gh-actions/?tab=Apache-2.0-1-ov-file#readme
<!-- Badges: others & stats -->
[goversion-badge]: https://img.shields.io/github/go-mod/go-version/go-openapi/gh-actions
[goversion-url]: https://github.com/go-openapi/gh-actions/blob/master/go.mod
[top-badge]: https://img.shields.io/github/languages/top/go-openapi/gh-actions
[commits-badge]: https://img.shields.io/github/commits-since/go-openapi/gh-actions/latest
