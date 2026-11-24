import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { decodeScript, decodeWindows1252, invalidUtf8 } from './decode.js';
import { findingMessage } from './findings.js';
import { readScript } from './read.js';
import { fixtureMods, summary } from './testing.js';

const encoder = new TextEncoder();
const fixture = readFileSync(
    path.join(fixtureMods, 'encoding-windows-1252', 'history', 'titles', 'k_fixture.txt'),
);

test('valid UTF-8 is read as it is, with no finding', () => {
    const decoded = decodeScript(encoder.encode('name = "Gerëon" # ✓\n'));
    assert.equal(decoded.text, 'name = "Gerëon" # ✓\n');
    assert.equal(decoded.bom, false);
    assert.equal(decoded.encoding, 'utf-8');
    assert.equal(decoded.validUtf8, true);
    assert.equal(decoded.invalidBytes, 0);
    assert.deepEqual(decoded.findings, []);
});

test('the byte-order mark is removed and reported, and is not part of the text', () => {
    const decoded = decodeScript(new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('a = b')]));
    assert.equal(decoded.bom, true);
    assert.equal(decoded.text, 'a = b');
    const file = readScript(new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('a = b')]));
    assert.equal(file.bom, true);
    assert.equal(file.file.items[0]?.start, 0);
});

test('a file that is not valid UTF-8 is read in full, each bad byte a replacement character', () => {
    const file = readScript(fixture);
    assert.equal(file.encoding, 'utf-8');
    assert.equal(file.validUtf8, false);
    assert.deepEqual(file.findings, [], 'the parse itself finds nothing');
    assert.equal(file.text.split('\uFFFD').length - 1, 4);
    assert.equal(
        summary(file.file.items),
        '(# Title history for a fixture title; its holders are named in comments.) k_fixture = { 1066.1.1 = { holder = 1001 } (# Ren\uFFFD the Elder) 1100.1.1 = { holder = 1002 } (# Ren\uFFFD the Younger, son of Ren\uFFFD) 1150.1.1 = { holder = 1003 name = "Ger\uFFFDon" } }',
    );
});

test('one information note per file says it is not valid UTF-8, at the first bad byte', () => {
    const file = readScript(fixture);
    assert.equal(file.allFindings.length, 1);
    const [note] = file.allFindings;
    assert.ok(note !== undefined);
    assert.equal(note.id, 'encoding/not-utf8');
    assert.equal(note.severity, 'information');
    assert.deepEqual(note.evidence, { kind: 'advice' });
    assert.deepEqual(note.args, ['4', 'UTF-8 with replacement characters']);
    assert.deepEqual(note.range.start, { line: 2, character: 35 });
    assert.equal(file.text.charAt(note.start), '\uFFFD');
    assert.equal(
        findingMessage(note),
        'This file is not valid UTF-8 (4 invalid bytes); it was read as UTF-8 with replacement characters.',
    );
});

test('with the Windows-1252 fallback such a file reads its letters correctly', () => {
    const file = readScript(fixture, { fallbackEncoding: 'windows-1252' });
    assert.equal(file.encoding, 'windows-1252');
    assert.equal(file.validUtf8, false);
    assert.deepEqual(file.findings, []);
    assert.equal(
        summary(file.file.items),
        '(# Title history for a fixture title; its holders are named in comments.) k_fixture = { 1066.1.1 = { holder = 1001 } (# René the Elder) 1100.1.1 = { holder = 1002 } (# René the Younger, son of René) 1150.1.1 = { holder = 1003 name = "Geréon" } }',
    );
    const [note] = file.allFindings;
    assert.equal(note?.id, 'encoding/not-utf8');
    assert.deepEqual(note.args, ['4', 'UTF-8, with its invalid bytes read as Windows-1252']);
    assert.equal(file.text.charAt(note.start), 'é');
});

test('the fallback is off by default, and valid UTF-8 never uses it', () => {
    assert.equal(decodeScript(fixture).encoding, 'utf-8');
    const valid = decodeScript(encoder.encode('a = "é"'), { fallbackEncoding: 'windows-1252' });
    assert.equal(valid.encoding, 'utf-8');
    assert.equal(valid.text, 'a = "é"');
});

test('positions stay correct on both paths: each is counted in the text that path produced', () => {
    // A valid two-byte UTF-8 letter, then a Windows-1252 byte, then a token on the same line.
    const bytes = new Uint8Array([
        ...encoder.encode('key = "'),
        0xc3,
        0xa9,
        0x20,
        0xe9,
        ...encoder.encode('" next = 1\nlast = 2'),
    ]);
    const expect = (fallback: boolean, character: number): void => {
        const file = readScript(bytes, fallback ? { fallbackEncoding: 'windows-1252' } : {});
        const next = file.file.items[1];
        assert.equal(next?.kind === 'pair' ? next.key.text : undefined, 'next');
        assert.deepEqual(file.lines.positionAt(next?.start ?? -1), { line: 0, character });
        assert.equal(file.text.slice(next?.start, (next?.start ?? 0) + 4), 'next');
        const last = file.file.items[2];
        assert.deepEqual(file.lines.positionAt(last?.start ?? -1), { line: 1, character: 0 });
    };
    // UTF-8: `é` is one character and the bad byte one U+FFFD.
    expect(false, 12);
    // The fallback: the valid `é` stays one character and the bad byte reads as one `é`.
    expect(true, 12);
});

test('the fallback reads only the invalid bytes: valid UTF-8 letters in the same file stay', () => {
    // `Niccolò` in valid UTF-8 beside `René` with a Windows-1252 byte, as two base-game files mix them.
    const bytes = new Uint8Array([
        ...encoder.encode('# Niccolò and Ren'),
        0xe9,
        ...encoder.encode('\na = "€'),
        0x80,
        ...encoder.encode('"'),
    ]);
    const file = decodeScript(bytes, { fallbackEncoding: 'windows-1252' });
    assert.equal(file.text, '# Niccolò and René\na = "€€"');
    assert.equal(file.invalidBytes, 2);
    assert.equal(file.text.charAt(file.findings[0]?.start ?? -1), 'é');
    // A sequence cut short is invalid together with the bytes of it that were read.
    const cut = decodeScript(new Uint8Array([0x61, 0xe2, 0x82, 0x62]), {
        fallbackEncoding: 'windows-1252',
    });
    assert.equal(cut.text, 'aâ‚b');
});

test('Windows-1252 decoding agrees with the WHATWG decoder for every byte', () => {
    const all = new Uint8Array(256).map((_, n) => n);
    assert.equal(decodeWindows1252(all), new TextDecoder('windows-1252').decode(all));
});

test('invalid UTF-8 is counted in bytes, by the WHATWG rules', () => {
    const cases: [number[], number, number][] = [
        [[0x61, 0x62], 0, -1],
        [[0xf0, 0x9f, 0x98, 0x80], 0, -1],
        [[0x80], 1, 0],
        [[0x61, 0xc3], 1, 1],
        [[0xe2, 0x82, 0x61], 2, 0],
        [[0xc0, 0x80], 2, 0],
        [[0xed, 0xa0, 0x80], 3, 0],
        [[0xf4, 0x90, 0x80, 0x80], 4, 0],
        [[0x61, 0xe9, 0x62, 0xe9], 2, 1],
    ];
    for (const [bytes, count, first] of cases) {
        assert.deepEqual(invalidUtf8(new Uint8Array(bytes)), { bytes: count, first }, bytes.join());
    }
});

test('a UTF-16 file is read as UTF-8 like any other, with the note', () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x3d, 0x00, 0x62, 0x00]);
    const file = readScript(utf16);
    assert.equal(file.validUtf8, false);
    assert.equal(file.allFindings[0]?.id, 'encoding/not-utf8');
    assert.equal(file.file.kind, 'file');
});

test('each invalid stretch is recorded with its place in the text and its Windows-1252 letters', () => {
    const cases: number[][] = [
        [0x61, 0xe9, 0x62, 0xe9],
        [0xe2, 0x82, 0x61, 0xc3],
        [0xc0, 0x80, 0x61, 0xf4, 0x90, 0x80, 0x80],
        [0xc3, 0xa9, 0x20, 0xe9, 0x20, 0xf0, 0x9f, 0x98, 0x80, 0x81],
    ];
    for (const bytes of cases) {
        const input = new Uint8Array(bytes);
        const plain = decodeScript(input);
        // Read as UTF-8 the text is what the WHATWG decoder gives, one U+FFFD a stretch.
        assert.equal(plain.text, new TextDecoder('utf-8').decode(input), bytes.join());
        const fallback = decodeScript(input, { fallbackEncoding: 'windows-1252' });
        assert.equal(plain.invalid.length, fallback.invalid.length);
        plain.invalid.forEach((stretch, i) => {
            assert.equal(plain.text.slice(stretch.start, stretch.end), '�');
            const other = fallback.invalid[i];
            assert.equal(other?.windows1252, stretch.windows1252);
            assert.equal(fallback.text.slice(other.start, other.end), stretch.windows1252);
        });
        assert.deepEqual(plain.findings[0]?.invalid, plain.invalid);
    }
    const file = decodeScript(fixture);
    assert.deepEqual(
        file.invalid.map((s) => s.windows1252),
        ['é', 'é', 'é', 'é'],
    );
    assert.deepEqual(decodeScript(encoder.encode('a = b')).invalid, []);
});
