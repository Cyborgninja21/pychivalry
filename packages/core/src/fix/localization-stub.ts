/**
 * The fix of `localization/missing-key`: a localization stub for the key, written into the
 * mod's own localization files, never into the base game's (release 2.3.0's `CK4100` fix,
 * which only copied a stub to the clipboard).
 *
 * - **Where:** one file of the mod's own, of English when the mod has English localization,
 *   otherwise of the first language it has in code-point order: the file named for the script
 *   file the key is used in (`events/my_events.txt` gives `my_events_l_<language>.yml`) when the
 *   mod has it, otherwise the first of that language in code-point order. One language is
 *   enough for the game to know the key; the text is written there first, and the other
 *   languages follow it. A file without the byte-order mark is passed over (the game reads no
 *   key from it: part D1's `msg-localization-missing-bom`), and so is one under a `replace`
 *   folder. A mod with no such file gets one: `localization/english/<script file>_l_english.yml`,
 *   with the byte-order mark and the header line `l_english:` the game needs.
 * - **What:** ` <key>:0 "<key>"`, a line at the end of the file. The text is the key itself:
 *   what the game shows for a missing key, now without the error, until it is written.
 * - **A suggestion,** never safe: the key may be a misspelling of one that exists, and the text
 *   is the modder's to write. No fix for literal text written where a key goes (a key with a
 *   space in it): the game reads it as a key no file can define.
 */

import { layerKind } from '../index/order.js';
import { dataText, type FixableFinding, type FixFile } from './file.js';
import { suggestion, type FindingFix, type FixEdit } from './fix.js';

/** A key a localization file can define: what its reader reads before the `:`. */
const KEY = /^[^\s:#"]+$/;

/**
 * The language a stub goes in when the mod has it, and the one a new file is made for. A
 * choice of this fix, not of the game: one language is enough for the key to be defined, and
 * the stub's text, the key itself, is the same in any language.
 */
const ENGLISH = 'english';

/** The language a localization file is named for: `<name>_l_<language>.yml`. */
const LANGUAGE = /_l_([a-z_]+)\.yml$/;

/** The stem of a script file's name: `events/my_events.txt` is `my_events`. */
function stemOf(file: string): string {
    const name = file.slice(file.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return dot <= 0 ? name : name.slice(0, dot);
}

/** The mod's localization files that define keys, by language, each list sorted. */
function modFiles(file: FixFile): Map<string, string[]> {
    const byLanguage = new Map<string, string[]>();
    for (const f of file.input.index?.allFiles() ?? []) {
        if (
            layerKind(f.layer) !== 'mod' ||
            f.kind !== 'localization' ||
            f.noDefinitions !== null ||
            f.path.split('/').some((segment) => segment.toLowerCase() === 'replace')
        ) {
            continue;
        }
        const language = LANGUAGE.exec(f.path.toLowerCase())?.[1];
        if (language === undefined) {
            continue;
        }
        byLanguage.set(language, [...(byLanguage.get(language) ?? []), f.path]);
    }
    for (const list of byLanguage.values()) {
        list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    return byLanguage;
}

/** An insertion of `line` at the end of a file's text (its byte-order mark not counted). */
function appendLine(path: string, source: string, line: string): FixEdit {
    const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
    const nl = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r\n|\r|\n/);
    const last = lines.length - 1;
    const end = { line: last, character: lines[last]?.length ?? 0 };
    const endsInBreak = text === '' || /[\r\n]$/.test(text);
    return {
        file: path,
        range: { start: end, end },
        new_text: endsInBreak ? `${line}${nl}` : `${nl}${line}${nl}`,
    };
}

export function localizationStubFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const key = dataText(finding.data, 'key');
    const read = file.input.modText;
    if (key === null || !KEY.test(key) || read === undefined || file.input.index === undefined) {
        return null;
    }
    const entry = ` ${key}:0 "${key}"`;
    const stem = stemOf(file.file);
    const edits: FixEdit[] = [];
    const languages = [...modFiles(file)].sort(([a], [b]) => (a < b ? -1 : 1));
    const chosen = languages.find(([language]) => language === ENGLISH) ?? languages[0];
    if (chosen !== undefined) {
        const [language, paths] = chosen;
        const named = paths.find((p) => p.toLowerCase().endsWith(`/${stem}_l_${language}.yml`));
        const path = named ?? paths[0];
        const source = path === undefined ? null : read(path);
        if (path !== undefined && source !== null) {
            edits.push(appendLine(path, source, entry));
        }
    }
    if (edits.length === 0) {
        const path = `localization/${ENGLISH}/${stem}_l_${ENGLISH}.yml`;
        if (read(path) !== null) {
            return null;
        }
        edits.push({
            file: path,
            create: true,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            new_text: `\ufeffl_${ENGLISH}:\n${entry}\n`,
        });
    }
    return suggestion('localization-files', [
        { title: `Add a localization stub for '${key}' to ${edits[0]?.file ?? ''}`, edits },
    ]);
}
