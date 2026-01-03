# VS Code Extension Packaging Guide

**Purpose:** Complete guide for packaging and distributing the pychivalry VS Code extension.

**Use this when:** Creating releases, publishing to marketplace, or distributing the extension.

---

## Prerequisites

### Install vsce (VS Code Extension Manager)

```bash
npm install -g @vscode/vsce
```

### Prepare Publisher Account

1. Create Microsoft Account (if needed)
2. Create Azure DevOps organization
3. Create Personal Access Token (PAT)
4. Create publisher ID on Visual Studio Marketplace

Details: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Pre-Packaging Checklist

### 1. Update Version Number

In `vscode-extension/package.json`:

```json
{
  "name": "pychivalry",
  "version": "1.2.0",  // Semantic versioning: MAJOR.MINOR.PATCH
  "description": "CK3 Language Server Extension"
}
```

### 2. Update CHANGELOG

In `CHANGELOG.md`:

```markdown
## [1.2.0] - 2024-01-15

### Added
- New completion features
- Enhanced scope validation

### Fixed
- Bug in trait validation
- Performance issues with large files

### Changed
- Improved error messages
```

### 3. Update README

Ensure `README.md` is up to date with:
- Current feature list
- Installation instructions
- Configuration options
- Screenshots/GIFs (if available)

### 4. Clean Build

```bash
cd vscode-extension

# Remove old builds
rm -rf out/
rm -f *.vsix

# Fresh install
rm -rf node_modules/
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Lint code
npm run lint
```

### 5. Verify Extension Manifest

Check `package.json` has all required fields:

```json
{
  "name": "pychivalry",
  "displayName": "CK3 Language Server",
  "description": "Language Server for Crusader Kings 3 modding",
  "version": "1.2.0",
  "publisher": "your-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/pychivalry"
  },
  "bugs": {
    "url": "https://github.com/username/pychivalry/issues"
  },
  "license": "Apache-2.0",
  "icon": "icon.png",  // 128x128 PNG
  "categories": ["Programming Languages", "Linters"],
  "keywords": ["ck3", "crusader-kings", "modding", "language-server"],
  "engines": {
    "vscode": "^1.80.0"
  }
}
```

### 6. Add Icon

Create 128x128 PNG icon: `vscode-extension/icon.png`

### 7. Test Extension Locally

```bash
# Package extension
vsce package

# Install locally
code --install-extension pychivalry-1.2.0.vsix

# Test in VS Code
# Open CK3 mod files and verify all features work
```

## Packaging Process

### Create VSIX Package

```bash
cd vscode-extension

# Basic package
vsce package

# Specific version
vsce package 1.2.0

# Pre-release version
vsce package --pre-release

# Package with yarn
vsce package --yarn
```

This creates: `pychivalry-1.2.0.vsix`

### Verify Package Contents

```bash
# List files in package
unzip -l pychivalry-1.2.0.vsix

# Extract and inspect
unzip pychivalry-1.2.0.vsix -d /tmp/extension-check
ls -la /tmp/extension-check/extension/
```

### Check Package Size

```bash
ls -lh pychivalry-1.2.0.vsix

# Should be < 10 MB ideally
# If too large, check for unnecessary files
```

### Exclude Unnecessary Files

Create `.vscodeignore`:

```
.vscode/**
.vscode-test/**
out/test/**
src/**
.gitignore
.yarnrc
tsconfig.json
tslint.json
*.map
*.ts
!out/**/*.js
node_modules/**
!node_modules/dependencies-you-need/**
```

## Publishing to Marketplace

### 1. Login to Publisher

```bash
vsce login your-publisher-id
# Enter your Personal Access Token (PAT)
```

### 2. Publish Extension

```bash
# Publish current version
vsce publish

# Publish specific version
vsce publish 1.2.0

# Publish and increment version
vsce publish minor  # 1.2.0 -> 1.3.0
vsce publish patch  # 1.2.0 -> 1.2.1
vsce publish major  # 1.2.0 -> 2.0.0

# Publish pre-release
vsce publish --pre-release
```

### 3. Verify on Marketplace

Visit: https://marketplace.visualstudio.com/items?itemName=your-publisher-id.pychivalry

Check:
- [ ] Extension appears in search
- [ ] README displays correctly
- [ ] Screenshots are visible
- [ ] Install button works
- [ ] Ratings/reviews enabled

## Alternative: Manual Upload

1. Go to https://marketplace.visualstudio.com/manage
2. Login with publisher account
3. Click "New extension" → "Visual Studio Code"
4. Upload `.vsix` file
5. Fill in metadata
6. Publish

## GitHub Release

### 1. Create Git Tag

```bash
git tag v1.2.0
git push origin v1.2.0
```

### 2. Create GitHub Release

Using GitHub CLI:

```bash
gh release create v1.2.0 \
  --title "Release v1.2.0" \
  --notes-file CHANGELOG.md \
  vscode-extension/pychivalry-1.2.0.vsix
```

Or manually:
1. Go to GitHub → Releases → New Release
2. Tag: `v1.2.0`
3. Title: `Release v1.2.0`
4. Description: Copy from CHANGELOG.md
5. Attach: `pychivalry-1.2.0.vsix`
6. Publish release

## Distribution Options

### 1. VS Code Marketplace (Official)

**Pros:**
- Official distribution
- Automatic updates
- Searchable
- Trusted by users

**Cons:**
- Requires publisher account
- Review process
- Terms of service

**Installation:**
```
1. Open VS Code
2. Extensions → Search "pychivalry"
3. Click Install
```

### 2. VSIX File (Direct)

**Pros:**
- No account needed
- Full control
- Offline installation

**Cons:**
- Manual updates
- Users must find file
- No discovery

**Installation:**
```bash
code --install-extension pychivalry-1.2.0.vsix
```

Or in VS Code:
```
Extensions → ... → Install from VSIX
```

### 3. GitHub Releases

**Pros:**
- Integrated with code
- Version history
- Download statistics

**Cons:**
- Not in marketplace
- Manual installation

**Installation:**
```
1. Download .vsix from GitHub Releases
2. Install in VS Code
```

### 4. Open VSX Registry (Alternative)

For VSCodium and other VS Code alternatives:

```bash
npm install -g ovsx
ovsx publish pychivalry-1.2.0.vsix -p <token>
```

## Update Process

### Publishing Updates

```bash
cd vscode-extension

# Update version in package.json
# Update CHANGELOG.md

# Build and test
npm run compile
npm test

# Publish update
vsce publish minor  # or patch/major

# Tag in git
git tag v1.3.0
git push origin v1.3.0

# Create GitHub release
gh release create v1.3.0 pychivalry-1.3.0.vsix
```

### Notify Users

Users with installed extension will:
- See update notification in VS Code
- Can auto-update if configured
- See changelog in extension details

## Unpublishing

### Remove from Marketplace

```bash
# Unpublish specific version
vsce unpublish your-publisher-id.pychivalry@1.2.0

# Unpublish entire extension
vsce unpublish your-publisher-id.pychivalry
```

⚠️ **Warning:** This is permanent and cannot be undone easily.

## Troubleshooting

### "Package too large" Error

```bash
# Check size
ls -lh *.vsix

# Review .vscodeignore
# Ensure node_modules is excluded (except runtime deps)
# Remove source files (.ts) from package
```

### "Invalid manifest" Error

```bash
# Validate package.json
vsce ls

# Check required fields
# - name, version, publisher
# - engines.vscode
```

### "Invalid publisher" Error

```bash
# Verify publisher ID matches
# Login again
vsce login your-publisher-id
```

### Extension Not Found After Publishing

- Wait 5-10 minutes for indexing
- Check publisher portal for status
- Verify extension is not unlisted

## Best Practices

### Versioning

Use Semantic Versioning (semver):
- **Major (X.0.0):** Breaking changes
- **Minor (1.X.0):** New features, backward compatible
- **Patch (1.0.X):** Bug fixes

### Release Cycle

1. **Development:** Feature branch
2. **Testing:** Test thoroughly in Extension Development Host
3. **Pre-release:** Publish pre-release for early adopters
4. **Stable release:** Publish stable version
5. **Monitor:** Watch for issues, publish patches if needed

### Documentation

- Keep README.md current
- Maintain detailed CHANGELOG.md
- Include screenshots/GIFs
- Document all configuration options
- Provide troubleshooting guide

### Quality Checks

Before each release:
- [ ] All tests pass
- [ ] No linting errors
- [ ] Extension activates correctly
- [ ] All features work as expected
- [ ] Performance is acceptable
- [ ] Documentation is updated
- [ ] Version number incremented
- [ ] CHANGELOG updated

## Quick Reference

```bash
# Package extension
cd vscode-extension
vsce package

# Publish to marketplace
vsce publish minor

# Create GitHub release
git tag v1.2.0
git push origin v1.2.0
gh release create v1.2.0 pychivalry-1.2.0.vsix

# Install locally
code --install-extension pychivalry-1.2.0.vsix

# Verify contents
unzip -l pychivalry-1.2.0.vsix
```

## Resources

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Marketplace](https://marketplace.visualstudio.com/)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
- [Semantic Versioning](https://semver.org/)
