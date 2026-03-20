---
name: adr-authoring
description: >-
  Author Architecture Decision Records (ADRs) for the ck3-language-support (pychivalry) VS Code extension.
  Trigger this skill when asked to create, draft, or write a new ADR, or when
  a technical decision needs to be formally documented.
---

# ADR Authoring

## Purpose & Scope

- Provide a repeatable recipe for writing Architecture Decision Records for this VS Code extension project
- Ensure every ADR encodes actionable standards for TypeScript, VS Code extension APIs, LSP protocol, webpack bundling, and CK3 game-data parsing
- Trigger this skill whenever a decision must be captured, a plan mandates documentation, or an agent explicitly requests an ADR

## Canonical ADR Template

Use the project template below (full copy in [references/adr-template.md](references/adr-template.md)). All sections from Context through References are expected. Alternatives Considered may be brief or omitted for process/policy ADRs where no plausible alternatives exist, and Review History plus Notes are recommended but optional for initial drafts.

````markdown
# ADR NNN: Descriptive Title

**Status:** Accepted
**Date:** 2026-02-09
**Context:** ck3-language-support <area or subsystem>
**Related:** ADR 001, ADR 002, docs/... (optional)

---

## Context

... detailed evidence, audit quotes, code snippets ...

## Decision

### 1. Sub-Decision Title

**Rule:** Concise rule sentence.
**Implementation:**

```yaml
# exact code/config showing enforcement
```
````

## Alternatives Considered

### Alternative 1: Title

- ❌ Approach: ...
- ❌ Rejected Because: ...

## Consequences

### Positive (✅)

- ...

### Negative (⚠️)

- ...

### Neutral (🔵) _(optional)_

- ...

### Mitigations

- ...

## Implementation

1. Step-by-step rollout with Taskfile tasks, CI gates, lint rules, pre-commit hooks
2. ...

## Examples

### Example 1: Title

```yaml
# working sample
```

## References

- ADR 001: ...
- External doc links

---

## Review History

- 2026-02-09: Drafted by <agent>

---

## Notes

- Success metrics, follow-ups

````

## Section Expectations
1. **Context**
   - Explain *why* the decision exists using repo evidence (audit excerpts, log output, directory trees, code fragments).
   - Reference relevant components (e.g., server subsystems, VS Code extension client, webpack config) with inline fenced blocks (` ```typescript `, ` ```json `, ` ```bash `).
   - Include block quotes for audit findings or user problem statements.
2. **Decision**
   - Break into numbered `### N.` sub-decisions. Each must include `**Rule:**` (policy) and `**Implementation:**` (copy-pastable code/task snippet) fences.
   - For enforcement snippets, cover multiple tooling layers (Taskfile targets, ESLint/Prettier config, webpack configuration, CI workflows) as needed.
3. **Alternatives Considered**
   - Each alternative is `### Alternative N: Title` with paired ❌ bullets labelled `Approach` and `Rejected Because`.
   - Mention trade-offs relative to existing ADRs and architectural constraints.
4. **Consequences**
   - Split into `### Positive (✅)`, `### Negative (⚠️)`, optional `### Neutral (🔵)`, and `### Mitigations` sections.
   - Consequences must address performance, security, operability, and developer experience impacts.
5. **Implementation**
   - Provide numbered rollout steps (Taskfile commands, CI updates, linting, policy enforcement) plus code snippets for each control point.
   - Describe gating (pre-commit, GitHub Actions) and verification (tests, lint, webpack compile) referencing `.github/copilot-instructions.md` and `.github/instructions/*.instructions.md` when relevant.
6. **Examples**
   - Supply at least two complete examples mixing TypeScript/JSON/bash/markdown relevant to the decision.
   - Show realistic filenames/paths from this repo (e.g., `src/server/ck3/...`, `src/server/lsp/...`, `src/extension.ts`).
7. **References**
   - Bullet list linking to other ADRs, docs, ADR indexes, ADR-related skills, and external standards. Use `ADR NNN` formatting when referencing decisions.
8. **Review History / Notes**
   - Capture review dates, reviewers, and follow-up actions. Notes should include success metrics or monitoring signals.

## Numbering & Naming Rules
- Format: `ADR NNN` (zero-padded sequential).
- Determine the next ID by scanning `docs/adr/` or consulting [docs/adr/adr-index.md](../../../docs/adr/adr-index.md); that index is the authoritative list, so never assume the next number without verifying.
- File name: `adr-NNN-kebab-case-title.md` placed under `docs/adr/`.
- Title case for main heading: `# ADR 00X: Enforce XYZ`.
- Cross references use `ADR 00X` (space separator). Update references if superseding/related decisions change.
- After adding a new ADR file, update `docs/adr/adr-index.md` (table row with status, description, link). `docs/adr/README.md` also lists ADRs but may lag; update it too whenever it contains a static index.

## Superseding & Deprecating ADRs
- **Superseding:** When a new ADR replaces an older one, add `Related: Supersedes ADR NNN` (with link) in the new ADR header. Update the superseded ADR’s **Status** line to `Superseded by ADR NNN` (hyperlink the new file) and adjust its entry in `docs/adr/adr-index.md`. Touch both ADR files and the index in the same change so the relationship stays synchronized.
- **Deprecating:** When retiring guidance without a replacement, change the ADR Status to `Deprecated — <short reason>`, note the rationale in Context or Notes, and update `docs/adr/adr-index.md`. If `docs/adr/README.md` mirrors the index, refresh it as well.
- Always perform two-sided updates: the new ADR documents what it supersedes, and the old ADR points readers to the new source of truth.

## Writing Workflow
1. **Determine Next Number**: Scan `docs/adr/*.md` or review `docs/adr/adr-index.md` (authoritative source) to select the next sequential ID.
2. **Create File**: Copy [references/adr-template.md](references/adr-template.md) to `docs/adr/adr-NNN-title.md`.
3. **Populate Header**: Fill Status (Proposed → Accepted progression), Date (YYYY-MM-DD), Context (team/initiative), Related ADRs/docs.
4. **Document Context**: Gather logs, audit snippets, code references; embed evidence with fenced code and block quotes.
5. **Draft Decisions & Consequences**: Use numbered sub-decisions, explicit rules, reproduction-ready implementation snippets, and effect analysis.
6. **Detail Implementation Steps**: Include Taskfile targets, CI jobs, lint/pre-commit updates, testing requirements, and enforcement hooks.
7. **Add Examples & References**: Provide multi-language working samples; cross-link ADRs, docs, external specs.
8. **Review History & Notes**: Log authorship, reviewers, success metrics, sunset criteria. Insert horizontal rules exactly as shown.
9. **Update Index**: Modify `docs/adr/adr-index.md` (source of truth) with the new ADR entry and refresh `docs/adr/README.md` if it maintains a static ADR list.
10. **Validate**: Run markdown lint (if configured) and confirm the ADR cites real evidence from the repository or user context. If evidence is pending, state that explicitly instead of fabricating examples; focus on implementation-ready detail rather than arbitrary length.

## Style & Quality Guidelines
- Include only evidence you can cite from the repository or provided context. ADRs should be as detailed as necessary—with rich examples, diagrams, and tables—but never padded to hit an arbitrary line count. If evidence is pending, say so plainly.
- Favor precise, instruction-oriented prose. Use repository terminology (Taskfile, webpack, ESLint, VS Code API, vscode-languageserver).
- Cite enforcement artifacts: `.eslintrc.json`, `tsconfig.json`, `.prettierrc`, `.pre-commit-config.yaml`, `Taskfile.yml`, `webpack.config.js`, `.github/workflows/*.yml`.
- Embed repository paths without backticks where referencing files (e.g., `docs/adr/adr-001-include-pattern-evaluation.md`).
- Use KaTeX (`$...$` or `$$...$$`) if equations are necessary (e.g., latency budgets).
- Ensure Implementation section covers tooling hooks plus verification steps.
- Include mitigation strategies for every negative consequence.
- Confirm decisions align with `.github/copilot-instructions.md` constraints (no `any` types, no `console.log` in production, strict TypeScript, etc.).

## Quality Checklist Before Publishing
- [ ] Header block matches canonical formatting (status, date, context, related, horizontal rule)
- [ ] Sections from Context through References are present in order with correct headings/emojis (Alternatives may be brief or omitted for process/policy ADRs, Review History and Notes optional but encouraged)
- [ ] Decision sub-sections include both `**Rule:**` and `**Implementation:**` fences
- [ ] Alternatives use ❌ emoji reasoning pairs
- [ ] Consequences split into Positive/Negative/(Neutral)/Mitigations with ✅/⚠️/🔵 icons
- [ ] Implementation describes rollout controls (Taskfile, CI, lint, testing) and enforcement artifacts
- [ ] Examples feature runnable TypeScript/JSON/bash snippets referencing real repo paths
- [ ] References cite ADRs, docs, and external materials
- [ ] Review History + Notes appended after horizontal rules
- [ ] docs/adr/adr-index.md updated with new row (ID, title, status, link) and `docs/adr/README.md` refreshed if it mirrors the ADR list

## Additional Guidance
- Tie each ADR to relevant instructions: `.github/instructions/typescript.instructions.md`, `.github/instructions/ci-cd.instructions.md`.
- Mention build-system boundaries (Taskfile vs npm scripts vs webpack) when applicable.
- When enforcing tooling behavior, include exact Taskfile targets, ESLint rules, GitHub Action job IDs, or pre-commit hook snippets.
- Document success metrics (e.g., "Zero ESLint warnings for 30 days", "All CI matrix jobs green") inside Notes.

## Topic-Specific Prompts
- **LSP Server Architecture:** Discuss subsystem boundaries (core/, lsp/, ck3/, schema/, data/), coordinator pattern for validation, functional composition over inheritance, and server lifecycle management.
- **VS Code Extension Client:** Address activation events, command registration, configuration contribution points, and client-server communication via vscode-languageclient.
- **CK3 Game Data:** Cover schema definition patterns, game data extraction, parsing strategies, validation rules, and how CK3 scripting language constructs map to LSP features.
- **Build & Tooling:** Address webpack dual entry points (extension.ts, server.ts), TypeScript strict mode, ESLint configuration, and the relationship between Taskfile targets and npm scripts.
- **CI/CD (GitHub Actions):** Address action version pinning, job timeouts, concurrency controls, cross-platform matrix testing, and adherence to workflow naming conventions.

Use this skill to produce ADRs that are self-contained, enforceable, and actionable across the ck3-language-support VS Code extension codebase.
````
