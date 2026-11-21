# Security Language-Specific Vulnerability Reference

Purpose: This document centralizes language- and framework-specific vulnerability patterns the Security agent may reference during **Phase 2: Code Security Review**. It is intentionally kept separate from the main agent spec for easier maintenance.

When using this reference, always prioritize **current, authoritative sources** (OWASP, vendor security guides) when deeper details are needed.

---

## JavaScript / TypeScript

- Insecure `eval`, `Function` constructor, or dynamic code generation.
- Unsanitized user input reaching DOM sinks (XSS): `innerHTML`, `outerHTML`, `document.write`, `dangerouslySetInnerHTML`, template literals interpolated into HTML.
- Direct SQL or NoSQL queries built via string concatenation (SQLi/NoSQLi).
- Insecure use of `localStorage`/`sessionStorage`/`IndexedDB` for sensitive data.
- Missing or weak CSRF protections on state-changing requests.
- Insecure JWT handling (no expiry, weak signing algorithms, missing verification).
- Leaking secrets in front-end bundles or config.
- In Node.js: unsafe filesystem access, command injection in `child_process` calls, insecure deserialization.

## Python

- `eval`, `exec`, `pickle`/`cPickle` on untrusted data.
- SQL queries constructed via string concatenation or f-strings.
- Unsafe deserialization with `yaml.load` without `SafeLoader`.
- Insecure use of `subprocess` with `shell=True` or unquoted user input.
- Hard-coded credentials in settings, modules, or scripts.
- Web frameworks:
  - Django/Flask/FastAPI: missing CSRF protections, missing authentication/authorization checks, improperly configured CORS, unsafe template usage.

## Java / Kotlin

- JDBC queries built via string concatenation (missing prepared statements).
- Unsafe deserialization with `ObjectInputStream` or legacy serialization mechanisms.
- Insecure use of reflection to access or modify security-sensitive fields.
- Hard-coded secrets in source or configuration files.
- Misconfigured Spring Security (e.g., overly permissive `permitAll`, missing method-level security where appropriate).

## Go

- SQL queries built via string concatenation instead of parameterized queries.
- Command injection via `os/exec` with untrusted input.
- Insecure TLS configurations (skipping verification, accepting any certificate).
- Inadequate error handling that leaks sensitive information.

## Rust

- Misuse of `unsafe` blocks without clear justification or bounds.
- FFI boundaries that do not validate input from external code.
- Logic errors around ownership/lifetimes that may cause security-relevant bugs.

## C / C++

- Classic memory-unsafe patterns: buffer overflows, use-after-free, double free.
- Unsafe string handling (`strcpy`, `strcat`, `gets`, etc.).
- Integer overflows/underflows in security-critical calculations.
- Insecure randomness (use of `rand()` for cryptographic purposes).

---

## Maintenance Notes

- Treat this file as a **living reference**. Update it periodically in response to:
  - Changes in major frameworks and best practices.
  - New OWASP Top 10 releases or language-specific cheat sheets.
  - Findings from real reviews that reveal recurring pitfalls.
- **Review cadence**: At minimum, revisit this file during each Retrospective cycle or when a major security incident exposes a gap. The ProcessImprovement or Security agent should own periodic synchronization with OWASP Cheat Sheets and vendor security guides.
- When updating, keep entries **high-level and pattern-focused**. For deep details (e.g., specific APIs), link or defer to external documentation instead of duplicating it here.
