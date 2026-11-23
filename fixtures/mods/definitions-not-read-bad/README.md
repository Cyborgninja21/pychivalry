# definitions-not-read-bad

The fixture pair of `definitions/not-read` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with `definitions-not-read-good`,
from which it differs only in the defect: a decision group in a folder written in upper case,
`common/DECISION_GROUP_TYPES`. On Linux the game compares paths exactly (the rules table's
`path-case-linux` row), so it does not read the file; the check's test indexes the mod as on
Linux.

A correct tool reports one finding at information, pychivalry's own advice: the game prints
nothing for a file it does not read. `expected.json` holds the finding.
