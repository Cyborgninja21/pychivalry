/**
 * Asset Validation Module
 * 
 * Validates references to game assets:
 * - Graphics files (portraits, textures, sprites)
 * - Sound files (music, sound effects)
 * - Animation references
 * - GUI elements
 * 
 * Diagnostic Codes:
 * - CK3600: Missing asset file
 * - CK3601: Invalid asset path
 * - CK3602: Missing animation definition
 * - CK3603: Invalid portrait reference
 * - CK3604: Missing sound file
 * - CK3605: Invalid GUI reference
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';

export interface AssetConfig {
    /** Enable asset validation */
    enabled: boolean;
    /** Check graphics references */
    checkGraphics: boolean;
    /** Check sound references */
    checkSound: boolean;
    /** Check animation references */
    checkAnimations: boolean;
    /** Check GUI references */
    checkGUI: boolean;
    /** Workspace root paths to search */
    workspaceRoots: string[];
    /** Known asset paths (for caching) */
    knownAssets?: Set<string>;
}

export interface AssetReference {
    type: 'graphics' | 'sound' | 'animation' | 'gui';
    path: string;
    node: ASTNode;
}

/**
 * Common asset file extensions
 */
const ASSET_EXTENSIONS = {
    graphics: ['.dds', '.tga', '.png'],
    sound: ['.wav', '.ogg', '.mp3'],
    animation: ['.anim'],
    gui: ['.gui']
};

/**
 * Common asset directory names
 */
const ASSET_DIRECTORIES = {
    graphics: ['gfx', 'interface', 'portraits'],
    sound: ['sound', 'music'],
    animation: ['animations'],
    gui: ['gui']
};

/**
 * Validate asset references in a document
 */
export function validateAssets(
    node: ASTNode,
    config: AssetConfig
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const references = collectAssetReferences(node);

    for (const ref of references) {
        const assetDiags = validateAssetReference(ref, config);
        diagnostics.push(...assetDiags);
    }

    return diagnostics;
}

/**
 * Collect all asset references from AST
 */
function collectAssetReferences(node: ASTNode): AssetReference[] {
    const references: AssetReference[] = [];
    
    function traverse(n: ASTNode): void {
        // Graphics references
        if (n.key === 'texture' || n.key === 'icon' || n.key === 'portrait') {
            if (n.value && typeof n.value === 'string') {
                references.push({
                    type: 'graphics',
                    path: n.value,
                    node: n
                });
            }
        }
        
        // Sound references
        else if (n.key === 'sound' || n.key === 'music') {
            if (n.value && typeof n.value === 'string') {
                references.push({
                    type: 'sound',
                    path: n.value,
                    node: n
                });
            }
        }
        
        // Animation references
        else if (n.key === 'animation' || n.key === 'portrait_animation') {
            if (n.value && typeof n.value === 'string') {
                references.push({
                    type: 'animation',
                    path: n.value,
                    node: n
                });
            }
        }
        
        // GUI references
        else if (n.key === 'gui' || n.key === 'interface') {
            if (n.value && typeof n.value === 'string') {
                references.push({
                    type: 'gui',
                    path: n.value,
                    node: n
                });
            }
        }
        
        // Traverse children
        if (n.children) {
            n.children.forEach((child: ASTNode) => traverse(child));
        }
    }
    
    traverse(node);
    return references;
}

/**
 * Validate a single asset reference
 */
function validateAssetReference(
    ref: AssetReference,
    config: AssetConfig
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Check if validation is enabled for this type
    const shouldCheck = (
        (ref.type === 'graphics' && config.checkGraphics) ||
        (ref.type === 'sound' && config.checkSound) ||
        (ref.type === 'animation' && config.checkAnimations) ||
        (ref.type === 'gui' && config.checkGUI)
    );
    
    if (!shouldCheck) {
        return diagnostics;
    }
    
    // Validate path format
    if (!isValidAssetPath(ref.path, ref.type)) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: ref.node.range,
            message: `Invalid ${ref.type} path format: "${ref.path}"`,
            code: 'CK3601',
            source: 'ck3-lsp'
        });
    }
    
    // Check if asset exists (if we have workspace info)
    if (config.knownAssets && !assetExists(ref.path, config.knownAssets)) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: ref.node.range,
            message: `${ref.type} asset not found: "${ref.path}"`,
            code: 'CK3600',
            source: 'ck3-lsp'
        });
    }
    
    return diagnostics;
}

/**
 * Validate asset path format
 */
function isValidAssetPath(path: string, type: AssetReference['type']): boolean {
    // Empty path
    if (!path || path.trim().length === 0) {
        return false;
    }
    
    // Check for valid extension
    const extensions = ASSET_EXTENSIONS[type];
    const hasValidExtension = extensions.some(ext => path.toLowerCase().endsWith(ext));
    
    // Graphics and GUI can reference definitions without extensions
    if (type === 'graphics' || type === 'gui' || type === 'animation') {
        return true; // More lenient for these types
    }
    
    return hasValidExtension;
}

/**
 * Check if asset exists in known assets
 */
function assetExists(path: string, knownAssets: Set<string>): boolean {
    // Direct match
    if (knownAssets.has(path)) {
        return true;
    }
    
    // Check case-insensitive (common issue)
    const lowerPath = path.toLowerCase();
    for (const asset of knownAssets) {
        if (asset.toLowerCase() === lowerPath) {
            return true;
        }
    }
    
    return false;
}

/**
 * Validate portrait configuration
 */
export function validatePortraitAssets(
    node: ASTNode,
    config: AssetConfig
): Diagnostic[] {
    if (!config.enabled || !config.checkGraphics) {
        return [];
    }
    
    const diagnostics: Diagnostic[] = [];
    
    // Check for portrait definitions
    if (node.key === 'portrait' || node.key === 'portrait_modifier') {
        // Validate texture references
        const textureNode = node.children?.find((c: ASTNode) => c.key === 'texture');
        if (textureNode && textureNode.value) {
            const path = String(textureNode.value);
            if (!isValidAssetPath(path, 'graphics')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: textureNode.range,
                    message: `Invalid portrait texture path: "${path}"`,
                    code: 'CK3603',
                    source: 'ck3-lsp'
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Validate sound event configuration
 */
export function validateSoundAssets(
    node: ASTNode,
    config: AssetConfig
): Diagnostic[] {
    if (!config.enabled || !config.checkSound) {
        return [];
    }
    
    const diagnostics: Diagnostic[] = [];
    
    // Check sound events
    if (node.key === 'sound' || node.key === 'music') {
        if (node.value) {
            const path = String(node.value);
            if (!isValidAssetPath(path, 'sound')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: node.range,
                    message: `Invalid sound file path: "${path}"`,
                    code: 'CK3604',
                    source: 'ck3-lsp'
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Validate animation references
 */
export function validateAnimationAssets(
    node: ASTNode,
    config: AssetConfig
): Diagnostic[] {
    if (!config.enabled || !config.checkAnimations) {
        return [];
    }
    
    const diagnostics: Diagnostic[] = [];
    
    // Check animation definitions
    if (node.key === 'animation' || node.key === 'portrait_animation') {
        if (node.value) {
            const animName = String(node.value);
            // Animations are typically defined elsewhere, so we just check format
            if (animName.trim().length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: node.range,
                    message: 'Empty animation reference',
                    code: 'CK3602',
                    source: 'ck3-lsp'
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Validate GUI references
 */
export function validateGUIAssets(
    node: ASTNode,
    config: AssetConfig
): Diagnostic[] {
    if (!config.enabled || !config.checkGUI) {
        return [];
    }
    
    const diagnostics: Diagnostic[] = [];
    
    // Check GUI references
    if (node.key === 'gui' || node.key === 'interface') {
        if (node.value) {
            const guiPath = String(node.value);
            if (guiPath.trim().length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: node.range,
                    message: 'Empty GUI reference',
                    code: 'CK3605',
                    source: 'ck3-lsp'
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Get asset validation description for diagnostics
 */
export function getAssetDiagnosticDescription(code: string): string {
    const descriptions: Record<string, string> = {
        'CK3600': 'Asset file not found. The referenced asset does not exist in the mod or game files.',
        'CK3601': 'Invalid asset path format. Check the path syntax and extension.',
        'CK3602': 'Missing animation definition. The animation is not defined in animation files.',
        'CK3603': 'Invalid portrait reference. The portrait texture path is malformed.',
        'CK3604': 'Missing sound file. The sound file does not exist.',
        'CK3605': 'Invalid GUI reference. The GUI element is not defined.'
    };
    
    return descriptions[code] || 'Asset validation error';
}

/**
 * Suggest similar asset paths (for autocorrect)
 */
export function suggestSimilarAssets(
    path: string,
    knownAssets: Set<string>
): string[] {
    const suggestions: string[] = [];
    const lowerPath = path.toLowerCase();
    
    // Find assets with similar names
    for (const asset of knownAssets) {
        if (asset.toLowerCase().includes(lowerPath) || 
            lowerPath.includes(asset.toLowerCase())) {
            suggestions.push(asset);
        }
    }
    
    return suggestions.slice(0, 5); // Return top 5 suggestions
}
