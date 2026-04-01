class InfluenceSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
  }

  ensureState() {
    this.gameState.influence = this.gameState.influence || {
      operations: [],
      nextOperationId: 1,
      cooldownsByKey: {},
      lastTickAt: null,
      lastSummary: 'No influence operations yet.'
    };
    if (!Array.isArray(this.gameState.influence.operations)) this.gameState.influence.operations = [];
    if (typeof this.gameState.influence.nextOperationId !== 'number') this.gameState.influence.nextOperationId = 1;
    if (!this.gameState.influence.cooldownsByKey) this.gameState.influence.cooldownsByKey = {};
    if (this.gameState.influence.lastTickAt == null) this.gameState.influence.lastTickAt = null;
    if (!this.gameState.influence.lastSummary) this.gameState.influence.lastSummary = 'No influence operations yet.';
  }

  getCountryModifiers(country) {
    const profile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getProfile(country)
      : { regimeType: country.regimeType, economicOrientation: country.economicOrientation, foreignPolicyStyle: country.foreignPolicyStyle };

    const domesticPropagandaBonus = profile.regimeType === 'authoritarian' ? 1.26 : (profile.regimeType === 'democracy' ? 0.88 : 1);
    const disinformationOffense = profile.foreignPolicyStyle === 'aggressive' ? 1.2 : (profile.foreignPolicyStyle === 'cooperative' ? 0.82 : 1);
    const reputationCampaignBonus = profile.foreignPolicyStyle === 'cooperative' ? 1.18 : (profile.foreignPolicyStyle === 'aggressive' ? 0.85 : 1);
    const destabilizationOffense = profile.foreignPolicyStyle === 'aggressive' ? 1.22 : (profile.foreignPolicyStyle === 'cooperative' ? 0.8 : 1);
    const costMod = profile.economicOrientation === 'state_led' ? 0.93 : (profile.economicOrientation === 'market' ? 1.04 : 1);
    return {
      domesticPropagandaBonus,
      disinformationOffense,
      reputationCampaignBonus,
      destabilizationOffense,
      costMod
    };
  }

  getTargetResilience(country) {
    const profile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getProfile(country)
      : { regimeType: country.regimeType };
    const democraticSwing = profile.regimeType === 'democracy' ? 1.15 : 1;
    const authoritarianSuppression = profile.regimeType === 'authoritarian' ? 0.86 : 1;
    const base = ((100 - (country.informationControl || 50)) / 100) * 0.7 + 0.3;
    return Math.max(0.45, Math.min(1.5, base * democraticSwing * authoritarianSuppression));
  }

  getOperationTypeMeta(type) {
    return INFLUENCE_CONFIG.types[type] || null;
  }

  getOperationLabel(type) {
    const meta = this.getOperationTypeMeta(type);
    return meta ? meta.label : type;
  }

  getActiveOperationsBySource(sourceCountryId) {
    this.ensureState();
    return this.gameState.influence.operations.filter((op) => op.active && op.sourceCountryId === sourceCountryId);
  }

  getCooldownKey(sourceCountryId, targetCountryId, type) {
    return `${sourceCountryId}::${targetCountryId || sourceCountryId}::${type}`;
  }

  getRemainingDuration(operation) {
    if (!operation.endAt) return null;
    return Math.max(0, operation.endAt - this.gameState.currentTimeMs);
  }

  canStartOperation({ type, sourceCountryId, targetCountryId, intensity = 1 }) {
    this.ensureState();
    const source = this.countrySystem.ensureCountry(sourceCountryId);
    if (!source) return { ok: false, reason: 'Invalid source country.' };
    const typeMeta = this.getOperationTypeMeta(type);
    if (!typeMeta) return { ok: false, reason: 'Unknown operation type.' };

    const requiresTarget = Boolean(typeMeta.requiresForeignTarget);
    const resolvedTarget = requiresTarget ? targetCountryId : sourceCountryId;
    if (requiresTarget && (!targetCountryId || targetCountryId === sourceCountryId)) {
      return { ok: false, reason: 'Select a foreign target country.' };
    }
    const target = this.countrySystem.ensureCountry(resolvedTarget);
    if (!target) return { ok: false, reason: 'Invalid target country.' };

    const activeBySource = this.getActiveOperationsBySource(sourceCountryId);
    if (activeBySource.length >= INFLUENCE_CONFIG.maxActiveOpsPerCountry) {
      return { ok: false, reason: `Operation limit reached (${INFLUENCE_CONFIG.maxActiveOpsPerCountry}).` };
    }

    const sameTypeOnTarget = activeBySource.find((operation) => operation.type === type && operation.targetCountryId === resolvedTarget);
    if (sameTypeOnTarget) {
      return { ok: false, reason: 'This campaign is already active on that target.' };
    }

    const cooldownKey = this.getCooldownKey(sourceCountryId, resolvedTarget, type);
    const cooldownAt = this.gameState.influence.cooldownsByKey[cooldownKey] || 0;
    if (cooldownAt > this.gameState.currentTimeMs) {
      const days = Math.ceil((cooldownAt - this.gameState.currentTimeMs) / DAY_MS);
      return { ok: false, reason: `Campaign cooldown active (${days}d remaining).` };
    }

    const normalizedIntensity = Math.max(INFLUENCE_CONFIG.minIntensity, Math.min(INFLUENCE_CONFIG.maxIntensity, Number(intensity) || 1));
    const modifiers = this.getCountryModifiers(source);
    const upfrontCost = Math.round(typeMeta.baseCost * normalizedIntensity * modifiers.costMod);
    if (source.treasury < upfrontCost) {
      return { ok: false, reason: `Not enough treasury (${upfrontCost.toLocaleString()} required).` };
    }

    return {
      ok: true,
      source,
      target,
      typeMeta,
      intensity: normalizedIntensity,
      upfrontCost
    };
  }

  startOperation(params) {
    const eligibility = this.canStartOperation(params);
    if (!eligibility.ok) return eligibility;
    this.ensureState();
    const { source, target, typeMeta, intensity, upfrontCost } = eligibility;
    source.treasury = Math.max(0, source.treasury - upfrontCost);

    const operation = {
      id: this.gameState.influence.nextOperationId++,
      type: params.type,
      sourceCountryId: source.name,
      targetCountryId: target.name,
      startedAt: this.gameState.currentTimeMs,
      durationMs: (Number(params.durationDays) || INFLUENCE_CONFIG.defaultDurationDays) * DAY_MS,
      endAt: this.gameState.currentTimeMs + ((Number(params.durationDays) || INFLUENCE_CONFIG.defaultDurationDays) * DAY_MS),
      active: true,
      intensity,
      status: 'active',
      effectProfile: {
        ...typeMeta.effectProfile,
        strength: intensity
      },
      dailyCost: Math.round(typeMeta.dailyCost * intensity),
      upfrontCost,
      canceledAt: null,
      endedAt: null
    };

    this.gameState.influence.operations.push(operation);
    this.gameState.influence.lastSummary = `${source.name} started ${typeMeta.label.toLowerCase()} targeting ${target.name}.`;
    return { ok: true, operation };
  }

  cancelOperation(operationId, reason = 'canceled') {
    this.ensureState();
    const operation = this.gameState.influence.operations.find((item) => item.id === Number(operationId));
    if (!operation || !operation.active) return false;
    operation.active = false;
    operation.status = reason;
    operation.canceledAt = this.gameState.currentTimeMs;
    operation.endedAt = this.gameState.currentTimeMs;
    const cooldownKey = this.getCooldownKey(operation.sourceCountryId, operation.targetCountryId, operation.type);
    this.gameState.influence.cooldownsByKey[cooldownKey] = this.gameState.currentTimeMs + INFLUENCE_CONFIG.cooldownMs;
    this.gameState.influence.lastSummary = `${operation.sourceCountryId} canceled ${this.getOperationLabel(operation.type).toLowerCase()} on ${operation.targetCountryId}.`;
    return true;
  }

  endOperation(operation, reason = 'expired') {
    if (!operation.active) return;
    operation.active = false;
    operation.status = reason;
    operation.endedAt = this.gameState.currentTimeMs;
    const cooldownKey = this.getCooldownKey(operation.sourceCountryId, operation.targetCountryId, operation.type);
    this.gameState.influence.cooldownsByKey[cooldownKey] = this.gameState.currentTimeMs + INFLUENCE_CONFIG.cooldownMs;
  }

  clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  applyOperationEffects(operation, elapsedDays) {
    const source = this.countrySystem.ensureCountry(operation.sourceCountryId);
    const target = this.countrySystem.ensureCountry(operation.targetCountryId);
    if (!source || !target) {
      this.endOperation(operation, 'invalid');
      return;
    }

    const dailyCost = operation.dailyCost * elapsedDays;
    if (source.treasury < dailyCost) {
      this.endOperation(operation, 'budget_exhausted');
      this.gameState.influence.lastSummary = `${source.name} halted ${this.getOperationLabel(operation.type).toLowerCase()} due to budget exhaustion.`;
      return;
    }
    source.treasury = Math.max(0, source.treasury - dailyCost);

    const sourceMods = this.getCountryModifiers(source);
    const targetResilience = this.getTargetResilience(target);
    const strength = operation.intensity * elapsedDays;
    const baseStrength = INFLUENCE_CONFIG.effectBasePerDay * strength;

    if (operation.type === 'domestic_propaganda') {
      const boost = baseStrength * sourceMods.domesticPropagandaBonus;
      source.domesticNarrativePressure = this.clamp(source.domesticNarrativePressure - (1.3 * boost));
      source.publicSupport = this.clamp(source.publicSupport + (0.75 * boost));
      source.legitimacy = this.clamp(source.legitimacy + (0.55 * boost));
      source.informationControl = this.clamp(source.informationControl + (0.5 * boost));
    }

    if (operation.type === 'foreign_disinformation') {
      const blow = baseStrength * sourceMods.disinformationOffense * targetResilience;
      target.domesticNarrativePressure = this.clamp(target.domesticNarrativePressure + (1.4 * blow));
      target.publicSupport = this.clamp(target.publicSupport - (0.85 * blow));
      target.legitimacy = this.clamp(target.legitimacy - (0.55 * blow));
      target.informationControl = this.clamp(target.informationControl - (0.35 * blow));
      source.infoMetrics.aggressiveActions += 0.1 * strength;
      this.diplomacySystem.changeRelation(source.name, target.name, -0.08 * strength);
    }

    if (operation.type === 'reputation_campaign') {
      const campaign = baseStrength * sourceMods.reputationCampaignBonus;
      if (operation.targetCountryId === source.name) {
        source.internationalReputation = Math.max(-100, Math.min(100, source.internationalReputation + (0.9 * campaign)));
        source.infoMetrics.cooperativeActions += 0.1 * strength;
      } else {
        const hostile = campaign * targetResilience;
        source.internationalReputation = Math.max(-100, Math.min(100, source.internationalReputation + (0.35 * campaign)));
        target.internationalReputation = Math.max(-100, Math.min(100, target.internationalReputation - (0.8 * hostile)));
        source.infoMetrics.aggressiveActions += 0.08 * strength;
        this.diplomacySystem.changeRelation(target.name, source.name, -0.09 * strength);
      }
    }

    if (operation.type === 'destabilization_campaign') {
      const pressure = baseStrength * sourceMods.destabilizationOffense * targetResilience;
      target.unrest = this.clamp(target.unrest + (1.1 * pressure));
      target.insurgencyPressure = this.clamp(target.insurgencyPressure + (0.85 * pressure));
      target.separatistPressure = this.clamp(target.separatistPressure + (0.72 * pressure));
      target.foreignBackedPressure = this.clamp((target.foreignBackedPressure || 0) + (0.9 * pressure));
      target.stateControl = this.clamp(target.stateControl - (0.62 * pressure));
      target.legitimacy = this.clamp(target.legitimacy - (0.42 * pressure));
      source.infoMetrics.aggressiveActions += 0.14 * strength;
      this.diplomacySystem.changeRelation(target.name, source.name, -0.12 * strength);
    }
  }

  processTick() {
    this.ensureState();
    const elapsedMs = this.gameState.currentTimeMs - (this.gameState.influence.lastTickAt || this.gameState.currentTimeMs);
    const elapsedDays = Math.max(0.25, elapsedMs / DAY_MS);
    const operations = this.gameState.influence.operations;
    let expired = 0;

    operations.forEach((operation) => {
      if (!operation.active) return;
      if (operation.endAt <= this.gameState.currentTimeMs) {
        this.endOperation(operation, 'expired');
        expired += 1;
        return;
      }
      this.applyOperationEffects(operation, elapsedDays);
      if (operation.active && operation.endAt <= this.gameState.currentTimeMs) {
        this.endOperation(operation, 'expired');
        expired += 1;
      }
    });

    this.gameState.influence.lastTickAt = this.gameState.currentTimeMs;
    const activeCount = operations.filter((operation) => operation.active).length;
    this.gameState.influence.lastSummary = activeCount
      ? `Influence ops active: ${activeCount}${expired ? ` • expired this tick: ${expired}` : ''}.`
      : 'No active influence operations.';

    refreshInformationHud();
    refreshDomesticHud();
    refreshResistanceHud();
    refreshDiplomacyHud();
    refreshCountryHud();
    refreshEconomyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + INFLUENCE_CONFIG.tickMs,
      type: 'INFLUENCE_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.ensureState();
    this.started = true;
    this.gameState.influence.lastTickAt = this.gameState.currentTimeMs;
    this.scheduleTick();
  }
}
