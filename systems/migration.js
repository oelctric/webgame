class MigrationSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
  }

  ensureState() {
    this.gameState.migration = this.gameState.migration || {
      flows: [],
      nextFlowId: 1,
      lastTickAt: null,
      lastSummary: 'No migration activity yet.',
      lastStatusAt: null
    };
    return this.gameState.migration;
  }

  clampPercent(value) {
    return Math.max(0, Math.min(100, value));
  }

  getWarCount(countryName) {
    return this.diplomacySystem.getRelationsForCountry(countryName).filter((relation) => relation.status === 'war').length;
  }

  getPushPressure(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const events = this.eventSystem.getActiveEventsForCountry(countryName);
    const warCount = this.getWarCount(countryName);
    const severeCrises = events.filter((event) => event.severity === 'high').length;

    const collapsePressure = Math.max(0, (30 - country.stability) / 30) * 12
      + Math.max(0, (country.unrest - 40) / 60) * 9
      + Math.max(0, (country.economicStress - 45) / 55) * 8
      + Math.max(0, (45 - country.legitimacy) / 45) * 6
      + Math.max(0, (45 - country.publicSupport) / 45) * 5;

    const refugeePressure = (warCount * 14)
      + Math.max(0, (country.unrest - 35) / 65) * 14
      + Math.max(0, (35 - country.stability) / 35) * 13
      + (severeCrises * 5)
      + (events.length * 1.7)
      + (pressure.incomingCount * 1.1)
      + collapsePressure * 0.55;

    const migrationPressure = Math.max(0, (country.economicStress - 22) / 78) * 14
      + Math.max(0, (country.treasury < 0 ? Math.min(12, Math.abs(country.treasury) / 350) : 0))
      + (pressure.incomingCount * 0.9)
      + Math.max(0, (45 - country.publicSupport) / 55) * 4
      + Math.max(0, (50 - country.stability) / 60) * 3
      + collapsePressure * 0.35;

    const primaryCause = warCount > 0
      ? 'war'
      : (country.unrest > 60 ? 'unrest' : (country.economicStress > 65 ? 'economic_breakdown' : 'instability'));

    return {
      refugee: Math.max(0, refugeePressure),
      migration: Math.max(0, migrationPressure),
      cause: primaryCause,
      severe: refugeePressure >= 24 || migrationPressure >= 20,
      warCount,
      eventCount: events.length
    };
  }

  getDestinationAttractiveness(originCountryId, destinationCountryId, type) {
    if (!originCountryId || !destinationCountryId || originCountryId === destinationCountryId) return 0;
    const destination = this.countrySystem.ensureCountry(destinationCountryId);
    const relation = this.diplomacySystem.getRelation(originCountryId, destinationCountryId);
    const relationScore = relation ? relation.relationScore : 0;
    const atWar = relation && relation.status === 'war';

    const stabilityFactor = destination.stability * 0.33;
    const unrestFactor = (100 - destination.unrest) * 0.2;
    const governanceFactor = ((destination.legitimacy + destination.publicSupport) / 2) * 0.17;
    const economicFactor = Math.min(100, ((destination.treasury / 120) + destination.industrialCapacity * 2.2)) * 0.16;
    const peaceBonus = atWar ? -30 : 7;
    const relationFactor = relationScore * 0.18;
    const burdenPenalty = (destination.humanitarianBurden || 0) * 0.26;
    const typeModifier = type === 'refugee' ? (destination.stability / 20) : Math.max(0, destination.industrialCapacity / 7);

    return Math.max(0, stabilityFactor + unrestFactor + governanceFactor + economicFactor + peaceBonus + relationFactor + typeModifier - burdenPenalty);
  }

  distributePressure(originCountryId, type, pressureValue, cause, severe = false, manual = false) {
    const migrationState = this.ensureState();
    if (pressureValue < MIGRATION_CONFIG.minPressureToFlow) return [];
    const countries = Object.keys(this.gameState.countries).filter((countryName) => countryName !== originCountryId);
    if (!countries.length) return [];

    const ranked = countries
      .map((destinationCountryId) => ({
        destinationCountryId,
        score: this.getDestinationAttractiveness(originCountryId, destinationCountryId, type)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MIGRATION_CONFIG.maxDestinationsPerType);

    if (!ranked.length) return [];

    const scoreSum = ranked.reduce((sum, entry) => sum + entry.score, 0);
    const createdOrUpdated = [];
    ranked.forEach((entry) => {
      const ratio = scoreSum > 0 ? entry.score / scoreSum : 1 / ranked.length;
      const amount = Math.max(1, pressureValue * ratio);
      const flow = this.upsertFlow({
        originCountryId,
        destinationCountryId: entry.destinationCountryId,
        type,
        amount,
        cause,
        severe,
        manual,
        durationMs: manual ? MIGRATION_CONFIG.manualFlowDurationMs : null
      });
      createdOrUpdated.push(flow);
    });

    migrationState.lastSummary = `${originCountryId} generated ${type} pressure toward ${createdOrUpdated.map((flow) => flow.destinationCountryId).join(', ')}.`;
    return createdOrUpdated;
  }

  upsertFlow({ originCountryId, destinationCountryId, type, amount, cause, severe = false, manual = false, durationMs = null }) {
    const state = this.ensureState();
    let flow = state.flows.find((entry) => entry.active
      && entry.originCountryId === originCountryId
      && entry.destinationCountryId === destinationCountryId
      && entry.type === type);

    if (!flow) {
      flow = {
        id: state.nextFlowId++,
        originCountryId,
        destinationCountryId,
        type,
        amount: 0,
        pressureValue: 0,
        startedAt: this.gameState.currentTimeMs,
        updatedAt: this.gameState.currentTimeMs,
        active: true,
        cause: cause || 'unknown',
        severity: severe ? 'high' : 'medium',
        manual,
        expiresAt: durationMs ? this.gameState.currentTimeMs + durationMs : null
      };
      state.flows.push(flow);
    }

    flow.amount = Math.max(0, flow.amount * 0.35 + amount * 0.65);
    flow.pressureValue = flow.amount;
    flow.updatedAt = this.gameState.currentTimeMs;
    flow.active = true;
    flow.cause = cause || flow.cause;
    flow.severity = severe || flow.amount > 20 ? 'high' : (flow.amount > 10 ? 'medium' : 'low');
    if (manual && durationMs) {
      flow.manual = true;
      flow.expiresAt = this.gameState.currentTimeMs + durationMs;
    }
    return flow;
  }

  getActiveFlowsForCountry(countryName) {
    const state = this.ensureState();
    return state.flows.filter((flow) => flow.active
      && (flow.originCountryId === countryName || flow.destinationCountryId === countryName));
  }

  applyOriginEffects(flow) {
    const origin = this.countrySystem.ensureCountry(flow.originCountryId);
    if (!origin) return;
    const pressureScale = flow.amount / 20;
    const domestic = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(origin)
      : { migrationShockMult: 1 };

    origin.manpowerPool = Math.max(0, origin.manpowerPool - pressureScale * (flow.type === 'refugee' ? 38 : 18));
    origin.unrest = this.clampPercent(origin.unrest + (flow.type === 'refugee' ? -0.08 : -0.04));
    origin.legitimacy = this.clampPercent(origin.legitimacy - pressureScale * (flow.type === 'refugee' ? 0.2 : 0.1) * (domestic.migrationShockMult || 1));
    origin.publicSupport = this.clampPercent(origin.publicSupport - pressureScale * (flow.type === 'refugee' ? 0.14 : 0.06) * (domestic.migrationShockMult || 1));
    origin.economicStress = this.clampPercent(origin.economicStress + pressureScale * 0.07);
  }

  applyDestinationEffects(flow) {
    const destination = this.countrySystem.ensureCountry(flow.destinationCountryId);
    const origin = this.countrySystem.ensureCountry(flow.originCountryId);
    if (!destination || !origin) return;

    const scale = flow.amount / 16;
    const domestic = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(destination)
      : { migrationShockMult: 1 };
    const absorptionFactor = Math.max(0.65, Math.min(1.25, 1 - (destination.stability - destination.unrest) / 240));
    const humanitarianDelta = flow.type === 'refugee' ? scale * 1.8 : scale * 0.6;

    destination.humanitarianBurden = Math.max(0, (destination.humanitarianBurden || 0) + humanitarianDelta * absorptionFactor);
    destination.economicStress = this.clampPercent(destination.economicStress + scale * 0.22 * absorptionFactor);
    destination.publicSupport = this.clampPercent(destination.publicSupport - scale * 0.2 * absorptionFactor * (domestic.migrationShockMult || 1));
    destination.legitimacy = this.clampPercent(destination.legitimacy - scale * 0.12 * absorptionFactor * (domestic.migrationShockMult || 1));
    destination.unrest = this.clampPercent(destination.unrest + scale * 0.18 * absorptionFactor * (domestic.migrationShockMult || 1));

    if (flow.type === 'migration') {
      destination.manpowerPool = Math.min(RESOURCE_CONFIG.manpowerPoolMax, destination.manpowerPool + scale * 20);
    }

    if (flow.amount > 18) {
      this.diplomacySystem.adjustRelationScore(
        flow.destinationCountryId,
        flow.originCountryId,
        -1,
        `Cross-border ${flow.type} burden pressure`
      );
    }
  }

  decayCountryHumanitarianBurden() {
    Object.keys(this.gameState.countries).forEach((countryName) => {
      const country = this.countrySystem.ensureCountry(countryName);
      country.humanitarianBurden = Math.max(0, (country.humanitarianBurden || 0) - MIGRATION_CONFIG.humanitarianDecayPerTick);
      if ((country.humanitarianBurden || 0) > 25) {
        country.economicStress = this.clampPercent(country.economicStress + 0.18);
        country.publicSupport = this.clampPercent(country.publicSupport - 0.16);
      }
    });
  }

  announceFlowStatus(flow, status) {
    const selectedCountry = this.gameState.selectedPlayerCountry?.properties?.name;
    if (!selectedCountry) return;
    if (selectedCountry !== flow.originCountryId && selectedCountry !== flow.destinationCountryId) return;
    const state = this.ensureState();
    if (state.lastStatusAt && this.gameState.currentTimeMs - state.lastStatusAt < MIGRATION_CONFIG.statusCooldownMs) return;
    state.lastStatusAt = this.gameState.currentTimeMs;
    setStatus(`${flow.type.toUpperCase()} flow ${status}: ${flow.originCountryId} → ${flow.destinationCountryId} (${flow.amount.toFixed(1)} pressure).`);
  }

  updateFlows() {
    const state = this.ensureState();
    state.flows.forEach((flow) => {
      if (!flow.active) return;
      if (flow.expiresAt && this.gameState.currentTimeMs >= flow.expiresAt) {
        flow.active = false;
        this.announceFlowStatus(flow, 'ended');
        return;
      }
      this.applyOriginEffects(flow);
      this.applyDestinationEffects(flow);

      const originPressure = this.getPushPressure(flow.originCountryId);
      const pressureTarget = flow.type === 'refugee' ? originPressure.refugee : originPressure.migration;
      flow.amount = Math.max(0, flow.amount * MIGRATION_CONFIG.flowFadeRate + pressureTarget * (1 - MIGRATION_CONFIG.flowFadeRate));
      flow.pressureValue = flow.amount;
      flow.updatedAt = this.gameState.currentTimeMs;

      if (flow.amount < MIGRATION_CONFIG.flowEasingThreshold) {
        flow.active = false;
        this.announceFlowStatus(flow, 'eased');
      } else if (flow.amount > 24 && flow.severity !== 'high') {
        flow.severity = 'high';
        this.announceFlowStatus(flow, 'escalated');
      }
    });

    state.flows = state.flows.filter((flow) => flow.active || (this.gameState.currentTimeMs - flow.updatedAt) < 30 * DAY_MS);
  }

  processTick() {
    const countries = Object.keys(this.gameState.countries);
    countries.forEach((countryName) => {
      const push = this.getPushPressure(countryName);
      this.distributePressure(countryName, 'refugee', push.refugee, push.cause, push.severe);
      this.distributePressure(countryName, 'migration', push.migration, push.cause, push.severe);
    });

    this.updateFlows();
    this.decayCountryHumanitarianBurden();

    const state = this.ensureState();
    state.lastTickAt = this.gameState.currentTimeMs;
    const activeCount = state.flows.filter((flow) => flow.active).length;
    const totalPressure = state.flows.filter((flow) => flow.active).reduce((sum, flow) => sum + flow.amount, 0);
    state.lastSummary = `Migration: ${activeCount} active flows, total pressure ${totalPressure.toFixed(1)}.`;

    refreshMigrationHud();
    refreshCountryHud();
    refreshDomesticHud();
    this.scheduleTick();
  }

  triggerManualFlow(originCountryId, destinationCountryId, type, amount, cause = null) {
    if (!originCountryId || !destinationCountryId || originCountryId === destinationCountryId) {
      return { ok: false, message: 'Pick two different countries.' };
    }
    if (!['refugee', 'migration'].includes(type)) {
      return { ok: false, message: 'Flow type must be refugee or migration.' };
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { ok: false, message: 'Flow amount must be positive.' };
    }
    const flow = this.upsertFlow({
      originCountryId,
      destinationCountryId,
      type,
      amount: numericAmount,
      cause: cause || (type === 'refugee' ? 'manual_forced_displacement' : 'manual_economic_migration'),
      severe: numericAmount >= 20,
      manual: true,
      durationMs: MIGRATION_CONFIG.manualFlowDurationMs
    });
    this.applyOriginEffects(flow);
    this.applyDestinationEffects(flow);
    this.ensureState().lastSummary = `Manual ${type} flow applied: ${originCountryId} → ${destinationCountryId}.`;
    this.announceFlowStatus(flow, 'started');
    refreshMigrationHud();
    return { ok: true, flow };
  }

  reduceFlow(flowId, reductionFactor = 0.5) {
    const state = this.ensureState();
    const flow = state.flows.find((entry) => entry.id === flowId && entry.active);
    if (!flow) return false;
    flow.amount = Math.max(0, flow.amount * Math.max(0, Math.min(1, reductionFactor)));
    flow.pressureValue = flow.amount;
    flow.updatedAt = this.gameState.currentTimeMs;
    if (flow.amount < MIGRATION_CONFIG.flowEasingThreshold) {
      flow.active = false;
      this.announceFlowStatus(flow, 'eased');
    }
    state.lastSummary = `Flow #${flowId} reduced.`;
    refreshMigrationHud();
    return true;
  }

  recomputeNow() {
    this.processTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + MIGRATION_CONFIG.tickMs,
      type: 'MIGRATION_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.ensureState();
    this.scheduleTick();
  }
}
