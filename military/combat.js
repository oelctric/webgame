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
      blocSystem?.handleAggression(attacker.ownerCountry, target.ownerCountry);
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
