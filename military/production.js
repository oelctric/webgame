class ProductionSystem {
  constructor(gameState, scheduler, resourceSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.resourceSystem = resourceSystem;
  }

  getAllowedUnitsForBase(base) {
    const domain = BASE_TO_DOMAIN[base.type];
    if (!domain) return [];
    return Object.entries(UNIT_DEFINITIONS)
      .filter(([, def]) => def.domain === domain)
      .map(([key, def]) => ({ key, ...def }));
  }

  queueUnit(baseId, unitType, actorCountry = null) {
    const base = this.gameState.bases.find((entry) => entry.id === baseId);
    const unitDef = UNIT_DEFINITIONS[unitType];
    if (!base || !unitDef) return { ok: false, message: 'Invalid base or unit type.' };
    const actingCountry = actorCountry || (this.gameState.selectedPlayerCountry && this.gameState.selectedPlayerCountry.properties.name);
    if (!actingCountry || base.ownerCountry !== actingCountry) {
      return { ok: false, message: 'You can only queue production at your own bases.' };
    }
    if (base.status !== 'active') return { ok: false, message: 'Base must be active before production can begin.' };

    const baseDomain = BASE_TO_DOMAIN[base.type];
    if (!baseDomain) return { ok: false, message: 'Anti-air bases cannot produce units.' };
    if (unitDef.domain !== baseDomain) return { ok: false, message: `${base.type} base cannot produce ${unitDef.label}.` };
    const unitCost = ECONOMY_CONFIG.unitBuildCost[unitType] || 0;
    const resourceCost = this.resourceSystem.getUnitResourceCost(unitType);
    const resourceCheck = this.resourceSystem.canSpend(actingCountry, resourceCost);
    if (!resourceCheck.ok) return { ok: false, message: resourceCheck.message };
    if (!economySystem.spend(actingCountry, unitCost, `queue ${unitType}`)) {
      refreshEconomyHud();
      return { ok: false, message: `Insufficient funds to queue ${unitDef.label} (${unitCost}).` };
    }
    this.resourceSystem.spend(actingCountry, resourceCost);

    const unit = {
      id: this.gameState.nextUnitId++,
      ownerCountry: base.ownerCountry,
      type: unitType,
      domain: unitDef.domain,
      status: 'queued',
      createdAt: this.gameState.currentTimeMs,
      activatedAt: null,
      sourceBaseId: base.id,
      lonLat: [...base.lonLat],
      health: unitDef.maxHealth,
      maxHealth: unitDef.maxHealth,
      attack: unitDef.attack,
      defense: unitDef.defense,
      rangeKm: unitDef.rangeKm,
      attackCooldownMs: unitDef.attackCooldownMs,
      combatStatus: 'idle',
      currentTargetId: null,
      targetType: null,
      strength: unitDef.attack,
      movement: null,
      captureTarget: null
    };

    this.gameState.units.push(unit);
    base.production.queue.push(unit.id);
    this.tryStartNext(base.id);
    return { ok: true, unit };
  }

  tryStartNext(baseId) {
    const base = this.gameState.bases.find((entry) => entry.id === baseId);
    if (!base || base.status !== 'active') return;
    if (base.production.currentUnitId) return;
    if (!base.production.queue.length) return;

    const unitId = base.production.queue.shift();
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!unit) return;

    const unitDef = UNIT_DEFINITIONS[unit.type];
    base.production.currentUnitId = unit.id;
    base.production.currentCompleteAt = this.gameState.currentTimeMs + Math.round(unitDef.durationMs * this.resourceSystem.getIndustryBuildFactor(base.ownerCountry));

    this.scheduler.schedule({
      executeAt: base.production.currentCompleteAt,
      type: 'UNIT_PRODUCTION_COMPLETE',
      payload: { baseId: base.id, unitId: unit.id },
      handler: ({ baseId: doneBaseId, unitId: doneUnitId }) => this.completeProduction(doneBaseId, doneUnitId)
    });
  }

  completeProduction(baseId, unitId) {
    const base = this.gameState.bases.find((entry) => entry.id === baseId);
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!base || !unit) return;

    unit.status = 'active';
    unit.activatedAt = this.gameState.currentTimeMs;
    unit.lonLat = [base.lonLat[0] + (unit.id % 4) * 0.35, base.lonLat[1] + ((unit.id % 3) - 1) * 0.25];

    base.production.currentUnitId = null;
    base.production.currentCompleteAt = null;
    this.tryStartNext(baseId);
    setStatus(`${UNIT_DEFINITIONS[unit.type].label} completed at base #${base.id}.`);
    renderProductionPanel();
    renderUnits();
    renderSelectedUnitPanel();
  }
}
