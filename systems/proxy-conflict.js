class ProxyConflictSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, localInstabilitySystem = null, factionSystem = null, blocSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.localInstabilitySystem = localInstabilitySystem;
    this.factionSystem = factionSystem;
    this.blocSystem = blocSystem;
    this.started = false;
  }

  clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  ensureState() {
    this.gameState.proxyConflict = this.gameState.proxyConflict || {
      operations: [],
      nextOperationId: 1,
      cooldownsByKey: {},
      lastTickAt: null,
      lastSummary: 'No proxy operations yet.',
      incidentLog: []
    };
    if (!Array.isArray(this.gameState.proxyConflict.operations)) this.gameState.proxyConflict.operations = [];
    if (typeof this.gameState.proxyConflict.nextOperationId !== 'number') this.gameState.proxyConflict.nextOperationId = 1;
    if (!this.gameState.proxyConflict.cooldownsByKey) this.gameState.proxyConflict.cooldownsByKey = {};
    if (!Array.isArray(this.gameState.proxyConflict.incidentLog)) this.gameState.proxyConflict.incidentLog = [];
  }

  getTypeMeta(type) {
    return PROXY_CONFLICT_CONFIG.types[type] || null;
  }

  getOperationLabel(type) {
    return this.getTypeMeta(type)?.label || type;
  }

  getActiveOperationsBySource(sourceCountryId) {
    this.ensureState();
    return this.gameState.proxyConflict.operations.filter((op) => op.active && op.sourceCountryId === sourceCountryId);
  }

  getCooldownKey(sourceCountryId, targetCountryId, supportType) {
    return `${sourceCountryId}::${targetCountryId}::${supportType}`;
  }

  getTargetHotspot(targetCountryId, targetHotspotId) {
    if (!targetHotspotId || !this.localInstabilitySystem) return null;
    this.localInstabilitySystem.ensureHotspots();
    const hotspot = this.gameState.localInstability?.hotspotsById?.[targetHotspotId];
    if (!hotspot || hotspot.countryId !== targetCountryId) return null;
    return hotspot;
  }

  getPrimaryHotspotForCountry(targetCountryId) {
    if (!this.localInstabilitySystem) return null;
    this.localInstabilitySystem.ensureHotspots();
    const hotspots = this.localInstabilitySystem.getCountryHotspots(targetCountryId);
    return hotspots[0] || null;
  }

  resolveTargetDescriptor(operation) {
    if (operation.targetHotspotId) {
      const hotspot = this.getTargetHotspot(operation.targetCountryId, operation.targetHotspotId);
      if (hotspot) return `${hotspot.name} (${operation.targetCountryId})`;
    }
    if (operation.targetCityId) return `City #${operation.targetCityId} (${operation.targetCountryId})`;
    if (operation.targetCountryPressureKey) return `${operation.targetCountryPressureKey} (${operation.targetCountryId})`;
    return operation.targetCountryId;
  }

  getRemainingDuration(operation) {
    if (!operation.endAt) return null;
    return Math.max(0, operation.endAt - this.gameState.currentTimeMs);
  }

  logIncident(message, announce = false) {
    const state = this.gameState.proxyConflict;
    state.incidentLog.unshift({ at: this.gameState.currentTimeMs, message });
    state.incidentLog = state.incidentLog.slice(0, PROXY_CONFLICT_CONFIG.maxIncidentLog);
    state.lastSummary = message;
    if (announce && typeof setStatus === 'function') setStatus(message);
  }

  getEffectiveness(source, target, hotspot = null) {
    const targetSecurity = target.policy?.internalSecurityLevel === 'high' ? 1.28 : (target.policy?.internalSecurityLevel === 'low' ? 0.88 : 1);
    const legitimacyShield = 1 + Math.max(0, (target.legitimacy - 55) / 130);
    const controlShield = 1 + Math.max(0, (target.stateControl - 60) / 150);
    const weaknessBoost = 1
      + Math.max(0, 48 - (target.legitimacy || 0)) / 90
      + Math.max(0, 50 - (target.stateControl || 0)) / 85
      + Math.max(0, (target.domesticNarrativePressure || 0) - 55) / 170;
    const hotspotAmplifier = hotspot ? 1 + Math.max(0, hotspot.severity - 45) / 120 : 1;
    const sourcePosture = source.foreignPolicyStyle === 'aggressive' ? 1.12 : (source.foreignPolicyStyle === 'cooperative' ? 0.9 : 1);
    const governanceShield = 1 + Math.max(0, ((target.localGovernanceCapacity || 50) - 50) / 120);
    const emergencyShield = target.emergencyPowersActive ? 1.08 : 1;
    const autonomyExposure = 1 + Math.max(0, ((target.regionalAutonomy || 50) - 50) / 180);

    const combined = (weaknessBoost * hotspotAmplifier * sourcePosture * autonomyExposure) / (targetSecurity * legitimacyShield * controlShield * governanceShield * emergencyShield);
    return Math.max(0.5, Math.min(1.8, combined));
  }

  canStartOperation({ sourceCountryId, targetCountryId, supportType, strength = 1, attributionRisk = 0.3, durationDays = PROXY_CONFLICT_CONFIG.defaultDurationDays, targetHotspotId = null }) {
    this.ensureState();
    const source = this.countrySystem.ensureCountry(sourceCountryId);
    const target = this.countrySystem.ensureCountry(targetCountryId);
    const typeMeta = this.getTypeMeta(supportType);
    if (!source || !target || !typeMeta) return { ok: false, reason: 'Invalid proxy operation setup.' };
    if (sourceCountryId === targetCountryId) return { ok: false, reason: 'Proxy operations require a rival target.' };

    const activeBySource = this.getActiveOperationsBySource(sourceCountryId);
    if (activeBySource.length >= PROXY_CONFLICT_CONFIG.maxActiveOpsPerCountry) {
      return { ok: false, reason: `Proxy operation cap reached (${PROXY_CONFLICT_CONFIG.maxActiveOpsPerCountry}).` };
    }

    const cooldownKey = this.getCooldownKey(sourceCountryId, targetCountryId, supportType);
    const cooldownAt = this.gameState.proxyConflict.cooldownsByKey[cooldownKey] || 0;
    if (cooldownAt > this.gameState.currentTimeMs) {
      const daysLeft = Math.ceil((cooldownAt - this.gameState.currentTimeMs) / DAY_MS);
      return { ok: false, reason: `Operation cooldown active (${daysLeft}d remaining).` };
    }

    const normalizedStrength = Math.max(PROXY_CONFLICT_CONFIG.minStrength, Math.min(PROXY_CONFLICT_CONFIG.maxStrength, Number(strength) || 1));
    const normalizedRisk = Math.max(PROXY_CONFLICT_CONFIG.minAttributionRisk, Math.min(PROXY_CONFLICT_CONFIG.maxAttributionRisk, Number(attributionRisk) || PROXY_CONFLICT_CONFIG.defaultAttributionRisk));
    const normalizedDuration = Math.max(PROXY_CONFLICT_CONFIG.minDurationDays, Math.min(PROXY_CONFLICT_CONFIG.maxDurationDays, Number(durationDays) || PROXY_CONFLICT_CONFIG.defaultDurationDays));

    let hotspot = null;
    if (targetHotspotId) {
      hotspot = this.getTargetHotspot(targetCountryId, targetHotspotId);
      if (!hotspot) return { ok: false, reason: 'Selected hotspot is unavailable for target country.' };
    } else if (typeMeta.prefersHotspotTarget) {
      hotspot = this.getPrimaryHotspotForCountry(targetCountryId);
    }

    const upfrontCost = Math.round(typeMeta.baseUpfrontCost * normalizedStrength);
    if (source.treasury < upfrontCost) {
      return { ok: false, reason: `Not enough treasury (${upfrontCost.toLocaleString()} needed).` };
    }

    return {
      ok: true,
      source,
      target,
      typeMeta,
      normalizedStrength,
      normalizedRisk,
      normalizedDuration,
      targetHotspotId: hotspot?.id || null,
      upfrontCost
    };
  }

  startOperation(params) {
    const result = this.canStartOperation(params);
    if (!result.ok) return result;
    const {
      source,
      target,
      typeMeta,
      normalizedStrength,
      normalizedRisk,
      normalizedDuration,
      targetHotspotId,
      upfrontCost
    } = result;

    source.treasury = Math.max(0, source.treasury - upfrontCost);
    const durationMs = normalizedDuration * DAY_MS;
    const operation = {
      id: `proxy_${this.gameState.proxyConflict.nextOperationId++}`,
      sourceCountryId: source.name,
      targetCountryId: target.name,
      targetHotspotId,
      targetCityId: params.targetCityId || null,
      targetCountryPressureKey: params.targetCountryPressureKey || null,
      supportType: params.supportType,
      startedAt: this.gameState.currentTimeMs,
      durationMs,
      endAt: this.gameState.currentTimeMs + durationMs,
      active: true,
      strength: normalizedStrength,
      attributionRisk: normalizedRisk,
      exposed: false,
      discoveredAt: null,
      effectProfile: { ...typeMeta.effectProfile },
      dailyCost: Math.round(typeMeta.dailyCost * normalizedStrength),
      upfrontCost,
      status: 'active',
      endedAt: null,
      canceledAt: null
    };

    this.gameState.proxyConflict.operations.push(operation);
    this.logIncident(`${source.name} started ${typeMeta.label.toLowerCase()} against ${this.resolveTargetDescriptor(operation)}.`, true);
    return { ok: true, operation };
  }

  endOperation(operation, reason = 'expired') {
    if (!operation.active) return;
    operation.active = false;
    operation.status = reason;
    operation.endedAt = this.gameState.currentTimeMs;
    const cooldownKey = this.getCooldownKey(operation.sourceCountryId, operation.targetCountryId, operation.supportType);
    this.gameState.proxyConflict.cooldownsByKey[cooldownKey] = this.gameState.currentTimeMs + PROXY_CONFLICT_CONFIG.cooldownMs;
  }

  cancelOperation(operationId, reason = 'canceled') {
    this.ensureState();
    const operation = this.gameState.proxyConflict.operations.find((op) => op.id === operationId || String(op.id) === String(operationId));
    if (!operation || !operation.active) return false;
    this.endOperation(operation, reason);
    operation.canceledAt = this.gameState.currentTimeMs;
    this.logIncident(`${operation.sourceCountryId} canceled ${this.getOperationLabel(operation.supportType).toLowerCase()} targeting ${this.resolveTargetDescriptor(operation)}.`, true);
    return true;
  }

  applyExposure(operation, forced = false) {
    if (operation.exposed) return;
    const source = this.countrySystem.ensureCountry(operation.sourceCountryId);
    const target = this.countrySystem.ensureCountry(operation.targetCountryId);
    if (!source || !target) return;

    operation.exposed = true;
    operation.discoveredAt = this.gameState.currentTimeMs;
    const severity = operation.strength * (forced ? 1.4 : 1);

    this.diplomacySystem.adjustRelationScore(source.name, target.name, -8 - (severity * 2.4), `Exposed proxy operation by ${source.name}`, true);
    source.internationalReputation = Math.max(-100, source.internationalReputation - (3.5 + severity * 1.2));
    source.domesticNarrativePressure = this.clamp(source.domesticNarrativePressure + (0.6 * severity));

    if (this.blocSystem) {
      const blocs = this.blocSystem.getCountryBlocs(target.name);
      blocs.forEach((bloc) => {
        bloc.memberCountryIds
          .filter((memberId) => memberId !== target.name && memberId !== source.name)
          .forEach((allyId) => {
            this.diplomacySystem.adjustRelationScore(source.name, allyId, -2.2 - severity * 0.7, `Bloc backlash after exposure in ${target.name}`, true);
          });
      });
    }

    this.logIncident(`Proxy activity exposed: ${source.name} linked to ${this.getOperationLabel(operation.supportType).toLowerCase()} in ${target.name}.`, true);
  }

  applyOperationEffects(operation, elapsedDays) {
    const source = this.countrySystem.ensureCountry(operation.sourceCountryId);
    const target = this.countrySystem.ensureCountry(operation.targetCountryId);
    if (!source || !target) {
      this.endOperation(operation, 'invalid');
      return;
    }

    const runningCost = operation.dailyCost * elapsedDays;
    if (source.treasury < runningCost) {
      this.endOperation(operation, 'budget_exhausted');
      this.logIncident(`${source.name} halted ${this.getOperationLabel(operation.supportType).toLowerCase()} due to budget exhaustion.`, true);
      return;
    }
    source.treasury = Math.max(0, source.treasury - runningCost);

    const hotspot = this.getTargetHotspot(target.name, operation.targetHotspotId);
    const effectiveness = this.getEffectiveness(source, target, hotspot);
    const base = PROXY_CONFLICT_CONFIG.effectBasePerDay * operation.strength * elapsedDays * effectiveness;

    if (operation.supportType === 'insurgent_support') {
      target.insurgencyPressure = this.clamp(target.insurgencyPressure + (1.25 * base));
      target.unrest = this.clamp(target.unrest + (0.72 * base));
      target.stateControl = this.clamp(target.stateControl - (0.48 * base));
      target.foreignBackedPressure = this.clamp(target.foreignBackedPressure + (0.95 * base));
      if (hotspot) {
        hotspot.localUnrest = this.clamp(hotspot.localUnrest + (1.12 * base));
        hotspot.localStateControl = this.clamp(hotspot.localStateControl - (0.8 * base));
        hotspot.localStability = this.clamp(hotspot.localStability - (0.45 * base));
      }
    }

    if (operation.supportType === 'separatist_support') {
      target.separatistPressure = this.clamp(target.separatistPressure + (1.28 * base));
      target.stateControl = this.clamp(target.stateControl - (0.68 * base));
      target.legitimacy = this.clamp(target.legitimacy - (0.32 * base));
      target.foreignBackedPressure = this.clamp(target.foreignBackedPressure + (0.9 * base));
      if (hotspot) {
        hotspot.localStateControl = this.clamp(hotspot.localStateControl - (1.05 * base));
        hotspot.localUnrest = this.clamp(hotspot.localUnrest + (0.78 * base));
        hotspot.localStability = this.clamp(hotspot.localStability - (0.62 * base));
      }
    }

    if (operation.supportType === 'faction_support') {
      target.domesticNarrativePressure = this.clamp(target.domesticNarrativePressure + (0.95 * base));
      target.legitimacy = this.clamp(target.legitimacy - (0.45 * base));
      target.publicSupport = this.clamp(target.publicSupport - (0.28 * base));
      target.foreignBackedPressure = this.clamp(target.foreignBackedPressure + (0.7 * base));
      if (this.factionSystem) {
        this.factionSystem.ensureCountryFactions(target);
        const hardliner = target.factions?.hardliner_reform_bloc;
        const security = target.factions?.security_elite;
        if (hardliner) {
          hardliner.influence = this.clamp(hardliner.influence + (0.7 * base));
          hardliner.satisfaction = this.clamp(hardliner.satisfaction - (0.35 * base));
          hardliner.pressureDirection = 'hardline';
        }
        if (security) {
          security.influence = this.clamp(security.influence + (0.35 * base));
          security.satisfaction = this.clamp(security.satisfaction - (0.25 * base));
        }
        target.factionEffects = this.factionSystem.computePressure(target);
      }
    }

    if (operation.supportType === 'hotspot_destabilization') {
      target.unrest = this.clamp(target.unrest + (0.64 * base));
      target.domesticNarrativePressure = this.clamp(target.domesticNarrativePressure + (0.6 * base));
      target.foreignBackedPressure = this.clamp(target.foreignBackedPressure + (0.75 * base));
      const resolvedHotspot = hotspot || this.getPrimaryHotspotForCountry(target.name);
      if (resolvedHotspot) {
        operation.targetHotspotId = resolvedHotspot.id;
        resolvedHotspot.localUnrest = this.clamp(resolvedHotspot.localUnrest + (1.25 * base));
        resolvedHotspot.localStateControl = this.clamp(resolvedHotspot.localStateControl - (1.1 * base));
        resolvedHotspot.localStability = this.clamp(resolvedHotspot.localStability - (0.7 * base));
      } else {
        target.stateControl = this.clamp(target.stateControl - (0.36 * base));
      }
    }

    if (!operation.exposed) {
      const exposureRoll = Math.random();
      const perTickRisk = operation.attributionRisk * PROXY_CONFLICT_CONFIG.exposureCheckPerDay * elapsedDays;
      if (exposureRoll < perTickRisk) {
        this.applyExposure(operation, false);
      }
    }

    if (operation.endAt <= this.gameState.currentTimeMs) {
      this.endOperation(operation, 'expired');
      this.logIncident(`${this.getOperationLabel(operation.supportType)} by ${operation.sourceCountryId} expired in ${operation.targetCountryId}.`);
    }
  }

  forceExpose(operationId) {
    const operation = this.gameState.proxyConflict.operations.find((op) => op.id === operationId || String(op.id) === String(operationId));
    if (!operation || !operation.active) return false;
    this.applyExposure(operation, true);
    return true;
  }

  processTick() {
    this.ensureState();
    const elapsedMs = this.gameState.currentTimeMs - (this.gameState.proxyConflict.lastTickAt || this.gameState.currentTimeMs);
    const elapsedDays = Math.max(0.25, elapsedMs / DAY_MS);

    let activeCount = 0;
    this.gameState.proxyConflict.operations.forEach((operation) => {
      if (!operation.active) return;
      if (operation.endAt <= this.gameState.currentTimeMs) {
        this.endOperation(operation, 'expired');
        return;
      }
      this.applyOperationEffects(operation, elapsedDays);
      if (operation.active) activeCount += 1;
    });

    if (!activeCount && this.gameState.proxyConflict.lastSummary === 'No proxy operations yet.') {
      this.gameState.proxyConflict.lastSummary = 'No active proxy operations.';
    }

    this.gameState.proxyConflict.lastTickAt = this.gameState.currentTimeMs;
    refreshProxyConflictHud();
    refreshDomesticHud();
    refreshResistanceHud();
    refreshLocalHotspotHud();
    refreshDiplomacyHud();
    refreshEconomyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + PROXY_CONFLICT_CONFIG.tickMs,
      type: 'PROXY_CONFLICT_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.ensureState();
    this.started = true;
    this.gameState.proxyConflict.lastTickAt = this.gameState.currentTimeMs;
    this.scheduleTick();
  }
}
