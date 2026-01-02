# Development Tasks

All development tasks have been moved to GitHub Issues for better tracking and collaboration.

## Active Issues

### Developer Experience & Tooling
- #35 - Enable extension loading in main VS Code instance for faster development
- #36 - Add webpack watch mode and Dev Mode compound task for automatic compilation
- #38 - Document debugging setup for main instance vs Extension Development Host
- #39 - Add extension test suite that runs in main VS Code instance

### Testing Improvements
- #37 - Expand Hypothesis property-based testing with CK3-specific strategies and CI profiles

### Performance & Optimization
- #40 - Simplify thread management: Remove dual thread pools and use pygls exclusively
- #41 - Optimize diagnostics with single-pass AST visitor (3.3x faster)
- #42 - Add reverse index for O(1) document removal (1000x faster)
- #43 - Implement incremental parsing for 10-100x faster edits (deferred)
- #44 - Implement lazy workspace indexing for instant startup

## View All Issues

Visit the [GitHub Issues page](https://github.com/Cyborgninja21/pychivalry/issues) to see all open tasks, filter by label, or create new issues.

## Creating New Issues

Use the GitHub CLI to create issues:

```bash
gh issue create --title "Your issue title" --body "Description" --label "enhancement"
```

See [.github/prompts/gh issue create.prompt.md](.github/prompts/gh%20issue%20create.prompt.md) for detailed guidance on creating well-structured issues.
