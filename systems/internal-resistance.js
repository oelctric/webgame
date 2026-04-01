class InternalResistanceSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, migrationSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
    this.migrationSystem = migrationSystem;
    this.started = false;
    this.nextHotspotId = 1;
  }

  clamp(value) {
    return Math.max(INTERNAL_RESISTANCE_CONFIG.clampMin, Math.min(INTERNAL_RESISTANCE_CONFIG.clampMax, value));
  }

  clampDelta(value, min = -2.5, max = 2.5) {
    return Math.max(min, Math.min(max, value));
  }

  getResistanceBucket(country) {
    if (country.stateControl < 38 || country.insurgencyPressure > 72 || country.separatistPressure > 70) return 'critical';
    if (country.stateControl < 58 || country.insurgencyPressure > 50 || country.separatistPressure > 45) return 'rising';
    return 'low';
  }

  getResistanceLabel(country) {
    const bucket = this.getResistanceBucket(country);
    if (bucket === 'critical') return 'state control weakening';
    if (bucket === 'rising') {
      if (country.insurgencyPressure >= country.separatistPressure) return 'insurgency rising';
      return 'separatist pressure growing';
    }
    return 'resistance low';
  }

  ensureHotspot(country, label = 'Unstable corridor', opts = {}) {
    if (!country || !Array.isArray(country.resistanceHotspots)) return null;
    const hotspot = {
      id: this.nextHotspotId++,
      label,
      insurgencyPressure: this.clamp(opts.insurgencyPressure ?? Math.max(0, country.insurgencyPressure - 8)),
      separatistPressure: this.clamp(opts.separatistPressure ?? Math.max(0, country.separatistPressure - 6)),
      stateControl: this.clamp(opts.stateControl ?? Math.max(0, country.stateControl - 8)),
      foreignSupport: this.clamp(opts.foreignSupport ?? (country.foreignBackedPressure || 0)),
      economicPenalty: 0,
      unrestDrift: 0,
      lastUpdatedAt: this.gameState.currentTimeMs
    };
    country.resistanceHotspots.push(hotspot);
    return hotspot;
  }

  adjustPressure(countryName, field, delta) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    if (!['insurgencyPressure', 'separatistPressure', 'stateControl', 'foreignBackedPressure'].includes(field)) return null;
    country[field] = this.clamp(country[field] + delta);
    return country[field];
  }

  applyHotspotTick(country) {
    if (!Array.isArray(country.resistanceHotspots) || !country.resistanceHotspots.length) return;
    country.resistanceHotspots.forEach((hotspot) => {
      const localInsurgencyDrift = ((country.insurgencyPressure - hotspot.insurgencyPressure) * 0.08)
        + ((hotspot.foreignSupport || 0) * 0.04)
        + Math.max(0, (country.unrest || 0) - 55) * 0.008;
      const localSeparatistDrift = ((country.separatistPressure - hotspot.separatistPressure) * 0.08)
        + Math.max(0, (100 - hotspot.stateControl) - 30) * 0.006;
      hotspot.insurgencyPressure = this.clamp(hotspot.insurgencyPressure + this.clampDelta(localInsurgencyDrift, -1.8, 2));
      hotspot.separatistPressure = this.clamp(hotspot.separatistPressure + this.clampDelta(localSeparatistDrift, -1.6, 1.9));
      hotspot.stateControl = this.clamp(hotspot.stateControl
        + this.clampDelta(
          -0.2
          - hotspot.insurgencyPressure * 0.01
          - hotspot.separatistPressure * 0.009
          + (country.policy?.internalSecurityLevel === 'high' ? 0.5 : 0)
          + (country.stateControl - 50) * 0.006,
          -2,
          1.4
        ));
      hotspot.economicPenalty = Math.max(0, Math.min(0.45, (hotspot.insurgencyPressure + hotspot.separatistPressure) / 240));
      hotspot.unrestDrift = Math.max(0, (55 - hotspot.stateControl) / 140);
      hotspot.lastUpdatedAt = this.gameState.currentTimeMs;
    });
    country.resistanceHotspots = country.resistanceHotspots
      .sort((a, b) => (b.insurgencyPressure + b.separatistPressure) - (a.insurgencyPressure + a.separatistPressure))
      .slice(0, 3);
  }

  computePressureDrift(countryName, country) {
    const activeWars = this.diplomacySystem.getRelationsForCountry(countryName).filter((relation) => relation.status === 'war').length;
    const activeEvents = this.eventSystem.getActiveEventsForCountry(countryName);
    const policy = country.policy || {};
    const lowLegitimacy = Math.max(0, 55 - country.legitimacy) / 55;
    const unrestFactor = Math.max(0, country.unrest - 25) / 75;
    const warFactor = Math.max(0, country.warWeariness - 18) / 82;
    const economicFactor = Math.max(0, country.economicStress - 26) / 74;
    const weakSecurity = policy.internalSecurityLevel === 'low' ? 1 : (policy.internalSecurityLevel === 'normal' ? 0.4 : -0.7);
    const leadershipWeakness = Math.max(0, 60 - (country.governmentContinuity || 0)) / 60;
    const supportWeakness = Math.max(0, 55 - (country.publicSupport || 0)) / 55;
    const narrativeFactor = Math.max(0, (country.domesticNarrativePressure || 0) - 52) / 48;
    const humanitarianFactor = Math.max(0, (country.humanitarianBurden || 0) - 14) / 86;
    const crisisFactor = Math.min(1, activeEvents.length / 5);
    const foreignFactor = (country.foreignBackedPressure || 0) / 100;

    const insurgencyDrift = this.clampDelta(
      0.12
      + lowLegitimacy * 1.05
      + unrestFactor * 0.95
      + warFactor * 0.85
      + economicFactor * 0.72
      + supportWeakness * 0.42
      + leadershipWeakness * 0.33
      + narrativeFactor * 0.34
      + humanitarianFactor * 0.22
      + crisisFactor * 0.28
      + activeWars * 0.16
      + weakSecurity
      + foreignFactor * 0.8
      - (country.stateControl > 74 ? 0.45 : 0)
      - (country.legitimacy > 66 ? 0.22 : 0),
      -1.8,
      2.8
    );

    const separatistDrift = this.clampDelta(
      0.08
      + Math.max(0, 56 - country.stateControl) / 50
      + lowLegitimacy * 0.72
      + unrestFactor * 0.54
      + crisisFactor * 0.26
      + leadershipWeakness * 0.34
      + foreignFactor * 0.52
      + (activeWars > 0 ? 0.2 : 0)
      - (policy.internalSecurityLevel === 'high' ? 0.26 : 0)
      - (country.stateControl > 72 ? 0.3 : 0),
      -1.6,
      2.2
    );

    return { insurgencyDrift, separatistDrift };
  }

  applyConsequences(country) {
    const resistanceMix = (country.insurgencyPressure * 0.58 + country.separatistPressure * 0.42) / 100;
    const controlLoss = Math.max(0, 70 - country.stateControl) / 70;
    const outputPenalty = Math.min(INTERNAL_RESISTANCE_CONFIG.outputPenaltyMax, resistanceMix * 0.22 + controlLoss * 0.16);
    const manpowerPenalty = Math.min(INTERNAL_RESISTANCE_CONFIG.manpowerPenaltyMax, resistanceMix * 0.16 + controlLoss * 0.14);
    const securityCost = Math.round(Math.min(INTERNAL_RESISTANCE_CONFIG.securityCostMax, resistanceMix * 60 + controlLoss * 38));

    country.resistanceEffects = {
      outputPenalty,
      manpowerPenalty,
      securityCost,
      legitimacyDrift: -Math.max(0, resistanceMix * 0.26 + controlLoss * 0.18),
      publicSupportDrift: -Math.max(0, resistanceMix * 0.22 + controlLoss * 0.15)
    };
  }

  updateCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    const drifts = this.computePressureDrift(countryName, country);

    country.insurgencyPressure = this.clamp(country.insurgencyPressure + drifts.insurgencyDrift);
    country.separatistPressure = this.clamp(country.separatistPressure + drifts.separatistDrift);

    const securityLevel = country.policy?.internalSecurityLevel || 'normal';
    const securityBoost = securityLevel === 'high' ? 0.9 : (securityLevel === 'normal' ? 0.3 : -0.35);
    const legitimacyGuard = (country.legitimacy - 50) * 0.012;
    const continuityGuard = ((country.governmentContinuity || 55) - 55) * 0.01;
    const resistanceDrag = country.insurgencyPressure * 0.014 + country.separatistPressure * 0.012;
    country.stateControl = this.clamp(country.stateControl + this.clampDelta(0.1 + securityBoost + legitimacyGuard + continuityGuard - resistanceDrag, -2.2, 1.7));

    this.applyHotspotTick(country);
    this.applyConsequences(country);

    const bucket = this.getResistanceBucket(country);
    const playerCountry = this.gameState.selectedPlayerCountry && this.gameState.selectedPlayerCountry.properties.name;
    if (countryName === playerCountry
      && bucket !== country.resistanceAlertBucket
      && this.gameState.currentTimeMs - (country.lastResistanceAlertAt || 0) >= INTERNAL_RESISTANCE_CONFIG.alertCooldownMs) {
      setStatus(`Internal resistance update: ${countryName} is now ${this.getResistanceLabel(country)}.`);
      country.resistanceAlertBucket = bucket;
      country.lastResistanceAlertAt = this.gameState.currentTimeMs;
    }
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.updateCountry(countryName));
    this.gameState.internalResistance.lastTickAt = this.gameState.currentTimeMs;
    this.gameState.internalResistance.lastSummary = 'Internal resistance and state control updated.';
    refreshCountryHud();
    refreshDomesticHud();
    refreshResistanceHud();
    refreshEconomyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + INTERNAL_RESISTANCE_CONFIG.tickMs,
      type: 'INTERNAL_RESISTANCE_TICK',
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
