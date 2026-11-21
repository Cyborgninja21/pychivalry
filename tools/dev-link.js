#!/usr/bin/env node
/**
 * `task dev:link` / `task dev:unlink` (#35): load the development build of the extension in
 * your main VS Code instance, by a symbolic link (a junction on Windows) from VS Code's
 * extensions folder to vscode-extension/.
 *
 *   node tools/dev-link.js link   [--dir <extensions folder>]... [--dry-run]
 *   node tools/dev-link.js unlink [--dir <extensions folder>]... [--dry-run]
 *   node tools/dev-link.js status [--dir <extensions folder>]...
 *
 * Without --dir, every extensions folder that exists on this machine is used: VS Code and
 * VS Code Insiders installed locally (~/.vscode/extensions, ~/.vscode-insiders/extensions)
 * and the remote server's folders used under WSL, SSH and dev containers
 * (~/.vscode-server/extensions, ~/.vscode-server-insiders/extensions). Run it where the
 * extension host runs: on WSL that is inside WSL (the Windows client loads workspace
 * extensions from the remote server's folder), on Windows or macOS on that machine.
 * CK3_VSCODE_EXTENSION_DIRS (path-delimiter separated) overrides the list.
 *
 * The link is named cyborgninja21.ck3-language-support-dev and points at vscode-extension/,
 * whose package.json gives VS Code the extension's identity; VS Code loads its dist/
 * bundle, so keep `task dev` (or `task compile`) running and use "Developer: Reload Window"
 * after a rebuild. A folder holds one copy of an extension: when the Marketplace version
 * or an installed VSIX (any cyborgninja21.ck3-language-support-* that is not our link) is
 * there, link refuses and names the folder; uninstall it first
 * (`code --uninstall-extension cyborgninja21.ck3-language-support`). Unlink removes only our
 * link (and its entry in the folder's extensions.json, where VS Code records it), never a
 * real installation. Close or reload VS Code windows after unlinking. Standard library only.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'cyborgninja21.ck3-language-support';
const LINK_NAME = `${ID}-dev`;
const EXTENSION_ROOT = path.resolve(__dirname, '..', 'vscode-extension');

function defaultDirs() {
    if (process.env.CK3_VSCODE_EXTENSION_DIRS) {
        return process.env.CK3_VSCODE_EXTENSION_DIRS.split(path.delimiter).filter(Boolean);
    }
    const home = os.homedir();
    return [
        '.vscode',
        '.vscode-insiders',
        '.vscode-server',
        '.vscode-server-insiders',
    ].map((d) => path.join(home, d, 'extensions'));
}

function parseArgs(argv) {
    const [command, ...rest] = argv;
    const dirs = [];
    let dryRun = false;
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--dir') {
            dirs.push(path.resolve(rest[++i]));
        } else if (rest[i] === '--dry-run') {
            dryRun = true;
        } else {
            throw new Error(`unknown argument ${rest[i]}`);
        }
    }
    if (!['link', 'unlink', 'status'].includes(command)) {
        throw new Error('usage: dev-link.js link|unlink|status [--dir <extensions folder>]... [--dry-run]');
    }
    return { command, dirs, dryRun };
}

function isOurLink(p) {
    try {
        if (!fs.lstatSync(p).isSymbolicLink()) {
            return false;
        }
        return path.resolve(path.dirname(p), fs.readlinkSync(p)) === EXTENSION_ROOT
            || fs.realpathSync(p) === fs.realpathSync(EXTENSION_ROOT);
    } catch {
        return false;
    }
}

/** Installed copies of the extension in `dir` that are not our link (folders and extensions.json). */
function otherInstalls(dir) {
    const found = [];
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (name.toLowerCase().startsWith(`${ID}-`) && !isOurLink(p)) {
            found.push(p);
        }
    }
    const manifest = path.join(dir, 'extensions.json');
    if (fs.existsSync(manifest)) {
        try {
            const entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
            for (const e of Array.isArray(entries) ? entries : []) {
                const id = e && e.identifier && String(e.identifier.id).toLowerCase();
                const rel = e && e.relativeLocation;
                // Our own entry (relativeLocation = the link's name) is ours even when stale.
                if (id === ID && rel && rel !== LINK_NAME && !found.includes(path.join(dir, rel))) {
                    found.push(`${path.join(dir, rel)} (listed in extensions.json)`);
                }
            }
        } catch {
            // An unreadable extensions.json is VS Code's to repair; the folder scan above stands.
        }
    }
    return found;
}

function link(dir, dryRun) {
    const target = path.join(dir, LINK_NAME);
    if (isOurLink(target)) {
        return `already linked: ${target} -> ${EXTENSION_ROOT}`;
    }
    const others = otherInstalls(dir);
    if (others.length > 0) {
        throw new Error(
            `refusing to link into ${dir}: the extension is already installed there (${others.join(', ')}). ` +
                `Uninstall it first (code --uninstall-extension ${ID}, or the Insiders/remote equivalent), then run dev:link again.`
        );
    }
    if (fs.existsSync(target) || fsLexists(target)) {
        throw new Error(`refusing to replace ${target}: it exists and is not a link to ${EXTENSION_ROOT}`);
    }
    if (!fs.existsSync(path.join(EXTENSION_ROOT, 'dist', 'extension.js'))) {
        throw new Error(`${EXTENSION_ROOT}/dist/extension.js is missing: build first (task compile or task dev)`);
    }
    let registered = false;
    if (!dryRun) {
        fs.symlinkSync(EXTENSION_ROOT, target, process.platform === 'win32' ? 'junction' : 'dir');
        registered = registerInManifest(dir, target);
    }
    const note = registered ? ' (registered in extensions.json)' : '';
    return `${dryRun ? 'would link' : 'linked'}: ${target} -> ${EXTENSION_ROOT}${note}`;
}

/**
 * VS Code (1.140 verified) lists the extensions of a folder from its extensions.json once
 * that file exists and does not scan for new folders, so a link alone is invisible in any
 * folder VS Code has used. Add the entry VS Code itself writes for a folder it found
 * (identifier, version, location, relativeLocation). Without extensions.json VS Code scans
 * the folder and writes the entry itself. Returns whether an entry was added.
 */
function registerInManifest(dir, target) {
    const manifest = path.join(dir, 'extensions.json');
    if (!fs.existsSync(manifest)) {
        return false;
    }
    const entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (!Array.isArray(entries)) {
        throw new Error(`${manifest} is not a list; not touching it`);
    }
    const kept = entries.filter((e) => !(e && e.relativeLocation === LINK_NAME));
    const version = JSON.parse(fs.readFileSync(path.join(EXTENSION_ROOT, 'package.json'), 'utf8')).version;
    const uriPath = process.platform === 'win32' ? `/${target.replace(/\\/g, '/')}` : target;
    kept.push({
        identifier: { id: ID },
        version,
        location: { $mid: 1, path: uriPath, scheme: 'file' },
        relativeLocation: LINK_NAME,
    });
    const tmp = `${manifest}.ck3-dev-link.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(kept));
    fs.renameSync(tmp, manifest);
    return true;
}

function fsLexists(p) {
    try {
        fs.lstatSync(p);
        return true;
    } catch {
        return false;
    }
}

function unlink(dir, dryRun) {
    const target = path.join(dir, LINK_NAME);
    if (!fsLexists(target)) {
        const stale = dryRun ? 0 : forgetInManifest(dir);
        return `not linked: ${dir}${stale ? ' (removed a stale extensions.json entry of the link)' : ''}`;
    }
    if (!isOurLink(target)) {
        throw new Error(`refusing to remove ${target}: it is not a link to ${EXTENSION_ROOT}`);
    }
    let forgotten = 0;
    if (!dryRun) {
        fs.unlinkSync(target);
        forgotten = forgetInManifest(dir);
    }
    const note = forgotten ? ' (and its entry in extensions.json)' : '';
    return `${dryRun ? 'would unlink' : 'unlinked'}: ${target}${note}`;
}

/**
 * VS Code records every extension it finds in the folder's extensions.json, our link
 * included, and keeps listing an entry whose folder is gone. Remove our entry (and only
 * ours: relativeLocation equal to the link's name); returns how many were removed.
 */
function forgetInManifest(dir) {
    const manifest = path.join(dir, 'extensions.json');
    if (!fs.existsSync(manifest)) {
        return 0;
    }
    let entries;
    try {
        entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    } catch {
        return 0;
    }
    if (!Array.isArray(entries)) {
        return 0;
    }
    const kept = entries.filter((e) => !(e && e.relativeLocation === LINK_NAME));
    if (kept.length === entries.length) {
        return 0;
    }
    const tmp = `${manifest}.ck3-dev-link.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(kept));
    fs.renameSync(tmp, manifest);
    return entries.length - kept.length;
}

function status(dir) {
    const target = path.join(dir, LINK_NAME);
    const others = otherInstalls(dir);
    const linked = isOurLink(target) ? 'linked' : 'not linked';
    return `${dir}: ${linked}${others.length ? `; other installs: ${others.join(', ')}` : ''}`;
}

function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
    const explicit = args.dirs.length > 0;
    const dirs = (explicit ? args.dirs : defaultDirs()).filter((d) => {
        if (fs.existsSync(d)) {
            return true;
        }
        if (explicit) {
            process.stderr.write(`no such extensions folder: ${d}\n`);
        }
        return false;
    });
    if (dirs.length === 0) {
        process.stderr.write(
            `no VS Code extensions folder found (looked for ${defaultDirs().join(', ')}); pass --dir <folder>\n`
        );
        return 1;
    }
    let failed = 0;
    for (const dir of dirs) {
        try {
            const line =
                args.command === 'link'
                    ? link(dir, args.dryRun)
                    : args.command === 'unlink'
                      ? unlink(dir, args.dryRun)
                      : status(dir);
            process.stdout.write(`${line}\n`);
        } catch (e) {
            failed++;
            process.stderr.write(`${e.message}\n`);
        }
    }
    if (args.command === 'link' && failed < dirs.length && !args.dryRun) {
        process.stdout.write(
            'Reload each VS Code window ("Developer: Reload Window") to load the development build; ' +
                'after a rebuild, reload again. `task dev:unlink` removes the link.\n'
        );
    }
    return failed > 0 ? 1 : 0;
}

process.exitCode = main();
