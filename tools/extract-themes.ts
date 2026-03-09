#!/usr/bin/env npx ts-node

import {
    parseArgs,
    readGameFiles,
    extractTopLevelBlocks,
    parseBlockProperties,
    writeYaml,
    printSummary
} from './lib/extractor-utils';

interface ThemeData {
    description: string;
    icon?: string;
    background?: string;
    sound?: string;
    [key: string]: unknown;
}

/**
 * Extracts CK3 event theme definitions from game files.
 * Reads from game/common/event_themes/*.txt and outputs to data/themes.yaml
 */
function main(): void {
    const options = parseArgs('extract-themes.ts');

    console.log('🎨 Reading event theme files...');
    const files = readGameFiles(options.gamePath, 'common/event_themes');

    const themes: Record<string, ThemeData> = {};
    let totalProcessed = 0;

    for (const file of files) {
        console.log(`📖 Processing ${file.filePath}...`);
        const blocks = extractTopLevelBlocks(file.content);

        for (const [themeName, blockContent] of blocks) {
            if (!themeName || themeName.startsWith('#')) continue;

            const themeData = parseTheme(themeName, blockContent);
            themes[themeName] = themeData;
            totalProcessed++;
        }
    }

    // Sort alphabetically by key
    const sortedThemes: Record<string, ThemeData> = {};
    const sortedKeys = Object.keys(themes).sort();

    for (const key of sortedKeys) {
        sortedThemes[key] = themes[key];
    }

    // Write output
    const outputPath = `${options.outputPath}/themes.yaml`;
    const header = '# CK3 Event Themes\n# Auto-generated from CK3 game files\n';
    writeYaml(outputPath, sortedThemes, header);

    printSummary('themes', totalProcessed, outputPath);
}

function parseTheme(name: string, content: string): ThemeData {
    const properties = parseBlockProperties(content);

    // Generate description from theme name
    const description = generateDescription(name);

    const themeData: ThemeData = {
        description
    };

    // Extract known theme properties
    if (properties.has('icon')) {
        themeData.icon = properties.get('icon')!.replace(/"/g, '');
    }

    if (properties.has('background')) {
        themeData.background = properties.get('background')!.replace(/"/g, '');
    }

    if (properties.has('sound')) {
        themeData.sound = properties.get('sound')!.replace(/"/g, '');
    }

    // Add any other properties found in the theme block
    for (const [key, value] of properties) {
        if (!['icon', 'background', 'sound'].includes(key)) {
            themeData[key] = value.replace(/"/g, '');
        }
    }

    return themeData;
}

function generateDescription(name: string): string {
    // Convert theme name to readable description
    // Remove '_theme' suffix if present and capitalize words
    const cleanName = name.replace(/_theme$/, '');
    const words = cleanName.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );

    return `${words.join(' ')} Theme`;
}

// Run the extraction
main();