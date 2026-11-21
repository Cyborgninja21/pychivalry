# pychivalry Copilot Agents

This directory contains VS Code Copilot agents for developing the pychivalry CK3 Language Server extension. Two agent systems coexist:

1. **Development Team** — Star Trek themed agents for building/maintaining pychivalry itself (TypeScript, LSP, VS Code extension)
2. **CK3 Mod Builders** — Domain-specific agents for authoring CK3 mod content (dogfooding pychivalry's validation)

## Quick Start

- **Complex tasks**: `@picard` decomposes and delegates across specialists
- **Direct implementation**: `@riker` coordinates multi-file changes
- **Solo coding**: `@scotty` (complex) or `@rutherford` (straightforward)
- **CK3 mod content**: `@ck3-mod-orchestrator` or specific builders like `@ck3-event-builder`

## Development Team Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Captain Picard                              │
│              (Strategic command & delegation)                     │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Research    │    │ Architecture │    │  Review &    │
   │  & Planning  │    │  & Security  │    │  Quality     │
   ├─────────────┤    ├──────────────┤    ├──────────────┤
   │ Data        │    │ La Forge     │    │ Crusher      │
   │ Lore        │    │ Worf         │    │ Troi         │
   │ Sisko       │    │              │    │ Q            │
   └─────────────┘    └──────────────┘    └──────────────┘
          │
          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                     Commander Riker                          │
   │          (Implementation coordination & dispatch)             │
   └─────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
   │ Engineers  │  │ Bulk Ops  │  │ Ops &     │  │ Support   │
   ├───────────┤  ├───────────┤  │ Infra     │  ├───────────┤
   │ Scotty    │  │ Seven     │  ├───────────┤  │ Guinan    │
   │ Rutherford│  │ Hugh      │  │ O'Brien   │  │ Tuvok     │
   │ Kirk      │  │           │  │ Mariner   │  │ Dax       │
   │ Wesley    │  │           │  │ Boimler   │  │ Barclay   │
   │ Torres    │  │           │  │ Tendi     │  │ Janeway   │
   └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

## Development Team Agents

### Command

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Captain Picard** | Strategic command — decomposes missions, delegates to specialists | Yes |
| **Commander Riker** | Implementation coordinator — dispatches engineers in parallel | Yes |

### Research & Planning

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Lt. Cmdr. Data** | Research, codebase analysis, implementation plans | Yes |
| **Lt. Cmdr. Lore** | Parallel research (works alongside Data) | Yes |
| **Captain Sisko** | Project management, sprint planning, backlog tracking | Yes |

### Architecture & Security

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Lt. Cmdr. La Forge** | Architecture, systems design, technical coherence | Yes |
| **Lt. Worf** | Security auditing, vulnerability analysis, compliance | Yes |

### Review & Quality

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Dr. Crusher** | Code review, quality diagnosis, test coverage validation | Yes |
| **Counselor Troi** | Value assessment, outcome validation, lessons learned | Yes |
| **Q** | Adversarial review, stress-testing, edge case discovery | Yes |

### Engineering

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Montgomery Scott** | Senior engineer — complex/architectural code | No |
| **Ensign Rutherford** | Standard engineer — straightforward implementations | No |
| **Captain Kirk** | Rapid prototyping, unconventional solutions | Yes |
| **Wesley Crusher** | Testing and test automation | No |
| **B'Elanna Torres** | Debugging — root cause analysis and fix | No |

### Bulk Operations

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Seven of Nine** | Pattern-based changes across many files | No |
| **Hugh** | Parallel bulk ops (works alongside Seven) | No |

### Operations & Infrastructure

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Chief O'Brien** | DevOps, git, CI/CD, deployment | Yes |
| **Ensign Mariner** | Linux/remote server operations | No |
| **Ensign Boimler** | Windows/local system operations | No |
| **Ensign Tendi** | Docker, service health, log analysis | No |

### Knowledge & Support

| Agent | Role | User-Invokable |
|-------|------|:-:|
| **Guinan** | Documentation and knowledge management | Yes |
| **Lt. Cmdr. Tuvok** | Knowledge graph, institutional memory | No |
| **Jadzia Dax** | Data modeling, schema design, migrations | No |
| **Lt. Barclay** | Performance profiling, benchmarks, bottleneck analysis | Yes |
| **Captain Janeway** | Optimization, resource efficiency | Yes |

## CK3 Mod Building Agents

These agents produce CK3 mod content and serve as a dogfooding testbed for pychivalry's validation features.

### Orchestrator

| Agent | Description |
|-------|-------------|
| **ck3-mod-orchestrator** | Routes mod building requests to specialized builders |

### Content Builders (User-Invokable)

| Agent | Use Case |
|-------|----------|
| **ck3-event-builder** | Events, options, portraits |
| **ck3-decision-builder** | Player decisions |
| **ck3-interaction-builder** | Character interactions |
| **ck3-activity-builder** | Activities (hunts, feasts) |
| **ck3-trait-designer** | Character traits |
| **ck3-story-cycle-builder** | Narrative chains |
| **ck3-onaction-builder** | Game event hooks |
| **ck3-variable-designer** | Variables, script values |

### Support Agents (SubAgent-Only)

| Agent | Use Case |
|-------|----------|
| **ck3-localization-manager** | Localization text formatting |
| **ck3-scope-timing** | Scope timing validation |
| **ck3-validator** | Comprehensive CK3 validation |

## File Format

Agent files use `.agent.md` with YAML frontmatter:

```yaml
---
name: agent-name
description: Brief description
tools: ['execute', 'read', 'search', 'edit', 'todo']
agents: ['subagent1', 'subagent2']
---

# Agent Title

Instructions...
```

### Key Properties

- **name**: Agent identifier (used with `@name`)
- **description**: Shown as placeholder text in chat
- **tools**: Available VS Code Copilot tools
- **agents**: Allowed subagents (`*` for all, `[]` for none)
- **handoffs**: Quick delegation buttons shown in chat UI

## Resources

- [VS Code Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [pychivalry Documentation](../../Documentation/)
