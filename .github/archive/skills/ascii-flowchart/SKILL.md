---
name: ascii-flowchart
description: >-
  Produce ASCII flow charts using Unicode box-drawing characters in a specific
  visual style with double-line title banners, single-line phase boxes, numbered
  steps, nested sub-boxes, decision branches, and a key/legend footer. Use when
  the user asks for a flowchart, diagram, flow diagram, order of operations,
  process chart, decision tree, state machine visualization, pipeline diagram,
  or any visual representation of a workflow, pipeline, module, or multi-phase
  process. Also use when asked to "chart this," "diagram this," "map out the
  flow," or "show me how X works visually."
---

# ASCII Flowchart

Render structured flow charts in plain text using Unicode box-drawing characters. Read the source code or documentation before charting — every step must map to a real operation.

## Character Palette

| Char | Name | Use |
|------|------|-----|
| `╔═╗╚═╝║` | Double-line box | Title banner (top-level container) |
| `┌─┐└─┘│` | Single-line box | Phase containers, step boxes, nested sub-boxes |
| `▼` | Down arrow | Downward flow between phases |
| `─` | Horizontal line | Box borders, connectors |
| `│` | Vertical line | Box sides, vertical flow connectors |
| `┬` | T-down | Splits flow downward from a box bottom border |
| `├` `┤` `┼` | Branch connectors | Horizontal branching, convergence |
| `═` | Double horizontal | Title banner borders, key/legend separator |
| `──→` | Arrow | Side annotations (handlers, error paths) |

## Structural Patterns

### Title Banner

Double-line box at the top. Contains subject name (line 1) and subtitle (line 2). Match width to phase boxes (~70–76 chars).

```
╔══════════════════════════════════════════════════════════════════════╗
║                    Subject Name Here                                ║
║                   Subtitle or Context                               ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Phase Box

Single-line box with label embedded in top border: `┌─── Phase N: NAME ───...─┐`. Right-pad content so the right `│` aligns with all other boxes.

```
┌─── Phase 1: DISCOVERY ─────────────────────────────────────────────┐
│  1.1  Query system: does resource exist?                             │
│  1.2  Set variable: _resource_exists = true | false                  │
│  1.3  Report current state                                           │
└──────────────────────────────────┬───────────────────────────────────┘
```

### Flow Connectors

Centered `│` and `▼` between phases. Place `┬` in the bottom border of the source box, vertically aligned with the `▼` entering the next box.

```
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
┌─── Phase 2: VALIDATION ─────────────────────────────────────────────┐
```

### Nested Sub-boxes

For mutually exclusive paths or grouped operations inside a phase. Indent 2 spaces from the outer `│`:

```
│  ┌─ Config Type A (mutually exclusive) ───────────────────────────┐  │
│  │  Path A: list[] defined → build from list                      │  │
│  │  Path B: list[] empty   → build from flat vars                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
```

### Decision Branches

Horizontal split into columns with labels above each branch box:

```
│         ┌──────────────┬───────────────────┬──────────────┐          │
│         ▼              ▼                   ▼              │          │
│   condition=A     not exists          exists         check mode      │
│         │              │                   │              │          │
│         ▼              ▼                   │              ▼          │
│  ┌────────────┐ ┌──────────────┐           │    ┌──────────────┐    │
│  │ 4.1 ACTION │ │ 4.2 CREATE   │           │    │ 4.5 REPORT   │    │
│  │ Description│ │ Description  │           │    │ Description  │    │
│  └─────┬──────┘ └──────┬───────┘           │    └──────────────┘    │
```

### Convergence

Branches rejoin via aligned `┬` or `└───┬───┘` leading to the next sequential step.

### Side Annotations

Error handling, catch blocks, callbacks — annotate with `──→` from the triggering step:

```
│  │ 4.4 SET STATE    │──emit──→ Callback: description     │
│  │ action           │         (catch: fallback)          │
```

### Key / Legend

Double-line separator at the bottom. Cross-cutting concerns, timeouts, notes. Use `│` to separate items:

```
═══════════════════════════════════════════════════════════════════════
 KEY: Note one                    │ Note two
      Note three                  │ Note four
═══════════════════════════════════════════════════════════════════════
```

### Completion Box

Final single-line box after cleanup with a summary statement:

```
┌─── COMPLETION ───────────────────────────────────────────────────────┐
│  Display completion banner with final state                          │
└──────────────────────────────────────────────────────────────────────┘
```

## Sizing and Alignment

- **Target width**: 70–76 characters (fits terminals and editors)
- **All boxes share the same outer width** within a chart
- Phase labels: left-aligned after `┌───`
- Step numbers: 2-space indent from `│`
- Step descriptions: aligned in a column after the number
- Right `│` borders: vertically aligned across all boxes
- Flow connectors (`│`, `▼`): centered between boxes

## Step Numbering

- Format: `PhaseNumber.StepNumber` — `1.1`, `2.3`, `4.12`
- Left-pad single-digit step numbers so columns align: `2.1 ` through `2.12`
- One step per line, brief imperative description
- Parenthetical conditions: `(if feature enabled)`, `(loop, if multi-item)`

## Content Rules

1. **Read the source first** — never guess at operations or invent steps
2. **Every step maps to a real task** — no invented summaries or placeholder steps
3. **Show decision points** with labeled conditions
4. **Show error handling** (catch blocks, callbacks) as side annotations with `──→`
5. **Mark conditional steps** with `(if ...)` or `(when ...)`
6. **Use monospace-style variable names**: `_var_name = true | false`

## When NOT to Use

- **< 5 linear steps** — use a numbered list
- **Data schemas / entity relationships** — use tables
- **Network topology** — suggest a diagramming tool (draw.io, Mermaid)
