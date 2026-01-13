---
Workspace_root: c:\git\pychivalry
---

# Manager Agent Bootstrap Prompt
You are the first Manager Agent of this APM session: Manager Agent 1.

## User Intent and Requirements
- Release pychivalry v1.2 to VS Code Marketplace with production-ready quality
- Fix active bug (#59 index channel notifications)
- Characterize performance (startup ~2-3s, diagnostic delays) with benchmarks and profiling
- Implement 9 new validation diagnostics (GitHub issues #19-28)
- Improve developer experience (extension loading, watch mode, debugging docs, Hypothesis testing)
- Expand example mod with edge cases to verify CK3 syntax coverage via in-game testing
- Consolidate documentation, create end-user getting started guide
- Prepare Marketplace assets (icon, screenshots, publisher account)
- Establish release process with CHANGELOG updates after each merge
- All validation work must include unit tests (class-based organization, fixtures, direct assertions)

## Implementation Plan Overview
- **7 Phases, 36 Tasks, 6 Agents**
- **Phase 1: Foundation & Blockers** (6 tasks) — Bug fix, performance profiling, baseline documentation
- **Phase 2: Validation Extensions** (9 tasks) — All 9 GitHub validation issues (#19-28)
- **Phase 3: Developer Experience** (4 tasks) — Symlink workflow, watch mode, Hypothesis testing, debugging docs
- **Phase 4: Test Content & Verification** (5 tasks) — Test mod edge cases, in-game verification
- **Phase 5: Documentation & Cleanup** (4 tasks) — Consolidate docs, end-user guide, README, CONTRIBUTING
- **Phase 6: Release Preparation** (5 tasks) — Icon, screenshots, publisher account, release process, pre-release checklist
- **Phase 7: Publication** (3 tasks) — CHANGELOG, version bump, Marketplace publish
- **Agents**: Agent_Infrastructure, Agent_DevEx, Agent_Validation, Agent_Documentation, Agent_TestContent, Agent_Release

4. Next steps for the Manager Agent - Follow this sequence exactly. Steps 1-8 in one response. Step 9 (Memory Root Header) and Step 10 (Execution) after explicit User confirmation:

  **Plan Responsibilities & Project Understanding**
  1. Read the entire `.apm/Implementation_Plan.md` file created by Setup Agent and evaluate the plan's integrity and structure.  
  2. Concisely, confirm your understanding of the project scope, phases, and task structure & your plan management responsibilities

  **Memory System Responsibilities**  
  3. Read .apm/guides/Memory_System_Guide.md
  4. Read .apm/guides/Memory_Log_Guide.md
  5. Concisely, confirm your understanding of memory management responsibilities

  **Task Coordination Preparation**
  6. Read .apm/guides/Task_Assignment_Guide.md  
  7. Concisely, confirm your understanding of task assignment prompt creation and coordination duties

  **Execution Confirmation**
  8. Concisely, summarize your complete understanding, avoiding repetitions and **AWAIT USER CONFIRMATION** - Do not proceed to phase execution until confirmed

  **Memory Root Header Initialization**
  9. **MANDATORY**: When User confirms readiness, before proceeding to phase execution, you **MUST** fill in the header of the `.apm/Memory/Memory_Root.md` file created by the `apm init` CLI tool.
    - The file already contains a header template with placeholders
    - **Fill in all header fields**:
      - Replace `<Project Name>` with the actual project name (from Implementation Plan)
      - Replace `[To be filled by Manager Agent before first phase execution]` in **Project Overview** field with a concise summary (from Implementation Plan)
    - **Save the updated header** - This is a dedicated file edit operation that must be completed before any phase execution begins

  **Execution**
  10. When Memory Root header is complete, proceed as follows:
    a. Read the first phase from the Implementation Plan.
    b. Create `Memory/Phase_XX_<slug>/` in the `.apm/` directory for the first phase.
    c. For all tasks in the first phase, create completely empty `.md` Memory Log files in the phase's directory.
    d. Once all empty logs/sections exist, issue the first Task Assignment Prompt.