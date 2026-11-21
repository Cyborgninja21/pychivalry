/** Fixtures the tools' tests build in a temporary folder, removed when the test ends. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';

/** A fresh temporary folder, removed after the test. */
export function tempDir(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-tools-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** Write each file of `files` (relative path to content) under `root`. */
export function writeTree(root: string, files: Record<string, string | Uint8Array>): void {
    for (const [rel, content] of Object.entries(files)) {
        const file = path.join(root, ...rel.split('/'));
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
}

/**
 * A tiny game install: `<root>/game` (with `common/`, a checksum manifest that covers it and
 * a file outside it) and `<root>/launcher/launcher-settings.json`. Returns the game folder.
 */
export function fixtureGame(root: string, build = '1.21.0.3'): string {
    writeTree(root, {
        'launcher/launcher-settings.json': JSON.stringify({ rawVersion: build }),
        'game/checksum_manifest.txt': 'directory\nname = common\nsub_directories = yes\n',
        'game/common/traits/00_traits.txt': 'brave = {}\n',
        'game/gfx/interface/icon.dds': new Uint8Array([0, 1, 2, 3]),
    });
    return path.join(root, 'game');
}

/** A tiny mod with a descriptor, in `<corpus>/<slug>`. */
export function fixtureMod(corpus: string, slug: string, id = '1234567890'): string {
    writeTree(corpus, {
        [`${slug}/descriptor.mod`]: `version="1.0"\ntags={\n\t"Events"\n}\nname="Fixture ${slug}"\nsupported_version="1.21.*"\nremote_file_id="${id}"\n`,
        [`${slug}/events/fixture_events.txt`]: 'namespace = fixture\n',
    });
    return path.join(corpus, slug);
}
