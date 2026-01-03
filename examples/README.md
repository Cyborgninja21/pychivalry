# PyChivalry Example Mod

This is a complete example CK3 mod demonstrating various scripting patterns and features that PyChivalry can analyze and assist with.

## Structure

```
examples/                          # Mod root (would be in your mod folder)
├── descriptor.mod                 # Mod descriptor file
├── common/                        # Game definitions
│   ├── decisions/                 # Player decisions
│   ├── on_action/                 # Event triggers
│   ├── scripted_effects/          # Reusable effect blocks
│   ├── scripted_triggers/         # Reusable trigger blocks
│   ├── script_values/             # Calculated values
│   ├── traits/                    # Custom traits
│   ├── modifiers/                 # Static modifiers
│   └── opinion_modifiers/         # Opinion modifiers
├── events/                        # Event definitions
│   ├── example_events.txt         # Main event file
│   └── story_cycle_events.txt     # Story cycle events
├── gfx/                           # Graphics
│   └── interface/                 # UI graphics
│       └── icons/                 # Custom icons
└── localization/                  # Text translations
    └── english/                   # English text
        ├── example_l_english.yml  # Main localization
        └── decisions_l_english.yml
```

## Features Demonstrated

- **Decisions**: Major and minor decisions with proper validation
- **Events**: Character events with options, triggers, and effects
- **Story Cycles**: Multi-event narrative chains
- **Scripted Effects**: Reusable effect blocks
- **Scripted Triggers**: Reusable condition blocks
- **Script Values**: Dynamic calculations
- **Traits**: Custom character traits
- **Modifiers**: Static and timed modifiers
- **Localization**: Proper localization patterns
- **Scopes**: Character, title, and province scopes
- **Variables**: Using saved scopes and variables

## Using This Example

1. Copy this folder to your CK3 mod directory
2. Enable the mod in the CK3 launcher
3. Use the decision menu to trigger example events
4. Observe PyChivalry diagnostics and suggestions
