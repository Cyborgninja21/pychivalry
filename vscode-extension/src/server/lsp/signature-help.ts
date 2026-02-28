/**
 * Signature Help Provider - Provides parameter hints and signatures
 * 
 * Features:
 * - Parameter documentation with types and descriptions
 * - Active parameter highlighting (tracks which parameter user is typing)
 * - Overload support (multiple signatures for effects with variants)
 * - Context-aware signatures (show relevant signatures based on scope)
 * - Usage examples in signature documentation
 */

import {
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    Position,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { EffectDefinition, TriggerDefinition, getDataLoader } from '../data/loader';

/**
 * Context information for signature help
 */
interface SignatureContext {
    command: string;
    isInBlock: boolean;
    currentParameterIndex: number;
    blockDepth: number;
}

/**
 * Signature Help Provider
 */
export class SignatureHelpProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide signature help
     */
    public async provideSignatureHelp(
        document: TextDocument,
        position: Position
    ): Promise<SignatureHelp | null> {
        const text = document.getText();
        const offset = document.offsetAt(position);

        // Find the context - what effect/trigger are we in?
        const context = this.findDetailedContext(text, offset);
        if (!context) return null;

        // Get signatures for the effect/trigger
        const signatures = this.getSignatures(context);
        if (signatures.length === 0) return null;

        return {
            signatures,
            activeSignature: 0,
            activeParameter: context.currentParameterIndex,
        };
    }

    /**
     * Find detailed context at cursor position
     */
    private findDetailedContext(text: string, offset: number): SignatureContext | null {
        let pos = offset - 1;
        
        // Find the start of the current block
        let braceDepth = 0;
        let blockStart = -1;
        
        // Scan backwards to find the opening brace and command
        while (pos >= 0) {
            const char = text[pos];
            
            if (char === '}') {
                braceDepth++;
            } else if (char === '{') {
                braceDepth--;
                if (braceDepth < 0) {
                    blockStart = pos;
                    break;
                }
            }
            
            pos--;
        }
        
        if (blockStart === -1) return null;
        
        // Find the command name before the opening brace
        pos = blockStart - 1;
        while (pos >= 0 && /[\s=]/.test(text[pos])) {
            pos--;
        }
        
        if (pos < 0) return null;
        
        // Extract command name
        let commandEnd = pos + 1;
        while (pos >= 0 && /[a-zA-Z0-9_]/.test(text[pos])) {
            pos--;
        }
        const commandStart = pos + 1;
        
        if (commandStart >= commandEnd) return null;
        
        const command = text.substring(commandStart, commandEnd);
        
        // Count parameters to determine active parameter
        const blockContent = text.substring(blockStart + 1, offset);
        const parameterIndex = this.countParameters(blockContent);
        
        return {
            command,
            isInBlock: true,
            currentParameterIndex: parameterIndex,
            blockDepth: 1
        };
    }

    /**
     * Count parameters in block content
     */
    private countParameters(content: string): number {
        let count = 0;
        let depth = 0;
        let inString = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '"') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') {
                    depth++;
                } else if (char === '}') {
                    depth--;
                } else if (char === '=' && depth === 0) {
                    count++;
                }
            }
        }
        
        return Math.max(0, count);
    }

    /**
     * Get signatures for a command with rich documentation
     */
    private getSignatures(context: SignatureContext): SignatureInformation[] {
        const signatures: SignatureInformation[] = [];
        const command = context.command;

        // Check if it's an effect
        const dataLoader = getDataLoader();
        const effect = dataLoader.getEffects().get(command);
        if (effect) {
            signatures.push(...this.createEffectSignatures(command, effect));
        }

        // Check if it's a trigger
        const trigger = dataLoader.getTriggers().get(command);
        if (trigger) {
            signatures.push(...this.createTriggerSignatures(command, trigger));
        }

        // Special signatures for complex commands
        signatures.push(...this.getSpecialSignatures(command));

        return signatures;
    }

    /**
     * Create signatures for an effect
     */
    private createEffectSignatures(name: string, effect: EffectDefinition): SignatureInformation[] {
        const signatures: SignatureInformation[] = [];
        const params = effect.parameters ? Object.keys(effect.parameters) : [];
        const paramDescs = effect.parameters || {};
        const hasBlock = params.length > 0 || (effect.snippet && effect.snippet.includes('{'));

        if (hasBlock) {
            const label = params.length > 0
                ? `${name} = { ${params.join(', ')} }`
                : `${name} = { ... }`;

            const documentation = this.createMarkupDocumentation(
                effect.description || `Effect: ${name}`,
                effect.detail,
                effect.scopes,
                effect.example || this.getEffectExample(name)
            );

            const parameterInfo = params.map(param =>
                ParameterInformation.create(param, paramDescs[param] || `Parameter: ${param}`)
            );

            signatures.push({ label, documentation, parameters: parameterInfo });
        } else {
            const label = `${name} = <value>`;
            const documentation = this.createMarkupDocumentation(
                effect.description || `Effect: ${name}`,
                effect.detail,
                effect.scopes,
                effect.example || this.getEffectExample(name)
            );

            signatures.push({
                label,
                documentation,
                parameters: [ParameterInformation.create('<value>', 'Value to set')],
            });
        }

        return signatures;
    }

    /**
     * Create signatures for a trigger
     */
    private createTriggerSignatures(name: string, trigger: TriggerDefinition): SignatureInformation[] {
        const signatures: SignatureInformation[] = [];
        const params = trigger.parameters ? Object.keys(trigger.parameters) : [];
        const paramDescs = trigger.parameters || {};
        const hasBlock = params.length > 0 || (trigger.snippet && trigger.snippet.includes('{'));

        if (hasBlock) {
            const label = params.length > 0
                ? `${name} = { ${params.join(', ')} }`
                : `${name} = { ... }`;

            const documentation = this.createMarkupDocumentation(
                trigger.description || `Trigger: ${name}`,
                trigger.detail,
                trigger.scopes,
                trigger.example || this.getTriggerExample(name)
            );

            const parameterInfo = params.map(param =>
                ParameterInformation.create(param, paramDescs[param] || `Parameter: ${param}`)
            );

            signatures.push({ label, documentation, parameters: parameterInfo });
        } else {
            const label = `${name} = <value>`;
            const documentation = this.createMarkupDocumentation(
                trigger.description || `Trigger: ${name}`,
                trigger.detail,
                trigger.scopes,
                trigger.example || this.getTriggerExample(name)
            );

            signatures.push({
                label,
                documentation,
                parameters: [ParameterInformation.create('<value>', 'Value to compare')],
            });
        }

        return signatures;
    }
    /**
     * Get special signatures for complex commands
     */
    private getSpecialSignatures(command: string): SignatureInformation[] {
        const signatures: SignatureInformation[] = [];

        switch (command) {
            case 'set_variable':
                signatures.push({
                    label: 'set_variable = { name = <name> value = <value> }',
                    documentation: this.createMarkupDocumentation(
                        'Set a script variable with a name and value',
                        'Variables can store numbers, booleans, scopes, or flags.',
                        ['all'],
                        '```\nset_variable = {\n\tname = my_counter\n\tvalue = 10\n}\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('name', 'Variable name (identifier)'),
                        ParameterInformation.create('value', 'Variable value (number, bool, scope, or flag)'),
                    ],
                });
                break;

            case 'change_variable':
                signatures.push({
                    label: 'change_variable = { name = <name> add = <value> }',
                    documentation: this.createMarkupDocumentation(
                        'Modify a numeric variable',
                        'Can add or subtract from the variable value.',
                        ['all'],
                        '```\nchange_variable = {\n\tname = my_counter\n\tadd = 5\n}\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('name', 'Variable name'),
                        ParameterInformation.create('add', 'Amount to add (can be negative)'),
                    ],
                });
                break;

            case 'trigger_event':
                signatures.push({
                    label: 'trigger_event = { id = <event_id> days = <days> }',
                    documentation: this.createMarkupDocumentation(
                        'Trigger an event for the current scope',
                        'Can optionally delay the event by a number of days.',
                        ['all'],
                        '```\ntrigger_event = {\n\tid = my_namespace.0001\n\tdays = 7\n}\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('id', 'Event ID (namespace.number)'),
                        ParameterInformation.create('days', 'Delay in days (optional)'),
                    ],
                });
                
                // Alternative signature with direct ID
                signatures.push({
                    label: 'trigger_event = <event_id>',
                    documentation: this.createMarkupDocumentation(
                        'Trigger an event immediately',
                        'Shorthand syntax for immediate event triggering.',
                        ['all'],
                        '```\ntrigger_event = my_namespace.0001\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('<event_id>', 'Event ID'),
                    ],
                });
                break;

            case 'if':
            case 'else_if':
                signatures.push({
                    label: `${command} = { limit = { ... } ... }`,
                    documentation: this.createMarkupDocumentation(
                        'Conditional block with limit and effects',
                        'Execute effects only if the limit conditions are met.',
                        ['all'],
                        `\`\`\`\n${command} = {\n\tlimit = {\n\t\tgold >= 100\n\t}\n\tadd_prestige = 50\n}\n\`\`\``
                    ),
                    parameters: [
                        ParameterInformation.create('limit', 'Trigger conditions'),
                        ParameterInformation.create('...', 'Effects to execute'),
                    ],
                });
                break;

            case 'random':
                signatures.push({
                    label: 'random = { chance = <percent> ... }',
                    documentation: this.createMarkupDocumentation(
                        'Random chance block',
                        'Execute effects with a percentage chance.',
                        ['all'],
                        '```\nrandom = {\n\tchance = 50\n\tadd_gold = 100\n}\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('chance', 'Percentage (0-100)'),
                        ParameterInformation.create('...', 'Effects to execute'),
                    ],
                });
                break;

            case 'switch':
                signatures.push({
                    label: 'switch = { trigger = <value> ... }',
                    documentation: this.createMarkupDocumentation(
                        'Switch statement for multiple conditions',
                        'Execute different effects based on a trigger value.',
                        ['all'],
                        '```\nswitch = {\n\ttrigger = culture\n\tculture:norse = { ... }\n\tculture:saxon = { ... }\n}\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('trigger', 'Value to switch on'),
                        ParameterInformation.create('...', 'Cases and effects'),
                    ],
                });
                break;

            case 'random_list':
                signatures.push({
                    label: 'random_list = { <weight> = { ... } ... }',
                    documentation: this.createMarkupDocumentation(
                        'Weighted random selection',
                        'Execute one of multiple options based on weights.',
                        ['all'],
                        '```\nrandom_list = {\n\t70 = { add_gold = 50 }\n\t30 = { add_prestige = 100 }\n}\n```'
                    ),
                    parameters: [
                        ParameterInformation.create('<weight>', 'Relative weight'),
                        ParameterInformation.create('...', 'Effects for this option'),
                    ],
                });
                break;

            case 'save_scope_as':
            case 'save_temporary_scope_as':
                signatures.push({
                    label: `${command} = <name>`,
                    documentation: this.createMarkupDocumentation(
                        command === 'save_scope_as' 
                            ? 'Save the current scope with a name for later reference'
                            : 'Save the current scope temporarily (cleared at end of event)',
                        'Saved scopes can be accessed with scope:<name>',
                        ['all'],
                        `\`\`\`\n${command} = my_character\n# Later:\nscope:my_character = { add_gold = 100 }\n\`\`\``
                    ),
                    parameters: [
                        ParameterInformation.create('<name>', 'Scope identifier'),
                    ],
                });
                break;

            case 'add_opinion':
            case 'remove_opinion':
                signatures.push({
                    label: `${command} = { target = <character> modifier = <modifier> }`,
                    documentation: this.createMarkupDocumentation(
                        command === 'add_opinion' 
                            ? 'Add an opinion modifier towards a target'
                            : 'Remove an opinion modifier towards a target',
                        'Opinion modifiers affect AI behavior and interactions.',
                        ['character'],
                        `\`\`\`\n${command} = {\n\ttarget = scope:rival\n\tmodifier = insulted_opinion\n}\n\`\`\``
                    ),
                    parameters: [
                        ParameterInformation.create('target', 'Target character'),
                        ParameterInformation.create('modifier', 'Opinion modifier key'),
                    ],
                });
                break;

            case 'add_trait':
            case 'remove_trait':
                signatures.push({
                    label: `${command} = <trait>`,
                    documentation: this.createMarkupDocumentation(
                        command === 'add_trait'
                            ? 'Add a trait to the character'
                            : 'Remove a trait from the character',
                        'Traits affect character stats, AI, and gameplay.',
                        ['character'],
                        `\`\`\`\n${command} = brave\n\`\`\``
                    ),
                    parameters: [
                        ParameterInformation.create('<trait>', 'Trait key'),
                    ],
                });
                break;
        }

        return signatures;
    }

    /**
     * Create rich markup documentation
     */
    private createMarkupDocumentation(
        description: string,
        details?: string,
        scopes?: string[],
        example?: string
    ): { kind: MarkupKind; value: string } {
        let markdown = `**${description}**\n\n`;

        if (details) {
            markdown += `${details}\n\n`;
        }

        if (scopes && scopes.length > 0 && !scopes.includes('all')) {
            markdown += `**Valid Scopes:** ${scopes.map(s => `\`${s}\``).join(', ')}\n\n`;
        }

        if (example) {
            markdown += `**Example:**\n${example}\n`;
        }

        return {
            kind: MarkupKind.Markdown,
            value: markdown,
        };
    }

    /**
     * Get example for an effect
     */
    private getEffectExample(name: string): string | undefined {
        const examples: Record<string, string> = {
            'add_gold': '```\nadd_gold = 100\n```',
            'add_prestige': '```\nadd_prestige = 50\n```',
            'add_piety': '```\nadd_piety = 25\n```',
            'death': '```\ndeath = {\n\tdeath_reason = death_battle\n}\n```',
            'start_war': '```\nstart_war = {\n\tcasus_belli = conquest_cb\n\ttarget = scope:enemy\n}\n```',
        };

        return examples[name];
    }

    /**
     * Get example for a trigger
     */
    private getTriggerExample(name: string): string | undefined {
        const examples: Record<string, string> = {
            'has_trait': '```\nhas_trait = brave\n```',
            'gold': '```\ngold >= 100\n```',
            'age': '```\nage >= 16\n```',
            'is_alive': '```\nis_alive = yes\n```',
        };

        return examples[name];
    }
}
