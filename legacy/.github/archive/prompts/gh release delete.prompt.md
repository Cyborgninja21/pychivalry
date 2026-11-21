```prompt
# gh release delete - Delete GitHub Release Assistant

When the user asks for help deleting GitHub releases, follow this structured workflow:

## Deleting Releases

The `gh release delete` command removes a release from GitHub, with options to also delete associated tags and clean up assets.

## Basic Usage

### Delete Release (Keep Tag)

```bash
# Delete release but keep git tag
gh release delete v1.0.0

# Confirm before deletion (safe)
gh release delete v1.0.0 --yes
```

### Delete Release and Tag

```bash
# Delete both release and git tag
gh release delete v1.0.0 --cleanup-tag

# Equivalent: delete release then tag separately
gh release delete v1.0.0
git push origin :refs/tags/v1.0.0
```

## Deletion Workflows

### Remove Draft Release

```bash
# List draft releases
gh release list --exclude-drafts=false | grep Draft

# Delete draft
gh release delete v1.1.0-beta --yes

# Draft deletions don't need tag cleanup
```

### Clean Up Failed Release

```bash
# Release was created incorrectly
gh release delete v1.0.1 --cleanup-tag --yes

# Recreate properly
gh release create v1.0.1 --title "Version 1.0.1" --notes "Fixed release"
```

### Remove Old Pre-releases

```bash
# Delete obsolete pre-release
gh release delete v1.0.0-rc.1 --cleanup-tag --yes

# Keep recent stable releases
```

### Remove All Beta Releases

```bash
# Get all beta releases
gh release list | grep beta | awk '{print $1}' | while read tag; do
  gh release delete "$tag" --cleanup-tag --yes
  echo "Deleted $tag"
done
```

## Interactive vs Non-Interactive

### Interactive (Prompts for Confirmation)

```bash
# Will ask "Delete release v1.0.0?"
gh release delete v1.0.0

# Type 'y' to confirm
```

### Non-Interactive (Script-Friendly)

```bash
# Auto-confirm deletion
gh release delete v1.0.0 --yes

# Use in scripts without manual confirmation
```

## Tag Management

### Delete Release, Keep Tag

```bash
# Release removed, tag remains in repo
gh release delete v1.0.0 --yes

# Tag still exists
git tag -l | grep v1.0.0
# v1.0.0

# Can recreate release from same tag
gh release create v1.0.0 --notes "Recreated"
```

### Delete Release and Tag

```bash
# Remove both release and tag
gh release delete v1.0.0 --cleanup-tag --yes

# Tag no longer exists
git tag -l | grep v1.0.0
# (empty)

# Tag removed from remote
git ls-remote --tags origin | grep v1.0.0
# (empty)
```

### Delete Tag Manually After

```bash
# Delete release first
gh release delete v1.0.0 --yes

# Then delete tag locally
git tag -d v1.0.0

# Delete tag from remote
git push origin :refs/tags/v1.0.0
```

## Complete Deletion Workflows

### Clean Slate for Re-release

```bash
# 1. Delete existing release completely
gh release delete v1.0.0 --cleanup-tag --yes

# 2. Delete local tag
git tag -d v1.0.0

# 3. Create new tag
git tag -a v1.0.0 -m "Release v1.0.0"

# 4. Push tag
git push origin v1.0.0

# 5. Create proper release
gh release create v1.0.0 \
  --title "Version 1.0.0" \
  --notes-file CHANGELOG.md
```

### Remove Failed Versioned Release

```bash
# Release v1.2.0 was created by mistake

# 1. Delete release and tag
gh release delete v1.2.0 --cleanup-tag --yes

# 2. Verify removal
gh release list | grep v1.2.0
# (should be empty)

# 3. Roll back version in code if needed
# (edit version files back to v1.1.0)
```

### Bulk Delete Old Pre-releases

```bash
# Delete all alpha releases
gh release list --limit 100 | \
  grep -E "alpha|rc|beta" | \
  awk '{print $1}' | \
  while read tag; do
    gh release delete "$tag" --cleanup-tag --yes
    echo "✅ Deleted $tag"
  done
```

## Safety Checks Before Deletion

### Verify Release Before Deleting

```bash
# 1. View release details
gh release view v1.0.0

# 2. Check if it's a stable release
gh release view v1.0.0 --json isPrerelease --jq '.isPrerelease'

# 3. Confirm deletion
gh release delete v1.0.0 --yes
```

### Backup Release Assets

```bash
# Download all assets before deletion
gh release download v1.0.0 -D backup/

# Then delete
gh release delete v1.0.0 --cleanup-tag --yes
```

## Common Deletion Scenarios

### Wrong Version Number

```bash
# Created v1.0.0 instead of v1.0.1
gh release delete v1.0.0 --cleanup-tag --yes

# Create correct version
gh release create v1.0.1 --notes "Correct version"
```

### Duplicate Release

```bash
# Accidentally created duplicate
gh release delete v1.0.0-duplicate --yes
```

### Obsolete Release

```bash
# Old version no longer needed
gh release delete v0.5.0 --cleanup-tag --yes
```

### Test Release Cleanup

```bash
# Remove test releases
gh release delete test-release --cleanup-tag --yes
gh release delete v0.0.1-test --cleanup-tag --yes
```

## Delete Options Reference

```bash
--cleanup-tag        Delete associated git tag
--yes, -y            Skip confirmation prompt
```

## Quick Reference

```bash
# Delete release (keep tag)
gh release delete v1.0.0

# Delete release and tag
gh release delete v1.0.0 --cleanup-tag

# Auto-confirm
gh release delete v1.0.0 --yes

# Delete with tag, no prompt
gh release delete v1.0.0 --cleanup-tag --yes
```

## Troubleshooting

### Can't Delete Release

```bash
# Check permissions
gh auth status

# Verify release exists
gh release list

# Check repository
gh repo view
```

### Release Not Found

```bash
# List all releases
gh release list --limit 100

# Check exact tag name
gh release list | grep v1.0
```

### Tag Still Exists After --cleanup-tag

```bash
# Sometimes local tag remains
git tag -d v1.0.0

# Remove from remote
git push origin :refs/tags/v1.0.0

# Verify removal
git ls-remote --tags origin | grep v1.0.0
```

### Protected Tag

```bash
# Some repos have protected tags
# Must disable protection in repo settings first
# Then delete via gh or git
```

## Best Practices

1. **Always Backup**: Download assets before deleting important releases
2. **Use --yes in Scripts**: Avoid hanging on confirmation prompts
3. **Clean Up Tags**: Use --cleanup-tag for complete removal
4. **Verify First**: Check release details before deletion
5. **Don't Delete Stable**: Keep stable production releases
6. **Document Reasons**: Note why a release was deleted (in issues/notes)
7. **Test Releases Separately**: Use draft or pre-release flags
8. **Coordinate with Team**: Communicate before deleting team releases
9. **Check Dependencies**: Ensure no systems rely on the release
10. **Can't Undo**: Deletions are permanent, be certain before proceeding

## Warning: Deletion is Permanent

⚠️ **Deleted releases cannot be recovered**

- Release and its assets are permanently removed
- If `--cleanup-tag` used, tag is also permanently deleted
- Users who downloaded the release keep their copies
- Links to the release (in docs, issues) will break
- Consider making release a draft instead of deleting

```
