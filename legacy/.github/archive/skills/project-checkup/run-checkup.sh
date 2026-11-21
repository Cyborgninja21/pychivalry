#!/usr/bin/env bash
# Project Checkup Script
# Auto-detects project stack and runs available health checks.
# Outputs structured results for each check category.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
SKIP=0

section() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

result() {
  local status="$1"
  local check="$2"
  local detail="${3:-}"
  case "$status" in
    PASS) PASS=$((PASS + 1)); echo "[PASS] $check" ;;
    FAIL) FAIL=$((FAIL + 1)); echo "[FAIL] $check"; [ -n "$detail" ] && echo "       $detail" ;;
    SKIP) SKIP=$((SKIP + 1)); echo "[SKIP] $check — not available" ;;
  esac
}

# --- Stack Detection ---
section "Stack Detection"

[ -f "package.json" ]     && echo "  Found: package.json (Node.js)"
[ -f "pyproject.toml" ]   && echo "  Found: pyproject.toml (Python)"
[ -f "go.mod" ]           && echo "  Found: go.mod (Go)"
[ -f "Cargo.toml" ]       && echo "  Found: Cargo.toml (Rust)"
[ -f "Gemfile" ]          && echo "  Found: Gemfile (Ruby)"
[ -f "Taskfile.yml" ]     && echo "  Found: Taskfile.yml (Task runner)"
[ -f "Makefile" ]         && echo "  Found: Makefile (Make)"
[ -f "docker-compose.yml" ] || [ -f "compose.yml" ] && echo "  Found: Docker Compose"
[ -d "ansible" ]          && echo "  Found: Ansible"

# --- Linting ---
section "Linting"

if command -v task &>/dev/null && grep -q "lint" Taskfile.yml 2>/dev/null; then
  if task lint 2>&1; then
    result PASS "task lint"
  else
    result FAIL "task lint"
  fi
elif [ -f "package.json" ] && grep -q '"lint"' package.json; then
  if npm run lint 2>&1; then
    result PASS "npm run lint"
  else
    result FAIL "npm run lint"
  fi
elif command -v ruff &>/dev/null && [ -f "pyproject.toml" ]; then
  if ruff check . 2>&1; then
    result PASS "ruff check"
  else
    result FAIL "ruff check"
  fi
else
  result SKIP "linting"
fi

# --- Formatting ---
section "Formatting"

if command -v task &>/dev/null && grep -q "fmt" Taskfile.yml 2>/dev/null; then
  if task fmt -- --check 2>&1; then
    result PASS "task fmt --check"
  else
    result FAIL "task fmt --check"
  fi
elif [ -f "package.json" ] && grep -q '"format"' package.json; then
  if npm run format -- --check 2>&1; then
    result PASS "npm run format --check"
  else
    result FAIL "npm run format --check"
  fi
else
  result SKIP "formatting"
fi

# --- Tests ---
section "Tests"

if command -v task &>/dev/null && grep -q "test" Taskfile.yml 2>/dev/null; then
  if task test 2>&1; then
    result PASS "task test"
  else
    result FAIL "task test"
  fi
elif [ -f "package.json" ] && grep -q '"test"' package.json; then
  if npm test 2>&1; then
    result PASS "npm test"
  else
    result FAIL "npm test"
  fi
elif command -v pytest &>/dev/null; then
  if pytest 2>&1; then
    result PASS "pytest"
  else
    result FAIL "pytest"
  fi
elif command -v go &>/dev/null && [ -f "go.mod" ]; then
  if go test ./... 2>&1; then
    result PASS "go test"
  else
    result FAIL "go test"
  fi
else
  result SKIP "tests"
fi

# --- Security / Dependency Audit ---
section "Security & Dependency Audit"

if command -v npm &>/dev/null && [ -f "package-lock.json" ]; then
  if npm audit --audit-level=high 2>&1; then
    result PASS "npm audit"
  else
    result FAIL "npm audit"
  fi
elif command -v pip-audit &>/dev/null; then
  if pip-audit 2>&1; then
    result PASS "pip-audit"
  else
    result FAIL "pip-audit"
  fi
else
  result SKIP "dependency audit"
fi

if command -v gitleaks &>/dev/null; then
  if gitleaks detect --source . --no-banner 2>&1; then
    result PASS "gitleaks (secret scanning)"
  else
    result FAIL "gitleaks (secret scanning)"
  fi
else
  result SKIP "secret scanning (gitleaks not installed)"
fi

# --- IaC Validation ---
section "Infrastructure as Code"

if command -v ansible-lint &>/dev/null && [ -d "ansible" ]; then
  if ansible-lint ansible/ 2>&1; then
    result PASS "ansible-lint"
  else
    result FAIL "ansible-lint"
  fi
else
  result SKIP "ansible-lint"
fi



# --- Summary ---
section "Summary"
TOTAL=$((PASS + FAIL + SKIP))
echo "  Total checks: $TOTAL"
echo "  Passed:       $PASS"
echo "  Failed:       $FAIL"
echo "  Skipped:      $SKIP"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  VERDICT: NEEDS_TREATMENT"
  exit 1
elif [ "$PASS" -eq 0 ]; then
  echo "  VERDICT: INCONCLUSIVE (no checks ran)"
  exit 0
else
  echo "  VERDICT: APPROVED"
  exit 0
fi
