class MovementSystem {
  constructor(gameState, scheduler, resourceSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.resourceSystem = resourceSystem;
  }

  issueMoveOrder(unitId, targetLonLat, silent = false) {
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!unit) return { ok: false, message: 'Select a valid unit first.' };
    if (unit.status !== 'active') return { ok: false, message: 'Only active units can receive new move orders.' };
    if (unit.combatStatus === 'attacking' || unit.combatStatus === 'defending') {
      return { ok: false, message: 'Cannot move while unit is in combat.' };
    }
    if (unit.captureTarget) return { ok: false, message: 'Cannot move while capturing.' };
    if ((unit.domain === 'air' || unit.domain === 'naval')) {
      const oilCost = RESOURCE_CONFIG.operationsOilCost.move[unit.domain] || 0;
      if (!this.resourceSystem.consumeOperationalOil(unit.ownerCountry, oilCost)) {
        return { ok: false, message: `Not enough oil for ${unit.domain} movement.` };
      }
    }

    const startLonLat = this.getDisplayLonLat(unit);
    const distanceKm = d3.geoDistance(startLonLat, targetLonLat) * 6371;
    const speed = UNIT_SPEED_KM_PER_DAY[unit.type] || 300;
    const durationMs = Math.max(1, (distanceKm / speed) * DAY_MS);

    unit.status = 'moving';
    unit.movement = {
      startLonLat,
      targetLonLat: [...targetLonLat],
      startedAt: this.gameState.currentTimeMs,
      arrivalAt: this.gameState.currentTimeMs + durationMs,
      speedKmPerDay: speed,
      taskId: null
    };

    const taskId = this.scheduler.schedule({
      executeAt: unit.movement.arrivalAt,
      type: 'UNIT_MOVE_COMPLETE',
      payload: { unitId: unit.id },
      handler: ({ unitId: doneUnitId }) => this.completeMove(doneUnitId)
    });

    unit.movement.taskId = taskId;
    return { ok: true, unit, silent };
  }

  completeMove(unitId) {
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!unit || !unit.movement) return;
    unit.lonLat = [...unit.movement.targetLonLat];
    unit.movement = null;
    unit.status = 'active';
    setStatus(`${UNIT_DEFINITIONS[unit.type].label} arrived at destination.`);
    renderUnits();
    renderSelectedUnitPanel();
  }

  getDisplayLonLat(unit) {
    if (!unit.movement || unit.status !== 'moving') return unit.lonLat;
    const { startLonLat, targetLonLat, startedAt, arrivalAt } = unit.movement;
    const total = Math.max(1, arrivalAt - startedAt);
    const progress = Math.min(1, Math.max(0, (this.gameState.currentTimeMs - startedAt) / total));
    return [
      startLonLat[0] + (targetLonLat[0] - startLonLat[0]) * progress,
      startLonLat[1] + (targetLonLat[1] - startLonLat[1]) * progress
    ];
  }
}
