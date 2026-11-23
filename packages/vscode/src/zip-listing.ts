/**
 * The entries of a zip archive, read from its central directory: each name with its stored and
 * its full size; and what the extension's `.vsix` may hold. The packaging script lists and
 * checks the file it wrote with them (`package.ts`). No decompression and no VS Code import. A
 * build script's helper, never shipped.
 */

/** One entry of a zip archive. */
export interface ZipEntry {
    readonly name: string;
    /** Its size in the archive, compressed. */
    readonly stored: number;
    /** Its size once extracted. */
    readonly size: number;
}

/** The entries of the zip archive `zip`, in the order its central directory lists them. */
export function zipEntries(zip: Buffer): ZipEntry[] {
    // The end of central directory record: 22 bytes, then a comment of at most 65,535 bytes.
    let end = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65_535); i--) {
        if (zip.readUInt32LE(i) === 0x06054b50) {
            end = i;
            break;
        }
    }
    if (end < 0) {
        throw new Error('not a zip archive: no end of central directory');
    }
    const count = zip.readUInt16LE(end + 10);
    let at = zip.readUInt32LE(end + 16);
    const entries: ZipEntry[] = [];
    for (let n = 0; n < count; n++) {
        if (zip.readUInt32LE(at) !== 0x02014b50) {
            throw new Error(`not a zip archive: entry ${String(n)} has no central header`);
        }
        const stored = zip.readUInt32LE(at + 20);
        const size = zip.readUInt32LE(at + 24);
        const nameLength = zip.readUInt16LE(at + 28);
        const extraLength = zip.readUInt16LE(at + 30);
        const commentLength = zip.readUInt16LE(at + 32);
        const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
        entries.push({ name, stored, size });
        at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

/** What the `.vsix` may hold: its own two files, then the extension's. */
const ALLOWED = [
    /^\[Content_Types\]\.xml$/,
    /^extension\.vsixmanifest$/,
    /^extension\/package\.json$/,
    /^extension\/readme\.md$/i,
    /^extension\/license(\.txt)?$/i,
    /^extension\/dist\/bundle\/extension\.cjs$/,
    /^extension\/dist\/bundle\/lsp\/pychivalry-lsp\.mjs$/,
    /^extension\/dist\/bundle\/lsp\/presentation\/([a-z0-9_]+\/)*[a-z0-9_]+\.json$/,
    /^extension\/dist\/bundle\/server\/(pychivalry-mcp\.mjs|pychivalry-cli\.mjs|manifest\.json)$/,
    /^extension\/dist\/bundle\/server\/spec\/ck3-spec-[0-9.]+(\.[a-z_]+)?\.(json\.gz|sha256)$/,
];

/** What must never ship, whatever the allowed list says. */
const REFUSED =
    /(^|\/)(legacy|src|fixtures|test-bundle|node_modules|records|tools)\/|\.(ts|map)$|\.test\./;

/** The entries that must not be in the file: not allowed, or refused. */
export function unwanted(entries: readonly ZipEntry[]): string[] {
    return entries
        .map((e) => e.name)
        .filter((name) => REFUSED.test(name) || !ALLOWED.some((a) => a.test(name)));
}
