class CountrySystem {
  constructor(gameState, scheduler) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.started = false;
  }

  ensureCountry(name, aiControlled = false) {
    if (!name) return null;
    if (!this.gameState.countries[name]) {
      this.gameState.countries[name] = {
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        aiControlled,
        treasury: ECONOMY_CONFIG.defaultTreasury,
        population: COUNTRY_CONFIG.basePopulation,
        stability: 70,
        unrest: 18,
        warWeariness: 8,
        economicStress: 14,
        oil: RESOURCE_CONFIG.defaultOil,
        maxOil: RESOURCE_CONFIG.defaultMaxOil,
        oilPerTick: 0,
        manpowerPool: RESOURCE_CONFIG.defaultManpowerPool,
        manpowerRegenPerTick: 0,
        tradeIncomeBonus: 0,
        tradeStressRelief: 0,
        tradeIndustrySupportBonus: 0,
        tradeBalance: {},
        industrialCapacity: 20,
        manpower: COUNTRY_CONFIG.baseManpower,
        militaryReadiness: 50,
        energy: 100,
        relations: {},
        policy: {
          militarySpendingLevel: 'normal',
          industryInvestmentLevel: 'normal',
          internalSecurityLevel: 'normal'
        },
        policyModifiers: {
          stability: 0,
          industrialCapacity: 0,
          manpower: 0,
          readiness: 0
        },
        policyDailyCost: 0,
        policyLastTickAt: null,
        domesticOutputModifier: 1,
        domesticLastTickAt: null,
        domesticAlertBucket: 'stable',
        legitimacy: 62,
        publicSupport: 60,
        eliteSupport: 58,
        politicalEffects: {
          stabilityDrift: 0,
          unrestDrift: 0,
          policyEffectiveness: 1,
          crisisResilience: 1
        },
        politicalLastTickAt: null,
        politicalAlertBucket: 'stable',
        humanitarianBurden: 0,
        controlledCityIds: [],
        controlledBaseIds: [],
        controlledUnitIds: [],
        incomePerTick: 0,
        upkeepPerTick: 0,
        netPerTick: 0
      };
    } else if (aiControlled) {
      this.gameState.countries[name].aiControlled = true;
    }
    const country = this.gameState.countries[name];
    country.policy = country.policy || {
      militarySpendingLevel: 'normal',
      industryInvestmentLevel: 'normal',
      internalSecurityLevel: 'normal'
    };
    country.policyModifiers = country.policyModifiers || {
      stability: 0,
      industrialCapacity: 0,
      manpower: 0,
      readiness: 0
    };
    if (typeof country.policyDailyCost !== 'number') country.policyDailyCost = 0;
    if (country.policyLastTickAt == null) country.policyLastTickAt = null;
    if (typeof country.militaryReadiness !== 'number') country.militaryReadiness = 50;
    if (typeof country.unrest !== 'number') country.unrest = 18;
    if (typeof country.warWeariness !== 'number') country.warWeariness = 8;
    if (typeof country.economicStress !== 'number') country.economicStress = 14;
    if (typeof country.domesticOutputModifier !== 'number') country.domesticOutputModifier = 1;
    if (country.domesticLastTickAt == null) country.domesticLastTickAt = null;
    if (!country.domesticAlertBucket) country.domesticAlertBucket = 'stable';
    if (typeof country.legitimacy !== 'number') country.legitimacy = 62;
    if (typeof country.publicSupport !== 'number') country.publicSupport = 60;
    if (typeof country.eliteSupport !== 'number') country.eliteSupport = 58;
    country.politicalEffects = country.politicalEffects || {
      stabilityDrift: 0,
      unrestDrift: 0,
      policyEffectiveness: 1,
      crisisResilience: 1
    };
    if (country.politicalLastTickAt == null) country.politicalLastTickAt = null;
    if (!country.politicalAlertBucket) country.politicalAlertBucket = 'stable';
    if (typeof country.humanitarianBurden !== 'number') country.humanitarianBurden = 0;
    if (typeof country.oil !== 'number') country.oil = RESOURCE_CONFIG.defaultOil;
    if (typeof country.maxOil !== 'number') country.maxOil = RESOURCE_CONFIG.defaultMaxOil;
    if (typeof country.oilPerTick !== 'number') country.oilPerTick = 0;
    if (typeof country.manpowerPool !== 'number') country.manpowerPool = RESOURCE_CONFIG.defaultManpowerPool;
    if (typeof country.manpowerRegenPerTick !== 'number') country.manpowerRegenPerTick = 0;
    if (typeof country.tradeIncomeBonus !== 'number') country.tradeIncomeBonus = 0;
    if (typeof country.tradeStressRelief !== 'number') country.tradeStressRelief = 0;
    if (typeof country.tradeIndustrySupportBonus !== 'number') country.tradeIndustrySupportBonus = 0;
    if (!country.tradeBalance) country.tradeBalance = {};
    return country;
  }

  getCountry(name) {
    return this.ensureCountry(name);
  }

  syncOwnership() {
    Object.values(this.gameState.countries).forEach((country) => {
      country.controlledCityIds = [];
      country.controlledBaseIds = [];
      country.controlledUnitIds = [];
      country.incomePerTick = 0;
      country.upkeepPerTick = 0;
      country.netPerTick = 0;
    });

    this.gameState.cities.forEach((city) => {
      if (city.status === 'destroyed') return;
      const country = this.ensureCountry(city.ownerCountry);
      country.controlledCityIds.push(city.id);
      country.incomePerTick += ECONOMY_CONFIG.cityIncomePerDay;
    });

    this.gameState.bases.forEach((base) => {
      if (base.status === 'destroyed' || base.combatStatus === 'destroyed') return;
      const country = this.ensureCountry(base.ownerCountry);
      country.controlledBaseIds.push(base.id);
      country.upkeepPerTick += ECONOMY_CONFIG.baseUpkeepPerDay[base.type] || 0;
    });

    this.gameState.units.forEach((unit) => {
      if (unit.status === 'destroyed') return;
      const country = this.ensureCountry(unit.ownerCountry);
      country.controlledUnitIds.push(unit.id);
      country.upkeepPerTick += ECONOMY_CONFIG.unitUpkeepPerDay[unit.type] || 0;
    });

    Object.values(this.gameState.countries).forEach((country) => {
      country.netPerTick = country.incomePerTick - country.upkeepPerTick;
      const basePopulation = COUNTRY_CONFIG.basePopulation + country.controlledCityIds.length * COUNTRY_CONFIG.cityPopulation;
      const baseIndustry = 20 + country.controlledCityIds.length * COUNTRY_CONFIG.cityIndustry + country.controlledBaseIds.length * COUNTRY_CONFIG.baseIndustry;
      const baseManpower = COUNTRY_CONFIG.baseManpower + country.controlledCityIds.length * COUNTRY_CONFIG.cityManpower;
      const domesticPenalty = (country.unrest || 0) * 0.18 + (country.warWeariness || 0) * 0.14 + (country.economicStress || 0) * 0.2;
      const baseStability = 78 + Math.min(10, country.netPerTick / 100) - domesticPenalty / 10;
      const baseReadiness = 45 + country.controlledBaseIds.length * 2 + country.controlledUnitIds.length * 0.6;
      country.population = basePopulation;
      country.industrialCapacity = Math.max(1, baseIndustry + (country.policyModifiers?.industrialCapacity || 0) + (country.tradeIndustrySupportBonus || 0));
      country.manpower = Math.max(0, baseManpower + (country.policyModifiers?.manpower || 0));
      country.stability = Math.max(0, Math.min(100, baseStability + (country.policyModifiers?.stability || 0)));
      country.militaryReadiness = Math.max(0, Math.min(100, baseReadiness + (country.policyModifiers?.readiness || 0)));
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + COUNTRY_CONFIG.tickMs,
      type: 'COUNTRY_TICK',
      payload: {},
      handler: () => {
        this.syncOwnership();
        refreshCountryHud();
        this.scheduleTick();
      }
    });
  }
}
