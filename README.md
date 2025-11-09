# gh-actions

GitHub Actions used by go-openapi workflows.

## Usage

This repository contains reusable GitHub Actions for go-openapi projects.

### Starter Action

A basic composite action that sets up Go and provides a foundation for go-openapi workflows.

```yaml
name: Example Workflow
on: [push]

jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run go-openapi starter action
        uses: go-openapi/gh-actions@main
        with:
          go-version: '1.21'
          working-directory: '.'
```

### Inputs

- `go-version` - Go version to use (default: `1.21`)
- `working-directory` - Working directory for the action (default: `.`)

### Outputs

- `result` - Result of the action execution

## Development

To use this action in your workflow, reference it using the standard GitHub Actions syntax:

```yaml
- uses: go-openapi/gh-actions@main
```

Or pin to a specific version:

```yaml
- uses: go-openapi/gh-actions@v1
```

## License

Apache License 2.0
