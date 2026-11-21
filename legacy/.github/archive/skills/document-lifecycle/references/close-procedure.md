# Close Procedure Reference

Step-by-step procedure for closing a document when it reaches terminal status.

---

## Prerequisites

- Document has reached a terminal status:
  - `Committed` - Changes committed to git
  - `Released` - Successfully pushed/published
  - `Abandoned` - Explicitly dropped
  - `Deferred` - Postponed indefinitely
  - `Superseded` - Replaced by newer document
  - `Resolved` - All findings addressed (critiques)

---

## Procedure

### Step 1: Update Status Field

In the document's YAML frontmatter, update the Status:

```yaml
---
ID: 080
Origin: 080
UUID: a3f7c2b1
Status: Committed    # ← Updated to terminal status
---
```

### Step 2: Add Changelog Entry

Add a closure entry to the document's changelog table:

```markdown
| YYYY-MM-DD | [Your Agent Name] | Document closed | Status: Committed |
```

### Step 3: Create Closed Folder (If Needed)

```bash
mkdir -p agent-output/<domain>/closed/
```

Replace `<domain>` with the appropriate folder:
- `planning`, `implementation`, `qa`, `uat`, `critiques`
- `analysis`, `retrospectives`, `process-improvement`
- `deployment`, `security`, `architecture`

### Step 4: Move the File

```bash
mv agent-output/<domain>/NNN-name.md agent-output/<domain>/closed/
```

### Step 5: Log the Action

Report in your response:

> Closed document `080-feature-name.md` (Status: Committed) → moved to `agent-output/planning/closed/`

---

## Bulk Closure (DevOps After Commit)

When committing a plan, close all related documents:

```bash
# For each document type in the chain
for domain in planning implementation qa uat; do
  mkdir -p agent-output/$domain/closed/
  # Update Status to "Committed" in each doc, then move
  mv agent-output/$domain/080-*.md agent-output/$domain/closed/
done
```

Report:
> Closed documents for Plan 080: planning, implementation, qa, uat → moved to respective `closed/` folders.

---

## Cross-Reference Updates

If other active documents reference the now-closed document, update the path:

**Before:**
```markdown
See [plan](../planning/080-feature.md)
```

**After:**
```markdown
See [plan](../planning/closed/080-feature.md)
```

Note: This is optional for documents being closed together (they'll all be in `closed/`).
