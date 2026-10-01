/**
 * Localization index: key lookup over a mod's `localization/**\/*_l_<language>.yml` files.
 *
 * Ported from the extension's core/localization-index.ts (Phase 4). The file URI of an
 * entry is now built with pathToUri, so it equals the URI the index and the editor use for
 * the same file (the old `'file:///' + path` produced four slashes on POSIX paths).
 */

import { promises as fsp } from 'fs';
import * as path from 'path';

import { pathToUri } from './workspace';

/** A single localization entry. */
export interface LocalizationEntry {
    key: string;
    text: string;
    fileUri: string;
    filePath: string;
    /** 0-based line number. */
    line: number;
}

/** `key:0 "text"`, with any indentation and an optional version number. */
const ENTRY_RE = /^\s+([a-zA-Z_][a-zA-Z0-9_.]*):(\d+)\s+"(.*)"\s*$/;

const LOCALIZATION_FILE_RE =
    /_l_(english|german|french|spanish|russian|korean|simp_chinese|braz_por|polish|japanese)\.yml$/i;

/** Is `filename` a CK3 localization file name? */
export function isLocalizationFile(filename: string): boolean {
    return LOCALIZATION_FILE_RE.test(filename);
}

export class LocalizationIndex {
    /** key → entry */
    private entries = new Map<string, LocalizationEntry>();
    /** file URI → keys defined in that file (for incremental updates) */
    private fileKeys = new Map<string, Set<string>>();

    /** Parse one localization file and add its entries; returns the number indexed. */
    public async indexFile(filePath: string): Promise<number> {
        let content: string;
        try {
            content = await fsp.readFile(filePath, 'utf-8');
        } catch {
            this.clearFile(pathToUri(filePath));
            return 0;
        }
        return this.indexText(filePath, content);
    }

    /** Index the given content as the text of `filePath` (an open editor buffer, say). */
    public indexText(filePath: string, content: string): number {
        const uri = pathToUri(filePath);
        this.clearFile(uri);
        const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
        const lines = text.split('\n');
        const keys = new Set<string>();
        for (let i = 0; i < lines.length; i++) {
            const match = ENTRY_RE.exec(lines[i]);
            if (match) {
                const key = match[1];
                this.entries.set(key, { key, text: match[3], fileUri: uri, filePath, line: i });
                keys.add(key);
            }
        }
        this.fileKeys.set(uri, keys);
        return keys.size;
    }

    /** Remove every entry of one file. */
    public clearFile(fileUri: string): void {
        const keys = this.fileKeys.get(fileUri);
        if (keys) {
            for (const key of keys) {
                this.entries.delete(key);
            }
            this.fileKeys.delete(fileUri);
        }
    }

    public findLocalization(key: string): LocalizationEntry | undefined {
        return this.entries.get(key);
    }

    public hasKey(key: string): boolean {
        return this.entries.has(key);
    }

    public getKeys(): string[] {
        return Array.from(this.entries.keys());
    }

    /** Entries defined in one file, in line order. */
    public entriesOf(fileUri: string): LocalizationEntry[] {
        const keys = this.fileKeys.get(fileUri);
        if (!keys) {
            return [];
        }
        const out: LocalizationEntry[] = [];
        for (const key of keys) {
            const entry = this.entries.get(key);
            if (entry && entry.fileUri === fileUri) {
                out.push(entry);
            }
        }
        return out.sort((a, b) => a.line - b.line);
    }

    public get size(): number {
        return this.entries.size;
    }

    /** Index every localization file under `dirPath`; returns the number of entries. */
    public async scanDirectory(dirPath: string): Promise<number> {
        let total = 0;
        let entries: import('fs').Dirent[];
        try {
            entries = await fsp.readdir(dirPath, { withFileTypes: true });
        } catch {
            return 0;
        }
        for (const entry of entries) {
            const full = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                total += await this.scanDirectory(full);
            } else if (entry.isFile() && isLocalizationFile(entry.name)) {
                total += await this.indexFile(full);
            }
        }
        return total;
    }

    public clear(): void {
        this.entries.clear();
        this.fileKeys.clear();
    }
}
