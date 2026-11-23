import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './names-modifier-outside-use-area.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('names-modifier-outside-use-area-bad');
    assert.deepEqual(found, expectedFindings('names-modifier-outside-use-area-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'warning'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('names-modifier-outside-use-area-good'), []);
});

test(`${CODE} rests on the game's own output, with no catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
    assert.ok((CHECK_KINDS[CODE].gameOutput ?? '').includes('use_areas'));
});

test(`${CODE}: a block whose part D7 row is not confirmed raises nothing`, () => {
    // common/buildings::**.county_modifier is measured-only: a county block of a building's
    // level, at depth 3, is not judged.
    const text =
        'fixture_building_01 = {\n\tlevels = {\n\t\tfirst = {\n\t\t\tcounty_modifier = {\n\t\t\t\tdiplomacy = 1\n\t\t\t}\n\t\t}\n\t}\n}\n';
    const found = checkText('common/buildings/fixture.txt', text);
    assert.deepEqual(
        found.filter((f) => f.code === CODE),
        [],
    );
});

test(`${CODE}: a modifier the schema lists in the block is judged by its name; the block's own keys are not modifiers`, () => {
    // market_terrain_modifier: `terrain` is a key D7 measures in the block as no modifier.
    // county_potential_trade_good_modifier: D7 confirms the use area county; the game's
    // documentation gives `trade_good_<x>_production_add` the use area province only. The
    // package's own row notes the two disagree (a request to the spec work, docs/decisions.md).
    const text =
        'fixture_building_01 = {\n\tmarket_terrain_modifier = {\n\t\tterrain = taiga\n\t}\n\tcounty_potential_trade_good_modifier = {\n\t\ttrade_good = trade_good_cattle\n\t\ttrade_good_cattle_production_add = 1\n\t}\n}\n';
    const found = checkText('common/buildings/fixture.txt', text);
    assert.deepEqual(
        found.map((f) => [f.code, f.args[0]]),
        [[CODE, 'trade_good_cattle_production_add']],
    );
});
