class LocalInstabilitySystem {
  constructor(gameState, scheduler, countrySystem, migrationSystem, eventSystem, internalResistanceSystem, informationSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.migrationSystem = migrationSystem;
    this.eventSystem = eventSystem;
    this.internalResistanceSystem = internalResistanceSystem;
    this.informationSystem = informationSystem;
    this.started = false;
  }

  clamp(value) {
    return Math.max(LOCAL_INSTABILITY_CONFIG.clampMin, Math.min(LOCAL_INSTABILITY_CONFIG.clampMax, value));
  }

  clampDelta(value, min = -3, max = 3) {
    return Math.max(min, Math.min(max, value));
  }

  hashToUnit(seed) {
    const str = String(seed || 'hotspot');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 1000) / 1000;
  }

  ensureState() {
    this.gameState.localInstability = this.gameState.localInstability || {
      hotspotsById: {},
      hotspotIdsByCountry: {},
      selectedHotspotId: null,
      nextHotspotId: 1,
      lastTickAt: null,
      lastSummary: 'No local hotspot activity yet.',
      lastStatusAt: null
    };
    return this.gameState.localInstability;
  }

  buildBaseHotspot(city) {
    const id = `city_${city.id}`;
    const bias = this.hashToUnit(id);
    return {
      id,
      name: `${city.name} zone`,
      countryId: city.ownerCountry,
      linkedCityId: city.id,
      regionKey: null,
      localStability: this.clamp(64 + (bias - 0.5) * 8),
      localUnrest: this.clamp(16 + (0.5 - bias) * 10),
      localStateControl: this.clamp(74 + (bias - 0.5) * 14),
      localHumanitarianStrain: 0,
      hotspotTags: [],
      activePressures: {},
      staticRisk: this.clamp(42 + (bias - 0.5) * 36),
      migrationAttractiveness: this.clamp(45 + (1 - bias) * 35),
      severity: 0,
      severityLabel: 'stable',
      manualHotspot: false,
      lastUpdatedAt: this.gameState.currentTimeMs
    };
  }

  ensureHotspots() {
    const state = this.ensureState();
    this.gameState.cities.forEach((city) => {
      if (!city || city.status === 'destroyed') return;
      const hotspotId = `city_${city.id}`;
      if (!state.hotspotsById[hotspotId]) {
        state.hotspotsById[hotspotId] = this.buildBaseHotspot(city);
      }
      const hotspot = state.hotspotsById[hotspotId];
      hotspot.countryId = city.ownerCountry;
      hotspot.name = `${city.name} zone`;
      hotspot.linkedCityId = city.id;
      hotspot.lastUpdatedAt = hotspot.lastUpdatedAt || this.gameState.currentTimeMs;
    });

    state.hotspotIdsByCountry = {};
    Object.values(state.hotspotsById).forEach((hotspot) => {
      if (!hotspot.countryId) return;
      if (!state.hotspotIdsByCountry[hotspot.countryId]) state.hotspotIdsByCountry[hotspot.countryId] = [];
      state.hotspotIdsByCountry[hotspot.countryId].push(hotspot.id);
    });
  }

  getCountryHotspots(countryName) {
    const state = this.ensureState();
    const ids = state.hotspotIdsByCountry[countryName] || [];
    return ids
      .map((id) => state.hotspotsById[id])
      .filter(Boolean)
      .sort((a, b) => b.severity - a.severity);
  }

  getMigrationPressureByCountry() {
    const pressureByCountry = {};
    const flows = this.migrationSystem?.ensureState?.().flows || [];
    flows.forEach((flow) => {
      if (!flow.active) return;
      pressureByCountry[flow.destinationCountryId] = (pressureByCountry[flow.destinationCountryId] || 0) + flow.amount;
    });
    return pressureByCountry;
  }

  getEventPressureByCountry() {
    const out = {};
    (this.gameState.events?.active || []).forEach((event) => {
      if (!event.active) return;
      const severityScale = event.severity === 'high' ? 1.5 : (event.severity === 'low' ? 0.7 : 1);
      (event.targetCountryIds || []).forEach((countryId) => {
        out[countryId] = (out[countryId] || 0) + severityScale;
      });
    });
    return out;
  }

  calculateSeverity(hotspot) {
    const instability = hotspot.localUnrest * 0.45 + (100 - hotspot.localStateControl) * 0.32 + (100 - hotspot.localStability) * 0.23;
    return this.clamp(instability);
  }

  getSeverityLabel(severity) {
    if (severity >= 75) return 'critical hotspot';
    if (severity >= 58) return 'severe hotspot';
    if (severity >= 42) return 'active hotspot';
    return 'stable';
  }

  processCountry(countryName, migrationPressureByCountry, eventPressureByCountry) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    const hotspots = this.getCountryHotspots(countryName);
    if (!hotspots.length) return;

    const migrationPressure = (migrationPressureByCountry[countryName] || 0) / 20;
    const eventPressure = eventPressureByCountry[countryName] || 0;
    const nationalSpillover = Math.max(0, country.unrest - country.stability) / 24;
    const legitimacyWeakness = Math.max(0, 55 - (country.legitimacy || 0)) / 18;
    const continuityWeakness = Math.max(0, 58 - (country.governmentContinuity || 0)) / 20;
    const securityRecovery = country.policy?.internalSecurityLevel === 'high' ? 0.9 : (country.policy?.internalSecurityLevel === 'low' ? -0.5 : 0.25);
    const insurgencyNational = (country.insurgencyPressure || 0) / 85;
    const separatistNational = (country.separatistPressure || 0) / 90;
    const narrativePressure = Math.max(0, (country.domesticNarrativePressure || 0) - 48) / 28;
    const economicPressure = Math.max(0, (country.economicStress || 0) - 40) / 24;

    hotspots.forEach((hotspot, index) => {
      const concentrationBias = hotspot.staticRisk / 100;
      const migrationConcentration = migrationPressure * (hotspot.migrationAttractiveness / 100) * (index < 2 ? 1.25 : 0.7);
      const crisisConcentration = eventPressure * (0.4 + concentrationBias * 0.7) * (index === 0 ? 1.15 : 1);
      const insurgencyConcentration = insurgencyNational * (0.7 + concentrationBias * 0.8);
      const separatistConcentration = separatistNational * (0.6 + (1 - concentrationBias) * 0.6);

      const pressure = {
        nationalSpillover,
        migration: migrationConcentration,
        insurgency: insurgencyConcentration,
        separatist: separatistConcentration,
        crisis: crisisConcentration,
        governanceWeakness: legitimacyWeakness + continuityWeakness,
        information: narrativePressure,
        economic: economicPressure
      };

      const unrestDelta = this.clampDelta(
        0.15
        + pressure.nationalSpillover * 0.5
        + pressure.migration * 0.6
        + pressure.insurgency * 0.55
        + pressure.separatist * 0.42
        + pressure.crisis * 0.45
        + pressure.governanceWeakness * 0.4
        + pressure.information * 0.35
        + pressure.economic * 0.25
        - securityRecovery * 0.35
        - ((hotspot.localStability - 55) / 60),
        -1.7,
        2.4
      );

      const controlDelta = this.clampDelta(
        -0.12
        - (hotspot.localUnrest / 100) * 1.2
        - pressure.insurgency * 0.5
        - pressure.separatist * 0.44
        - pressure.crisis * 0.24
        + securityRecovery * 0.46
        + ((country.stateControl || 60) - 55) * 0.02,
        -2.2,
        1.3
      );

      const stabilityDelta = this.clampDelta(
        0.09
        - (hotspot.localUnrest / 100) * 1.5
        + (hotspot.localStateControl / 100) * 0.55
        - pressure.crisis * 0.33
        - pressure.information * 0.22
        - pressure.economic * 0.2
        + securityRecovery * 0.22,
        -2,
        1.6
      );

      hotspot.localUnrest = this.clamp(hotspot.localUnrest + unrestDelta);
      hotspot.localStateControl = this.clamp(hotspot.localStateControl + controlDelta);
      hotspot.localStability = this.clamp(hotspot.localStability + stabilityDelta);
      hotspot.localHumanitarianStrain = this.clamp((hotspot.localHumanitarianStrain || 0) * 0.85 + pressure.migration * 6 + pressure.crisis * 2.5);

      const tags = [];
      if (hotspot.localUnrest >= 62) tags.push('unrest hotspot');
      if (hotspot.localStateControl <= 43) tags.push('weak state control');
      if (pressure.insurgency + pressure.separatist > 1.35) tags.push('insurgency-prone area');
      if (hotspot.localHumanitarianStrain >= 35) tags.push('migration pressure zone');
      hotspot.hotspotTags = tags;

      hotspot.activePressures = {
        migration: Number(pressure.migration.toFixed(2)),
        insurgency: Number(pressure.insurgency.toFixed(2)),
        separatist: Number(pressure.separatist.toFixed(2)),
        crisis: Number(pressure.crisis.toFixed(2)),
        governance: Number(pressure.governanceWeakness.toFixed(2))
      };
      hotspot.severity = this.calculateSeverity(hotspot);
      hotspot.severityLabel = this.getSeverityLabel(hotspot.severity);
      hotspot.lastUpdatedAt = this.gameState.currentTimeMs;
    });

    const severeCount = hotspots.filter((h) => h.severity >= 58).length;
    const avgSeverity = hotspots.reduce((sum, h) => sum + h.severity, 0) / hotspots.length;
    const pressureRatio = avgSeverity / 100;
    country.localInstabilityEffects = {
      hotspotCount: hotspots.length,
      severeHotspotCount: severeCount,
      avgSeverity,
      outputPenalty: Math.min(0.24, pressureRatio * 0.18 + severeCount * 0.025),
      unrestDrift: Math.min(0.6, pressureRatio * 0.36 + severeCount * 0.08),
      legitimacyDrift: Math.min(0.5, pressureRatio * 0.3 + severeCount * 0.07),
      narrativeDrift: Math.min(0.55, pressureRatio * 0.28 + severeCount * 0.09),
      stateControlDrag: Math.min(0.45, pressureRatio * 0.23 + severeCount * 0.06),
      insurgencyDrift: Math.min(0.45, pressureRatio * 0.2 + severeCount * 0.05),
      separatistDrift: Math.min(0.38, pressureRatio * 0.16 + severeCount * 0.05)
    };

    country.unrest = this.clamp(country.unrest + country.localInstabilityEffects.unrestDrift * 0.12);
    country.legitimacy = this.clamp(country.legitimacy - country.localInstabilityEffects.legitimacyDrift * 0.1);
    country.publicSupport = this.clamp(country.publicSupport - country.localInstabilityEffects.legitimacyDrift * 0.08);
    country.domesticNarrativePressure = this.clamp(country.domesticNarrativePressure + country.localInstabilityEffects.narrativeDrift * 0.1);
    country.stateControl = this.clamp(country.stateControl - country.localInstabilityEffects.stateControlDrag * 0.09);
    country.insurgencyPressure = this.clamp(country.insurgencyPressure + country.localInstabilityEffects.insurgencyDrift * 0.08);
    country.separatistPressure = this.clamp(country.separatistPressure + country.localInstabilityEffects.separatistDrift * 0.08);

    this.applyCityConsequences(hotspots);
    this.announceStatus(countryName, hotspots);
  }

  applyCityConsequences(hotspots) {
    hotspots.forEach((hotspot) => {
      const city = this.gameState.cities.find((entry) => entry.id === hotspot.linkedCityId);
      if (!city) return;
      const localPenalty = Math.min(0.55, (hotspot.severity / 100) * 0.42 + (hotspot.localHumanitarianStrain || 0) / 280);
      city.localEconomicPenalty = localPenalty;
      city.localStateControl = hotspot.localStateControl;
      city.localUnrest = hotspot.localUnrest;
      city.localStability = hotspot.localStability;
      city.hotspotSeverity = hotspot.severity;
      city.hotspotTags = hotspot.hotspotTags;
    });
  }

  announceStatus(countryName, hotspots) {
    const playerCountry = this.gameState.selectedPlayerCountry?.properties?.name;
    if (playerCountry !== countryName) return;
    const state = this.ensureState();
    const top = hotspots[0];
    if (!top) return;
    const now = this.gameState.currentTimeMs;
    if (state.lastStatusAt && now - state.lastStatusAt < LOCAL_INSTABILITY_CONFIG.alertCooldownMs) return;
    if (top.severity >= 68) {
      setStatus(`Local hotspot escalation: ${top.name} is now ${top.severityLabel} (${top.severity.toFixed(0)}).`);
      state.lastStatusAt = now;
    } else if (top.severity < 35) {
      setStatus(`Hotspot recovery: ${top.name} has stabilized.`);
      state.lastStatusAt = now;
    }
  }

  adjustHotspotMetric(hotspotId, field, delta) {
    const hotspot = this.ensureState().hotspotsById[hotspotId];
    if (!hotspot) return null;
    if (!['localUnrest', 'localStateControl', 'localStability'].includes(field)) return null;
    hotspot[field] = this.clamp(hotspot[field] + delta);
    hotspot.manualHotspot = true;
    hotspot.lastUpdatedAt = this.gameState.currentTimeMs;
    hotspot.severity = this.calculateSeverity(hotspot);
    hotspot.severityLabel = this.getSeverityLabel(hotspot.severity);
    return hotspot[field];
  }

  setHotspotTag(hotspotId, tag) {
    const hotspot = this.ensureState().hotspotsById[hotspotId];
    if (!hotspot) return;
    if (!tag) {
      hotspot.hotspotTags = [];
      return;
    }
    if (!hotspot.hotspotTags.includes(tag)) hotspot.hotspotTags.push(tag);
  }

  clearHotspot(hotspotId) {
    const hotspot = this.ensureState().hotspotsById[hotspotId];
    if (!hotspot) return;
    hotspot.localUnrest = 12;
    hotspot.localStateControl = 78;
    hotspot.localStability = 72;
    hotspot.localHumanitarianStrain = 0;
    hotspot.hotspotTags = [];
    hotspot.manualHotspot = false;
    hotspot.severity = this.calculateSeverity(hotspot);
    hotspot.severityLabel = this.getSeverityLabel(hotspot.severity);
  }

  createManualHotspot(countryName, cityId, tag = 'unrest hotspot') {
    const city = this.gameState.cities.find((entry) => entry.id === Number(cityId) && entry.ownerCountry === countryName);
    if (!city) return null;
    const hotspotId = `city_${city.id}`;
    const hotspot = this.ensureState().hotspotsById[hotspotId] || this.buildBaseHotspot(city);
    hotspot.localUnrest = this.clamp(Math.max(hotspot.localUnrest, 70));
    hotspot.localStateControl = this.clamp(Math.min(hotspot.localStateControl, 38));
    hotspot.localStability = this.clamp(Math.min(hotspot.localStability, 38));
    hotspot.hotspotTags = Array.from(new Set([...(hotspot.hotspotTags || []), tag]));
    hotspot.manualHotspot = true;
    hotspot.lastUpdatedAt = this.gameState.currentTimeMs;
    hotspot.severity = this.calculateSeverity(hotspot);
    hotspot.severityLabel = this.getSeverityLabel(hotspot.severity);
    this.ensureState().hotspotsById[hotspotId] = hotspot;
    return hotspot;
  }

  processTick() {
    this.ensureHotspots();
    const migrationPressureByCountry = this.getMigrationPressureByCountry();
    const eventPressureByCountry = this.getEventPressureByCountry();
    Object.keys(this.gameState.countries).forEach((countryName) => {
      this.processCountry(countryName, migrationPressureByCountry, eventPressureByCountry);
    });
    const state = this.ensureState();
    state.lastTickAt = this.gameState.currentTimeMs;
    const allHotspots = Object.values(state.hotspotsById);
    const criticalCount = allHotspots.filter((h) => h.severity >= 58).length;
    state.lastSummary = `Local instability: ${criticalCount} severe hotspots across ${allHotspots.length} urban zones.`;
    refreshResistanceHud();
    refreshDomesticHud();
    refreshCountryHud();
    renderCities();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + LOCAL_INSTABILITY_CONFIG.tickMs,
      type: 'LOCAL_INSTABILITY_TICK',
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
