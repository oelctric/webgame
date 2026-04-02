(function initPersistenceSmoke() {
  const FIXTURE_PATHS = [
    './fixtures/persistence/baseline_session_v1.json',
    './fixtures/persistence/high_tension_session_v1.json',
    './fixtures/persistence/economic_shock_session_v1.json',
    './fixtures/persistence/invalid/corrupt_missing_state_v1.json'
  ];

  const KNOWN_RUNTIME_TASKS = new Set([
    'BASE_ACTIVATE', 'UNIT_MOVE_COMPLETE', 'UNIT_PRODUCTION_COMPLETE', 'COMBAT_TICK', 'CAPTURE_COMPLETE',
    'RESOURCE_TICK', 'FACTION_TICK', 'CHOKEPOINT_TICK', 'EVENT_TICK', 'LOCAL_INSTABILITY_TICK',
    'INFLUENCE_TICK', 'INTERNAL_RESISTANCE_TICK', 'DIPLOMACY_TICK', 'STATE_STRUCTURE_TICK', 'ECONOMY_TICK',
    'NEGOTIATION_TICK', 'DOMESTIC_TICK', 'POLITICAL_TICK', 'TRADE_TICK', 'LEADERSHIP_TICK', 'COUNTRY_TICK',
    'INFORMATION_TICK', 'POLICY_TICK', 'AI_TICK', 'AI_STRATEGIC_TICK', 'MIGRATION_TICK', 'BLOC_TICK',
    'PROXY_CONFLICT_TICK'
  ]);

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to fetch ${path}: HTTP ${response.status}`);
    return response.json();
  }

  function classifyResult(phases) {
    if (!phases.validation.ok || !phases.runtime.ok) return 'fail';
    if (phases.runtime.skippedTaskCount > 0 || phases.runtime.warnings.length > 0) return 'partial_pass';
    return 'pass';
  }

  function runMigration(snapshot) {
    return { ok: true, migratedVersion: Number(snapshot?.meta?.version || 1), message: '' };
  }

  function runValidation(snapshot) {
    if (!snapshot?.state) return { ok: false, message: 'Snapshot missing state payload.' };
    if (!snapshot.state.selectedPlayerCountryName) return { ok: false, message: 'Missing selectedPlayerCountryName.' };
    return { ok: true, message: '' };
  }

  function runRuntime(snapshot) {
    const pendingTasks = Array.isArray(snapshot?.state?.pendingTasks) ? snapshot.state.pendingTasks : [];
    const unknownTasks = pendingTasks.filter((task) => !KNOWN_RUNTIME_TASKS.has(task?.type));
    const warnings = [];
    if (!Array.isArray(snapshot?.state?.bases)) warnings.push('bases missing/invalid');
    if (!Array.isArray(snapshot?.state?.units)) warnings.push('units missing/invalid');
    return {
      ok: unknownTasks.length === 0,
      message: unknownTasks.length ? `Unknown runtime task types: ${unknownTasks.map((t) => t.type).join(', ')}` : '',
      skippedTaskCount: unknownTasks.length,
      warnings
    };
  }

  async function runFixture(path, expectedById) {
    const fixture = await fetchJson(path);
    const fixtureId = fixture.id;
    const expected = expectedById[fixtureId];
    if (!expected) throw new Error(`No expected classification declared for fixture: ${fixtureId}`);

    const migration = runMigration(fixture.snapshot);
    const validation = runValidation(fixture.snapshot);
    const runtime = validation.ok ? runRuntime(fixture.snapshot) : { ok: false, message: 'Runtime skipped: validation failed.', skippedTaskCount: 0, warnings: [] };
    const actual = classifyResult({ migration, validation, runtime });

    return {
      fixture: fixtureId,
      expected,
      actual,
      matches: expected === actual,
      phases: {
        migration,
        validation,
        runtime
      },
      error: expected === actual ? '' : `Expected ${expected} but got ${actual}`
    };
  }

  function renderResults(results) {
    const body = document.getElementById('resultsBody');
    const summary = document.getElementById('summary');
    const jsonOutput = document.getElementById('jsonOutput');
    if (!body || !summary || !jsonOutput) return;

    body.innerHTML = '';
    for (const row of results) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.fixture}</td>
        <td>${row.expected}</td>
        <td class="${row.actual}">${row.actual}</td>
        <td>${row.phases.migration.ok ? 'ok' : 'fail'}</td>
        <td>${row.phases.validation.ok ? 'ok' : 'fail'}</td>
        <td>${row.phases.runtime.ok ? 'ok' : 'fail'}</td>
        <td>${row.phases.runtime.skippedTaskCount}</td>
        <td>${row.error || row.phases.validation.message || row.phases.runtime.message || ''}</td>
      `;
      body.appendChild(tr);
    }

    const mismatches = results.filter((r) => !r.matches);
    summary.textContent = mismatches.length === 0
      ? `PASS: ${results.length}/${results.length} fixtures matched expected classifications.`
      : `FAIL: ${mismatches.length} mismatch(es) out of ${results.length} fixtures.`;

    const payload = {
      generatedAt: new Date().toISOString(),
      total: results.length,
      mismatches: mismatches.length,
      results
    };
    jsonOutput.textContent = JSON.stringify(payload, null, 2);
    window.__PERSISTENCE_SMOKE_RESULTS = payload;
    window.__PERSISTENCE_SMOKE_DONE = true;
    console.log('PERSISTENCE_SMOKE_JSON:' + JSON.stringify(payload));
  }

  async function runAll() {
    const expectedById = await fetchJson('./fixtures/persistence/expectations.json');
    const rows = [];
    for (const path of FIXTURE_PATHS) {
      rows.push(await runFixture(path, expectedById));
    }
    renderResults(rows);
    return window.__PERSISTENCE_SMOKE_RESULTS;
  }

  window.runPersistenceSmoke = runAll;

  document.getElementById('runBtn')?.addEventListener('click', () => {
    runAll().catch((error) => {
      console.error('Persistence smoke failed:', error);
      window.__PERSISTENCE_SMOKE_RESULTS = { error: String(error) };
      window.__PERSISTENCE_SMOKE_DONE = true;
    });
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('autorun') === '1' || params.get('ci') === '1') {
    runAll().catch((error) => {
      console.error('Persistence smoke failed:', error);
      window.__PERSISTENCE_SMOKE_RESULTS = { error: String(error) };
      window.__PERSISTENCE_SMOKE_DONE = true;
    });
  }
})();
