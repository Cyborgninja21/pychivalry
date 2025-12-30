"""
CK3 Localization System Module

This module handles validation of CK3 localization syntax and references.
Localization enables multi-language support through key-based text substitution.

Character Functions:
- GetName, GetFirstName, GetLastName - Character name functions
- GetTitle, GetTitledFirstName - Title-aware names
- [character.GetUIName] - UI-formatted names

Text Formatting:
- #P - Possessive (adds 's or ')
- #N - Newline
- #bold, #italic - Text styling
- #! - Emphasis marker
- [concept|E] - Concept links with context

Icon References:
- @gold_icon! - Gold icon
- @prestige_icon! - Prestige icon
- @piety_icon! - Piety icon
- [icon_path] - Custom icon references

Localization Keys:
- my_mod.0001.t - Event title
- my_mod.0001.desc - Event description
- my_mod.option.a - Option text
"""

from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
import re


@dataclass
class LocalizationKey:
    """
    Represents a localization key reference.
    
    Attributes:
        key: The localization key identifier
        file_path: Source file where key is used
        key_type: Type of localization (title, desc, option, etc.)
    """
    key: str
    file_path: str
    key_type: Optional[str] = None


# Character name functions
CHARACTER_FUNCTIONS = {
    'GetName', 'GetFirstName', 'GetLastName', 'GetFullName',
    'GetBirthName', 'GetNickname', 'GetTitle', 'GetTitledFirstName',
    'GetTitledFirstNameNoTooltip', 'GetShortUIName', 'GetUIName',
    'GetNameNoTooltip', 'GetTitledFirstNamePossessive',
    'GetNamePossessive', 'GetFirstNamePossessive',
    'GetHerHis', 'GetSheHe', 'GetHerHim', 'GetHerselfHimself',
}

# Text formatting codes
TEXT_FORMATTING_CODES = {
    '#P', '#N', '#bold', '#italic', '#underline', '#!',
    '#weak', '#high', '#low', '#V', '#v', '#L', '#EMP',
}

# Icon references
ICON_REFERENCES = {
    '@gold_icon!', '@prestige_icon!', '@piety_icon!', '@dread_icon!',
    '@stress_icon!', '@prowess_icon!', '@hook_icon!', '@weak_hook_icon!',
    '@strong_hook_icon!', '@opinion_icon!', '@knight_icon!',
    '@councillor_icon!', '@warning_icon!', '@death_icon!',
}


def is_character_function(func_name: str) -> bool:
    """
    Check if a function name is a valid character function.
    
    Args:
        func_name: The function name to check
        
    Returns:
        True if valid character function, False otherwise
    """
    return func_name in CHARACTER_FUNCTIONS


def is_text_formatting_code(code: str) -> bool:
    """
    Check if a code is a valid text formatting code.
    
    Args:
        code: The formatting code to check (including #)
        
    Returns:
        True if valid formatting code, False otherwise
    """
    return code in TEXT_FORMATTING_CODES


def is_icon_reference(icon: str) -> bool:
    """
    Check if an icon reference is valid.
    
    Args:
        icon: The icon reference to check (including @ and !)
        
    Returns:
        True if valid icon reference, False otherwise
    """
    return icon in ICON_REFERENCES


def extract_character_functions(text: str) -> List[str]:
    """
    Extract character function calls from text.
    
    Format: [character.GetFunction] or [scope:name.GetFunction]
    
    Args:
        text: The text to search
        
    Returns:
        List of function names found
        
    Examples:
        >>> extract_character_functions("[root.GetName] is here")
        ['GetName']
        
        >>> extract_character_functions("[scope:target.GetFirstName] and [liege.GetTitle]")
        ['GetFirstName', 'GetTitle']
    """
    pattern = r'\[[\w:\.]+\.(Get\w+)\]'
    matches = re.findall(pattern, text)
    return matches


def extract_text_formatting_codes(text: str) -> List[str]:
    """
    Extract text formatting codes from text.
    
    Args:
        text: The text to search
        
    Returns:
        List of formatting codes found (including #)
        
    Examples:
        >>> extract_text_formatting_codes("This is #bold important#! text")
        ['#bold', '#!']
        
        >>> extract_text_formatting_codes("#P possession#N newline")
        ['#P', '#N']
    """
    pattern = r'#[A-Za-z!]+'
    matches = re.findall(pattern, text)
    return matches


def extract_icon_references(text: str) -> List[str]:
    """
    Extract icon references from text.
    
    Args:
        text: The text to search
        
    Returns:
        List of icon references found
        
    Examples:
        >>> extract_icon_references("You gain @gold_icon! 100 gold")
        ['@gold_icon!']
        
        >>> extract_icon_references("@prestige_icon! and @piety_icon!")
        ['@prestige_icon!', '@piety_icon!']
    """
    pattern = r'@\w+_icon!'
    matches = re.findall(pattern, text)
    return matches


def validate_character_function_call(call: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a character function call.
    
    Format: [scope.GetFunction] or [scope:name.GetFunction]
    
    Args:
        call: The function call to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not call.startswith('[') or not call.endswith(']'):
        return (False, "Function call must be wrapped in []")
    
    inner = call[1:-1]  # Remove brackets
    
    if '.' not in inner:
        return (False, "Function call must have format [scope.GetFunction]")
    
    parts = inner.rsplit('.', 1)
    if len(parts) != 2:
        return (False, "Invalid function call format")
    
    scope, func = parts
    
    if not is_character_function(func):
        return (False, f"Unknown character function: {func}")
    
    return (True, None)


def validate_concept_link(link: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a concept link.
    
    Format: [concept|E] or [concept_name|context]
    
    Args:
        link: The concept link to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not link.startswith('[') or not link.endswith(']'):
        return (False, "Concept link must be wrapped in []")
    
    inner = link[1:-1]
    
    if '|' not in inner:
        return (False, "Concept link must have format [concept|context]")
    
    parts = inner.split('|')
    if len(parts) != 2:
        return (False, "Concept link must have exactly one | separator")
    
    concept, context = parts
    
    if not concept:
        return (False, "Concept name cannot be empty")
    
    if not context:
        return (False, "Context cannot be empty")
    
    return (True, None)


def parse_localization_key(key: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse a localization key into namespace and identifier.
    
    Format: namespace.identifier or namespace.number.type
    
    Args:
        key: The localization key to parse
        
    Returns:
        Tuple of (namespace, identifier) if valid, (None, None) otherwise
        
    Examples:
        >>> parse_localization_key('my_mod.0001.t')
        ('my_mod', '0001.t')
        
        >>> parse_localization_key('my_mod.option.a')
        ('my_mod', 'option.a')
    """
    if '.' not in key:
        return (None, None)
    
    parts = key.split('.', 1)
    if len(parts) == 2:
        namespace, identifier = parts
        return (namespace, identifier)
    
    return (None, None)


def suggest_localization_key_format(event_id: str, key_type: str) -> str:
    """
    Suggest proper localization key format for an event.
    
    Args:
        event_id: The event ID (e.g., my_mod.0001)
        key_type: The type of key (title, desc, option, etc.)
        
    Returns:
        Suggested localization key
        
    Examples:
        >>> suggest_localization_key_format('my_mod.0001', 'title')
        'my_mod.0001.t'
        
        >>> suggest_localization_key_format('my_mod.0001', 'desc')
        'my_mod.0001.desc'
    """
    type_suffixes = {
        'title': 't',
        'desc': 'desc',
        'option': 'a',  # Default to 'a', can be 'b', 'c', etc.
    }
    
    suffix = type_suffixes.get(key_type, key_type)
    return f"{event_id}.{suffix}"


def validate_localization_references(text: str) -> List[Tuple[str, str]]:
    """
    Validate all localization references in text.
    
    Returns list of (reference, issue) tuples for invalid references.
    
    Args:
        text: The text to validate
        
    Returns:
        List of (reference, issue) tuples for problems found
    """
    issues = []
    
    # Check character functions
    func_calls = re.findall(r'\[[\w:\.]+\.(Get\w+)\]', text)
    for func in func_calls:
        if not is_character_function(func):
            issues.append((func, f"Unknown character function: {func}"))
    
    # Check formatting codes
    format_codes = extract_text_formatting_codes(text)
    for code in format_codes:
        if not is_text_formatting_code(code):
            issues.append((code, f"Unknown formatting code: {code}"))
    
    # Check icon references
    icon_refs = extract_icon_references(text)
    for icon in icon_refs:
        if not is_icon_reference(icon):
            issues.append((icon, f"Unknown icon reference: {icon}"))
    
    return issues


def get_character_function_description(func_name: str) -> str:
    """
    Get a description of a character function.
    
    Args:
        func_name: The function name
        
    Returns:
        Description string
    """
    descriptions = {
        'GetName': "Returns the character's full name",
        'GetFirstName': "Returns the character's first name only",
        'GetLastName': "Returns the character's last name/dynasty name",
        'GetTitle': "Returns the character's primary title",
        'GetTitledFirstName': "Returns first name with title (e.g., 'King John')",
        'GetUIName': "Returns name formatted for UI display",
        'GetNickname': "Returns the character's nickname if they have one",
        'GetHerHis': "Returns 'her' or 'his' based on character gender",
        'GetSheHe': "Returns 'she' or 'he' based on character gender",
        'GetHerHim': "Returns 'her' or 'him' based on character gender",
    }
    return descriptions.get(func_name, f"Character function: {func_name}")


def get_formatting_code_description(code: str) -> str:
    """
    Get a description of a text formatting code.
    
    Args:
        code: The formatting code (including #)
        
    Returns:
        Description string
    """
    descriptions = {
        '#P': "Makes preceding word possessive (adds 's or ')",
        '#N': "Inserts a newline",
        '#bold': "Makes following text bold",
        '#italic': "Makes following text italic",
        '#!': "Emphasizes the preceding text",
        '#weak': "Formats text as weak/de-emphasized",
        '#high': "Formats text as high importance",
        '#low': "Formats text as low importance",
    }
    return descriptions.get(code, f"Formatting code: {code}")


def create_localization_key(key: str, file_path: str, key_type: Optional[str] = None) -> LocalizationKey:
    """
    Create a LocalizationKey object.
    
    Args:
        key: The localization key identifier
        file_path: Source file where key is used
        key_type: Type of localization (title, desc, option, etc.)
        
    Returns:
        LocalizationKey object
    """
    return LocalizationKey(key=key, file_path=file_path, key_type=key_type)
