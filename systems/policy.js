class PolicySystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
    this.started = false;
  }

  getPolicyLevel(countryName, policyKey) {
    const country = this.countrySystem.ensureCountry(countryName);
    return country.policy[policyKey] || 'normal';
  }

  setPolicyLevel(countryName, policyKey, level) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country || !POLICY_CONFIG.levels.includes(level)) return null;
    country.policy[policyKey] = level;
    this.updateCountryPolicyCost(countryName);
    this.gameState.policy.lastSummary = `${countryName} set ${policyKey} to ${level}.`;
    return country.policy;
  }

  setPolicyBundle(countryName, nextPolicies) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    ['militarySpendingLevel', 'industryInvestmentLevel', 'internalSecurityLevel'].forEach((policyKey) => {
      const next = nextPolicies[policyKey];
      if (next && POLICY_CONFIG.levels.includes(next)) country.policy[policyKey] = next;
    });
    this.updateCountryPolicyCost(countryName);
    this.gameState.policy.lastSummary = `${countryName} policy bundle updated.`;
    return country.policy;
  }

  getDailyPolicyCost(policyState) {
    return POLICY_CONFIG.dailyCosts.militarySpendingLevel[policyState.militarySpendingLevel]
      + POLICY_CONFIG.dailyCosts.industryInvestmentLevel[policyState.industryInvestmentLevel]
      + POLICY_CONFIG.dailyCosts.internalSecurityLevel[policyState.internalSecurityLevel];
  }

  updateCountryPolicyCost(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return 0;
    country.policyDailyCost = this.getDailyPolicyCost(country.policy);
    return country.policyDailyCost;
  }

  applyCountryPolicyTick(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;

    const policy = country.policy;
    const militaryEffect = POLICY_CONFIG.dailyEffects.militarySpendingLevel[policy.militarySpendingLevel];
    const industryEffect = POLICY_CONFIG.dailyEffects.industryInvestmentLevel[policy.industryInvestmentLevel];
    const securityEffect = POLICY_CONFIG.dailyEffects.internalSecurityLevel[policy.internalSecurityLevel];
    const dailyCost = this.updateCountryPolicyCost(countryName);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const eventModifiers = this.eventSystem.getModifiersForCountry(countryName);

    country.treasury -= dailyCost;
    country.treasury += (industryEffect.treasuryBonus || 0);

    const activeWars = this.diplomacySystem.getRelationsForCountry(countryName).filter((relation) => relation.status === 'war').length;
    const warStabilityPenalty = activeWars * 0.07;
    const debtPenalty = country.treasury < 0 ? 0.2 : 0;

    const unrestPenaltyFactor = Math.max(0.45, 1 - (country.unrest || 0) / 170);
    country.policyModifiers.industrialCapacity += industryEffect.industrialCapacity * unrestPenaltyFactor * pressure.industryMultiplier * eventModifiers.industryGrowthMultiplier;
    country.policyModifiers.manpower += militaryEffect.manpower * Math.max(0.55, 1 - (country.warWeariness || 0) / 220);
    country.policyModifiers.stability += militaryEffect.stability + securityEffect.stability - warStabilityPenalty - debtPenalty;
    country.policyModifiers.readiness += militaryEffect.readiness + securityEffect.readiness;
    country.policyModifiers.stability = Math.max(-40, Math.min(40, country.policyModifiers.stability));
    country.policyModifiers.industrialCapacity = Math.max(-20, Math.min(180, country.policyModifiers.industrialCapacity));
    country.policyModifiers.manpower = Math.max(-5000, Math.min(40_000, country.policyModifiers.manpower));
    country.policyModifiers.readiness = Math.max(-40, Math.min(40, country.policyModifiers.readiness));
    country.policyLastTickAt = this.gameState.currentTimeMs;
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.applyCountryPolicyTick(countryName));
    this.countrySystem.syncOwnership();
    this.gameState.policy.lastTickAt = this.gameState.currentTimeMs;
    refreshCountryHud();
    refreshPolicyHud();
    refreshEconomyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + POLICY_CONFIG.tickMs,
      type: 'POLICY_TICK',
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
