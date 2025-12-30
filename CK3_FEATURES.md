# CK3 Language Features

This document describes the CK3-specific language features implemented in the pychivalry language server.

## Auto-completion

The language server provides intelligent auto-completion for CK3 scripting constructs.

### Supported Completion Categories

#### 1. Keywords (50+ items)
Control flow and structural keywords:
- `if`, `else`, `else_if` - Conditional statements
- `trigger`, `effect`, `immediate` - Effect/trigger sections
- `limit` - Condition filtering
- `namespace`, `type`, `title`, `desc` - Event definitions
- `is_shown`, `is_valid`, `ai_will_do` - Decision keywords

#### 2. Effects (30+ items)
Commands that modify game state:
- **Character**: `add_trait`, `remove_trait`, `add_gold`, `add_prestige`, `add_piety`, `add_stress`
- **Modifiers**: `add_character_modifier`, `remove_character_modifier`
- **Titles**: `add_claim`, `remove_claim`, `create_title`, `destroy_title`
- **Relationships**: `add_opinion`, `remove_opinion`, `marry`, `divorce`
- **Events**: `trigger_event`
- **Variables**: `set_variable`, `change_variable`, `remove_variable`
- **Misc**: `random`, `random_list`, `save_scope_as`, `hidden_effect`

#### 3. Triggers (30+ items)
Conditional checks:
- **Character**: `age`, `has_trait`, `is_adult`, `is_child`, `is_ruler`, `is_ai`, `is_player`
- **Titles**: `has_title`, `has_claim_on`, `completely_controls`
- **Relations**: `has_relation`, `is_married`, `is_close_family_of`, `opinion`
- **Resources**: `gold`, `prestige`, `piety`, `short_term_gold`
- **Logic**: `AND`, `OR`, `NOT`, `NOR`, `NAND`
- **Comparison**: `exists`, `always`, `custom`

#### 4. Scopes (40+ items)
Context navigation:
- **Basic**: `root`, `prev`, `this`, `from`, `fromfrom`
- **Vassals**: `every_vassal`, `any_vassal`, `random_vassal`, `ordered_vassal`
- **Court**: `every_courtier`, `any_courtier`, `random_courtier`
- **Family**: `every_child`, `any_child`, `every_spouse`, `any_spouse`
- **Titles**: `primary_title`, `capital_county`, `every_held_title`
- **Relations**: `liege`, `top_liege`, `father`, `mother`, `dynasty`, `house`

#### 5. Event Types (5 items)
- `character_event` - Standard character events
- `letter_event` - Events displayed as letters
- `duel_event` - Combat/duel events
- `feast_event` - Feast and party events
- `story_cycle` - Story cycle events

#### 6. Boolean Values (4 items)
- `yes`, `no`, `true`, `false`

### Trigger Characters

Completions are automatically triggered when typing:
- `_` (underscore) - Common in CK3 identifiers
- `.` (period) - For accessing properties and scopes

### Usage

Auto-completion will appear automatically as you type in CK3 script files (`.txt`, `.gui`, `.gfx`, `.asset`).

**Example workflow:**
1. Start typing an effect: `add_`
2. Completion list appears showing all effects starting with "add_"
3. Select the desired completion (e.g., `add_trait`)
4. Continue typing or press Tab/Enter to insert

### Completion Item Details

Each completion item includes:
- **Label**: The keyword/effect/trigger name
- **Kind**: Category (Keyword, Function, Variable, etc.)
- **Detail**: Brief category description
- **Documentation**: Helpful description of the item

## Testing the Completion Feature

### From VS Code

1. Open a CK3 script file (e.g., `examples/hello_world.txt`)
2. Start typing to trigger completions
3. Press `Ctrl+Space` to manually trigger completion list
4. Use arrow keys to navigate, Enter/Tab to select

### From Tests

Run the completion tests:
```bash
pytest tests/test_completions.py -v
```

## Implementation Details

### Files

- `pychivalry/ck3_language.py` - CK3 language definitions (keywords, effects, triggers, scopes)
- `pychivalry/server.py` - LSP server with completion handler
- `tests/test_completions.py` - Completion feature tests

### Architecture

The completion system is built on:
1. **Language definitions** - Static lists of CK3 constructs in `ck3_language.py`
2. **LSP handler** - `@server.feature(TEXT_DOCUMENT_COMPLETION)` in `server.py`
3. **Completion logic** - Returns categorized completion items based on context

### Future Enhancements

Planned improvements:
- **Context-aware completions** - Show only relevant items based on cursor position
- **Snippet completions** - Complete code blocks (e.g., event templates)
- **Dynamic completions** - Load game data files for custom content
- **Documentation lookup** - Link to wiki/documentation for each item
- **Signature help** - Parameter hints for effects/triggers
- **Hover information** - Show detailed docs on hover

## References

- CK3 Scripting Wiki: https://ck3.paradoxwikis.com/Scripting
- LSP Specification: https://microsoft.github.io/language-server-protocol/
- pygls Documentation: https://pygls.readthedocs.io/
