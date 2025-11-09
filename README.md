# gh-actions

GitHub Actions used by go-openapi workflows

## Overview

This repository contains reusable GitHub Actions for go-openapi projects. These actions help automate common tasks in Go development workflows such as testing, coverage reporting, and CI/CD processes.

## Available Actions

### Go Test with Coverage

A composite action that runs Go tests with coverage reporting.

#### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `go-version` | Version of Go to use | No | `1.21` |
| `working-directory` | Working directory for running tests | No | `.` |
| `coverage-file` | Name of the coverage output file | No | `coverage.out` |
| `test-flags` | Additional flags to pass to go test | No | `-v -race` |

#### Outputs

| Output | Description |
|--------|-------------|
| `coverage-file` | Path to the generated coverage file |

#### Example Usage

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run tests with coverage
        uses: go-openapi/gh-actions@v1
        with:
          go-version: '1.21'
          working-directory: '.'
          coverage-file: 'coverage.out'
          test-flags: '-v -race -timeout 10m'
      
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage.out
```

#### Advanced Example with Multiple Go Versions

```yaml
name: Test Matrix

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        go-version: ['1.20', '1.21', '1.22']
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run tests
        uses: go-openapi/gh-actions@v1
        with:
          go-version: ${{ matrix.go-version }}
          coverage-file: coverage-${{ matrix.go-version }}.out
```

## Development

### Testing the Action

The repository includes a test workflow that validates the action works correctly. You can run it manually using workflow_dispatch or it will run automatically on push/PR.

### Project Structure

```
.
├── action.yml                 # Main action definition
├── .github/
│   └── workflows/
│       ├── ci.yml            # CI workflow for validation
│       └── test.yml          # Test workflow for the action
├── LICENSE
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
