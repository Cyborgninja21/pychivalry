/**
 * Schema Validator - Generic validation engine driven by YAML schemas
 * 
 * This module provides schema-driven validation of CK3 script files. It validates
 * AST nodes against declarative schema rules including required fields, field types,
 * value constraints, and cross-field validations.
 * 
 * Responsibilities:
 * - Validate AST against schema rules
 * - Check required fields (with conditional requirements)
 * - Validate field types and values
 * - Evaluate cross-field conditions
 * - Generate diagnostics with proper codes and messages
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { ASTNode } from '../core/parser';
import { SchemaLoader, SchemaDefinition } from './loader';
import { serverLogger } from '../utils/logger';

// Map severity strings to LSP DiagnosticSeverity enum
const SEVERITY_MAP: Record<string, DiagnosticSeverity> = {
    'error': DiagnosticSeverity.Error,
    'warning': DiagnosticSeverity.Warning,
    'information': DiagnosticSeverity.Information,
    'info': DiagnosticSeverity.Information,
    'hint': DiagnosticSeverity.Hint,
};

export interface SchemaValidatorConfig {
    enabled: boolean;
    severityOverrides?: Record<string, DiagnosticSeverity>;
}

/**
 * Schema Validator validates CK3 files against YAML schemas
 */
export class SchemaValidator {
    private loader: SchemaLoader;
    private config: SchemaValidatorConfig;

    constructor(loader: SchemaLoader, config: SchemaValidatorConfig = { enabled: true }) {
        this.loader = loader;
        this.config = config;
    }

    /**
     * Validate AST against the appropriate schema for the file
     */
    public async validate(filePath: string, ast: ASTNode[]): Promise<Diagnostic[]> {
        if (!this.config.enabled) {
            return [];
        }

        const schema = await this.getSchemaForFile(filePath);
        if (!schema) {
            // No schema for this file type
            return [];
        }

        const diagnostics: Diagnostic[] = [];

        // Get block pattern for identifying top-level blocks to validate
        const blockPattern = schema.identification?.block_pattern;

        // Validate each top-level node
        for (const node of ast) {
            if (node.key && this.matchesBlockPattern(node.key, blockPattern)) {
                // Validate this block against the schema
                diagnostics.push(...this.validateBlock(node, schema, schema.fields || {}));

                // Run top-level validations (cross-field checks)
                if (schema.validations) {
                    for (const validation of schema.validations) {
                        if (this.evaluateCondition(node, validation.condition || '')) {
                            diagnostics.push(
                                this.createDiagnostic(
                                    validation.diagnostic,
                                    node.range,
                                    validation.severity || 'warning',
                                    this.getTemplateVars(node)
                                )
                            );
                        }
                    }
                }
            }
        }

        return diagnostics;
    }

    /**
     * Get the appropriate schema for a file path
     */
    private async getSchemaForFile(filePath: string): Promise<SchemaDefinition | null> {
        // Determine schema based on file path
        // events/ -> events.yaml
        // decisions/ -> decisions.yaml
        // character_interactions/ -> character_interactions.yaml
        // on_actions/ -> on_actions.yaml
        // etc.

        const fileName = filePath.toLowerCase();

        if (fileName.includes('/events/') || fileName.includes('\\events\\')) {
            return await this.loader.loadSchema('events');
        } else if (fileName.includes('/decisions/') || fileName.includes('\\decisions\\')) {
            return await this.loader.loadSchema('decisions');
        } else if (fileName.includes('/character_interactions/') || fileName.includes('\\character_interactions\\')) {
            return await this.loader.loadSchema('character_interactions');
        } else if (fileName.includes('/on_actions/') || fileName.includes('\\on_actions\\')) {
            return await this.loader.loadSchema('on_actions');
        } else if (fileName.includes('/story_cycles/') || fileName.includes('\\story_cycles\\')) {
            return await this.loader.loadSchema('story_cycles');
        } else if (fileName.includes('/schemes/') || fileName.includes('\\schemes\\')) {
            return await this.loader.loadSchema('schemes');
        }

        return null;
    }

    /**
     * Check if a key matches the block identification pattern
     */
    private matchesBlockPattern(key: string, pattern?: string): boolean {
        if (!pattern) {
            return true; // No pattern means match all top-level blocks
        }
        try {
            const regex = new RegExp(pattern);
            return regex.test(key);
        } catch (error) {
            serverLogger.warn(`Invalid regex pattern: ${pattern}`);
            return false;
        }
    }

    /**
     * Validate a block node against field definitions
     */
    private validateBlock(
        node: ASTNode,
        schema: SchemaDefinition,
        fields: Record<string, any>
    ): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const presentFields: Record<string, ASTNode[]> = {};

        // Group children by field name
        if (node.children) {
            for (const child of node.children) {
                if (child.key) {
                    if (!presentFields[child.key]) {
                        presentFields[child.key] = [];
                    }
                    presentFields[child.key].push(child);
                }
            }
        }

        // Validate each field definition
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
            const fieldNodes = presentFields[fieldName] || [];

            // Check required field (including conditional requirements)
            if (fieldDef.required || fieldDef.required_when) {
                if (!this.checkRequired(node, fieldName, fieldDef, presentFields)) {
                    diagnostics.push(
                        this.createDiagnostic(
                            fieldDef.diagnostic || 'UNKNOWN',
                            node.range,
                            'error',
                            { field_name: fieldName, ...this.getTemplateVars(node) }
                        )
                    );
                }
            }

            // Check max_count constraint
            if (fieldDef.max_count !== undefined && fieldNodes.length > fieldDef.max_count) {
                const diagCode = fieldDef.count_diagnostic || fieldDef.diagnostic;
                diagnostics.push(
                    this.createDiagnostic(
                        diagCode,
                        node.range,
                        'error',
                        { count: fieldNodes.length, ...this.getTemplateVars(node) }
                    )
                );
            }

            // Check min_count constraint
            if (fieldDef.min_count !== undefined) {
                const minCount = fieldDef.min_count;
                const unlessFields = fieldDef.min_count_unless || [];

                // Check if any "unless" field is present and truthy
                let skipCheck = false;
                for (const unlessField of unlessFields) {
                    if (presentFields[unlessField]) {
                        const unlessNodes = presentFields[unlessField];
                        if (unlessNodes.length > 0 && unlessNodes[0].value !== undefined) {
                            const val = unlessNodes[0].value;
                            if (val === 'yes' || val === 'true' || val === true) {
                                skipCheck = true;
                                break;
                            }
                        }
                    }
                }

                if (!skipCheck && fieldNodes.length < minCount) {
                    const diagCode = fieldDef.count_diagnostic || fieldDef.diagnostic;
                    diagnostics.push(
                        this.createDiagnostic(
                            diagCode,
                            node.range,
                            'warning',
                            { count: fieldNodes.length, ...this.getTemplateVars(node) }
                        )
                    );
                }
            }

            // Enum type validation
            if (fieldDef.type === 'enum' && fieldNodes.length > 0) {
                const validValues = fieldDef.values || [];
                for (const fieldNode of fieldNodes) {
                    if (fieldNode.value && !validValues.includes(fieldNode.value)) {
                        const diagCode = fieldDef.invalid_diagnostic || fieldDef.diagnostic;
                        const templateVars = this.getTemplateVars(fieldNode);
                        templateVars.valid_values = validValues.join(', ');
                        diagnostics.push(
                            this.createDiagnostic(
                                diagCode,
                                fieldNode.range,
                                'error',
                                templateVars
                            )
                        );
                    }
                }
            }

            // Pattern validation
            if (fieldNodes.length > 0 && fieldDef.type) {
                for (const fieldNode of fieldNodes) {
                    if (fieldNode.value !== undefined) {
                        const patternDiag = this.validatePattern(
                            String(fieldNode.value),
                            fieldDef.type,
                            fieldName
                        );
                        if (patternDiag) {
                            const templateVars = this.getTemplateVars(fieldNode);
                            templateVars.pattern = patternDiag.pattern || '';
                            diagnostics.push(
                                this.createDiagnostic(
                                    patternDiag.code,
                                    fieldNode.range,
                                    patternDiag.severity || 'warning',
                                    templateVars
                                )
                            );
                        }
                    }
                }
            }

            // Nested schema validation
            if (fieldDef.schema) {
                const nestedSchemaName = fieldDef.schema;
                const nestedSchemas = schema.nested_schemas || {};
                if (nestedSchemas[nestedSchemaName]) {
                    const nestedSchema = nestedSchemas[nestedSchemaName];
                    for (const fieldNode of fieldNodes) {
                        // Validate nested block
                        diagnostics.push(
                            ...this.validateBlock(
                                fieldNode,
                                schema,
                                nestedSchema.fields || {}
                            )
                        );

                        // Run nested validations
                        if (nestedSchema.validations) {
                            for (const validation of nestedSchema.validations) {
                                if (this.evaluateCondition(fieldNode, validation.condition || '')) {
                                    diagnostics.push(
                                        this.createDiagnostic(
                                            validation.diagnostic,
                                            fieldNode.range,
                                            validation.severity || 'warning',
                                            this.getTemplateVars(fieldNode)
                                        )
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // Field-level warnings
            if (fieldDef.warnings) {
                for (const warning of fieldDef.warnings) {
                    for (const fieldNode of fieldNodes) {
                        if (this.evaluateCondition(fieldNode, warning.condition || '')) {
                            diagnostics.push(
                                this.createDiagnostic(
                                    warning.diagnostic,
                                    fieldNode.range,
                                    warning.severity || 'warning',
                                    this.getTemplateVars(fieldNode)
                                )
                            );
                        }
                    }
                }
            }
        }

        return diagnostics;
    }

    /**
     * Check if a required field is present
     */
    private checkRequired(
        node: ASTNode,
        fieldName: string,
        fieldDef: any,
        presentFields: Record<string, ASTNode[]>
    ): boolean {
        // Simple required check
        if (fieldDef.required) {
            return presentFields[fieldName] && presentFields[fieldName].length > 0;
        }

        // Conditional required check
        if (fieldDef.required_when) {
            const condition = fieldDef.required_when;
            if (this.evaluateCondition(node, condition)) {
                return presentFields[fieldName] && presentFields[fieldName].length > 0;
            }
        }

        return true; // Not required
    }

    /**
     * Evaluate a condition expression
     */
    private evaluateCondition(node: ASTNode, condition: string): boolean {
        if (!condition) {
            return true;
        }

        // Simple condition evaluation
        // Supports: field_name exists, field_name = value, field_name != value
        
        // Check for "exists" condition
        if (condition.endsWith(' exists')) {
            const fieldName = condition.replace(' exists', '').trim();
            return node.children ? node.children.some((child: ASTNode) => child.key === fieldName) : false;
        }

        // Check for "= value" condition
        if (condition.includes(' = ')) {
            const [fieldName, value] = condition.split(' = ').map(s => s.trim());
            const field = node.children ? node.children.find((child: ASTNode) => child.key === fieldName) : undefined;
            return field ? field.value === value : false;
        }

        // Check for "!= value" condition
        if (condition.includes(' != ')) {
            const [fieldName, value] = condition.split(' != ').map(s => s.trim());
            const field = node.children ? node.children.find((child: ASTNode) => child.key === fieldName) : undefined;
            return field ? field.value !== value : true;
        }

        // Check for "in [values]" condition
        if (condition.includes(' in ')) {
            const [fieldName, valuesStr] = condition.split(' in ').map(s => s.trim());
            const values = valuesStr.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
            const field = node.children ? node.children.find((child: ASTNode) => child.key === fieldName) : undefined;
            return field ? values.includes(String(field.value)) : false;
        }

        return true; // Default to true if we can't evaluate
    }

    /**
     * Validate a value against a pattern
     */
    private validatePattern(
        value: string,
        type: string,
        fieldName: string
    ): { code: string; pattern: string; severity: string } | null {
        // Pattern validation based on type
        const patterns: Record<string, { pattern: RegExp; code: string; description: string }> = {
            'event_id': {
                pattern: /^[a-z_]+\.\d+$/,
                code: 'CK3760',
                description: 'namespace.number format (e.g., my_event.0001)'
            },
            'trait_id': {
                pattern: /^[a-z_]+$/,
                code: 'CK3800',
                description: 'lowercase with underscores'
            },
            'decision_id': {
                pattern: /^[a-z_]+$/,
                code: 'CK3850',
                description: 'lowercase with underscores'
            },
            'localization_key': {
                pattern: /^[a-z_]+(_t|_desc|_tt|_name)?$/,
                code: 'CK4100',
                description: 'ends with _t, _desc, _tt, or _name'
            }
        };

        if (patterns[type]) {
            const { pattern, code, description } = patterns[type];
            if (!pattern.test(value)) {
                return {
                    code,
                    pattern: description,
                    severity: 'warning'
                };
            }
        }

        return null;
    }

    /**
     * Create a diagnostic with template variable substitution
     */
    private createDiagnostic(
        code: string,
        range: Range,
        severity: string,
        templateVars: Record<string, any> = {}
    ): Diagnostic {
        // Get diagnostic definition (would come from diagnostics.yaml in full implementation)
        const message = this.formatDiagnosticMessage(code, templateVars);

        return {
            severity: this.config.severityOverrides?.[code] || SEVERITY_MAP[severity] || DiagnosticSeverity.Warning,
            range,
            message,
            code,
            source: 'ck3-schema'
        };
    }

    /**
     * Format diagnostic message with template variables
     */
    private formatDiagnosticMessage(code: string, vars: Record<string, any>): string {
        // In full implementation, this would load from diagnostics.yaml
        // For now, provide basic messages
        const messages: Record<string, string> = {
            'CK3760': 'Invalid event ID format. Expected: {pattern}',
            'CK3761': 'Event type missing or invalid',
            'CK3762': 'Required field "{field_name}" is missing',
            'CK3800': 'Unknown trait: {value}',
            'CK3850': 'Unknown decision: {value}',
            'CK4100': 'Missing localization key: {value}',
            'UNKNOWN': 'Validation error at {key}'
        };

        let message = messages[code] || `Validation error (${code})`;

        // Substitute template variables
        for (const [key, value] of Object.entries(vars)) {
            message = message.replace(`{${key}}`, String(value));
        }

        return message;
    }

    /**
     * Get template variables from a node
     */
    private getTemplateVars(node: ASTNode): Record<string, any> {
        return {
            key: node.key,
            value: node.value || '',
            type: node.type
        };
    }
}
