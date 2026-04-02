(function initGeoCommandSaveSystem(globalScope) {
  const root = globalScope || (typeof window !== 'undefined' ? window : globalThis);
  const storage = root.localStorage;

  const STORAGE_PREFIX = 'geoCommand.save.v1';
  const MANIFEST_KEY = `${STORAGE_PREFIX}.manifest`;
  const LATEST_SLOT = 'latest';
  const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'];
  const CURRENT_SAVE_VERSION = 1;

  function safeNowIso() {
    return new Date().toISOString();
  }

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function getSlotKey(slotId) {
    return `${STORAGE_PREFIX}.slot.${slotId}`;
  }

  function parseTask(task, index) {
    if (!task || typeof task !== 'object') {
      return { ok: false, reason: 'Task is not an object.', index };
    }
    if (typeof task.type !== 'string' || !task.type.trim()) {
      return { ok: false, reason: 'Task missing type.', index };
    }
    if (!Number.isFinite(Number(task.executeAt))) {
      return { ok: false, reason: 'Task has invalid executeAt.', index, type: task.type };
    }
    const normalizedId = Number(task.id);
    return {
      ok: true,
      task: {
        id: Number.isFinite(normalizedId) && normalizedId > 0 ? normalizedId : index + 1,
        executeAt: Number(task.executeAt),
        type: task.type,
        payload: task.payload && typeof task.payload === 'object' ? task.payload : {}
      }
    };
  }

  function migrateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return { ok: false, error: 'Snapshot payload must be an object.' };
    }
    const migrated = deepClone(snapshot);
    if (!migrated.meta || typeof migrated.meta !== 'object') {
      return { ok: false, error: 'Snapshot metadata is missing.' };
    }

    const version = Number(migrated.meta.version);
    if (!Number.isFinite(version)) {
      return { ok: false, error: 'Snapshot version is missing or invalid.' };
    }
    if (version > CURRENT_SAVE_VERSION) {
      return { ok: false, error: `Unsupported snapshot version ${version}.` };
    }
    if (version < 1) {
      return { ok: false, error: `Snapshot version ${version} is not supported.` };
    }

    return {
      ok: true,
      snapshot: migrated,
      report: {
        fromVersion: version,
        toVersion: version,
        migrationsApplied: []
      }
    };
  }

  function normalizeSnapshot(snapshot) {
    const normalized = deepClone(snapshot);
    if (!normalized.state || typeof normalized.state !== 'object') {
      return { ok: false, error: 'Snapshot state is missing.' };
    }

    if (!normalized.scheduler || typeof normalized.scheduler !== 'object') {
      normalized.scheduler = {};
    }

    const schedulerNext = Number(normalized.scheduler.nextTaskId);
    normalized.scheduler.nextTaskId = Number.isFinite(schedulerNext) && schedulerNext > 0 ? schedulerNext : 1;

    if (normalized.state.pendingTasks != null && !Array.isArray(normalized.state.pendingTasks)) {
      return { ok: false, error: 'Snapshot state.pendingTasks must be an array when provided.' };
    }

    if (!Array.isArray(normalized.state.pendingTasks)) {
      normalized.state.pendingTasks = [];
    }

    const skippedTasks = [];
    const sanitized = [];
    normalized.state.pendingTasks.forEach((task, index) => {
      const parsed = parseTask(task, index);
      if (!parsed.ok) {
        skippedTasks.push({
          index,
          type: task?.type || null,
          reason: parsed.reason
        });
        return;
      }
      sanitized.push(parsed.task);
    });

    sanitized.sort((a, b) => a.executeAt - b.executeAt || a.id - b.id);
    normalized.state.pendingTasks = sanitized;
    if (normalized.scheduler.nextTaskId <= sanitized.length) {
      normalized.scheduler.nextTaskId = sanitized.length + 1;
    }

    return {
      ok: true,
      snapshot: normalized,
      report: {
        skippedTasks,
        normalizedTaskCount: sanitized.length,
        schedulerNextTaskId: normalized.scheduler.nextTaskId
      }
    };
  }

  function validateSnapshot(snapshot) {
    const version = Number(snapshot?.meta?.version);
    if (!Number.isFinite(version)) {
      return { ok: false, error: 'Snapshot meta.version must be numeric.' };
    }
    if (version < 1 || version > CURRENT_SAVE_VERSION) {
      return { ok: false, error: `Snapshot version ${version} is unsupported.` };
    }
    if (!snapshot?.meta?.slotId || typeof snapshot.meta.slotId !== 'string') {
      return { ok: false, error: 'Snapshot meta.slotId is required.' };
    }
    if (!snapshot?.state || typeof snapshot.state !== 'object') {
      return { ok: false, error: 'Snapshot state object is required.' };
    }
    if (!Number.isFinite(Number(snapshot.state.currentTimeMs))) {
      return { ok: false, error: 'Snapshot state.currentTimeMs is invalid.' };
    }
    if (!Array.isArray(snapshot.state.pendingTasks)) {
      return { ok: false, error: 'Snapshot state.pendingTasks must be an array.' };
    }
    return { ok: true, report: { version } };
  }

  function prepareSnapshotForRestore(snapshot) {
    const migrated = migrateSnapshot(snapshot);
    if (!migrated.ok) {
      return {
        ok: false,
        phase: 'migrate',
        message: migrated.error,
        report: { migrate: { ok: false, error: migrated.error } }
      };
    }

    const normalized = normalizeSnapshot(migrated.snapshot);
    if (!normalized.ok) {
      return {
        ok: false,
        phase: 'normalize',
        message: normalized.error,
        report: {
          migrate: { ok: true, ...migrated.report },
          normalize: { ok: false, error: normalized.error }
        }
      };
    }

    const validated = validateSnapshot(normalized.snapshot);
    if (!validated.ok) {
      return {
        ok: false,
        phase: 'validate',
        message: validated.error,
        report: {
          migrate: { ok: true, ...migrated.report },
          normalize: { ok: true, ...normalized.report },
          validate: { ok: false, error: validated.error }
        }
      };
    }

    return {
      ok: true,
      snapshot: normalized.snapshot,
      report: {
        migrate: { ok: true, ...migrated.report },
        normalize: { ok: true, ...normalized.report },
        validate: { ok: true, ...validated.report }
      }
    };
  }

  function readManifest() {
    if (!storage) return { latestSlotId: null, slots: {} };
    try {
      const raw = storage.getItem(MANIFEST_KEY);
      if (!raw) {
        return { latestSlotId: null, slots: {} };
      }
      const parsed = JSON.parse(raw);
      return {
        latestSlotId: parsed?.latestSlotId || null,
        slots: parsed?.slots && typeof parsed.slots === 'object' ? parsed.slots : {}
      };
    } catch (error) {
      console.warn('Failed reading save manifest:', error);
      return { latestSlotId: null, slots: {} };
    }
  }

  function writeManifest(manifest) {
    if (!storage) return;
    storage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  }

  function buildMetadata(slotId, slotName, snapshot) {
    return {
      slotId,
      slotName,
      isLatest: slotId === LATEST_SLOT,
      version: snapshot?.meta?.version || CURRENT_SAVE_VERSION,
      country: snapshot?.meta?.country || 'Unknown',
      inGameDate: snapshot?.meta?.inGameDate || null,
      scenario: snapshot?.meta?.scenario || 'Unknown',
      mode: snapshot?.meta?.mode || 'standard',
      updatedAt: snapshot?.meta?.updatedAt || safeNowIso()
    };
  }

  function saveSnapshot({ slotId, slotName, snapshot }) {
    if (!storage) return { ok: false, message: 'Storage unavailable.' };
    if (!slotId || !snapshot) {
      return { ok: false, message: 'Missing slot or snapshot.' };
    }
    const prepared = prepareSnapshotForRestore(snapshot);
    if (!prepared.ok) {
      return { ok: false, message: prepared.message, report: prepared.report };
    }
    try {
      const metadata = buildMetadata(slotId, slotName, prepared.snapshot);
      storage.setItem(getSlotKey(slotId), JSON.stringify({ metadata, snapshot: prepared.snapshot }));
      const manifest = readManifest();
      manifest.slots[slotId] = metadata;
      if (slotId === LATEST_SLOT || !manifest.latestSlotId) {
        manifest.latestSlotId = slotId;
      }
      if (slotId !== LATEST_SLOT) {
        manifest.latestSlotId = LATEST_SLOT;
      }
      writeManifest(manifest);
      return { ok: true, metadata, report: prepared.report };
    } catch (error) {
      console.warn('Save failed:', error);
      return { ok: false, message: 'Failed to write save data to localStorage.' };
    }
  }

  function loadSnapshot(slotId) {
    if (!storage) return { ok: false, message: 'Storage unavailable.' };
    if (!slotId) return { ok: false, message: 'No slot selected.' };
    try {
      const raw = storage.getItem(getSlotKey(slotId));
      if (!raw) return { ok: false, message: `No save found in ${slotId}.` };
      const parsed = JSON.parse(raw);
      if (!parsed?.snapshot) {
        return { ok: false, message: 'Save file is invalid or from an unsupported version.' };
      }
      const prepared = prepareSnapshotForRestore(parsed.snapshot);
      if (!prepared.ok) {
        return { ok: false, message: prepared.message, report: prepared.report };
      }
      return { ok: true, metadata: parsed.metadata, snapshot: prepared.snapshot, report: prepared.report };
    } catch (error) {
      console.warn('Load failed:', error);
      return { ok: false, message: 'Failed to parse save data.' };
    }
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

  root.GeoCommandSaveSystem = {
    LATEST_SLOT,
    MANUAL_SLOTS,
    CURRENT_SAVE_VERSION,
    migrateSnapshot,
    normalizeSnapshot,
    validateSnapshot,
    prepareSnapshotForRestore,
    saveSnapshot,
    loadSnapshot,
    getLatestSnapshot,
    getManifestView
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.GeoCommandSaveSystem;
  }
})(typeof window !== 'undefined' ? window : globalThis);
