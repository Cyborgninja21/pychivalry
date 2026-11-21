# parse-broken-syntax

Carried over from release 2.3.0: `legacy/packages/engine/test/fixtures/engine-test-mods/broken_syntax/events/test_broken_syntax.txt`,
byte for byte (2.3.0 had it from the `pdx-parser-re` test mods). Five intentional errors in
five events: a missing `=`, a missing `}`, an extra `}`, a number as a key, and an unclosed
quote.

A correct parser reports two findings, the two of 2.3.0's golden file
(`legacy/packages/engine/test/golden/broken_syntax.json`) that come from parsing:

- line 64, at event 0005's `{`: `Expected } after arguments`, because the unclosed quote on
  line 66 runs to the end of the file;
- line 66, at that quote: `Unterminated string starting at 'events/test_broken_syntax.txt:66'`,
  information (2.3.0 called it the error `PYCH-P001`).

The extra `}` of event 0003 closes event 0002 and cancels event 0002's missing one, so neither
brace is reported. The other rows of the golden file come from checks, which are build step
4's: a bare value inside an event (line 10), `option` read as a trigger (line 32), and unknown
fields (lines 38 and 55). `expected.json` holds the two findings.
