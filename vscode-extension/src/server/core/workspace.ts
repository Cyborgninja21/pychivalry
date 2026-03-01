/**
 * Workspace Manager - Handles workspace folders and mod discovery
 */

import { WorkspaceFolder } from 'vscode-languageserver/node';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

import { serverLogger } from '../utils/logger';

const readFile = promisify(fs.readFile);

export interface ModDescriptor {
    name: string;
    version: string;
    path: string;
    supportedVersion?: string;
    tags?: string[];
}

/**
 * Workspace Manager handles workspace folders and mod discovery
 */
export class WorkspaceManager {
    private workspaceFolders: Map<string, WorkspaceFolder> = new Map();
    private modDescriptors: Map<string, ModDescriptor> = new Map();

    /**
     * Add a workspace folder
     */
    public async addWorkspaceFolder(folder: WorkspaceFolder): Promise<void> {
        this.workspaceFolders.set(folder.uri, folder);
        
        // Try to find mod descriptor
        await this.discoverModDescriptor(folder);
    }

    /**
     * Remove a workspace folder
     */
    public removeWorkspaceFolder(uri: string): void {
        this.workspaceFolders.delete(uri);
        this.modDescriptors.delete(uri);
    }

    /**
     * Get all workspace folders
     */
    public getWorkspaceFolders(): WorkspaceFolder[] {
        return Array.from(this.workspaceFolders.values());
    }

    /**
     * Get mod descriptor for a workspace folder
     */
    public getModDescriptor(uri: string): ModDescriptor | undefined {
        return this.modDescriptors.get(uri);
    }

    /**
     * Discover mod descriptor in workspace folder
     */
    private async discoverModDescriptor(folder: WorkspaceFolder): Promise<void> {
        try {
            // Convert URI to file path
            const folderPath = this.uriToPath(folder.uri);
            
            // Look for descriptor.mod file
            const descriptorPath = path.join(folderPath, 'descriptor.mod');
            
            let descriptorExists = false;
            try { await fsp.access(descriptorPath); descriptorExists = true; } catch {}
            if (descriptorExists) {
                const descriptor = await this.parseModDescriptor(descriptorPath);
                if (descriptor) {
                    this.modDescriptors.set(folder.uri, descriptor);
                }
            }
        } catch (error) {
            serverLogger.error(`Failed to discover mod descriptor: ${error}`);
        }
    }

    /**
     * Parse mod descriptor file
     */
    private async parseModDescriptor(filePath: string): Promise<ModDescriptor | null> {
        try {
            const content = await readFile(filePath, 'utf-8');
            
            // Simple parser for descriptor.mod format
            const descriptor: ModDescriptor = {
                name: '',
                version: '',
                path: path.dirname(filePath),
            };
            
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                
                if (trimmed.startsWith('name')) {
                    descriptor.name = this.extractQuotedValue(trimmed);
                } else if (trimmed.startsWith('version')) {
                    descriptor.version = this.extractQuotedValue(trimmed);
                } else if (trimmed.startsWith('supported_version')) {
                    descriptor.supportedVersion = this.extractQuotedValue(trimmed);
                } else if (trimmed.startsWith('tags')) {
                    descriptor.tags = this.extractListValue(trimmed);
                }
            }
            
            return descriptor;
        } catch (error) {
            serverLogger.error(`Failed to parse mod descriptor: ${error}`);
            return null;
        }
    }

    /**
     * Extract quoted value from descriptor line
     */
    private extractQuotedValue(line: string): string {
        const match = line.match(/"([^"]*)"/);
        return match ? match[1] : '';
    }

    /**
     * Extract list value from descriptor line
     */
    private extractListValue(line: string): string[] {
        const match = line.match(/{([^}]*)}/);
        if (!match) return [];
        
        return match[1]
            .split(/\s+/)
            .map(s => s.replace(/"/g, '').trim())
            .filter(s => s.length > 0);
    }

    /**
     * Convert URI to file path
     */
    private uriToPath(uri: string): string {
        // Handle file:// URIs
        if (uri.startsWith('file://')) {
            // Remove file:// prefix
            let path = uri.substring(7);
            
            // Handle Windows paths
            if (process.platform === 'win32') {
                // file:///c:/path -> c:/path
                if (path.startsWith('/') && path.length > 2 && path[2] === ':') {
                    path = path.substring(1);
                }
                // Convert forward slashes to backslashes
                path = path.replace(/\//g, '\\');
            }
            
            return decodeURIComponent(path);
        }
        
        return uri;
    }

    /**
     * Find CK3 files in workspace
     */
    public async findCK3Files(folder: WorkspaceFolder): Promise<string[]> {
        const folderPath = this.uriToPath(folder.uri);
        const files: string[] = [];
        
        try {
            await this.findCK3FilesRecursive(folderPath, files);
        } catch (error) {
            serverLogger.error(`Failed to find CK3 files: ${error}`);
        }
        
        return files;
    }

    /**
     * Recursively find CK3 files
     */
    /**
     * Recursively walk a directory tree collecting CK3 file paths.
     *
     * Uses readdir({ withFileTypes: true }) to get Dirent objects directly,
     * avoiding a separate stat() syscall per entry.  Only EACCES/EPERM errors
     * are silenced (permission issues on certain OS folders); all other errors
     * are logged so they surface during debugging.
     */
    private async findCK3FilesRecursive(dirPath: string, files: string[]): Promise<void> {
        try {
            const entries = await fsp.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vscode') {
                        continue;
                    }
                    await this.findCK3FilesRecursive(fullPath, files);
                } else if (entry.isFile()) {
                    if (this.isCK3File(entry.name)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error: any) {
            // Only silence permission errors — log everything else (EMFILE, ENOENT, etc.)
            if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
                serverLogger.error(`Error scanning directory ${dirPath}: ${error}`);
            }
        }
    }

    /**
     * Check if a file is a CK3 file
     */
    private isCK3File(filename: string): boolean {
        const ext = path.extname(filename).toLowerCase();
        const basename = path.basename(filename).toLowerCase();
        
        // CK3 script files
        if (ext === '.txt' || ext === '.gui' || ext === '.gfx' || ext === '.asset') {
            return true;
        }
        
        // Localization files
        // Pattern: _l_(language)
        const locPattern = /_l_(english|german|french|spanish|russian|korean|simp_chinese|braz_por|polish|japanese)/;
        if (locPattern.test(basename)) {
            return true;
        }
        
        return false;
    }
}
