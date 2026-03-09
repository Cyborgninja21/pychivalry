#!/usr/bin/env npx ts-node

import { execSync } from 'child_process';
import * as path from 'path';
import { parseArgs } from './lib/extractor-utils';

interface Extractor {
    name: string;
    script: string;
}

const EXTRACTORS: Extractor[] = [
    { name: 'traits', script: 'extract-traits.ts' },
    { name: 'effects', script: 'extract-effects.ts' },
    { name: 'triggers', script: 'extract-triggers.ts' },
    { name: 'on-actions', script: 'extract-on-actions.ts' },
    { name: 'themes', script: 'extract-themes.ts' },
    { name: 'backgrounds', script: 'extract-backgrounds.ts' },
    { name: 'scopes', script: 'extract-scopes.ts' },
];

/**
 * Orchestrates all CK3 data extraction tools.
 * Runs individual extractors sequentially and reports overall results.
 */
function main(): void {
    console.log('🚀 CK3 Data Extraction - Running All Extractors\n');

    const options = parseArgs('extract-all.ts');

    // Determine which extractors to run
    let extractorsToRun = EXTRACTORS;
    if (options.only && options.only.length > 0) {
        extractorsToRun = EXTRACTORS.filter(extractor =>
            options.only!.includes(extractor.name)
        );
        console.log(`📌 Running only: ${options.only.join(', ')}\n`);
    }

    if (extractorsToRun.length === 0) {
        console.error('❌ No extractors selected to run');
        process.exit(1);
    }

    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    // Run each extractor
    for (const extractor of extractorsToRun) {
        console.log(`\n🔄 Running ${extractor.name} extractor...`);
        console.log('━'.repeat(60));

        try {
            // Check if extractor script exists
            const scriptPath = path.join(__dirname, extractor.script);

            // Build command with arguments
            const args: string[] = [];
            if (options.gamePath) {
                args.push('--game-path', `"${options.gamePath}"`);
            }
            if (options.outputPath) {
                args.push('--output', `"${options.outputPath}"`);
            }

            const command = `npx ts-node tools/${extractor.script} ${args.join(' ')}`;

            // Execute extractor
            execSync(command, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..') // Run from project root
            });

            results.push({ name: extractor.name, success: true });
            console.log(`✅ ${extractor.name} completed successfully`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.push({
                name: extractor.name,
                success: false,
                error: errorMessage
            });
            console.error(`❌ ${extractor.name} failed: ${errorMessage}`);
        }
    }

    // Print overall summary
    console.log('\n' + '━'.repeat(60));
    console.log('📊 EXTRACTION SUMMARY');
    console.log('━'.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    successful.forEach(result => {
        console.log(`   • ${result.name}`);
    });

    if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}`);
        failed.forEach(result => {
            console.log(`   • ${result.name}: ${result.error}`);
        });
    }

    console.log(`\n🎯 Overall: ${successful.length}/${results.length} extractors completed successfully`);

    // Exit with error code if any extractor failed
    if (failed.length > 0) {
        process.exit(1);
    }
}

// Run the orchestrator
main();