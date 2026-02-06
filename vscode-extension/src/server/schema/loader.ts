/**
 * Schema Loader - Loads and manages YAML schemas for CK3 script validation
 * 
 * Implements lazy loading for optimal performance:
 * - Schemas are loaded on first use
 * - Caching prevents redundant loads
 * - Supports schema inheritance
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

export interface SchemaDefinition {
    [key: string]: any;
}

export interface SchemaField {
    type?: string | string[];
    required?: boolean;
    description?: string;
    default?: any;
    enum?: any[];
    pattern?: string;
    items?: SchemaField;
    properties?: Record<string, SchemaField>;
    cardinality?: string;
    inherits?: string;
}

/**
 * Schema Loader manages YAML schemas for validation and completion
 */
export class SchemaLoader {
    private schemas: Map<string, SchemaDefinition> = new Map();
    private schemaPath: string = '';
    private initialized: boolean = false;
    private loading: Map<string, Promise<SchemaDefinition>> = new Map();

    /**
     * Initialize the schema loader
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Find schema directory relative to this file
        // In production: vscode-extension/dist/server/schema/loader.js
        // In development: vscode-extension/src/server/schema/loader.ts
        const currentDir = __dirname;
        
        // Try to find pychivalry/data directory
        const MAX_SCHEMA_SEARCH_DEPTH = 10;
        let searchPath = currentDir;
        for (let i = 0; i < MAX_SCHEMA_SEARCH_DEPTH; i++) {
            const dataPath = path.join(searchPath, 'pychivalry', 'data');
            if (fs.existsSync(dataPath)) {
                this.schemaPath = path.join(dataPath, 'schemas');
                break;
            }
            searchPath = path.join(searchPath, '..');
        }
        
        if (!this.schemaPath || !fs.existsSync(this.schemaPath)) {
            console.warn('Schema directory not found, schemas will not be available');
            this.schemaPath = '';
        }
        
        this.initialized = true;
    }

    /**
     * Load a schema by name (lazy loading)
     */
    public async loadSchema(schemaName: string): Promise<SchemaDefinition | null> {
        // Check cache first
        if (this.schemas.has(schemaName)) {
            return this.schemas.get(schemaName)!;
        }
        
        // Check if already loading
        if (this.loading.has(schemaName)) {
            return this.loading.get(schemaName)!;
        }
        
        // Start loading
        const loadPromise = this.loadSchemaFile(schemaName);
        this.loading.set(schemaName, loadPromise);
        
        try {
            const schema = await loadPromise;
            this.schemas.set(schemaName, schema);
            this.loading.delete(schemaName);
            return schema;
        } catch (error) {
            this.loading.delete(schemaName);
            console.error(`Failed to load schema ${schemaName}: ${error}`);
            return null;
        }
    }

    /**
     * Load schema file from disk
     */
    private async loadSchemaFile(schemaName: string): Promise<SchemaDefinition> {
        if (!this.schemaPath) {
            throw new Error('Schema path not initialized');
        }
        
        const filePath = path.join(this.schemaPath, `${schemaName}.yaml`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Schema file not found: ${filePath}`);
        }
        
        const content = await readFile(filePath, 'utf-8');
        const schema = yaml.load(content) as SchemaDefinition;
        
        // Process inheritance
        return this.processInheritance(schema);
    }

    /**
     * Process schema inheritance
     */
    private async processInheritance(schema: SchemaDefinition): Promise<SchemaDefinition> {
        // Check if schema has 'inherits' field
        if (schema.inherits) {
            const parentName = schema.inherits;
            const parentSchema = await this.loadSchema(parentName);
            
            if (parentSchema) {
                // Merge parent schema with current schema
                schema = this.mergeSchemas(parentSchema, schema);
            }
        }
        
        // Process inheritance in nested properties
        if (schema.properties) {
            for (const [key, value] of Object.entries(schema.properties)) {
                if (typeof value === 'object' && value !== null && 'inherits' in value) {
                    const parentName = (value as any).inherits;
                    const parentSchema = await this.loadSchema(parentName);
                    
                    if (parentSchema) {
                        schema.properties[key] = this.mergeSchemas(parentSchema, value);
                    }
                }
            }
        }
        
        return schema;
    }

    /**
     * Merge two schemas (child overrides parent)
     */
    private mergeSchemas(parent: any, child: any): any {
        const result = { ...parent };
        
        for (const [key, value] of Object.entries(child)) {
            if (key === 'inherits') {
                // Skip inherits in merged result
                continue;
            }
            
            if (key === 'properties' && typeof value === 'object' && typeof result.properties === 'object') {
                // Merge properties recursively
                result.properties = {
                    ...result.properties,
                    ...value,
                };
            } else {
                // Override parent value
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * Get schema for a specific file type
     */
    public async getSchemaForFile(uri: string): Promise<SchemaDefinition | null> {
        // Determine schema based on file path
        if (/\/events\//.test(uri)) {
            return this.loadSchema('events');
        } else if (/\/decisions\//.test(uri)) {
            return this.loadSchema('decisions');
        } else if (/\/character_interactions\//.test(uri)) {
            return this.loadSchema('character_interactions');
        } else if (/\/on_actions\//.test(uri)) {
            return this.loadSchema('on_actions');
        } else if (/\/story_cycles\//.test(uri)) {
            return this.loadSchema('story_cycles');
        } else if (/\/activities\//.test(uri)) {
            if (/activity_types/.test(uri)) {
                return this.loadSchema('activity_types');
            } else if (/activity_locales/.test(uri)) {
                return this.loadSchema('activity_locales');
            } else if (/activity_group_types/.test(uri)) {
                return this.loadSchema('activity_group_types');
            }
        } else if (/\/schemes\//.test(uri)) {
            return this.loadSchema('schemes');
        } else if (/\/intents\//.test(uri)) {
            return this.loadSchema('intents');
        } else if (/\/pulse_actions\//.test(uri)) {
            return this.loadSchema('pulse_actions');
        } else if (/\/guest_invite_rules\//.test(uri)) {
            return this.loadSchema('guest_invite_rules');
        } else if (/\/decision_group_types\//.test(uri)) {
            return this.loadSchema('decision_group_types');
        }
        
        // Default to generic rules
        return this.loadSchema('generic_rules');
    }

    /**
     * Get all available schema names
     */
    public async getAvailableSchemas(): Promise<string[]> {
        if (!this.schemaPath) {
            return [];
        }
        
        try {
            const files = await readdir(this.schemaPath);
            return files
                .filter(f => f.endsWith('.yaml'))
                .map(f => f.replace('.yaml', ''));
        } catch (error) {
            console.error(`Failed to list schemas: ${error}`);
            return [];
        }
    }

    /**
     * Validate a value against a schema field
     */
    public validateField(value: any, field: SchemaField): string[] {
        const errors: string[] = [];
        
        if (!field) {
            return errors;
        }
        
        // Check type
        if (field.type) {
            const types = Array.isArray(field.type) ? field.type : [field.type];
            const valueType = typeof value;
            
            let typeMatch = false;
            for (const type of types) {
                if (type === 'string' && valueType === 'string') typeMatch = true;
                else if (type === 'number' && valueType === 'number') typeMatch = true;
                else if (type === 'boolean' && valueType === 'boolean') typeMatch = true;
                else if (type === 'object' && typeof value === 'object') typeMatch = true;
                else if (type === 'array' && Array.isArray(value)) typeMatch = true;
            }
            
            if (!typeMatch) {
                errors.push(`Expected type ${types.join(' or ')}, got ${valueType}`);
            }
        }
        
        // Check enum
        if (field.enum && !field.enum.includes(value)) {
            errors.push(`Value must be one of: ${field.enum.join(', ')}`);
        }
        
        // Check pattern
        if (field.pattern && typeof value === 'string') {
            const regex = new RegExp(field.pattern);
            if (!regex.test(value)) {
                errors.push(`Value does not match pattern: ${field.pattern}`);
            }
        }
        
        return errors;
    }

    /**
     * Get cached schema (non-async, returns undefined if not loaded)
     */
    public getCachedSchema(schemaName: string): SchemaDefinition | undefined {
        return this.schemas.get(schemaName);
    }

    /**
     * Preload commonly used schemas
     */
    public async preloadCommonSchemas(): Promise<void> {
        const commonSchemas = [
            'events',
            'decisions',
            'character_interactions',
            'on_actions',
            'generic_rules',
        ];
        
        await Promise.all(commonSchemas.map(name => this.loadSchema(name)));
    }

    /**
     * Clear schema cache
     */
    public clearCache(): void {
        this.schemas.clear();
        this.loading.clear();
    }
}
