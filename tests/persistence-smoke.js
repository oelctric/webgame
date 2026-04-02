(function initPersistenceSmoke() {
  const FIXTURE_PATHS = [
    './fixtures/persistence/baseline_session_v1.json',
    './fixtures/persistence/high_tension_session_v1.json',
    './fixtures/persistence/economic_shock_session_v1.json',
    './fixtures/persistence/invalid/corrupt_missing_state_v1.json'
  ];

  let runtimeWindowPromise = null;

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to fetch ${path}: HTTP ${response.status}`);
    return response.json();
  }

  function classifyResult(phases) {
    if (!phases.migration.ok || !phases.normalization.ok || !phases.validation.ok || !phases.runtime.ok) {
      return 'fail';
    }
    const skippedNormalize = phases.normalization.skippedTaskCount || 0;
    const skippedRuntime = phases.scheduler.skippedTaskCount || 0;
    if (skippedNormalize > 0 || skippedRuntime > 0 || phases.runtime.warnings.length > 0) {
      return 'partial_pass';
    }
    return 'pass';
  }

  function getRuntimeWindow() {
    if (runtimeWindowPromise) return runtimeWindowPromise;
    runtimeWindowPromise = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.src = '../index.html?persistenceSmokeHarness=1';
      frame.style.position = 'absolute';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.left = '-9999px';
      frame.style.top = '-9999px';
      frame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(frame);

      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        reject(new Error('Timed out waiting for production runtime iframe.'));
      }, 45000);

      frame.addEventListener('load', () => {
        const poll = () => {
          if (timedOut) return;
          const runtime = frame.contentWindow?.GeoCommandRuntimeInstance;
          if (runtime?.restoreSnapshot) {
            window.clearTimeout(timeout);
            resolve(frame.contentWindow);
            return;
          }
          window.setTimeout(poll, 100);
        };
        poll();
      }, { once: true });
    });
    return runtimeWindowPromise;
  }

  function phaseFromProduction(result) {
    const compatibility = result.compatibility || {};
    const migrate = compatibility.migrate || null;
    const normalize = compatibility.normalize || null;
    const validate = compatibility.validate || null;
    const scheduler = result.schedulerRestore || null;

    return {
      migration: {
        ok: Boolean(migrate?.ok),
        message: migrate?.error || '',
        fromVersion: migrate?.fromVersion || null,
        toVersion: migrate?.toVersion || null
      },
      normalization: {
        ok: Boolean(normalize?.ok),
        message: normalize?.error || '',
        skippedTaskCount: Array.isArray(normalize?.skippedTasks) ? normalize.skippedTasks.length : 0
      },
      validation: {
        ok: Boolean(validate?.ok),
        message: validate?.error || ''
      },
      runtime: {
        ok: result.ok,
        message: result.ok ? '' : (result.message || 'Runtime restore failed.'),
        warnings: []
      },
      scheduler: {
        ok: result.ok,
        restoredCount: Number(scheduler?.restoredCount || 0),
        skippedTaskCount: Array.isArray(scheduler?.skippedTasks) ? scheduler.skippedTasks.length : 0
      },
      uiRefresh: {
        ok: Boolean(result.runtime?.uiRefresh?.ok ?? result.ok),
        message: result.runtime?.uiRefresh?.ok === false ? 'UI refresh did not complete.' : ''
      }
    };
  }

  async function runFixture(path, expectedById) {
    const runtimeWindow = await getRuntimeWindow();
    const fixture = await fetchJson(path);
    const fixtureId = fixture.id;
    const expected = expectedById[fixtureId];
    if (!expected) throw new Error(`No expected classification declared for fixture: ${fixtureId}`);

    const restored = runtimeWindow.GeoCommandRuntimeInstance.restoreSnapshot(fixture.snapshot, {
      sourceLabel: `smoke fixture ${fixtureId}`,
      suppressStatus: true
    });
    const phases = phaseFromProduction(restored);
    const actual = classifyResult(phases);

    return {
      fixture: fixtureId,
      expected,
      actual,
      matches: expected === actual,
      phases,
      error: expected === actual ? '' : `Expected ${expected} but got ${actual}`,
      restorePhase: restored.phase || null,
      restoreMessage: restored.message || ''
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
        <td>${row.phases.normalization.ok ? 'ok' : 'fail'}</td>
        <td>${row.phases.validation.ok ? 'ok' : 'fail'}</td>
        <td>${row.phases.runtime.ok ? 'ok' : 'fail'}</td>
        <td>${row.phases.scheduler.skippedTaskCount}</td>
        <td>${row.error || row.restoreMessage || row.phases.validation.message || row.phases.runtime.message || ''}</td>
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
