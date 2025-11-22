// Package main is a dummy go package that maintains go.mod
// dependencies to the downloaded tools.
//
// This allows for dependabot to automatically post updates.
package main

import (
	// used to track dependencies using dependabot.
	_ "github.com/ctrf-io/go-ctrf-json-reporter/ctrf"
	_ "github.com/jstemmer/go-junit-report/v2/gtr"
	_ "github.com/jstemmer/go-junit-report/v2/junit"
	_ "github.com/jstemmer/go-junit-report/v2/parser/gotest"
	_ "gotest.tools/gotestsum/cmd"
	_ "gotest.tools/gotestsum/cmd/tool/matrix"
	_ "gotest.tools/gotestsum/cmd/tool/slowest"
)

func main() {
}
