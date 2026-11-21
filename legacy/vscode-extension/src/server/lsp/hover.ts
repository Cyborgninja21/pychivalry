/**
 * Hover Provider — CK3 knowledge comes from the engine (pychivalry-engine):
 *
 * - a keyword in a bucket shows the engine doc string verbatim with its bucket; a name in
 *   several buckets (40 names are both trigger and effect) shows each;
 * - an iterator shows its list base's doc; a retired keyword its replacement;
 * - a record field shows what the directory schema records for it at that position;
 * - workspace definitions (events, namespaces, scripted effects/triggers/lists/values,
 *   saved scopes, character flags) come from the engine index, localization keys from the
 *   engine's localization index.
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    CK3Parser,
    contextAt,
    LocalizationIndex,
    SymbolType,
    uriToPath,
    Workspace,
} from 'pychivalry-engine';
import { iteratorMarkdown, keywordMarkdown, retiredMarkdown } from './keyword-docs';

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
        if (rows.length === 0) {
            return this;
        }

        this.fragments.push('\n');
        this.fragments.push(`| ${headers.join(' | ')} |`);
        this.fragments.push(`| ${headers.map(() => '---').join(' | ')} |`);

        rows.forEach((row) => {
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
            items.forEach((item) => this.fragments.push(`- ${item}`));
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
 * Hover provider
 */
export class HoverProvider {
    private docCache: Map<string, string> = new Map();
    private readonly MAX_CACHE_SIZE = 500;

    constructor(
        private parser: CK3Parser,
        private workspace: Workspace,
        private localizationIndex?: LocalizationIndex
    ) {}

    private get indexer() {
        return this.workspace.index;
    }

    /**
     * Provide context-aware hover information
     */
    public async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
        const token = this.extractToken(document, position);
        if (!token) {
            return null;
        }

        // Schema fields depend on where the key is, so they are not cached.
        const field = this.generateFieldDocs(document, position, token);
        if (field) {
            return this.createHoverResponse(field);
        }

        const cached = this.docCache.get(token);
        if (cached) {
            return this.createHoverResponse(cached);
        }

        const spec = this.workspace.spec;
        const documentation =
            keywordMarkdown(spec, token) ??
            iteratorMarkdown(spec, token) ??
            retiredMarkdown(spec, token) ??
            (/^\w+\.\d+$/.test(token) ? this.generateEventIdDocs(token) : null) ??
            (/^[a-z_]+$/.test(token) ? this.generateNamespaceDocs(token) : null) ??
            this.generateScriptedSymbolDocs(token) ??
            (token.startsWith('scope:') ? this.generateSavedScopeDocs(token) : null) ??
            this.generateCharacterFlagDocs(token) ??
            (this.localizationIndex ? this.generateLocalizationDocs(token) : null);

        if (!documentation) {
            return null;
        }
        if (this.docCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.docCache.keys().next().value;
            if (firstKey) {
                this.docCache.delete(firstKey);
            }
        }
        this.docCache.set(token, documentation);
        return this.createHoverResponse(documentation);
    }

    /**
     * Clear cache (call on document close)
     */
    public clearCache(): void {
        this.docCache.clear();
    }

    /** A key that the directory schema records at this position. */
    private generateFieldDocs(
        document: TextDocument,
        position: Position,
        token: string
    ): string | null {
        const parsed = this.parser.parse(document.getText());
        const ctx = contextAt(this.workspace, uriToPath(document.uri), parsed.ast, position);
        // The hovered key sits in the innermost block whose body holds the position; the
        // block of the key itself (when it opens one) is one level deeper.
        const holder = ctx.path[ctx.path.length - 1];
        const isOwnBlock = holder.key === token && ctx.path.length > 1;
        const fields = isOwnBlock
            ? contextAt(this.workspace, uriToPath(document.uri), parsed.ast, holder.range.start)
                  .fields
            : ctx.fields;
        const field = fields?.[token];
        if (!field || !ctx.directory) {
            return null;
        }
        const doc = new MarkdownDocAssembler();
        doc.title(`${token}`, '📋');
        doc.paragraph(
            `Field of \`${ctx.directory.path}\` records — *${field.kind.replace('_', ' ')}*`
        );
        if (field.description) {
            doc.paragraph(field.description);
        }
        const facts = [`used ${field.usage} time(s) in vanilla`, `since ${field.since}`];
        if (field.required) {
            facts.push('required');
        }
        doc.paragraph(`*${facts.join(' · ')} — CK3 ${this.workspace.spec.version()} schema*`);
        const keyword = keywordMarkdown(this.workspace.spec, token);
        if (keyword) {
            doc.divider();
            doc.paragraph(keyword);
        }
        return doc.compile();
    }

    /**
     * Generate hover for event IDs using the workspace index
     */
    private generateEventIdDocs(eventId: string): string | null {
        if (!this.indexer) {
            return null;
        }

        const event = this.indexer.getEvent(eventId);
        if (!event) {
            return null;
        }

        const doc = new MarkdownDocAssembler();
        doc.title(`Event: ${eventId}`, '📜');

        const metaRows: string[][] = [];
        metaRows.push(['Type', `\`${event.type}\``]);
        if (event.theme) {
            metaRows.push(['Theme', `\`${event.theme}\``]);
        }
        if (event.title) {
            metaRows.push(['Title Key', `\`${event.title}\``]);
        }
        if (event.desc) {
            metaRows.push(['Desc Key', `\`${event.desc}\``]);
        }
        if (event.sourceUri) {
            metaRows.push(['File', event.sourceUri.split('/').pop() || event.sourceUri]);
        }
        doc.table(['Property', 'Value'], metaRows);

        if (event.options.length > 0) {
            doc.divider();
            doc.paragraph('**Options**');
            doc.bulletList(
                event.options.map((o, i) =>
                    o.name ? `\`${o.name}\`` : `Option ${i + 1} (unnamed)`
                )
            );
        }

        if (event.triggers.length > 0) {
            doc.divider();
            doc.paragraph('**Triggers**');
            doc.bulletList(event.triggers.slice(0, 5).map((t) => `\`${t}\``));
        }

        return doc.compile();
    }

    /**
     * Generate hover for event namespaces
     */
    private generateNamespaceDocs(namespace: string): string | null {
        if (!this.indexer) {
            return null;
        }

        const events = this.indexer.getEventsByNamespace(namespace);
        if (events.length === 0) {
            return null;
        }

        const doc = new MarkdownDocAssembler();
        doc.title(`Namespace: ${namespace}`, '📁');
        doc.paragraph(`Contains **${events.length}** event(s)`);

        const rows = events
            .slice(0, 15)
            .map((e) => [`\`${e.id}\``, e.type, e.title ? `\`${e.title}\`` : '']);
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
        if (!this.indexer) {
            return null;
        }

        const symbols = this.indexer.findSymbolsByName(name);
        if (symbols.length === 0) {
            return null;
        }

        const sym = symbols[0];

        const symbolLabels: Partial<Record<SymbolType, { label: string; emoji: string }>> = {
            [SymbolType.SCRIPTED_EFFECT]: { label: 'Scripted Effect', emoji: '⚡' },
            [SymbolType.SCRIPTED_TRIGGER]: { label: 'Scripted Trigger', emoji: '🔍' },
            [SymbolType.CHARACTER_INTERACTION]: { label: 'Character Interaction', emoji: '🤝' },
            [SymbolType.MODIFIER]: { label: 'Modifier', emoji: '📊' },
            [SymbolType.ON_ACTION]: { label: 'On-Action', emoji: '🎯' },
            [SymbolType.OPINION_MODIFIER]: { label: 'Opinion Modifier', emoji: '💬' },
            [SymbolType.SCRIPTED_GUI]: { label: 'Scripted GUI', emoji: '🖥️' },
            [SymbolType.SCRIPTED_LIST]: { label: 'Scripted List', emoji: '📋' },
            [SymbolType.SCRIPTED_MODIFIER]: { label: 'Scripted Modifier', emoji: '📊' },
            [SymbolType.SCRIPT_VALUE]: { label: 'Script Value', emoji: '🔢' },
            [SymbolType.TRAIT]: { label: 'Trait', emoji: '🧬' },
        };

        const info = symbolLabels[sym.type];
        if (!info) {
            return null;
        }

        const doc = new MarkdownDocAssembler();
        doc.title(`${info.label}: ${name}`, info.emoji);

        const fileName = sym.uri.split('/').pop() || sym.uri;
        doc.paragraph(`Defined in \`${fileName}\` at line ${sym.range.start.line + 1}`);

        if (sym.detail) {
            doc.divider();
            doc.paragraph(sym.detail);
        }

        return doc.compile();
    }

    /**
     * Generate hover for saved scopes (scope:xxx)
     */
    private generateSavedScopeDocs(token: string): string | null {
        if (!this.indexer) {
            return null;
        }

        const scopeName = token.substring(6); // Remove "scope:" prefix
        const symbols = this.indexer.findSymbolsByName(scopeName);
        const scopeSymbol = symbols.find((s) => s.type === SymbolType.SCOPE);

        const doc = new MarkdownDocAssembler();
        doc.title(`Saved Scope: ${scopeName}`, '🔗');

        if (scopeSymbol) {
            const fileName = scopeSymbol.uri.split('/').pop() || scopeSymbol.uri;
            doc.paragraph(`Defined in \`${fileName}\` at line ${scopeSymbol.range.start.line + 1}`);
        } else {
            doc.paragraph(
                '⚠️ **Warning:** This saved scope reference was not found in the workspace index.'
            );
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
        if (!this.indexer) {
            return null;
        }

        // Check if this looks like a character flag usage
        const symbols = this.indexer.findSymbolsByName(flagName);
        const flagSymbol = symbols.find((s) => s.type === SymbolType.CHARACTER_FLAG);
        if (!flagSymbol) {
            return null;
        }

        const doc = new MarkdownDocAssembler();
        doc.title(`Character Flag: ${flagName}`, '🚩');

        const fileName = flagSymbol.uri.split('/').pop() || flagSymbol.uri;
        doc.paragraph(
            `First defined in \`${fileName}\` at line ${flagSymbol.range.start.line + 1}`
        );

        // Count usage types from references
        const ref = this.indexer.getReferences(flagName);
        if (ref && ref.locations.length > 0) {
            let setCount = 0,
                checkCount = 0,
                removeCount = 0;
            for (const loc of ref.locations) {
                if (loc.context === 'effect') {
                    setCount++;
                } else if (loc.context === 'trigger') {
                    checkCount++;
                } else if (loc.context === 'definition') {
                    removeCount++;
                }
            }
            if (setCount + checkCount + removeCount > 0) {
                doc.divider();
                const usageLines: string[] = [];
                if (setCount > 0) {
                    usageLines.push(`🟢 Set: ${setCount} time(s)`);
                }
                if (checkCount > 0) {
                    usageLines.push(`🔍 Checked: ${checkCount} time(s)`);
                }
                if (removeCount > 0) {
                    usageLines.push(`🗑️ Removed: ${removeCount} time(s)`);
                }
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
     * Generate hover documentation for localization keys
     */
    private generateLocalizationDocs(token: string): string | null {
        if (!this.localizationIndex) {
            return null;
        }

        const entry = this.localizationIndex.findLocalization(token);
        if (!entry) {
            return null;
        }

        const doc = new MarkdownDocAssembler();
        doc.title(`\`${token}\``, '🏷️');
        doc.paragraph('**🌐 Localization Key**');
        doc.divider();

        // Format the localization text as a blockquote
        let displayText = entry.text.replace(/\\n/g, '\n').replace(/#N/g, '\n');

        if (displayText.length > 500) {
            displayText = displayText.substring(0, 500) + '...';
        }

        const paragraphs = displayText.split('\n\n');
        const formatted = paragraphs
            .map((p) => p.replace(/\n/g, ' ').trim())
            .filter((p) => p.length > 0)
            .map((p) => `> ${p}`)
            .join('\n>\n');

        doc.paragraph('📝 **Text:**\n\n' + formatted);
        doc.divider();

        const fileName = entry.filePath.split(/[\\/]/).pop() || entry.filePath;
        doc.paragraph(`📂 **File:** \`${fileName}\``);
        doc.paragraph(`📍 **Line:** ${entry.line + 1}`);

        return doc.compile();
    }

    /**
     * Token under the cursor (identifier characters, '.', ':' for scope:x)
     */
    private extractToken(document: TextDocument, position: Position): string {
        const offset = document.offsetAt(position);
        const text = document.getText();
        let start = offset;
        let end = offset;
        while (start > 0 && /[a-zA-Z0-9_.:]/.test(text[start - 1])) {
            start--;
        }
        while (end < text.length && /[a-zA-Z0-9_.:]/.test(text[end])) {
            end++;
        }
        return text.substring(start, end).replace(/^[.:]+|[.:]+$/g, '');
    }

    /**
     * Create hover response from markdown content
     */
    private createHoverResponse(markdown: string): Hover {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: markdown,
            },
        };
    }
}
