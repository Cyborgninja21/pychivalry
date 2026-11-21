---
name: cross-repo-contract
description: Enforce type safety and contract adherence for APIs spanning multiple repositories. Use when implementing or consuming cross-repo API endpoints, syncing contract definitions between repos, proposing contract changes, or validating that request/response shapes match a shared contract. Covers contract discovery, standard directory structure (api-contract/ or .contracts/), implementation guidelines for both backend and frontend, contract change proposals, CI sync workflows, and type validation testing.
---

# Cross-Repository API Contract Skill

## Purpose

When implementing or consuming APIs that span multiple repositories, ensure type safety and contract adherence by working with locally available contract definitions.

## Contract Discovery

Before implementing any API endpoint or client, check for contract definitions in these locations (in order of precedence):

1. **`api-contract/`** — This repo is the source of truth for the contract
2. **`.contracts/`** — Synced copy from an external source repo (typically via CI)

If neither exists and you are implementing API endpoints, propose creating an `api-contract/` directory following the standard structure.

## Standard Contract Structure

```
api-contract/ (or .contracts/)
├── README.md       # Purpose, sync instructions, change process
├── version.ts      # Contract version and changelog
├── types.ts        # TypeScript interfaces for all request/response/error shapes
└── endpoints.md    # Human-readable endpoint documentation
```

## Implementation Guidelines

### When Implementing API Endpoints (Backend)

1. Read `.contracts/types.ts` (or `api-contract/types.ts`) before writing handler code
2. Import or reference the types directly — do not redefine them
3. Validate that Lambda/function request and response shapes match the contract exactly
4. If the contract is missing fields you need, document as an OPEN QUESTION — do not add fields unilaterally

### When Implementing API Clients (Extension/Frontend)

1. Read `api-contract/types.ts` before writing client code
2. Import types directly from the contract location
3. Handle all error codes defined in the contract
4. If the API behaves differently than the contract specifies, flag this as a bug

### When Proposing Contract Changes

1. **Additive changes** (new optional fields, new endpoints): Safe to propose inline
2. **Breaking changes** (removing fields, changing types): Document as OPEN QUESTION with migration notes
3. Always bump the version in `version.ts` when modifying `types.ts`
4. Note that breaking changes require coordinated releases across repos

## Contract Sync (For Consumer Repos)

If this repo consumes an external contract (indicated by `.contracts/` existing):

- The contract is synced automatically via GitHub Actions
- Check `.github/workflows/sync-contract.yml` for sync frequency
- If contract seems stale, trigger the sync workflow manually
- Do not edit files in `.contracts/` directly — they will be overwritten

## Type Validation

When a repo has `.contracts/` synced from an external source:

- Include a test that imports `.contracts/types.ts` and validates handler I/O shapes
- CI should fail if types don't match
- This catches contract drift before it causes runtime errors
