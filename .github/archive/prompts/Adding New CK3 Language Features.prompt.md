# Adding New CK3 Language Features

**Purpose:** Guide for adding support for new CK3 scripting language features to pychivalry.

**Use this when:** Adding new CK3 effects, triggers, scopes, keywords, or other game-specific language elements.

---

## Understanding CK3 Language Elements

CK3 scripting has several types of language elements:

1. **Keywords:** `if`, `else`, `trigger`, `effect`, `limit`, `namespace`
2. **Effects:** `add_trait`, `add_gold`, `trigger_event`, `save_scope_as`
3. **Triggers:** `has_trait`, `is_ruler`, `age`, `gold`
4. **Scopes:** `root`, `prev`, `liege`, `primary_title`
5. **List Iterators:** `any_vassal`, `every_courtier`, `random_realm_province`
6. **Event Types:** `character_event`, `letter_event`, `court_event`
7. **Script Values:** Formulas with `value`, `add`, `multiply`, etc.

## Adding New Keywords

### 1. Update Language Definitions

Edit `vscode-extension/src/server/ck3/language.ts`:

```typescript
// CK3 Keywords
export const KEYWORDS = {
    // Control flow
    "if": {
        description: "Conditional execution",
        example: "if = { has_trait = brave }",
        category: "control_flow"
    },
    "else": {
        description: "Alternative branch",
        example: "else = { add_trait = craven }",
        category: "control_flow"
    },
    // Add new keyword
    "new_keyword": {
        description: "Description of the keyword",
        example: "new_keyword = { ... }",
        category: "control_flow"
    },
};
```

### 2. Update Parser (if needed)

If the keyword has special syntax, update `vscode-extension/src/server/core/parser.ts`:

```typescript
parseStatement(): StatementNode | null {
    // Parse a statement
    if (this.currentToken === "new_keyword") {
        return this.parseNewKeyword();
    }
    // ... existing logic
}

### 3. Add Completion Support

In `vscode-extension/src/server/lsp/completions.ts`:

```typescript
getKeywordCompletions(): CompletionItem[] {
    // Get keyword completions
    const items: CompletionItem[] = [];
    
    for (const [keyword, info] of Object.entries(KEYWORDS)) {
        items.push({
            label: keyword,
            kind: CompletionItemKind.Keyword,
            detail: info.description,
            documentation: `Example: ${info.example}`,
            insertText: needsBlock ? `${keyword} = {\n\t$0\n}` : keyword,
            insertTextFormat: InsertTextFormat.Snippet
        });
    }
    
    return items;
}
```

### 4. Add Hover Documentation

In `vscode-extension/src/server/lsp/hover.ts`:

```typescript
getKeywordHover(keyword: string): Hover | null {
    // Get hover information for keyword
    const info = KEYWORDS[keyword];
    if (!info) {
        return null;
    }
    
    const content = `**${keyword}** (${info.category})\n\n` +
                   `${info.description}\n\n` +
                   `Example:\n\`\`\`ck3\n${info.example}\n\`\`\``;
    
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content
        }
    };
}
```

### 5. Add Tests

```typescript
describe('New Keyword', () => {
    it('should provide completions for new keyword', () => {
        const provider = new CompletionProvider();
        const completions = provider.getKeywordCompletions();
        
        expect(completions.some(c => c.label === "new_keyword")).toBe(true);
    });

    it('should provide hover for new keyword', () => {
        const provider = new HoverProvider();
        const hover = provider.getKeywordHover("new_keyword");
        
        expect(hover).not.toBeNull();
        expect(hover?.contents.value).toContain("Description of the keyword");
    });
});

## Adding New Effects

Effects are actions that modify game state.

### 1. Add to Effect Definitions

Edit `vscode-extension/src/server/ck3/language.ts`:

```typescript
export const EFFECTS = {
    "add_trait": {
        description: "Adds a trait to a character",
        scopes: ["character"],
        parameters: {
            required: ["trait"],
            optional: []
        },
        example: "add_trait = brave"
    },
    // Add new effect
    "new_effect": {
        description: "What this effect does",
        scopes: ["character", "province"],  // Which scopes it works in
        parameters: {
            required: ["param1"],
            optional: ["param2"]
        },
        example: "new_effect = param1",
        addedIn: "1.11.0"  // Game version
    },
};

### 2. Add Validation

In `vscode-extension/src/server/lsp/diagnostics.ts`:

```typescript
validateEffect(effectNode: EffectNode): Diagnostic | null {
    // Validate an effect
    const effectName = effectNode.name;
    const effectInfo = EFFECTS[effectName];
    
    if (!effectInfo) {
        // Unknown effect
        return {
            range: effectNode.range,
            message: `Unknown effect: ${effectName}`,
            severity: DiagnosticSeverity.Error,
            code: "CK3201"
        };
    }
    
    // Check scope compatibility
    if (!effectInfo.scopes.includes(this.currentScope)) {
        return {
            range: effectNode.range,
            message: `Effect '${effectName}' not valid in ${this.currentScope} scope`,
            severity: DiagnosticSeverity.Error,
            code: "CK3202"
        };
    }
    
    // Validate parameters
    // ... parameter validation logic
    
    return null;
}

### 3. Add Signature Help

In `vscode-extension/src/server/lsp/signature-help.ts`:

```typescript
getEffectSignature(effectName: string): SignatureHelp | null {
    // Get signature help for effect
    const effectInfo = EFFECTS[effectName];
    if (!effectInfo) {
        return null;
    }
    
    const params = effectInfo.parameters;
    
    const signature: SignatureInformation = {
        label: `${effectName} = ...`,
        documentation: effectInfo.description,
        parameters: [
            ...params.required.map(p => ({
                label: p,
                documentation: "Required"
            })),
            ...params.optional.map(p => ({
                label: p,
                documentation: "Optional"
            }))
        ]
    };
    
    return {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: 0
    };
}

## Adding New Triggers

Triggers are conditions that evaluate to true/false.

### 1. Add to Trigger Definitions

```typescript
export const TRIGGERS = {
    "has_trait": {
        description: "Checks if character has a trait",
        scopes: ["character"],
        type: "boolean",
        parameters: ["trait_name"],
        example: "has_trait = brave"
    },
    // Add new trigger
    "new_trigger": {
        description: "What this trigger checks",
        scopes: ["character"],
        type: "boolean",  // or "comparison" for >, <, etc.
        parameters: ["param"],
        example: "new_trigger = param"
    },
};

### 2. Follow Effect Pattern

Use the same validation, completion, and hover patterns as effects.

## Adding New Scopes

Scopes define the context (character, province, title, etc.) for effects/triggers.

### 1. Define Scope Type

Create YAML file: `data/scopes/new_scope.yaml`

```yaml
name: new_scope_type
description: "Description of this scope type"
properties:
  - property1
  - property2

links:
  # Scope transitions FROM this scope
  - target: character
    syntax: "owner"
    description: "The owner of this new_scope"
  - target: province
    syntax: "location"
    description: "The location of this new_scope"

effects:
  # Effects valid in this scope
  - effect_name1
  - effect_name2

triggers:
  # Triggers valid in this scope
  - trigger_name1
  - trigger_name2
```

### 2. Load in Data Loader

Ensure `vscode-extension/src/server/data/loader.ts` loads the new scope:

```typescript
loadScopes(): Record<string, ScopeData> {
    // Load all scope definitions
    const scopes: Record<string, ScopeData> = {};
    const scopeDir = path.join(__dirname, "../../../data/scopes");
    
    const yamlFiles = fs.readdirSync(scopeDir).filter(f => f.endsWith('.yaml'));
    
    for (const yamlFile of yamlFiles) {
        const filePath = path.join(scopeDir, yamlFile);
        const content = fs.readFileSync(filePath, 'utf-8');
        const scopeData = yaml.parse(content) as ScopeData;
        scopes[scopeData.name] = scopeData;
    }
    
    return scopes;
}

### 3. Update Scope Validator

In `vscode-extension/src/server/ck3/validation/scopes.ts`:

```typescript
export class ScopeTracker {
    // Tracks current scope and validates transitions
    
    static VALID_SCOPES = [
        "character",
        "province", 
        "title",
        "new_scope_type",  // Add here
    ];
    
    navigateTo(target: string): string | null {
        // Navigate to target scope
        // Check if transition is valid from current scope
        const scopeData = SCOPES[this.currentScope];
        
        for (const link of scopeData.links) {
            if (link.syntax === target) {
                return link.target;
            }
        }
        
        return null;
    }
}

## Adding List Iterators

List iterators like `any_vassal`, `every_courtier` allow iteration over collections.

### 1. Define Iterator

```typescript
export const LIST_ITERATORS = {
    "any_vassal": {
        description: "Iterates over vassals",
        parentScope: "character",
        childScope: "character",
        hasLimit: true,
        example: "any_vassal = { limit = { ... } }"
    },
    // Add new iterator
    "any_new_collection": {
        description: "Iterates over new collection",
        parentScope: "new_scope_type",
        childScope: "character",
        hasLimit: true,
        example: "any_new_collection = { ... }"
    },
};

### 2. Update List Validator

In `vscode-extension/src/server/ck3/validation/lists.ts`:

```typescript
validateListIterator(node: ListIteratorNode): Diagnostic | null {
    // Validate list iterator syntax
    const iteratorName = node.name;
    const iteratorInfo = LIST_ITERATORS[iteratorName];
    
    if (!iteratorInfo) {
        return this.unknownIteratorDiagnostic(node);
    }
    
    // Check parent scope
    if (this.currentScope !== iteratorInfo.parentScope) {
        return this.invalidScopeDiagnostic(node, iteratorInfo);
    }
    
    // Track scope transition
    this.scopeTracker.enterScope(iteratorInfo.childScope);
    
    return null;
}

## Testing New Features

### 1. Unit Tests

```typescript
describe('New Feature Tests', () => {
    it('should provide completion for new feature', () => {
        const provider = new CompletionProvider();
        const completions = provider.getCompletions("effect");
        
        expect(completions.some(c => c.label === "new_effect")).toBe(true);
    });

    it('should validate new feature without errors', () => {
        const validator = new DiagnosticsEngine();
        const code = "new_effect = param";
        
        const diagnostics = validator.validate(code, "character");
        
        // Should not produce errors
        expect(diagnostics).toHaveLength(0);
    });

    it('should detect new feature in wrong scope', () => {
        const validator = new DiagnosticsEngine();
        const code = "new_effect = param";
        
        const diagnostics = validator.validate(code, "province");
        
        // Should produce scope error
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toBe("CK3202");
    });
});

### 2. Integration Tests

```typescript
describe('New Feature Full Workflow', () => {
    it('should handle new feature in full LSP workflow', async () => {
        const server = new CK3LanguageServer();
        const uri = "file:///test.txt";
        
        const code = `
    namespace = test
    
    test_event = {
        type = character_event
        immediate = {
            new_effect = param
        }
    }
    `;
        
        // Open document
        await server.didOpen(uri, code);
        
        // Get diagnostics (should be none)
        const diagnostics = server.getDiagnostics(uri);
        expect(diagnostics).toHaveLength(0);
        
        // Get completion at "new_"
        const completions = await server.completion(uri, 6, 16);
        expect(completions.items.some(c => c.label.includes("new_effect"))).toBe(true);
        
        // Get hover on "new_effect"
        const hover = await server.hover(uri, 6, 12);
        expect(hover?.contents.value).toContain("What this effect does");
    });
});

## Documentation

### Update Feature List

Add to `README.md`:

```markdown
#### 🆕 New Feature Support
Support for CK3 version X.X.X features:
- `new_effect` - What it does
- `new_trigger` - What it checks
- `new_scope_type` - New scope context
```

### Update Changelog

Add to `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- Support for `new_effect` effect (CK3 1.11.0+)
- Support for `new_trigger` trigger
- New scope type `new_scope_type` with validation
```

## Checklist for New Features

- [ ] Add to language definitions (`vscode-extension/src/server/ck3/language.ts`)
- [ ] Update parser if syntax is special
- [ ] Add validation logic
- [ ] Add completion support
- [ ] Add hover documentation
- [ ] Add signature help (for effects/triggers)
- [ ] Create scope definition (for new scopes)
- [ ] Write unit tests (Mocha)
- [ ] Write integration tests
- [ ] Update README.md
- [ ] Update CHANGELOG.md
- [ ] Test in VS Code Extension Development Host

## Resources

- [CK3 Modding Wiki](https://ck3.paradoxwikis.com/Modding)
- [CK3 Effects Documentation](https://ck3.paradoxwikis.com/Effects)
- [CK3 Triggers Documentation](https://ck3.paradoxwikis.com/Triggers)
- [CK3 Scopes Documentation](https://ck3.paradoxwikis.com/Scopes)
