"""
CK3 Game Logic - Language Definitions and Validation

This subpackage contains Crusader Kings 3 specific logic:
- Language definitions (effects, triggers, keywords, scopes)
- Effect and trigger documentation
- Validation subsystem for CK3 game structures
- Localization subsystem for language files
"""

# Re-export core CK3 language definitions
from .language import (
    CK3_KEYWORDS,
    CK3_EFFECTS,
    CK3_TRIGGERS,
    CK3_SCOPES,
    CK3_OPERATORS,
)
from .effect_trigger_docs import EffectTriggerLoader

__all__ = [
    # Language
    "CK3_KEYWORDS",
    "CK3_EFFECTS",
    "CK3_TRIGGERS",
    "CK3_SCOPES",
    "CK3_OPERATORS",
    # Documentation
    "EffectTriggerLoader",
]
