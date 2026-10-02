/**
 * Example Mod Validation Test Suite (Phase 4: engine pipeline + plug-ins)
 *
 * Every file of the mock CK3 mod (`src/test/fixtures/mock-ck3-mod/`, mirrored byte for
 * byte by the numbered sections of `example mod/`) goes through the extension's
 * diagnostics provider: the engine pipeline (pychivalry-engine `diagnose`) with the
 * extension's plug-ins (server/plugins.ts), or the localization validator for .yml files.
 *
 * - good_* files: their Error/Warning diagnostics must be exactly the known findings:
 *   the engine's, recorded with reasons in packages/engine/test/fixtures/
 *   corpus-expectations.json (the fixtures contain real defects the game rejects), plus
 *   the plug-in findings listed in KNOWN_PLUGIN_FINDINGS below, each with its reason.
 * - bad_* files: every annotated code (`# ERROR: CODE`) that a plug-in still emits must
 *   be reported, and so must every engine finding the corpus expectations record for the
 *   file (line-exact; written by hand in Phase 3 from the fixtures' intent). Annotated
 *   codes the Phase 4 kill list retired are listed in CODE_CHANGES with the engine check
 *   that now covers the defect class (`now`) or none, and why. Their annotations are not
 *   asserted one by one: several mark keys the engine-derived spec accepts (they were
 *   false positives of the scraped vocabulary), and the engine's own verdicts per line
 *   are what the corpus expectations assert.
 *
 * The fixtures themselves are unchanged (the corpus test asserts the twins are identical).
 * Runs as part of `npm run test:unit` — no VS Code host required.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { LocalizationIndex, pathToUri, Workspace } from 'pychivalry-engine';
import { DiagnosticsProvider } from '../../server/lsp/diagnostics';
import { enginePlugins, localizationDiagnostics } from '../../server/plugins';
import { loadExtractedTraits } from '../../server/data/traits';
import { DataLoader } from '../../server/data/loader';
import {
    discoverExampleFiles,
    getMockModRoot,
    extractExpectedCodes,
    createDoc,
    formatDiags,
    printSummaryTable,
    writeJsonReport,
    TestResult,
} from './helpers/example-mod-helpers';

/** Engine catalogue ids of parse errors (the old PARSE-NNN were numbered per file). */
const PARSE_CODES = [
    'expected_between_block_name_and_body',
    'expected_between_equals_and_arguments',
    'expected_after_arguments',
    'unexpected_token_expected_key',
    'unexpected_token_X_found_at_X_expected',
    'PYCH-P001',
    'PYCH-P002',
];

interface CodeChange {
    /** Codes of which at least one must be reported instead; empty = no replacement. */
    now: string[];
    why: string;
}

/**
 * How each annotated code that is no longer emitted is handled. Codes not listed here are
 * still emitted unchanged by a plug-in (plugins.ts).
 */
export const CODE_CHANGES: Record<string, CodeChange> = {
    CK3101: {
        now: ['unknown_trigger_X'],
        why: 'old unknown-trigger check; the engine registry reports it with the game text',
    },
    CK3103: {
        now: ['unknown_effect_X'],
        why: 'old unknown-effect check; the engine registry reports it with the game text',
    },
    CK3870: {
        now: ['unknown_trigger_X'],
        why: 'effect in a trigger block: the registry judges keys by (name, context)',
    },
    CK3871: { now: ['unknown_trigger_X'], why: 'effect in a limit block: same registry check' },
    CK3976: {
        now: ['unknown_trigger_X'],
        why: 'effect in an any_ iterator: the iterator body is trigger context',
    },
    'ITER-001': { now: ['unknown_trigger_X'], why: 'effect in an any_ iterator: registry check' },
    'ITER-002': {
        now: [],
        why: 'heuristic (every_ block without obvious effects); the registry judges each key, nothing else is known',
    },
    'PARSE-001': {
        now: PARSE_CODES,
        why: 'parser errors now carry the engine catalogue id and text',
    },
    'PARSE-002': {
        now: PARSE_CODES,
        why: 'parser errors now carry the engine catalogue id and text',
    },
    'PARSE-003': {
        now: PARSE_CODES,
        why: 'parser errors now carry the engine catalogue id and text',
    },
    'PARSE-004': {
        now: PARSE_CODES,
        why: 'parser errors now carry the engine catalogue id and text',
    },
    'SCOPE-003': {
        now: ['failed_to_parse_data_for_event_target_link_link_X_location_X'],
        why: 'invalid scope chain: the engine scope check walks chains link by link',
    },
    'SCOPE-006': {
        now: ['wrong_scope_for_trigger_X_expected_X', 'wrong_scope_for_effect_X_expected_X'],
        why: "iterator used in a scope its list does not support: the engine's scope check, on the game's own scope_validity (2.1); unknown list bases are unknown_trigger_X/unknown_effect_X",
    },
    'SCOPE-007': {
        now: [],
        why: 'undefined saved scope: the engine reports undefined_event_target_X only with a vanilla base game loaded',
    },
    'EVENT-008': { now: ['PYCH-S003'], why: 'event content outside events/: engine schema check' },
    'EVENT-018': {
        now: ['PYCH-S003'],
        why: 'event content in a non-event directory: engine schema check',
    },
    'EVENT-017': {
        now: [],
        why: 'non-event content in events/: the records are judged by the events schema; the fixture asset paths are not schema fields',
    },
    'HOOK-001': {
        now: ['unknown_X_in_X'],
        why: 'unknown interaction hook: the character_interactions schema lists the 150 engine hooks',
    },
    'INTERACT-002': {
        now: [],
        why: 'unreachable on_decline with auto_accept: wiki-era interaction rule the engine does not enforce',
    },
    'INTERACT-003': {
        now: [],
        why: 'interaction category list: wiki-era enum, not engine-evidenced',
    },
    'INTERACT-004': {
        now: [],
        why: 'missing is_shown: the package marks no interaction field required',
    },
    'DECISION-001': { now: [], why: 'missing ai_check_interval: not an engine-required field' },
    'ON_ACTION-001': {
        now: [],
        why: 'on_action without effects or events: not engine-evidenced (and the file is not in common/on_action/)',
    },
    'SCHEME-001': { now: [], why: 'missing skill: not an engine-required field' },
    'SCHEME-002': { now: [], why: 'no lifecycle effects: wiki-era scheme rule' },
    'SCHEME-004': { now: [], why: 'skill value list: wiki-era enum' },
    'ACT-001': {
        now: [],
        why: 'activity rule (the file is not in the loaded common/activities/activity_types/)',
    },
    'ACT-002': { now: [], why: 'activity rule (see ACT-001)' },
    'ACT-003': { now: [], why: 'activity rule (see ACT-001)' },
    'ACT-004': { now: [], why: 'activity rule (see ACT-001)' },
    'ACT-005': { now: [], why: 'activity rule (see ACT-001)' },
    'COURT-001': {
        now: [],
        why: 'court-position rule (the file is not in the loaded common/court_positions/types/)',
    },
    'COURT-002': { now: [], why: 'court-position rule (see COURT-001)' },
    'CB-001': { now: [], why: 'casus-belli outcome rule the package does not encode' },
    'CB-002': { now: [], why: 'casus-belli cost-type list: wiki-era enum' },
    'MOD-002': {
        now: [],
        why: 'non-numeric modifier value: modifiers.ts retired with its unknown-modifier check (now unknown_modifier_type_X_at_X)',
    },
};

interface KnownFinding {
    line: number;
    code: string;
    why: string;
}

/**
 * Annotations of a code that a plug-in still emits but whose annotated instance came
 * from a retired validator or from a plug-in false positive since fixed, keyed by
 * mock-mod-relative path.
 */
export const RETIRED_ANNOTATIONS: Record<string, Record<string, string>> = {
    'events/bad_scope_timing.txt': {
        CK3701: 'the annotated instance (line 167, `has_variable = quest_started` in trigger, set in immediate) is the false positive fixed in Phase 5: the variables plug-in now counts a declaration anywhere in the file (the same pattern is valid in good_scopes.txt); the defect is the timing one, reported as CK3553 by scope-timing',
    },
    'common/script_values/bad_script_values.txt': {
        CK3872: 'the annotated redundant has_trait check came from generic-rules.ts (retired: a heuristic, not engine behaviour); paradox-checks still emits CK3872 for always = yes',
    },
};

/**
 * Error/Warning plug-in findings on good_* files that are correct (the fixture has the
 * defect), keyed by mock-mod-relative path.
 */
export const KNOWN_PLUGIN_FINDINGS: Record<string, KnownFinding[]> = {
    'events/good_switch.txt': [
        {
            line: 111,
            code: 'SWITCH-003',
            why: 'the nested switch header `trigger = has_education_trait` names no trigger of the 1.20.0.2 spec package (the name came from the scraped trigger list) and no workspace scripted trigger; vanilla scripted triggers were not checked (no game data on this box)',
        },
    ],
    'events/good_traits.txt': [
        {
            line: 210,
            code: 'CK3800',
            why: '`remove_trait = stressed_1`: the extracted trait data (data/traits/health.yaml) has depressed_1 but no stressed_1 trait',
        },
    ],
};

interface CorpusEntry {
    line: number;
    code: string;
}

interface CorpusExpectations {
    good: Record<string, CorpusEntry[]>;
    bad: Record<string, CorpusEntry[]>;
}

/** The engine's corpus expectations (Phase 3): known good_* findings, expected bad_* ones. */
function corpusExpectations(): CorpusExpectations {
    const file = path.resolve(
        getMockModRoot(),
        '..',
        '..',
        '..',
        '..',
        '..',
        'packages',
        'engine',
        'test',
        'fixtures',
        'corpus-expectations.json'
    );
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        good: Record<string, { known: CorpusEntry[] }>;
        bad: Record<string, { expected: CorpusEntry[] }>;
    };
    const out: CorpusExpectations = { good: {}, bad: {} };
    for (const [rel, value] of Object.entries(data.good)) {
        out.good[rel] = value.known.map((k) => ({ line: k.line, code: k.code }));
    }
    for (const [rel, value] of Object.entries(data.bad)) {
        out.bad[rel] = value.expected.map((k) => ({ line: k.line, code: k.code }));
    }
    return out;
}

function key(line: number, code: string): string {
    return `${line} ${code}`;
}

describe('Example Mod Validation', () => {
    const mockModRoot = getMockModRoot();
    const corpus = corpusExpectations();
    const engineKnown = corpus.good;
    const results: TestResult[] = [];
    let provider: DiagnosticsProvider;

    before(async function () {
        this.timeout(20_000);
        const workspace = new Workspace(mockModRoot).load();
        const localization = new LocalizationIndex();
        await localization.scanDirectory(mockModRoot);
        const repoData = path.resolve(mockModRoot, '..', '..', '..', '..', '..', 'data');
        // Concepts and icons (localization validator) are optional game data in data/.
        await DataLoader.getInstance(repoData).initialize(repoData);
        const traits = loadExtractedTraits(repoData);
        provider = new DiagnosticsProvider(
            workspace,
            enginePlugins({ localization, extractedTraits: () => traits }),
            localization,
            localizationDiagnostics
        );
    });

    after(() => {
        printSummaryTable(results);
        writeJsonReport(results);
    });

    const allEntries = discoverExampleFiles();
    const sections = [...new Set(allEntries.map((e) => e.sectionDir))].sort();

    for (const section of sections) {
        describe(section, () => {
            for (const entry of allEntries.filter((e) => e.sectionDir === section)) {
                it(`[${entry.expectation}] ${entry.fileName}`, async () => {
                    const content = fs.readFileSync(entry.filePath, 'utf-8');
                    const rel = path
                        .relative(mockModRoot, entry.filePath)
                        .split(path.sep)
                        .join('/');
                    const diagnostics: Diagnostic[] = await provider.provideDiagnostics(
                        createDoc(content, pathToUri(entry.filePath))
                    );
                    const result: TestResult = {
                        section: entry.sectionDir,
                        fileName: entry.fileName,
                        expectation: entry.expectation,
                        status: 'pass',
                        actualCodes: diagnostics.map((d) => String(d.code)),
                    };

                    if (entry.expectation === 'good') {
                        const errors = diagnostics.filter(
                            (d) =>
                                d.severity === DiagnosticSeverity.Error ||
                                d.severity === DiagnosticSeverity.Warning
                        );
                        const known = [
                            ...(engineKnown[rel] ?? []),
                            ...(KNOWN_PLUGIN_FINDINGS[rel] ?? []),
                        ];
                        const actual = errors
                            .map((d) => key(d.range.start.line + 1, String(d.code)))
                            .sort();
                        const expected = known.map((k) => key(k.line, k.code)).sort();
                        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                            result.status = 'fail';
                            result.failureReason = `Unexpected Error/Warning diagnostics:\n${formatDiags(errors)}`;
                        }
                        results.push(result);
                        assert.deepStrictEqual(
                            actual,
                            expected,
                            `Error/Warning diagnostics differ from the known findings:\n${formatDiags(errors)}`
                        );
                    } else {
                        const actualCodes = new Set(diagnostics.map((d) => String(d.code)));
                        const actualAt = new Set(
                            diagnostics.map((d) => key(d.range.start.line + 1, String(d.code)))
                        );
                        const missing: string[] = [];
                        const retiredHere = RETIRED_ANNOTATIONS[rel] ?? {};
                        for (const code of extractExpectedCodes(content)) {
                            if (CODE_CHANGES[code] || retiredHere[code]) {
                                continue; // retired; see CODE_CHANGES / RETIRED_ANNOTATIONS
                            }
                            if (!actualCodes.has(code)) {
                                missing.push(code);
                            }
                        }
                        for (const e of corpus.bad[rel] ?? []) {
                            if (!actualAt.has(key(e.line, e.code))) {
                                missing.push(`engine ${e.code} at line ${e.line}`);
                            }
                        }
                        result.expectedCodes = [...extractExpectedCodes(content)];
                        if (missing.length > 0) {
                            result.status = 'fail';
                            result.failureReason = `Missing: ${missing.join(', ')}`;
                        }
                        results.push(result);
                        assert.deepStrictEqual(
                            missing,
                            [],
                            `Missing expected diagnostics.\n  Actual: [${[...actualCodes].join(', ')}]`
                        );
                    }
                });
            }
        });
    }
});
