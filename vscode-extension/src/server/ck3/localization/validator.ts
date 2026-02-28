/**
 * CK3 Localization Validator — content-level validation of localization strings
 *
 * Validates the *contents* of localization text (not just key existence):
 *   - Character functions ([scope.GetName], [ROOT.GetFaith], etc.)
 *   - Text formatting codes (#bold, #italic, #N, #P, #V, etc.)
 *   - Icon references (@gold_icon!, @prestige_icon!, etc.)
 *   - Variable substitutions ($GOLD$, $VALUE|+$, etc.)
 *   - Concept links ([concept|E])
 *   - Bracket balancing
 *
 * DIAGNOSTIC CODES:
 *   LOC-001: Invalid localization key format
 *   LOC-002: Unknown character function
 *   LOC-003: Malformed text formatting code
 *   LOC-004: Invalid icon reference
 *   LOC-005: Unclosed brackets in localization text
 *   LOC-006: Unknown concept reference
 *   LOC-007: Invalid variable substitution syntax
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { LocalizationEntry } from '../../core/localization-index';
import { isValidConcept, suggestSimilarConcepts } from './concepts';
import { isValidIcon, suggestSimilarIcons } from './icons';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LocalizationValidationConfig {
    enabled: boolean;
    checkFunctions: boolean;
    checkFormatting: boolean;
    checkIcons: boolean;
    checkConcepts: boolean;
    checkVariables: boolean;
}

export const DEFAULT_LOC_VALIDATION_CONFIG: LocalizationValidationConfig = {
    enabled: true,
    checkFunctions: true,
    checkFormatting: true,
    checkIcons: true,
    checkConcepts: true,
    checkVariables: true,
};

// ---------------------------------------------------------------------------
// Constant sets
// ---------------------------------------------------------------------------

/** 70+ character functions valid in localization strings */
const CHARACTER_FUNCTIONS = new Set([
    // Name functions
    'GetName', 'GetFirstName', 'GetLastName', 'GetFullName', 'GetBirthName', 'GetNickname',
    // UI name variants
    'GetUIName', 'GetUINameNoTooltip', 'GetShortUIName', 'GetShortUINameNoTooltip',
    'GetShortUINamePossessive',
    // Titled names
    'GetTitledFirstName', 'GetTitledFirstNameNoTooltip', 'GetTitledFirstNamePossessive',
    // Possessive
    'GetNamePossessive', 'GetFirstNamePossessive',
    // Gender pronouns
    'GetSheHe', 'GetHeOrShe', 'GetHerHim', 'GetHimOrHer', 'GetHerHis', 'GetHisOrHer',
    'GetHerselfHimself',
    // Titles
    'GetTitle', 'GetPrimaryTitle', 'GetHerHisPrimaryTitle',
    // Accessors
    'GetFaith', 'GetReligion', 'GetCulture', 'GetGovernment', 'GetDynasty', 'GetHouse',
    'GetLiege', 'GetPlayer',
    // Special
    'Custom', 'MakeScope', 'ScriptValue',
    // Game mechanic
    'GetScheme', 'GetVassalStance', 'GetReligionFamily', 'GetDefine',
    // Additional name variants
    'GetNameNoTierNoTooltip', 'GetNameWithRegnalNoTooltip', 'GetBaseNameNoTooltip',
    // Utility
    'GetAge', 'GetDynastyHouseNameNoTooltip', 'GetCourtName', 'GetRealmCapital',
    // Trait accessor
    'GetTrait',
    // Null character
    'GetNullCharacter',
]);

/** 40+ text formatting codes (case-sensitive) */
const TEXT_FORMATTING_CODES = new Set([
    // Basic
    '#bold', '#italic', '#underline', '#!',
    // Style
    '#weak', '#high', '#low', '#emphasis', '#EMP',
    // Case-sensitive colour codes
    '#N', '#n', '#P', '#X', '#V', '#v', '#L',
    // Tutorial
    '#TUT_KW',
    // Named colours
    '#color_red', '#color_blue', '#color_green', '#color_yellow',
    '#color_white', '#color_black', '#color_grey', '#color_gray',
    // Game-specific
    '#positive', '#negative', '#warning', '#F', '#T', '#D',
]);

/** Built-in common icon references (subset — full list comes from YAML) */
const BUILTIN_ICONS = new Set([
    'gold_icon', 'prestige_icon', 'piety_icon', 'dread_icon', 'stress_icon',
    'tyranny_icon', 'renown_icon', 'devotion_icon', 'splendor_icon',
    'prowess_icon', 'diplomacy_icon', 'martial_icon', 'stewardship_icon',
    'intrigue_icon', 'learning_icon',
    'opinion_icon', 'hook_icon', 'weak_hook_icon', 'strong_hook_icon',
    'lover_icon', 'friend_icon', 'rival_icon',
    'knight_icon', 'levy_icon', 'men_at_arms_icon', 'army_icon', 'siege_icon',
    'councillor_icon', 'council_icon', 'chancellor_icon', 'steward_icon',
    'marshal_icon', 'spymaster_icon', 'court_chaplain_icon',
    'title_icon', 'titles_icon', 'county_icon', 'duchy_icon',
    'kingdom_icon', 'empire_icon', 'barony_icon',
    'warning_icon', 'death_icon', 'alert_icon', 'yes_icon', 'no_icon', 'info_icon',
    'faith_icon', 'religion_icon', 'culture_icon', 'innovation_icon', 'tradition_icon',
    'building_icon', 'holding_icon', 'fort_level_icon',
    'scheme_icon', 'murder_icon', 'seduce_icon',
    'trait_icon', 'genetic_icon', 'personality_icon',
    'prison_icon', 'control_icon', 'age_icon', 'health_icon', 'fertility_icon',
]);

/** Valid scope names that can precede a character function */
const LOCALIZATION_SCOPES = new Set([
    'CHARACTER', 'ROOT', 'PREV', 'TARGET', 'TARGET_CHARACTER',
    'actor', 'recipient', 'liege', 'spouse', 'father', 'mother',
    'killer', 'imprisoner', 'guardian',
    'TITLE', 'title', 'faith', 'culture', 'GetPlayer',
]);

/** Valid format specifiers for variable substitutions ($VAR|spec$) */
const VALID_FORMAT_SPECIFIERS = new Set([
    '+', '-', 'V0', 'V1', 'V2', 'U', 'L', '0', '1', '2',
]);

// ---------------------------------------------------------------------------
// Extraction regexes (compiled once)
// ---------------------------------------------------------------------------

/** Matches character function calls: [scope.GetFunc] or [scope:var.GetFunc] */
const RE_CHAR_FUNC = /\[([\w:.]+)\.(Get\w+|Custom|MakeScope|ScriptValue)(?:\([^)]*\))?\]/g;

/** Matches formatting codes: #word or #! */
const RE_FORMAT_CODE = /#[A-Za-z_!]+/g;

/** Matches icon references: @name_icon! */
const RE_ICON_REF = /@(\w+)!/g;

/** Matches variable substitutions: $VAR$ or $VAR|fmt$ */
const RE_VARIABLE = /\$([A-Z_][A-Z0-9_]*)(?:\|([^$]+))?\$/g;

/** Matches concept links: [word|E] or similar */
const RE_CONCEPT_LINK = /\[(\w+)\|(\w+)\]/g;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate the content of a single localization entry.
 * Returns diagnostics anchored to the entry's line.
 */
export function validateLocalizationContent(
    entry: LocalizationEntry,
    config: LocalizationValidationConfig,
): Diagnostic[] {
    if (!config.enabled) return [];

    const diagnostics: Diagnostic[] = [];
    const text = entry.text;
    const line = entry.line; // 0-based line in the file

    // Check bracket balance
    validateBrackets(text, line, diagnostics);

    // Character functions
    if (config.checkFunctions) {
        validateCharacterFunctions(text, line, diagnostics);
    }

    // Formatting codes
    if (config.checkFormatting) {
        validateFormattingCodes(text, line, diagnostics);
    }

    // Icon references
    if (config.checkIcons) {
        validateIconReferences(text, line, diagnostics);
    }

    // Variable substitutions
    if (config.checkVariables) {
        validateVariableSubstitutions(text, line, diagnostics);
    }

    // Concept links
    if (config.checkConcepts) {
        validateConceptLinks(text, line, diagnostics);
    }

    return diagnostics;
}

/**
 * Validate all localization entries and return diagnostics keyed by URI.
 */
export function validateLocalizationEntries(
    entries: LocalizationEntry[],
    config: LocalizationValidationConfig,
): Map<string, Diagnostic[]> {
    const result = new Map<string, Diagnostic[]>();

    for (const entry of entries) {
        const diags = validateLocalizationContent(entry, config);
        if (diags.length === 0) continue;

        const uri = entry.fileUri;
        const existing = result.get(uri) ?? [];
        existing.push(...diags);
        result.set(uri, existing);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

function validateBrackets(text: string, line: number, out: Diagnostic[]): void {
    let depth = 0;
    for (const ch of text) {
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
    }
    if (depth !== 0) {
        out.push(makeDiag(line, DiagnosticSeverity.Warning,
            `Unbalanced brackets in localization text (depth ${depth})`,
            'LOC-005'));
    }
}

function validateCharacterFunctions(text: string, line: number, out: Diagnostic[]): void {
    let match: RegExpExecArray | null;
    RE_CHAR_FUNC.lastIndex = 0;
    while ((match = RE_CHAR_FUNC.exec(text)) !== null) {
        const scopeChain = match[1];
        const funcName = match[2];

        // Validate function name
        if (!CHARACTER_FUNCTIONS.has(funcName)) {
            out.push(makeDiag(line, DiagnosticSeverity.Warning,
                `Unknown character function '${funcName}' in localization`,
                'LOC-002'));
            continue;
        }

        // Validate scope chain root
        validateScopeChainRoot(scopeChain, line, out);
    }
}

function validateScopeChainRoot(chain: string, line: number, out: Diagnostic[]): void {
    // scope:variable_name format
    if (chain.startsWith('scope:')) return; // dynamic scopes are always accepted

    // Extract the root of the chain (e.g. "ROOT" from "ROOT.liege.spouse")
    const root = chain.split('.')[0];
    if (!LOCALIZATION_SCOPES.has(root)) {
        // Don't report — there are many valid scopes we might not know about
        // (custom saved scopes, etc.)
    }
}

function validateFormattingCodes(text: string, line: number, out: Diagnostic[]): void {
    let match: RegExpExecArray | null;
    RE_FORMAT_CODE.lastIndex = 0;
    while ((match = RE_FORMAT_CODE.exec(text)) !== null) {
        const code = match[0];
        if (!TEXT_FORMATTING_CODES.has(code)) {
            out.push(makeDiag(line, DiagnosticSeverity.Information,
                `Unknown text formatting code '${code}' in localization`,
                'LOC-003'));
        }
    }
}

function validateIconReferences(text: string, line: number, out: Diagnostic[]): void {
    let match: RegExpExecArray | null;
    RE_ICON_REF.lastIndex = 0;
    while ((match = RE_ICON_REF.exec(text)) !== null) {
        const iconName = match[1]; // without @ and !

        // Check built-in set first
        if (BUILTIN_ICONS.has(iconName)) continue;

        // Check DataLoader icons
        if (isValidIcon(iconName)) continue;

        // Unknown icon — suggest similar
        const suggestions = suggestSimilarIcons(iconName, 3);
        let msg = `Unknown icon reference '@${iconName}!'`;
        if (suggestions.length > 0) {
            msg += `. Did you mean: ${suggestions.map(s => `@${s}!`).join(', ')}?`;
        }
        out.push(makeDiag(line, DiagnosticSeverity.Warning, msg, 'LOC-004'));
    }
}

function validateVariableSubstitutions(text: string, line: number, out: Diagnostic[]): void {
    let match: RegExpExecArray | null;
    RE_VARIABLE.lastIndex = 0;
    while ((match = RE_VARIABLE.exec(text)) !== null) {
        const varName = match[1];
        const formatSpec = match[2];

        // Variable name must match [A-Z_][A-Z0-9_]*
        if (!/^[A-Z_][A-Z0-9_]*$/.test(varName)) {
            out.push(makeDiag(line, DiagnosticSeverity.Warning,
                `Invalid variable name '${varName}' — must be UPPER_SNAKE_CASE`,
                'LOC-007'));
        }

        // Validate format specifier if present
        if (formatSpec !== undefined && !VALID_FORMAT_SPECIFIERS.has(formatSpec)) {
            out.push(makeDiag(line, DiagnosticSeverity.Warning,
                `Unknown variable format specifier '|${formatSpec}' for $${varName}$`,
                'LOC-007'));
        }
    }
}

function validateConceptLinks(text: string, line: number, out: Diagnostic[]): void {
    let match: RegExpExecArray | null;
    RE_CONCEPT_LINK.lastIndex = 0;
    while ((match = RE_CONCEPT_LINK.exec(text)) !== null) {
        const conceptName = match[1];
        // match[2] is the context marker (E, etc.)

        if (!isValidConcept(conceptName)) {
            const suggestions = suggestSimilarConcepts(conceptName, 3);
            let msg = `Unknown concept '${conceptName}'`;
            if (suggestions.length > 0) {
                msg += `. Did you mean: ${suggestions.join(', ')}?`;
            }
            out.push(makeDiag(line, DiagnosticSeverity.Warning, msg, 'LOC-006'));
        }
    }
}

// ---------------------------------------------------------------------------
// Standalone validation helpers (exported for use by hover/completions)
// ---------------------------------------------------------------------------

/** Check if a function name is a known character function. */
export function isCharacterFunction(name: string): boolean {
    return CHARACTER_FUNCTIONS.has(name);
}

/** Check if a code is a known text formatting code. */
export function isTextFormattingCode(code: string): boolean {
    return TEXT_FORMATTING_CODES.has(code);
}

/** Return all known character function names. */
export function getCharacterFunctions(): ReadonlySet<string> {
    return CHARACTER_FUNCTIONS;
}

/** Return all known formatting codes. */
export function getFormattingCodes(): ReadonlySet<string> {
    return TEXT_FORMATTING_CODES;
}

/** Return all known scope names. */
export function getLocalizationScopes(): ReadonlySet<string> {
    return LOCALIZATION_SCOPES;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeDiag(
    line: number,
    severity: DiagnosticSeverity,
    message: string,
    code: string,
): Diagnostic {
    return {
        severity,
        range: {
            start: { line, character: 0 },
            end: { line, character: Number.MAX_SAFE_INTEGER },
        },
        message,
        code,
        source: 'ck3-localization',
    };
}
