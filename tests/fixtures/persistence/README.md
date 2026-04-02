# Persistence Regression Fixtures

These fixtures are intentionally versioned and scenario-focused so save/load compatibility can be validated over time.

## Layout

- `v1/`: Golden fixtures expected to be valid for save schema version 1.
- `invalid/`: Intentionally broken fixtures expected to be rejected.
- `fixture-manifest.json`: Single source of truth used by Node tests and browser smoke harness.

## Fixture intent

- `baseline_session_v1`: Mid-session balanced state.
- `high_tension_session_v1`: Escalation scenario with a legacy runtime task type (expected runtime skip).
- `economic_shock_session_v1`: Economic/domestic stress scenario in sandbox mode.

When introducing a future save schema (`v2`, `v3`), add a new version folder and update `fixture-manifest.json`.
