/**
 * The part of docs/game-log.md written from the code (`task docs:game-log`): what the matcher
 * makes of the spec package's catalogue, and per family of messages what their values can be tied
 * to (the core's `catalogueCoverage`). A test holds the committed page to it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    catalogueCoverage,
    openSpec,
    type CatalogueCoverage,
    type FamilyRow,
} from '@pychivalry/core';

/** The page, from the repository root. */
export const GAME_LOG_PAGE = 'docs/game-log.md';

export const START = '<!-- written by task docs:game-log: start -->';
export const END = '<!-- written by task docs:game-log: end -->';

function count(n: number): string {
    return n.toLocaleString('en-US');
}

/** What a family's messages can be tied to, from its counts. */
export function tieCell(f: FamilyRow): string {
    if (f.matched === 0) {
        return 'Not matched: the package marks every entry as no message';
    }
    const parts: string[] = [];
    if (f.with_line > 0) {
        parts.push(
            `${count(f.with_line)} a file and line their own text names (\`line %d\`, \`<file>:%d\`)`,
        );
    }
    if (f.give_a_place > 0) {
        parts.push(
            `${count(f.give_a_place)} a place as the script reader prints it (\`at {}\`): the file found in it, the line not known before a capture`,
        );
    }
    if (f.with_text > 0) {
        parts.push(
            `${count(f.with_text)} a value that may name a file, a definition, or a name the mod writes`,
        );
    }
    if (f.no_value > 0) {
        parts.push(`${count(f.no_value)} no value: nothing to tie`);
    }
    return parts.join('; ');
}

/** The generated part of the page. */
export function gameLogSection(version: string, c: CatalogueCoverage): string {
    const inGroups = c.ambiguous.reduce((n, g) => n + g.length, 0);
    const lines = [
        START,
        '',
        `The catalogue of the committed spec package (game ${version}) holds ${count(c.entries)} messages. The matcher matches ${count(c.matched)} of them; it leaves out ${count(c.notMatched.notAMessage.length)} the package marks as no message at all (subject \`not_a_message\`: C++ type names, paths, identifiers, lines of the game's own documentation) and ${count(c.notMatched.tooLittleFixedText.length)} whose fixed text holds fewer than two words of three letters or more, which would match lines that are not them. On a line made from each matched template (its values filled with stand-ins, after a stand-in prefix no game writes), ${count(c.alone)} are found alone, ${count(inGroups)} in ${count(c.ambiguous.length)} groups whose members match one another's lines equally well, ${count(c.shadowed.length)} are beaten by another template, and ${count(c.notFound.length)} are not found. ${count(c.spans.length)} templates span more than one line.`,
        '',
        '| Family (`subject`) | Entries | Matched | With a line | With a text value | Give a place | No value | What a message can be tied to |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
        ...c.families.map(
            (f) =>
                `| \`${f.subject}\` | ${count(f.entries)} | ${count(f.matched)} | ${count(f.with_line)} | ${count(f.with_text)} | ${count(f.give_a_place)} | ${count(f.no_value)} | ${tieCell(f)} |`,
        ),
        '',
        '"With a line": a value the message\'s own text says is a line number. "Give a place": the package\'s reason for the entry is `script_position`, "the message gives the place in a script file the game read, as the script reader prints it". A message can fall in several columns.',
        '',
        '**Ambiguous** (several entries match one line equally well; a line they match names them all and picks none):',
        '',
        ...c.ambiguous.map((g) => `- ${g.map((id) => `\`${id}\``).join(', ')}`),
        '',
        '**Too little fixed text** (not matched):',
        '',
        c.notMatched.tooLittleFixedText.map((id) => `\`${id}\``).join(', '),
        '',
        `**More than one line:** ${c.spans.map((id) => `\`${id}\``).join(', ')}.`,
        '',
        END,
    ];
    return lines.join('\n');
}

/** The page as the code would write it. */
export function currentGameLogPage(root: string): string {
    const page = readFileSync(path.join(root, GAME_LOG_PAGE), 'utf8').replace(/\r\n/g, '\n');
    const start = page.indexOf(START);
    const end = page.indexOf(END);
    if (start < 0 || end < start) {
        throw new Error(`${GAME_LOG_PAGE} has no part written by task docs:game-log`);
    }
    const spec = openSpec(path.join(root, 'spec'));
    return (
        page.slice(0, start) +
        gameLogSection(spec.version, catalogueCoverage(spec)) +
        page.slice(end + END.length)
    );
}

/** Write the page's generated part; returns the file. */
export function writeGameLogReference(root: string): string {
    const file = path.join(root, GAME_LOG_PAGE);
    writeFileSync(file, currentGameLogPage(root));
    return file;
}
