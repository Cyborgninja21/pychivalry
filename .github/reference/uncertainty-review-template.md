# Uncertainty-Aware Issue Review Template

Use this template when you cannot prove a single root cause due to missing telemetry, non-determinism, or too many interacting factors.

## 1) What we can prove
**Verified facts**:
-

**Reproduction / evidence**:
- Steps attempted:
- Environments:
- Outputs/logs captured:

## 2) What we *suspect* (explicitly labeled)
**High-confidence inference** (supported by evidence, not fully proven):
-

**Hypotheses** (plausible, not proven):
-

For each hypothesis, include:
- Confidence: High | Med | Low
- Fastest disconfirming test:
- Missing telemetry that would make this provable:

## 3) System weaknesses that allow the behavior (improvement list)
List weaknesses in architecture, code structure, or process flow that make the system susceptible.

For each weakness, capture:
- Weakness:
- Why it enables the observed behavior (mechanism):
- Impact:
- Suggested hardening direction (not an implementation plan):
- How we would detect/confirm this weakness next time:

## 4) Observability gaps (telemetry needed)
Specify additional markers needed to isolate the issue next time.

For each telemetry item, capture:
- Signal type: log | metric | trace | event
- Location: component/module + key codepath
- Fields: correlation IDs, inputs/outputs (redacted), timings, retries, error class, state transitions
- Level: **normal** (always-on) vs **debug** (opt-in)
- Volume/sampling expectation:
- Privacy/PII notes:

Normal vs Debug quick criteria:
- **Normal**: always-on, low-volume, structured, actionable for triage/alerts, safe-by-default (no secrets/PII), stable fields.
- **Debug**: opt-in (flag/config), high-volume or high-cardinality, safe to disable, short windows; still respect privacy.

Minimum viable incident telemetry set (recommended default):
- Correlation IDs propagated across boundaries
- Key state transitions (start/success/fail)
- Dependency boundary signals (duration, retries/attempts, result)
- Error taxonomy (typed category/class) without leaking secrets

## 5) Fastest next steps to reduce uncertainty
Smallest set of investigations/experiments that most quickly collapse uncertainty.
-
