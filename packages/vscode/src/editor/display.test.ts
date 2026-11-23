import assert from 'node:assert/strict';
import { test } from 'node:test';
import { virtualDisplay } from './display.js';

const files =
    (map: Record<string, string>) =>
    (file: string): string | null =>
        map[file] ?? null;

test('a display served by a running Xvfb is accepted', () => {
    const read = files({ '/tmp/.X99-lock': '     12345\n', '/proc/12345/comm': 'Xvfb\n' });
    assert.deepEqual(virtualDisplay({ DISPLAY: ':99' }, read), { display: ':99' });
    assert.deepEqual(virtualDisplay({ DISPLAY: ':99.0', WAYLAND_DISPLAY: '' }, read), {
        display: ':99.0',
    });
});

test('a desktop, Wayland, a remote display or none at all is refused', () => {
    const desktop = files({ '/tmp/.X0-lock': '3945\n', '/proc/3945/comm': 'gnome-shell\n' });
    const cases: [Record<string, string>, RegExp][] = [
        [{ DISPLAY: ':0' }, /not served by Xvfb \(gnome-shell\)/],
        [{ DISPLAY: ':99', WAYLAND_DISPLAY: 'wayland-0' }, /WAYLAND_DISPLAY is set/],
        [{ DISPLAY: 'host:0' }, /not a local display/],
        [{}, /no DISPLAY/],
        [{ DISPLAY: ':7' }, /not served by Xvfb \(no server\)/],
    ];
    for (const [env, reason] of cases) {
        const shown = virtualDisplay(env, desktop);
        assert.ok('refused' in shown, JSON.stringify(env));
        assert.match(shown.refused, reason);
    }
});
