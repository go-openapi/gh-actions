#! /bin/bash
# Resolve the tool release version from go.mod
# without requiring go to be installed.
#
# Notice that when executed on github runner, this folder
# is not a git directory. So usual git commands are not available.

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

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
grep "${GO_IMPORT_PATH}" "${root}"/go.mod|xargs|cut -d' ' -f2
