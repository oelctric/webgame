class InformationSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, migrationSystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
    this.migrationSystem = migrationSystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
  }

  clampPressure(value) {
    return Math.max(INFORMATION_CONFIG.pressureMin, Math.min(INFORMATION_CONFIG.pressureMax, value));
  }

  clampReputation(value) {
    return Math.max(INFORMATION_CONFIG.reputationMin, Math.min(INFORMATION_CONFIG.reputationMax, value));
  }

  clampControl(value) {
    return Math.max(INFORMATION_CONFIG.controlMin, Math.min(INFORMATION_CONFIG.controlMax, value));
  }

  getNarrativeBucket(country) {
    if (country.domesticNarrativePressure >= 70) return 'worsening';
    if (country.domesticNarrativePressure <= 30) return 'under_control';
    return 'tense';
  }

  getNarrativeLabel(country) {
    if (country.domesticNarrativePressure >= 70) return 'public narrative worsening';
    if (country.domesticNarrativePressure <= 30) return 'narrative under control';
    return 'narrative contested';
  }

  getReputationLabel(country) {
    if (country.internationalReputation <= -45) return 'reputation damaged';
    if (country.internationalReputation >= 35) return 'reputation improving';
    return 'reputation mixed';
  }

  getCountryWarContext(countryName) {
    const relations = this.diplomacySystem.getRelationsForCountry(countryName);
    const wars = relations.filter((relation) => relation.status === 'war');
    let sanctionsSent = 0;
    wars.forEach((relation) => {
      const directional = this.diplomacySystem.getDirectionalPressure(countryName, relation.counterpart);
      if (directional.sanctionsLevel && directional.sanctionsLevel !== 'none') sanctionsSent += 1;
    });
    return { relations, wars, sanctionsSent };
  }

  updateCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    const profileDomestic = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(country)
      : { informationControlBase: 1, narrativePressureSensitivity: 1 };
    const profileForeign = this.governmentProfileSystem
      ? this.governmentProfileSystem.getForeignPolicyBias(country)
      : { reputationSensitivity: 1, reputationTolerance: 1 };

    const { relations, wars } = this.getCountryWarContext(countryName);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const events = this.eventSystem.getActiveEventsForCountry(countryName);
    const crisisCount = events.length;
    const severeCrises = events.filter((event) => event.severity === 'high').length;
    const humanitarianPressure = Math.max(0, (country.humanitarianBurden || 0) - 8) / 28;
    const sanctionsPain = Math.min(1.3, pressure.incomingCount / 3 + pressure.blockedTradeCount / 5);
    const economicPain = Math.max(0, country.economicStress - 35) / 65;
    const warWearinessPain = Math.max(0, country.warWeariness - 15) / 85;
    const activeWarPain = Math.min(1.4, wars.length * 0.45);
    const aggressiveActionDrift = Math.max(0, country.infoMetrics.aggressiveActions - country.infoMetrics.lastAggressiveActions);
    const cooperativeActionDrift = Math.max(0, country.infoMetrics.cooperativeActions - country.infoMetrics.lastCooperativeActions);
    const breachDrift = Math.max(0, country.infoMetrics.agreementBreaches - country.infoMetrics.lastAgreementBreaches);

    country.infoMetrics.lastAggressiveActions = country.infoMetrics.aggressiveActions;
    country.infoMetrics.lastCooperativeActions = country.infoMetrics.cooperativeActions;
    country.infoMetrics.lastAgreementBreaches = country.infoMetrics.agreementBreaches;

    const resilience = (country.informationControl / 100) * (profileDomestic.informationControlBase || 1);
    const sensitivity = profileDomestic.narrativePressureSensitivity || 1;
    const aggressiveBacklash = country.foreignPolicyStyle === 'aggressive' ? 0.4 : (country.foreignPolicyStyle === 'cooperative' ? 1 : 0.75);
    const recovery = (country.stability > 56 && country.economicStress < 44 ? 0.38 : 0.12)
      + (cooperativeActionDrift * 0.12)
      + (country.warWeariness < 20 ? 0.12 : 0)
      + (country.unrest < 30 ? 0.08 : 0);

    const pressureDelta = (
      warWearinessPain * 1.2
      + activeWarPain
      + crisisCount * 0.22
      + severeCrises * 0.35
      + sanctionsPain * 0.8
      + economicPain * 0.95
      + humanitarianPressure * 0.82
      + aggressiveActionDrift * 0.35 * aggressiveBacklash
      + breachDrift * 0.45
      - recovery
    ) * sensitivity * (1 - Math.min(0.75, resilience * 0.55));

    country.domesticNarrativePressure = this.clampPressure(country.domesticNarrativePressure + pressureDelta);

    if (country.domesticNarrativePressure >= INFORMATION_CONFIG.severePressureThreshold) country.infoMetrics.severePressureDays += 1;
    else country.infoMetrics.severePressureDays = Math.max(0, country.infoMetrics.severePressureDays - 0.5);

    const warReputationLoss = wars.length * 1.1 + aggressiveActionDrift * 0.85 + breachDrift * 1.4;
    const humanitarianLoss = humanitarianPressure * 0.85 + severeCrises * 0.32;
    const sanctionsImpact = relations.reduce((sum, relation) => {
      const dir = this.diplomacySystem.getDirectionalPressure(countryName, relation.counterpart);
      if (dir.sanctionsLevel === 'heavy') return sum - 0.35;
      if (dir.sanctionsLevel === 'light') return sum - 0.18;
      return sum;
    }, 0);
    const diplomacyGain = cooperativeActionDrift * 0.62
      + (country.foreignPolicyStyle === 'cooperative' ? 0.14 : 0)
      + (country.foreignPolicyStyle === 'aggressive' ? -0.08 : 0);

    const repSensitivity = profileForeign.reputationSensitivity || 1;
    const repTolerance = profileForeign.reputationTolerance || 1;
    const reputationDelta = ((diplomacyGain + sanctionsImpact) - (warReputationLoss + humanitarianLoss) / repTolerance) * repSensitivity;
    country.internationalReputation = this.clampReputation(country.internationalReputation + reputationDelta);

    const controlDrift = (country.policy?.internalSecurityLevel === 'high' ? 0.2 : -0.05)
      + (country.economicStress > 70 ? -0.15 : 0)
      + (country.unrest > 65 ? -0.18 : 0)
      + (country.stability > 60 ? 0.08 : 0)
      - (country.domesticNarrativePressure > 75 ? 0.08 : 0);
    country.informationControl = this.clampControl(country.informationControl + controlDrift);

    country.informationLastTickAt = this.gameState.currentTimeMs;

    const bucket = this.getNarrativeBucket(country);
    const playerCountry = this.gameState.selectedPlayerCountry && this.gameState.selectedPlayerCountry.properties.name;
    if (countryName === playerCountry
      && bucket !== country.informationAlertBucket
      && this.gameState.currentTimeMs - (country.lastInformationAlertAt || 0) >= INFORMATION_CONFIG.alertCooldownMs) {
      setStatus(`Information pressure shift: ${this.getNarrativeLabel(country)} • ${this.getReputationLabel(country)}.`);
      country.informationAlertBucket = bucket;
      country.lastInformationAlertAt = this.gameState.currentTimeMs;
    }
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.updateCountry(countryName));
    this.gameState.information.lastTickAt = this.gameState.currentTimeMs;
    this.gameState.information.lastSummary = 'Narrative pressure and reputation updated.';
    refreshCountryHud();
    refreshDomesticHud();
    refreshDiplomacyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + INFORMATION_CONFIG.tickMs,
      type: 'INFORMATION_TICK',
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
