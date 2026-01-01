# Security Policy

## Supported Versions

We actively support the following versions of pychivalry with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of pychivalry seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

1. **Do NOT** open a public issue for security vulnerabilities
2. Email the maintainer directly at the email listed in the repository
3. Include the following information:
   - Type of vulnerability
   - Full paths of source file(s) related to the vulnerability
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the vulnerability

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Investigation**: We will investigate the issue and determine its severity and impact
- **Updates**: We will keep you informed of our progress
- **Fix**: If confirmed, we will work on a fix and release a security update
- **Credit**: We will credit you for the discovery (unless you prefer to remain anonymous)

### Security Update Process

1. Vulnerability is confirmed and severity assessed
2. A fix is developed and tested
3. Security advisory is prepared
4. Fix is released with security advisory
5. Users are notified of the update

## Security Best Practices

When using pychivalry:

1. **Keep Updated**: Always use the latest stable version
2. **Review Dependencies**: Check `pyproject.toml` for dependency security advisories
3. **Secure Configuration**: Follow security best practices in your VS Code settings
4. **File Permissions**: Ensure proper file permissions on mod directories
5. **Untrusted Input**: Be cautious when opening mod files from untrusted sources

## Known Security Considerations

- **File System Access**: The language server has read access to your mod directories
- **Python Execution**: The server runs Python code with your user's permissions
- **VS Code Extension**: The extension communicates with the Python server via stdio

## Scope

This security policy applies to:

- The pychivalry Python package
- The VS Code extension (ck3-language-support)
- Official documentation and examples

It does not cover:

- Third-party dependencies (report to their respective projects)
- Vulnerabilities in VS Code itself
- Issues in the CK3 game engine

## Questions?

If you have questions about this security policy, please open a general issue (not for vulnerabilities) or reach out to the maintainers.

Thank you for helping keep pychivalry secure!
