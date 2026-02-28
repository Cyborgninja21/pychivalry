/**
 * Enhanced Hover Provider - Rich documentation with context awareness
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { getDataLoader, EffectDefinition, TriggerDefinition, TraitDefinition, ScopeDefinition, OnActionDefinition } from '../data/loader';
import { EnhancedIndexer } from '../core/indexer-enhanced';
import { SymbolType } from '../core/indexer';
import { SchemaHoverProvider } from '../schema/hover';
import { getListIteratorDocumentation, getListResultScope } from '../ck3/validation/lists';
import { LocalizationIndex } from '../core/localization-index';
import { ModScanner } from '../data/mod-scanner';

/**
 * Default scope used when scope chain analysis cannot determine starting point
 */
const DEFAULT_ROOT_SCOPE = 'character';

/**
 * Represents different documentation contexts
 */
enum DocContext {
    Effect = 'effect',
    Trigger = 'trigger',
    Trait = 'trait',
    Scope = 'scope',
    Variable = 'variable',
    Unknown = 'unknown'
}

/**
 * Markdown documentation assembler using functional composition
 */
class MarkdownDocAssembler {
    private fragments: string[] = [];

    /** Append title with emoji icon */
    title(text: string, emoji: string): this {
        this.fragments.push(`${emoji} **${text}**`);
        return this;
    }

    /** Append descriptive paragraph */
    paragraph(text: string): this {
        if (text) {
            this.fragments.push(`\n${text}`);
        }
        return this;
    }

    /** Append divider line */
    divider(): this {
        this.fragments.push('\n---');
        return this;
    }

    /** Append formatted table */
    table(headers: string[], rows: string[][]): this {
        if (rows.length === 0) return this;

        this.fragments.push('\n');
        this.fragments.push(`| ${headers.join(' | ')} |`);
        this.fragments.push(`| ${headers.map(() => '---').join(' | ')} |`);

        rows.forEach(row => {
            this.fragments.push(`| ${row.join(' | ')} |`);
        });

        return this;
    }

    /** Append code snippet */
    codeSnippet(code: string, lang: string = 'ck3'): this {
        this.fragments.push(`\n\`\`\`${lang}\n${code}\n\`\`\``);
        return this;
    }

    /** Append bulleted list */
    bulletList(items: string[]): this {
        if (items.length > 0) {
            this.fragments.push('\n');
            items.forEach(item => this.fragments.push(`- ${item}`));
        }
        return this;
    }

    /** Append inline code reference */
    inlineRef(text: string): this {
        this.fragments.push(`\n\`${text}\``);
        return this;
    }

    /** Get assembled markdown */
    compile(): string {
        return this.fragments.join('');
    }
}

/**
 * Enhanced Hover Provider with rich documentation
 */
export class HoverProvider {
    private docCache: Map<string, string> = new Map();
    private readonly MAX_CACHE_SIZE = 500;
    private schemaHoverProvider: SchemaHoverProvider;

    constructor(
        private parser: CK3Parser,
        private schemaLoader: SchemaLoader,
        private indexer?: EnhancedIndexer,
        private localizationIndex?: LocalizationIndex,
        private modScanner?: ModScanner
    ) {
        this.schemaHoverProvider = new SchemaHoverProvider(schemaLoader);
    }

    /**
     * Get mod source badge for a symbol name
     */
    private getModSourceBadge(name: string): string {
        if (!this.modScanner) return '';
        const modName = this.modScanner.getSourceMod(name);
        if (!modName) return '';
        return `\n\n📦 **Mod:** ${modName}`;
    }

    /**
     * Provide context-aware hover information
     */
    public async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
        const tokenInfo = this.extractTokenInfo(document, position);
        if (!tokenInfo.token) return null;

        // Check cache first
        const cacheKey = `${tokenInfo.context}:${tokenInfo.token}`;
        if (this.docCache.has(cacheKey)) {
            return this.createHoverResponse(this.docCache.get(cacheKey)!);
        }

        const dataLoader = getDataLoader();
        let documentation: string | null = null;

        // Route to appropriate documentation generator
        const effects = dataLoader.getEffects();
        if (effects.has(tokenInfo.token)) {
            documentation = this.generateEffectDocs(tokenInfo.token, effects.get(tokenInfo.token)!, dataLoader);
        } else {
            const triggers = dataLoader.getTriggers();
            if (triggers.has(tokenInfo.token)) {
                documentation = this.generateTriggerDocs(tokenInfo.token, triggers.get(tokenInfo.token)!, dataLoader);
            } else {
                const traits = dataLoader.getTraits();
                if (traits.has(tokenInfo.token)) {
                    documentation = this.generateTraitDocs(tokenInfo.token, traits.get(tokenInfo.token)!, dataLoader);
                } else {
                    // Check for scope chain
                    if (tokenInfo.token.includes('.')) {
                        documentation = this.generateScopeChainDocs(tokenInfo.token, dataLoader);
                    }
                }
            }
        }

        // Try keyword hover
        if (!documentation) {
            documentation = this.generateKeywordDocs(tokenInfo.token);
        }

        // Try event ID hover (namespace.number pattern)
        if (!documentation && /^\w+\.\d+$/.test(tokenInfo.token)) {
            documentation = this.generateEventIdDocs(tokenInfo.token);
        }

        // Try namespace hover
        if (!documentation && /^[a-z_]+$/.test(tokenInfo.token)) {
            documentation = this.generateNamespaceDocs(tokenInfo.token);
        }

        // Try scripted effect/trigger hover
        if (!documentation) {
            documentation = this.generateScriptedSymbolDocs(tokenInfo.token);
        }

        // Try context field hover
        if (!documentation) {
            documentation = this.generateContextFieldDocs(tokenInfo.token);
        }

        // Try saved scope hover (scope:xxx)
        if (!documentation && tokenInfo.token.startsWith('scope:')) {
            documentation = this.generateSavedScopeDocs(tokenInfo.token);
        }

        // Try character flag hover
        if (!documentation) {
            documentation = this.generateCharacterFlagDocs(tokenInfo.token);
        }

        // Try list iterator hover (any_*, every_*, random_*, ordered_*)
        if (!documentation) {
            documentation = this.generateListIteratorDocs(tokenInfo.token);
        }

        // Try localization key hover
        if (!documentation && this.localizationIndex) {
            documentation = this.generateLocalizationDocs(tokenInfo.token);
        }

        // Try schema-based field hover
        if (!documentation) {
            const schemaHover = await this.schemaHoverProvider.getFieldHover(document.uri, tokenInfo.token);
            if (schemaHover && schemaHover.contents) {
                const content = schemaHover.contents as { value: string };
                documentation = content.value;
            }
        }

        if (documentation) {
            // LRU cache eviction
            if (this.docCache.size >= this.MAX_CACHE_SIZE) {
                const firstKey = this.docCache.keys().next().value;
                if (firstKey) this.docCache.delete(firstKey);
            }
            this.docCache.set(cacheKey, documentation);
            return this.createHoverResponse(documentation);
        }

        return null;
    }

    /**
     * Clear cache (call on document close)
     */
    public clearCache(): void {
        this.docCache.clear();
    }

    /**
     * Generate rich documentation for effects
     */
    private generateEffectDocs(name: string, effect: EffectDefinition, loader: any): string {
        const doc = new MarkdownDocAssembler();

        doc.title(`Effect: ${name}`, '⚡');
        doc.paragraph(effect.description || 'Modifies game state');

        // Parameter details
        if (effect.parameters && Object.keys(effect.parameters).length > 0) {
            doc.divider();
            doc.paragraph('**Parameters**');

            const paramRows = Object.entries(effect.parameters).map(([key, val]) => {
                return [key, val, this.inferParamType(key, val)];
            });
            doc.table(['Name', 'Description', 'Type'], paramRows);
        }

        // Scope information
        if (effect.scope || effect.target_scope) {
            doc.divider();
            const scopeInfo: string[] = [];
            if (effect.scope) scopeInfo.push(`**Required Scope:** \`${effect.scope}\``);
            if (effect.target_scope) scopeInfo.push(`**Result Scope:** \`${effect.target_scope}\``);
            doc.bulletList(scopeInfo);
        }

        // Examples with explanations
        if (effect.examples && effect.examples.length > 0) {
            doc.divider();
            doc.paragraph('**Usage Examples**');

            const exampleCount = Math.min(effect.examples.length, 3);
            for (let i = 0; i < exampleCount; i++) {
                const exampleLabel = exampleCount > 1 ? `Example ${i + 1}` : 'Example';
                doc.paragraph(`\n*${exampleLabel}:*`);
                doc.codeSnippet(effect.examples[i]);
            }
        }

        // Related effects
        const relatedEffects = this.findRelatedEffects(name, loader);
        if (relatedEffects.length > 0) {
            doc.divider();
            doc.paragraph('**Related Effects**');
            doc.bulletList(relatedEffects.map(e => `\`${e}\``));
        }

        return doc.compile() + this.getModSourceBadge(name);
    }

    /**
     * Generate rich documentation for triggers
     */
    private generateTriggerDocs(name: string, trigger: TriggerDefinition, loader: any): string {
        const doc = new MarkdownDocAssembler();

        doc.title(`Trigger: ${name}`, '🔍');
        doc.paragraph(trigger.description || 'Evaluates game condition');

        // Parameters
        if (trigger.parameters && Object.keys(trigger.parameters).length > 0) {
            doc.divider();
            doc.paragraph('**Parameters**');

            const paramRows = Object.entries(trigger.parameters).map(([key, val]) => {
                return [key, val, this.inferParamType(key, val)];
            });
            doc.table(['Name', 'Description', 'Type'], paramRows);
        }

        // Scope and return type
        const metaInfo: string[] = [];
        if (trigger.scope) metaInfo.push(`**Scope:** \`${trigger.scope}\``);
        if (trigger.return_type) metaInfo.push(`**Returns:** \`${trigger.return_type}\``);

        if (metaInfo.length > 0) {
            doc.divider();
            doc.bulletList(metaInfo);
        }

        // Usage examples
        if (trigger.examples && trigger.examples.length > 0) {
            doc.divider();
            doc.paragraph('**Usage Examples**');

            const exampleCount = Math.min(trigger.examples.length, 3);
            for (let i = 0; i < exampleCount; i++) {
                const exampleLabel = exampleCount > 1 ? `Example ${i + 1}` : 'Example';
                doc.paragraph(`\n*${exampleLabel}:*`);
                doc.codeSnippet(trigger.examples[i]);
            }
        }

        // Related triggers
        const relatedTriggers = this.findRelatedTriggers(name, loader);
        if (relatedTriggers.length > 0) {
            doc.divider();
            doc.paragraph('**Related Triggers**');
            doc.bulletList(relatedTriggers.map(t => `\`${t}\``));
        }

        return doc.compile() + this.getModSourceBadge(name);
    }

    /**
     * Generate rich documentation for traits
     */
    private generateTraitDocs(id: string, trait: TraitDefinition, loader: any): string {
        const doc = new MarkdownDocAssembler();

        doc.title(`Trait: ${trait.name || id}`, '🎭');

        // Trait metadata table
        const metaRows: string[][] = [];
        if (trait.category) metaRows.push(['Category', trait.category]);
        if (trait.level !== undefined) metaRows.push(['Level', trait.level.toString()]);

        if (metaRows.length > 0) {
            doc.table(['Property', 'Value'], metaRows);
        }

        // Opposites and compatibility
        if (trait.opposites && trait.opposites.length > 0) {
            doc.divider();
            doc.paragraph('⚠️ **Incompatible With**');
            doc.bulletList(trait.opposites.map(o => `\`${o}\``));
        }

        // Usage in effects
        doc.divider();
        doc.paragraph('**Common Usage**');
        doc.codeSnippet(`add_trait = ${id}\n\nremove_trait = ${id}\n\nhas_trait = ${id}`);

        return doc.compile() + this.getModSourceBadge(id);
    }

    /**
     * Generate documentation for scope chains (e.g., "root.liege.primary_title")
     */
    private generateScopeChainDocs(chain: string, loader: any): string {
        const doc = new MarkdownDocAssembler();
        const parts = chain.split('.');

        doc.title(`Scope Chain`, '🔗');
        doc.paragraph(`Navigates through game object relationships`);
        doc.divider();

        // Explain each step
        const scopes = loader.getScopes();
        let currentScope = DEFAULT_ROOT_SCOPE;

        doc.paragraph('**Navigation Steps**');
        const steps: string[] = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const scopeData = scopes.get(currentScope);

            if (scopeData?.links?.[part]) {
                const targetScope = scopeData.links[part];
                steps.push(`${i + 1}. \`${part}\` → moves from \`${currentScope}\` to \`${targetScope}\``);
                currentScope = targetScope;
            } else {
                steps.push(`${i + 1}. \`${part}\` → scope transition`);
            }
        }

        doc.bulletList(steps);
        doc.divider();
        doc.paragraph(`**Final Scope Type:** \`${currentScope}\``);

        // Example usage
        doc.divider();
        doc.paragraph('**Example Usage**');
        doc.codeSnippet(`${chain} = {\n    # Apply effects to target scope\n    add_gold = 100\n}`);

        return doc.compile();
    }

    /**
     * Generate hover for CK3 keywords
     */
    private generateKeywordDocs(keyword: string): string | null {
        const KEYWORD_DOCS: Record<string, { title: string; desc: string; example: string }> = {
            'trigger': {
                title: 'Trigger Block',
                desc: 'Conditions that must all be true for the enclosing block to execute. Evaluated but does not modify game state.',
                example: 'trigger = {\n\tis_ai = no\n\tage >= 16\n}'
            },
            'immediate': {
                title: 'Immediate Effects',
                desc: 'Effects that fire instantly when the event starts, before any options are shown to the player.',
                example: 'immediate = {\n\tset_variable = { name = my_var value = 1 }\n}'
            },
            'option': {
                title: 'Event Option',
                desc: 'A choice presented to the player. Can contain triggers (to show/hide), effects, and AI weighting.',
                example: 'option = {\n\tname = my_event.0001.a\n\tadd_gold = 100\n}'
            },
            'if': {
                title: 'Conditional Block',
                desc: 'Executes contained effects only if the limit trigger evaluates to true.',
                example: 'if = {\n\tlimit = { is_adult = yes }\n\tadd_gold = 50\n}'
            },
            'limit': {
                title: 'Limit Block',
                desc: 'Conditions that filter list iterations (any_/every_/random_) or guard if/else_if blocks.',
                example: 'any_vassal = {\n\tlimit = { is_adult = yes }\n\tadd_opinion = { ... }\n}'
            },
            'effect': {
                title: 'Effect Block',
                desc: 'Game state modifications. Contains commands that change characters, titles, or other game objects.',
                example: 'effect = {\n\tadd_trait = brave\n\tadd_gold = 100\n}'
            },
            'after': {
                title: 'After Block',
                desc: 'Effects that fire after all options have been processed, regardless of which option was chosen.',
                example: 'after = {\n\tremove_character_flag = my_flag\n}'
            },
            'desc': {
                title: 'Description',
                desc: 'Localization key for event/decision description text displayed to the player.',
                example: 'desc = my_event.0001.desc'
            },
            'title': {
                title: 'Title',
                desc: 'Localization key for the title text of an event, decision, or interaction.',
                example: 'title = my_event.0001.t'
            },
            'type': {
                title: 'Type Field',
                desc: 'Specifies the type of event, character interaction, or other game object.',
                example: 'type = character_event'
            },
            'theme': {
                title: 'Event Theme',
                desc: 'Visual theme for event window. Determines background, frame, and color scheme.',
                example: 'theme = realm'
            },
            'else': {
                title: 'Else Block',
                desc: 'Executes effects when the preceding if/else_if conditions are all false.',
                example: 'else = {\n\tadd_gold = -50\n}'
            },
            'else_if': {
                title: 'Else-If Block',
                desc: 'Conditional fallback. Checked only when preceding if/else_if conditions were false.',
                example: 'else_if = {\n\tlimit = { age >= 30 }\n\tadd_prestige = 100\n}'
            },
            'while': {
                title: 'While Loop',
                desc: 'Repeats contained effects as long as the limit trigger is true (max 1000 iterations).',
                example: 'while = {\n\tlimit = { gold >= 100 }\n\tadd_gold = -100\n}'
            },
            'switch': {
                title: 'Switch Block',
                desc: 'Multi-branch conditional based on a trigger value.',
                example: 'switch = {\n\ttrigger = faith\n\tfaith:catholic = { ... }\n}'
            },
        };

        const info = KEYWORD_DOCS[keyword];
        if (!info) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(info.title, '📖');
        doc.paragraph(info.desc);
        doc.divider();
        doc.paragraph('**Example**');
        doc.codeSnippet(info.example);
        return doc.compile();
    }

    /**
     * Generate hover for event IDs using the workspace index
     */
    private generateEventIdDocs(eventId: string): string | null {
        if (!this.indexer) return null;

        const event = this.indexer.getEvent(eventId);
        if (!event) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(`Event: ${eventId}`, '📜');

        const metaRows: string[][] = [];
        metaRows.push(['Type', `\`${event.type}\``]);
        if (event.theme) metaRows.push(['Theme', `\`${event.theme}\``]);
        if (event.title) metaRows.push(['Title Key', `\`${event.title}\``]);
        if (event.desc) metaRows.push(['Desc Key', `\`${event.desc}\``]);
        if (event.sourceUri) metaRows.push(['File', event.sourceUri.split('/').pop() || event.sourceUri]);
        doc.table(['Property', 'Value'], metaRows);

        if (event.options.length > 0) {
            doc.divider();
            doc.paragraph('**Options**');
            doc.bulletList(event.options.map((o, i) =>
                o.name ? `\`${o.name}\`` : `Option ${i + 1} (unnamed)`
            ));
        }

        if (event.triggers.length > 0) {
            doc.divider();
            doc.paragraph('**Triggers**');
            doc.bulletList(event.triggers.slice(0, 5).map(t => `\`${t}\``));
        }

        return doc.compile();
    }

    /**
     * Generate hover for event namespaces
     */
    private generateNamespaceDocs(namespace: string): string | null {
        if (!this.indexer) return null;

        const events = this.indexer.getEventsByNamespace(namespace);
        if (events.length === 0) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(`Namespace: ${namespace}`, '📁');
        doc.paragraph(`Contains **${events.length}** event(s)`);

        const rows = events.slice(0, 15).map(e => [
            `\`${e.id}\``,
            e.type,
            e.title ? `\`${e.title}\`` : ''
        ]);
        doc.table(['Event ID', 'Type', 'Title Key'], rows);

        if (events.length > 15) {
            doc.paragraph(`*... and ${events.length - 15} more*`);
        }

        return doc.compile();
    }

    /**
     * Generate hover for scripted effects/triggers from workspace index
     */
    private generateScriptedSymbolDocs(name: string): string | null {
        if (!this.indexer) return null;

        const symbols = this.indexer.findSymbolsByName(name);
        if (symbols.length === 0) return null;

        const sym = symbols[0];

        const symbolLabels: Partial<Record<SymbolType, { label: string; emoji: string }>> = {
            [SymbolType.SCRIPTED_EFFECT]: { label: 'Scripted Effect', emoji: '⚡' },
            [SymbolType.SCRIPTED_TRIGGER]: { label: 'Scripted Trigger', emoji: '🔍' },
            [SymbolType.CHARACTER_INTERACTION]: { label: 'Character Interaction', emoji: '🤝' },
            [SymbolType.MODIFIER]: { label: 'Modifier', emoji: '📊' },
            [SymbolType.ON_ACTION]: { label: 'On-Action', emoji: '🎯' },
            [SymbolType.OPINION_MODIFIER]: { label: 'Opinion Modifier', emoji: '💬' },
            [SymbolType.SCRIPTED_GUI]: { label: 'Scripted GUI', emoji: '🖥️' },
        };

        const info = symbolLabels[sym.type];
        if (!info) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(`${info.label}: ${name}`, info.emoji);

        const fileName = sym.uri.split('/').pop() || sym.uri;
        doc.paragraph(`Defined in \`${fileName}\` at line ${sym.range.start.line + 1}`);

        if (sym.detail) {
            doc.divider();
            doc.paragraph(sym.detail);
        }

        // On-action: show rich metadata from OnActionDefinition
        if (sym.type === SymbolType.ON_ACTION) {
            const dataLoader = getDataLoader();
            const onActions = dataLoader.getOnActions();
            const onAction = onActions.get(name);
            if (onAction) {
                if (onAction.description) {
                    doc.divider();
                    doc.paragraph(onAction.description);
                }
                const metaInfo: string[] = [];
                if (onAction.scopes) {
                    const scopeEntries = Object.entries(onAction.scopes);
                    if (scopeEntries.length > 0) {
                        metaInfo.push(`**Scopes:** ${scopeEntries.map(([k, v]) => `\`${k}\` = \`${v}\``).join(', ')}`);
                    }
                }
                if (onAction.has_trigger) metaInfo.push('**Has trigger:** yes');
                if (onAction.has_effect) metaInfo.push('**Has effect:** yes');
                if (onAction.is_pulse) metaInfo.push('**Pulse action:** yes');
                if (metaInfo.length > 0) {
                    doc.divider();
                    doc.bulletList(metaInfo);
                }
                if (onAction.events && onAction.events.length > 0) {
                    doc.divider();
                    doc.paragraph('**Events**');
                    const eventNames = onAction.events.slice(0, 10).map(e =>
                        typeof e === 'string' ? `\`${e}\`` : `\`${e.event}\``
                    );
                    doc.bulletList(eventNames);
                    if (onAction.events.length > 10) {
                        doc.paragraph(`*... and ${onAction.events.length - 10} more*`);
                    }
                }
            }
        }

        return doc.compile() + this.getModSourceBadge(name);
    }

    /**
     * Generate hover for CK3 context fields (option/event/portrait fields)
     */
    private generateContextFieldDocs(field: string): string | null {
        const CONTEXT_FIELDS: Record<string, { title: string; desc: string; type: string }> = {
            'name': { title: 'Option/Event Name', desc: 'Localization key for display text', type: 'localization_key' },
            'ai_chance': { title: 'AI Chance', desc: 'Weight modifier for AI option selection', type: 'value_block' },
            'ai_will_do': { title: 'AI Will Do', desc: 'Weight for AI decision evaluation', type: 'value_block' },
            'is_shown': { title: 'Is Shown Trigger', desc: 'Conditions for showing this decision in the UI', type: 'trigger_block' },
            'is_valid': { title: 'Is Valid Trigger', desc: 'Conditions that must be true to take this decision', type: 'trigger_block' },
            'cost': { title: 'Decision Cost', desc: 'Resources required to take this decision (gold, prestige, piety)', type: 'value_block' },
            'cooldown': { title: 'Cooldown', desc: 'Time before this can be used again', type: 'duration' },
            'left_portrait': { title: 'Left Portrait', desc: 'Character shown on the left side of the event window', type: 'scope_reference' },
            'right_portrait': { title: 'Right Portrait', desc: 'Character shown on the right side of the event window', type: 'scope_reference' },
            'lower_left_portrait': { title: 'Lower-Left Portrait', desc: 'Character shown in the lower-left of the event window', type: 'scope_reference' },
            'lower_right_portrait': { title: 'Lower-Right Portrait', desc: 'Character shown in the lower-right of the event window', type: 'scope_reference' },
            'override_background': { title: 'Override Background', desc: 'Custom background for the event window', type: 'reference' },
            'override_icon': { title: 'Override Icon', desc: 'Custom icon for the event window', type: 'reference' },
            'override_sound': { title: 'Override Sound', desc: 'Custom sound effect for the event', type: 'reference' },
            'on_setup': { title: 'Story Cycle Setup', desc: 'Effects that fire when the story cycle begins', type: 'effect_block' },
            'on_end': { title: 'Story Cycle End', desc: 'Effects that fire when the story cycle ends', type: 'effect_block' },
            'on_owner_death': { title: 'On Owner Death', desc: 'Effects that fire when the story cycle owner dies', type: 'effect_block' },
            'effect_group': { title: 'Effect Group', desc: 'Timed effects within a story cycle that fire at intervals', type: 'block' },
            'triggered_effect': { title: 'Triggered Effect', desc: 'Conditional effect within an effect group', type: 'block' },
            'days': { title: 'Days', desc: 'Duration in days or range {min max} for effect timing', type: 'number_or_range' },
            'months': { title: 'Months', desc: 'Duration in months', type: 'number' },
            'years': { title: 'Years', desc: 'Duration in years', type: 'number' },
            'selection_tooltip': { title: 'Selection Tooltip', desc: 'Tooltip text shown when hovering over this decision', type: 'localization_key' },
            'major': { title: 'Major Decision', desc: 'If yes, this is a major decision with special UI treatment', type: 'boolean' },
        };

        const info = CONTEXT_FIELDS[field];
        if (!info) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(info.title, '📋');
        doc.paragraph(info.desc);
        doc.paragraph(`**Expected type:** \`${info.type}\``);
        return doc.compile();
    }

    /**
     * Generate hover for saved scopes (scope:xxx)
     */
    private generateSavedScopeDocs(token: string): string | null {
        if (!this.indexer) return null;

        const scopeName = token.substring(6); // Remove "scope:" prefix
        const symbols = this.indexer.findSymbolsByName(scopeName);
        const scopeSymbol = symbols.find(s => s.type === SymbolType.SCOPE);

        const doc = new MarkdownDocAssembler();
        doc.title(`Saved Scope: ${scopeName}`, '🔗');

        if (scopeSymbol) {
            const fileName = scopeSymbol.uri.split('/').pop() || scopeSymbol.uri;
            doc.paragraph(`Defined in \`${fileName}\` at line ${scopeSymbol.range.start.line + 1}`);
        } else {
            doc.paragraph('⚠️ **Warning:** This saved scope reference was not found in the workspace index.');
        }

        doc.divider();
        doc.paragraph('**Usage**');
        doc.codeSnippet(`save_scope_as = ${scopeName}\n# Later:\nscope:${scopeName} = { ... }`);

        return doc.compile();
    }

    /**
     * Generate hover for character flags
     */
    private generateCharacterFlagDocs(flagName: string): string | null {
        if (!this.indexer) return null;

        // Check if this looks like a character flag usage
        const symbols = this.indexer.findSymbolsByName(flagName);
        const flagSymbol = symbols.find(s => s.type === SymbolType.CHARACTER_FLAG);
        if (!flagSymbol) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(`Character Flag: ${flagName}`, '🚩');

        const fileName = flagSymbol.uri.split('/').pop() || flagSymbol.uri;
        doc.paragraph(`First defined in \`${fileName}\` at line ${flagSymbol.range.start.line + 1}`);

        // Count usage types from references
        const ref = this.indexer.getReferences(flagName);
        if (ref && ref.locations.length > 0) {
            let setCount = 0, checkCount = 0, removeCount = 0;
            for (const loc of ref.locations) {
                if (loc.context === 'effect') setCount++;
                else if (loc.context === 'trigger') checkCount++;
                else if (loc.context === 'definition') removeCount++;
            }
            if (setCount + checkCount + removeCount > 0) {
                doc.divider();
                const usageLines: string[] = [];
                if (setCount > 0) usageLines.push(`🟢 Set: ${setCount} time(s)`);
                if (checkCount > 0) usageLines.push(`🔍 Checked: ${checkCount} time(s)`);
                if (removeCount > 0) usageLines.push(`🗑️ Removed: ${removeCount} time(s)`);
                doc.paragraph(usageLines.join('  \n'));
            }
        }

        doc.divider();
        doc.paragraph('**Syntax**');
        doc.codeSnippet(
            `set_character_flag = ${flagName}\nhas_character_flag = ${flagName}\nremove_character_flag = ${flagName}`
        );

        return doc.compile();
    }

    /**
     * Generate hover for list iterators (any_*, every_*, random_*, ordered_*)
     */
    private generateListIteratorDocs(token: string): string | null {
        if (!/^(any|every|random|ordered)_/.test(token)) return null;

        const iteratorDoc = getListIteratorDocumentation(token);
        if (!iteratorDoc) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(`List Iterator: ${token}`, '🔄');
        doc.paragraph(iteratorDoc);

        // Show result scope if available
        const baseName = token.replace(/^(any|every|random|ordered)_/, '');
        const resultScope = getListResultScope(baseName);
        if (resultScope) {
            doc.paragraph(`**Result scope:** \`${resultScope}\``);
        }

        return doc.compile();
    }

    /**
     * Generate hover documentation for localization keys
     */
    private generateLocalizationDocs(token: string): string | null {
        if (!this.localizationIndex) return null;

        const entry = this.localizationIndex.findLocalization(token);
        if (!entry) return null;

        const doc = new MarkdownDocAssembler();
        doc.title(`\`${token}\``, '🏷️');
        doc.paragraph('**🌐 Localization Key**');
        doc.divider();

        // Format the localization text as a blockquote
        let displayText = entry.text
            .replace(/\\n/g, '\n')
            .replace(/#N/g, '\n');

        if (displayText.length > 500) {
            displayText = displayText.substring(0, 500) + '...';
        }

        const paragraphs = displayText.split('\n\n');
        const formatted = paragraphs
            .map(p => p.replace(/\n/g, ' ').trim())
            .filter(p => p.length > 0)
            .map(p => `> ${p}`)
            .join('\n>\n');

        doc.paragraph('📝 **Text:**\n\n' + formatted);
        doc.divider();

        const fileName = entry.filePath.split(/[\\\/]/).pop() || entry.filePath;
        doc.paragraph(`📂 **File:** \`${fileName}\``);
        doc.paragraph(`📍 **Line:** ${entry.line + 1}`);

        return doc.compile();
    }

    /**
     * Find effects related to the given effect name
     */
    private findRelatedEffects(name: string, loader: any): string[] {
        const related: string[] = [];
        const effects = loader.getEffects();

        // Pattern matching for related effects
        if (name.startsWith('add_')) {
            const base = name.substring(4);
            const removeVariant = `remove_${base}`;
            const changeVariant = `change_${base}`;
            if (effects.has(removeVariant)) related.push(removeVariant);
            if (effects.has(changeVariant)) related.push(changeVariant);
        } else if (name.startsWith('remove_')) {
            const base = name.substring(7);
            const addVariant = `add_${base}`;
            if (effects.has(addVariant)) related.push(addVariant);
        } else if (name.startsWith('set_')) {
            const base = name.substring(4);
            const changeVariant = `change_${base}`;
            if (effects.has(changeVariant)) related.push(changeVariant);
        }

        return related.slice(0, 5); // Limit to 5 related items
    }

    /**
     * Find triggers related to the given trigger name
     */
    private findRelatedTriggers(name: string, loader: any): string[] {
        const related: string[] = [];
        const triggers = loader.getTriggers();

        // Find inverse or related triggers
        if (name.startsWith('is_')) {
            const base = name.substring(3);
            const notVariant = `is_not_${base}`;
            if (triggers.has(notVariant)) related.push(notVariant);
        } else if (name.startsWith('has_')) {
            const base = name.substring(4);
            const notVariant = `has_no_${base}`;
            if (triggers.has(notVariant)) related.push(notVariant);
        }

        // Find "any_" and "all_" variants
        if (name.startsWith('any_')) {
            const base = name.substring(4);
            const allVariant = `all_${base}`;
            if (triggers.has(allVariant)) related.push(allVariant);
        } else if (name.startsWith('all_')) {
            const base = name.substring(4);
            const anyVariant = `any_${base}`;
            if (triggers.has(anyVariant)) related.push(anyVariant);
        }

        return related.slice(0, 5);
    }

    /**
     * Infer parameter type from key/value patterns using heuristic matching
     * 
     * Note: This uses string-based heuristics which may produce false positives.
     * Patterns are matched in priority order with explicit fallback to 'value'.
     */
    private inferParamType(key: string, description: string): string {
        const lowerKey = key.toLowerCase();
        const lowerDesc = description.toLowerCase();

        // Pattern configuration for type inference (priority order)
        const typePatterns = {
            number: {
                keyPatterns: ['days', 'years', 'months', 'amount', 'count'],
                descPatterns: ['number', 'amount', 'value']
            },
            scope: {
                keyPatterns: ['target', 'who', 'character', 'title'],
                descPatterns: ['scope', 'character', 'target']
            },
            bool: {
                keyPatterns: [],
                descPatterns: ['yes', 'no', 'true', 'false']
            }
        };

        // Check each type pattern
        for (const [type, patterns] of Object.entries(typePatterns)) {
            const keyMatch = patterns.keyPatterns.some(p => lowerKey.includes(p));
            const descMatch = patterns.descPatterns.every(p => lowerDesc.includes(p)) && patterns.descPatterns.length > 0;

            if (keyMatch || descMatch) {
                return type;
            }
        }

        // Explicit fallback
        return 'value';
    }

    /**
     * Extract token and context information from document position
     */
    private extractTokenInfo(document: TextDocument, position: Position): { token: string; context: DocContext } {
        const line = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: 1000 }
        });

        const offset = document.offsetAt(position);
        const text = document.getText();

        // Extract token with scope chain support
        let tokenStart = offset;
        let tokenEnd = offset;

        while (tokenStart > 0 && /[a-zA-Z0-9_.]/.test(text[tokenStart - 1])) {
            tokenStart--;
        }

        while (tokenEnd < text.length && /[a-zA-Z0-9_.]/.test(text[tokenEnd])) {
            tokenEnd++;
        }

        const token = text.substring(tokenStart, tokenEnd);

        // Determine context (simplified - would be enhanced with AST analysis)
        let context = DocContext.Unknown;
        if (token.includes('.')) {
            context = DocContext.Scope;
        }

        return { token, context };
    }

    /**
     * Create hover response from markdown content
     */
    private createHoverResponse(markdown: string): Hover {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: markdown
            }
        };
    }
}
