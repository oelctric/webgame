const manifestPath = './fixtures/persistence/fixture-manifest.json';

const runtimeFrame = document.getElementById('runtimeFrame');
const runtimeStatus = document.getElementById('runtimeStatus');
const output = document.getElementById('output');
const fixtureList = document.getElementById('fixtureList');
const bootRuntimeBtn = document.getElementById('bootRuntimeBtn');
const runAllBtn = document.getElementById('runAllBtn');

let manifest = null;

function fmt(value) {
  return JSON.stringify(value, null, 2);
}

async function fetchFixtureManifest() {
  const response = await fetch(manifestPath);
  if (!response.ok) {
    throw new Error(`Failed fetching fixture manifest: ${response.status}`);
  }
  return response.json();
}

async function fetchFixture(path) {
  const response = await fetch(`../${path}`);
  if (!response.ok) {
    throw new Error(`Failed fetching fixture ${path}: ${response.status}`);
  }
  return response.json();
}

async function waitForRuntime(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const frameWindow = runtimeFrame.contentWindow;
    const runtime = frameWindow?.GeoCommandRuntimeInstance;
    if (runtime?.runPersistenceSmokeRestore && frameWindow.GeoCommandSaveSystem?.prepareSnapshotForRestore) {
      runtimeStatus.textContent = 'Runtime: ready.';
      return runtime;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Runtime did not initialize in time.');
}

function summarizeRestoreResult(name, report) {
  const skippedFromNormalize = report.compatibility?.normalize?.skippedTasks?.length || 0;
  const skippedFromRuntime = report.schedulerRestore?.skippedTasks?.length || 0;
  const totalSkipped = skippedFromNormalize + skippedFromRuntime;
  if (!report.ok) {
    return { level: 'fail', label: 'invalid and rejected', totalSkipped };
  }
  if (totalSkipped > 0) {
    return { level: 'partial', label: 'valid with skips/default normalization', totalSkipped };
  }
  return { level: 'pass', label: 'valid and restored successfully', totalSkipped };
}

function renderResultLine(name, status) {
  const cssClass = status.level === 'pass' ? 'result-pass' : status.level === 'partial' ? 'result-partial' : 'result-fail';
  return `<div class="${cssClass}">${name}: ${status.label}</div>`;
}

async function runFixtureSmokeTest(entry, expectedInvalid = false) {
  const runtime = await waitForRuntime();
  const fixture = await fetchFixture(entry.path);
  const run = runtime.runPersistenceSmokeRestore(fixture, entry.name);
  const status = summarizeRestoreResult(entry.name, run);

  const payload = {
    fixtureName: entry.name,
    expectation: expectedInvalid ? 'invalid fixture should be rejected' : 'valid fixture should restore',
    classification: status.label,
    loadValidationResult: run.compatibility?.validate?.ok ?? false,
    migrationResult: run.compatibility?.migrate || null,
    schedulerRestoreResult: run.schedulerRestore || null,
    selectedPlayerCountryRestored: run.runtime?.playerCountry || null,
    gameTimeRestored: run.runtime?.gameTimeMs || null,
    scenarioRestored: run.runtime?.scenario || null,
    skippedTasks: {
      normalize: run.compatibility?.normalize?.skippedTasks || [],
      runtime: run.schedulerRestore?.skippedTasks || []
    },
    error: run.ok ? null : (run.message || 'Unknown restore error.')
  };

  if (expectedInvalid && run.ok) {
    payload.classification = 'invalid fixture unexpectedly restored';
    payload.error = 'Expected rejection but fixture restored successfully.';
  }

  return { payload, status, expectedInvalid, ok: run.ok };
}

function setOutput(lines, details) {
  output.innerHTML = `${lines.join('\n')}\n\n${fmt(details)}`;
}

async function runAllFixtures() {
  try {
    const lines = [];
    const details = [];
    for (const entry of manifest.valid) {
      const result = await runFixtureSmokeTest(entry, false);
      lines.push(renderResultLine(entry.name, result.status));
      details.push(result.payload);
    }
    for (const entry of manifest.invalid) {
      const result = await runFixtureSmokeTest(entry, true);
      const invalidStatus = result.ok
        ? { level: 'fail', label: 'invalid and restored unexpectedly' }
        : { level: 'pass', label: 'invalid and rejected' };
      lines.push(renderResultLine(entry.name, invalidStatus));
      details.push(result.payload);
    }
    setOutput(lines, details);
  } catch (error) {
    setOutput([`<div class="result-fail">Smoke run failed: ${error.message}</div>`], { error: error.message });
  }
}

function renderFixtureList() {
  fixtureList.innerHTML = '';
  const sections = [
    { title: 'Valid fixtures', entries: manifest.valid, invalid: false },
    { title: 'Invalid fixtures', entries: manifest.invalid, invalid: true }
  ];

  sections.forEach((section) => {
    const title = document.createElement('h3');
    title.textContent = section.title;
    fixtureList.appendChild(title);

    section.entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'fixture-item';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${entry.name}</strong><br><small>${entry.intent}</small>`;
      const button = document.createElement('button');
      button.textContent = 'Run';
      button.addEventListener('click', async () => {
        try {
          const result = await runFixtureSmokeTest(entry, section.invalid);
          setOutput([renderResultLine(entry.name, result.status)], [result.payload]);
        } catch (error) {
          setOutput([`<div class="result-fail">Fixture run failed: ${error.message}</div>`], { error: error.message });
        }
      });
      row.append(left, button);
      fixtureList.appendChild(row);
    });
  });
}

bootRuntimeBtn.addEventListener('click', async () => {
  try {
    await waitForRuntime();
  } catch (error) {
    runtimeStatus.textContent = `Runtime: failed (${error.message})`;
  }
});

runAllBtn.addEventListener('click', runAllFixtures);

(async function initSmokeHarness() {
  manifest = await fetchFixtureManifest();
  renderFixtureList();
})();
