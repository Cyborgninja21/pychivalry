#!/usr/bin/env python3
"""
Scope Accessor Validation Script

Compares extracted scope accessors from CK3 game files against our 
implementation in indexer.py to identify any gaps.

Usage:
    python tools/validate_scope_accessors.py
"""

import csv
import re
from pathlib import Path


def load_extracted_accessors(csv_path: str) -> tuple[set, set]:
    """Load extracted scope links and list iterator suffixes from CSV."""
    extracted_links = set()
    extracted_suffixes = set()
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        for row in reader:
            if len(row) >= 2:
                accessor = row[0].lower()
                match_type = row[1]
                
                if match_type == 'scope_link':
                    extracted_links.add(accessor)
                elif match_type == 'list_iterator':
                    for prefix in ['any_', 'every_', 'random_', 'ordered_']:
                        if accessor.startswith(prefix):
                            extracted_suffixes.add(accessor[len(prefix):])
                            break
    
    return extracted_links, extracted_suffixes


def load_implemented_accessors(indexer_path: str) -> tuple[set, set, list]:
    """Extract implemented scope accessors from indexer.py.
    
    Returns:
        Tuple of (full_accessors, suffix_set, pattern_suffixes) where:
        - full_accessors: Complete accessor names like 'any_vassal', 'liege'
        - suffix_set: Just the suffixes for list iterators
        - pattern_suffixes: Suffixes covered by pattern-based matching
    """
    with open(indexer_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    full_accessors = set()
    suffixes = set()
    in_scope_map = False
    brace_count = 0
    
    # Pattern-based suffixes (from fallback pattern matching in indexer)
    # Character-returning iterator suffix patterns
    character_pattern_suffixes = [
        '_character', '_knight', '_courtier', '_guest', '_vassal',
        '_ruler', '_liege', '_heir', '_spouse', '_child', '_parent',
        '_sibling', '_grandparent', '_grandchild', '_ancestor',
        '_member', '_claimant', '_prisoner', '_agent', '_participant',
        '_owner', '_target', '_holder', '_successor', '_promoter',
        '_commander', '_attacker', '_defender', '_ally', '_enemy',
        '_dynasty', '_house', '_relation', '_contact', '_hostage',
        '_councillor', '_consort', '_pretender', '_raider',
    ]
    # Title-returning iterator suffix patterns
    title_pattern_suffixes = [
        '_title', '_county', '_duchy', '_kingdom', '_empire',
        '_barony', '_claim', '_de_jure', '_held_title', '_realm_title',
        '_realm', '_region',
    ]
    # Province-returning iterator suffix patterns
    province_pattern_suffixes = ['_province', '_location']
    # Other scope type patterns
    other_pattern_suffixes = [
        '_artifact', '_scheme', '_secret', '_memory',
        '_faith', '_culture', '_army', '_inspiration', '_hook',
        '_accolade', '_legend', '_activity', '_faction', '_war', '_epidemic',
    ]
    
    all_pattern_suffixes = (character_pattern_suffixes + title_pattern_suffixes + 
                           province_pattern_suffixes + other_pattern_suffixes)
    
    for line in content.split('\n'):
        if 'scope_type_map' in line and '=' in line and '{' in line:
            in_scope_map = True
            brace_count = line.count('{') - line.count('}')
            continue
        
        if in_scope_map:
            brace_count += line.count('{') - line.count('}')
            
            # Extract the key (first quoted string before the colon)
            match = re.search(r"'([^']+)':", line)
            if match:
                accessor = match.group(1).lower()
                full_accessors.add(accessor)
                
                # Also extract the suffix for list iterators
                for prefix in ['any_', 'every_', 'random_', 'ordered_']:
                    if accessor.startswith(prefix):
                        suffixes.add(accessor[len(prefix):])
                        break
            
            if brace_count <= 0:
                break
    
    return full_accessors, suffixes, all_pattern_suffixes


def filter_false_positives(suffixes: set) -> set:
    """Filter out false positives from extracted suffixes."""
    # Known non-iterator patterns that regex picked up
    false_positives = {
        'list', 'valid', 'events', 'traits', 'traits_list', 'seed',
        'on_action', 'on_actions', 'creation', 'creation_weight',
        'change', 'actor', 'target', 'location', 'culture',
        'beauty', 'situation', 'flood', 'earthquake', 'weather',
        'harm', 'peasant', 'local', 'personal', 'neighbor', 'slayer',
        'trinket', 'artifact',
        # Additional false positives
        'in_list', 'in_global_list', 'log_scopes', 'decision',
        'conquerors_bonuses', 'contribution', 'hegemony',
        'available_task_contract', 'descendants_are_governors',
        'activity_type', 'activity_phase_location_past',
        'culture_global', 'culture_innovation', 'culture_tradition',
        'known_innovation', 'faith_holy_order', 'great_project',
        'great_project_type', 'court_position_candidate',
        'liege_or_above_is_descendant', 'maa_regiment', 'army_maa_regiment',
        'controlled_title_maa_regiment', 'owned_title_maa_regiment', 'title_maa_regiment',
        'confederation', 'hired_mercenary', 'domicile',
        # Member prefixed modifiers (not scope accessors, but modifier effects)
        'member_activity_cost_reduced', 'member_casus_belli_cost_reduction',
        'member_commission_and_inspiration_reduced', 'member_increased_activity_attendance',
        'member_increased_feast_rewards', 'member_ceremonial_house_marriage_acceptance',
        'member_house_continued_appointment_score', 'member_house_governor_appointment_score',
        'member_house_governor_efficiency_boost', 'member_house_head',
        'member_increased_pilgrimage_rewards',
        # Compound game mechanics
        'landed_character_with_vassals_has_powerful_vassals_at_game_start',
        'character_with_royal_court', 'opposite_sex_spouse_candidate',
        'parent_culture_or_above', 'house_member_modifier',
        'guest_subset', 'guest_subset_current_phase', 'courtier_away',
        'character_active_contract', 'character_task_contract', 'character_trait',
        'prisoner_scope', 'noble_family', 'powerful_family', 'sex_spouse_candidate',
        'same_sex_spouse_candidate', 'required_heir_government_type',
        # Title/Province mechanics
        'county_situation', 'province_domicile', 'character_situation',
        'in_de_jure_hierarchy_percent_greater_or_equal',
        # Misc game mechanics (not scope accessors)
        'mercenary_company', 'months_between_court_events', 'opposite_trait',
        'owned_story', 'participant_group', 'past_holder_reversed',
        'patroned_holy_order', 'personality_traits_base', 'personality_traits_span',
        'potential_marriage_option', 'regiment_score_max', 'scheme_agent_slot',
        'situation_sub_region_participant_group', 'subject',
        'succession_appointment_invested_candidate', 'succession_appointment_investors',
        'task_contract', 'tax_collector', 'tax_slot', 'tradition', 'trait',
        'trait_in_category', 'unequipped_artifact_tt',
    }
    
    filtered = set()
    for suffix in suffixes:
        # Skip known false positives
        if suffix in false_positives:
            continue
        # Skip _all, _count, _percent variants (meta-iterators)
        if suffix.endswith('_all') or suffix.endswith('_count') or suffix.endswith('_percent'):
            continue
        # Skip trigger/effect/value patterns (scripted content names)
        if 'trigger' in suffix or 'effect' in suffix or 'value' in suffix:
            continue
        # Skip pulse patterns (on_action timing)
        if 'pulse' in suffix:
            continue
        # Skip frequency/chance patterns (modifiers)
        if 'frequency' in suffix or 'chance' in suffix:
            continue
        # Skip placement patterns
        if 'placement' in suffix:
            continue
        # Skip dummy gender patterns
        if 'dummy_gender' in suffix:
            continue
        # Skip character stat patterns
        if any(x in suffix for x in ['diplomacy_', 'intrigue_', 'martial_', 'stewardship_', 'learning_', 'prowess_']):
            continue
        # Skip fertility/health stat patterns
        if any(x in suffix for x in ['fertility', 'health', 'age_min']):
            continue
        # Skip invasion patterns
        if 'invasion' in suffix:
            continue
        
        filtered.add(suffix)
    
    return filtered


def main():
    # Paths
    base_path = Path(__file__).parent.parent
    csv_path = base_path / 'tools' / 'scope_accessors_extracted.csv'
    indexer_path = base_path / 'pychivalry' / 'indexer.py'
    
    print('=' * 70)
    print('SCOPE ACCESSOR VALIDATION REPORT')
    print('=' * 70)
    
    # Load data
    extracted_links, extracted_suffixes = load_extracted_accessors(csv_path)
    implemented_full, implemented_suffixes, pattern_suffixes = load_implemented_accessors(indexer_path)
    
    # Filter false positives
    filtered_suffixes = filter_false_positives(extracted_suffixes)
    
    # Check scope links
    print(f'\n📊 SCOPE LINKS')
    print(f'   Extracted from game: {len(extracted_links)}')
    implemented_links = [x for x in extracted_links if x in implemented_full]
    print(f'   Found in implementation: {len(implemented_links)}')
    
    missing_links = extracted_links - implemented_full
    if missing_links:
        print(f'\n   ⚠️  Missing scope links ({len(missing_links)}):')
        for link in sorted(missing_links):
            print(f'       - {link}')
    else:
        print('\n   ✅ All scope links are implemented!')
    
    # Check list iterator suffixes
    print(f'\n📊 LIST ITERATOR SUFFIXES')
    print(f'   Extracted from game: {len(extracted_suffixes)}')
    print(f'   After filtering false positives: {len(filtered_suffixes)}')
    print(f'   Implemented explicitly in map: {len(implemented_suffixes)}')
    print(f'   Pattern suffixes (fallback): {len(pattern_suffixes)}')
    
    # Check which suffixes are covered by pattern matching
    def is_covered_by_pattern(suffix: str, patterns: list) -> bool:
        """Check if a suffix is covered by pattern-based matching."""
        for pattern in patterns:
            if suffix.endswith(pattern.lstrip('_')):
                return True
        return False
    
    # Calculate coverage
    pattern_covered = {s for s in filtered_suffixes if is_covered_by_pattern(s, pattern_suffixes)}
    total_covered = implemented_suffixes | pattern_covered
    
    missing_suffixes = filtered_suffixes - total_covered
    
    print(f'   Covered by patterns: {len(pattern_covered)}')
    print(f'   Total coverage: {len(total_covered)}/{len(filtered_suffixes)} ({100*len(total_covered)//len(filtered_suffixes)}%)')
    
    # Group missing by likely scope type
    if missing_suffixes:
        print(f'\n   ⚠️  Potentially missing suffixes ({len(missing_suffixes)}):')
        
        # Categorize
        character_related = []
        title_related = []
        other = []
        
        for suffix in sorted(missing_suffixes):
            if any(x in suffix for x in ['vassal', 'courtier', 'guest', 'knight', 'spouse', 
                                          'child', 'parent', 'sibling', 'family', 'heir',
                                          'prisoner', 'ruler', 'character', 'councillor',
                                          'hostage', 'relation', 'entourage', 'pool',
                                          'dynasty', 'house', 'contact', 'consort']):
                character_related.append(suffix)
            elif any(x in suffix for x in ['title', 'county', 'duchy', 'kingdom', 'empire',
                                            'barony', 'province', 'realm', 'de_jure', 'held',
                                            'sub_realm', 'border']):
                title_related.append(suffix)
            else:
                other.append(suffix)
        
        if character_related:
            print(f'\n       [Character-related] ({len(character_related)}):')
            for s in character_related[:20]:
                print(f'           {s}')
            if len(character_related) > 20:
                print(f'           ... and {len(character_related) - 20} more')
        
        if title_related:
            print(f'\n       [Title/Province-related] ({len(title_related)}):')
            for s in title_related[:20]:
                print(f'           {s}')
            if len(title_related) > 20:
                print(f'           ... and {len(title_related) - 20} more')
        
        if other:
            print(f'\n       [Other] ({len(other)}):')
            for s in other[:30]:
                print(f'           {s}')
            if len(other) > 30:
                print(f'           ... and {len(other) - 30} more')
    else:
        print('\n   ✅ All list iterator suffixes appear to be covered!')
    
    # Summary
    print('\n' + '=' * 70)
    print('SUMMARY')
    print('=' * 70)
    
    total_missing = len(missing_links) + len(missing_suffixes)
    if total_missing == 0:
        print('\n✅ Implementation appears complete!')
        print('   All extracted scope accessors are covered.')
    else:
        print(f'\n⚠️  Found {total_missing} potentially missing accessors')
        print(f'   - {len(missing_links)} scope links')
        print(f'   - {len(missing_suffixes)} list iterator suffixes')
        print('\nReview the items above and add any that are genuine scope accessors.')
    
    print()


if __name__ == '__main__':
    main()
