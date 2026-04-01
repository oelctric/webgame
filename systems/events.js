class EventSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.started = false;
    this.nextEventId = 1;
  }

  getDurationForType(type) {
    return EVENT_CONFIG.typeDurations[type] || (6 * DAY_MS);
  }

  hasDuplicateActive(type, targetCountryId, targetCountryIds = []) {
    return this.gameState.events.active.some((event) => event.active
      && event.type === type
      && event.targetCountryId === targetCountryId
      && JSON.stringify(event.targetCountryIds || []) === JSON.stringify(targetCountryIds || []));
  }

  createEvent(type, { targetCountryId = null, targetCountryIds = [], targetChokepointId = null, severity = EVENT_CONFIG.defaultSeverity } = {}) {
    if (!type || (!targetCountryId && !targetCountryIds.length)) return null;
    if (this.hasDuplicateActive(type, targetCountryId, targetCountryIds)) return null;
    const startTime = this.gameState.currentTimeMs;
    const duration = this.getDurationForType(type);
    const event = {
      id: this.nextEventId++,
      type,
      title: this.getTitle(type),
      description: this.getDescription(type),
      targetCountryId,
      targetCountryIds: targetCountryIds.length ? [...targetCountryIds] : (targetCountryId ? [targetCountryId] : []),
      targetChokepointId,
      startTime,
      endTime: startTime + duration,
      duration,
      active: true,
      severity,
      effects: this.getEffects(type),
      resolvedAt: null,
      lastAppliedAt: null
    };
    this.gameState.events.active.push(event);
    this.logEvent(`START: ${event.title} (${event.targetCountryIds.join(' vs ')})`);
    setStatus(`Event started: ${event.title}`);
    return event;
  }

  getTitle(type) {
    const titles = {
      oil_supply_shock: 'Oil Supply Shock',
      industrial_strike: 'Industrial Strike',
      financial_panic: 'Financial Panic',
      protest_wave: 'Protest Wave',
      border_incident: 'Border Incident',
      chokepoint_disruption: 'Chokepoint Disruption'
    };
    return titles[type] || 'Unknown Event';
  }

  getDescription(type) {
    const descriptions = {
      oil_supply_shock: 'Temporary supply disruption reduces oil availability and raises stress.',
      industrial_strike: 'Strike action lowers productive output and raises unrest.',
      financial_panic: 'Capital flight and fear reduce income and increase economic stress.',
      protest_wave: 'Mass protest movement increases unrest and pressures stability.',
      border_incident: 'Border confrontation increases bilateral tension.',
      chokepoint_disruption: 'Strategic route disruption restricts a major chokepoint and pressures connected trade.'
    };
    return descriptions[type] || 'No description.';
  }

  getEffects(type) {
    const effects = {
      oil_supply_shock: { oilGenerationMultiplier: 0.72, economicStressDrift: 0.12 },
      industrial_strike: { incomeMultiplier: 0.88, industryGrowthMultiplier: 0.8, unrestDrift: 0.18 },
      financial_panic: { incomeMultiplier: 0.82, treasuryDailyDelta: -60, economicStressDrift: 0.22 },
      protest_wave: { unrestDrift: 0.28, stabilityDrift: -0.16 },
      border_incident: { relationDailyDelta: -2, warWearinessDrift: 0.06 },
      chokepoint_disruption: { chokepointOpenState: 'blocked', economicStressDrift: 0.08 }
    };
    return effects[type] || {};
  }

  logEvent(message) {
    this.gameState.events.recentLog.unshift({ at: this.gameState.currentTimeMs, message });
    this.gameState.events.recentLog = this.gameState.events.recentLog.slice(0, EVENT_CONFIG.maxRecentLog);
  }

  getActiveEventsForCountry(countryName) {
    return this.gameState.events.active.filter((event) => event.active && event.targetCountryIds.includes(countryName));
  }

  getModifiersForCountry(countryName) {
    const active = this.getActiveEventsForCountry(countryName);
    let incomeMultiplier = 1;
    let oilGenerationMultiplier = 1;
    let industryGrowthMultiplier = 1;
    let manpowerRegenMultiplier = 1;
    let treasuryDailyDelta = 0;
    let economicStressDrift = 0;
    let unrestDrift = 0;
    let stabilityDrift = 0;
    let warWearinessDrift = 0;

    active.forEach((event) => {
      const fx = event.effects || {};
      if (fx.incomeMultiplier != null) incomeMultiplier *= fx.incomeMultiplier;
      if (fx.oilGenerationMultiplier != null) oilGenerationMultiplier *= fx.oilGenerationMultiplier;
      if (fx.industryGrowthMultiplier != null) industryGrowthMultiplier *= fx.industryGrowthMultiplier;
      if (fx.manpowerRegenMultiplier != null) manpowerRegenMultiplier *= fx.manpowerRegenMultiplier;
      treasuryDailyDelta += fx.treasuryDailyDelta || 0;
      economicStressDrift += fx.economicStressDrift || 0;
      unrestDrift += fx.unrestDrift || 0;
      stabilityDrift += fx.stabilityDrift || 0;
      warWearinessDrift += fx.warWearinessDrift || 0;
    });

    return {
      incomeMultiplier: Math.max(0.5, incomeMultiplier),
      oilGenerationMultiplier: Math.max(0.5, oilGenerationMultiplier),
      industryGrowthMultiplier: Math.max(0.55, industryGrowthMultiplier),
      manpowerRegenMultiplier: Math.max(0.55, manpowerRegenMultiplier),
      treasuryDailyDelta,
      economicStressDrift,
      unrestDrift,
      stabilityDrift,
      warWearinessDrift
    };
  }

  applyDiplomaticIncidents() {
    this.gameState.events.active.forEach((event) => {
      if (!event.active || event.type !== 'border_incident') return;
      if (event.lastAppliedAt && this.gameState.currentTimeMs - event.lastAppliedAt < DAY_MS) return;
      const [a, b] = event.targetCountryIds;
      if (!a || !b) return;
      this.diplomacySystem.adjustRelationScore(a, b, event.effects.relationDailyDelta || -2, 'Border incident escalation', true);
      event.lastAppliedAt = this.gameState.currentTimeMs;
    });
  }

  resolveExpiredEvents() {
    this.gameState.events.active.forEach((event) => {
      if (!event.active || event.endTime > this.gameState.currentTimeMs) return;
      event.active = false;
      event.resolvedAt = this.gameState.currentTimeMs;
      this.logEvent(`END: ${event.title} (${event.targetCountryIds.join(' vs ')})`);
      setStatus(`Event ended: ${event.title}`);
    });
    this.gameState.events.active = this.gameState.events.active.filter((event) => event.active);
  }

  generateRandomEvent() {
    if (Math.random() > EVENT_CONFIG.randomChancePerTick) return;
    const countries = Object.keys(this.gameState.countries);
    if (!countries.length) return;
    const primary = countries[Math.floor(Math.random() * countries.length)];
    const secondary = countries.find((name) => name !== primary);
    const types = ['oil_supply_shock', 'industrial_strike', 'financial_panic', 'protest_wave', 'border_incident', 'chokepoint_disruption'];
    const type = types[Math.floor(Math.random() * types.length)];
    if (type === 'border_incident' && secondary) {
      this.createEvent(type, { targetCountryIds: [primary, secondary] });
    } else if (type === 'chokepoint_disruption' && this.gameState.chokepoints.points.length) {
      const target = this.gameState.chokepoints.points[Math.floor(Math.random() * this.gameState.chokepoints.points.length)];
      this.createEvent(type, { targetCountryId: primary, targetChokepointId: target.id });
    } else {
      this.createEvent(type, { targetCountryId: primary });
    }
  }

  processTick() {
    this.applyDiplomaticIncidents();
    this.resolveExpiredEvents();
    this.generateRandomEvent();
    refreshEventHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + EVENT_CONFIG.tickMs,
      type: 'EVENT_TICK',
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
