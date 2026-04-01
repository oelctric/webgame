class EconomySystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, eventSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.eventSystem = eventSystem;
  }

  ensureCountry(countryName) {
    if (!countryName) return;
    const country = this.countrySystem.ensureCountry(countryName);
    this.gameState.economy.treasuryByCountry[countryName] = country.treasury;
  }

  getTreasury(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    this.gameState.economy.treasuryByCountry[countryName] = country.treasury;
    return country.treasury || 0;
  }

  canAfford(countryName, cost) {
    return this.getTreasury(countryName) >= cost;
  }

  spend(countryName, amount, reason) {
    this.ensureCountry(countryName);
    if (!this.canAfford(countryName, amount)) return false;
    const country = this.countrySystem.ensureCountry(countryName);
    country.treasury -= amount;
    this.gameState.economy.treasuryByCountry[countryName] = country.treasury;
    this.gameState.economy.lastSummary = `${countryName} spent ${amount} (${reason})`;
    return true;
  }

  startEconomyLoop() {
    if (this.gameState.economy.started) return;
    this.gameState.economy.started = true;
    this.scheduleNextTick();
  }

  scheduleNextTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + ECONOMY_CONFIG.tickMs,
      type: 'ECONOMY_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  processTick() {
    this.countrySystem.syncOwnership();
    const incomeByCountry = {};
    const upkeepByCountry = {};

    this.gameState.cities.forEach((city) => {
      if (city.status === 'destroyed') return;
      this.ensureCountry(city.ownerCountry);
      const country = this.countrySystem.ensureCountry(city.ownerCountry);
      const pressure = this.diplomacySystem.getEconomicPressureOnCountry(city.ownerCountry);
      const eventModifiers = this.eventSystem.getModifiersForCountry(city.ownerCountry);
      const adjustedIncome = ECONOMY_CONFIG.cityIncomePerDay * (country.domesticOutputModifier || 1) * pressure.incomeMultiplier * eventModifiers.incomeMultiplier;
      incomeByCountry[city.ownerCountry] = (incomeByCountry[city.ownerCountry] || 0) + adjustedIncome;
    });

    this.gameState.bases.forEach((base) => {
      if (base.status === 'destroyed' || base.combatStatus === 'destroyed') return;
      this.ensureCountry(base.ownerCountry);
      upkeepByCountry[base.ownerCountry] = (upkeepByCountry[base.ownerCountry] || 0) + (ECONOMY_CONFIG.baseUpkeepPerDay[base.type] || 0);
    });

    this.gameState.units.forEach((unit) => {
      if (unit.status === 'destroyed') return;
      this.ensureCountry(unit.ownerCountry);
      upkeepByCountry[unit.ownerCountry] = (upkeepByCountry[unit.ownerCountry] || 0) + (ECONOMY_CONFIG.unitUpkeepPerDay[unit.type] || 0);
    });

    const countries = new Set([...Object.keys(incomeByCountry), ...Object.keys(upkeepByCountry)]);
    countries.forEach((country) => {
      this.ensureCountry(country);
      const income = incomeByCountry[country] || 0;
      const upkeep = upkeepByCountry[country] || 0;
      const eventModifiers = this.eventSystem.getModifiersForCountry(country);
      const net = income - upkeep + eventModifiers.treasuryDailyDelta + (this.countrySystem.ensureCountry(country).tradeIncomeBonus || 0);
      const countryState = this.countrySystem.ensureCountry(country);
      countryState.treasury += net;
      this.gameState.economy.treasuryByCountry[country] = countryState.treasury;
      this.gameState.economy.lastTickAt = this.gameState.currentTimeMs;
      const isPlayer = this.gameState.selectedPlayerCountry && country === this.gameState.selectedPlayerCountry.properties.name;
      if (isPlayer) {
        this.gameState.economy.lastSummary = `Daily tick: +${income} income, -${upkeep} upkeep, net ${net >= 0 ? '+' : ''}${net}`;
      }
    });

    this.scheduleNextTick();
    refreshEconomyHud();
  }
}
