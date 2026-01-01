# Release Checklist for pychivalry v1.0.0

This document provides step-by-step instructions for completing the v1.0.0 release.

## ✅ Pre-Release (Completed)

All preparation work is complete:

- ✅ Version bumped to 1.0.0 in all files
- ✅ CHANGELOG.md updated with comprehensive release notes
- ✅ SECURITY.md created with vulnerability reporting process
- ✅ RELEASE_NOTES.md created with detailed feature list
- ✅ INSTALL.md created with installation and troubleshooting guide
- ✅ README.md updated to reflect v1.0.0
- ✅ Development status changed from "Alpha" to "Production/Stable"
- ✅ Code formatted with Black (63 files)
- ✅ All 1,142 tests passing
- ✅ Code review completed (no issues)
- ✅ Security scan completed (false positives only)
- ✅ Python package built and verified (163KB .whl, 230KB .tar.gz)
- ✅ VS Code extension packaged (405KB .vsix)

## 📋 Release Process

### Step 1: Merge to Main Branch

```bash
# After PR is approved, merge to main
git checkout main
git pull origin main
git merge copilot/prepare-for-1-0-release
git push origin main
```

### Step 2: Create Git Tag

```bash
# Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push the tag
git push origin v1.0.0
```

### Step 3: Create GitHub Release

1. Go to: https://github.com/Cyborgninja21/pychivalry/releases/new
2. Tag: Select `v1.0.0`
3. Release title: `pychivalry v1.0.0 - First Stable Release`
4. Description: Copy content from `RELEASE_NOTES.md`
5. Attachments: Upload these files from `dist/` and `vscode-extension/`:
   - `pychivalry-1.0.0.tar.gz`
   - `pychivalry-1.0.0-py3-none-any.whl`
   - `ck3-language-support-1.0.0.vsix`
6. Check: ✅ "Set as the latest release"
7. Click: "Publish release"

### Step 4 (Optional): Publish to PyPI

If you want to publish to PyPI for easy `pip install`:

```bash
# Install twine if not already installed
pip install twine

# Build the package (already done, but can rebuild)
python -m build

# Check the package
twine check dist/pychivalry-1.0.0*

# Upload to TestPyPI first (recommended)
twine upload --repository testpypi dist/pychivalry-1.0.0*

# Test installation from TestPyPI
pip install --index-url https://test.pypi.org/simple/ pychivalry

# If all looks good, upload to real PyPI
twine upload dist/pychivalry-1.0.0*
```

After publishing to PyPI, users can install with:
```bash
pip install pychivalry
```

### Step 5 (Optional): Publish VS Code Extension

To publish to VS Code Marketplace:

```bash
cd vscode-extension

# Create publisher account first:
# https://marketplace.visualstudio.com/manage

# Get Personal Access Token (PAT) from Azure DevOps:
# https://dev.azure.com/[your-org]/_usersSettings/tokens

# Login with your PAT
vsce login cyborgninja21

# Publish the extension
vsce publish

# Or publish a specific version
vsce publish --packagePath ./ck3-language-support-1.0.0.vsix
```

After publishing, users can install from VS Code:
1. Open Extensions (Ctrl+Shift+X)
2. Search "Crusader Kings 3 Language Support"
3. Click "Install"

## 📢 Post-Release

### Announce the Release

Share the news on:

1. **GitHub Discussions** (if enabled)
   - Create announcement post
   - Link to release notes

2. **Reddit**
   - r/CrusaderKings
   - r/paradoxplaza
   - Title: "Released v1.0.0 of pychivalry - A Language Server for CK3 Modding"

3. **Paradox Forums**
   - CK3 Modding Forum
   - Post release announcement with features

4. **Discord** (if applicable)
   - CK3 modding communities
   - Share release highlights

### Update Documentation

If you have external documentation or wiki:
- Update version numbers
- Add v1.0.0 to compatibility matrix
- Update installation instructions

### Monitor Issues

After release:
- Watch for bug reports
- Address critical issues quickly
- Plan for v1.0.1 if needed for hotfixes

## 🔄 Future Releases

### Version Numbering

Following Semantic Versioning (semver.org):

- **Patch (1.0.x)**: Bug fixes, no new features
- **Minor (1.x.0)**: New features, backward compatible
- **Major (x.0.0)**: Breaking changes

### Planning v1.1.0

Consider these features for next release:
- Semantic tokens (enhanced syntax highlighting)
- Workspace-wide validation
- Additional CK3 language constructs
- Performance improvements
- Community-requested features

## 📊 Success Metrics

Track these metrics after release:

- Downloads from PyPI (if published)
- VS Code extension installs (if published)
- GitHub stars and forks
- Issue reports and PRs
- Community feedback

## 🆘 Rollback Plan

If critical issues are found:

```bash
# Revert the tag
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Unpublish from PyPI (if needed)
# Contact PyPI support - they can yank releases

# Unpublish from VS Code Marketplace
vsce unpublish cyborgninja21.ck3-language-support

# Create hotfix branch
git checkout -b hotfix/v1.0.1
# Fix issues, then release v1.0.1
```

## 📝 Notes

- All release artifacts are in:
  - Python: `dist/`
  - VS Code: `vscode-extension/ck3-language-support-1.0.0.vsix`

- Build artifacts are ignored by `.gitignore`:
  - `dist/` directory
  - `*.vsix` files
  - `build/` directory

- LICENSE is Apache 2.0 and properly included in all packages

## ✨ Congratulations!

You're ready to release pychivalry v1.0.0! This is a significant milestone for the CK3 modding community.

---

**Questions?** Review these documents:
- [RELEASE_NOTES.md](RELEASE_NOTES.md) - What to tell users
- [INSTALL.md](INSTALL.md) - How users install
- [CHANGELOG.md](CHANGELOG.md) - Full version history
- [CONTRIBUTING.md](CONTRIBUTING.md) - How others can contribute
