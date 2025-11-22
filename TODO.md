# Objectives

Starter:

* a few actions to replace "go install ..." commands in ci jobs
* motivations:
  * want to be able to pin these versions
  * want to automate upgrades with new versions of these tools
  * want to reduce updates, with just a regular update of the gh-actions repo to be accounted for
    by consuming repos

* details
  * want this repo to be updateable by dependabot (or other scheduled job), finding new versions of the tools to install
  * would like downloads to be fast using just binary downloads rather than go install
  * some tools currently do not publish binary releases => use go install with pinned version
  * want new versions of tools to be vetted by trivy betfore we proceed with an upgrade

* a few little challenges:
  * does dependabot scan for action updates _outside_ the .github folder?
  * how to keep the "versions.yml" file up-to-date?
