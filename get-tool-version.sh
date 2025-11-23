#! /bin/bash
# Resolve the tool release version from go.mod
# without requiring go to be installed.

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

root=$(git rev-parse --show-toplevel)
grep "${GO_IMPORT_PATH}" "${root}"/go.mod|xargs|cut -d' ' -f2
