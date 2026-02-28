#!/usr/bin/env node
/**
 * Merge RE-extracted keywords into existing YAML data files.
 *
 * Usage: node tools/merge-keywords.js
 *
 * This script:
 * 1. Reads existing triggers.yaml and effects.yaml
 * 2. Reads RE keyword lists from pdx-parser-re/spec/keywords/
 * 3. Merges missing keywords with minimal metadata
 * 4. Writes updated YAML files
 */

const fs = require('fs');
const path = require('path');
const yaml = require(path.resolve(__dirname, '../vscode-extension/node_modules/js-yaml'));

const RE_SPEC = path.resolve(__dirname, '../../pdx-parser-re/spec/keywords');
const DATA_DIR = path.resolve(__dirname, '../data');

function readKeywordFile(filePath) {
    return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
}

function mergeTriggers() {
    const yamlPath = path.join(DATA_DIR, 'triggers/triggers.yaml');
    const data = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    const existing = data.triggers || {};
    const existingCount = Object.keys(existing).length;

    const reKeywords = readKeywordFile(path.join(RE_SPEC, 'triggers.txt'));
    let added = 0;

    for (const name of reKeywords) {
        if (!(name in existing)) {
            existing[name] = {
                description: 'CK3 trigger (from binary analysis)',
                scopes: ['any']
            };
            added++;
        }
    }

    data.triggers = existing;
    fs.writeFileSync(yamlPath, yaml.dump(data, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
        quotingType: '"'
    }));
    console.log(`Triggers: ${existingCount} existing + ${added} new = ${Object.keys(existing).length} total`);
}

function mergeEffects() {
    const yamlPath = path.join(DATA_DIR, 'effects/effects.yaml');
    const data = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    const existing = data.effects || {};
    const existingCount = Object.keys(existing).length;

    const reKeywords = readKeywordFile(path.join(RE_SPEC, 'effects.txt'));
    let added = 0;

    for (const name of reKeywords) {
        if (!(name in existing)) {
            existing[name] = {
                description: 'CK3 effect (from binary analysis)',
                scopes: ['any']
            };
            added++;
        }
    }

    data.effects = existing;
    fs.writeFileSync(yamlPath, yaml.dump(data, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
        quotingType: '"'
    }));
    console.log(`Effects: ${existingCount} existing + ${added} new = ${Object.keys(existing).length} total`);
}

function mergeOnActions() {
    const yamlPath = path.join(DATA_DIR, 'on_actions.yaml');
    const data = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    const existingCount = Object.keys(data).length;

    const reKeywords = readKeywordFile(path.join(RE_SPEC, 'on_actions.txt'));
    let added = 0;

    for (const name of reKeywords) {
        if (!(name in data)) {
            data[name] = {
                description: `${name.replace(/_/g, ' ').replace(/^on /, 'On ')} (from binary analysis)`,
                has_trigger: false,
                has_effect: false,
            };
            added++;
        }
    }

    fs.writeFileSync(yamlPath, yaml.dump(data, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
        quotingType: '"'
    }));
    console.log(`On-actions: ${existingCount} existing + ${added} new = ${Object.keys(data).length} total`);
}

function createInteractionHooks() {
    const reKeywords = readKeywordFile(path.join(RE_SPEC, 'interaction_hooks.txt'));

    const hooks = {};
    for (const name of reKeywords) {
        hooks[name] = {
            description: `Interaction hook: ${name.replace(/_/g, ' ')}`,
        };
    }

    const data = {
        version: '1.0',
        hooks: hooks
    };

    const yamlPath = path.join(DATA_DIR, 'interaction_hooks.yaml');
    fs.writeFileSync(yamlPath, yaml.dump(data, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
        quotingType: '"'
    }));
    console.log(`Interaction hooks: ${reKeywords.length} created`);
}

// Run all merges
console.log('=== Merging RE keywords into YAML data files ===\n');
mergeTriggers();
mergeEffects();
mergeOnActions();
createInteractionHooks();
console.log('\nDone.');
