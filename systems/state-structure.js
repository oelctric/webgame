class StateStructureSystem {
  constructor(gameState, scheduler, countrySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.started = false;
  }

  clamp(value, min = STATE_STRUCTURE_CONFIG.clampMin, max = STATE_STRUCTURE_CONFIG.clampMax) {
    return Math.max(min, Math.min(max, value));
  }

  getStructureDefaults(structure = 'hybrid') {
    return STATE_STRUCTURE_CONFIG.structures[structure] || STATE_STRUCTURE_CONFIG.structures.hybrid;
  }

  deriveDefaultStructure(country) {
    if (country.regimeType === 'authoritarian') return 'centralized';
    if (country.regimeType === 'democracy') return 'federal';
    return 'hybrid';
  }

  ensureCountryFields(country) {
    if (!country) return null;
    if (!['centralized', 'hybrid', 'federal'].includes(country.stateStructure)) {
      country.stateStructure = this.deriveDefaultStructure(country);
    }
    const defaults = this.getStructureDefaults(country.stateStructure);
    if (typeof country.regionalAutonomy !== 'number') country.regionalAutonomy = defaults.defaultAutonomy;
    if (typeof country.localGovernanceCapacity !== 'number') country.localGovernanceCapacity = defaults.defaultGovernance;
    if (typeof country.centerRegionTension !== 'number') country.centerRegionTension = defaults.defaultTension;
    country.regionalAutonomy = this.clamp(country.regionalAutonomy);
    country.localGovernanceCapacity = this.clamp(country.localGovernanceCapacity);
    country.centerRegionTension = this.clamp(country.centerRegionTension);
    if (typeof country.emergencyPowersActive !== 'boolean') country.emergencyPowersActive = false;
    if (typeof country.emergencyPowersSince !== 'number') country.emergencyPowersSince = 0;
    if (typeof country.lastEmergencyToggleAt !== 'number') country.lastEmergencyToggleAt = 0;
    return country;
  }

  getStructureLabel(country) {
    if (country.stateStructure === 'centralized') return 'highly centralized';
    if (country.stateStructure === 'federal') return 'federalized / high autonomy';
    return 'balanced regional structure';
  }

  getGovernanceLabel(country) {
    if (country.localGovernanceCapacity < 35) return 'local governance weak';
    if (country.localGovernanceCapacity > 70) return 'local governance resilient';
    return 'local governance mixed';
  }

  setStateStructure(countryName, structure) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country || !['centralized', 'hybrid', 'federal'].includes(structure)) return false;
    this.ensureCountryFields(country);
    country.stateStructure = structure;
    const defaults = this.getStructureDefaults(structure);
    country.regionalAutonomy = this.clamp((country.regionalAutonomy * 0.65) + (defaults.defaultAutonomy * 0.35));
    country.localGovernanceCapacity = this.clamp((country.localGovernanceCapacity * 0.75) + (defaults.defaultGovernance * 0.25));
    return true;
  }

  adjustRegionalAutonomy(countryName, delta) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureCountryFields(country);
    country.regionalAutonomy = this.clamp(country.regionalAutonomy + delta);
    return country.regionalAutonomy;
  }

  adjustLocalGovernance(countryName, delta) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureCountryFields(country);
    country.localGovernanceCapacity = this.clamp(country.localGovernanceCapacity + delta);
    return country.localGovernanceCapacity;
  }

  adjustCenterRegionTension(countryName, delta) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureCountryFields(country);
    country.centerRegionTension = this.clamp(country.centerRegionTension + delta);
    return country.centerRegionTension;
  }

  toggleEmergencyPowers(countryName, active = null, force = false) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return { ok: false, reason: 'Country not found.' };
    this.ensureCountryFields(country);
    const nextState = typeof active === 'boolean' ? active : !country.emergencyPowersActive;
    if (!force && this.gameState.currentTimeMs - country.lastEmergencyToggleAt < STATE_STRUCTURE_CONFIG.emergencyToggleCooldownMs) {
      return { ok: false, reason: 'Emergency posture change is on cooldown.' };
    }
    country.emergencyPowersActive = nextState;
    country.lastEmergencyToggleAt = this.gameState.currentTimeMs;
    if (nextState) country.emergencyPowersSince = this.gameState.currentTimeMs;
    return { ok: true, active: nextState, country };
  }

  getModifiers(country) {
    this.ensureCountryFields(country);
    const autonomy = country.regionalAutonomy / 100;
    const governance = country.localGovernanceCapacity / 100;
    const tension = country.centerRegionTension / 100;
    const weakLeadership = Math.max(0, 60 - (country.governmentContinuity || 60)) / 100;
    const base = {
      localRecovery: governance * 0.95,
      spilloverBuffer: autonomy * governance,
      separatistSensitivity: 0.9 + autonomy * 0.6 + tension * 0.4,
      crackdownControlBonus: 0,
      repressionCostMultiplier: 1,
      proxyVulnerability: 1 + (1 - governance) * 0.32 + tension * 0.22,
      emergencyControlBonus: country.emergencyPowersActive ? 1 : 0,
      centerRegionPenalty: tension * 0.7 + weakLeadership * 0.4
    };

    if (country.stateStructure === 'centralized') {
      base.crackdownControlBonus = 0.9;
      base.repressionCostMultiplier = 1.2 + autonomy * 0.25;
      base.localRecovery *= 0.84;
      base.spilloverBuffer *= 0.72;
      base.separatistSensitivity *= 0.9;
    } else if (country.stateStructure === 'federal') {
      base.crackdownControlBonus = 0.2;
      base.repressionCostMultiplier = 0.9;
      base.localRecovery *= 1.14;
      base.spilloverBuffer *= 1.16;
      base.separatistSensitivity *= 1.18;
    } else {
      base.crackdownControlBonus = 0.5;
      base.repressionCostMultiplier = 1;
    }

    if (country.emergencyPowersActive) {
      base.crackdownControlBonus += 0.62;
      base.proxyVulnerability *= 0.9;
      base.separatistSensitivity += autonomy * 0.15;
    }

    return base;
  }

  applyEmergencyTradeoffs(country) {
    if (!country.emergencyPowersActive) return;
    const regime = country.regimeType || 'hybrid';
    const sensitivity = regime === 'democracy' ? 1.25 : (regime === 'hybrid' ? 1 : 0.72);
    const modifiers = this.getModifiers(country);
    const pressure = Math.max(0, (country.domesticNarrativePressure || 0) - 45) / 100;
    const crackdownIntensity = (country.policy?.internalSecurityLevel === 'high' ? 1.1 : 0.72) + modifiers.crackdownControlBonus * 0.35;

    country.stateControl = this.clamp(country.stateControl + (0.35 + modifiers.crackdownControlBonus * 0.18));
    country.unrest = this.clamp(country.unrest - (0.3 + modifiers.localRecovery * 0.12));
    country.legitimacy = this.clamp(country.legitimacy - (0.24 * sensitivity * modifiers.repressionCostMultiplier * crackdownIntensity));
    country.publicSupport = this.clamp(country.publicSupport - (0.2 * sensitivity * (0.85 + pressure)));
    country.domesticNarrativePressure = this.clamp(country.domesticNarrativePressure + (0.28 * sensitivity * modifiers.repressionCostMultiplier));
  }

  updateCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    this.ensureCountryFields(country);
    const modifiers = this.getModifiers(country);
    const hotspotSeverity = country.localInstabilityEffects?.avgSeverity || 0;
    const pressureMix = (country.separatistPressure * 0.32) + (hotspotSeverity * 0.24) + (Math.max(0, 55 - country.legitimacy) * 0.36);
    const decentralizationLoad = country.stateStructure === 'federal' ? 1.12 : (country.stateStructure === 'centralized' ? 0.9 : 1);
    const tensionDrift = ((pressureMix / 100) * decentralizationLoad) - (modifiers.localRecovery * 0.32) - ((country.legitimacy || 0) > 62 ? 0.2 : 0);
    country.centerRegionTension = this.clamp(country.centerRegionTension + Math.max(-1.2, Math.min(1.5, tensionDrift)));

    if (country.stateStructure === 'federal' && country.centerRegionTension > 62) {
      country.stateControl = this.clamp(country.stateControl - 0.35);
    }
    this.applyEmergencyTradeoffs(country);
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.updateCountry(countryName));
    refreshCountryHud();
    refreshDomesticHud();
    refreshResistanceHud();
    refreshLocalHotspotHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + STATE_STRUCTURE_CONFIG.tickMs,
      type: 'STATE_STRUCTURE_TICK',
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
