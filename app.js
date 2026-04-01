const GAME_START_ISO = '2026-01-01T00:00:00Z';
const DAY_MS = 24 * 60 * 60 * 1000;
const GAME_TIME_SCALE = 600; // 1 real second = 10 in-game minutes at 1x

const BASE_BUILD_DURATIONS_MS = {
  ground: 3 * DAY_MS,
  air: 5 * DAY_MS,
  naval: 7 * DAY_MS,
  antiAir: 2 * DAY_MS
};

const UNIT_DEFINITIONS = {
  infantry: { label: 'Infantry', domain: 'ground', durationMs: 2 * DAY_MS, maxHealth: 100, attack: 14, defense: 6, rangeKm: 260, attackCooldownMs: 8 * 60 * 60 * 1000 },
  armor: { label: 'Armor', domain: 'ground', durationMs: 5 * DAY_MS, maxHealth: 150, attack: 24, defense: 10, rangeKm: 340, attackCooldownMs: 6 * 60 * 60 * 1000 },
  fighter: { label: 'Fighter', domain: 'air', durationMs: 4 * DAY_MS, maxHealth: 90, attack: 30, defense: 7, rangeKm: 1200, attackCooldownMs: 3 * 60 * 60 * 1000 },
  bomber: { label: 'Bomber', domain: 'air', durationMs: 6 * DAY_MS, maxHealth: 120, attack: 36, defense: 8, rangeKm: 1400, attackCooldownMs: 4 * 60 * 60 * 1000 },
  patrolBoat: { label: 'Patrol Boat', domain: 'naval', durationMs: 5 * DAY_MS, maxHealth: 130, attack: 20, defense: 9, rangeKm: 500, attackCooldownMs: 6 * 60 * 60 * 1000 },
  destroyer: { label: 'Destroyer', domain: 'naval', durationMs: 10 * DAY_MS, maxHealth: 220, attack: 32, defense: 14, rangeKm: 620, attackCooldownMs: 5 * 60 * 60 * 1000 }
};

const BASE_TO_DOMAIN = {
  ground: 'ground',
  air: 'air',
  naval: 'naval',
  antiAir: null
};

const UNIT_SPEED_KM_PER_DAY = {
  infantry: 220,
  armor: 420,
  fighter: 2400,
  bomber: 1800,
  patrolBoat: 480,
  destroyer: 520
};

const CAPTURE_CONFIG = {
  cityDurationMs: 2 * DAY_MS,
  baseDurationMs: 3 * DAY_MS,
  captureRangeKm: 320
};

const ECONOMY_CONFIG = {
  tickMs: DAY_MS,
  cityIncomePerDay: 100,
  baseUpkeepPerDay: { ground: 20, air: 35, naval: 50, antiAir: 15 },
  unitUpkeepPerDay: { infantry: 5, armor: 12, fighter: 15, bomber: 20, patrolBoat: 18, destroyer: 30 },
  baseBuildCost: { ground: 500, air: 900, naval: 1200, antiAir: 350 },
  unitBuildCost: { infantry: 120, armor: 280, fighter: 420, bomber: 560, patrolBoat: 450, destroyer: 900 },
  defaultTreasury: 4000
};

const AI_CONFIG = {
  tickMs: 12 * 60 * 60 * 1000,
  baseThreshold: 2,
  baseExpansionTreasury: 2500,
  postureCooldownMs: 2 * DAY_MS,
  policyCooldownMs: 3 * DAY_MS,
  diplomacyCooldownMs: 2 * DAY_MS
};

const COUNTRY_CONFIG = {
  tickMs: DAY_MS,
  basePopulation: 1_000_000,
  cityPopulation: 500_000,
  baseIndustry: 5,
  cityIndustry: 8,
  baseManpower: 1000,
  cityManpower: 2000
};

const DIPLOMACY_CONFIG = {
  tickMs: 7 * DAY_MS,
  minScore: -100,
  maxScore: 100,
  friendlyThreshold: 35,
  hostileThreshold: -35,
  normalizationStep: 1,
  actionImpacts: {
    attackOrder: -4,
    attackDestroyed: -6,
    captureAsset: -12
  }
};

const POLICY_CONFIG = {
  tickMs: DAY_MS,
  levels: ['low', 'normal', 'high'],
  dailyCosts: {
    militarySpendingLevel: { low: 5, normal: 20, high: 45 },
    industryInvestmentLevel: { low: 8, normal: 25, high: 60 },
    internalSecurityLevel: { low: 4, normal: 18, high: 42 }
  },
  dailyEffects: {
    militarySpendingLevel: {
      low: { manpower: -20, stability: 0.08, readiness: -0.4 },
      normal: { manpower: 0, stability: 0, readiness: 0.2 },
      high: { manpower: 35, stability: -0.08, readiness: 0.8 }
    },
    industryInvestmentLevel: {
      low: { industrialCapacity: 0.05, treasuryBonus: 5 },
      normal: { industrialCapacity: 0.16, treasuryBonus: 0 },
      high: { industrialCapacity: 0.32, treasuryBonus: -6 }
    },
    internalSecurityLevel: {
      low: { stability: -0.12, readiness: -0.1 },
      normal: { stability: 0.05, readiness: 0.05 },
      high: { stability: 0.22, readiness: 0.12 }
    }
  }
};

const DOMESTIC_CONFIG = {
  tickMs: DAY_MS,
  clampMin: 0,
  clampMax: 100,
  unrestSecurityDrift: { low: 0.12, normal: -0.18, high: -0.45 },
  stabilitySecurityBonus: { low: -0.08, normal: 0.04, high: 0.12 }
};

const RESOURCE_CONFIG = {
  tickMs: DAY_MS,
  defaultOil: 220,
  defaultMaxOil: 1200,
  defaultManpowerPool: 8000,
  manpowerPoolMax: 150000,
  oilShortageThreshold: 40,
  productionCosts: {
    infantry: { manpower: 140, oil: 0 },
    armor: { manpower: 260, oil: 16 },
    fighter: { manpower: 180, oil: 36 },
    bomber: { manpower: 220, oil: 44 },
    patrolBoat: { manpower: 200, oil: 42 },
    destroyer: { manpower: 320, oil: 68 }
  },
  operationsOilCost: {
    move: { air: 8, naval: 6 },
    combatTick: { air: 5, naval: 4 }
  }
};

class GameClock {
  constructor({ startTimeMs, speed = 1 }) {
    this.currentTimeMs = startTimeMs;
    this.speed = speed;
  }

  pause() {
    this.speed = 0;
  }

  resume() {
    if (this.speed === 0) this.speed = 1;
  }

  setSpeed(multiplier) {
    this.speed = Math.max(0, Number(multiplier) || 0);
  }

  getCurrentTime() {
    return this.currentTimeMs;
  }

  advanceBy(realDeltaMs) {
    const safeDelta = Math.max(0, realDeltaMs || 0);
    const gameDelta = safeDelta * this.speed * GAME_TIME_SCALE;
    this.currentTimeMs += gameDelta;
    return gameDelta;
  }

  update(realDeltaMs) {
    return this.advanceBy(realDeltaMs);
  }

  skipGameTime(gameDeltaMs) {
    const safeDelta = Math.max(0, gameDeltaMs || 0);
    this.currentTimeMs += safeDelta;
    return safeDelta;
  }
}

class TaskScheduler {
  constructor(gameState) {
    this.gameState = gameState;
    this.tasks = [];
    this.nextTaskId = 1;
  }

  schedule({ executeAt, type, payload, handler }) {
    const task = {
      id: this.nextTaskId++,
      executeAt,
      type,
      payload,
      handler
    };

    this.tasks.push(task);
    this.tasks.sort((a, b) => a.executeAt - b.executeAt || a.id - b.id);
    this.syncPendingTasks();
    return task.id;
  }

  processDue(currentTimeMs) {
    const dueTasks = [];
    while (this.tasks.length && this.tasks[0].executeAt <= currentTimeMs) {
      dueTasks.push(this.tasks.shift());
    }

    dueTasks.forEach((task) => task.handler(task.payload, task));
    this.syncPendingTasks();
  }

  syncPendingTasks() {
    this.gameState.pendingTasks = this.tasks.map((task) => ({
      id: task.id,
      type: task.type,
      executeAt: task.executeAt,
      payload: task.payload
    }));
  }
}

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

class CombatSystem {
  constructor(gameState, scheduler, movementSystem, diplomacySystem, resourceSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.movementSystem = movementSystem;
    this.diplomacySystem = diplomacySystem;
    this.resourceSystem = resourceSystem;
  }

  startAttack(attackerId, targetType, targetId, isCounter = false, silent = false) {
    const attacker = this.gameState.units.find((u) => u.id === attackerId);
    if (!attacker || attacker.status === 'destroyed') return { ok: false, message: 'Attacker is not available.' };
    if (attacker.status === 'moving') return { ok: false, message: 'Cannot attack while unit is moving.' };
    if (attacker.captureTarget) return { ok: false, message: 'Cannot attack while capturing.' };

    const target = targetType === 'unit'
      ? this.gameState.units.find((u) => u.id === targetId)
      : this.gameState.bases.find((b) => b.id === targetId);
    if (!target) return { ok: false, message: 'Target no longer exists.' };
    if ((targetType === 'unit' && target.status === 'destroyed') || (targetType === 'base' && target.combatStatus === 'destroyed')) {
      return { ok: false, message: 'Target already destroyed.' };
    }
    if (attacker.ownerCountry === target.ownerCountry) return { ok: false, message: 'Friendly fire is blocked.' };
    const offensiveCheck = this.diplomacySystem.canStartOffensiveAction(attacker.ownerCountry, target.ownerCountry);
    if (!offensiveCheck.ok) return { ok: false, message: offensiveCheck.message };

    const attackerPos = this.movementSystem.getDisplayLonLat(attacker);
    const targetPos = targetType === 'unit' ? this.movementSystem.getDisplayLonLat(target) : target.lonLat;
    const distanceKm = d3.geoDistance(attackerPos, targetPos) * 6371;
    if (distanceKm > attacker.rangeKm) return { ok: false, message: 'Target out of range.' };

    attacker.combatStatus = 'attacking';
    attacker.currentTargetId = targetId;
    attacker.targetType = targetType;
    attacker.silentCombat = silent;
    if (targetType === 'unit' && target.combatStatus !== 'attacking') target.combatStatus = 'defending';
    if (targetType === 'base' && target.combatStatus !== 'destroyed') target.combatStatus = 'under_attack';

    this.scheduleCombatTick(attacker.id, attacker.attackCooldownMs);

    if (!isCounter && targetType === 'unit' && target.status === 'active' && target.combatStatus === 'defending') {
      this.startAttack(target.id, 'unit', attacker.id, true);
    }
    if (!isCounter) {
      this.diplomacySystem.adjustRelationScore(
        attacker.ownerCountry,
        target.ownerCountry,
        DIPLOMACY_CONFIG.actionImpacts.attackOrder,
        'Attack order issued',
        true
      );
    }

    return { ok: true, autoDeclaredWar: offensiveCheck.autoDeclaredWar, message: offensiveCheck.message };
  }

  scheduleCombatTick(attackerId, cooldownMs) {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + cooldownMs,
      type: 'COMBAT_TICK',
      payload: { attackerId },
      handler: ({ attackerId: id }) => this.resolveCombatTick(id)
    });
  }

  resolveCombatTick(attackerId) {
    const attacker = this.gameState.units.find((u) => u.id === attackerId);
    if (!attacker || attacker.status === 'destroyed' || attacker.combatStatus !== 'attacking') return;

    const target = attacker.targetType === 'unit'
      ? this.gameState.units.find((u) => u.id === attacker.currentTargetId)
      : this.gameState.bases.find((b) => b.id === attacker.currentTargetId);
    if (!target) return this.clearUnitCombat(attacker);

    const targetDestroyed = attacker.targetType === 'unit'
      ? target.status === 'destroyed'
      : target.combatStatus === 'destroyed';
    if (targetDestroyed) return this.clearUnitCombat(attacker);

    const attackerPos = this.movementSystem.getDisplayLonLat(attacker);
    const targetPos = attacker.targetType === 'unit' ? this.movementSystem.getDisplayLonLat(target) : target.lonLat;
    const distanceKm = d3.geoDistance(attackerPos, targetPos) * 6371;
    if (distanceKm > attacker.rangeKm) {
      if (!attacker.silentCombat) setStatus(`${UNIT_DEFINITIONS[attacker.type].label} target moved out of range.`);
      return this.clearUnitCombat(attacker);
    }

    const defense = attacker.targetType === 'unit' ? target.defense : target.defense;
    let damage = Math.max(1, attacker.attack - defense);
    if (attacker.domain === 'air' || attacker.domain === 'naval') {
      const oilCost = RESOURCE_CONFIG.operationsOilCost.combatTick[attacker.domain] || 0;
      const hasOil = this.resourceSystem.consumeOperationalOil(attacker.ownerCountry, oilCost);
      if (!hasOil) {
        damage = Math.max(1, Math.floor(damage * 0.45));
        if (!attacker.silentCombat) setStatus(`${UNIT_DEFINITIONS[attacker.type].label} is fuel-starved; combat effectiveness reduced.`);
      }
    }
    target.health = Math.max(0, target.health - damage);

    if (target.health <= 0) {
      if (attacker.targetType === 'unit') {
        target.status = 'destroyed';
        target.combatStatus = 'destroyed';
        target.currentTargetId = null;
        target.targetType = null;
        target.movement = null;
        target.captureTarget = null;
        captureSystem.cancelCapturesByUnit(target.id);
      } else {
        target.combatStatus = 'destroyed';
        target.status = 'destroyed';
        target.production.currentUnitId = null;
        target.production.queue = [];
      }
      if (!attacker.silentCombat) setStatus(`${UNIT_DEFINITIONS[attacker.type].label} destroyed ${attacker.targetType} #${attacker.currentTargetId}.`);
      this.diplomacySystem.adjustRelationScore(
        attacker.ownerCountry,
        target.ownerCountry,
        DIPLOMACY_CONFIG.actionImpacts.attackDestroyed,
        'Combat destruction',
        true
      );
      this.clearUnitCombat(attacker);
      renderBases();
      renderUnits();
      renderProductionPanel();
      renderSelectedUnitPanel();
      return;
    }

    this.scheduleCombatTick(attacker.id, attacker.attackCooldownMs);
  }

  clearUnitCombat(unit) {
    if (!unit) return;
    unit.combatStatus = unit.status === 'destroyed' ? 'destroyed' : 'idle';
    unit.currentTargetId = null;
    unit.targetType = null;
    unit.silentCombat = false;
  }
}

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

class CountrySystem {
  constructor(gameState, scheduler) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.started = false;
  }

  ensureCountry(name, aiControlled = false) {
    if (!name) return null;
    if (!this.gameState.countries[name]) {
      this.gameState.countries[name] = {
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        aiControlled,
        treasury: ECONOMY_CONFIG.defaultTreasury,
        population: COUNTRY_CONFIG.basePopulation,
        stability: 70,
        unrest: 18,
        warWeariness: 8,
        economicStress: 14,
        oil: RESOURCE_CONFIG.defaultOil,
        maxOil: RESOURCE_CONFIG.defaultMaxOil,
        oilPerTick: 0,
        manpowerPool: RESOURCE_CONFIG.defaultManpowerPool,
        manpowerRegenPerTick: 0,
        industrialCapacity: 20,
        manpower: COUNTRY_CONFIG.baseManpower,
        militaryReadiness: 50,
        energy: 100,
        relations: {},
        policy: {
          militarySpendingLevel: 'normal',
          industryInvestmentLevel: 'normal',
          internalSecurityLevel: 'normal'
        },
        policyModifiers: {
          stability: 0,
          industrialCapacity: 0,
          manpower: 0,
          readiness: 0
        },
        policyDailyCost: 0,
        policyLastTickAt: null,
        domesticOutputModifier: 1,
        domesticLastTickAt: null,
        domesticAlertBucket: 'stable',
        controlledCityIds: [],
        controlledBaseIds: [],
        controlledUnitIds: [],
        incomePerTick: 0,
        upkeepPerTick: 0,
        netPerTick: 0
      };
    } else if (aiControlled) {
      this.gameState.countries[name].aiControlled = true;
    }
    const country = this.gameState.countries[name];
    country.policy = country.policy || {
      militarySpendingLevel: 'normal',
      industryInvestmentLevel: 'normal',
      internalSecurityLevel: 'normal'
    };
    country.policyModifiers = country.policyModifiers || {
      stability: 0,
      industrialCapacity: 0,
      manpower: 0,
      readiness: 0
    };
    if (typeof country.policyDailyCost !== 'number') country.policyDailyCost = 0;
    if (country.policyLastTickAt == null) country.policyLastTickAt = null;
    if (typeof country.militaryReadiness !== 'number') country.militaryReadiness = 50;
    if (typeof country.unrest !== 'number') country.unrest = 18;
    if (typeof country.warWeariness !== 'number') country.warWeariness = 8;
    if (typeof country.economicStress !== 'number') country.economicStress = 14;
    if (typeof country.domesticOutputModifier !== 'number') country.domesticOutputModifier = 1;
    if (country.domesticLastTickAt == null) country.domesticLastTickAt = null;
    if (!country.domesticAlertBucket) country.domesticAlertBucket = 'stable';
    if (typeof country.oil !== 'number') country.oil = RESOURCE_CONFIG.defaultOil;
    if (typeof country.maxOil !== 'number') country.maxOil = RESOURCE_CONFIG.defaultMaxOil;
    if (typeof country.oilPerTick !== 'number') country.oilPerTick = 0;
    if (typeof country.manpowerPool !== 'number') country.manpowerPool = RESOURCE_CONFIG.defaultManpowerPool;
    if (typeof country.manpowerRegenPerTick !== 'number') country.manpowerRegenPerTick = 0;
    return country;
  }

  getCountry(name) {
    return this.ensureCountry(name);
  }

  syncOwnership() {
    Object.values(this.gameState.countries).forEach((country) => {
      country.controlledCityIds = [];
      country.controlledBaseIds = [];
      country.controlledUnitIds = [];
      country.incomePerTick = 0;
      country.upkeepPerTick = 0;
      country.netPerTick = 0;
    });

    this.gameState.cities.forEach((city) => {
      if (city.status === 'destroyed') return;
      const country = this.ensureCountry(city.ownerCountry);
      country.controlledCityIds.push(city.id);
      country.incomePerTick += ECONOMY_CONFIG.cityIncomePerDay;
    });

    this.gameState.bases.forEach((base) => {
      if (base.status === 'destroyed' || base.combatStatus === 'destroyed') return;
      const country = this.ensureCountry(base.ownerCountry);
      country.controlledBaseIds.push(base.id);
      country.upkeepPerTick += ECONOMY_CONFIG.baseUpkeepPerDay[base.type] || 0;
    });

    this.gameState.units.forEach((unit) => {
      if (unit.status === 'destroyed') return;
      const country = this.ensureCountry(unit.ownerCountry);
      country.controlledUnitIds.push(unit.id);
      country.upkeepPerTick += ECONOMY_CONFIG.unitUpkeepPerDay[unit.type] || 0;
    });

    Object.values(this.gameState.countries).forEach((country) => {
      country.netPerTick = country.incomePerTick - country.upkeepPerTick;
      const basePopulation = COUNTRY_CONFIG.basePopulation + country.controlledCityIds.length * COUNTRY_CONFIG.cityPopulation;
      const baseIndustry = 20 + country.controlledCityIds.length * COUNTRY_CONFIG.cityIndustry + country.controlledBaseIds.length * COUNTRY_CONFIG.baseIndustry;
      const baseManpower = COUNTRY_CONFIG.baseManpower + country.controlledCityIds.length * COUNTRY_CONFIG.cityManpower;
      const domesticPenalty = (country.unrest || 0) * 0.18 + (country.warWeariness || 0) * 0.14 + (country.economicStress || 0) * 0.2;
      const baseStability = 78 + Math.min(10, country.netPerTick / 100) - domesticPenalty / 10;
      const baseReadiness = 45 + country.controlledBaseIds.length * 2 + country.controlledUnitIds.length * 0.6;
      country.population = basePopulation;
      country.industrialCapacity = Math.max(1, baseIndustry + (country.policyModifiers?.industrialCapacity || 0));
      country.manpower = Math.max(0, baseManpower + (country.policyModifiers?.manpower || 0));
      country.stability = Math.max(0, Math.min(100, baseStability + (country.policyModifiers?.stability || 0)));
      country.militaryReadiness = Math.max(0, Math.min(100, baseReadiness + (country.policyModifiers?.readiness || 0)));
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + COUNTRY_CONFIG.tickMs,
      type: 'COUNTRY_TICK',
      payload: {},
      handler: () => {
        this.syncOwnership();
        refreshCountryHud();
        this.scheduleTick();
      }
    });
  }
}

class ResourceSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.started = false;
  }

  getUnitResourceCost(unitType) {
    return RESOURCE_CONFIG.productionCosts[unitType] || { manpower: 0, oil: 0 };
  }

  getIndustryBuildFactor(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    const industry = Math.max(1, country.industrialCapacity || 1);
    return Math.max(0.65, Math.min(1.65, 35 / industry));
  }

  canSpend(countryName, cost) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return { ok: false, message: 'Country not found.' };
    if ((cost.manpower || 0) > country.manpowerPool) return { ok: false, message: 'Not enough manpower.' };
    if ((cost.oil || 0) > country.oil) return { ok: false, message: 'Not enough oil.' };
    return { ok: true };
  }

  spend(countryName, cost) {
    const country = this.countrySystem.ensureCountry(countryName);
    const check = this.canSpend(countryName, cost);
    if (!check.ok) return check;
    country.manpowerPool = Math.max(0, country.manpowerPool - (cost.manpower || 0));
    country.oil = Math.max(0, country.oil - (cost.oil || 0));
    return { ok: true };
  }

  consumeOperationalOil(countryName, amount) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    if (country.oil < amount) return false;
    country.oil -= amount;
    return true;
  }

  processCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const cityCount = country.controlledCityIds.length;
    const baseCount = country.controlledBaseIds.length;
    const stabilityFactor = Math.max(0.7, Math.min(1.1, (country.stability || 50) / 80));

    const oilGain = Math.max(0, (8 + cityCount * 2.2 + baseCount * 0.8) * (1 - pressure.oilPenalty) * stabilityFactor);
    const manpowerGain = Math.max(0, 40 + cityCount * 14 + Math.round((country.population || 0) / 600000) - (country.unrest || 0) * 0.4);
    country.oilPerTick = oilGain;
    country.manpowerRegenPerTick = manpowerGain;
    country.oil = Math.max(0, Math.min(country.maxOil, country.oil + oilGain));
    country.manpowerPool = Math.max(0, Math.min(RESOURCE_CONFIG.manpowerPoolMax, country.manpowerPool + manpowerGain));
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.processCountry(countryName));
    this.gameState.resources.lastTickAt = this.gameState.currentTimeMs;
    refreshCountryHud();
    refreshDomesticHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + RESOURCE_CONFIG.tickMs,
      type: 'RESOURCE_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }
}

class DiplomacySystem {
  constructor(gameState, scheduler, countrySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.started = false;
  }

  pairKey(countryA, countryB) {
    const [a, b] = [countryA, countryB].sort((x, y) => x.localeCompare(y));
    return `${a}::${b}`;
  }

  clampScore(score) {
    return Math.max(DIPLOMACY_CONFIG.minScore, Math.min(DIPLOMACY_CONFIG.maxScore, Math.round(score)));
  }

  deriveStatusFromScore(score) {
    if (score >= DIPLOMACY_CONFIG.friendlyThreshold) return 'friendly';
    if (score <= DIPLOMACY_CONFIG.hostileThreshold) return 'hostile';
    return 'neutral';
  }

  ensureRelation(countryA, countryB) {
    if (!countryA || !countryB || countryA === countryB) return null;
    this.countrySystem.ensureCountry(countryA);
    this.countrySystem.ensureCountry(countryB);
    const key = this.pairKey(countryA, countryB);
    if (!this.gameState.diplomacy.relationsByPair[key]) {
      const [a, b] = key.split('::');
      this.gameState.diplomacy.relationsByPair[key] = {
        countryA: a,
        countryB: b,
        relationScore: 0,
        status: 'neutral',
        tradeAllowed: true,
        sanctions: false,
        sanctionsLevel: 'none',
        sanctionsSourceCountry: null,
        sanctionsStartedAt: null,
        sanctionsBySource: {},
        lastChangedAt: this.gameState.currentTimeMs,
        lastConflictAt: null
      };
    }
    return this.gameState.diplomacy.relationsByPair[key];
  }

  getRelation(countryA, countryB) {
    return this.ensureRelation(countryA, countryB);
  }

  updateStatusFromScore(relation, preserveWar = true) {
    if (!relation) return;
    if (preserveWar && relation.status === 'war') return;
    relation.status = this.deriveStatusFromScore(relation.relationScore);
  }

  adjustRelationScore(countryA, countryB, delta, reason = 'Relation changed', markConflict = false) {
    const relation = this.ensureRelation(countryA, countryB);
    if (!relation) return null;
    relation.relationScore = this.clampScore(relation.relationScore + delta);
    relation.lastChangedAt = this.gameState.currentTimeMs;
    if (markConflict) relation.lastConflictAt = this.gameState.currentTimeMs;
    this.updateStatusFromScore(relation, true);
    this.gameState.diplomacy.lastSummary = `${relation.countryA} ↔ ${relation.countryB}: ${reason} (${relation.relationScore})`;
    return relation;
  }

  setStatus(countryA, countryB, status, reason = 'Diplomacy status changed') {
    const relation = this.ensureRelation(countryA, countryB);
    if (!relation) return null;
    relation.status = status;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    if (status === 'war') relation.lastConflictAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${relation.countryA} ↔ ${relation.countryB}: ${reason}`;
    return relation;
  }

  declareWar(countryA, countryB, reason = 'War declared') {
    const relation = this.setStatus(countryA, countryB, 'war', reason);
    if (!relation) return null;
    relation.relationScore = this.clampScore(Math.min(relation.relationScore, -70));
    relation.tradeAllowed = false;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    relation.sanctionsBySource[countryA] = {
      sanctionsLevel: relation.sanctionsBySource[countryA]?.sanctionsLevel || 'none',
      tradeAllowed: false,
      startedAt: relation.sanctionsBySource[countryA]?.startedAt || null
    };
    relation.sanctionsBySource[countryB] = {
      sanctionsLevel: relation.sanctionsBySource[countryB]?.sanctionsLevel || 'none',
      tradeAllowed: false,
      startedAt: relation.sanctionsBySource[countryB]?.startedAt || null
    };
    return relation;
  }

  makePeace(countryA, countryB, reason = 'Peace declared') {
    const relation = this.ensureRelation(countryA, countryB);
    if (!relation) return null;
    relation.relationScore = this.clampScore(Math.max(relation.relationScore, -20));
    relation.tradeAllowed = true;
    relation.sanctions = false;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    relation.status = this.deriveStatusFromScore(relation.relationScore);
    this.gameState.diplomacy.lastSummary = `${relation.countryA} ↔ ${relation.countryB}: ${reason}`;
    return relation;
  }

  canStartOffensiveAction(attackerCountry, targetCountry) {
    if (!attackerCountry || !targetCountry) return { ok: false, message: 'Missing country context.' };
    if (attackerCountry === targetCountry) return { ok: false, message: 'Offensive actions against own country are blocked.' };
    const relation = this.ensureRelation(attackerCountry, targetCountry);
    if (relation.status === 'war') return { ok: true, relation, autoDeclaredWar: false };
    const declared = this.declareWar(attackerCountry, targetCountry, `${attackerCountry} initiated military action against ${targetCountry}.`);
    return {
      ok: true,
      relation: declared,
      autoDeclaredWar: true,
      message: `War declared: ${attackerCountry} vs ${targetCountry}.`
    };
  }

  getRelationsForCountry(countryName) {
    if (!countryName) return [];
    return Object.values(this.gameState.diplomacy.relationsByPair)
      .filter((relation) => relation.countryA === countryName || relation.countryB === countryName)
      .map((relation) => ({
        ...relation,
        counterpart: relation.countryA === countryName ? relation.countryB : relation.countryA
      }))
      .sort((a, b) => a.counterpart.localeCompare(b.counterpart));
  }

  getDirectionalPressure(sourceCountry, targetCountry) {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation) return { sanctionsLevel: 'none', tradeAllowed: true, startedAt: null };
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    const sourceState = relation.sanctionsBySource[sourceCountry];
    return sourceState || { sanctionsLevel: 'none', tradeAllowed: true, startedAt: null };
  }

  imposeSanctions(sourceCountry, targetCountry, level = 'light') {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation || !['light', 'heavy'].includes(level)) return null;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    relation.sanctionsBySource[sourceCountry] = {
      sanctionsLevel: level,
      tradeAllowed: relation.sanctionsBySource[sourceCountry]?.tradeAllowed ?? true,
      startedAt: this.gameState.currentTimeMs
    };
    relation.sanctions = true;
    relation.sanctionsLevel = level;
    relation.sanctionsSourceCountry = sourceCountry;
    relation.sanctionsStartedAt = this.gameState.currentTimeMs;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${sourceCountry} imposed ${level} sanctions on ${targetCountry}.`;
    return relation;
  }

  liftSanctions(sourceCountry, targetCountry) {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation) return null;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    relation.sanctionsBySource[sourceCountry] = {
      sanctionsLevel: 'none',
      tradeAllowed: relation.sanctionsBySource[sourceCountry]?.tradeAllowed ?? true,
      startedAt: null
    };
    const activeLevels = Object.values(relation.sanctionsBySource)
      .map((state) => state.sanctionsLevel)
      .filter((level) => level && level !== 'none');
    const stillSanctioned = activeLevels.length > 0;
    relation.sanctions = stillSanctioned;
    relation.sanctionsLevel = activeLevels.includes('heavy') ? 'heavy' : (activeLevels.includes('light') ? 'light' : 'none');
    if (!stillSanctioned) relation.sanctionsSourceCountry = null;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${sourceCountry} lifted sanctions on ${targetCountry}.`;
    return relation;
  }

  setTradeAllowed(sourceCountry, targetCountry, allowed) {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation) return null;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    const existing = relation.sanctionsBySource[sourceCountry] || { sanctionsLevel: 'none', tradeAllowed: true, startedAt: null };
    relation.sanctionsBySource[sourceCountry] = { ...existing, tradeAllowed: Boolean(allowed) };
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${sourceCountry} ${allowed ? 'allowed' : 'blocked'} trade with ${targetCountry}.`;
    return relation;
  }

  getEconomicPressureOnCountry(targetCountry) {
    const incoming = this.getRelationsForCountry(targetCountry)
      .map((relation) => {
        const source = relation.counterpart;
        return { source, state: this.getDirectionalPressure(source, targetCountry) };
      })
      .filter(({ state }) => (state.sanctionsLevel && state.sanctionsLevel !== 'none') || state.tradeAllowed === false);

    let incomeMultiplier = 1;
    let industryMultiplier = 1;
    let stressDrift = 0;
    let stabilityDrift = 0;
    let blockedTradeCount = 0;
    let oilPenalty = 0;

    incoming.forEach(({ state }) => {
      if (state.sanctionsLevel === 'light') {
        incomeMultiplier *= 0.9;
        industryMultiplier *= 0.92;
        stressDrift += 0.12;
        oilPenalty += 0.05;
      } else if (state.sanctionsLevel === 'heavy') {
        incomeMultiplier *= 0.75;
        industryMultiplier *= 0.8;
        stressDrift += 0.3;
        stabilityDrift += 0.04;
        oilPenalty += 0.14;
      }
      if (state.tradeAllowed === false) {
        incomeMultiplier *= 0.95;
        industryMultiplier *= 0.96;
        stressDrift += 0.06;
        blockedTradeCount += 1;
        oilPenalty += 0.03;
      }
    });

    return {
      incomingCount: incoming.length,
      blockedTradeCount,
      incomeMultiplier: Math.max(0.45, incomeMultiplier),
      industryMultiplier: Math.max(0.5, industryMultiplier),
      oilPenalty: Math.max(0, Math.min(0.5, oilPenalty)),
      stressDrift,
      stabilityDrift
    };
  }

  tick() {
    Object.values(this.gameState.diplomacy.relationsByPair).forEach((relation) => {
      if (relation.status === 'war') return;
      if (relation.relationScore === 0) return;
      const drift = relation.relationScore > 0 ? -DIPLOMACY_CONFIG.normalizationStep : DIPLOMACY_CONFIG.normalizationStep;
      relation.relationScore = this.clampScore(relation.relationScore + drift);
      relation.lastChangedAt = this.gameState.currentTimeMs;
      this.updateStatusFromScore(relation, false);
    });
    refreshDiplomacyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + DIPLOMACY_CONFIG.tickMs,
      type: 'DIPLOMACY_TICK',
      payload: {},
      handler: () => this.tick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }
}

class PolicySystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.started = false;
  }

  getPolicyLevel(countryName, policyKey) {
    const country = this.countrySystem.ensureCountry(countryName);
    return country.policy[policyKey] || 'normal';
  }

  setPolicyLevel(countryName, policyKey, level) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country || !POLICY_CONFIG.levels.includes(level)) return null;
    country.policy[policyKey] = level;
    this.updateCountryPolicyCost(countryName);
    this.gameState.policy.lastSummary = `${countryName} set ${policyKey} to ${level}.`;
    return country.policy;
  }

  setPolicyBundle(countryName, nextPolicies) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    ['militarySpendingLevel', 'industryInvestmentLevel', 'internalSecurityLevel'].forEach((policyKey) => {
      const next = nextPolicies[policyKey];
      if (next && POLICY_CONFIG.levels.includes(next)) country.policy[policyKey] = next;
    });
    this.updateCountryPolicyCost(countryName);
    this.gameState.policy.lastSummary = `${countryName} policy bundle updated.`;
    return country.policy;
  }

  getDailyPolicyCost(policyState) {
    return POLICY_CONFIG.dailyCosts.militarySpendingLevel[policyState.militarySpendingLevel]
      + POLICY_CONFIG.dailyCosts.industryInvestmentLevel[policyState.industryInvestmentLevel]
      + POLICY_CONFIG.dailyCosts.internalSecurityLevel[policyState.internalSecurityLevel];
  }

  updateCountryPolicyCost(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return 0;
    country.policyDailyCost = this.getDailyPolicyCost(country.policy);
    return country.policyDailyCost;
  }

  applyCountryPolicyTick(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;

    const policy = country.policy;
    const militaryEffect = POLICY_CONFIG.dailyEffects.militarySpendingLevel[policy.militarySpendingLevel];
    const industryEffect = POLICY_CONFIG.dailyEffects.industryInvestmentLevel[policy.industryInvestmentLevel];
    const securityEffect = POLICY_CONFIG.dailyEffects.internalSecurityLevel[policy.internalSecurityLevel];
    const dailyCost = this.updateCountryPolicyCost(countryName);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);

    country.treasury -= dailyCost;
    country.treasury += (industryEffect.treasuryBonus || 0);

    const activeWars = this.diplomacySystem.getRelationsForCountry(countryName).filter((relation) => relation.status === 'war').length;
    const warStabilityPenalty = activeWars * 0.07;
    const debtPenalty = country.treasury < 0 ? 0.2 : 0;

    const unrestPenaltyFactor = Math.max(0.45, 1 - (country.unrest || 0) / 170);
    country.policyModifiers.industrialCapacity += industryEffect.industrialCapacity * unrestPenaltyFactor * pressure.industryMultiplier;
    country.policyModifiers.manpower += militaryEffect.manpower * Math.max(0.55, 1 - (country.warWeariness || 0) / 220);
    country.policyModifiers.stability += militaryEffect.stability + securityEffect.stability - warStabilityPenalty - debtPenalty;
    country.policyModifiers.readiness += militaryEffect.readiness + securityEffect.readiness;
    country.policyModifiers.stability = Math.max(-40, Math.min(40, country.policyModifiers.stability));
    country.policyModifiers.industrialCapacity = Math.max(-20, Math.min(180, country.policyModifiers.industrialCapacity));
    country.policyModifiers.manpower = Math.max(-5000, Math.min(40_000, country.policyModifiers.manpower));
    country.policyModifiers.readiness = Math.max(-40, Math.min(40, country.policyModifiers.readiness));
    country.policyLastTickAt = this.gameState.currentTimeMs;
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.applyCountryPolicyTick(countryName));
    this.countrySystem.syncOwnership();
    this.gameState.policy.lastTickAt = this.gameState.currentTimeMs;
    refreshCountryHud();
    refreshPolicyHud();
    refreshEconomyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + POLICY_CONFIG.tickMs,
      type: 'POLICY_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }
}

class DomesticStateSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, policySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.policySystem = policySystem;
    this.started = false;
  }

  clamp(value) {
    return Math.max(DOMESTIC_CONFIG.clampMin, Math.min(DOMESTIC_CONFIG.clampMax, value));
  }

  getStabilityBucket(stability) {
    if (stability < 30) return 'fragile';
    if (stability < 55) return 'strained';
    return 'stable';
  }

  updateCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    const policy = country.policy || {};
    const internalSecurity = policy.internalSecurityLevel || 'normal';
    const militarySpending = policy.militarySpendingLevel || 'normal';
    const activeWars = this.diplomacySystem.getRelationsForCountry(countryName).filter((relation) => relation.status === 'war').length;
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const oilShortage = country.oil < RESOURCE_CONFIG.oilShortageThreshold ? 0.18 : 0;
    const industryStrain = country.industrialCapacity < 22 ? 0.14 : 0;
    const manpowerShortage = country.manpowerPool < 1200 ? 0.12 : 0;

    country.warWeariness = this.clamp(country.warWeariness + (activeWars > 0 ? 0.4 + activeWars * 0.2 : -0.3) + (militarySpending === 'high' ? 0.08 : 0));
    country.economicStress = this.clamp(country.economicStress
      + (country.treasury < 0 ? 0.6 + Math.min(0.35, Math.abs(country.treasury) / 10000) : -0.22)
      + (country.netPerTick < 0 ? 0.25 : -0.1)
      + (policy.industryInvestmentLevel === 'high' && country.treasury < 1000 ? 0.1 : 0)
      + pressure.stressDrift
      + oilShortage
      + industryStrain);

    const unrestDrift = 0.06
      + country.warWeariness * 0.004
      + country.economicStress * 0.005
      + DOMESTIC_CONFIG.unrestSecurityDrift[internalSecurity];
    country.unrest = this.clamp(country.unrest + unrestDrift + (country.stability < 40 ? 0.15 : -0.06));

    const stabilityDelta = 0.14
      + DOMESTIC_CONFIG.stabilitySecurityBonus[internalSecurity]
      - country.unrest * 0.01
      - country.warWeariness * 0.008
      - country.economicStress * 0.009
      - activeWars * 0.06
      - pressure.stabilityDrift
      - manpowerShortage;
    country.stability = this.clamp(country.stability + stabilityDelta);
    country.domesticOutputModifier = Math.max(
      0.65,
      Math.min(1.05, 1 - Math.max(0, (45 - country.stability) / 230) - country.unrest / 520 - country.economicStress / 680)
    );
    country.domesticLastTickAt = this.gameState.currentTimeMs;

    const bucket = this.getStabilityBucket(country.stability);
    const playerCountry = this.gameState.selectedPlayerCountry && this.gameState.selectedPlayerCountry.properties.name;
    if (countryName === playerCountry && bucket !== country.domesticAlertBucket) {
      setStatus(`Domestic condition changed: ${countryName} is now ${bucket}.`);
      country.domesticAlertBucket = bucket;
    }
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.updateCountry(countryName));
    this.gameState.domestic.lastTickAt = this.gameState.currentTimeMs;
    this.gameState.domestic.lastSummary = 'Domestic pressures updated.';
    this.countrySystem.syncOwnership();
    refreshCountryHud();
    refreshDomesticHud();
    refreshEconomyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + DOMESTIC_CONFIG.tickMs,
      type: 'DOMESTIC_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }
}

class EconomySystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
  }

  ensureCountry(countryName) {
    if (!countryName) return;
    const country = this.countrySystem.ensureCountry(countryName);
    this.gameState.economy.treasuryByCountry[countryName] = country.treasury;
  }

  getTreasury(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    this.gameState.economy.treasuryByCountry[countryName] = country.treasury;
    return country.treasury || 0;
  }

  canAfford(countryName, cost) {
    return this.getTreasury(countryName) >= cost;
  }

  spend(countryName, amount, reason) {
    this.ensureCountry(countryName);
    if (!this.canAfford(countryName, amount)) return false;
    const country = this.countrySystem.ensureCountry(countryName);
    country.treasury -= amount;
    this.gameState.economy.treasuryByCountry[countryName] = country.treasury;
    this.gameState.economy.lastSummary = `${countryName} spent ${amount} (${reason})`;
    return true;
  }

  startEconomyLoop() {
    if (this.gameState.economy.started) return;
    this.gameState.economy.started = true;
    this.scheduleNextTick();
  }

  scheduleNextTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + ECONOMY_CONFIG.tickMs,
      type: 'ECONOMY_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  processTick() {
    this.countrySystem.syncOwnership();
    const incomeByCountry = {};
    const upkeepByCountry = {};

    this.gameState.cities.forEach((city) => {
      if (city.status === 'destroyed') return;
      this.ensureCountry(city.ownerCountry);
      const country = this.countrySystem.ensureCountry(city.ownerCountry);
      const pressure = this.diplomacySystem.getEconomicPressureOnCountry(city.ownerCountry);
      const adjustedIncome = ECONOMY_CONFIG.cityIncomePerDay * (country.domesticOutputModifier || 1) * pressure.incomeMultiplier;
      incomeByCountry[city.ownerCountry] = (incomeByCountry[city.ownerCountry] || 0) + adjustedIncome;
    });

    this.gameState.bases.forEach((base) => {
      if (base.status === 'destroyed' || base.combatStatus === 'destroyed') return;
      this.ensureCountry(base.ownerCountry);
      upkeepByCountry[base.ownerCountry] = (upkeepByCountry[base.ownerCountry] || 0) + (ECONOMY_CONFIG.baseUpkeepPerDay[base.type] || 0);
    });

    this.gameState.units.forEach((unit) => {
      if (unit.status === 'destroyed') return;
      this.ensureCountry(unit.ownerCountry);
      upkeepByCountry[unit.ownerCountry] = (upkeepByCountry[unit.ownerCountry] || 0) + (ECONOMY_CONFIG.unitUpkeepPerDay[unit.type] || 0);
    });

    const countries = new Set([...Object.keys(incomeByCountry), ...Object.keys(upkeepByCountry)]);
    countries.forEach((country) => {
      this.ensureCountry(country);
      const income = incomeByCountry[country] || 0;
      const upkeep = upkeepByCountry[country] || 0;
      const net = income - upkeep;
      const countryState = this.countrySystem.ensureCountry(country);
      countryState.treasury += net;
      this.gameState.economy.treasuryByCountry[country] = countryState.treasury;
      this.gameState.economy.lastTickAt = this.gameState.currentTimeMs;
      const isPlayer = this.gameState.selectedPlayerCountry && country === this.gameState.selectedPlayerCountry.properties.name;
      if (isPlayer) {
        this.gameState.economy.lastSummary = `Daily tick: +${income} income, -${upkeep} upkeep, net ${net >= 0 ? '+' : ''}${net}`;
      }
    });

    this.scheduleNextTick();
    refreshEconomyHud();
  }
}

class AISystem {
  constructor(gameState, scheduler, systems) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.productionSystem = systems.productionSystem;
    this.movementSystem = systems.movementSystem;
    this.combatSystem = systems.combatSystem;
    this.captureSystem = systems.captureSystem;
    this.economySystem = systems.economySystem;
    this.policySystem = systems.policySystem;
    this.diplomacySystem = systems.diplomacySystem;
    this.resourceSystem = systems.resourceSystem;
    this.countrySystem = systems.countrySystem;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleNext();
  }

  scheduleNext() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + AI_CONFIG.tickMs,
      type: 'AI_TICK',
      payload: {},
      handler: () => this.tick()
    });
  }

  tick() {
    this.gameState.aiCountries.forEach((country) => {
      this.evaluateStrategicState(country);
      this.runCountryTick(country);
    });
    this.scheduleNext();
  }

  ensureAiState(countryName) {
    if (!this.gameState.aiStateByCountry[countryName]) {
      this.gameState.aiStateByCountry[countryName] = {
        posture: 'build_up',
        lastPostureChangeAt: 0,
        lastPolicyChangeAt: 0,
        lastDiplomacyActionAt: 0,
        notes: 'Initial posture'
      };
    }
    return this.gameState.aiStateByCountry[countryName];
  }

  evaluateStrategicState(countryName) {
    const state = this.ensureAiState(countryName);
    const country = this.countrySystem.ensureCountry(countryName);
    const now = this.gameState.currentTimeMs;
    const relations = this.diplomacySystem.getRelationsForCountry(countryName);
    const activeWars = relations.filter((relation) => relation.status === 'war');
    const hostileRelations = relations.filter((relation) => relation.status === 'hostile' || relation.relationScore < -45);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const strongestRival = [...relations].sort((a, b) => a.relationScore - b.relationScore)[0];

    let nextPosture = state.posture;
    if (country.warWeariness > 65 || country.stability < 28) {
      nextPosture = 'seek_peace';
    } else if (country.stability < 45 || country.unrest > 55 || country.economicStress > 62) {
      nextPosture = 'stabilize';
    } else if (country.treasury < 900 || country.oil < 70 || country.manpowerPool < 1200 || pressure.incomingCount > 0) {
      nextPosture = 'defend';
    } else if (hostileRelations.length && country.treasury > 2500 && country.stability > 55) {
      nextPosture = 'pressure_rival';
    } else if (!activeWars.length && country.industrialCapacity > 55 && country.manpowerPool > 3500) {
      nextPosture = 'expand';
    } else {
      nextPosture = 'build_up';
    }

    if (nextPosture !== state.posture && now - state.lastPostureChangeAt >= AI_CONFIG.postureCooldownMs) {
      state.posture = nextPosture;
      state.lastPostureChangeAt = now;
      state.notes = `Shifted to ${nextPosture}`;
      if (this.gameState.selectedCountryForHud === countryName) setStatus(`AI posture changed: ${countryName} -> ${nextPosture}`);
    }

    if (now - state.lastPolicyChangeAt >= AI_CONFIG.policyCooldownMs) {
      const nextPolicy = this.buildPolicyForPosture(state.posture, country);
      const changed = country.policy.militarySpendingLevel !== nextPolicy.militarySpendingLevel
        || country.policy.industryInvestmentLevel !== nextPolicy.industryInvestmentLevel
        || country.policy.internalSecurityLevel !== nextPolicy.internalSecurityLevel;
      if (changed) {
        this.policySystem.setPolicyBundle(countryName, nextPolicy);
        state.lastPolicyChangeAt = now;
      }
    }

    if (now - state.lastDiplomacyActionAt >= AI_CONFIG.diplomacyCooldownMs && strongestRival) {
      this.applyDiplomacyPosture(countryName, strongestRival.counterpart, strongestRival, state.posture, country);
      state.lastDiplomacyActionAt = now;
    }
  }

  buildPolicyForPosture(posture, country) {
    if (posture === 'seek_peace' || posture === 'stabilize') {
      return {
        militarySpendingLevel: country.treasury < 1400 ? 'low' : 'normal',
        industryInvestmentLevel: country.economicStress > 60 ? 'low' : 'normal',
        internalSecurityLevel: 'high'
      };
    }
    if (posture === 'defend') {
      return {
        militarySpendingLevel: country.treasury > 1800 ? 'normal' : 'low',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: 'normal'
      };
    }
    if (posture === 'pressure_rival' || posture === 'expand') {
      return {
        militarySpendingLevel: 'high',
        industryInvestmentLevel: country.treasury > 2600 ? 'high' : 'normal',
        internalSecurityLevel: 'normal'
      };
    }
    return {
      militarySpendingLevel: 'normal',
      industryInvestmentLevel: 'normal',
      internalSecurityLevel: 'normal'
    };
  }

  applyDiplomacyPosture(countryName, rivalName, relation, posture, country) {
    if (!rivalName) return;
    if (posture === 'seek_peace' && relation.status === 'war') {
      this.diplomacySystem.makePeace(countryName, rivalName, `${countryName} sought de-escalation due to war strain.`);
      return;
    }
    if (posture === 'pressure_rival' && relation.relationScore < -25) {
      if (country.treasury > 1800) this.diplomacySystem.imposeSanctions(countryName, rivalName, relation.relationScore < -55 ? 'heavy' : 'light');
      return;
    }
    if (posture === 'stabilize' && relation.status !== 'war') {
      this.diplomacySystem.liftSanctions(countryName, rivalName);
    }
  }

  runCountryTick(country) {
    const aiState = this.ensureAiState(country);
    const posture = aiState.posture;
    const aiBases = this.gameState.bases.filter((b) => b.ownerCountry === country && b.status === 'active' && b.combatStatus !== 'destroyed');
    const aiUnits = this.gameState.units.filter((u) => u.ownerCountry === country && u.status === 'active');
    const warCountries = new Set(this.diplomacySystem.getRelationsForCountry(country).filter((relation) => relation.status === 'war').map((relation) => relation.counterpart));
    const canGoOffensive = ['expand', 'pressure_rival'].includes(posture) || warCountries.size > 0;
    const targetFilter = (ownerCountry) => ownerCountry !== country && (canGoOffensive || warCountries.has(ownerCountry));
    const enemyCities = this.gameState.cities.filter((c) => targetFilter(c.ownerCountry) && c.status !== 'destroyed');
    const enemyBases = this.gameState.bases.filter((b) => targetFilter(b.ownerCountry) && b.combatStatus !== 'destroyed');
    const enemyUnits = this.gameState.units.filter((u) => targetFilter(u.ownerCountry) && u.status !== 'destroyed');
    const countryState = this.countrySystem.ensureCountry(country);
    const lowOil = countryState.oil < 70;
    const lowManpower = countryState.manpowerPool < 1600;

    aiBases.forEach((base) => {
      if (base.production.currentUnitId || base.production.queue.length) return;
      let options = this.productionSystem.getAllowedUnitsForBase(base).sort((a, b) => (ECONOMY_CONFIG.unitBuildCost[a.key] || 0) - (ECONOMY_CONFIG.unitBuildCost[b.key] || 0));
      if (lowOil) options = options.filter((option) => (this.resourceSystem.getUnitResourceCost(option.key).oil || 0) < 25);
      if (lowManpower || posture === 'stabilize') options = options.filter((option) => (this.resourceSystem.getUnitResourceCost(option.key).manpower || 0) <= 220);
      if (posture === 'defend') options = options.filter((option) => option.domain !== 'air');
      for (const option of options) {
        const result = this.productionSystem.queueUnit(base.id, option.key, country);
        if (result.ok) break;
      }
    });

    aiUnits.forEach((unit) => {
      if (unit.movement || unit.captureTarget || unit.combatStatus === 'attacking' || unit.combatStatus === 'defending') return;
      if ((posture === 'stabilize' || posture === 'seek_peace') && !warCountries.size) return;

      const capturableCity = enemyCities.find((city) => this.distanceKm(unit, city.lonLat) <= CAPTURE_CONFIG.captureRangeKm && unit.domain === 'ground');
      if (capturableCity && canGoOffensive) {
        this.captureSystem.startCapture(unit.id, 'city', capturableCity.id, true);
        return;
      }
      const capturableBase = enemyBases.find((base) => this.distanceKm(unit, base.lonLat) <= CAPTURE_CONFIG.captureRangeKm && unit.domain === 'ground');
      if (capturableBase && canGoOffensive) {
        this.captureSystem.startCapture(unit.id, 'base', capturableBase.id, true);
        return;
      }

      const attackableUnit = enemyUnits.find((target) => this.distanceKm(unit, this.movementSystem.getDisplayLonLat(target)) <= unit.rangeKm);
      if (attackableUnit) {
        this.combatSystem.startAttack(unit.id, 'unit', attackableUnit.id, false, true);
        return;
      }
      const attackableBase = enemyBases.find((target) => this.distanceKm(unit, target.lonLat) <= unit.rangeKm);
      if (attackableBase) {
        this.combatSystem.startAttack(unit.id, 'base', attackableBase.id, false, true);
        return;
      }

      const nearestTarget = this.findNearestTargetLonLat(unit, [...enemyCities.map((c) => c.lonLat), ...enemyBases.map((b) => b.lonLat)]);
      if (nearestTarget && (canGoOffensive || warCountries.size)) {
        this.movementSystem.issueMoveOrder(unit.id, nearestTarget, true);
      }
    });

    if (posture !== 'seek_peace' && posture !== 'stabilize'
      && aiBases.length < AI_CONFIG.baseThreshold
      && this.economySystem.getTreasury(country) >= AI_CONFIG.baseExpansionTreasury
      && countryState.manpowerPool > 1500) {
      const ownedCity = this.gameState.cities.find((city) => city.ownerCountry === country);
      if (ownedCity && this.economySystem.spend(country, ECONOMY_CONFIG.baseBuildCost.ground, 'AI base expansion')) {
        const lonLat = [ownedCity.lonLat[0] + 1.5, ownedCity.lonLat[1] + 1];
        const base = createBase('ground', lonLat, country);
        base.status = 'active';
        base.buildCompleteAt = this.gameState.currentTimeMs;
      }
    }
  }

  distanceKm(unit, lonLat) {
    return d3.geoDistance(this.movementSystem.getDisplayLonLat(unit), lonLat) * 6371;
  }

  findNearestTargetLonLat(unit, targetLonLats) {
    if (!targetLonLats.length) return null;
    let best = targetLonLats[0];
    let bestDistance = this.distanceKm(unit, best);
    for (const target of targetLonLats.slice(1)) {
      const d = this.distanceKm(unit, target);
      if (d < bestDistance) {
        bestDistance = d;
        best = target;
      }
    }
    return best;
  }
}

const gameState = {
  selectedPlayerCountry: null,
  currentTimeMs: Date.parse(GAME_START_ISO),
  simulationSpeed: 1,
  bases: [],
  cities: [],
  units: [],
  pendingTasks: [],
  treasury: 0,
  nextBaseId: 1,
  nextUnitId: 1,
  selectedBaseId: null,
  selectedUnitId: null,
  moveMode: false,
  attackMode: false,
  captureMode: false,
  selectedAsset: null,
  enemySpawned: false,
  aiCountries: [],
  aiStateByCountry: {},
  countries: {},
  selectedCountryForHud: null,
  diplomacy: {
    relationsByPair: {},
    lastSummary: 'No diplomacy events yet.'
  },
  policy: {
    lastTickAt: null,
    lastSummary: 'No policy changes yet.'
  },
  domestic: {
    lastTickAt: null,
    lastSummary: 'No domestic updates yet.'
  },
  resources: {
    lastTickAt: null
  },
  economy: {
    treasuryByCountry: {},
    lastTickAt: null,
    lastSummary: 'No economy tick yet.',
    started: false
  }
};

const gameClock = new GameClock({
  startTimeMs: gameState.currentTimeMs,
  speed: gameState.simulationSpeed
});

const scheduler = new TaskScheduler(gameState);
const countrySystem = new CountrySystem(gameState, scheduler);
const diplomacySystem = new DiplomacySystem(gameState, scheduler, countrySystem);
const resourceSystem = new ResourceSystem(gameState, scheduler, countrySystem, diplomacySystem);
const policySystem = new PolicySystem(gameState, scheduler, countrySystem, diplomacySystem);
const domesticStateSystem = new DomesticStateSystem(gameState, scheduler, countrySystem, diplomacySystem, policySystem);
const productionSystem = new ProductionSystem(gameState, scheduler, resourceSystem);
const movementSystem = new MovementSystem(gameState, scheduler, resourceSystem);
const combatSystem = new CombatSystem(gameState, scheduler, movementSystem, diplomacySystem, resourceSystem);
const captureSystem = new CaptureSystem(gameState, scheduler, movementSystem, diplomacySystem);
const economySystem = new EconomySystem(gameState, scheduler, countrySystem, diplomacySystem);
const aiSystem = new AISystem(gameState, scheduler, {
  productionSystem,
  movementSystem,
  combatSystem,
  captureSystem,
  economySystem,
  policySystem,
  diplomacySystem,
  resourceSystem,
  countrySystem
});

const svg = d3.select('#map');
const mapWrap = document.getElementById('mapWrap');
const tooltip = document.getElementById('tooltip');
const selectedCountryLabel = document.getElementById('selectedCountry');
const cityList = document.getElementById('cityList');
const statusLabel = document.getElementById('status');
const baseButtons = document.getElementById('baseButtons');
const playerProfile = document.getElementById('playerProfile');
const gameDateTime = document.getElementById('gameDateTime');
const simSpeedLabel = document.getElementById('simSpeedLabel');
const treasuryLabel = document.getElementById('treasuryLabel');
const economySummary = document.getElementById('economySummary');
const aiCountriesLabel = document.getElementById('aiCountriesLabel');
const countryHudName = document.getElementById('countryHudName');
const countryHudTreasury = document.getElementById('countryHudTreasury');
const countryHudPop = document.getElementById('countryHudPop');
const countryHudStability = document.getElementById('countryHudStability');
const countryHudOil = document.getElementById('countryHudOil');
const countryHudIndustry = document.getElementById('countryHudIndustry');
const countryHudManpower = document.getElementById('countryHudManpower');
const countryHudStrain = document.getElementById('countryHudStrain');
const countryHudAssets = document.getElementById('countryHudAssets');
const countryHudFlow = document.getElementById('countryHudFlow');
const diplomacyFocusCountry = document.getElementById('diplomacyFocusCountry');
const diplomacySummary = document.getElementById('diplomacySummary');
const diplomacyTargetCountry = document.getElementById('diplomacyTargetCountry');
const declareWarBtn = document.getElementById('declareWarBtn');
const makePeaceBtn = document.getElementById('makePeaceBtn');
const improveRelationsBtn = document.getElementById('improveRelationsBtn');
const worsenRelationsBtn = document.getElementById('worsenRelationsBtn');
const relationsList = document.getElementById('relationsList');
const sanctionsStateLabel = document.getElementById('sanctionsStateLabel');
const tradeStateLabel = document.getElementById('tradeStateLabel');
const sanctionLightBtn = document.getElementById('sanctionLightBtn');
const sanctionHeavyBtn = document.getElementById('sanctionHeavyBtn');
const liftSanctionsBtn = document.getElementById('liftSanctionsBtn');
const toggleTradeBtn = document.getElementById('toggleTradeBtn');
const policyFocusCountry = document.getElementById('policyFocusCountry');
const policySummary = document.getElementById('policySummary');
const militaryPolicySelect = document.getElementById('militaryPolicySelect');
const industryPolicySelect = document.getElementById('industryPolicySelect');
const securityPolicySelect = document.getElementById('securityPolicySelect');
const applyPolicyBtn = document.getElementById('applyPolicyBtn');
const policyCostLabel = document.getElementById('policyCostLabel');
const domesticFocusCountry = document.getElementById('domesticFocusCountry');
const domesticStability = document.getElementById('domesticStability');
const domesticUnrest = document.getElementById('domesticUnrest');
const domesticWarWeariness = document.getElementById('domesticWarWeariness');
const domesticEconomicStress = document.getElementById('domesticEconomicStress');
const domesticTrend = document.getElementById('domesticTrend');
const prodBaseLabel = document.getElementById('prodBaseLabel');
const prodUnitButtons = document.getElementById('prodUnitButtons');
const prodCurrent = document.getElementById('prodCurrent');
const prodQueue = document.getElementById('prodQueue');
const unitCount = document.getElementById('unitCount');
const unitList = document.getElementById('unitList');
const selectedUnitLabel = document.getElementById('selectedUnitLabel');
const selectedUnitMeta = document.getElementById('selectedUnitMeta');
const moveUnitBtn = document.getElementById('moveUnitBtn');
const attackUnitBtn = document.getElementById('attackUnitBtn');
const captureUnitBtn = document.getElementById('captureUnitBtn');
const clearUnitSelectionBtn = document.getElementById('clearUnitSelectionBtn');
const moveModeStatus = document.getElementById('moveModeStatus');
const attackModeStatus = document.getElementById('attackModeStatus');
const captureModeStatus = document.getElementById('captureModeStatus');
const selectedAssetStatus = document.getElementById('selectedAssetStatus');

const overlays = {
  mainMenu: document.getElementById('mainMenu'),
  playFlow: document.getElementById('playFlow'),
  settingsPanel: document.getElementById('settingsPanel')
};

const playTitle = document.getElementById('playTitle');
const playStepCountry = document.getElementById('playStepCountry');
const playStepLeader = document.getElementById('playStepLeader');
const countrySelect = document.getElementById('countrySelect');
const countryWarning = document.getElementById('countryWarning');
const leaderNameInput = document.getElementById('leaderName');
const timeControlButtons = document.getElementById('timeControlButtons');
const skipDayBtn = document.getElementById('skipDayBtn');
const skipWeekBtn = document.getElementById('skipWeekBtn');
const skipMonthBtn = document.getElementById('skipMonthBtn');

const baseTypes = [
  { key: 'ground', label: 'Ground', color: 'var(--base-ground)' },
  { key: 'air', label: 'Air', color: 'var(--base-air)' },
  { key: 'naval', label: 'Naval', color: 'var(--base-naval)' },
  { key: 'antiAir', label: 'Anti-Air', color: 'var(--base-aa)' }
];

const majorCities = [
  { name: 'New York', country: 'United States of America', lat: 40.7128, lon: -74.0060 },
  { name: 'Los Angeles', country: 'United States of America', lat: 34.0522, lon: -118.2437 },
  { name: 'London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276 },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333 },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 }
];

let selectedBaseType = null;
let selectedCountryFeature = null;
let countries = [];
let countriesLayer;
let basesLayer;
let citiesLayer;
let unitsLayer;
let projection;
let playStep = 1;
let lastFrameTime = performance.now();

const settingsState = {
  music: Number(localStorage.getItem('musicVolume') ?? 40),
  sfx: Number(localStorage.getItem('sfxVolume') ?? 60)
};

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function refreshTimeHud() {
  gameDateTime.textContent = `Date: ${formatDateTime(gameState.currentTimeMs)}`;
  if (gameState.simulationSpeed === 0) {
    simSpeedLabel.textContent = 'Speed: Paused';
  } else {
    const gameMinutesPerRealSecond = (GAME_TIME_SCALE * gameState.simulationSpeed) / (60 * 1000) * 1000;
    simSpeedLabel.textContent = `Speed: ${gameState.simulationSpeed}x (${gameMinutesPerRealSecond.toFixed(0)} game min/sec)`;
  }
  timeControlButtons.querySelectorAll('button').forEach((btn) => {
    const speed = Number(btn.dataset.speed);
    btn.classList.toggle('active', speed === gameState.simulationSpeed);
  });
}

function refreshEconomyHud() {
  if (!gameState.selectedPlayerCountry) {
    treasuryLabel.textContent = 'Treasury: --';
    aiCountriesLabel.textContent = 'AI Countries: --';
    economySummary.textContent = 'Economy: --';
    return;
  }
  const country = gameState.selectedPlayerCountry.properties.name;
  const treasury = economySystem.getTreasury(country);
  treasuryLabel.textContent = `Treasury: ${treasury.toLocaleString()}`;
  aiCountriesLabel.textContent = `AI Countries: ${gameState.aiCountries.length ? gameState.aiCountries.join(', ') : 'none'}`;
  economySummary.textContent = `Economy: ${gameState.economy.lastSummary}`;
}

function refreshCountryHud() {
  const countryName = gameState.selectedCountryForHud
    || (gameState.selectedPlayerCountry && gameState.selectedPlayerCountry.properties.name);
  if (!countryName) {
    countryHudName.textContent = 'Country: --';
    countryHudTreasury.textContent = 'Treasury: --';
    countryHudPop.textContent = 'Population: --';
    countryHudStability.textContent = 'Stability: --';
    countryHudOil.textContent = 'Oil: --';
    countryHudIndustry.textContent = 'Industry: --';
    countryHudManpower.textContent = 'Manpower: --';
    countryHudStrain.textContent = 'Resource strain: --';
    countryHudAssets.textContent = 'Cities/Bases/Units: --';
    countryHudFlow.textContent = 'Income/Upkeep/Net: --';
    return;
  }
  const country = countrySystem.ensureCountry(countryName);
  const aiPosture = gameState.aiStateByCountry[countryName]?.posture;
  countryHudName.textContent = `Country: ${country.name}${country.aiControlled ? ` (AI${aiPosture ? `: ${aiPosture}` : ''})` : ''}`;
  countryHudTreasury.textContent = `Treasury: ${Math.round(country.treasury).toLocaleString()}`;
  countryHudPop.textContent = `Population: ${Math.round(country.population).toLocaleString()}`;
  countryHudStability.textContent = `Stability: ${country.stability.toFixed(1)}`;
  countryHudOil.textContent = `Oil: ${country.oil.toFixed(1)} (+${country.oilPerTick.toFixed(1)}/day)`;
  countryHudIndustry.textContent = `Industry: ${country.industrialCapacity.toFixed(1)}`;
  countryHudManpower.textContent = `Manpower: pool ${Math.round(country.manpowerPool).toLocaleString()} (+${Math.round(country.manpowerRegenPerTick)}/day), capacity ${Math.round(country.manpower).toLocaleString()}`;
  const strainFlags = [];
  if (country.oil < RESOURCE_CONFIG.oilShortageThreshold) strainFlags.push('oil shortage');
  if (country.manpowerPool < 1200) strainFlags.push('manpower shortage');
  if (country.industrialCapacity < 22) strainFlags.push('industrial strain');
  countryHudStrain.textContent = `Resource strain: ${strainFlags.length ? strainFlags.join(', ') : 'none'}`;
  countryHudAssets.textContent = `Cities/Bases/Units: ${country.controlledCityIds.length}/${country.controlledBaseIds.length}/${country.controlledUnitIds.length}`;
  countryHudFlow.textContent = `Income/Upkeep/Net: +${country.incomePerTick}/-${country.upkeepPerTick}/${country.netPerTick >= 0 ? '+' : ''}${country.netPerTick}`;
}

function getDiplomacyFocusCountry() {
  return gameState.selectedCountryForHud
    || (gameState.selectedPlayerCountry && gameState.selectedPlayerCountry.properties.name);
}

function refreshDiplomacyHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    diplomacyFocusCountry.textContent = 'Diplomacy for: --';
    diplomacySummary.textContent = 'Diplomacy: --';
    relationsList.innerHTML = '<li>No country selected.</li>';
    diplomacyTargetCountry.innerHTML = '';
    sanctionsStateLabel.textContent = 'Sanctions: --';
    tradeStateLabel.textContent = 'Trade: --';
    [declareWarBtn, makePeaceBtn, improveRelationsBtn, worsenRelationsBtn, sanctionLightBtn, sanctionHeavyBtn, liftSanctionsBtn, toggleTradeBtn]
      .forEach((btn) => { btn.disabled = true; });
    return;
  }

  countrySystem.ensureCountry(focusCountry);
  Object.keys(gameState.countries).forEach((otherCountry) => {
    if (otherCountry !== focusCountry) diplomacySystem.ensureRelation(focusCountry, otherCountry);
  });

  const relations = diplomacySystem.getRelationsForCountry(focusCountry);
  diplomacyFocusCountry.textContent = `Diplomacy for: ${focusCountry}`;
  diplomacySummary.textContent = `Diplomacy: ${gameState.diplomacy.lastSummary}`;

  relationsList.innerHTML = '';
  if (!relations.length) {
    relationsList.innerHTML = '<li>No bilateral relations yet.</li>';
  } else {
    relations.forEach((relation) => {
      const li = document.createElement('li');
      const directional = diplomacySystem.getDirectionalPressure(focusCountry, relation.counterpart);
      li.textContent = `${relation.counterpart}: ${relation.status.toUpperCase()} (${relation.relationScore}) • Sanctions ${directional.sanctionsLevel} • Trade ${directional.tradeAllowed ? 'on' : 'blocked'}`;
      relationsList.appendChild(li);
    });
  }

  const previousTarget = diplomacyTargetCountry.value;
  diplomacyTargetCountry.innerHTML = '';
  relations.forEach((relation) => {
    const option = document.createElement('option');
    option.value = relation.counterpart;
    option.textContent = relation.counterpart;
    diplomacyTargetCountry.appendChild(option);
  });
  if (previousTarget && relations.some((relation) => relation.counterpart === previousTarget)) {
    diplomacyTargetCountry.value = previousTarget;
  }

  const hasTarget = Boolean(diplomacyTargetCountry.value);
  [declareWarBtn, makePeaceBtn, improveRelationsBtn, worsenRelationsBtn, sanctionLightBtn, sanctionHeavyBtn, liftSanctionsBtn, toggleTradeBtn]
    .forEach((btn) => { btn.disabled = !hasTarget; });

  if (hasTarget) {
    const directional = diplomacySystem.getDirectionalPressure(focusCountry, diplomacyTargetCountry.value);
    sanctionsStateLabel.textContent = `Sanctions: ${directional.sanctionsLevel.toUpperCase()} (${focusCountry} → ${diplomacyTargetCountry.value})`;
    tradeStateLabel.textContent = `Trade: ${directional.tradeAllowed ? 'Allowed' : 'Blocked'} (${focusCountry} → ${diplomacyTargetCountry.value})`;
    toggleTradeBtn.textContent = directional.tradeAllowed ? 'Block Trade' : 'Allow Trade';
  } else {
    sanctionsStateLabel.textContent = 'Sanctions: --';
    tradeStateLabel.textContent = 'Trade: --';
    toggleTradeBtn.textContent = 'Toggle Trade';
  }
}

function refreshPolicyHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    policyFocusCountry.textContent = 'Policy for: --';
    policySummary.textContent = 'Policy: --';
    policyCostLabel.textContent = 'Daily policy cost: --';
    [militaryPolicySelect, industryPolicySelect, securityPolicySelect, applyPolicyBtn].forEach((el) => { el.disabled = true; });
    return;
  }

  const country = countrySystem.ensureCountry(focusCountry);
  policySystem.updateCountryPolicyCost(focusCountry);
  policyFocusCountry.textContent = `Policy for: ${focusCountry}`;
  policySummary.textContent = `Policy: ${gameState.policy.lastSummary}`;
  policyCostLabel.textContent = `Daily policy cost: ${Math.round(country.policyDailyCost)}`;
  militaryPolicySelect.value = country.policy.militarySpendingLevel;
  industryPolicySelect.value = country.policy.industryInvestmentLevel;
  securityPolicySelect.value = country.policy.internalSecurityLevel;

  const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
  const editable = playerCountry && focusCountry === playerCountry;
  [militaryPolicySelect, industryPolicySelect, securityPolicySelect, applyPolicyBtn].forEach((el) => { el.disabled = !editable; });
}

function refreshDomesticHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    domesticFocusCountry.textContent = 'Domestic state for: --';
    domesticStability.textContent = 'Stability: --';
    domesticUnrest.textContent = 'Unrest: --';
    domesticWarWeariness.textContent = 'War weariness: --';
    domesticEconomicStress.textContent = 'Economic stress: --';
    domesticTrend.textContent = 'Domestic trend: --';
    return;
  }
  const country = countrySystem.ensureCountry(focusCountry);
  domesticFocusCountry.textContent = `Domestic state for: ${focusCountry}`;
  domesticStability.textContent = `Stability: ${country.stability.toFixed(1)} / 100`;
  domesticUnrest.textContent = `Unrest: ${country.unrest.toFixed(1)} / 100`;
  domesticWarWeariness.textContent = `War weariness: ${country.warWeariness.toFixed(1)} / 100`;
  domesticEconomicStress.textContent = `Economic stress: ${country.economicStress.toFixed(1)} / 100`;
  const trendLabel = country.stability >= 60 ? 'Stable' : (country.stability >= 35 ? 'Strained' : 'Fragile');
  const pressure = diplomacySystem.getEconomicPressureOnCountry(focusCountry);
  domesticTrend.textContent = `Domestic trend: ${trendLabel} • Output x${country.domesticOutputModifier.toFixed(2)} • Sanction sources ${pressure.incomingCount}`;
}

function setStatus(message, isError = false) {
  statusLabel.textContent = message;
  statusLabel.style.color = isError ? '#ff9aa9' : '#93a4c8';
}

function setOverlay(name) {
  Object.entries(overlays).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
}

function hideOverlays() {
  Object.values(overlays).forEach((el) => el.classList.add('hidden'));
}

function renderCityList(countryName) {
  cityList.innerHTML = '';
  const sourceCities = gameState.cities.length ? gameState.cities : majorCities.map((c) => ({ name: c.name, ownerCountry: c.country }));
  const visibleCities = countryName
    ? sourceCities.filter((city) => (city.ownerCountry || city.country) === countryName)
    : sourceCities;
  if (!visibleCities.length) {
    const li = document.createElement('li');
    li.textContent = 'No major cities configured for this country yet.';
    cityList.appendChild(li);
    return;
  }

  visibleCities.forEach((city) => {
    const li = document.createElement('li');
    li.textContent = `${city.name} (${city.ownerCountry || city.country})`;
    cityList.appendChild(li);
  });
}

function initializeCityState() {
  if (gameState.cities.length) return;
  gameState.cities = majorCities.map((city, idx) => ({
    id: idx + 1,
    name: city.name,
    ownerCountry: city.country,
    lonLat: [city.lon, city.lat],
    controlStatus: 'normal',
    captureState: null,
    status: 'active'
  }));
}

function updateCountryStyles() {
  if (!countriesLayer) return;
  countriesLayer
    .selectAll('path')
    .classed('selected', (d) => selectedCountryFeature && d.id === selectedCountryFeature.id)
    .classed('locked', (d) => gameState.selectedPlayerCountry && d.id !== gameState.selectedPlayerCountry.id);
}

function setPlayerCountry(countryFeature) {
  gameState.selectedPlayerCountry = countryFeature;
  selectedCountryFeature = countryFeature;
  gameState.selectedBaseId = null;
  gameState.selectedUnitId = null;
  gameState.moveMode = false;
  gameState.attackMode = false;
  gameState.captureMode = false;
  gameState.selectedAsset = null;
  selectedCountryLabel.textContent = `Selected: ${countryFeature.properties.name}`;
  economySystem.ensureCountry(countryFeature.properties.name);
  countrySystem.ensureCountry(countryFeature.properties.name, false);
  gameState.selectedCountryForHud = countryFeature.properties.name;
  renderCityList(countryFeature.properties.name);
  updateCountryStyles();
  spawnEnemyForces();
  economySystem.startEconomyLoop();
  countrySystem.start();
  diplomacySystem.start();
  resourceSystem.start();
  policySystem.start();
  domesticStateSystem.start();
  countrySystem.syncOwnership();
  renderProductionPanel();
  renderSelectedUnitPanel();
  refreshEconomyHud();
  refreshCountryHud();
  refreshDiplomacyHud();
  refreshPolicyHud();
  refreshDomesticHud();
}

function spawnEnemyForces() {
  if (gameState.enemySpawned || !projection || !countries.length || !gameState.selectedPlayerCountry) return;
  const enemyCountry = countries.find((c) => c.id !== gameState.selectedPlayerCountry.id) || countries[0];
  if (!enemyCountry) return;
  const [lon, lat] = d3.geoCentroid(enemyCountry);

  const enemyBase = {
    id: gameState.nextBaseId++,
    ownerCountry: `Enemy ${enemyCountry.properties.name}`,
    type: 'ground',
    lonLat: [lon, lat],
    status: 'active',
    combatStatus: 'idle',
    controlStatus: 'normal',
    captureState: null,
    createdAt: gameState.currentTimeMs,
    buildStartedAt: gameState.currentTimeMs,
    buildCompleteAt: gameState.currentTimeMs,
    health: 260,
    maxHealth: 260,
    defense: 10,
    production: { currentUnitId: null, currentCompleteAt: null, queue: [] }
  };
  gameState.bases.push(enemyBase);
  economySystem.ensureCountry(enemyBase.ownerCountry);
  countrySystem.ensureCountry(enemyBase.ownerCountry, true);
  if (!gameState.aiCountries.includes(enemyBase.ownerCountry)) {
    gameState.aiCountries.push(enemyBase.ownerCountry);
  }

  const def = UNIT_DEFINITIONS.infantry;
  gameState.units.push({
    id: gameState.nextUnitId++,
    ownerCountry: enemyBase.ownerCountry,
    type: 'infantry',
    domain: def.domain,
    status: 'active',
    createdAt: gameState.currentTimeMs,
    activatedAt: gameState.currentTimeMs,
    sourceBaseId: enemyBase.id,
    lonLat: [lon + 1.3, lat + 0.6],
    health: def.maxHealth,
    maxHealth: def.maxHealth,
    attack: def.attack,
    defense: def.defense,
    rangeKm: def.rangeKm,
    attackCooldownMs: def.attackCooldownMs,
    combatStatus: 'idle',
    currentTargetId: null,
    targetType: null,
    strength: def.attack,
    movement: null,
    captureTarget: null
  });

  gameState.enemySpawned = true;
  aiSystem.start();
  renderBases();
  renderUnits();
  refreshDiplomacyHud();
  refreshPolicyHud();
  refreshDomesticHud();
}

function pointInsideCountry(countryFeature, lonLatPoint) {
  if (!countryFeature) return false;
  return d3.geoContains(countryFeature, lonLatPoint);
}

function createBaseButtons() {
  baseButtons.innerHTML = '';
  const noneBtn = document.createElement('button');
  noneBtn.textContent = 'No Build';
  noneBtn.classList.toggle('active', selectedBaseType === null);
  noneBtn.addEventListener('click', () => {
    selectedBaseType = null;
    baseButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === noneBtn));
    setStatus('Build mode off. You can inspect/select without placing bases.');
  });
  baseButtons.appendChild(noneBtn);

  baseTypes.forEach((type) => {
    const btn = document.createElement('button');
    btn.textContent = type.label;
    btn.dataset.type = type.key;
    btn.classList.toggle('active', type.key === selectedBaseType);
    btn.addEventListener('click', () => {
      selectedBaseType = type.key;
      baseButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      if (gameState.selectedPlayerCountry) {
        setStatus(`Build mode: ${type.label}. Click inside ${gameState.selectedPlayerCountry.properties.name}.`);
      }
    });
    baseButtons.appendChild(btn);
  });
}

function populateCountrySelect() {
  countrySelect.innerHTML = '<option value="">Choose a country</option>';
  countries
    .map((c) => c.properties.name)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      countrySelect.appendChild(option);
    });
}

function applySettingsUI() {
  const musicSlider = document.getElementById('musicVolume');
  const sfxSlider = document.getElementById('sfxVolume');
  const musicValue = document.getElementById('musicValue');
  const sfxValue = document.getElementById('sfxValue');

  musicSlider.value = settingsState.music;
  sfxSlider.value = settingsState.sfx;
  musicValue.textContent = settingsState.music;
  sfxValue.textContent = settingsState.sfx;

  musicSlider.addEventListener('input', (e) => {
    settingsState.music = Number(e.target.value);
    musicValue.textContent = settingsState.music;
    localStorage.setItem('musicVolume', String(settingsState.music));
  });

  sfxSlider.addEventListener('input', (e) => {
    settingsState.sfx = Number(e.target.value);
    sfxValue.textContent = settingsState.sfx;
    localStorage.setItem('sfxVolume', String(settingsState.sfx));
  });
}

function setSimulationSpeed(multiplier) {
  gameClock.setSpeed(multiplier);
  gameState.simulationSpeed = gameClock.speed;
  refreshTimeHud();
  setStatus(gameState.simulationSpeed === 0
    ? 'Simulation paused.'
    : `Simulation speed set to ${gameState.simulationSpeed}x.`);
}

function attachTimeControls() {
  timeControlButtons.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setSimulationSpeed(Number(btn.dataset.speed)));
  });

  skipDayBtn.addEventListener('click', () => skipGameTime(1 * DAY_MS));
  skipWeekBtn.addEventListener('click', () => skipGameTime(7 * DAY_MS));
  skipMonthBtn.addEventListener('click', () => skipGameTime(30 * DAY_MS));
}

function skipGameTime(deltaGameMs) {
  gameClock.skipGameTime(deltaGameMs);
  gameState.currentTimeMs = gameClock.getCurrentTime();
  scheduler.processDue(gameState.currentTimeMs);
  renderBases();
  refreshTimeHud();
}

function createBase(baseInput, lonLatArg = null, ownerCountryArg = null) {
  const type = typeof baseInput === 'string' ? baseInput : baseInput.type;
  const lonLat = Array.isArray(lonLatArg) ? lonLatArg : baseInput.lonLat;
  const ownerCountry = ownerCountryArg || (gameState.selectedPlayerCountry && gameState.selectedPlayerCountry.properties.name);
  const now = gameState.currentTimeMs;
  const buildDurationMs = BASE_BUILD_DURATIONS_MS[type] ?? 3 * DAY_MS;
  const base = {
    id: gameState.nextBaseId++,
    ownerCountry,
    type,
    lonLat,
    status: 'building',
    combatStatus: 'idle',
    controlStatus: 'normal',
    captureState: null,
    createdAt: now,
    buildStartedAt: now,
    buildCompleteAt: now + buildDurationMs,
    health: 300,
    maxHealth: 300,
    defense: 12,
    production: {
      currentUnitId: null,
      currentCompleteAt: null,
      queue: []
    }
  };

  gameState.bases.push(base);

  scheduler.schedule({
    executeAt: base.buildCompleteAt,
    type: 'BASE_CONSTRUCTION_COMPLETE',
    payload: { baseId: base.id },
    handler: ({ baseId }) => {
      const targetBase = gameState.bases.find((entry) => entry.id === baseId);
      if (!targetBase || targetBase.status === 'active') return;
      targetBase.status = 'active';
      setStatus(`${targetBase.type} base is now ACTIVE in ${targetBase.ownerCountry}.`);
      renderBases();
      renderProductionPanel();
    }
  });

  return base;
}

function renderBases() {
  if (!basesLayer || !projection) return;

  const visibleBases = gameState.bases.filter((base) => base.combatStatus !== 'destroyed');
  const points = basesLayer.selectAll('g.base-point').data(visibleBases, (d) => d.id);
  const enter = points.enter().append('g').attr('class', 'base-point');

  enter
    .append('rect')
    .attr('class', 'base')
    .attr('width', 8)
    .attr('height', 8)
    .attr('x', -4)
    .attr('y', -4)
    .attr('rx', 1.5);

  enter.append('title');

  points
    .merge(enter)
    .attr('transform', (d) => {
      const [x, y] = projection(d.lonLat);
      return `translate(${x}, ${y})`;
    })
    .on('click', (event, d) => {
      event.stopPropagation();
      if (gameState.attackMode && gameState.selectedUnitId) {
        const result = combatSystem.startAttack(gameState.selectedUnitId, 'base', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Combat started against base #${d.id}.` : `Combat started against base #${d.id}.`);
        }
        gameState.attackMode = false;
        renderSelectedUnitPanel();
        renderUnits();
        return;
      }
      if (gameState.captureMode && gameState.selectedUnitId) {
        const result = captureSystem.startCapture(gameState.selectedUnitId, 'base', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Capture started on base #${d.id}.` : `Capture started on base #${d.id}.`);
        }
        gameState.captureMode = false;
        renderSelectedUnitPanel();
        renderBases();
        return;
      }
      gameState.selectedBaseId = d.id;
      gameState.selectedAsset = { type: 'base', id: d.id };
      gameState.selectedCountryForHud = d.ownerCountry;
      selectedAssetStatus.textContent = `Selected asset: Base #${d.id} • Owner ${d.ownerCountry} • ${d.controlStatus || 'normal'}`;
      renderBases();
      renderProductionPanel();
      refreshCountryHud();
    })
    .select('rect')
    .attr('fill', (d) => baseTypes.find((b) => b.key === d.type).color)
    .attr('class', (d) => `base ${d.status} ${d.combatStatus} ${gameState.aiCountries.includes(d.ownerCountry) ? 'enemy-owner' : ''} ${gameState.selectedBaseId === d.id ? 'selected-base' : ''}`);

  points
    .merge(enter)
    .select('title')
    .text((d) => `${d.type} base (${d.status}) HP ${d.health}/${d.maxHealth} - ${d.ownerCountry}`);

  points.exit().remove();
}

function renderCities() {
  if (!citiesLayer || !projection) return;
  const visibleCities = gameState.cities.filter((city) => city.status !== 'destroyed');
  const points = citiesLayer.selectAll('circle.city-point').data(visibleCities, (d) => d.id);
  const enter = points.enter().append('circle').attr('class', 'city city-point').attr('r', 3);
  enter.append('title');

  points
    .merge(enter)
    .attr('class', (d) => `city city-point ${d.controlStatus}`)
    .attr('cx', (d) => projection(d.lonLat)[0])
    .attr('cy', (d) => projection(d.lonLat)[1])
    .on('click', (event, d) => {
      event.stopPropagation();
      gameState.selectedAsset = { type: 'city', id: d.id };
      gameState.selectedCountryForHud = d.ownerCountry;
      selectedAssetStatus.textContent = `Selected asset: City ${d.name} • Owner ${d.ownerCountry} • ${d.controlStatus}`;
      refreshCountryHud();
      if (gameState.captureMode && gameState.selectedUnitId) {
        const result = captureSystem.startCapture(gameState.selectedUnitId, 'city', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Capture started on city ${d.name}.` : `Capture started on city ${d.name}.`);
        }
        gameState.captureMode = false;
        renderSelectedUnitPanel();
        renderCities();
      }
    })
    .select('title')
    .text((d) => `${d.name} (${d.ownerCountry}) - ${d.controlStatus} - Income ${ECONOMY_CONFIG.cityIncomePerDay}/day`);

  points.exit().remove();
}

function renderUnits() {
  const visibleUnits = gameState.units.filter((unit) => unit.status !== 'destroyed');
  unitCount.textContent = `Total units: ${visibleUnits.length}`;
  unitList.innerHTML = '';

  if (!visibleUnits.length) {
    const li = document.createElement('li');
    li.textContent = 'No units yet.';
    unitList.appendChild(li);
  } else {
    visibleUnits.slice(-8).forEach((unit) => {
      const li = document.createElement('li');
      li.textContent = `${UNIT_DEFINITIONS[unit.type].label} (${unit.status})`;
      unitList.appendChild(li);
    });
  }

  if (!unitsLayer || !projection) return;
  const markers = unitsLayer.selectAll('circle.unit-point').data(visibleUnits, (d) => d.id);
  const enter = markers.enter().append('circle').attr('class', 'unit-marker unit-point').attr('r', 2.3);
  enter.append('title');
  markers
    .merge(enter)
    .attr('class', (d) => `unit-marker unit-point ${d.combatStatus || ''} ${gameState.aiCountries.includes(d.ownerCountry) ? 'enemy-owner' : ''} ${gameState.selectedUnitId === d.id ? 'selected' : ''}`)
    .attr('cx', (d) => projection(movementSystem.getDisplayLonLat(d))[0])
    .attr('cy', (d) => projection(movementSystem.getDisplayLonLat(d))[1])
    .on('click', (event, d) => {
      event.stopPropagation();
      if (gameState.attackMode && gameState.selectedUnitId && gameState.selectedUnitId !== d.id) {
        const result = combatSystem.startAttack(gameState.selectedUnitId, 'unit', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Combat started against unit #${d.id}.` : `Combat started against unit #${d.id}.`);
        }
        gameState.attackMode = false;
        renderSelectedUnitPanel();
        renderUnits();
        return;
      }
      gameState.selectedUnitId = d.id;
      gameState.moveMode = false;
      gameState.attackMode = false;
      gameState.captureMode = false;
      gameState.selectedCountryForHud = d.ownerCountry;
      renderSelectedUnitPanel();
      refreshCountryHud();
      renderUnits();
    })
    .select('title')
    .text((d) => `${UNIT_DEFINITIONS[d.type].label} (${d.domain}) - ${d.status}`);
  markers.exit().remove();
}

function renderSelectedUnitPanel() {
  const unit = gameState.units.find((entry) => entry.id === gameState.selectedUnitId);
  if (!unit) {
    selectedUnitLabel.textContent = 'No unit selected.';
    selectedUnitMeta.textContent = 'Status: --';
  } else {
    selectedUnitLabel.textContent = `Unit #${unit.id}: ${UNIT_DEFINITIONS[unit.type].label} (${unit.ownerCountry})`;
    if (unit.status === 'moving' && unit.movement) {
      selectedUnitMeta.textContent = `Status: moving • ETA ${formatDateTime(unit.movement.arrivalAt)} • Target ${unit.movement.targetLonLat.map((n) => n.toFixed(1)).join(', ')}`;
    } else if (unit.status === 'destroyed') {
      selectedUnitMeta.textContent = 'Status: destroyed';
    } else {
      const canCapture = unit.domain === 'ground' && unit.status === 'active' && unit.combatStatus === 'idle';
      selectedUnitMeta.textContent = `Status: ${unit.status} • HP ${unit.health}/${unit.maxHealth} • ATK ${unit.attack} DEF ${unit.defense} RNG ${unit.rangeKm}km • Capture ${canCapture ? 'Yes' : 'No'}`;
    }
  }
  moveModeStatus.textContent = `Move mode: ${gameState.moveMode ? 'On (click map destination)' : 'Off'}`;
  attackModeStatus.textContent = `Attack mode: ${gameState.attackMode ? 'On (click enemy unit/base)' : 'Off'}`;
  captureModeStatus.textContent = `Capture mode: ${gameState.captureMode ? 'On (click enemy city/base)' : 'Off'}`;
  if (!gameState.selectedAsset) selectedAssetStatus.textContent = 'Selected asset: none';
}

function renderProductionPanel() {
  const base = gameState.bases.find((entry) => entry.id === gameState.selectedBaseId);
  prodUnitButtons.innerHTML = '';
  prodQueue.innerHTML = '';

  if (!base) {
    prodBaseLabel.textContent = 'Select a base to manage production.';
    prodCurrent.textContent = 'Current: --';
    return;
  }

  const upkeep = ECONOMY_CONFIG.baseUpkeepPerDay[base.type] || 0;
  prodBaseLabel.textContent = `Base #${base.id} (${base.type}) - ${base.status} - HP ${base.health}/${base.maxHealth} - Upkeep ${upkeep}/day`;
  const currentUnit = base.production.currentUnitId
    ? gameState.units.find((unit) => unit.id === base.production.currentUnitId)
    : null;

  if (currentUnit) {
    const remainingMs = Math.max(0, base.production.currentCompleteAt - gameState.currentTimeMs);
    const remainingDays = (remainingMs / DAY_MS).toFixed(2);
    prodCurrent.textContent = `Current: ${UNIT_DEFINITIONS[currentUnit.type].label} (${remainingDays} days left)`;
  } else {
    prodCurrent.textContent = 'Current: Idle';
  }

  base.production.queue.forEach((unitId) => {
    const unit = gameState.units.find((entry) => entry.id === unitId);
    if (!unit) return;
    const li = document.createElement('li');
    li.textContent = UNIT_DEFINITIONS[unit.type].label;
    prodQueue.appendChild(li);
  });

  if (!base.production.queue.length) {
    const li = document.createElement('li');
    li.textContent = 'Queue empty';
    prodQueue.appendChild(li);
  }

  if (!gameState.selectedPlayerCountry || base.ownerCountry !== gameState.selectedPlayerCountry.properties.name) {
    const info = document.createElement('p');
    info.textContent = 'Enemy base: production controls unavailable.';
    prodUnitButtons.appendChild(info);
    return;
  }

  const allowedUnits = productionSystem.getAllowedUnitsForBase(base);
  if (!allowedUnits.length) {
    const info = document.createElement('p');
    info.textContent = 'This base cannot produce units.';
    prodUnitButtons.appendChild(info);
    return;
  }

  allowedUnits.forEach((unit) => {
    const btn = document.createElement('button');
    btn.textContent = `Queue ${unit.label}`;
    btn.addEventListener('click', () => {
      const result = productionSystem.queueUnit(base.id, unit.key);
      if (!result.ok) {
        setStatus(result.message, true);
      } else {
        setStatus(`${unit.label} queued at base #${base.id}.`);
      }
      renderProductionPanel();
      renderUnits();
      refreshEconomyHud();
    });
    prodUnitButtons.appendChild(btn);
  });
}

function refreshProductionTicker() {
  const base = gameState.bases.find((entry) => entry.id === gameState.selectedBaseId);
  if (!base) return;
  const currentUnit = base.production.currentUnitId
    ? gameState.units.find((unit) => unit.id === base.production.currentUnitId)
    : null;
  if (!currentUnit) return;
  const remainingMs = Math.max(0, base.production.currentCompleteAt - gameState.currentTimeMs);
  const remainingDays = (remainingMs / DAY_MS).toFixed(2);
  prodCurrent.textContent = `Current: ${UNIT_DEFINITIONS[currentUnit.type].label} (${remainingDays} days left)`;
}

function attachMenuHandlers() {
  document.getElementById('playBtn').addEventListener('click', () => {
    playStep = 1;
    playTitle.textContent = 'Choose Your Country';
    playStepCountry.classList.remove('hidden');
    playStepLeader.classList.add('hidden');
    countryWarning.textContent = '';
    leaderNameInput.value = '';
    setOverlay('playFlow');
  });

  document.getElementById('settingsBtn').addEventListener('click', () => setOverlay('settingsPanel'));
  document.getElementById('settingsBackBtn').addEventListener('click', () => setOverlay('mainMenu'));

  document.getElementById('playBackBtn').addEventListener('click', () => {
    if (playStep === 1) {
      setOverlay('mainMenu');
      return;
    }
    playStep = 1;
    playTitle.textContent = 'Choose Your Country';
    playStepCountry.classList.remove('hidden');
    playStepLeader.classList.add('hidden');
  });

  document.getElementById('playNextBtn').addEventListener('click', () => {
    if (playStep === 1) {
      const chosen = countrySelect.value;
      if (!chosen) {
        countryWarning.textContent = 'Please choose a country to continue.';
        return;
      }

      const chosenFeature = countries.find((c) => c.properties.name === chosen);
      if (!chosenFeature) {
        countryWarning.textContent = 'Country data unavailable. Choose another country.';
        return;
      }

      countryWarning.textContent = '';
      setPlayerCountry(chosenFeature);
      playStep = 2;
      playTitle.textContent = `Create Leader for ${chosen}`;
      playStepCountry.classList.add('hidden');
      playStepLeader.classList.remove('hidden');
      return;
    }

    const leaderName = leaderNameInput.value.trim();
    if (!leaderName) {
      alert('Please enter a leader name.');
      return;
    }

    playerProfile.textContent = `Leader ${leaderName} of ${gameState.selectedPlayerCountry.properties.name}`;
    setStatus(`Commander ${leaderName}, place bases and run time to complete construction.`);
    hideOverlays();
  });
}

function attachUnitControls() {
  moveUnitBtn.addEventListener('click', () => {
    if (!gameState.selectedUnitId) {
      setStatus('Select a unit first, then enable move mode.', true);
      return;
    }
    gameState.moveMode = true;
    gameState.attackMode = false;
    gameState.captureMode = false;
    renderSelectedUnitPanel();
    setStatus('Move mode enabled. Click destination on the map.');
  });

  attackUnitBtn.addEventListener('click', () => {
    if (!gameState.selectedUnitId) {
      setStatus('Select a unit first, then enable attack mode.', true);
      return;
    }
    gameState.attackMode = true;
    gameState.moveMode = false;
    gameState.captureMode = false;
    renderSelectedUnitPanel();
    setStatus('Attack mode enabled. Click an enemy unit or enemy base in range.');
  });

  captureUnitBtn.addEventListener('click', () => {
    if (!gameState.selectedUnitId) {
      setStatus('Select a unit first, then enable capture mode.', true);
      return;
    }
    gameState.captureMode = true;
    gameState.attackMode = false;
    gameState.moveMode = false;
    renderSelectedUnitPanel();
    setStatus('Capture mode enabled. Click enemy city/base in capture range.');
  });

  clearUnitSelectionBtn.addEventListener('click', () => {
    gameState.selectedUnitId = null;
    gameState.moveMode = false;
    gameState.attackMode = false;
    gameState.captureMode = false;
    renderSelectedUnitPanel();
    renderUnits();
  });
}

function attachDiplomacyControls() {
  const runAction = (action) => {
    const focusCountry = getDiplomacyFocusCountry();
    const targetCountry = diplomacyTargetCountry.value;
    if (!focusCountry || !targetCountry) {
      setStatus('Select a diplomacy target first.', true);
      return false;
    }
    if (focusCountry === targetCountry) {
      setStatus('Cannot apply diplomacy action to the same country.', true);
      return false;
    }
    const result = action(focusCountry, targetCountry);
    if (!result) {
      setStatus('Diplomacy action failed.', true);
      return false;
    }
    refreshDiplomacyHud();
    refreshCountryHud();
    return true;
  };

  declareWarBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.declareWar(focus, target, `${focus} declared war on ${target}.`))) {
      setStatus('War declared.');
    }
  });
  makePeaceBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.makePeace(focus, target, `${focus} made peace with ${target}.`))) {
      setStatus('Peace declared.');
    }
  });
  improveRelationsBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.adjustRelationScore(focus, target, 10, `${focus} improved relations with ${target}.`))) {
      setStatus('Relations improved.');
    }
  });
  worsenRelationsBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.adjustRelationScore(focus, target, -10, `${focus} worsened relations with ${target}.`, true))) {
      setStatus('Relations worsened.');
    }
  });
  sanctionLightBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.imposeSanctions(focus, target, 'light'))) {
      setStatus('Light sanctions imposed.');
    }
  });
  sanctionHeavyBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.imposeSanctions(focus, target, 'heavy'))) {
      setStatus('Heavy sanctions imposed.');
    }
  });
  liftSanctionsBtn.addEventListener('click', () => {
    if (runAction((focus, target) => diplomacySystem.liftSanctions(focus, target))) {
      setStatus('Sanctions lifted.');
    }
  });
  toggleTradeBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    const targetCountry = diplomacyTargetCountry.value;
    if (!focusCountry || !targetCountry) {
      setStatus('Select a diplomacy target first.', true);
      return;
    }
    const currentState = diplomacySystem.getDirectionalPressure(focusCountry, targetCountry);
    runAction((focus, target) => diplomacySystem.setTradeAllowed(focus, target, !currentState.tradeAllowed));
    setStatus(currentState.tradeAllowed ? 'Trade blocked.' : 'Trade restored.');
  });
  diplomacyTargetCountry.addEventListener('change', () => refreshDiplomacyHud());
}

function attachPolicyControls() {
  applyPolicyBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    if (!focusCountry || !playerCountry || focusCountry !== playerCountry) {
      setStatus('Policies can only be changed for your selected country.', true);
      return;
    }
    policySystem.setPolicyBundle(focusCountry, {
      militarySpendingLevel: militaryPolicySelect.value,
      industryInvestmentLevel: industryPolicySelect.value,
      internalSecurityLevel: securityPolicySelect.value
    });
    setStatus(`Policy updated for ${focusCountry}.`);
    refreshPolicyHud();
    refreshCountryHud();
    refreshDomesticHud();
  });
}

async function loadCountriesData() {
  const geoJsonSources = [
    'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
    'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json'
  ];

  for (const url of geoJsonSources) {
    try {
      const geoJson = await d3.json(url);
      if (geoJson && Array.isArray(geoJson.features) && geoJson.features.length) {
        return geoJson.features.map((feature) => {
          const countryName =
            feature.properties?.name ||
            feature.properties?.ADMIN ||
            feature.properties?.admin ||
            feature.properties?.name_long ||
            'Unknown Country';
          return {
            ...feature,
            properties: {
              ...(feature.properties || {}),
              name: countryName
            }
          };
        });
      }
    } catch (error) {
      console.warn(`GeoJSON source failed: ${url}`, error);
    }
  }

  const [worldData, namesData] = await Promise.all([
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
    d3.tsv('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv')
  ]);

  const nameById = new Map(namesData.map((row) => [row.id, row.name]));
  return topojson.feature(worldData, worldData.objects.countries).features.map((country) => ({
    ...country,
    properties: {
      ...(country.properties || {}),
      name: nameById.get(country.id) || `Country ${country.id}`
    }
  }));
}

function startSimulationLoop() {
  const tick = (now) => {
    const realDeltaMs = now - lastFrameTime;
    lastFrameTime = now;

    gameClock.update(realDeltaMs);
    gameState.currentTimeMs = gameClock.getCurrentTime();
    gameState.simulationSpeed = gameClock.speed;

    scheduler.processDue(gameState.currentTimeMs);
    countrySystem.syncOwnership();
    refreshTimeHud();
    refreshEconomyHud();
    refreshCountryHud();
    refreshDiplomacyHud();
    refreshPolicyHud();
    refreshDomesticHud();
    refreshProductionTicker();
    renderSelectedUnitPanel();
    renderUnits();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

async function setupMap() {
  const width = mapWrap.clientWidth;
  const height = mapWrap.clientHeight;
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const projectionFactory = d3.geoRobinson ? d3.geoRobinson : d3.geoNaturalEarth1;
  projection = projectionFactory().fitExtent([[15, 15], [width - 15, height - 15]], { type: 'Sphere' });
  const path = d3.geoPath(projection);

  const root = svg.append('g');
  countriesLayer = root.append('g').attr('id', 'countriesLayer');
  citiesLayer = root.append('g').attr('id', 'citiesLayer');
  basesLayer = root.append('g').attr('id', 'basesLayer');
  unitsLayer = root.append('g').attr('id', 'unitsLayer');

  countries = await loadCountriesData();
  initializeCityState();

  function placeBaseFromEvent(event) {
    const [x, y] = d3.pointer(event, svg.node());
    const lonLat = projection.invert([x, y]);
    if (!lonLat) return;

    if (gameState.moveMode && gameState.selectedUnitId) {
      const result = movementSystem.issueMoveOrder(gameState.selectedUnitId, lonLat);
      if (!result.ok) {
        setStatus(result.message, true);
      } else {
        const unitDef = UNIT_DEFINITIONS[result.unit.type];
        setStatus(`${unitDef.label} moving. ETA: ${formatDateTime(result.unit.movement.arrivalAt)}.`);
      }
      gameState.moveMode = false;
      renderSelectedUnitPanel();
      renderUnits();
      return;
    }

    if (gameState.attackMode && gameState.selectedUnitId) {
      setStatus('Click an enemy unit or enemy base marker to attack.', true);
      return;
    }

    if (gameState.captureMode && gameState.selectedUnitId) {
      setStatus('Click an enemy city or enemy base marker to capture.', true);
      return;
    }

    if (!gameState.selectedPlayerCountry) {
      setStatus('Start from Play in the main menu before placing bases.', true);
      return;
    }

    if (!selectedBaseType) {
      setStatus('Build mode is off. Choose a base type to place a base.');
      return;
    }

    const clickedCountry = countries.find((country) => pointInsideCountry(country, lonLat));
    if (!clickedCountry || clickedCountry.id !== gameState.selectedPlayerCountry.id) {
      setStatus(`Place bases only inside ${gameState.selectedPlayerCountry.properties.name}.`, true);
      return;
    }

    const playerCountry = gameState.selectedPlayerCountry.properties.name;
    const baseCost = ECONOMY_CONFIG.baseBuildCost[selectedBaseType] || 0;
    if (!economySystem.spend(playerCountry, baseCost, `build ${selectedBaseType} base`)) {
      setStatus(`Insufficient funds for ${selectedBaseType} base (${baseCost}).`, true);
      refreshEconomyHud();
      return;
    }

    const base = createBase({ type: selectedBaseType, lonLat });
    gameState.selectedBaseId = base.id;
    renderBases();
    renderProductionPanel();

    const completeText = formatDateTime(base.buildCompleteAt);
    setStatus(`${base.type} base started construction. ETA: ${completeText}.`);
    refreshEconomyHud();
  }

  countriesLayer
    .selectAll('path')
    .data(countries)
    .enter()
    .append('path')
    .attr('class', 'country')
    .attr('d', path)
    .on('mousemove', function (event, d) {
      tooltip.style.opacity = 1;
      tooltip.style.left = `${event.clientX - mapWrap.getBoundingClientRect().left}px`;
      tooltip.style.top = `${event.clientY - mapWrap.getBoundingClientRect().top}px`;
      tooltip.textContent = d.properties.name;
    })
    .on('mouseleave', () => {
      tooltip.style.opacity = 0;
    })
    .on('click', function (event, d) {
      event.stopPropagation();
      if (!gameState.selectedPlayerCountry) {
        setStatus('Use Play in the main menu to choose your country first.', true);
        return;
      }
      if (d.id !== gameState.selectedPlayerCountry.id) {
        setStatus(`You are locked to ${gameState.selectedPlayerCountry.properties.name}.`, true);
        return;
      }
      selectedCountryFeature = d;
      selectedCountryLabel.textContent = `Selected: ${d.properties.name}`;
      renderCityList(d.properties.name);
      updateCountryStyles();

      // When already in-game and clicking inside your country, place a base.
      placeBaseFromEvent(event);
    });

  renderCities();

  svg.on('click', function (event) {
    placeBaseFromEvent(event);
  });

  renderCityList();
  createBaseButtons();
  populateCountrySelect();
  renderProductionPanel();
  renderUnits();
  renderSelectedUnitPanel();
  setOverlay('mainMenu');

  if (!d3.geoRobinson) {
    setStatus('Robinson projection plugin unavailable; using Natural Earth fallback.', true);
  }
}

async function init() {
  applySettingsUI();
  attachMenuHandlers();
  attachTimeControls();
  attachUnitControls();
  attachDiplomacyControls();
  attachPolicyControls();
  refreshTimeHud();
  refreshEconomyHud();
  refreshCountryHud();
  refreshDiplomacyHud();
  refreshPolicyHud();
  refreshDomesticHud();
  renderSelectedUnitPanel();

  try {
    await setupMap();
  } catch (err) {
    console.error(err);
    setStatus('Map data failed to load from all sources. Check internet access and refresh.', true);
  }

  startSimulationLoop();
}

init();
