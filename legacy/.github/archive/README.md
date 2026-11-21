# .github archive

Copilot prompts, agents and skills archived in the 2.0.0 hygiene pass (2026-10-01). The rule
applied: a file stays in `.github/prompts`, `.github/agents` or `.github/skills` only if it describes
the current architecture (the `packages/engine` core with its bundled spec package, and the thin
extension) or is referenced by `.github/copilot-instructions.md`. Everything else moved here
unchanged, under its original relative path. "Generic" means not specific to this repository;
"stale" means it describes the pre-2.0.0 layout (scraped `data/` vocabulary, `core/` parser and
indexer, `schema/` loader, the `ck3/validation/diagnostics.ts` coordinator, the Python server, or
retired diagnostic codes).

Kept in place: `agents/ck3-localization-manager.agent.md`, `agents/ck3-trait-designer.agent.md`
(both use only the optional `data/` sets that survive: concepts, icons, traits),
`prompts/Debugging LSP Server Issues.prompt.md` and `prompts/VS Code Extension Packaging.prompt.md`
(both match the current client/server and packaging).

## agents/

- `README.md`: index of the Star Trek development team and the CK3 mod builders; indexes files now archived.
- `barclay.agent.md`, `janeway.agent.md`: performance specialists; generic.
- `boimler.agent.md`, `mariner.agent.md`, `tendi.agent.md`: Windows, Linux-remote and Docker operations specialists; generic.
- `crusher.agent.md`, `q.agent.md`, `troi.agent.md`: review, adversarial review and quality assessment; generic.
- `data.agent.md`, `lore.agent.md`: research and planning; generic.
- `dax.agent.md`: data modelling and database migrations; generic (no database here).
- `guinan.agent.md`: documentation specialist; generic.
- `hugh.agent.md`, `seven.agent.md`: bulk-edit specialists; generic.
- `kirk.agent.md`, `rutherford.agent.md`, `scotty.agent.md`, `torres.agent.md`, `wesley.agent.md`: engineers, debugging and testing; generic.
- `laforge.agent.md`: architecture coherence; generic.
- `obrien.agent.md`: CI/CD and git operations; generic.
- `picard.agent.md`, `riker.agent.md`: orchestration and implementation coordination; generic.
- `sisko.agent.md`: sprint and backlog management; generic.
- `tuvok.agent.md`: knowledge-graph memory; generic.
- `worf.agent.md`: security audits; generic.
- `ck3-activity-builder.agent.md`, `ck3-decision-builder.agent.md`, `ck3-event-builder.agent.md`, `ck3-interaction-builder.agent.md`, `ck3-onaction-builder.agent.md`, `ck3-story-cycle-builder.agent.md`: CK3 content builders; stale (point at the deleted `data/schemas`, and three of them at `data/effects` and `data/triggers`).
- `ck3-mod-orchestrator.agent.md`: routes work to the CK3 builders; stale with them.
- `ck3-scope-timing.agent.md`: scope-timing rules; stale (scope tables from the deleted `data/scopes`).
- `ck3-validator.agent.md`: the "6-phase pipeline" and its code ranges (CK31xx, CK3600–CK3604); stale (the engine pipeline and its catalogue ids replaced them).
- `ck3-variable-designer.agent.md`: variable design; stale (cites VAR-001 to VAR-004, which no validator emits).

## prompts/

- `README.md`: index of the prompt templates; indexes files now archived.
- `Adding New CK3 Language Features.prompt.md`, `LSP Feature Implementation.prompt.md`: stale (`ck3/language`, `data/scopes`, `core/parser`).
- `Test Writing Best Practices.prompt.md`: stale (tests against the deleted `core/` modules).
- `Version Update Assistant.prompt.md`: stale (bumps only `vscode-extension`, not `packages/engine`).
- `architecture_and_flow.md`, `documentation_standard.md`: stale (pre-2.0.0 module map).
- `ascii_art_architecture_documentation.md`, `Guided-PRD-Creation.prompt.md`: generic.
- `Branch Creation Assistant.prompt.md`, `Branch Merge Assistant.prompt.md`, `Commit Message Assistant.prompt.md`: generic git workflow.
- `gh issue create/edit/list`, `gh pr checks/create/merge/review/view`, `gh release delete`, `gh run list/rerun/view` (`.prompt.md`, 13 files): generic GitHub CLI helpers.

## skills/

- `adr-authoring/`, `architectural-decisions/`, `architecture-patterns/`, `ascii-flowchart/`: ADR and architecture-diagram skills; generic.
- `after-action/`, `analysis-methodology/`, `document-lifecycle/`, `memory-contract/`, `periodic-review/`, `project-checkup/`: agent process skills; generic.
- `code-review-checklist/`, `code-review-standards/`, `engineering-standards/`: review and engineering standards; generic.
- `cross-repo-contract/`, `git-commit/`, `release-procedures/`, `skill-creator/`: generic.
- `security-patterns/`, `testing-patterns/`: multi-language security and testing references (Go, Java, Python); generic.
- `ck3-validation-debugging`: debugging the validation pipeline; stale (`core/parser` and `data/scopes`).
- `lsp-feature-debugging`: stale (providers wired to `core/parser`).
- `lsp-performance-optimization`: trie, bloom-filter and LRU recipes; stale (the matching issues #64 to #70 were closed as superseded in the 2.0.0 triage).
- `mocha-testing-patterns`: stale (tests against the deleted `core/` modules).
- `vscode-extension-workflow`: stale (`cd vscode-extension && npm install`, `npm run lint:fix`; the workspace installs from the root).
- `github-actions-failure-debugging`: generic.
- `tool-list.md`: tool inventory for the agents above; generic.
