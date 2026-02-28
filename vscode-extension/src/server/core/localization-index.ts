/**
 * Localization Index — parses CK3 .yml localization files and provides key lookup
 */
import * as fsp from 'fs/promises';
import * as path from 'path';
import { serverLogger } from '../utils/logger';

/**
 * A single localization entry
 */
export interface LocalizationEntry {
    key: string;
    text: string;
    fileUri: string;
    filePath: string;
    line: number; // 0-based line number
}

/**
 * Localization Index - parses and caches CK3 YAML localization files
 */
export class LocalizationIndex {
    /** key → entry */
    private entries: Map<string, LocalizationEntry> = new Map();
    /** fileUri → Set of keys in that file (for incremental updates) */
    private fileKeys: Map<string, Set<string>> = new Map();

    /**
     * Parse a single localization YAML file and add entries to the index
     */
    public async indexFile(filePath: string): Promise<number> {
        const uri = 'file:///' + filePath.replace(/\\/g, '/');

        // Clear previous entries from this file
        this.clearFile(uri);

        let content: string;
        try {
            content = await fsp.readFile(filePath, 'utf-8');
        } catch {
            return 0;
        }

        // Remove BOM if present (CK3 yml files often have BOM)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        const lines = content.split('\n');
        const keys = new Set<string>();
        let count = 0;

        // CK3 loc format: key:number "text"
        // The regex handles optional whitespace, key with dots/underscores, version number, and quoted text
        const entryPattern = /^\s+([a-zA-Z_][a-zA-Z0-9_\.]*):(\d+)\s+"(.*)"\s*$/;

        for (let i = 0; i < lines.length; i++) {
            const match = entryPattern.exec(lines[i]);
            if (match) {
                const key = match[1];
                const text = match[3];

                this.entries.set(key, {
                    key,
                    text,
                    fileUri: uri,
                    filePath,
                    line: i,
                });
                keys.add(key);
                count++;
            }
        }

        this.fileKeys.set(uri, keys);
        return count;
    }

    /**
     * Clear all entries from a specific file (for re-indexing)
     */
    public clearFile(fileUri: string): void {
        const keys = this.fileKeys.get(fileUri);
        if (keys) {
            for (const key of keys) {
                this.entries.delete(key);
            }
            this.fileKeys.delete(fileUri);
        }
    }

    /**
     * Look up a localization key
     */
    public findLocalization(key: string): LocalizationEntry | undefined {
        return this.entries.get(key);
    }

    /**
     * Check if a key exists
     */
    public hasKey(key: string): boolean {
        return this.entries.has(key);
    }

    /**
     * Get all indexed keys
     */
    public getKeys(): string[] {
        return Array.from(this.entries.keys());
    }

    /**
     * Get the number of indexed entries
     */
    public get size(): number {
        return this.entries.size;
    }

    /**
     * Scan a directory recursively for localization yml files and index them
     */
    public async scanDirectory(dirPath: string): Promise<number> {
        let totalCount = 0;

        try {
            const entries = await fsp.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    totalCount += await this.scanDirectory(fullPath);
                } else if (entry.isFile() && this.isLocalizationFile(entry.name)) {
                    const count = await this.indexFile(fullPath);
                    totalCount += count;
                }
            }
        } catch {
            // Ignore permission errors
        }

        return totalCount;
    }

    /**
     * Check if a filename is a CK3 localization file
     */
    private isLocalizationFile(filename: string): boolean {
        return /_l_(english|german|french|spanish|russian|korean|simp_chinese|braz_por|polish|japanese)\.yml$/i.test(filename);
    }

    /**
     * Clear the entire index
     */
    public clear(): void {
        this.entries.clear();
        this.fileKeys.clear();
    }
}
