(function initGeoCommandSaveSystem() {
  const STORAGE_PREFIX = 'geoCommand.save.v1';
  const MANIFEST_KEY = `${STORAGE_PREFIX}.manifest`;
  const LATEST_SLOT = 'latest';
  const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'];

  function safeNowIso() {
    return new Date().toISOString();
  }

  function getSlotKey(slotId) {
    return `${STORAGE_PREFIX}.slot.${slotId}`;
  }

  function readManifest() {
    try {
      const raw = localStorage.getItem(MANIFEST_KEY);
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
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  }

  function buildMetadata(slotId, slotName, snapshot) {
    return {
      slotId,
      slotName,
      isLatest: slotId === LATEST_SLOT,
      version: snapshot?.meta?.version || 1,
      country: snapshot?.meta?.country || 'Unknown',
      inGameDate: snapshot?.meta?.inGameDate || null,
      scenario: snapshot?.meta?.scenario || 'Unknown',
      mode: snapshot?.meta?.mode || 'standard',
      updatedAt: snapshot?.meta?.updatedAt || safeNowIso()
    };
  }

  function saveSnapshot({ slotId, slotName, snapshot }) {
    if (!slotId || !snapshot) {
      return { ok: false, message: 'Missing slot or snapshot.' };
    }
    try {
      const metadata = buildMetadata(slotId, slotName, snapshot);
      localStorage.setItem(getSlotKey(slotId), JSON.stringify({ metadata, snapshot }));
      const manifest = readManifest();
      manifest.slots[slotId] = metadata;
      if (slotId === LATEST_SLOT || !manifest.latestSlotId) {
        manifest.latestSlotId = slotId;
      }
      if (slotId !== LATEST_SLOT) {
        manifest.latestSlotId = LATEST_SLOT;
      }
      writeManifest(manifest);
      return { ok: true, metadata };
    } catch (error) {
      console.warn('Save failed:', error);
      return { ok: false, message: 'Failed to write save data to localStorage.' };
    }
  }

  function loadSnapshot(slotId) {
    if (!slotId) return { ok: false, message: 'No slot selected.' };
    try {
      const raw = localStorage.getItem(getSlotKey(slotId));
      if (!raw) return { ok: false, message: `No save found in ${slotId}.` };
      const parsed = JSON.parse(raw);
      if (!parsed?.snapshot?.state) {
        return { ok: false, message: 'Save file is invalid or from an unsupported version.' };
      }
      return { ok: true, metadata: parsed.metadata, snapshot: parsed.snapshot };
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

  window.GeoCommandSaveSystem = {
    LATEST_SLOT,
    MANUAL_SLOTS,
    saveSnapshot,
    loadSnapshot,
    getLatestSnapshot,
    getManifestView
  };
})();
