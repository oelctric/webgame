(function initGeoCommandSaveSystem() {
  const STORAGE_PREFIX = 'geoCommand.save.v1';
  const MANIFEST_KEY = `${STORAGE_PREFIX}.manifest`;
  const LATEST_SLOT = 'latest';
  const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'];
  const SUPPORTED_VERSIONS = [1];

  function safeNowIso() {
    return new Date().toISOString();
  }

  function getSlotKey(slotId) {
    return `${STORAGE_PREFIX}.slot.${slotId}`;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function safeInteger(value, fallback = 0, min = 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
  }

  function readManifest() {
    try {
      const raw = localStorage.getItem(MANIFEST_KEY);
      if (!raw) {
        return { latestSlotId: null, slots: {} };
      }
      const parsed = JSON.parse(raw);
      if (!validateManifestShape(parsed)) {
        return { latestSlotId: null, slots: {} };
      }
      return {
        latestSlotId: parsed.latestSlotId || null,
        slots: parsed.slots
      };
    } catch (error) {
      console.warn('Failed reading save manifest:', error);
      return { latestSlotId: null, slots: {} };
    }
  }

  function writeManifest(manifest) {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  }

  function validateManifestShape(manifest) {
    if (!manifest || typeof manifest !== 'object') return false;
    if (!manifest.slots || typeof manifest.slots !== 'object') return false;
    return Object.entries(manifest.slots).every(([slotId, metadata]) => validateSlotMetadata(slotId, metadata));
  }

  function validateSlotMetadata(slotId, metadata) {
    if (!metadata || typeof metadata !== 'object') return false;
    if (typeof metadata.slotId !== 'string' || metadata.slotId !== slotId) return false;
    if (typeof metadata.slotName !== 'string' || !metadata.slotName.trim()) return false;
    if (typeof metadata.version !== 'number' || !SUPPORTED_VERSIONS.includes(metadata.version)) return false;
    if (typeof metadata.country !== 'string') return false;
    if (typeof metadata.scenario !== 'string') return false;
    if (typeof metadata.mode !== 'string') return false;
    if (typeof metadata.updatedAt !== 'string') return false;
    if (metadata.inGameDate != null && typeof metadata.inGameDate !== 'string') return false;
    return true;
  }

  function getDefaultSlotName(slotId) {
    if (slotId === LATEST_SLOT) return 'Latest Session';
    if (!MANUAL_SLOTS.includes(slotId)) return slotId;
    return `Manual Slot ${slotId.slice(-1)}`;
  }

  function buildMetadata(slotId, slotName, snapshot) {
    return {
      slotId,
      slotName: (slotName || getDefaultSlotName(slotId)).trim(),
      isLatest: slotId === LATEST_SLOT,
      version: snapshot?.meta?.version || 1,
      country: snapshot?.meta?.country || 'Unknown',
      inGameDate: snapshot?.meta?.inGameDate || null,
      scenario: snapshot?.meta?.scenario || 'Unknown',
      mode: snapshot?.meta?.mode || 'standard',
      updatedAt: snapshot?.meta?.updatedAt || safeNowIso()
    };
  }

  function normalizeTopLevel(snapshot) {
    return {
      meta: snapshot?.meta && typeof snapshot.meta === 'object' ? snapshot.meta : {},
      scheduler: snapshot?.scheduler && typeof snapshot.scheduler === 'object' ? snapshot.scheduler : {},
      state: snapshot?.state && typeof snapshot.state === 'object' ? snapshot.state : {}
    };
  }

  function migrateSnapshot(snapshot) {
    const normalized = normalizeTopLevel(snapshot);
    const version = safeInteger(normalized.meta.version, 1, 1);
    if (version === 1) {
      normalized.meta.version = 1;
      return { ok: true, snapshot: normalized, migrations: ['v1 passthrough'] };
    }
    return {
      ok: false,
      message: `Unsupported save version ${normalized.meta.version}.`,
      errors: [`Unsupported version ${normalized.meta.version}`],
      migrations: []
    };
  }

  function normalizeSnapshot(snapshot) {
    const base = clone(snapshot) || {};
    const top = normalizeTopLevel(base);
    const state = top.state;

    state.currentTimeMs = Number.isFinite(Number(state.currentTimeMs)) ? Number(state.currentTimeMs) : Date.now();
    state.simulationSpeed = Number.isFinite(Number(state.simulationSpeed)) ? Number(state.simulationSpeed) : 1;
    state.pendingTasks = Array.isArray(state.pendingTasks) ? state.pendingTasks : [];
    state.countries = state.countries && typeof state.countries === 'object' ? state.countries : {};
    state.units = Array.isArray(state.units) ? state.units : [];
    state.bases = Array.isArray(state.bases) ? state.bases : [];
    state.cities = Array.isArray(state.cities) ? state.cities : [];

    state.diplomacy = state.diplomacy && typeof state.diplomacy === 'object' ? state.diplomacy : { relationsByPair: {}, lastSummary: 'No diplomacy events yet.' };
    state.economy = state.economy && typeof state.economy === 'object' ? state.economy : { treasuryByCountry: {}, started: false };
    state.trade = state.trade && typeof state.trade === 'object' ? state.trade : { flows: [], autoEnabled: true };
    state.events = state.events && typeof state.events === 'object' ? state.events : { active: [], recentLog: [] };
    state.migration = state.migration && typeof state.migration === 'object' ? state.migration : { flows: [], nextFlowId: 1 };
    state.leadership = state.leadership && typeof state.leadership === 'object' ? state.leadership : { lastTickAt: null, lastSummary: 'No leadership cycle updates yet.' };
    state.internalResistance = state.internalResistance && typeof state.internalResistance === 'object' ? state.internalResistance : { lastTickAt: null, lastSummary: 'No internal resistance updates yet.' };
    state.localInstability = state.localInstability && typeof state.localInstability === 'object' ? state.localInstability : { hotspotsById: {}, hotspotIdsByCountry: {}, nextHotspotId: 1 };
    state.negotiation = state.negotiation && typeof state.negotiation === 'object' ? state.negotiation : { ceasefiresByPair: {}, tradeRestorationByPair: {}, nextAgreementId: 0 };
    state.influence = state.influence && typeof state.influence === 'object' ? state.influence : { operations: [], nextOperationId: 1, cooldownsByKey: {} };
    state.proxyConflict = state.proxyConflict && typeof state.proxyConflict === 'object' ? state.proxyConflict : { operations: [], nextOperationId: 1, cooldownsByKey: {}, incidentLog: [] };
    state.blocs = state.blocs && typeof state.blocs === 'object' ? state.blocs : { items: [], nextBlocId: 1 };

    const counters = state.nextCounters && typeof state.nextCounters === 'object' ? state.nextCounters : {};
    state.nextCounters = {
      negotiationAgreement: safeInteger(counters.negotiationAgreement, safeInteger(state.negotiation.nextAgreementId, 0, 0), 0),
      influenceOperation: safeInteger(counters.influenceOperation, safeInteger(state.influence.nextOperationId, 1, 1), 1),
      proxyOperation: safeInteger(counters.proxyOperation, safeInteger(state.proxyConflict.nextOperationId, 1, 1), 1),
      migrationFlow: safeInteger(counters.migrationFlow, safeInteger(state.migration.nextFlowId, 1, 1), 1),
      hotspot: safeInteger(counters.hotspot, safeInteger(state.localInstability.nextHotspotId, 1, 1), 1),
      bloc: safeInteger(counters.bloc, safeInteger(state.blocs.nextBlocId, 1, 1), 1),
      schedulerTask: safeInteger(counters.schedulerTask, safeInteger(top.scheduler.nextTaskId, 1, 1), 1),
      eventId: safeInteger(counters.eventId, 1, 1)
    };

    top.scheduler.nextTaskId = safeInteger(top.scheduler.nextTaskId, state.nextCounters.schedulerTask, 1);
    top.state = state;
    return top;
  }

  function validateTaskQueueShape(taskList) {
    if (!Array.isArray(taskList)) return { ok: false, errors: ['Task queue must be an array.'] };
    const errors = [];
    taskList.forEach((task, index) => {
      if (!task || typeof task !== 'object') {
        errors.push(`Task #${index} must be an object.`);
        return;
      }
      if (!Number.isFinite(Number(task.id))) errors.push(`Task #${index} has invalid id.`);
      if (!Number.isFinite(Number(task.executeAt))) errors.push(`Task #${index} has invalid executeAt.`);
      if (typeof task.type !== 'string' || !task.type) errors.push(`Task #${index} has invalid type.`);
      if (task.payload != null && typeof task.payload !== 'object') errors.push(`Task #${index} payload must be object/null.`);
    });
    return { ok: errors.length === 0, errors };
  }

  function validateSnapshot(snapshot, metadata) {
    const errors = [];
    if (!snapshot || typeof snapshot !== 'object') errors.push('Snapshot root must be an object.');
    if (!snapshot?.meta || typeof snapshot.meta !== 'object') errors.push('Snapshot meta block is missing.');
    if (!snapshot?.state || typeof snapshot.state !== 'object') errors.push('Snapshot state block is missing.');
    if (!snapshot?.scheduler || typeof snapshot.scheduler !== 'object') errors.push('Snapshot scheduler block is missing.');

    const version = snapshot?.meta?.version;
    if (!SUPPORTED_VERSIONS.includes(version)) errors.push(`Unsupported version: ${String(version)}`);

    const requiredMeta = ['slotId', 'slotName', 'country', 'scenario', 'mode', 'updatedAt'];
    requiredMeta.forEach((field) => {
      if (typeof snapshot?.meta?.[field] !== 'string' || !snapshot.meta[field]) {
        errors.push(`Missing required meta field: ${field}.`);
      }
    });

    const requiredStateKeys = [
      'currentTimeMs', 'simulationSpeed', 'pendingTasks', 'countries', 'bases', 'units', 'cities', 'nextCounters',
      'diplomacy', 'economy', 'trade', 'events', 'migration', 'leadership', 'internalResistance', 'localInstability'
    ];
    requiredStateKeys.forEach((field) => {
      if (!(field in (snapshot?.state || {}))) {
        errors.push(`Missing required state field: ${field}.`);
      }
    });

    if (!Number.isFinite(Number(snapshot?.scheduler?.nextTaskId))) {
      errors.push('scheduler.nextTaskId must be numeric.');
    }

    const queueValidation = validateTaskQueueShape(snapshot?.state?.pendingTasks);
    if (!queueValidation.ok) errors.push(...queueValidation.errors);

    if (metadata && !validateSlotMetadata(metadata.slotId, metadata)) {
      errors.push('Stored slot metadata is malformed.');
    }

    return { ok: errors.length === 0, errors };
  }

  function saveSnapshot({ slotId, slotName, snapshot }) {
    if (!slotId || !snapshot) {
      return { ok: false, message: 'Missing slot or snapshot.' };
    }
    try {
      const hadExisting = Boolean(readSlotSnapshot(slotId));
      const metadata = buildMetadata(slotId, slotName, snapshot);
      localStorage.setItem(getSlotKey(slotId), JSON.stringify({ metadata, snapshot }));
      const manifest = readManifest();
      manifest.slots[slotId] = metadata;
      manifest.latestSlotId = LATEST_SLOT;
      writeManifest(manifest);
      return { ok: true, metadata, overwritten: hadExisting };
    } catch (error) {
      console.warn('Save failed:', error);
      return { ok: false, message: 'Failed to write save data to localStorage.' };
    }
  }

  function readSlotSnapshot(slotId) {
    try {
      const raw = localStorage.getItem(getSlotKey(slotId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function loadSnapshot(slotId) {
    if (!slotId) return { ok: false, message: 'No slot selected.' };
    try {
      const parsed = readSlotSnapshot(slotId);
      if (!parsed) return { ok: false, message: `No save found in ${slotId}.` };

      const migrated = migrateSnapshot(parsed.snapshot);
      if (!migrated.ok) {
        return { ok: false, message: migrated.message || 'Unsupported save version.', errors: migrated.errors || [] };
      }
      const normalized = normalizeSnapshot(migrated.snapshot);
      const metadata = parsed.metadata || buildMetadata(slotId, getDefaultSlotName(slotId), normalized);
      const validated = validateSnapshot(normalized, metadata);
      if (!validated.ok) {
        return {
          ok: false,
          message: 'Save data is invalid or corrupted and cannot be loaded.',
          errors: validated.errors
        };
      }
      return {
        ok: true,
        metadata,
        snapshot: normalized,
        migrations: migrated.migrations || []
      };
    } catch (error) {
      console.warn('Load failed:', error);
      return { ok: false, message: 'Failed to parse save data.' };
    }
  }

  function renameManualSlot(slotId, slotName) {
    if (!MANUAL_SLOTS.includes(slotId)) {
      return { ok: false, message: 'Only manual slots can be renamed.' };
    }
    const nextName = (slotName || '').trim();
    if (!nextName) return { ok: false, message: 'Slot name cannot be empty.' };
    const parsed = readSlotSnapshot(slotId);
    if (!parsed?.snapshot) return { ok: false, message: 'No save exists in that slot.' };

    const metadata = buildMetadata(slotId, nextName, parsed.snapshot);
    parsed.metadata = metadata;
    localStorage.setItem(getSlotKey(slotId), JSON.stringify(parsed));

    const manifest = readManifest();
    manifest.slots[slotId] = metadata;
    writeManifest(manifest);
    return { ok: true, metadata };
  }

  function deleteManualSlot(slotId) {
    if (!MANUAL_SLOTS.includes(slotId)) {
      return { ok: false, message: 'Only manual slots can be deleted.' };
    }
    const existing = readSlotSnapshot(slotId);
    if (!existing) return { ok: false, message: 'Slot is already empty.' };

    localStorage.removeItem(getSlotKey(slotId));
    const manifest = readManifest();
    delete manifest.slots[slotId];
    manifest.latestSlotId = LATEST_SLOT;
    writeManifest(manifest);
    return { ok: true, message: `${getDefaultSlotName(slotId)} deleted.` };
  }

  function getManifestView() {
    const manifest = readManifest();
    const slots = [LATEST_SLOT, ...MANUAL_SLOTS]
      .map((slotId) => ({ slotId, metadata: manifest.slots[slotId] || null }));
    return {
      latestSlotId: manifest.latestSlotId || null,
      latest: manifest.slots[LATEST_SLOT] || null,
      manualSlots: MANUAL_SLOTS,
      slots
    };
  }

  function getLatestSnapshot() {
    const latest = loadSnapshot(LATEST_SLOT);
    if (latest.ok) return latest;
    const manifest = readManifest();
    if (manifest.latestSlotId && manifest.latestSlotId !== LATEST_SLOT) {
      return loadSnapshot(manifest.latestSlotId);
    }
    return latest;
  }

  function hasSlotData(slotId) {
    return Boolean(readSlotSnapshot(slotId));
  }

  window.GeoCommandSaveSystem = {
    LATEST_SLOT,
    MANUAL_SLOTS,
    saveSnapshot,
    loadSnapshot,
    renameManualSlot,
    deleteManualSlot,
    hasSlotData,
    getLatestSnapshot,
    getManifestView,
    migrateSnapshot,
    normalizeSnapshot,
    validateSnapshot,
    validateManifestShape
  };
})();
