class CaptureSystem {
  constructor(gameState, scheduler, movementSystem, diplomacySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.movementSystem = movementSystem;
    this.diplomacySystem = diplomacySystem;
  }

  startCapture(unitId, targetType, targetId, silent = false) {
    const unit = this.gameState.units.find((u) => u.id === unitId);
    if (!unit || unit.status === 'destroyed') return { ok: false, message: 'Capturing unit is not available.' };
    if (unit.domain !== 'ground') return { ok: false, message: 'Only ground units can capture.' };
    if (unit.status !== 'active') return { ok: false, message: 'Unit must be active to capture.' };
    if (unit.movement) return { ok: false, message: 'Unit cannot capture while moving.' };
    if (unit.combatStatus === 'attacking' || unit.combatStatus === 'defending') {
      return { ok: false, message: 'Unit cannot capture while in combat.' };
    }

    const target = targetType === 'base'
      ? this.gameState.bases.find((b) => b.id === targetId)
      : this.gameState.cities.find((c) => c.id === targetId);
    if (!target) return { ok: false, message: 'Target not found.' };
    if (target.combatStatus === 'destroyed' || target.status === 'destroyed') return { ok: false, message: 'Target is destroyed.' };
    if (target.ownerCountry === unit.ownerCountry) return { ok: false, message: 'Cannot capture friendly assets.' };
    if (target.captureState) return { ok: false, message: 'Target is already being captured.' };
    const offensiveCheck = this.diplomacySystem.canStartOffensiveAction(unit.ownerCountry, target.ownerCountry);
    if (!offensiveCheck.ok) return { ok: false, message: offensiveCheck.message };

    const unitPos = this.movementSystem.getDisplayLonLat(unit);
    const targetPos = target.lonLat;
    const distanceKm = d3.geoDistance(unitPos, targetPos) * 6371;
    if (distanceKm > CAPTURE_CONFIG.captureRangeKm) return { ok: false, message: 'Target is out of capture range.' };

    const durationMs = targetType === 'base' ? CAPTURE_CONFIG.baseDurationMs : CAPTURE_CONFIG.cityDurationMs;
    target.controlStatus = 'being_captured';
    target.captureState = {
      captorUnitId: unit.id,
      startedAt: this.gameState.currentTimeMs,
      completeAt: this.gameState.currentTimeMs + durationMs,
      taskId: null
    };
    unit.captureTarget = { targetType, targetId };

    const taskId = this.scheduler.schedule({
      executeAt: target.captureState.completeAt,
      type: 'CAPTURE_COMPLETE',
      payload: { targetType, targetId, captorUnitId: unit.id },
      handler: (payload) => this.resolveCapture(payload)
    });
    target.captureState.taskId = taskId;

    this.diplomacySystem.adjustRelationScore(
      unit.ownerCountry,
      target.ownerCountry,
      DIPLOMACY_CONFIG.actionImpacts.attackOrder,
      'Capture operation started',
      true
    );
    blocSystem?.handleAggression(unit.ownerCountry, target.ownerCountry);
    return { ok: true, target, silent, autoDeclaredWar: offensiveCheck.autoDeclaredWar, message: offensiveCheck.message };
  }

  resolveCapture({ targetType, targetId, captorUnitId }) {
    const unit = this.gameState.units.find((u) => u.id === captorUnitId);
    const target = targetType === 'base'
      ? this.gameState.bases.find((b) => b.id === targetId)
      : this.gameState.cities.find((c) => c.id === targetId);
    if (!target || !target.captureState) return;

    if (!unit || unit.status === 'destroyed') {
      target.captureState = null;
      target.controlStatus = 'normal';
      setStatus('Capture failed: captor unit was destroyed.');
      return;
    }
    if (target.status === 'destroyed' || target.combatStatus === 'destroyed') {
      target.captureState = null;
      target.controlStatus = 'normal';
      setStatus('Capture failed: target was destroyed.');
      if (unit) unit.captureTarget = null;
      return;
    }

    const previousOwner = target.ownerCountry;
    target.ownerCountry = unit.ownerCountry;
    target.captureState = null;
    target.controlStatus = 'normal';
    unit.captureTarget = null;
    setStatus(`${targetType} captured by ${unit.ownerCountry}.`);
    this.diplomacySystem.adjustRelationScore(
      unit.ownerCountry,
      previousOwner,
      DIPLOMACY_CONFIG.actionImpacts.captureAsset,
      `${targetType} captured`,
      true
    );
    renderBases();
    renderCities();
    renderCityList(gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : undefined);
    renderProductionPanel();
    renderSelectedUnitPanel();
    refreshEconomyHud();
  }

  cancelCapturesByUnit(unitId) {
    const assets = [...this.gameState.bases, ...this.gameState.cities];
    assets.forEach((asset) => {
      if (asset.captureState && asset.captureState.captorUnitId === unitId) {
        asset.captureState = null;
        asset.controlStatus = 'normal';
      }
    });
  }
}
