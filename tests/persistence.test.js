const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const saveSystemPath = path.join(repoRoot, 'core', 'saveSystem.js');
const fixtureManifestPath = path.join(repoRoot, 'tests', 'fixtures', 'persistence', 'fixture-manifest.json');

function buildStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function loadSaveSystemForTests() {
  const code = fs.readFileSync(saveSystemPath, 'utf8');
  const sandbox = {
    console,
    JSON,
    Date,
    window: {},
    globalThis: {},
    module: { exports: {} },
    exports: {},
    localStorage: buildStorageMock()
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.globalThis.localStorage = sandbox.localStorage;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'saveSystem.js' });
  return sandbox.window.GeoCommandSaveSystem || sandbox.module.exports;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixturePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function classifyResult(result) {
  if (!result.ok) return 'invalid_and_rejected';
  const skipped = result.report?.normalize?.skippedTasks?.length || 0;
  return skipped > 0 ? 'valid_with_normalization' : 'valid_and_restored';
}

function run() {
  const saveSystem = loadSaveSystemForTests();
  const manifest = readJson(fixtureManifestPath);

  const output = [];

  for (const validFixture of manifest.valid) {
    const snapshot = readJson(fixturePath(validFixture.path));
    const prepared = saveSystem.prepareSnapshotForRestore(snapshot);
    assert.strictEqual(prepared.ok, true, `${validFixture.name} should pass prepare pipeline`);
    assert.strictEqual(prepared.report.validate.ok, true, `${validFixture.name} should validate`);

    const classification = classifyResult(prepared);
    output.push({ fixture: validFixture.name, classification, phase: 'valid' });

    // Scenario metadata round-trip
    const saved = saveSystem.saveSnapshot({
      slotId: snapshot.meta.slotId,
      slotName: snapshot.meta.slotName,
      snapshot
    });
    assert.strictEqual(saved.ok, true, `${validFixture.name} should save`);
    const loaded = saveSystem.loadSnapshot(snapshot.meta.slotId);
    assert.strictEqual(loaded.ok, true, `${validFixture.name} should load`);
    assert.strictEqual(
      loaded.snapshot.state.scenario?.id,
      snapshot.state.scenario?.id,
      `${validFixture.name} scenario id should round-trip`
    );
  }

  for (const invalidFixture of manifest.invalid) {
    const snapshot = readJson(fixturePath(invalidFixture.path));
    const prepared = saveSystem.prepareSnapshotForRestore(snapshot);
    assert.strictEqual(prepared.ok, false, `${invalidFixture.name} should fail prepare pipeline`);
    output.push({
      fixture: invalidFixture.name,
      classification: 'invalid_and_rejected',
      phase: prepared.phase || 'unknown',
      message: prepared.message
    });
  }

  const malformedTaskFixture = readJson(fixturePath('tests/fixtures/persistence/v1/high_tension_session_v1.json'));
  const normalized = saveSystem.normalizeSnapshot(malformedTaskFixture);
  assert.strictEqual(normalized.ok, true, 'high_tension_session_v1 normalize should succeed');
  assert.strictEqual(normalized.report.skippedTasks.length, 0, 'high_tension_session_v1 should not skip tasks during normalization');

  console.log('Persistence fixture regression summary:');
  output.forEach((line) => {
    console.log(`- ${line.fixture}: ${line.classification}${line.phase ? ` (${line.phase})` : ''}`);
  });
}

run();
