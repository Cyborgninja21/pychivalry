/**
 * The skills (docs/PLAN.md, items 9.1 and 9.3): the folders of written instructions an AI
 * harness loads when a task calls for them, `skills/<name>/SKILL.md` in the repository, copied
 * into the bundle as `dist/bundle/skills/` (`bundle.ts`). No VS Code import.
 *
 * One folder serves both harnesses unchanged. VS Code's AI reads them where they are, inside the
 * extension's own folder, from the manifest's `contributes.chatSkills`. Claude Code reads only
 * its own folders; "Set up for Claude Code" copies them into Claude Code's folder of personal
 * skills, `skills/` of its configuration folder (`$CLAUDE_CONFIG_DIR`, or `.claude` in the home
 * folder), which every Claude Code session reads (Claude Code 2.1.220; its documentation,
 * "Extend Claude with skills"). That folder is the user's own, not the mod's: nothing is
 * written into the mod, which its author may share or upload.
 *
 * pychivalry writes there only its own skills and removes only what it wrote: the extension
 * keeps a record of the folder, the skills' names and the SHA-256 of every file it wrote, of any
 * version, in a file of its global storage folder (`SKILLS_RECORD_FILE`), written at once, so
 * that the next version finds it after an update. A file of that name whose bytes are not one of them is someone else's and is left as
 * it is, and so is the skill it is in. Nothing else is written into the folder (an older Claude
 * Code moved skills listed in a `manifest.json` there aside), and Claude Code picks the skills up
 * as they change, with no restart.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { envValue } from './claude.js';
import { replaceFile } from './install.js';

/** A skill's own file, in its folder: the one both harnesses read. */
export const SKILL_FILE = 'SKILL.md';

/** The skills' folder: in the repository, in the bundle (`dist/bundle/`) and in Claude Code's configuration folder. */
export const SKILLS_FOLDER = 'skills';

/** The file, in the extension's global storage folder, the records of the skills installed for Claude Code are kept in. */
export const SKILLS_RECORD_FILE = 'claude-code-skills.json';

/** One file of a skill. */
export interface SkillFileEntry {
    /** Its path in the skill's folder, written with `/`. */
    readonly path: string;
    readonly bytes: Buffer;
    readonly sha256: string;
}

/** A skill: its folder's name and its files. */
export interface Skill {
    readonly name: string;
    readonly files: readonly SkillFileEntry[];
}

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** The files below `dir`, as paths written with `/`, sorted. */
function filesBelow(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
            const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
            if (entry.isDirectory()) {
                return filesBelow(path.join(dir, entry.name), rel);
            }
            return entry.isFile() ? [rel] : [];
        })
        .sort();
}

/** The skills in `dir`: each folder that holds a `SKILL.md`, by name, with every file in it. */
export function readSkills(dir: string): Skill[] {
    return readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, SKILL_FILE)))
        .map((e) => e.name)
        .sort()
        .map((name) => ({
            name,
            files: filesBelow(path.join(dir, name)).map((rel) => {
                const bytes = readFileSync(path.join(dir, name, ...rel.split('/')));
                return { path: rel, bytes, sha256: sha256(bytes) };
            }),
        }));
}

/** Where Claude Code is looked for, as `findClaude` is given it. */
export interface ClaudePlace {
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly platform: NodeJS.Platform;
    readonly home: string;
}

/**
 * Claude Code's folder of personal skills: `skills` in its configuration folder, which is
 * `CLAUDE_CONFIG_DIR` when that is set, else `.claude` in the home folder, as Claude Code
 * 2.1.220 computes it (Unicode NFC). An empty `CLAUDE_CONFIG_DIR` counts as unset; one that is
 * not an absolute path is refused, since where Claude Code would read it depends on the folder
 * it is started in.
 */
export function claudeSkillsDir(where: ClaudePlace): string {
    const paths = where.platform === 'win32' ? path.win32 : path.posix;
    const config = envValue(where.env, 'CLAUDE_CONFIG_DIR', where.platform);
    if (config !== undefined && config !== '' && !paths.isAbsolute(config)) {
        throw new Error(`CLAUDE_CONFIG_DIR is not an absolute path: ${config}`);
    }
    const base = config !== undefined && config !== '' ? config : paths.join(where.home, '.claude');
    return paths.join(base, SKILLS_FOLDER).normalize('NFC');
}

/** What the extension remembers of the skills it put in one Claude Code skills folder. */
export interface SkillsRecord {
    readonly dir: string;
    /** The skills it installed there and that are still its own. */
    readonly names: readonly string[];
    /** The SHA-256 of every file it ever wrote there, of any version. */
    readonly sha256: readonly string[];
}

/** The records read from `file`: none when it is absent or not readable. */
export function loadSkillsRecords(file: string): SkillsRecord[] {
    try {
        return readSkillsRecords(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
        return [];
    }
}

/** Write the records into `file`, through a temporary file renamed over it. */
export function saveSkillsRecords(file: string, records: readonly SkillsRecord[]): void {
    replaceFile(file, Buffer.from(`${JSON.stringify(records, null, 2)}\n`, 'utf8'));
}

/** The records in their JSON form; anything that is not one is dropped. */
export function readSkillsRecords(value: unknown): SkillsRecord[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const strings = (v: unknown): v is string[] =>
        Array.isArray(v) && v.every((s) => typeof s === 'string');
    return value.flatMap((r: unknown): SkillsRecord[] => {
        if (typeof r !== 'object' || r === null) {
            return [];
        }
        const { dir, names, sha256 } = r as Record<string, unknown>;
        return typeof dir === 'string' && strings(names) && strings(sha256)
            ? [{ dir, names, sha256 }]
            : [];
    });
}

/** The records with the one for `record.dir` replaced by `record`, or removed when it holds no skill. */
export function withSkillsRecord(
    records: readonly SkillsRecord[],
    record: SkillsRecord,
): SkillsRecord[] {
    const others = records.filter((r) => r.dir !== record.dir);
    return record.names.length === 0 ? others : [...others, record];
}

/** A skill left as it is, and why. */
export interface LeftSkill {
    readonly name: string;
    readonly reason: string;
}

/** What an installation did in one folder. */
export interface SkillsInstall {
    readonly dir: string;
    /** Skills written, new or replacing an older copy of pychivalry's. */
    readonly written: readonly string[];
    /** Skills already there as they are. */
    readonly unchanged: readonly string[];
    /** Skills of pychivalry's that this version no longer has, taken away. */
    readonly removed: readonly string[];
    /** Skills of the same name that pychivalry did not write, left as they are. */
    readonly refused: readonly LeftSkill[];
    /** The record to keep afterwards. */
    readonly record: SkillsRecord;
}

/** How the files of a skill's folder stand against what pychivalry wrote. */
interface FolderState {
    /** Files there that are neither the new bytes nor any pychivalry wrote. */
    readonly foreign: readonly string[];
    /** Files to write: absent, or an older copy of pychivalry's. */
    readonly toWrite: readonly SkillFileEntry[];
    /** Files of pychivalry's that the skill no longer has. */
    readonly stale: readonly string[];
}

function folderState(folder: string, skill: Skill | null, ours: ReadonlySet<string>): FolderState {
    const present = existsSync(folder) ? filesBelow(folder) : [];
    const wanted = new Map((skill?.files ?? []).map((f) => [f.path, f]));
    const foreign: string[] = [];
    const toWrite: SkillFileEntry[] = [];
    const stale: string[] = [];
    for (const rel of present) {
        const bytes = readFileSync(path.join(folder, ...rel.split('/')));
        const hash = sha256(bytes);
        const want = wanted.get(rel);
        if (want !== undefined && want.sha256 === hash) {
            continue;
        }
        if (!ours.has(hash)) {
            // A file of the skill's that someone changed, or one of theirs beside it.
            if (want !== undefined || rel === SKILL_FILE) {
                foreign.push(rel);
            }
            continue;
        }
        if (want === undefined) {
            stale.push(rel);
        } else {
            toWrite.push(want);
        }
    }
    for (const f of wanted.values()) {
        if (!present.includes(f.path)) {
            toWrite.push(f);
        }
    }
    return { foreign, toWrite, stale };
}

/** Remove `files` of `folder`, then every folder below it, and it, left empty. */
function removeFiles(folder: string, files: readonly string[]): void {
    for (const rel of files) {
        rmSync(path.join(folder, ...rel.split('/')), { force: true });
    }
    pruneEmpty(folder);
}

function pruneEmpty(folder: string): void {
    if (!existsSync(folder) || !statSync(folder).isDirectory()) {
        return;
    }
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            pruneEmpty(path.join(folder, entry.name));
        }
    }
    if (readdirSync(folder).length === 0) {
        rmdirSync(folder);
    }
}

/**
 * Put `skills` into Claude Code's skills folder `dir`, from `record` (null when the extension
 * has written nothing there): a skill absent is written, a copy of pychivalry's of any version is
 * replaced, one that is already as it should be is left alone, one pychivalry did not write is
 * left as it is (refused), and a skill of pychivalry's this version no longer has is taken away.
 * Running it twice changes nothing the second time.
 *
 * `refreshOnly` (on activation, after an update) only brings copies already there up to date:
 * a skill whose folder is gone is not written again, and is dropped from the record.
 */
export function installSkills(
    skills: readonly Skill[],
    dir: string,
    record: SkillsRecord | null,
    refreshOnly = false,
): SkillsInstall {
    const ours = new Set(record?.sha256 ?? []);
    const shipped = new Set(skills.map((s) => s.name));
    const written: string[] = [];
    const unchanged: string[] = [];
    const removed: string[] = [];
    const refused: LeftSkill[] = [];
    const kept: string[] = [];
    for (const skill of skills) {
        const folder = path.join(dir, skill.name);
        if (refreshOnly && !existsSync(path.join(folder, SKILL_FILE))) {
            continue;
        }
        const state = folderState(folder, skill, ours);
        if (state.foreign.length > 0) {
            refused.push({
                name: skill.name,
                reason: `${state.foreign.join(', ')} in ${folder} ${state.foreign.length === 1 ? 'is' : 'are'} not pychivalry's`,
            });
            continue;
        }
        for (const f of state.toWrite) {
            replaceFile(path.join(folder, ...f.path.split('/')), f.bytes);
        }
        if (state.stale.length > 0) {
            removeFiles(folder, state.stale);
        }
        (state.toWrite.length > 0 || state.stale.length > 0 ? written : unchanged).push(skill.name);
        kept.push(skill.name);
    }
    for (const name of record?.names ?? []) {
        if (shipped.has(name)) {
            continue;
        }
        const folder = path.join(dir, name);
        const state = folderState(folder, null, ours);
        if (state.foreign.length === 0) {
            removeFiles(folder, state.stale);
            removed.push(name);
        }
    }
    const sha = new Set(record?.sha256 ?? []);
    for (const skill of skills) {
        if (kept.includes(skill.name)) {
            for (const f of skill.files) {
                sha.add(f.sha256);
            }
        }
    }
    return {
        dir,
        written,
        unchanged,
        removed,
        refused,
        record: { dir, names: kept, sha256: [...sha].sort() },
    };
}

/** What a removal did in one folder. */
export interface SkillsRemoval {
    readonly dir: string;
    /** Skills taken away. */
    readonly removed: readonly string[];
    /** Skills left, with the files in them pychivalry did not write. */
    readonly kept: readonly LeftSkill[];
    /** The record to keep afterwards: the skills left, which are no longer pychivalry's alone. */
    readonly record: SkillsRecord;
}

/**
 * Take away the skills `record` lists from its folder: every file whose bytes are one that
 * pychivalry wrote, then the folders left empty. A skill holding a file someone changed or added
 * keeps it, and is named in `kept`.
 */
export function removeSkills(record: SkillsRecord): SkillsRemoval {
    const ours = new Set(record.sha256);
    const removed: string[] = [];
    const kept: LeftSkill[] = [];
    for (const name of record.names) {
        const folder = path.join(record.dir, name);
        if (!existsSync(folder)) {
            removed.push(name);
            continue;
        }
        const files = filesBelow(folder);
        const theirs = files.filter(
            (rel) => !ours.has(sha256(readFileSync(path.join(folder, ...rel.split('/'))))),
        );
        removeFiles(
            folder,
            files.filter((rel) => !theirs.includes(rel)),
        );
        if (theirs.length === 0) {
            removed.push(name);
        } else {
            kept.push({
                name,
                reason: `${theirs.join(', ')} in ${folder} ${theirs.length === 1 ? 'was' : 'were'} not written by pychivalry`,
            });
        }
    }
    return {
        dir: record.dir,
        removed,
        kept,
        record: { dir: record.dir, names: [], sha256: record.sha256 },
    };
}
