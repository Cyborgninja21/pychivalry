/**
 * Scriptable Directory Registry
 *
 * Maps CK3 directory paths to content types, schemas, and default scopes.
 * Uses data from scriptable_directories.yaml which was extracted from
 * binary analysis of the CK3 engine's scriptable systems.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { serverLogger } from '../utils/logger';

export interface DirectoryInfo {
    content_type: string;
    default_scope: string;
    level: number;
}

export class DirectoryRegistry {
    private static instance: DirectoryRegistry | null = null;
    private directories: Map<string, DirectoryInfo> = new Map();
    private loaded: boolean = false;

    private constructor() {}

    public static getInstance(): DirectoryRegistry {
        if (!DirectoryRegistry.instance) {
            DirectoryRegistry.instance = new DirectoryRegistry();
        }
        return DirectoryRegistry.instance;
    }

    /**
     * Load directory registry from YAML data file.
     */
    public async load(dataPath: string): Promise<void> {
        const filePath = path.join(dataPath, 'scriptable_directories.yaml');
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const data = yaml.load(content) as { directories?: Record<string, DirectoryInfo> };

            if (data?.directories) {
                this.directories = new Map();
                for (const [dirPath, info] of Object.entries(data.directories)) {
                    // Normalize to forward slashes
                    const normalizedPath = dirPath.replace(/\\/g, '/');
                    this.directories.set(normalizedPath, info);
                }
                this.loaded = true;
                serverLogger.log(`DirectoryRegistry: Loaded ${this.directories.size} directory mappings`);
            }
        } catch (error) {
            serverLogger.warn(`DirectoryRegistry: Failed to load from ${filePath}: ${error}`);
            this.addFallbackDirectories();
        }
    }

    /**
     * Load synchronously (fallback).
     */
    public loadSync(dataPath: string): void {
        const filePath = path.join(dataPath, 'scriptable_directories.yaml');
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = yaml.load(content) as { directories?: Record<string, DirectoryInfo> };

            if (data?.directories) {
                this.directories = new Map();
                for (const [dirPath, info] of Object.entries(data.directories)) {
                    const normalizedPath = dirPath.replace(/\\/g, '/');
                    this.directories.set(normalizedPath, info);
                }
                this.loaded = true;
            }
        } catch {
            this.addFallbackDirectories();
        }
    }

    /**
     * Get content type for a file path.
     * Matches the file's directory against known scriptable directories.
     */
    public getContentType(filePath: string): string | null {
        const info = this.getDirectoryInfo(filePath);
        return info?.content_type || null;
    }

    /**
     * Get the default scope type for a file path.
     */
    public getDefaultScope(filePath: string): string | null {
        const info = this.getDirectoryInfo(filePath);
        if (info?.default_scope === 'none') return null;
        return info?.default_scope || null;
    }

    /**
     * Get the validation level for a file path (5 = infrastructure, 1 = content, 0 = other).
     */
    public getLevel(filePath: string): number {
        const info = this.getDirectoryInfo(filePath);
        return info?.level ?? -1;
    }

    /**
     * Get full directory info for a file path.
     */
    public getDirectoryInfo(filePath: string): DirectoryInfo | null {
        if (!this.loaded) return null;

        const normalized = filePath.replace(/\\/g, '/').toLowerCase();

        // Find the longest matching directory prefix
        let bestMatch: DirectoryInfo | null = null;
        let bestLength = 0;

        for (const [dirPath, info] of this.directories) {
            const lowerDir = dirPath.toLowerCase();
            if (normalized.includes('/' + lowerDir + '/') || normalized.includes('/' + lowerDir + '\\')) {
                if (lowerDir.length > bestLength) {
                    bestLength = lowerDir.length;
                    bestMatch = info;
                }
            }
        }

        return bestMatch;
    }

    /**
     * Get all known directory mappings.
     */
    public getAllDirectories(): Map<string, DirectoryInfo> {
        return new Map(this.directories);
    }

    public isLoaded(): boolean {
        return this.loaded;
    }

    private addFallbackDirectories(): void {
        this.directories = new Map([
            ['events', { content_type: 'event', default_scope: 'character', level: 1 }],
            ['common/decisions', { content_type: 'decision', default_scope: 'character', level: 3 }],
            ['common/character_interactions', { content_type: 'character_interaction', default_scope: 'character', level: 3 }],
            ['common/on_actions', { content_type: 'on_action', default_scope: 'none', level: 5 }],
            ['common/scripted_triggers', { content_type: 'scripted_trigger', default_scope: 'any', level: 5 }],
            ['common/scripted_effects', { content_type: 'scripted_effect', default_scope: 'any', level: 5 }],
        ]);
        this.loaded = true;
    }
}
