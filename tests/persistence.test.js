const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createLocalStorageMock() {
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

function setupContext() {
  const context = {
    console,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    window: {},
    localStorage: createLocalStorageMock()
  };
  context.window = context;
  vm.createContext(context);

  const saveSystemCode = fs.readFileSync(path.join(__dirname, '..', 'core', 'saveSystem.js'), 'utf8');
  const runtimeGuardsCode = fs.readFileSync(path.join(__dirname, '..', 'core', 'saveRuntimeGuards.js'), 'utf8');
  vm.runInContext(saveSystemCode, context);
  vm.runInContext(runtimeGuardsCode, context);
  return context;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createSnapshot({ slotId = 'slot1', slotName = 'Manual Slot 1', scenario = 'Modern Baseline' } = {}) {
  return {
    meta: {
      version: 1,
      slotId,
      slotName,
      country: 'United States of America',
      inGameDate: '2026-04-02 12:00',
      scenario,
      mode: 'standard',
      updatedAt: '2026-04-02T12:00:00.000Z'
    },
    scheduler: { nextTaskId: 5 },
    state: {
      selectedPlayerCountryName: 'United States of America',
      selectedCountryForHud: 'United States of America',
      currentTimeMs: 1,
      simulationSpeed: 1,
      pendingTasks: [{ id: 1, executeAt: 100, type: 'KNOWN', payload: {} }],
      countries: {},
      bases: [],
      units: [],
      cities: [],
      diplomacy: {},
      economy: {},
      trade: {},
      events: {},
      migration: { nextFlowId: 1 },
      leadership: {},
      internalResistance: {},
      localInstability: { nextHotspotId: 1 },
      influence: { nextOperationId: 1 },
      proxyConflict: { nextOperationId: 1 },
      blocs: { nextBlocId: 1 },
      negotiation: { nextAgreementId: 0 },
      nextCounters: {
        negotiationAgreement: 0,
        influenceOperation: 1,
        proxyOperation: 1,
        migrationFlow: 1,
        hotspot: 1,
        bloc: 1,
        schedulerTask: 5,
        eventId: 1
      }
    }
  };
}

(function run() {
  const ctx = setupContext();
  const save = ctx.GeoCommandSaveSystem;
  const guards = ctx.GeoCommandSaveRuntimeGuards;

  const snapshot = createSnapshot();
  const saveResult = save.saveSnapshot({ slotId: 'slot1', slotName: 'Campaign A', snapshot });
  assert(saveResult.ok, 'snapshot save should succeed');

  const loaded = save.loadSnapshot('slot1');
  assert(loaded.ok, 'snapshot load should succeed');
  assert(loaded.snapshot.meta.version === 1, 'migration passthrough should keep v1');
  assert(loaded.metadata.slotName === 'Campaign A', 'metadata label should persist');

  const renameResult = save.renameManualSlot('slot1', 'Renamed Slot');
  assert(renameResult.ok, 'rename should succeed');
  assert(renameResult.metadata.slotName === 'Renamed Slot', 'rename should update metadata');

  const manifest = save.getManifestView();
  const slot1Meta = manifest.slots.find((entry) => entry.slotId === 'slot1').metadata;
  assert(slot1Meta.slotName === 'Renamed Slot', 'manifest should show renamed slot');

  const deleteResult = save.deleteManualSlot('slot1');
  assert(deleteResult.ok, 'delete should succeed');
  assert(!save.hasSlotData('slot1'), 'slot should be deleted');

  const corrupted = createSnapshot();
  corrupted.meta.version = 99;
  save.saveSnapshot({ slotId: 'slot2', slotName: 'Corrupt', snapshot: corrupted });
  const corruptedLoad = save.loadSnapshot('slot2');
  assert(!corruptedLoad.ok, 'corrupted snapshot should be rejected');

  const migrated = save.migrateSnapshot(createSnapshot());
  assert(migrated.ok && migrated.snapshot.meta.version === 1, 'migrateSnapshot supports v1');

  const taskGuard = guards.sanitizeScheduledTasks([
    { id: 3, executeAt: 500, type: 'KNOWN', payload: null },
    { id: 1, executeAt: 500, type: 'KNOWN', payload: {} },
    { id: 2, executeAt: 'x', type: 'KNOWN', payload: {} },
    { id: 4, executeAt: 400, type: 'UNKNOWN', payload: {} }
  ], { KNOWN: true });

  assert(taskGuard.tasks.length === 2, 'valid known tasks should remain');
  assert(taskGuard.tasks[0].id === 1 && taskGuard.tasks[1].id === 3, 'tasks should be deterministically sorted');
  assert(taskGuard.report.skippedInvalid === 1, 'invalid tasks should be counted');
  assert(taskGuard.report.skippedUnknown === 1, 'unknown tasks should be counted');

  const scenarioSnapshot = createSnapshot({ slotId: 'slot3', slotName: 'Scenario Test', scenario: 'Cold War Crackline' });
  save.saveSnapshot({ slotId: 'slot3', slotName: 'Scenario Test', snapshot: scenarioSnapshot });
  const scenarioLoaded = save.loadSnapshot('slot3');
  assert(scenarioLoaded.ok && scenarioLoaded.metadata.scenario === 'Cold War Crackline', 'scenario metadata should persist');

  console.log('Persistence harness passed.');
})();
