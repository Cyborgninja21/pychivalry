/**
 * An installable extension file (`.vsix`) for the editor tests' update simulation (item 7.1
 * (c)), so that VS Code's own installer puts each version in place and replaces the one before,
 * as an update does. A `.vsix` is a zip archive holding the extension under `extension/` and a
 * manifest; this writes one with its files stored, not compressed, which needs nothing but
 * Node's own `zlib.crc32`. Test code: packaging the extension for users is item 7.10's.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { crc32 } from 'node:zlib';

interface ZipEntry {
    readonly name: string;
    readonly data: Buffer;
}

/** A zip archive of `entries`, each stored (method 0) with a UTF-8 name. */
export function storedZip(entries: readonly ZipEntry[]): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const nameBytes = Buffer.from(name, 'utf8');
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(0, 8); // stored
        local.writeUInt16LE(0, 10); // time
        local.writeUInt16LE(0x21, 12); // date: 1980-01-01
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4); // version made by
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0x21, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);
        locals.push(local, nameBytes, data);
        centrals.push(central, nameBytes);
        offset += local.length + nameBytes.length + data.length;
    }
    const centralSize = centrals.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, ...centrals, end]);
}

function filesUnder(dir: string, base = dir): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? filesUnder(full, base) : [path.relative(base, full)];
    });
}

function xml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Write `extensionDir` (its `package.json` and files) as the `.vsix` file `file`. */
export function writeVsix(file: string, extensionDir: string): void {
    const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8')) as {
        name: string;
        publisher: string;
        version: string;
        displayName?: string;
        description?: string;
    };
    const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${xml(manifest.name)}" Version="${xml(manifest.version)}" Publisher="${xml(manifest.publisher)}" />
    <DisplayName>${xml(manifest.displayName ?? manifest.name)}</DisplayName>
    <Description xml:space="preserve">${xml(manifest.description ?? '')}</Description>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`;
    const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".vsixmanifest" ContentType="text/xml"/><Default Extension=".cjs" ContentType="application/javascript"/><Default Extension=".mjs" ContentType="application/javascript"/><Default Extension=".gz" ContentType="application/gzip"/><Default Extension=".sha256" ContentType="text/plain"/><Default Extension=".md" ContentType="text/markdown"/></Types>
`;
    const entries: ZipEntry[] = [
        { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
        { name: 'extension.vsixmanifest', data: Buffer.from(vsixManifest, 'utf8') },
        ...filesUnder(extensionDir)
            .sort()
            .map((rel) => ({
                name: `extension/${rel.split(path.sep).join('/')}`,
                data: readFileSync(path.join(extensionDir, rel)),
            })),
    ];
    writeFileSync(file, storedZip(entries));
}
