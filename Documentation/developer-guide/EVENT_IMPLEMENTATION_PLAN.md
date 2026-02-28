# CK3 Event System - Full Implementation Plan

**Source Specification:** `pdx-parser-re/spec/events/EVENT_TYPES.md`
**Target:** pychivalry language server

---

## Executive Summary

This plan covers 4 phases of implementation to fully support CK3 event validation:

| Phase | Description | Priority | Effort | Files Changed |
|-------|-------------|----------|--------|---------------|
| 1 | Add Missing Event Types | HIGH | Low | 3 files |
| 2 | File Location Validation | HIGH | Medium | 4 files |
| 3 | Scope Context Validation | MEDIUM | Medium | 2 files |
| 4 | Enhanced Hover Documentation | LOW | Low | 2 files |

---

## Gap Analysis

### Current vs Required Event Types

| Event Type | Binary Spec | pychivalry | Action |
|------------|-------------|------------|--------|
| `character_event` | ✅ | ✅ | None |
| `letter_event` | ✅ | ✅ | None |
| `court_event` | ✅ | ✅ | None |
| `duel_event` | ✅ | ✅ | None |
| `activity_event` | ✅ | ❌ | **Add** |
| `fullscreen_event` | ✅ | ❌ | **Add** |
| `feast_event` | ⚠️ legacy | ✅ | Keep for compat |
| `story_cycle` | ✅ | ✅ | None |

### Critical Missing Feature: File Location Validation

CK3 **silently ignores** script files placed in wrong directories. Events MUST be in `events/` folder. Currently no validation exists for this.

---

# PHASE 1: Add Missing Event Types

**Priority:** HIGH  
**Effort:** Low (30 min)  
**Files:**
- `vscode-extension/src/server/ck3/validation/events.ts`
- `data/schemas/events.yaml`

## Edit 1.1: Update EVENT_TYPES Set

**File:** `vscode-extension/src/server/ck3/validation/events.ts`  
**Line:** ~37-44

**Current Code:**
```typescript
export const EVENT_TYPES = new Set([
    'character_event',
    'letter_event',
    'court_event',
    'duel_event',
    'feast_event',
    'story_cycle',
]);
```

**New Code:**
```typescript
export const EVENT_TYPES = new Set([
    'character_event',
    'letter_event',
    'court_event',
    'duel_event',
    'activity_event',
    'fullscreen_event',
    'feast_event',  // Legacy/alias for activity feast events
    'story_cycle',
]);
```

## Edit 1.2: Update REQUIRED_FIELDS Map

**File:** `vscode-extension/src/server/ck3/validation/events.ts`  
**Line:** ~56-62

**Current Code:**
```typescript
export const REQUIRED_FIELDS: Map<string, Set<string>> = new Map([
    ['character_event', new Set(['type', 'title', 'desc'])],
    ['letter_event', new Set(['type', 'title', 'desc', 'sender'])],
    ['court_event', new Set(['type', 'title', 'desc'])],
    ['duel_event', new Set(['type', 'title', 'desc'])],
    ['feast_event', new Set(['type', 'title', 'desc'])],
    ['story_cycle', new Set(['type', 'title', 'desc'])],
]);
```

**New Code:**
```typescript
export const REQUIRED_FIELDS: Map<string, Set<string>> = new Map([
    ['character_event', new Set(['type', 'title', 'desc'])],
    ['letter_event', new Set(['type', 'title', 'desc', 'sender'])],
    ['court_event', new Set(['type', 'title', 'desc'])],
    ['duel_event', new Set(['type', 'title', 'desc'])],
    ['activity_event', new Set(['type', 'title', 'desc'])],
    ['fullscreen_event', new Set(['type', 'title', 'desc'])],
    ['feast_event', new Set(['type', 'title', 'desc'])],
    ['story_cycle', new Set(['type', 'title', 'desc'])],
]);
```

## Edit 1.3: Update Schema Constants

**File:** `data/schemas/events.yaml`  
**Line:** ~29-35

**Current Code:**
```yaml
constants:
  event_types:
    - character_event
    - letter_event
    - court_event
    - duel_event
    - feast_event
    - story_cycle
```

**New Code:**
```yaml
constants:
  event_types:
    - character_event
    - letter_event
    - court_event
    - duel_event
    - activity_event
    - fullscreen_event
    - feast_event
    - story_cycle
```

## Edit 1.4: Update getEventTypeDescription()

**File:** `vscode-extension/src/server/ck3/validation/events.ts`  
**Line:** ~225-237

**Current Code:**
```typescript
export function getEventTypeDescription(eventType: string): string {
    const descriptions: Record<string, string> = {
        character_event: 'Standard event with character portrait and options',
        letter_event: 'Event presented as a letter with parchment background',
        court_event: 'Event with court scene background and multiple characters',
        duel_event: 'Special event for combat/duel interactions',
        feast_event: 'Event during feast activities with feast-specific theming',
        story_cycle: 'Long-running event chain with persistent state across events',
    };
    return descriptions[eventType] || 'Unknown event type';
}
```

**New Code:**
```typescript
export function getEventTypeDescription(eventType: string): string {
    const descriptions: Record<string, string> = {
        character_event: 'Standard event with character portrait. The default and most common event type, scoped to a character.',
        letter_event: 'Letter-style events displayed as messages/letters. Different visual presentation with parchment background. Requires sender field.',
        court_event: 'Royal Court DLC events displayed in the court scene. Requires ruler with royal court.',
        duel_event: 'Events for duel sequences between characters. Part of the combat/duel system.',
        activity_event: 'Events during activities (feasts, hunts, pilgrimages). Shown within the activity window interface.',
        fullscreen_event: 'Full-screen events for major story moments. Takes over entire screen for dramatic effect.',
        feast_event: 'Feast activity events (legacy alias for activity_event in feast context).',
        story_cycle: 'Multi-event story arc chains with persistent state across events.',
    };
    return descriptions[eventType] || 'Unknown event type';
}
```

## Phase 1 Verification

After edits, run:
```bash
npm run compile
npm run test
```

Expected: No compile errors, all tests pass.

---

# PHASE 2: File Location Validation

**Priority:** HIGH  
**Effort:** Medium (2 hours)  
**Files:**
- NEW: `vscode-extension/src/server/ck3/validation/path-validation.ts`
- `vscode-extension/src/server/ck3/validation/diagnostics.ts`
- `data/diagnostics.yaml`

## Why This Matters

CK3 silently ignores files in wrong directories:
- Events in `common/` → **Not loaded**
- Decisions in `events/` → **Not loaded**
- Traits in `gfx/` → **Not loaded**

Modders waste hours debugging issues that are simply wrong file locations.

## File 2.1: Create path-validation.ts

**New File:** `vscode-extension/src/server/ck3/validation/path-validation.ts`

```typescript
/**
 * Path Validation - Validates CK3 scripts are in correct directories
 * 
 * CK3 requires specific file types to be in specific directories.
 * Files in wrong locations are silently ignored by the game engine.
 * 
 * DIAGNOSTIC CODES:
 *     PATH-001: Content in wrong directory (error)
 *     PATH-002: File in non-scriptable directory (warning)
 *     PATH-003: Suggested subdirectory organization (hint)
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';

/**
 * Content type to required directory patterns
 * Patterns use forward slashes, matched case-insensitively
 */
const CONTENT_DIRECTORY_RULES: Map<string, {
    required: string[];
    description: string;
    example: string;
}> = new Map([
    ['event', {
        required: ['events/', 'events\\\\'],
        description: 'Event files must be in the events/ folder',
        example: 'mod/events/my_events.txt',
    }],
    ['decision', {
        required: ['common/decisions/', 'common\\\\decisions\\\\'],
        description: 'Decision files must be in common/decisions/',
        example: 'mod/common/decisions/my_decisions.txt',
    }],
    ['character_interaction', {
        required: ['common/character_interactions/', 'common\\\\character_interactions\\\\'],
        description: 'Character interaction files must be in common/character_interactions/',
        example: 'mod/common/character_interactions/my_interactions.txt',
    }],
    ['scripted_trigger', {
        required: ['common/scripted_triggers/', 'common\\\\scripted_triggers\\\\'],
        description: 'Scripted triggers must be in common/scripted_triggers/',
        example: 'mod/common/scripted_triggers/my_triggers.txt',
    }],
    ['scripted_effect', {
        required: ['common/scripted_effects/', 'common\\\\scripted_effects\\\\'],
        description: 'Scripted effects must be in common/scripted_effects/',
        example: 'mod/common/scripted_effects/my_effects.txt',
    }],
    ['on_action', {
        required: ['common/on_actions/', 'common\\\\on_actions\\\\'],
        description: 'On-action files must be in common/on_actions/',
        example: 'mod/common/on_actions/my_on_actions.txt',
    }],
    ['story_cycle', {
        required: ['common/story_cycles/', 'common\\\\story_cycles\\\\'],
        description: 'Story cycle files must be in common/story_cycles/',
        example: 'mod/common/story_cycles/my_story.txt',
    }],
    ['scheme_type', {
        required: ['common/schemes/', 'common\\\\schemes\\\\'],
        description: 'Scheme files must be in common/schemes/',
        example: 'mod/common/schemes/my_scheme.txt',
    }],
    ['trait', {
        required: ['common/traits/', 'common\\\\traits\\\\'],
        description: 'Trait files must be in common/traits/',
        example: 'mod/common/traits/my_traits.txt',
    }],
    ['activity_type', {
        required: ['common/activities/', 'common\\\\activities\\\\'],
        description: 'Activity files must be in common/activities/',
        example: 'mod/common/activities/my_activity.txt',
    }],
]);

export interface PathValidationResult {
    isValid: boolean;
    expectedPath?: string;
    diagnostics: Diagnostic[];
}

/**
 * Validate that a file is in the correct directory for its detected content type
 */
export function validateFilePath(
    filePath: string,
    detectedContentType: string | null,
    errorRange?: Range
): PathValidationResult {
    if (!detectedContentType) {
        return { isValid: true, diagnostics: [] };
    }

    const rules = CONTENT_DIRECTORY_RULES.get(detectedContentType);
    if (!rules) {
        // No rules for this content type
        return { isValid: true, diagnostics: [] };
    }

    const normalizedPath = filePath.replace(/\\\\/g, '/').toLowerCase();

    // Check if file is in any of the required directories
    const isInCorrectDir = rules.required.some(pattern => {
        const normalizedPattern = pattern.replace(/\\\\/g, '/').toLowerCase();
        return normalizedPath.includes(normalizedPattern);
    });

    if (!isInCorrectDir) {
        const range = errorRange || {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 100 },
        };

        return {
            isValid: false,
            expectedPath: rules.required[0],
            diagnostics: [{
                severity: DiagnosticSeverity.Error,
                range,
                message: `${rules.description}. The game will not load this file from its current location.`,
                code: 'PATH-001',
                source: 'ck3-path',
                data: {
                    contentType: detectedContentType,
                    expectedPath: rules.required[0],
                    example: rules.example,
                },
            }],
        };
    }

    return { isValid: true, diagnostics: [] };
}

/**
 * Validate specifically that event content is in events/ directory
 */
export function validateEventLocation(filePath: string, errorRange?: Range): PathValidationResult {
    return validateFilePath(filePath, 'event', errorRange);
}

/**
 * Get expected directory for a content type
 */
export function getExpectedDirectory(contentType: string): string | null {
    const rules = CONTENT_DIRECTORY_RULES.get(contentType);
    return rules?.required[0] || null;
}

/**
 * Get all content types that have path requirements
 */
export function getContentTypesWithPathRequirements(): string[] {
    return Array.from(CONTENT_DIRECTORY_RULES.keys());
}
```

## Edit 2.2: Add Config Option to DiagnosticsEngine

**File:** `vscode-extension/src/server/ck3/validation/diagnostics.ts`
**Line:** ~70-90 (DiagnosticConfig interface)

**Add to DiagnosticConfig interface:**
```typescript
    enablePathValidation: boolean;
```

**Add to DEFAULT_CONFIG:**
```typescript
    enablePathValidation: true,
```

## Edit 2.3: Integrate Path Validation into collectDiagnostics

**File:** `vscode-extension/src/server/ck3/validation/diagnostics.ts`

**Add import at top:**
```typescript
import { validateFilePath } from './path-validation';
import { DirectoryRegistry } from '../../data/directory-registry';
```

**Add to collectDiagnostics() method, after Phase 1 (parse errors):**
```typescript
        // Phase 1.5: Path validation (check file is in correct directory)
        if (this.config.enablePathValidation) {
            const directoryRegistry = DirectoryRegistry.getInstance();
            const contentType = directoryRegistry.getContentType(document.uri);
            
            if (contentType) {
                const pathResult = validateFilePath(document.uri, contentType);
                diagnostics.push(...pathResult.diagnostics);
            }
        }
```

## Edit 2.4: Add Diagnostic Codes to diagnostics.yaml

**File:** `data/diagnostics.yaml`

**Add new section after existing categories:**
```yaml
  path:
    prefix: "PATH"
    description: "File location validation"
```

**Add new diagnostics:**
```yaml
  # ============== Path Validation (PATH-0xx) ==============
  PATH-001:
    severity: error
    category: path
    message: "File is in wrong directory for its content type. {details}"
    fix: "Move file to the correct directory: {expected_path}"
    
  PATH-002:
    severity: warning
    category: path
    message: "File is in a non-scriptable directory and will be ignored by the game"
    
  PATH-003:
    severity: hint
    category: path
    message: "Consider organizing this file in a subdirectory: {suggested_path}"
```

## Phase 2 Verification

1. Create test event file in wrong location:
   ```
   mod/common/test.txt
   ```
   With content:
   ```
   my_test.0001 = {
       type = character_event
       title = test
       desc = test
   }
   ```

2. Expected: PATH-001 error: "Event files must be in the events/ folder."

---

# PHASE 3: Scope Context Validation

**Priority:** MEDIUM  
**Effort:** Medium (1.5 hours)  
**Files:**
- `vscode-extension/src/server/ck3/validation/events.ts`
- `vscode-extension/src/server/ck3/validation/diagnostics.ts`

## Why This Matters

Different event types require different scope contexts:
- `court_event` must fire on a ruler with a royal court
- `activity_event` must fire within an active activity
- `duel_event` must fire during a duel

Currently no validation warns modders when they fire events in wrong contexts.

## Edit 3.1: Add Scope Requirements Map

**File:** `vscode-extension/src/server/ck3/validation/events.ts`

**Add after REQUIRED_FIELDS:**
```typescript
/**
 * Required scope context by event type
 * Defines what scope type each event type expects when fired
 */
export const EVENT_SCOPE_REQUIREMENTS: Map<string, {
    scope: string;
    description: string;
    additionalRequirements?: string[];
}> = new Map([
    ['character_event', {
        scope: 'character',
        description: 'Must fire on a character scope',
    }],
    ['letter_event', {
        scope: 'character',
        description: 'Must fire on a character scope (the recipient)',
    }],
    ['court_event', {
        scope: 'character',
        description: 'Must fire on a ruler with a royal court',
        additionalRequirements: ['Character must have has_royal_court = yes'],
    }],
    ['duel_event', {
        scope: 'character',
        description: 'Must fire on a character engaged in a duel',
        additionalRequirements: ['Character must be in active duel context'],
    }],
    ['activity_event', {
        scope: 'character',
        description: 'Must fire within an active activity',
        additionalRequirements: ['Character must be activity host or participant'],
    }],
    ['fullscreen_event', {
        scope: 'character',
        description: 'Must fire on a character scope',
    }],
    ['feast_event', {
        scope: 'character',
        description: 'Must fire within a feast activity',
        additionalRequirements: ['Character must be in active feast'],
    }],
    ['story_cycle', {
        scope: 'character',
        description: 'Must fire on a character scope',
    }],
]);

/**
 * Get scope requirements for an event type
 */
export function getEventScopeRequirements(eventType: string): {
    scope: string;
    description: string;
    additionalRequirements?: string[];
} | null {
    return EVENT_SCOPE_REQUIREMENTS.get(eventType) || null;
}
```

## Edit 3.2: Add Validation Function for Scope Context

**File:** `vscode-extension/src/server/ck3/validation/events.ts`

**Add new function:**
```typescript
/**
 * Validate that event is fired in appropriate scope context
 * Returns diagnostic if scope context is definitely wrong
 */
export function validateEventScopeContext(
    eventType: string,
    currentScope: string | null
): { isValid: boolean; warning?: string } {
    const requirements = EVENT_SCOPE_REQUIREMENTS.get(eventType);
    if (!requirements || !currentScope) {
        return { isValid: true };
    }

    // Basic scope type check
    if (currentScope !== requirements.scope && currentScope !== 'any') {
        return {
            isValid: false,
            warning: `${eventType} expects ${requirements.scope} scope, but current scope is ${currentScope}`,
        };
    }

    return { isValid: true };
}
```

## Edit 3.3: Add Diagnostic Code

**File:** `data/diagnostics.yaml`

**Add to EVENT section:**
```yaml
  EVENT-008:
    severity: warning
    category: events
    message: "Event type '{type}' may not work correctly in this scope context. {details}"
    fix: "{fix_suggestion}"
```

## Phase 3 Verification

This validation primarily benefits hover documentation and future linting for `trigger_event` calls.

---

# PHASE 4: Enhanced Hover Documentation

**Priority:** LOW  
**Effort:** Low (30 min)  
**Files:**
- `vscode-extension/src/server/schema/hover.ts`
- `data/schemas/events.yaml`

## Edit 4.1: Add Context Hints to Schema

**File:** `data/schemas/events.yaml`

**Add new section after constants:**
```yaml
# Event type metadata for hover documentation
event_type_metadata:
  character_event:
    description: "Standard event with character portrait"
    scope: "character"
    ui: "Portrait window with up to 5 positions"
    
  letter_event:
    description: "Letter-style event displayed as parchment"
    scope: "character"
    ui: "Letter/scroll visual presentation"
    required_fields:
      - sender
    notes:
      - "Different visual style from character_event"
      - "May have timeout behavior"
      
  court_event:
    description: "Royal Court DLC event in court scene"
    scope: "character (ruler with court)"
    ui: "Court scene background"
    effects:
      - add_court_event
      - remove_court_event
      - add_pending_court_event
    triggers:
      - has_open_court_event
      - has_pending_court_events
      - has_spawned_court_events
    notes:
      - "Requires Royal Court DLC"
      - "Character must have a royal court"
      - "Events go through pending -> spawned lifecycle"
      
  activity_event:
    description: "Event during activities (feasts, hunts, etc.)"
    scope: "character (activity participant)"
    ui: "Activity window interface"
    effects:
      - add_activity_event
      - remove_activity_event
    notes:
      - "Must fire within an active activity"
      - "Shown in activity window, not standalone"
      
  fullscreen_event:
    description: "Full-screen dramatic event"
    scope: "character"
    ui: "Full-screen takeover"
    notes:
      - "For major story moments"
      - "Functionally same as character_event"
      - "UI presentation is the only difference"
      
  duel_event:
    description: "Combat duel sequence event"
    scope: "character (duelist)"
    ui: "Duel interface"
    notes:
      - "Part of the combat/duel system"
      - "Has specialized handling for combat outcomes"
      
  story_cycle:
    description: "Multi-event story arc chain"
    scope: "character"
    ui: "Standard event window"
    notes:
      - "Persistent state across events"
      - "Used for long-running narratives"
```

---

# Implementation Order

Execute phases in this order:

```
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: Add Missing Event Types                       │
│  • 4 edits across 2 files                               │
│  • ~30 minutes                                          │
│  • Immediate value: Completes event type support        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: File Location Validation                      │
│  • 1 new file + 3 edits                                 │
│  • ~2 hours                                             │
│  • HIGH value: Prevents silent failures                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: Scope Context Validation                      │
│  • 3 edits                                              │
│  • ~1.5 hours                                           │
│  • MEDIUM value: Better context awareness               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 4: Enhanced Hover Documentation                  │
│  • 1 edit                                               │
│  • ~30 minutes                                          │
│  • LOW value: UX improvement                            │
└─────────────────────────────────────────────────────────┘
```

---

# Test Cases

## Phase 1 Tests

| Test | Input | Expected |
|------|-------|----------|
| Valid activity_event | `type = activity_event` | No error |
| Valid fullscreen_event | `type = fullscreen_event` | No error |
| Invalid type | `type = unknown_event` | EVENT-001 error |

## Phase 2 Tests

| Test | File Location | Content | Expected |
|------|---------------|---------|----------|
| Event in events/ | `events/test.txt` | event block | No error |
| Event in common/ | `common/test.txt` | event block | PATH-001 error |
| Decision in common/decisions/ | `common/decisions/test.txt` | decision | No error |
| Decision in events/ | `events/test.txt` | decision | PATH-001 error |

## Phase 3 Tests

| Test | Event Type | Fire Context | Expected |
|------|------------|--------------|----------|
| character_event on character | character scope | No warning |
| court_event on non-ruler | character without court | Warning |
| activity_event outside activity | no activity context | Warning |

---

# Rollback Plan

If issues arise:

1. **Phase 1**: Revert changes to EVENT_TYPES and REQUIRED_FIELDS
2. **Phase 2**: Set `enablePathValidation: false` in config
3. **Phase 3**: Remove scope context checks (non-breaking)
4. **Phase 4**: Schema-only changes, no code impact

---

# Success Criteria

- [ ] All 8 event types recognized without errors
- [ ] PATH-001 fires when event file is in wrong directory
- [ ] No regression in existing tests
- [ ] Hover documentation shows event type details
- [ ] Compile succeeds with no TypeScript errors
