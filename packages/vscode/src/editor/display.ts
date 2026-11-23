/**
 * The virtual display the editor tests run on, checked on the live process before VS Code is
 * started: the display this process was given must be served by a running Xvfb, which
 * `xvfb-run -a` starts, and no Wayland display may be set. No VS Code import. Test code.
 */

import { readFileSync } from 'node:fs';

/** The display this process was given, checked to be a running Xvfb's; or why it is not. */
export function virtualDisplay(
    env: Readonly<Record<string, string | undefined>>,
    read: (file: string) => string | null,
): { readonly display: string } | { readonly refused: string } {
    const display = env['DISPLAY'];
    if (display === undefined || display === '') {
        return { refused: 'no DISPLAY: run under xvfb-run -a' };
    }
    if (env['WAYLAND_DISPLAY'] !== undefined && env['WAYLAND_DISPLAY'] !== '') {
        return {
            refused: `WAYLAND_DISPLAY is set (${env['WAYLAND_DISPLAY']}): run under xvfb-run -a`,
        };
    }
    const number = /^:(\d+)(?:\.\d+)?$/.exec(display)?.[1];
    if (number === undefined) {
        return { refused: `DISPLAY ${display} is not a local display: run under xvfb-run -a` };
    }
    const pid = (read(`/tmp/.X${number}-lock`) ?? '').trim();
    const command = /^\d+$/.test(pid) ? (read(`/proc/${pid}/comm`) ?? '').trim() : '';
    return command === 'Xvfb'
        ? { display }
        : {
              refused: `DISPLAY ${display} is not served by Xvfb (${command || 'no server'}): run under xvfb-run -a`,
          };
}

/** A small file's text, or null when it cannot be read. */
export function readOrNull(file: string): string | null {
    try {
        return readFileSync(file, 'utf8');
    } catch {
        return null;
    }
}
