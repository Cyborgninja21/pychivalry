---
name: memory-contract
description: Unified Memory Contract for MCP Knowledge Graph integration. Defines when and how to retrieve and store structured knowledge. Load at session start - memory is core to agent reasoning, not optional.
---

# Unified Memory Contract

Using MCP Knowledge Graph tools (`memory/*`) is **mandatory** for agents with graph access.

---

## Core Principle

Memory is not a formality—it is part of your reasoning. Treat retrieval like asking a colleague who has perfect recall of this workspace. Treat storage like leaving a note for your future self who has total amnesia.

**The cost/benefit rule:** Retrieval is cheap (sub-second, a few hundred tokens). Proceeding without context when it exists is expensive (wrong answers, repeated mistakes, user frustration). When in doubt, retrieve.

---

## Knowledge Graph Data Model

The graph stores three primitives:

- **Entities** — Named nodes with a type and a list of observations: `{name, entityType, observations[]}`
- **Relations** — Directed edges between entities: `{from, to, relationType}`
- **Observations** — Atomic facts attached to entities (plain strings in the `observations` array)

**Entity naming is the primary key.** Two entities with the same `name` are the same entity. Use consistent, canonical names.

---

## When to Retrieve

Retrieve at **decision points**, not just at turn start. In a typical multi-step task, expect 2–5 retrievals.

**Retrieve when you:**

- Are about to make an assumption → check if it was already decided
- Don't recognize a term, file, or pattern → check if it was discussed
- Are choosing between options → check if one was tried or rejected
- Feel uncertain ("I think...", "Probably...") → that's a retrieval signal
- Are about to do work → check if similar work already exists
- Hit a constraint or error you don't understand → check for prior context

**If no results:** Broaden to concept-level and retry once. If still empty, proceed and note the gap.

---

## How to Retrieve

Use `search_nodes` for discovery and `open_nodes` for precise lookups.

### search_nodes — Discovery (fuzzy)

Case-insensitive substring match across entity names, types, and observations. Use when you're exploring.

| Weak query | Strong query |
|------------|--------------|
| "project" | "authentication strategy" |
| "stuff" | "Redis caching decision" |
| "config" | "rate limiting middleware" |

**Heuristic:** State the *question you're trying to answer*, not the *category of information* you want.

**Gotcha:** `search_nodes` only returns relations where **both** endpoints are in the result set. To see all relations for a single entity, use `open_nodes` with that entity's name plus its known neighbors.

### open_nodes — Precise lookup

Retrieves specific entities by exact name. Use when you know exactly what you're looking for.

```json
// Retrieve specific entities by name
#memory/open_nodes {
  "names": ["auth-service", "rate-limiter"]
}
```

### read_graph — Full scan (use sparingly)

Returns the entire knowledge graph. Only use for maintenance tasks or when you need a global view. For large graphs, prefer targeted searches.

---

## When to Store

Store at **value boundaries**—when you've created something worth preserving. Ask: "Would I be frustrated to lose this context?"

**Store when you:**

- Complete a non-trivial task or subtask
- Make a decision that narrows future options
- Discover a constraint, dead end, or "gotcha"
- Learn a user preference or workspace convention
- Reach a natural pause (topic switch, waiting for user)
- Have done meaningful work, even if incomplete

**Do not store:**

- Trivial acknowledgments or yes/no exchanges
- Duplicate information already in the graph
- Raw outputs without reasoning (store the *why*, not just the *what*)

---

## How to Store

Storage is a three-step process: **create entities → add observations → create relations.**

### Step 1: Create entities

```json
#memory/create_entities {
  "entities": [
    {
      "name": "rate-limiter",
      "entityType": "Component",
      "observations": [
        "Express middleware in src/middleware/rateLimit.ts",
        "Uses sliding window algorithm with Redis backend",
        "Added in mission 2025-03-15 to address API abuse"
      ]
    }
  ]
}
```

**Rules:**
- **name** — Use stable, canonical identifiers. Lowercase with hyphens preferred. The same concept must always use the same name.
- **entityType** — Use standard types: `Service`, `Component`, `Decision`, `Pattern`, `Problem`, `Solution`, `Environment`, `Infrastructure`, `Configuration`, `Tool`
- **observations** — Each observation is one atomic fact. Be concrete: file paths, versions, dates. Never vague.
- **Deduplication** — If an entity with that `name` already exists, it is silently skipped. Use `add_observations` to add new facts to existing entities.

### Step 2: Add observations to existing entities

```json
#memory/add_observations {
  "observations": [
    {
      "entityName": "rate-limiter",
      "contents": [
        "Default: 100 requests per 15-minute window",
        "Configurable via RATE_LIMIT_MAX env var"
      ]
    }
  ]
}
```

**Critical gotcha:** `add_observations` **throws an error** if the entity does not exist. Always `create_entities` first. If you're unsure whether the entity exists, create it — duplicates are silently skipped.

### Step 3: Create relations

```json
#memory/create_relations {
  "relations": [
    {
      "from": "rate-limiter",
      "to": "redis-service",
      "relationType": "depends_on"
    },
    {
      "from": "rate-limiter",
      "to": "api-abuse-problem",
      "relationType": "resolves"
    }
  ]
}
```

**Standard relation types:** `depends_on`, `deployed_to`, `implements`, `replaces`, `causes`, `resolves`, `tested_by`, `documented_in`, `related_to`, `constrained_by`

**Gotcha:** Relations are not validated against entities. You can create a relation referencing an entity that doesn't exist. Always create entities first.

---

## Storage Format Guidelines

- **Use stable identifiers** when known: plan IDs (e.g., "Plan 070"), analysis IDs, workspace-relative file paths, semver versions. If you don't know an identifier, omit it—don't invent.
- **Prefer standard entity types** where applicable: `Decision`, `Problem`, `Solution`, `Plan`, `Analysis`, `Component`, `Service`, `Configuration`.
- **Name things consistently.** Use the same canonical name for an artifact across all turns—don't rename mid-conversation.
- **Be concrete.** Mention specific file paths, setting names, and versions rather than vague references.
- **Include provenance.** When cataloging knowledge from a specific source, note it: "Per Data's analysis (mission 2025-03-15): ..."

**Fallback minimum:** If you haven't stored in 5 turns, store now regardless.

**Always end storage with:** "Saved to knowledge graph."

---

## Anti-Patterns

| Anti-pattern | Why it's harmful |
|--------------|------------------|
| Retrieve once at turn start, never again | Misses context that becomes relevant mid-task |
| Store only at conversation end | Loses intermediate reasoning; if session crashes, everything is gone |
| Generic queries ("What should I know?") | Returns noise; specificity gets signal |
| Skip retrieval to "save time" | False economy—retrieval is fast; redoing work is slow |
| Store every turn mechanically | Pollutes graph with low-value entities |
| Treat memory as write-only | If you never retrieve, you're journaling, not learning |
| Create duplicate entities with different names | Fragments knowledge; "auth-service" and "authentication-service" must be the same entity |
| Add observations without checking entity exists | `add_observations` throws if entity is missing — always `create_entities` first |

---

## Commitments

1. **Retrieve before reasoning.** Don't generate options, make recommendations, or start implementation without checking for prior context.
2. **Retrieve when uncertain.** Hedging language ("I think", "Probably", "Unless") is a retrieval trigger.
3. **Store at value boundaries.** Decisions, findings, constraints, progress—store before moving on.
4. **Acknowledge memory.** When retrieved memory influences your response, say so ("Based on the knowledge graph..." or "The graph shows...").
5. **Fail loudly.** If memory tools fail, announce no-memory mode immediately.
6. **Prefer the user.** If graph knowledge conflicts with explicit user instructions, follow the user and note the shift.

---

## No-Memory Fallback

If `memory/*` tool calls fail or are rejected:

1. **Announce immediately:** "Knowledge graph is unavailable; operating in no-memory mode."
2. **Compensate:** Record decisions in output documents with extra detail.
3. **Remind at end:** "Memory was unavailable. Knowledge from this session was not persisted."

---

## Quick Reference

| Operation | Tool | Key parameter |
|-----------|------|---------------|
| Search by keyword | `search_nodes` | `query: string` |
| Get specific entities | `open_nodes` | `names: string[]` |
| Read entire graph | `read_graph` | `{}` |
| Create new entities | `create_entities` | `entities: [{name, entityType, observations[]}]` |
| Add facts to existing entity | `add_observations` | `observations: [{entityName, contents[]}]` |
| Connect entities | `create_relations` | `relations: [{from, to, relationType}]` |
| Remove entities (cascading) | `delete_entities` | `entityNames: string[]` |
| Remove specific facts | `delete_observations` | `deletions: [{entityName, observations[]}]` |
| Remove specific relations | `delete_relations` | `relations: [{from, to, relationType}]` |
