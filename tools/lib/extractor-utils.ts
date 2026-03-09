/**
 * Shared utilities for CK3 data extraction tools.
 * Used by all extract-*.ts scripts to parse Paradox script files and write YAML output.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// --- CLI Argument Parsing ---

export interface ExtractorOptions {
    gamePath: string;
    outputPath: string;
    only?: string[];
}

/**
 * Parse standard CLI arguments for extraction tools.
 * Supports: --game-path, --output, --only, --help
 */
export function parseArgs(toolName: string): ExtractorOptions {
    const args = process.argv.slice(2);
    let gamePath = '';
    let outputPath = path.resolve(__dirname, '../../data');
    let only: string[] | undefined;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--game-path':
                gamePath = args[++i];
                break;
            case '--output':
                outputPath = args[++i];
                break;
            case '--only':
                only = args[++i].split(',').map(s => s.trim());
                break;
            case '--help':
                console.log(`Usage: npx ts-node tools/${toolName} [options]`);
                console.log('');
                console.log('Options:');
                console.log('  --game-path PATH   CK3 installation directory (auto-detected if omitted)');
                console.log('  --output PATH      Output directory (default: data/)');
                console.log('  --only TYPES       Comma-separated list of types to extract');
                console.log('  --help             Show this help message');
                process.exit(0);
        }
    }

    if (!gamePath) {
        gamePath = detectCK3Path();
    }

    return { gamePath, outputPath, only };
}

// --- CK3 Path Detection ---

/**
 * Auto-detect CK3 installation from common Steam paths.
 */
export function detectCK3Path(): string {
    const commonPaths = [
        // Windows
        'C:/Program Files (x86)/Steam/steamapps/common/Crusader Kings III',
        'C:/Program Files/Steam/steamapps/common/Crusader Kings III',
        // Linux
        path.join(process.env.HOME || '~', '.local/share/Steam/steamapps/common/Crusader Kings III'),
        path.join(process.env.HOME || '~', '.steam/steam/steamapps/common/Crusader Kings III'),
        // macOS
        path.join(process.env.HOME || '~', 'Library/Application Support/Steam/steamapps/common/Crusader Kings III'),
    ];

    for (const p of commonPaths) {
        const gamePath = path.join(p, 'game');
        if (fs.existsSync(gamePath)) {
            console.log(`Auto-detected CK3 at: ${p}`);
            return p;
        }
    }

    console.error('Error: CK3 installation not found. Use --game-path to specify manually.');
    process.exit(1);
}

// --- File Reading ---

/**
 * Read all .txt files from a CK3 game directory.
 * @param gamePath Root CK3 install path
 * @param relativePath Path relative to game/ folder (e.g., 'common/traits')
 * @returns Array of { filePath, content } objects
 */
export function readGameFiles(gamePath: string, relativePath: string): Array<{ filePath: string; content: string }> {
    const dirPath = path.join(gamePath, 'game', relativePath);
    if (!fs.existsSync(dirPath)) {
        console.warn(`Warning: Directory not found: ${dirPath}`);
        return [];
    }

    const files: Array<{ filePath: string; content: string }> = [];
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && entry.endsWith('.txt')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({ filePath: fullPath, content });
        }
    }

    console.log(`Read ${files.length} files from ${relativePath}`);
    return files;
}

// --- Paradox Script Parsing ---

/**
 * Extract top-level block definitions from a Paradox script file.
 * Finds patterns like `name = { ... }` at the root level.
 * 
 * @returns Map of definition name to its full block content (including braces)
 */
export function extractTopLevelBlocks(content: string): Map<string, string> {
    const blocks = new Map<string, string>();
    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip comments and empty lines
        if (line.startsWith('#') || line === '') {
            i++;
            continue;
        }

        // Match top-level definition: name = { or name = value
        const blockMatch = line.match(/^(\w+)\s*=\s*\{/);
        if (blockMatch) {
            const name = blockMatch[1];
            const startLine = i;
            let braceDepth = 0;

            // Count braces from this line forward
            for (let j = i; j < lines.length; j++) {
                const lineContent = stripComment(lines[j]);
                for (const ch of lineContent) {
                    if (ch === '{') braceDepth++;
                    if (ch === '}') braceDepth--;
                }
                if (braceDepth === 0) {
                    const blockContent = lines.slice(startLine, j + 1).join('\n');
                    blocks.set(name, blockContent);
                    i = j + 1;
                    break;
                }
            }

            // Safety: if we never closed, skip to end
            if (braceDepth !== 0) {
                console.warn(`Warning: Unclosed brace for block '${name}' starting at line ${startLine + 1}`);
                i = lines.length;
            }
            continue;
        }

        i++;
    }

    return blocks;
}

/**
 * Parse key-value properties from inside a block.
 * Handles simple `key = value` assignments (not nested blocks).
 */
export function parseBlockProperties(blockContent: string): Map<string, string> {
    const props = new Map<string, string>();
    const lines = blockContent.split('\n');

    for (const line of lines) {
        const stripped = stripComment(line).trim();
        // Match simple key = value (not blocks with {})
        const match = stripped.match(/^(\w+)\s*=\s*(.+?)$/);
        if (match && !match[2].includes('{')) {
            props.set(match[1], match[2].trim());
        }
    }

    return props;
}

/**
 * Strip inline comments (# ...) from a line, respecting quoted strings.
 */
export function stripComment(line: string): string {
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuote = !inQuote;
        if (line[i] === '#' && !inQuote) {
            return line.substring(0, i);
        }
    }
    return line;
}

/**
 * Extract a list of values from a block like:
 * ```
 * list_name = { item1 item2 item3 }
 * ```
 */
export function extractListValues(blockContent: string, listName: string): string[] {
    const regex = new RegExp(`${listName}\\s*=\\s*\\{([^}]*)\\}`, 's');
    const match = blockContent.match(regex);
    if (!match) return [];
    return match[1].trim().split(/\s+/).filter(s => s.length > 0);
}

// --- YAML Output ---

/**
 * Write extracted data to a YAML file with a standard header.
 */
export function writeYaml(outputPath: string, data: Record<string, unknown>, header?: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const yamlContent = yaml.dump(data, {
        indent: 2,
        lineWidth: 120,
        sortKeys: true,
        noRefs: true,
    });

    const headerComment = header || `# Auto-generated by CK3 data extraction tools\n# Do not edit manually — re-run extraction to update\n`;
    const fullContent = headerComment + '\n' + yamlContent;

    fs.writeFileSync(outputPath, fullContent, 'utf-8');
    console.log(`Wrote: ${outputPath}`);
}

/**
 * Load existing YAML data for merging (preserves manual additions).
 */
export function loadExistingYaml(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    return (yaml.load(content) as Record<string, unknown>) || {};
}

// --- Utility Functions ---

/**
 * Normalize a definition name (lowercase, trim).
 */
export function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * Infer scope type from a definition name using common CK3 patterns.
 */
export function inferScopeFromName(name: string): string[] {
    const patterns: Array<[RegExp, string]> = [
        [/^(is_|has_|can_|any_|every_|random_|ordered_)?(adult|alive|ruler|knight|prisoner|landed|married|pregnant|female|male)/, 'character'],
        [/^(add_|remove_|set_|change_)?(gold|prestige|piety|stress|dread|dynasty_prestige)/, 'character'],
        [/^(add_|remove_|has_)?trait/, 'character'],
        [/province_/, 'province'],
        [/^(de_jure|de_facto|titular)/, 'title'],
        [/^(county_|duchy_|kingdom_|empire_)/, 'title'],
        [/^(faith_|religion_)/, 'faith'],
        [/^(culture_)/, 'culture'],
        [/^(dynasty_)/, 'dynasty'],
        [/^(war_|casus_belli)/, 'war'],
        [/^(scheme_)/, 'scheme'],
        [/^(artifact_)/, 'artifact'],
    ];

    for (const [pattern, scope] of patterns) {
        if (pattern.test(name)) return [scope];
    }
    return ['any'];
}

/**
 * Print extraction summary to console.
 */
export function printSummary(type: string, count: number, outputPath: string): void {
    console.log(`\n✅ Extracted ${count} ${type} → ${outputPath}`);
}