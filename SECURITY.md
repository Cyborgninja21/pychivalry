# Security

## Reporting a vulnerability

Report it privately, not in a public issue: on this repository's **Security** tab choose
**Report a vulnerability**. That opens a private report only the maintainers can read.

Say what the problem is, how to reproduce it, and which version it affects.

## Supported versions

| Version | State |
| --- | --- |
| 1.0.0, the rebuild | Not released yet. Reports against the code on `main` are welcome |
| 2.3.0, the `ck3-language-support` extension | No longer developed. A serious problem will be recorded and fixed in the rebuild |

## What pychivalry touches

Useful to know when judging a report:

- It reads the files of the mod you open and of your installed game. It does not send them
  anywhere.
- Its servers run on your machine as your user, started by VS Code.
- It stores no API key and no login. An AI agent that uses it runs on a login that agent
  already has.
- Opening a mod runs none of the mod's content. pychivalry parses script; it does not execute
  it.
