````prompt
# gh issue create - Create GitHub Issue Assistant

When the user asks for help creating GitHub issues, follow this structured workflow:

## AI Assistant Behavior

- If a requested label does not exist in the repository, the assistant SHOULD create the label using `gh label create` before creating the issue.
- If the assistant creates any temporary files in the repository to supply the issue body (for example, an `issue_body.md` file), it MUST delete those files after the issue is successfully created. If deletion is not possible, leave a concise note in the issue body describing the temporary file and its location so maintainers can remove it.


## Creating Issues

The `gh issue create` command allows you to create issues for bug reports, feature requests, and tasks directly from the command line.

## Basic Usage

### Interactive Creation (Recommended for First-Time)

```bash
# Create issue interactively - prompts for details
gh issue create
````

Prompts will ask for:

- Title
- Body/Description
- Assignees
- Labels
- Milestone
- Projects

### Non-Interactive Creation

```bash
# Create issue with all details specified
gh issue create \
  --title "Parser crashes on malformed event files" \
  --body "Parser throws exception when encountering unexpected EOF."
```

## Common Creation Patterns

### 1. **Bug Report**

```bash
gh issue create \
  --title "Parser crashes on malformed event files" \
  --body "## Description
Parser throws NullPointerException when encountering unexpected EOF in event files.

## Steps to Reproduce
1. Create file with incomplete event definition
2. Open in VS Code with extension active
3. Parser crashes

## Expected Behavior
Parser should handle malformed files gracefully with helpful error message.

## Environment
- OS: Windows 11
- VS Code: 1.85.0
- Extension: v1.0.0

## Additional Context
Stack trace attached." \
  --label bug \
  --assignee @me
```

### 2. **Feature Request**

```bash
gh issue create \
  --title "Add support for localization validation" \
  --body "## Feature Description
Validate that all localization keys referenced in scripts exist.

## Use Case
Modders often reference non-existent loc keys, causing missing text in-game.

## Proposed Implementation
- Parse all .yml files in localization/
- Check script references against loc keys
- Show diagnostics for missing keys

## Benefits
- Catch loc errors before testing
- Improve mod quality" \
  --label enhancement
```

### 3. **Task/TODO**

```bash
gh issue create \
  --title "Update documentation for v1.2.0" \
  --body "## Tasks
- [ ] Update README.md with new features
- [ ] Add examples for scope validation
- [ ] Update CHANGELOG.md
- [ ] Create migration guide

## Deadline
Before v1.2.0 release" \
  --label documentation \
  --milestone "v1.2.0" \
  --assignee @me
```

### 4. **Question/Discussion**

```bash
gh issue create \
  --title "Should we support CK2 script format?" \
  --body "## Question
Users have requested CK2 support. Should we extend the parser?

## Considerations
- Additional maintenance burden
- Different syntax rules
- Limited CK2 modding community

## Options
1. Full CK2 support
2. Separate extension
3. No support

Thoughts?" \
  --label question,discussion
```

## Advanced Options

### Issue from Template

```bash
# Use issue template (if configured)
gh issue create --template bug_report.md
```

### Body from File

```bash
# Read issue body from file
gh issue create \
  --title "Complex issue with details" \
  --body-file issue_description.md \
  --label bug
```

### Open in Browser

```bash
# Create issue in web browser (uses templates automatically)
gh issue create --web
```

### Add to Milestone and Project

```bash
gh issue create \
  --title "Implement async parser" \
  --body "Refactor parser to use async/await" \
  --label enhancement \
  --milestone "v2.0.0" \
  --project "CK3 Language Server" \
  --assignee @me
```

### Multiple Labels

```bash
gh issue create \
  --title "Critical security vulnerability" \
  --body "Security issue description..." \
  --label bug,security,urgent
```

## Complete Issue Creation Workflows

### Bug Report Workflow

```bash
# 1. Encountered a bug while testing

# 2. Create detailed bug report
gh issue create \
  --title "Semantic tokens incorrect for nested scopes" \
  --body "## Bug Description
Semantic highlighting breaks in nested scope contexts.

## Reproduction
\`\`\`ck3
character = {
    every_vassal = {
        # Highlighting incorrect here
        add_gold = 100
    }
}
\`\`\`

## Expected
All keywords highlighted correctly.

## Actual
Keywords inside nested scopes lose highlighting.

## Environment
- Extension v1.1.0
- VS Code 1.85.0
- Windows 11" \
  --label bug,semantic-tokens \
  --assignee @me

# 3. Get issue number
ISSUE_NUM=$(gh issue list --limit 1 --json number --jq '.[0].number')

# 4. Create branch to fix
git checkout -b "fix/issue-${ISSUE_NUM}-nested-scope-tokens"
```

### Feature Request from User Feedback

```bash
# User requested feature in discussion

gh issue create \
  --title "Add hover documentation for scripted effects" \
  --body "## Feature Request
From user feedback: Need hover docs for custom scripted effects.

## Current Behavior
Hover only works for built-in effects.

## Requested Behavior
- Detect scripted effects in mod files
- Show documentation from comments
- Support both scripted_effects and scripted_triggers

## Implementation Notes
- Parse common/scripted_effects/*
- Extract documentation from comments
- Cache for performance

## User Quote
> 'Would love to see my custom effect docs on hover!'

Reported by: @username in #123" \
  --label enhancement,user-request \
  --milestone "v1.3.0"
```

### Batch Issue Creation

```bash
# Create multiple related issues
MILESTONE="v1.2.0"

gh issue create --title "Add scope validation tests" --label test --milestone "$MILESTONE"
gh issue create --title "Document scope validation" --label documentation --milestone "$MILESTONE"
gh issue create --title "Optimize scope cache" --label performance --milestone "$MILESTONE"
```

## Issue Templates (Setup)

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a bug or unexpected behavior
labels: bug, needs-triage
---

## Bug Description

[Clear description]

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Environment

- OS:
- VS Code Version:
- Extension Version:

## Additional Context

[Screenshots, logs, etc.]
```

## Common Options Reference

```bash
--title TEXT          Issue title (required)
--body TEXT           Issue description
--body-file FILE      Read description from file
--web                 Open browser to create issue
--assignee LOGIN      Assign users (@me for yourself)
--label NAME          Add labels (comma-separated)
--milestone NAME      Add to milestone
--project NAME        Add to project
--template NAME       Use issue template
```

## Quick Reference

```bash
# Interactive
gh issue create

# With details
gh issue create --title "..." --body "..." --label bug

# From file
gh issue create --title "..." --body-file description.md

# Open in browser
gh issue create --web

# Use template
gh issue create --template bug_report.md
```

## Troubleshooting

### Can't Create Issue

```bash
# Check permissions
gh auth status

# Ensure you're in a repository
git remote -v
```

### Template Not Found

```bash
# List available templates
ls -la .github/ISSUE_TEMPLATE/

# Use full template path
gh issue create --template .github/ISSUE_TEMPLATE/bug_report.md
```

### Labels Don't Exist

```bash
# Check existing labels (via web)
gh issue create --web

# Create labels first (via settings)
```

## Best Practices

1. **Use Descriptive Titles**: Make intent clear immediately
2. **Provide Context**: Include all relevant information
3. **Use Templates**: Ensure consistency and completeness
4. **Add Labels**: Help with organization and filtering
5. **Assign Appropriately**: Assign to relevant team members
6. **Link Related Issues**: Reference with #123 syntax
7. **Include Reproduction Steps**: For bugs, be specific
8. **Add to Milestones**: Track progress toward releases
9. **Use Markdown**: Format for readability
10. **Be Specific**: Avoid vague descriptions

```

```
