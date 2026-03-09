# CK3 Mod Building Agents

This directory contains specialized VS Code Copilot agents for building Crusader Kings 3 mods. These agents leverage pychivalry's validation infrastructure to produce high-quality, validated mod content.

## Quick Start

1. **Main Entry Point**: Use `@ck3-mod-orchestrator` for complex tasks
2. **Direct Access**: Use specific agents like `@ck3-event-builder` for focused tasks
3. **Validation**: Always run `@ck3-validator` before finalizing

## Agent Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   ck3-mod-orchestrator                        │
│            (Routes requests to specialized agents)            │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
│ Content       │   │ Structure     │   │ Support           │
│ Builders      │   │ Builders      │   │ Agents            │
├───────────────┤   ├───────────────┤   ├───────────────────┤
│ event-builder │   │ story-cycle   │   │ localization-mgr  │
│ decision-bldr │   │ onaction-bldr │   │ scope-timing      │
│ interaction   │   │ variable-dsgn │   │ validator         │
│ activity-bldr │   │ trait-designer│   │                   │
└───────────────┘   └───────────────┘   └───────────────────┘
```

## Available Agents

### Orchestrator

| Agent | File | Description |
|-------|------|-------------|
| **ck3-mod-orchestrator** | `ck3-mod-orchestrator.agent.md` | Main coordinator |

### Content Builders (User-Invokable)

| Agent | File | Use Case |
|-------|------|----------|
| **ck3-event-builder** | `ck3-event-builder.agent.md` | Events, options, portraits |
| **ck3-decision-builder** | `ck3-decision-builder.agent.md` | Player decisions |
| **ck3-interaction-builder** | `ck3-interaction-builder.agent.md` | Character interactions |
| **ck3-activity-builder** | `ck3-activity-builder.agent.md` | Activities (hunts, feasts) |
| **ck3-trait-designer** | `ck3-trait-designer.agent.md` | Character traits |
| **ck3-story-cycle-builder** | `ck3-story-cycle-builder.agent.md` | Narrative chains |
| **ck3-onaction-builder** | `ck3-onaction-builder.agent.md` | Game event hooks |
| **ck3-variable-designer** | `ck3-variable-designer.agent.md` | Variables, script values |

### Support Agents (SubAgent-Only)

| Agent | File | Use Case |
|-------|------|----------|
| **ck3-localization-manager** | `ck3-localization-manager.agent.md` | Text formatting |
| **ck3-scope-timing** | `ck3-scope-timing.agent.md` | Golden Rule validation |
| **ck3-validator** | `ck3-validator.agent.md` | Comprehensive validation |

## Usage Examples

### Creating a Simple Event
```
@ck3-event-builder Create an event where a character finds a mysterious letter
```

### Creating a Complex Feature
```
@ck3-mod-orchestrator Create a rebellion storyline where a vassal plots
against their liege over 5 events
```

### Validating Existing Code
```
@ck3-validator Validate this event file for issues
```

## The Golden Rule

All agents enforce CK3's critical timing rule:

> **Scopes created in `immediate` are NOT available in `trigger` or `desc` blocks.**

Evaluation order: `trigger` → `desc` → `immediate` → `option effects`

## File Format

Agent files use `.agent.md` extension with YAML frontmatter at the very top:

```yaml
---
name: agent-name
description: Brief description
user-invokable: true
tools: ['agent', 'codebase', 'search', 'editFiles']
agents: ['subagent1', 'subagent2']
---

# Agent Title

Agent instructions here...
```

### Key Properties

- **name**: Agent identifier
- **description**: Shown as placeholder text
- **user-invokable**: `true` = visible in agents dropdown, `false` = subagent only
- **tools**: Available VS Code tools
- **agents**: Allowed subagents (`*` for all, `[]` for none)

## Integration with pychivalry

| pychivalry Module | Agent Usage |
|-------------------|-------------|
| `diagnostics.ts` | ck3-validator uses 6-phase pipeline |
| `scopes.ts` | ck3-scope-timing validates chains |
| `scope-timing.ts` | ck3-scope-timing enforces Golden Rule |
| `events.ts` | ck3-event-builder follows schema |
| `localization.ts` | ck3-localization-manager uses functions |

## Resources

- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding)
- [VS Code Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [pychivalry Documentation](../../Documentation/)
