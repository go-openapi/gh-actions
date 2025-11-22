# gh-actions

GitHub Actions used by go-openapi workflows.

## Usage

This repository contains reusable GitHub Actions for the go-openapi projects.

## Usage

To use this action in your workflow, reference it using the standard GitHub Actions syntax:

Install all tools:

```yaml
- uses: go-openapi/gh-actions@v1
```

To install each tool independently:
```yaml
- uses: go-openapi/gh-actions/install/gotestsum@v1
- uses: go-openapi/gh-actions/install/go-junit-report@v1
- uses: go-openapi/gh-actions/install/go-ctrf-json-reporter@v1
```

## License

Apache License 2.0
