/**
 * Optional game-content data (data/): animation names, game concepts and icons, read
 * from YAML that the extraction tools write from a CK3 install.
 *
 * This is content, not engine vocabulary: which triggers, effects, scopes, on_actions
 * and directory schemas exist comes only from the pychivalry-engine spec package (the
 * scraped keyword YAML and its loaders were removed in Phase 4). Trait names are read by
 * data/traits.ts and the mod registry by data/mod-scanner.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { serverLogger } from '../utils/logger';
import { findDataDir } from './paths';

export interface ConceptDefinition {
    name: string;
    text?: string;
    source?: string;
}

export interface IconDefinition {
    name: string;
    category?: string;
    description?: string;
    reference?: string;
}

/** Fallback portrait animations when data/animations.yaml is absent. */
const FALLBACK_ANIMATIONS = [
    'personality_bold',
    'personality_cautious',
    'personality_compassionate',
    'personality_rational',
    'personality_gregarious',
    'personality_honorable',
    'scheme',
    'war',
    'shock',
    'fear',
    'disgust',
    'rage',
    'happiness',
    'sadness',
    'personality_vengeful',
    'personality_forgiving',
    'flirtation',
    'boredom',
];

function readYaml(file: string): unknown {
    try {
        return yaml.load(fs.readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
}

function field(info: unknown, key: string): string | undefined {
    if (info && typeof info === 'object' && key in info) {
        const value = (info as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : undefined;
    }
    return undefined;
}

export class DataLoader {
    private static instance: DataLoader | undefined;
    private dataPath: string | undefined;

    private animationsCache: Set<string> | null = null;
    private conceptsCache: Map<string, ConceptDefinition> | null = null;
    private iconsCache: Map<string, IconDefinition> | null = null;

    private constructor(dataPath?: string) {
        this.dataPath = dataPath;
    }

    /** The shared instance (the first caller may name the data directory). */
    public static getInstance(dataPath?: string): DataLoader {
        if (!DataLoader.instance) {
            DataLoader.instance = new DataLoader(dataPath);
        }
        return DataLoader.instance;
    }

    /** Resolve the data directory and load every cache once. */
    public async initialize(dataPath?: string): Promise<void> {
        const found = findDataDir(dataPath ?? this.dataPath);
        if (found !== this.dataPath) {
            this.reload();
        }
        this.dataPath = found;
        if (found) {
            serverLogger.log(`Found data directory at: ${found}`);
        } else {
            serverLogger.warn('Data directory not found; game-content checks use fallbacks');
        }
        this.getAnimations();
        this.getConcepts();
        this.getIcons();
    }

    /** The data directory in use (undefined when none was found). */
    public getDataPath(): string | undefined {
        return this.dataPath ?? findDataDir();
    }

    private file(rel: string): string | undefined {
        const dir = this.getDataPath();
        return dir ? path.join(dir, rel) : undefined;
    }

    /** Portrait animation names (data/animations.yaml, a YAML list). */
    public getAnimations(): Set<string> {
        if (!this.animationsCache) {
            this.animationsCache = new Set();
            const file = this.file('animations.yaml');
            const data = file ? readYaml(file) : undefined;
            if (Array.isArray(data)) {
                for (const anim of data) {
                    this.animationsCache.add(String(anim));
                }
            }
            if (this.animationsCache.size === 0) {
                FALLBACK_ANIMATIONS.forEach((a) => this.animationsCache?.add(a));
            }
        }
        return this.animationsCache;
    }

    /** Game concepts (data/concepts/concepts.yaml). */
    public getConcepts(): Map<string, ConceptDefinition> {
        if (!this.conceptsCache) {
            this.conceptsCache = new Map();
            const file = this.file(path.join('concepts', 'concepts.yaml'));
            const data = file ? readYaml(file) : undefined;
            if (data && typeof data === 'object') {
                for (const [name, info] of Object.entries(data)) {
                    this.conceptsCache.set(name, {
                        name,
                        text: field(info, 'text'),
                        source: field(info, 'source'),
                    });
                }
            }
        }
        return this.conceptsCache;
    }

    /** Icons usable in localization (data/icons/icons.yaml). */
    public getIcons(): Map<string, IconDefinition> {
        if (!this.iconsCache) {
            this.iconsCache = new Map();
            const file = this.file(path.join('icons', 'icons.yaml'));
            const data = file ? readYaml(file) : undefined;
            if (data && typeof data === 'object') {
                for (const [name, info] of Object.entries(data)) {
                    this.iconsCache.set(name, {
                        name,
                        category: field(info, 'category'),
                        description: field(info, 'description'),
                        reference: field(info, 'reference'),
                    });
                }
            }
        }
        return this.iconsCache;
    }

    /** Drop the caches (they are re-read on next use). */
    public reload(): void {
        this.animationsCache = null;
        this.conceptsCache = null;
        this.iconsCache = null;
    }
}
