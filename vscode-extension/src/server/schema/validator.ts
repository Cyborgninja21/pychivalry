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

        // Map directory path segments to schema names (order matters: more specific first)
        const pathMappings: Array<[string, string]> = [
            ['events', 'events'],
            ['decisions', 'decisions'],
            ['character_interactions', 'character_interactions'],
            ['on_action', 'on_actions'],
            ['story_cycles', 'story_cycles'],
            ['schemes', 'schemes'],
            ['casus_belli_types', 'casus_belli_types'],
            ['court_positions', 'court_positions'],
            ['council_tasks', 'council_tasks'],
            ['opinion_modifiers', 'modifiers'],
            ['modifiers', 'modifiers'],
            ['buildings', 'buildings'],
            ['landed_titles', 'landed_titles'],
            ['dynasty_legacies', 'dynasty_legacies'],
            ['factions', 'factions'],
            ['great_projects', 'great_projects'],
            ['subject_contracts', 'vassal_contracts'],
        ];

        for (const [segment, schemaName] of pathMappings) {
            if (fileName.includes(`/${segment}/`) || fileName.includes(`\\${segment}\\`)) {
                return await this.loader.loadSchema(schemaName);
            }
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
     * Evaluate a condition expression.
     *
     * Supported syntax:
     *   field.exists              — child with key "field" is present
     *   field.value == val        — child value equals val
     *   field.count == N          — number of children with that key
     *   NOT expr                  — negation
     *   expr AND expr [AND expr]  — conjunction (all must be true)
     *   expr OR expr [OR expr]    — disjunction (any must be true)
     *
     * Legacy (still supported):
     *   field_name exists         — same as field_name.exists
     *   field_name = value        — same as field_name.value == value
     *   field_name != value
     *   field_name in [a, b, c]
     */
    private evaluateCondition(node: ASTNode, condition: string): boolean {
        if (!condition) {
            return true;
        }

        const trimmed = condition.trim();

        // Handle AND — split on " AND " and require all parts to be true
        if (trimmed.includes(' AND ')) {
            const parts = trimmed.split(' AND ');
            return parts.every(part => this.evaluateCondition(node, part.trim()));
        }

        // Handle OR — split on " OR " and require any part to be true
        if (trimmed.includes(' OR ')) {
            const parts = trimmed.split(' OR ');
            return parts.some(part => this.evaluateCondition(node, part.trim()));
        }

        // Handle NOT — negate the inner expression
        if (trimmed.startsWith('NOT ')) {
            return !this.evaluateCondition(node, trimmed.slice(4).trim());
        }

        // Dotted access: field.exists
        if (trimmed.endsWith('.exists')) {
            const fieldName = trimmed.slice(0, -7);
            return node.children ? node.children.some((child: ASTNode) => child.key === fieldName) : false;
        }

        // Dotted access: field.value == val
        const dotValueMatch = trimmed.match(/^(\w+)\.value\s*==\s*(.+)$/);
        if (dotValueMatch) {
            const fieldName = dotValueMatch[1];
            const expected = dotValueMatch[2].trim();
            const field = node.children?.find((child: ASTNode) => child.key === fieldName);
            return field ? String(field.value) === expected : false;
        }

        // Dotted access: field.count == N
        const dotCountMatch = trimmed.match(/^(\w+)\.count\s*==\s*(\d+)$/);
        if (dotCountMatch) {
            const fieldName = dotCountMatch[1];
            const expected = parseInt(dotCountMatch[2], 10);
            const count = node.children?.filter((child: ASTNode) => child.key === fieldName).length ?? 0;
            return count === expected;
        }

        // Legacy: "field_name exists"
        if (trimmed.endsWith(' exists')) {
            const fieldName = trimmed.replace(' exists', '').trim();
            return node.children ? node.children.some((child: ASTNode) => child.key === fieldName) : false;
        }

        // Legacy: "field != value"
        if (trimmed.includes(' != ')) {
            const [fieldName, value] = trimmed.split(' != ').map(s => s.trim());
            const field = node.children?.find((child: ASTNode) => child.key === fieldName);
            return field ? field.value !== value : true;
        }

        // Legacy: "field = value" (must come after != check)
        if (trimmed.includes(' = ')) {
            const [fieldName, value] = trimmed.split(' = ').map(s => s.trim());
            const field = node.children?.find((child: ASTNode) => child.key === fieldName);
            return field ? field.value === value : false;
        }

        // Legacy: "field in [values]"
        if (trimmed.includes(' in ')) {
            const [fieldName, valuesStr] = trimmed.split(' in ').map(s => s.trim());
            const values = valuesStr.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
            const field = node.children?.find((child: ASTNode) => child.key === fieldName);
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
            // On-action schema codes
            'ON_ACTION-001': 'On-action \'{key}\' has no effects or events — does nothing',
            'ON_ACTION-002': 'On-action \'{key}\' has empty events list',
            // Scheme schema codes
            'SCHEME-001': 'Scheme \'{key}\' is missing required \'skill\' field',
            'SCHEME-002': 'Scheme \'{key}\' has no effects — does nothing when executed',
            'SCHEME-003': 'Scheme \'{key}\' uses agents but has no valid_agent conditions',
            // Casus belli codes
            'CB-001': 'Casus belli \'{key}\' is missing both on_victory and on_defeat effects',
            'CB-002': 'Casus belli \'{key}\' has unknown cost currency',
            'CB-003': 'Casus belli \'{key}\' has no target constraint',
            // Court position codes
            'COURT-001': 'Court position \'{key}\' is missing can_be_appointed trigger',
            'COURT-002': 'Court position \'{key}\' has salary but no opinion modifier',
            'COURT-003': 'Court position task references unknown position type',
            // Council codes
            'COUNCIL-001': 'Council task \'{key}\' is missing required position field',
            'COUNCIL-002': 'Council task \'{key}\' has unknown position type',
            // Culture codes
            'CULTURE-001': 'Tradition \'{key}\' is missing category',
            'CULTURE-002': 'Tradition \'{key}\' has modifiers but no can_pick trigger',
            // Faith codes
            'FAITH-001': 'Doctrine \'{key}\' is missing group',
            'FAITH-002': 'Doctrine \'{key}\' has unknown doctrine group',
            // Building codes
            'BUILD-001': 'Building \'{key}\' is missing cost block',
            'BUILD-002': 'Building \'{key}\' has no modifier effects',
            'BUILD-003': 'Building \'{key}\' has invalid construction_time',
            // Modifier codes
            'MOD-001': 'Unknown modifier key \'{value}\'',
            'MOD-002': 'Modifier value for \'{key}\' is non-numeric',
            'MOD-003': 'Opinion modifier \'{key}\' is missing opinion field',
            'MOD-004': 'Opinion modifier \'{key}\' value out of typical range',
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
