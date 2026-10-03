/**
 * What the plug-ins read from the CK3 base game itself (the `game/` directory that
 * `ck3LanguageServer.gamePath` resolved): the localization keys, the event theme and event
 * background databases and the trait database.
 *
 * Plug-ins that need this knowledge to prove a finding (CK4100 a missing localization key,
 * CK3430 an unknown theme, CK3431 an unknown background, CK3800 an unknown trait) report
 * nothing while it is missing: no base game, or a base game without the directory in
 * question (the test fixtures' mock game). Names are never taken from a hard-coded list.
 */

import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { ASTNode, CK3Parser, localizationKeysOf } from 'pychivalry-engine';

/** An event theme: its name and the backgrounds it shows when no trigger applies. */
export interface EventTheme {
    name: string;
    /** `background = { reference = x }` entries of the theme that have no trigger. */
    defaultBackgrounds: string[];
}

/** The `.txt` files of one directory (not recursive), sorted; empty when it is missing. */
function txtFiles(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir)
            .filter((n) => n.toLowerCase().endsWith('.txt'))
            .sort()
            .map((n) => path.join(dir, n));
    } catch {
        return [];
    }
}

/** Top-level definitions of a database directory, parsed (`@variables` skipped). */
function definitions(dir: string): ASTNode[] {
    const parser = new CK3Parser();
    const out: ASTNode[] = [];
    for (const file of txtFiles(dir)) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const node of parser.parse(text).ast.children ?? []) {
            if (node.key && !node.key.startsWith('@')) {
                out.push(node);
            }
        }
    }
    return out;
}

function stringChild(node: ASTNode, key: string): string | undefined {
    const child = (node.children ?? []).find((c) => c.key === key);
    return child && typeof child.value === 'string' ? child.value : undefined;
}

/** Event themes of `common/event_themes/` in one root (a mod or the game). */
export function readEventThemes(root: string): Map<string, EventTheme> {
    const themes = new Map<string, EventTheme>();
    for (const node of definitions(path.join(root, 'common', 'event_themes'))) {
        const defaultBackgrounds: string[] = [];
        for (const bg of (node.children ?? []).filter((c) => c.key === 'background')) {
            const hasTrigger = (bg.children ?? []).some((c) => c.key === 'trigger');
            const ref = stringChild(bg, 'reference');
            if (ref && !hasTrigger) {
                defaultBackgrounds.push(ref);
            }
        }
        themes.set(node.key!, { name: node.key!, defaultBackgrounds });
    }
    return themes;
}

/** Keys of a database directory under `common/` (event_backgrounds, traits …). */
export function readDatabaseKeys(root: string, dir: string): Set<string> {
    return new Set(definitions(path.join(root, ...dir.split('/'))).map((n) => n.key!));
}

/**
 * Trait names and the group names traits declare (`group = x`, `group_equivalence = x`) in
 * `common/traits/`: has_trait accepts a group (the 1.20.0.2 base game writes
 * `has_trait = lunatic`, the group_equivalence of lunatic_1 and lunatic_genetic, 542 times).
 */
export function readTraits(root: string): Set<string> {
    const names = new Set<string>();
    for (const node of definitions(path.join(root, 'common', 'traits'))) {
        names.add(node.key!);
        for (const key of ['group', 'group_equivalence']) {
            const group = stringChild(node, key);
            if (group) {
                names.add(group);
            }
        }
    }
    return names;
}

async function walkYml(dir: string, out: string[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkYml(full, out);
        } else if (entry.name.toLowerCase().endsWith('.yml')) {
            out.push(full);
        }
    }
}

/** The base game's knowledge for the plug-ins; `load()` reads it once. */
export class BaseGameData {
    /** Localization keys of `localization/english/` (undefined until loaded or when absent). */
    public localizationKeys: ReadonlySet<string> | undefined;
    public eventThemes: ReadonlyMap<string, EventTheme> | undefined;
    public eventBackgrounds: ReadonlySet<string> | undefined;
    public traits: ReadonlySet<string> | undefined;

    constructor(public readonly root: string) {}

    /**
     * Read everything. A directory that is missing or empty leaves its field undefined, so
     * the checks that need it stay silent.
     */
    public async load(): Promise<this> {
        const files: string[] = [];
        await walkYml(path.join(this.root, 'localization', 'english'), files);
        if (files.length > 0) {
            const keys = new Set<string>();
            for (const file of files) {
                try {
                    for (const key of localizationKeysOf(await fsp.readFile(file, 'utf8'))) {
                        keys.add(key);
                    }
                } catch {
                    // An unreadable file adds no keys.
                }
            }
            this.localizationKeys = keys.size > 0 ? keys : undefined;
        }
        const themes = readEventThemes(this.root);
        this.eventThemes = themes.size > 0 ? themes : undefined;
        const backgrounds = readDatabaseKeys(this.root, 'common/event_backgrounds');
        this.eventBackgrounds = backgrounds.size > 0 ? backgrounds : undefined;
        const traits = readTraits(this.root);
        this.traits = traits.size > 0 ? traits : undefined;
        return this;
    }
}

/** readTraits per workspace root, kept while the root's common/traits files are unchanged. */
const workspaceTraitCache = new Map<string, { stamp: string; names: Set<string> }>();

/**
 * Trait and trait-group names the workspace mods define in `common/traits/` (read from disk;
 * re-read when a file there changes size or modification time).
 */
export function workspaceTraitNames(roots: readonly string[]): Set<string> {
    const names = new Set<string>();
    for (const root of roots) {
        const dir = path.join(root, 'common', 'traits');
        const stamp = txtFiles(dir)
            .map((f) => {
                try {
                    const st = fs.statSync(f);
                    return `${f}:${st.size}:${st.mtimeMs}`;
                } catch {
                    return f;
                }
            })
            .join('|');
        let cached = workspaceTraitCache.get(root);
        if (!cached || cached.stamp !== stamp) {
            cached = { stamp, names: readTraits(root) };
            workspaceTraitCache.set(root, cached);
        }
        for (const name of cached.names) {
            names.add(name);
        }
    }
    return names;
}
