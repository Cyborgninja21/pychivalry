/**
 * Types of the CK3 spec package (pdx-parser-re `spec/package/ck3-spec-<version>.json`).
 *
 * They mirror `spec/schema.json` (package_format 1). Only the shapes the engine reads are
 * typed in detail; everything else is kept as plain data.
 */

export const BUCKETS = [
    'triggers',
    'effects',
    'links',
    'lists',
    'on_actions',
    'modifiers',
] as const;
export type Bucket = (typeof BUCKETS)[number];

export const FIELD_KINDS = [
    'trigger_block',
    'effect_block',
    'value',
    'block',
    'list',
    'reference',
    'enum',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const SINCE_VALUES = ['<=1.19.0.6', '1.20.0.2'] as const;
export type Since = (typeof SINCE_VALUES)[number];

export interface BucketEntry {
    doc: string;
    provenance?: 'table';
    /** Set on entries an overlay adds (Spec.withOverlay): who provides the name. */
    source?: string;
}

/**
 * Vocabulary layered over the engine's package, e.g. a mod's scripted effects and
 * triggers (the extension's Carnalitas registry). Names are added to the given buckets;
 * names the package already registers keep the package's entry.
 */
export interface SpecOverlay {
    /** Who provides these names (a mod's display name); recorded on each added entry. */
    source: string;
    buckets: Partial<Record<Bucket, Record<string, { doc?: string }>>>;
}

export interface Manifest {
    game: 'ck3';
    version: string;
    exe: { version: string; exe: string; bytes: number; sha256: string; [key: string]: unknown };
    tooling: { [key: string]: unknown };
    generated: string;
    sources: string[];
    source_sha256?: Record<string, string>;
    doc_join?: string;
}

export interface DirectoryEntry {
    path: string;
    content_type: string;
    level: number | null;
    since: Since;
    source: 'scriptable_systems' | 'exe_loader_path' | 'snapshot';
    present_in_vanilla: boolean;
    default_scope?: string;
}

export interface FieldSpec {
    kind: FieldKind;
    holds?: 'modifiers';
    provenance: 'engine' | 'vanilla';
    usage: number;
    required: boolean;
    required_evidence?: string;
    since: Since;
    description?: string;
    wiki_kind?: string;
    hook?: boolean;
    note?: string;
    fields?: Record<string, FieldSpec>;
}

export interface UnconfirmedField {
    provenance: 'wiki';
    usage: 0;
    kind?: FieldKind;
    description?: string;
}

export interface SchemaEntry {
    content_type: string;
    root_scope?: string;
    record_body?: 'trigger_block' | 'effect_block' | 'modifier_block';
    vanilla: { files: number; records: number };
    wiki_seed?: string[];
    fields: Record<string, FieldSpec>;
    unconfirmed?: Record<string, UnconfirmedField>;
}

export interface ErrorEntry {
    id: string;
    category: string;
    text: string;
    since: Since;
    note: string;
}

export interface RetiredEntry {
    name: string;
    bucket: Bucket;
    removed_in: string;
    /** The package schema allows an array or null; a bare string is accepted defensively. */
    replacement: string[] | string | null;
    note: string;
}

export interface NoiseEntry {
    name: string;
    bucket: Bucket;
    reason: string;
}

export interface SpecPackage {
    package_format: 1;
    manifest: Manifest;
    buckets: Record<Bucket, Record<string, BucketEntry>>;
    modifier_templates: string[];
    iterator_prefixes: string[];
    multi_bucket: Record<string, Bucket[]>;
    directories: DirectoryEntry[];
    schema: Record<string, SchemaEntry>;
    errors: ErrorEntry[];
    retired: RetiredEntry[];
    noise_dropped: NoiseEntry[];
    scope_validity: Record<string, unknown>;
}

export interface IteratorMatch {
    prefix: string;
    base: string;
}

export type ModifierMatch = 'static' | 'template';
