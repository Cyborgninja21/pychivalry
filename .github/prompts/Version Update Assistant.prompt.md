````prompt
# Version Update Assistant

When the user asks for help updating version numbers or preparing a release, follow this structured workflow:

## Version Numbering Scheme

Use Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`

### Version Components

- `MAJOR` - Incompatible API changes or breaking changes
- `MINOR` - New features, backwards-compatible
- `PATCH` - Bug fixes, backwards-compatible

**Examples:**

- `1.0.0` - Initial stable release
- `1.1.0` - Added new features
- `1.1.1` - Bug fix release
- `2.0.0` - Breaking changes

### Pre-release Versions

- `1.0.0-alpha.1` - Alpha testing (unstable)
- `1.0.0-beta.1` - Beta testing (feature-complete, stabilizing)
- `1.0.0-rc.1` - Release candidate (final testing)

## Files to Update

For this project, version numbers appear in multiple locations:

### 1. Python Package (`pyproject.toml`)

```toml
[project]
name = "pychivalry"
version = "X.Y.Z"
````

### 2. VS Code Extension (`vscode-extension/package.json`)

```json
{
  "name": "pychivalry-lsp",
  "version": "X.Y.Z",
  "engines": {
    "vscode": "^1.80.0"
  }
}
```

### 3. Python Package Init (`pychivalry/__init__.py`)

```python
__version__ = "X.Y.Z"
```

## Version Update Workflow

### 1. **Determine new version number**

Based on changes since last release:

```bash
# View commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Or view full changelog
git log $(git describe --tags --abbrev=0)..HEAD
```

**Decision matrix:**

- Breaking changes or major API changes → Increment MAJOR
- New features added → Increment MINOR
- Only bug fixes → Increment PATCH

### 2. **Update all version files**

```bash
# Set version variable for consistency
NEW_VERSION="1.2.0"

# Update pyproject.toml (Python package)
sed -i "s/^version = .*/version = \"$NEW_VERSION\"/" pyproject.toml

# Update package.json (VS Code extension)
cd vscode-extension
npm version $NEW_VERSION --no-git-tag-version
cd ..

# Update Python __init__.py
sed -i "s/__version__ = .*/__version__ = \"$NEW_VERSION\"/" pychivalry/__init__.py

# Verify changes
git diff
```

### 3. **Update CHANGELOG.md**

Add release notes following format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New feature descriptions
- New command implementations
- New capabilities

### Changed

- Modified behaviors
- Updated dependencies
- Refactored components

### Fixed

- Bug fix descriptions
- Error handling improvements
- Performance fixes

### Breaking Changes

- API changes requiring user action
- Configuration changes
- Removed features
```

### 4. **Commit version changes**

```bash
git add pyproject.toml vscode-extension/package.json pychivalry/__init__.py CHANGELOG.md

git commit -m "chore: Bump version to $NEW_VERSION

Release: version $NEW_VERSION

Updated version across:
- pyproject.toml (Python package)
- vscode-extension/package.json (VS Code extension)
- pychivalry/__init__.py (package version)
- CHANGELOG.md (release notes)

Release type: [major/minor/patch]
Release date: $(date +%Y-%m-%d)"
```

### 5. **Create git tag**

```bash
# Create annotated tag
git tag -a v$NEW_VERSION -m "Release version $NEW_VERSION

[Brief summary of release]

Major changes:
- Change category 1
- Change category 2
- Change category 3

See CHANGELOG.md for complete details."

# Verify tag
git tag -n
git show v$NEW_VERSION
```

### 6. **Push changes and tag**

```bash
# Push commits
git push origin main

# Push tag
git push origin v$NEW_VERSION

# Or push all tags
git push origin --tags
```

## Complete Version Update Example

### Patch Release (1.1.0 → 1.1.1)

```bash
# Determine new version based on changes
git log v1.1.0..HEAD --oneline
# Output shows only bug fixes → PATCH bump

NEW_VERSION="1.1.1"

# Update version files
sed -i "s/^version = .*/version = \"$NEW_VERSION\"/" pyproject.toml
sed -i "s/__version__ = .*/__version__ = \"$NEW_VERSION\"/" pychivalry/__init__.py
cd vscode-extension && npm version $NEW_VERSION --no-git-tag-version && cd ..

# Update CHANGELOG.md manually with release notes
# (Edit file to add new section at top)

# Commit changes
git add pyproject.toml vscode-extension/package.json pychivalry/__init__.py CHANGELOG.md
git commit -m "chore: Bump version to $NEW_VERSION

Release: version $NEW_VERSION

Updated version across:
- pyproject.toml (Python package)
- vscode-extension/package.json (VS Code extension)
- pychivalry/__init__.py (package version)
- CHANGELOG.md (release notes)

Release type: patch
Release date: $(date +%Y-%m-%d)"

# Create tag
git tag -a v$NEW_VERSION -m "Release version $NEW_VERSION

Bug fix release addressing parser and diagnostic issues

Major fixes:
- Parser crash on malformed event files
- Memory leak in scope validation
- False positive diagnostics in nested contexts

See CHANGELOG.md for complete details."

# Push everything
git push origin main
git push origin v$NEW_VERSION
```

### Minor Release (1.1.1 → 1.2.0)

```bash
NEW_VERSION="1.2.0"

# Update all version files
sed -i "s/^version = .*/version = \"$NEW_VERSION\"/" pyproject.toml
sed -i "s/__version__ = .*/__version__ = \"$NEW_VERSION\"/" pychivalry/__init__.py
cd vscode-extension && npm version $NEW_VERSION --no-git-tag-version && cd ..

# Update CHANGELOG.md with new features

git add pyproject.toml vscode-extension/package.json pychivalry/__init__.py CHANGELOG.md
git commit -m "chore: Bump version to $NEW_VERSION

Release: version $NEW_VERSION

Updated version across:
- pyproject.toml (Python package)
- vscode-extension/package.json (VS Code extension)
- pychivalry/__init__.py (package version)
- CHANGELOG.md (release notes)

Release type: minor
Release date: $(date +%Y-%m-%d)"

git tag -a v$NEW_VERSION -m "Release version $NEW_VERSION

Feature release with new LSP capabilities

New features:
- Live log analysis with real-time error detection
- Enhanced semantic token highlighting
- Improved scope validation with better diagnostics

See CHANGELOG.md for complete details."

git push origin main
git push origin v$NEW_VERSION
```

### Major Release (1.2.0 → 2.0.0)

```bash
NEW_VERSION="2.0.0"

# Update all version files
sed -i "s/^version = .*/version = \"$NEW_VERSION\"/" pyproject.toml
sed -i "s/__version__ = .*/__version__ = \"$NEW_VERSION\"/" pychivalry/__init__.py
cd vscode-extension && npm version $NEW_VERSION --no-git-tag-version && cd ..

# Update CHANGELOG.md with breaking changes section

git add pyproject.toml vscode-extension/package.json pychivalry/__init__.py CHANGELOG.md
git commit -m "chore: Bump version to $NEW_VERSION

Release: version $NEW_VERSION - BREAKING CHANGES

Updated version across:
- pyproject.toml (Python package)
- vscode-extension/package.json (VS Code extension)
- pychivalry/__init__.py (package version)
- CHANGELOG.md (release notes with migration guide)

Release type: major
Release date: $(date +%Y-%m-%d)

Breaking changes require user action - see CHANGELOG.md for migration guide"

git tag -a v$NEW_VERSION -m "Release version $NEW_VERSION

MAJOR RELEASE - Breaking changes included

Breaking changes:
- Refactored LSP server architecture (config changes required)
- Changed diagnostic severity levels (update user settings)
- Removed deprecated features (see migration guide)

New features:
- Async/await architecture for better performance
- Enhanced workspace-wide validation
- Improved code action system

MIGRATION REQUIRED: See CHANGELOG.md and documentation

See CHANGELOG.md for complete details and migration guide."

git push origin main
git push origin v$NEW_VERSION
```

## Post-Release Actions

### 1. **Verify version consistency**

```bash
# Check all version files match
grep -r "version.*=.*\".*\"" pyproject.toml pychivalry/__init__.py vscode-extension/package.json
```

### 2. **Build and test release artifacts**

```bash
# Build Python package
python -m build

# Verify package metadata
python -m pip install dist/pychivalry-$NEW_VERSION-py3-none-any.whl
python -c "import pychivalry; print(pychivalry.__version__)"

# Build VS Code extension
cd vscode-extension
npm run compile
vsce package
```

### 3. **Publish releases (if applicable)**

```bash
# Publish Python package to PyPI
python -m twine upload dist/*

# Publish VS Code extension
cd vscode-extension
vsce publish
```

### 4. **Create GitHub release**

Using GitHub CLI (recommended):

```bash
# Create release from tag with notes from CHANGELOG
gh release create v$NEW_VERSION \
  --title "v$NEW_VERSION - [Release Title]" \
  --notes "## 🎉 [Release Type] Release: [Brief Description]

[Copy relevant sections from CHANGELOG.md here]

See [CHANGELOG.md](https://github.com/Cyborgninja21/pychivalry/blob/main/CHANGELOG.md) for complete details."

# Or generate notes automatically from commits
gh release create v$NEW_VERSION \
  --title "v$NEW_VERSION - [Release Title]" \
  --generate-notes

# View the release
gh release view v$NEW_VERSION --web
```

Alternative (Web Interface):

1. Go to GitHub repository → Releases → Create new release
2. Select the new tag
3. Use CHANGELOG.md content for release notes
4. Attach build artifacts (optional)
5. Mark as pre-release if applicable

### 5. **Update documentation**

```bash
# Update installation instructions if version requirements changed
# Update API documentation if interfaces changed
# Update example code if syntax changed
```

### 6. **Announce release**

- Update project README.md badges
- Post to discussions/forums if applicable
- Notify users of breaking changes
- Update installation guides

## Quick Reference Commands

```bash
# View current version
grep "^version = " pyproject.toml

# View all tags
git tag -l

# View latest tag
git describe --tags --abbrev=0

# View changes since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Count commits since last tag
git rev-list $(git describe --tags --abbrev=0)..HEAD --count

# Delete tag (if mistake)
git tag -d v1.2.0
git push origin --delete v1.2.0

# Create lightweight tag (not recommended for releases)
git tag v1.2.0

# List all version strings in project
rg -g '!node_modules' -g '!dist' -g '!*.egg-info' 'version.*=.*[0-9]+\.[0-9]+\.[0-9]+'
```

## Version Update Checklist

- [ ] Determine appropriate version bump (major/minor/patch)
- [ ] Update pyproject.toml
- [ ] Update vscode-extension/package.json
- [ ] Update pychivalry/**init**.py
- [ ] Update CHANGELOG.md with release notes
- [ ] Commit version changes with descriptive message
- [ ] Create annotated git tag
- [ ] Push commits to remote
- [ ] Push tag to remote
- [ ] Build and test release artifacts
- [ ] Create GitHub release with notes
- [ ] Publish packages (if applicable)
- [ ] Update documentation
- [ ] Announce release

## Troubleshooting

### Version mismatch between files

```bash
# Find all version strings
rg 'version.*[0-9]+\.[0-9]+\.[0-9]+'

# Update all at once with sed
NEW_VERSION="1.2.0"
find . -type f -name "pyproject.toml" -o -name "__init__.py" -o -name "package.json" | \
  xargs sed -i "s/version.*=.*\"[0-9.]*\"/version = \"$NEW_VERSION\"/"
```

### Tag already exists

```bash
# Delete local tag
git tag -d v1.2.0

# Delete remote tag
git push origin --delete v1.2.0

# Recreate tag
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0
```

### Forgot to update CHANGELOG

```bash
# Amend last commit
# Edit CHANGELOG.md manually
git add CHANGELOG.md
git commit --amend --no-edit

# Update tag to point to new commit
git tag -d v1.2.0
git tag -a v1.2.0 -m "Release version 1.2.0"

# Force push (use with caution)
git push origin main --force
git push origin v1.2.0 --force
```

### Need to create hotfix version

```bash
# Create hotfix branch from tag
git checkout -b hotfix/critical-fix v1.2.0

# Make fixes
# ...

# Update to patch version
NEW_VERSION="1.2.1"
# Update version files
# Commit, tag, and push

# Merge back to main
git checkout main
git merge --no-ff hotfix/critical-fix
```

## Best Practices

1. **Always use annotated tags** (`-a` flag) for releases
2. **Keep CHANGELOG.md up to date** throughout development
3. **Test thoroughly** before creating release tag
4. **Follow SemVer strictly** to manage user expectations
5. **Document breaking changes** prominently
6. **Create release branches** for long-term support
7. **Automate version updates** with scripts when possible
8. **Coordinate multi-component releases** (Python + Extension)

## Automation Scripts

### Version Bump Script

Save as `tools/bump_version.sh`:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <new-version>"
  exit 1
fi

NEW_VERSION="$1"

# Update all version files
sed -i "s/^version = .*/version = \"$NEW_VERSION\"/" pyproject.toml
sed -i "s/__version__ = .*/__version__ = \"$NEW_VERSION\"/" pychivalry/__init__.py
cd vscode-extension && npm version $NEW_VERSION --no-git-tag-version && cd ..

echo "Version updated to $NEW_VERSION in all files"
echo "Don't forget to:"
echo "1. Update CHANGELOG.md"
echo "2. Commit changes"
echo "3. Create git tag"
echo "4. Push to remote"
```

### Release Script

Save as `tools/create_release.sh`:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION="$1"

# Verify all files have matching version
echo "Verifying version consistency..."
bash tools/bump_version.sh $VERSION

# Update CHANGELOG
echo "Update CHANGELOG.md now, then press enter..."
read

# Commit
git add pyproject.toml vscode-extension/package.json pychivalry/__init__.py CHANGELOG.md
git commit -m "chore: Bump version to $VERSION"

# Tag
git tag -a v$VERSION -m "Release version $VERSION"

# Push
git push origin main
git push origin v$VERSION

echo "Release v$VERSION created successfully!"
```

This workflow ensures consistent, documented, and trackable version management throughout the project lifecycle.

```

```
