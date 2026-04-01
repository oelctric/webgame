class ResourceSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
    this.started = false;
  }

  getUnitResourceCost(unitType) {
    return RESOURCE_CONFIG.productionCosts[unitType] || { manpower: 0, oil: 0 };
  }

  getIndustryBuildFactor(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    const industry = Math.max(1, country.industrialCapacity || 1);
    return Math.max(0.65, Math.min(1.65, 35 / industry));
  }

  canSpend(countryName, cost) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return { ok: false, message: 'Country not found.' };
    if ((cost.manpower || 0) > country.manpowerPool) return { ok: false, message: 'Not enough manpower.' };
    if ((cost.oil || 0) > country.oil) return { ok: false, message: 'Not enough oil.' };
    return { ok: true };
  }

  spend(countryName, cost) {
    const country = this.countrySystem.ensureCountry(countryName);
    const check = this.canSpend(countryName, cost);
    if (!check.ok) return check;
    country.manpowerPool = Math.max(0, country.manpowerPool - (cost.manpower || 0));
    country.oil = Math.max(0, country.oil - (cost.oil || 0));
    return { ok: true };
  }

  consumeOperationalOil(countryName, amount) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    if (country.oil < amount) return false;
    country.oil -= amount;
    return true;
  }

  processCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const eventModifiers = this.eventSystem.getModifiersForCountry(countryName);
    const cityCount = country.controlledCityIds.length;
    const baseCount = country.controlledBaseIds.length;
    const stabilityFactor = Math.max(0.7, Math.min(1.1, (country.stability || 50) / 80));

    const oilGain = Math.max(0, (8 + cityCount * 2.2 + baseCount * 0.8) * (1 - pressure.oilPenalty) * stabilityFactor * eventModifiers.oilGenerationMultiplier);
    const manpowerGain = Math.max(0, (40 + cityCount * 14 + Math.round((country.population || 0) / 600000) - (country.unrest || 0) * 0.4) * eventModifiers.manpowerRegenMultiplier);
    country.oilPerTick = oilGain;
    country.manpowerRegenPerTick = manpowerGain;
    country.oil = Math.max(0, Math.min(country.maxOil, country.oil + oilGain));
    country.manpowerPool = Math.max(0, Math.min(RESOURCE_CONFIG.manpowerPoolMax, country.manpowerPool + manpowerGain));
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.processCountry(countryName));
    this.gameState.resources.lastTickAt = this.gameState.currentTimeMs;
    refreshCountryHud();
    refreshDomesticHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + RESOURCE_CONFIG.tickMs,
      type: 'RESOURCE_TICK',
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
