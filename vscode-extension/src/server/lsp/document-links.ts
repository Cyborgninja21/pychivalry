/**
 * Document Links Provider - Provides clickable links in documents
 * 
 * Features:
 * - File path references (localization, scripted effects, GUI files)
 * - Event ID references (clickable event links to definition)
 * - Wiki/documentation links for game concepts
 * - Link validation (check if target exists)
 * - Support for various CK3 file types
 */

import { DocumentLink, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { DocumentIndexer, SymbolType } from '../core/indexer';
import * as path from 'path';
import { promises as fsp } from 'fs';

/**
 * Link type for categorization
 */
enum LinkType {
    FILE = 'file',
    EVENT = 'event',
    DECISION = 'decision',
    SCRIPTED_EFFECT = 'scripted_effect',
    SCRIPTED_TRIGGER = 'scripted_trigger',
    LOCALIZATION = 'localization',
    WIKI = 'wiki',
    DOCUMENTATION = 'documentation',
}

/**
 * Document Links Provider
 */
export class DocumentLinksProvider {
    private workspaceRoot: string | null = null;

    constructor(
        private parser: CK3Parser,
        private indexer?: DocumentIndexer
    ) {}

    /**
     * Set workspace root for file path resolution
     */
    public setWorkspaceRoot(root: string): void {
        this.workspaceRoot = root;
    }

    /**
     * Provide document links
     */
    public async provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        const parsed = this.parser.parse(document.getText());
        const links: DocumentLink[] = [];

        await this.collectDocumentLinks(parsed.ast, links, document);

        return links;
    }

    /**
     * Resolve document link (add target if deferred)
     */
    public resolveDocumentLink(link: DocumentLink): DocumentLink {
        // Validate link target if not already validated
        if (link.target && link.data) {
            const data = link.data as { type: LinkType; validated?: boolean };
            if (!data.validated) {
                const isValid = this.validateLinkTarget(link.target, data.type);
                data.validated = true;
                link.data = { ...data, valid: isValid };
                
                // If invalid, add tooltip
                if (!isValid) {
                    link.tooltip = `Target not found: ${link.target}`;
                }
            }
        }
        
        return link;
    }

    /**
     * Collect document links from AST
     */
    private async collectDocumentLinks(node: ASTNode, links: DocumentLink[], document: TextDocument): Promise<void> {
        if (!node.children) return;

        for (const child of node.children) {
            // File references (textures, icons, GUI files)
            if (child.key === 'file' || child.key === 'icon' || child.key === 'texture' ||
                child.key === 'gfx' || child.key === 'animation') {
                await this.addFileLink(child, links, document);
            }

            // Localization keys
            if (child.key === 'name' || child.key === 'desc' || child.key === 'text' ||
                child.key === 'title' || child.key === 'tooltip') {
                await this.addLocalizationLink(child, links, document);
            }

            // Event references
            if (child.key === 'id' || child.key === 'on_bi_yearly_pulse' ||
                child.key === 'on_action' || child.key === 'trigger_event') {
                await this.addEventLink(child, links, document);
            }

            // Scripted effect references
            if (child.key && child.key.endsWith('_effect')) {
                await this.addScriptedEffectLink(child, links, document);
            }

            // Scripted trigger references
            if (child.key && child.key.endsWith('_trigger')) {
                await this.addScriptedTriggerLink(child, links, document);
            }

            // Decision references
            if (child.key === 'decision') {
                this.addDecisionLink(child, links, document);
            }

            // Wiki/documentation links for special values
            if (typeof child.value === 'string') {
                this.addWikiLink(child, links, document);
            }

            // Recurse
            if (child.children) {
                await this.collectDocumentLinks(child, links, document);
            }
        }
    }

    /**
     * Add file path link
     */
    private async addFileLink(node: ASTNode, links: DocumentLink[], document: TextDocument): Promise<void> {
        if (typeof node.value !== 'string') return;

        const filePath = node.value;
        let target: string | undefined;

        // Convert game path to file URI
        if (this.workspaceRoot) {
            const possiblePaths = [
                path.join(this.workspaceRoot, filePath),
                path.join(this.workspaceRoot, 'gfx', filePath),
                path.join(this.workspaceRoot, 'gui', filePath),
            ];

            for (const testPath of possiblePaths) {
                try {
                    await fsp.access(testPath);
                    target = `file://${testPath}`;
                    break;
                } catch {
                    // File doesn't exist, try next
                }
            }
        }

        if (!target) {
            target = filePath;
        }

        links.push({
            range: node.range,
            target,
            tooltip: `Open file: ${filePath}`,
            data: { type: LinkType.FILE, path: filePath }
        });
    }

    /**
     * Add localization key link
     */
    private async addLocalizationLink(node: ASTNode, links: DocumentLink[], document: TextDocument): Promise<void> {
        if (typeof node.value !== 'string') return;

        const key = node.value;

        // Check if it looks like a localization key (not a plain string)
        if (!key.includes(' ') && key.length > 0) {
            let target: string | undefined;

            if (this.workspaceRoot) {
                const locPath = path.join(this.workspaceRoot, 'localization', 'english');

                try {
                    await fsp.access(locPath);
                    const allFiles = await fsp.readdir(locPath);
                    const files = allFiles.filter(f => f.endsWith('.yml'));

                    for (const file of files) {
                        const fullPath = path.join(locPath, file);
                        const content = await fsp.readFile(fullPath, 'utf-8');

                        if (content.includes(`${key}:`)) {
                            target = `file://${fullPath}`;
                            break;
                        }
                    }
                } catch {
                    // Localization path doesn't exist
                }
            }

            links.push({
                range: node.range,
                target: target || `#localization:${key}`,
                tooltip: `Localization key: ${key}`,
                data: { type: LinkType.LOCALIZATION, key }
            });
        }
    }

    /**
     * Add event ID link
     */
    private async addEventLink(node: ASTNode, links: DocumentLink[], document: TextDocument): Promise<void> {
        if (typeof node.value !== 'string') return;

        const eventId = node.value;

        // Check if it looks like an event ID (namespace.number)
        if (/^[a-z_]+\.\d+$/.test(eventId)) {
            let target: string | undefined;

            // Try to find event in indexer
            if (this.indexer) {
                const symbols = this.indexer.findSymbolsByName(eventId);
                const eventSymbol = symbols.find(s => s.type === SymbolType.EVENT);

                if (eventSymbol) {
                    target = eventSymbol.uri;
                }
            }

            // Fallback: try to find event file
            if (!target && this.workspaceRoot) {
                const namespace = eventId.split('.')[0];
                const eventsPath = path.join(this.workspaceRoot, 'events');

                try {
                    await fsp.access(eventsPath);
                    const files = await fsp.readdir(eventsPath);
                    const eventFile = files.find(f =>
                        f.startsWith(namespace) && f.endsWith('.txt')
                    );

                    if (eventFile) {
                        target = `file://${path.join(eventsPath, eventFile)}`;
                    }
                } catch {
                    // Events directory not found
                }
            }

            links.push({
                range: node.range,
                target: target || `#event:${eventId}`,
                tooltip: `Go to event: ${eventId}`,
                data: { type: LinkType.EVENT, id: eventId }
            });
        }
    }

    /**
     * Add scripted effect link
     */
    private async addScriptedEffectLink(node: ASTNode, links: DocumentLink[], document: TextDocument): Promise<void> {
        if (!node.key) return;

        const effectName = node.key;
        let target: string | undefined;

        // Try to find in indexer
        if (this.indexer) {
            const symbols = this.indexer.findSymbolsByName(effectName);
            const effectSymbol = symbols.find(s => s.type === SymbolType.SCRIPTED_EFFECT);

            if (effectSymbol) {
                target = effectSymbol.uri;
            }
        }

        // Fallback: try to find in common/scripted_effects
        if (!target && this.workspaceRoot) {
            const effectsPath = path.join(this.workspaceRoot, 'common', 'scripted_effects');

            try {
                await fsp.access(effectsPath);
                const allFiles = await fsp.readdir(effectsPath);
                const files = allFiles.filter(f => f.endsWith('.txt'));

                for (const file of files) {
                    const fullPath = path.join(effectsPath, file);
                    const content = await fsp.readFile(fullPath, 'utf-8');

                    if (content.includes(`${effectName} =`)) {
                        target = `file://${fullPath}`;
                        break;
                    }
                }
            } catch {
                // Directory doesn't exist
            }
        }

        if (target || effectName.endsWith('_effect')) {
            links.push({
                range: node.range,
                target: target || `#scripted_effect:${effectName}`,
                tooltip: `Go to scripted effect: ${effectName}`,
                data: { type: LinkType.SCRIPTED_EFFECT, name: effectName }
            });
        }
    }

    /**
     * Add scripted trigger link
     */
    private async addScriptedTriggerLink(node: ASTNode, links: DocumentLink[], document: TextDocument): Promise<void> {
        if (!node.key) return;

        const triggerName = node.key;
        let target: string | undefined;

        // Try to find in indexer
        if (this.indexer) {
            const symbols = this.indexer.findSymbolsByName(triggerName);
            const triggerSymbol = symbols.find(s => s.type === SymbolType.SCRIPTED_TRIGGER);

            if (triggerSymbol) {
                target = triggerSymbol.uri;
            }
        }

        // Fallback: try to find in common/scripted_triggers
        if (!target && this.workspaceRoot) {
            const triggersPath = path.join(this.workspaceRoot, 'common', 'scripted_triggers');

            try {
                await fsp.access(triggersPath);
                const allFiles = await fsp.readdir(triggersPath);
                const files = allFiles.filter(f => f.endsWith('.txt'));

                for (const file of files) {
                    const fullPath = path.join(triggersPath, file);
                    const content = await fsp.readFile(fullPath, 'utf-8');

                    if (content.includes(`${triggerName} =`)) {
                        target = `file://${fullPath}`;
                        break;
                    }
                }
            } catch {
                // Directory doesn't exist
            }
        }

        if (target || triggerName.endsWith('_trigger')) {
            links.push({
                range: node.range,
                target: target || `#scripted_trigger:${triggerName}`,
                tooltip: `Go to scripted trigger: ${triggerName}`,
                data: { type: LinkType.SCRIPTED_TRIGGER, name: triggerName }
            });
        }
    }

    /**
     * Add decision link
     */
    private addDecisionLink(node: ASTNode, links: DocumentLink[], document: TextDocument): void {
        if (typeof node.value !== 'string') return;

        const decisionName = node.value;
        let target: string | undefined;

        // Try to find in indexer
        if (this.indexer) {
            const symbols = this.indexer.findSymbolsByName(decisionName);
            const decisionSymbol = symbols.find(s => s.type === SymbolType.DECISION);
            
            if (decisionSymbol) {
                target = decisionSymbol.uri;
            }
        }

        links.push({
            range: node.range,
            target: target || `#decision:${decisionName}`,
            tooltip: `Go to decision: ${decisionName}`,
            data: { type: LinkType.DECISION, name: decisionName }
        });
    }

    /**
     * Add wiki/documentation link for known concepts
     */
    private addWikiLink(node: ASTNode, links: DocumentLink[], document: TextDocument): void {
        if (typeof node.value !== 'string') return;

        const value = node.value;
        
        // Map of known concepts to wiki URLs
        const wikiLinks: Record<string, string> = {
            // Scope types
            'character': 'https://ck3.paradoxwikis.com/Scopes#Character',
            'title': 'https://ck3.paradoxwikis.com/Scopes#Title',
            'province': 'https://ck3.paradoxwikis.com/Scopes#Province',
            'faith': 'https://ck3.paradoxwikis.com/Scopes#Faith',
            'culture': 'https://ck3.paradoxwikis.com/Scopes#Culture',
            'dynasty': 'https://ck3.paradoxwikis.com/Scopes#Dynasty',
            
            // Common concepts
            'root': 'https://ck3.paradoxwikis.com/Scopes#Root',
            'this': 'https://ck3.paradoxwikis.com/Scopes#This',
            'prev': 'https://ck3.paradoxwikis.com/Scopes#Prev',
        };

        const wikiUrl = wikiLinks[value.toLowerCase()];
        if (wikiUrl) {
            links.push({
                range: node.range,
                target: wikiUrl,
                tooltip: `Open wiki: ${value}`,
                data: { type: LinkType.WIKI, concept: value }
            });
        }
    }

    /**
     * Validate link target
     */
    private validateLinkTarget(target: string, type: LinkType): boolean {
        // Internal links (already resolved through indexer)
        if (target.startsWith('#')) {
            return false;
        }

        // External links (wiki, documentation)
        if (target.startsWith('http://') || target.startsWith('https://')) {
            return true;
        }

        // File links - skip sync validation, assume valid if resolved
        if (target.startsWith('file://')) {
            return true;
        }

        return false;
    }
}
