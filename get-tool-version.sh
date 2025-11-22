#! /bin/bash
# Resolve the tool release version from go.mod

tool=${1?-Tool name is a required argument}

case "${tool}" in
  go-ctrf-json-reporter)
    GO_IMPORT_PATH="github.com/ctrf-io/go-ctrf-json-reporter"
    ;;
  go-junit-report)
    GO_IMPORT_PATH="github.com/jstemmer/go-junit-report/v2"
    ;;
  gotestsum)
    GO_IMPORT_PATH="gotest.tools/gotestsum"
    ;;
  *)
    echo "Unrecognized tool name"
    exit 1
    ;;
esac

go mod edit -json|jq -r ".Require|.[]|select(.Path==\"${GO_IMPORT_PATH}\")|.Version"
