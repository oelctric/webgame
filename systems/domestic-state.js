class DomesticStateSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, policySystem, eventSystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.policySystem = policySystem;
    this.eventSystem = eventSystem;
    this.governmentProfileSystem = governmentProfileSystem;
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
    const eventModifiers = this.eventSystem.getModifiersForCountry(countryName);
    const politicalEffects = country.politicalEffects || {
      stabilityDrift: 0,
      unrestDrift: 0,
      policyEffectiveness: 1,
      crisisResilience: 1
    };
    const crisisStressFactor = 1 / Math.max(0.8, Math.min(1.2, politicalEffects.crisisResilience || 1));
    const profile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(country)
      : {
        warWearinessDriftMult: 1,
        unrestSensitivity: 1,
        securitySuppressionMult: 1,
        migrationShockMult: 1
      };
    const securitySuppression = profile.securitySuppressionMult || 1;
    const oilShortage = country.oil < RESOURCE_CONFIG.oilShortageThreshold ? 0.18 : 0;
    const industryStrain = country.industrialCapacity < 22 ? 0.14 : 0;
    const manpowerShortage = country.manpowerPool < 1200 ? 0.12 : 0;
    const resistanceEffects = country.resistanceEffects || {};
    const hotspotUnrest = (country.resistanceHotspots || []).reduce((sum, hotspot) => sum + (hotspot.unrestDrift || 0), 0);

    country.warWeariness = this.clamp(country.warWeariness + ((activeWars > 0 ? 0.4 + activeWars * 0.2 : -0.3) + (militarySpending === 'high' ? 0.08 : 0)) * (profile.warWearinessDriftMult || 1));
    country.economicStress = this.clamp(country.economicStress
      + (country.treasury < 0 ? 0.6 + Math.min(0.35, Math.abs(country.treasury) / 10000) : -0.22)
      + (country.netPerTick < 0 ? 0.25 : -0.1)
      + (policy.industryInvestmentLevel === 'high' && country.treasury < 1000 ? 0.1 : 0)
      + pressure.stressDrift
      + Math.max(0, 58 - (country.stateControl || 70)) * 0.006
      + Math.max(0, (country.humanitarianBurden || 0) - 10) * 0.01 * (profile.migrationShockMult || 1)
      + oilShortage
      + industryStrain
      + eventModifiers.economicStressDrift * crisisStressFactor
      - (country.tradeStressRelief || 0));

    const unrestDrift = 0.06
      + country.warWeariness * 0.004
      + country.economicStress * 0.005
      + Math.max(0, 60 - (country.stateControl || 70)) * 0.004
      + hotspotUnrest
      + DOMESTIC_CONFIG.unrestSecurityDrift[internalSecurity] * (internalSecurity === 'high' ? securitySuppression : 1)
      + (politicalEffects.unrestDrift || 0);

    country.unrest = this.clamp(country.unrest + unrestDrift * (profile.unrestSensitivity || 1) + (country.stability < 40 ? 0.15 : -0.06) + eventModifiers.unrestDrift * crisisStressFactor);

    const stabilityDelta = 0.14
      + DOMESTIC_CONFIG.stabilitySecurityBonus[internalSecurity] * (internalSecurity === 'high' ? securitySuppression : 1)
      - country.unrest * 0.01
      - country.warWeariness * 0.008
      - country.economicStress * 0.009
      - Math.max(0, 55 - (country.stateControl || 70)) * 0.006
      - activeWars * 0.06
      - pressure.stabilityDrift
      - manpowerShortage
      + eventModifiers.stabilityDrift * crisisStressFactor
      + (politicalEffects.stabilityDrift || 0);
    country.stability = this.clamp(country.stability + stabilityDelta);
    country.warWeariness = this.clamp(country.warWeariness + eventModifiers.warWearinessDrift);
    country.domesticOutputModifier = Math.max(
      0.65,
      Math.min(1.05, 1 - Math.max(0, (45 - country.stability) / 230) - country.unrest / 520 - country.economicStress / 680 - (resistanceEffects.outputPenalty || 0) * 0.55)
    );
    if (resistanceEffects.manpowerPenalty > 0) {
      country.manpowerPool = Math.max(0, country.manpowerPool * (1 - resistanceEffects.manpowerPenalty * 0.08));
    }
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
