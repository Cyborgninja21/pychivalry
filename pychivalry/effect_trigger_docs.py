"""
Effect and Trigger Documentation Loader.

Loads comprehensive effect and trigger documentation from YAML files.
Provides structured access to descriptions, snippets, examples, and scope information.
"""

from typing import Dict, Any, Optional, List
from pathlib import Path
import yaml
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


class EffectTriggerLoader:
    """Loads and provides access to effect and trigger documentation."""

    def __init__(self) -> None:
        """Initialize the loader."""
        self.data_dir = Path(__file__).parent / "data"
        self._effects: Optional[Dict[str, Any]] = None
        self._triggers: Optional[Dict[str, Any]] = None

    def load_effects(self) -> Dict[str, Any]:
        """
        Load effects documentation from YAML.

        Returns:
            Dictionary mapping effect names to their documentation
        """
        if self._effects is not None:
            return self._effects

        effects_file = self.data_dir / "effects" / "effects.yaml"
        try:
            with open(effects_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                self._effects = data.get('effects', {})
                logger.info(f"Loaded {len(self._effects)} effects from {effects_file}")
                return self._effects
        except Exception as e:
            logger.error(f"Error loading effects from {effects_file}: {e}")
            self._effects = {}
            return self._effects

    def load_triggers(self) -> Dict[str, Any]:
        """
        Load triggers documentation from YAML.

        Returns:
            Dictionary mapping trigger names to their documentation
        """
        if self._triggers is not None:
            return self._triggers

        triggers_file = self.data_dir / "triggers" / "triggers.yaml"
        try:
            with open(triggers_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                self._triggers = data.get('triggers', {})
                logger.info(f"Loaded {len(self._triggers)} triggers from {triggers_file}")
                return self._triggers
        except Exception as e:
            logger.error(f"Error loading triggers from {triggers_file}: {e}")
            self._triggers = {}
            return self._triggers

    def get_effect_doc(self, effect_name: str) -> Optional[Dict[str, Any]]:
        """
        Get documentation for a specific effect.

        Args:
            effect_name: Name of the effect

        Returns:
            Documentation dictionary or None if not found
        """
        effects = self.load_effects()
        return effects.get(effect_name)

    def get_trigger_doc(self, trigger_name: str) -> Optional[Dict[str, Any]]:
        """
        Get documentation for a specific trigger.

        Args:
            trigger_name: Name of the trigger

        Returns:
            Documentation dictionary or None if not found
        """
        triggers = self.load_triggers()
        return triggers.get(trigger_name)

    def get_all_effect_names(self) -> List[str]:
        """Get list of all effect names."""
        effects = self.load_effects()
        return list(effects.keys())

    def get_all_trigger_names(self) -> List[str]:
        """Get list of all trigger names."""
        triggers = self.load_triggers()
        return list(triggers.keys())


# Global singleton instance
_loader: Optional[EffectTriggerLoader] = None


def get_loader() -> EffectTriggerLoader:
    """Get the global effect/trigger loader instance."""
    global _loader
    if _loader is None:
        _loader = EffectTriggerLoader()
    return _loader


@lru_cache(maxsize=256)
def get_effect_documentation(effect_name: str) -> Optional[Dict[str, Any]]:
    """
    Get cached documentation for an effect.

    Args:
        effect_name: Name of the effect

    Returns:
        Documentation dictionary or None
    """
    return get_loader().get_effect_doc(effect_name)


@lru_cache(maxsize=256)
def get_trigger_documentation(trigger_name: str) -> Optional[Dict[str, Any]]:
    """
    Get cached documentation for a trigger.

    Args:
        trigger_name: Name of the trigger

    Returns:
        Documentation dictionary or None
    """
    return get_loader().get_trigger_doc(trigger_name)


def get_all_effects() -> List[str]:
    """Get list of all documented effects."""
    return get_loader().get_all_effect_names()


def get_all_triggers() -> List[str]:
    """Get list of all documented triggers."""
    return get_loader().get_all_trigger_names()
