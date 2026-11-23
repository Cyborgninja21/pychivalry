/**
 * The language server's settings: the section `pychivalry` of the editor's settings, read
 * through `workspace/configuration` when the editor offers it, otherwise from the settings the
 * editor sends with `workspace/didChangeConfiguration` or in the initialization options. A
 * value of the wrong type is ignored and the default is used.
 *
 * | Setting | Default | What it changes |
 * | --- | --- | --- |
 * | `pychivalry.gamePath` | `""` | The game's `game` folder; empty: the game is looked for in every Steam library |
 * | `pychivalry.background.fileLimit` | `3000` | The most files of the mod checked in the background; `0`: none (open files are always checked) |
 * | `pychivalry.localization.unusedKeys` | `false` | Report `localization/unused-key`, off by default (decision 76) |
 * | `pychivalry.encoding.fallback` | `"none"` | `"windows-1252"`: read the bytes of a file that are not valid UTF-8 as Windows-1252 |
 * | `pychivalry.inlayHints.enabled` | `true` | Show the presentation data's inline hints (`inlay-hints.ts`) |
 */

import type { FallbackEncoding } from '@pychivalry/core';

/** The section of the editor's settings the server reads. */
export const SETTINGS_SECTION = 'pychivalry';

export interface Settings {
    /** The game's `game` folder, or `''` to look in every Steam library. */
    readonly gamePath: string;
    /** The most files of the mod checked in the background; 0 for none. */
    readonly fileLimit: number;
    /** Run `localization/unused-key`, which is off by default. */
    readonly unusedKeys: boolean;
    /** How to read the bytes of a file that are not valid UTF-8. */
    readonly fallbackEncoding: FallbackEncoding | null;
    /** Show the presentation data's inline hints. */
    readonly inlayHints: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
    gamePath: '',
    fileLimit: 3000,
    unusedKeys: false,
    fallbackEncoding: null,
    inlayHints: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The settings from the `pychivalry` section as the editor gives it: nested objects
 * (`{ background: { fileLimit } }`) or dotted keys (`{ 'background.fileLimit': 3000 }`).
 */
export function readSettings(section: unknown): Settings {
    const values = isRecord(section) ? section : {};
    const get = (dotted: string): unknown => {
        if (Object.prototype.hasOwnProperty.call(values, dotted)) {
            return values[dotted];
        }
        let at: unknown = values;
        for (const part of dotted.split('.')) {
            if (!isRecord(at) || !Object.prototype.hasOwnProperty.call(at, part)) {
                return undefined;
            }
            at = at[part];
        }
        return at;
    };
    const gamePath = get('gamePath');
    const fileLimit = get('background.fileLimit');
    const unusedKeys = get('localization.unusedKeys');
    const fallback = get('encoding.fallback');
    const inlayHints = get('inlayHints.enabled');
    return {
        gamePath: typeof gamePath === 'string' ? gamePath.trim() : DEFAULT_SETTINGS.gamePath,
        fileLimit:
            typeof fileLimit === 'number' && Number.isFinite(fileLimit) && fileLimit >= 0
                ? Math.floor(fileLimit)
                : DEFAULT_SETTINGS.fileLimit,
        unusedKeys: typeof unusedKeys === 'boolean' ? unusedKeys : DEFAULT_SETTINGS.unusedKeys,
        fallbackEncoding:
            fallback === 'windows-1252' ? 'windows-1252' : DEFAULT_SETTINGS.fallbackEncoding,
        inlayHints: typeof inlayHints === 'boolean' ? inlayHints : DEFAULT_SETTINGS.inlayHints,
    };
}

/** What a change of settings asks of the server. */
export function settingsChange(
    before: Settings,
    after: Settings,
): { readonly reopen: boolean; readonly recheck: boolean; readonly more: boolean } {
    return {
        // The game or the way files are read changed: the index is opened again.
        reopen:
            before.gamePath !== after.gamePath ||
            before.fallbackEncoding !== after.fallbackEncoding,
        // A check turned on or off: every file is checked again.
        recheck: before.unusedKeys !== after.unusedKeys,
        // More files may be checked in the background.
        more: after.fileLimit > before.fileLimit,
    };
}
