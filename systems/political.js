class PoliticalSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
  }

  clamp(value) {
    return Math.max(POLITICAL_CONFIG.clampMin, Math.min(POLITICAL_CONFIG.clampMax, value));
  }

  getPoliticalBucket(country) {
    const lowCount = [country.legitimacy, country.publicSupport, country.eliteSupport].filter((v) => v < 35).length;
    if (lowCount >= 2 || country.legitimacy < 28) return 'fragile';
    if (country.legitimacy < 48 || country.publicSupport < 45 || country.eliteSupport < 42) return 'strained';
    return 'stable';
  }

  getPoliticalLabel(country) {
    const tags = [];
    if (country.legitimacy < 40) tags.push('strained legitimacy');
    else if (country.legitimacy > 68) tags.push('stable government');
    if (country.publicSupport < 42) tags.push('public dissatisfaction');
    else if (country.publicSupport > 66) tags.push('public backing');
    if (country.eliteSupport < 40) tags.push('weak elite backing');
    else if (country.eliteSupport > 64) tags.push('solid elite backing');
    return tags.length ? tags.join(' • ') : 'politically balanced';
  }

  updateCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;

    const relations = this.diplomacySystem.getRelationsForCountry(countryName);
    const activeWars = relations.filter((relation) => relation.status === 'war').length;
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const events = this.eventSystem.getActiveEventsForCountry(countryName);
    const policy = country.policy || {};
    const profile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(country)
      : {
        warWearinessDriftMult: 1,
        repressionSupportPenaltyMult: 1,
        legitimacyRecoveryMult: 1,
        legitimacyCrisisThreshold: 24,
        legitimacyCollapseMult: 1,
        informationControlBase: 1,
        narrativePressureSensitivity: 1
      };

    const crisisCount = events.length;
    const economicCrisisCount = events.filter((event) => ['financial_panic', 'oil_supply_shock', 'industrial_strike'].includes(event.type)).length;
    const borderIncidentCount = events.filter((event) => event.type === 'border_incident').length;

    const economicPain = Math.max(0, country.economicStress - 35) / 65;
    const warPain = Math.max(0, country.warWeariness - 20) / 80 * (profile.warWearinessDriftMult || 1);
    const unrestPain = Math.max(0, country.unrest - 20) / 80;
    const sanctionsPain = Math.min(1, pressure.incomingCount / 4);
    const narrativePressure = Math.max(0, country.domesticNarrativePressure || 0) / 100;
    const severeNarrativePenalty = Math.max(0, (country.infoMetrics?.severePressureDays || 0) - 3) / 12;
    const narrativeShield = Math.max(0.35, 1 - ((country.informationControl || 50) / 130) * (profile.informationControlBase || 1));
    const resistancePressure = ((country.insurgencyPressure || 0) * 0.6 + (country.separatistPressure || 0) * 0.4) / 100;
    const controlWeakness = Math.max(0, 60 - (country.stateControl || 70)) / 60;

    const securityPenaltyBase = policy.internalSecurityLevel === 'high' ? 0.24 : (policy.internalSecurityLevel === 'normal' ? 0.08 : 0);
    const securityPenalty = securityPenaltyBase * (profile.repressionSupportPenaltyMult || 1);
    const securityEliteBoost = policy.internalSecurityLevel === 'high' ? 0.26 : (policy.internalSecurityLevel === 'normal' ? 0.08 : -0.06);
    const militaryStrainPenalty = policy.militarySpendingLevel === 'high' && activeWars === 0 && country.economicStress > 40 ? 0.2 : 0;
    const industryConfidenceBoost = policy.industryInvestmentLevel === 'high' && country.economicStress < 55 ? 0.15 : 0;

    const supportRecovery = country.treasury > 1500 && country.economicStress < 40 ? 0.22 : 0;
    const legitimacyRecovery = (country.stability > 58 && country.unrest < 35 ? 0.2 : 0) * (profile.legitimacyRecoveryMult || 1);

    country.publicSupport = this.clamp(country.publicSupport
      - (economicPain * 1.2)
      - (warPain * 1.1)
      - (sanctionsPain * 0.45)
      - (economicCrisisCount * 0.22)
      - (borderIncidentCount * 0.08)
      - securityPenalty
      - militaryStrainPenalty
      - (narrativePressure * 1.35 * narrativeShield * (profile.narrativePressureSensitivity || 1))
      - (resistancePressure * 0.75)
      - (controlWeakness * 0.45)
      + supportRecovery);

    const legitimacyCliff = country.publicSupport < (profile.legitimacyCrisisThreshold || 24)
      ? ((profile.legitimacyCollapseMult || 1) * 0.45)
      : 0;
    country.legitimacy = this.clamp(country.legitimacy
      - (unrestPain * 1.15)
      - (economicPain * 0.8)
      - (warPain * 0.75)
      - (crisisCount * 0.18)
      - legitimacyCliff
      - (narrativePressure * 0.95 * narrativeShield)
      - (resistancePressure * 0.92)
      - (controlWeakness * 0.72)
      - (severeNarrativePenalty * 0.35)
      + legitimacyRecovery
      + industryConfidenceBoost);

    country.eliteSupport = this.clamp(country.eliteSupport
      + securityEliteBoost
      - (country.treasury < 0 ? 0.22 : 0)
      - (country.legitimacy < 35 ? 0.2 : 0)
      - (country.unrest > 60 ? 0.12 : 0)
      - (country.domesticNarrativePressure > 72 ? 0.14 : 0)
      + (country.stability > 60 ? 0.12 : 0));

    const lowLegitimacyPenalty = country.legitimacy < 35 ? -0.24 : (country.legitimacy > 70 ? 0.1 : 0);
    const lowPublicPenalty = country.publicSupport < 38 ? 0.24 : (country.publicSupport > 68 ? -0.1 : 0);
    const elitePenalty = country.eliteSupport < 35 ? 0.82 : (country.eliteSupport > 66 ? 1.08 : 1);
    const crisisResilience = (country.eliteSupport < 35 ? 0.9 : (country.legitimacy > 65 ? 1.08 : 1))
      * (country.infoMetrics?.severePressureDays > 8 ? 0.92 : 1);

    country.politicalEffects = {
      stabilityDrift: lowLegitimacyPenalty,
      unrestDrift: lowPublicPenalty,
      policyEffectiveness: elitePenalty,
      crisisResilience
    };
    country.politicalLastTickAt = this.gameState.currentTimeMs;

    const bucket = this.getPoliticalBucket(country);
    const playerCountry = this.gameState.selectedPlayerCountry && this.gameState.selectedPlayerCountry.properties.name;
    if (countryName === playerCountry
      && bucket !== country.politicalAlertBucket
      && this.gameState.currentTimeMs - (country.lastPoliticalAlertAt || 0) >= POLITICAL_CONFIG.alertCooldownMs) {
      setStatus(`Political pressure changed: ${countryName} is now ${bucket} (${this.getPoliticalLabel(country)}).`);
      country.politicalAlertBucket = bucket;
      country.lastPoliticalAlertAt = this.gameState.currentTimeMs;
    }
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.updateCountry(countryName));
    this.gameState.political.lastTickAt = this.gameState.currentTimeMs;
    this.gameState.political.lastSummary = 'Political legitimacy and support updated.';
    refreshCountryHud();
    refreshDomesticHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + POLITICAL_CONFIG.tickMs,
      type: 'POLITICAL_TICK',
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
