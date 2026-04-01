class CountrySystem {
  constructor(gameState, scheduler, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
  }

  ensureCountry(name, aiControlled = false) {
    if (!name) return null;
    if (!this.gameState.countries[name]) {
      this.gameState.countries[name] = {
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        aiControlled,
        regimeType: null,
        economicOrientation: null,
        foreignPolicyStyle: null,
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
        leaderMandate: LEADERSHIP_CONFIG.defaultMandate,
        leaderApproval: LEADERSHIP_CONFIG.defaultApproval,
        governmentContinuity: LEADERSHIP_CONFIG.defaultContinuity,
        electionCycleLengthMs: null,
        nextElectionAt: null,
        lastLeadershipReviewAt: null,
        lastTurnoverAt: 0,
        politicalEffects: {
          stabilityDrift: 0,
          unrestDrift: 0,
          policyEffectiveness: 1,
          crisisResilience: 1
        },
        politicalLastTickAt: null,
        politicalAlertBucket: 'stable',
        factions: null,
        factionEffects: {
          policyCostMultiplier: 1,
          policyEffectivenessMultiplier: 1,
          mandateDrift: 0,
          continuityDrift: 0,
          warToleranceBias: 0,
          deescalationBias: 0,
          tradeRestorationBias: 0,
          internalSecurityBias: 0,
          hardlinePostureBias: 0,
          politicalCostByAction: {},
          interpretation: 'Faction pressure balanced.'
        },
        factionLastTickAt: null,
        lastFactionInterpretation: '',
        lastFactionAlertAt: 0,
        domesticNarrativePressure: 22,
        internationalReputation: 8,
        informationControl: 50,
        insurgencyPressure: 8,
        separatistPressure: 6,
        stateControl: 78,
        foreignBackedPressure: 0,
        resistanceEffects: {
          outputPenalty: 0,
          manpowerPenalty: 0,
          securityCost: 0,
          legitimacyDrift: 0,
          publicSupportDrift: 0
        },
        resistanceHotspots: [],
        resistanceAlertBucket: 'low',
        lastResistanceAlertAt: 0,
        informationAlertBucket: 'stable',
        lastInformationAlertAt: 0,
        infoMetrics: {
          aggressiveActions: 0,
          cooperativeActions: 0,
          agreementBreaches: 0,
          severePressureDays: 0,
          lastAggressiveActions: 0,
          lastCooperativeActions: 0,
          lastAgreementBreaches: 0
        },
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
    if (typeof country.leaderMandate !== 'number') country.leaderMandate = LEADERSHIP_CONFIG.defaultMandate;
    if (typeof country.leaderApproval !== 'number') country.leaderApproval = LEADERSHIP_CONFIG.defaultApproval;
    if (typeof country.governmentContinuity !== 'number') country.governmentContinuity = LEADERSHIP_CONFIG.defaultContinuity;
    if (typeof country.electionCycleLengthMs !== 'number') country.electionCycleLengthMs = null;
    if (country.nextElectionAt == null) country.nextElectionAt = null;
    if (country.lastLeadershipReviewAt == null) country.lastLeadershipReviewAt = null;
    if (typeof country.lastTurnoverAt !== 'number') country.lastTurnoverAt = 0;
    country.politicalEffects = country.politicalEffects || {
      stabilityDrift: 0,
      unrestDrift: 0,
      policyEffectiveness: 1,
      crisisResilience: 1
    };
    if (country.politicalLastTickAt == null) country.politicalLastTickAt = null;
    if (!country.politicalAlertBucket) country.politicalAlertBucket = 'stable';
    if (!country.factions) country.factions = null;
    country.factionEffects = country.factionEffects || {
      policyCostMultiplier: 1,
      policyEffectivenessMultiplier: 1,
      mandateDrift: 0,
      continuityDrift: 0,
      warToleranceBias: 0,
      deescalationBias: 0,
      tradeRestorationBias: 0,
      internalSecurityBias: 0,
      hardlinePostureBias: 0,
      politicalCostByAction: {},
      interpretation: 'Faction pressure balanced.'
    };
    if (country.factionLastTickAt == null) country.factionLastTickAt = null;
    if (typeof country.lastFactionInterpretation !== 'string') country.lastFactionInterpretation = '';
    if (typeof country.lastFactionAlertAt !== 'number') country.lastFactionAlertAt = 0;
    if (typeof country.domesticNarrativePressure !== 'number') country.domesticNarrativePressure = 22;
    if (typeof country.internationalReputation !== 'number') country.internationalReputation = 8;
    if (typeof country.informationControl !== 'number') country.informationControl = 50;
    if (typeof country.insurgencyPressure !== 'number') country.insurgencyPressure = 8;
    if (typeof country.separatistPressure !== 'number') country.separatistPressure = 6;
    if (typeof country.stateControl !== 'number') country.stateControl = 78;
    if (typeof country.foreignBackedPressure !== 'number') country.foreignBackedPressure = 0;
    country.resistanceEffects = country.resistanceEffects || {
      outputPenalty: 0,
      manpowerPenalty: 0,
      securityCost: 0,
      legitimacyDrift: 0,
      publicSupportDrift: 0
    };
    if (typeof country.resistanceEffects.outputPenalty !== 'number') country.resistanceEffects.outputPenalty = 0;
    if (typeof country.resistanceEffects.manpowerPenalty !== 'number') country.resistanceEffects.manpowerPenalty = 0;
    if (typeof country.resistanceEffects.securityCost !== 'number') country.resistanceEffects.securityCost = 0;
    if (typeof country.resistanceEffects.legitimacyDrift !== 'number') country.resistanceEffects.legitimacyDrift = 0;
    if (typeof country.resistanceEffects.publicSupportDrift !== 'number') country.resistanceEffects.publicSupportDrift = 0;
    if (!Array.isArray(country.resistanceHotspots)) country.resistanceHotspots = [];
    if (!country.resistanceAlertBucket) country.resistanceAlertBucket = 'low';
    if (typeof country.lastResistanceAlertAt !== 'number') country.lastResistanceAlertAt = 0;
    if (!country.informationAlertBucket) country.informationAlertBucket = 'stable';
    if (typeof country.lastInformationAlertAt !== 'number') country.lastInformationAlertAt = 0;
    country.infoMetrics = country.infoMetrics || {
      aggressiveActions: 0,
      cooperativeActions: 0,
      agreementBreaches: 0,
      severePressureDays: 0,
      lastAggressiveActions: 0,
      lastCooperativeActions: 0,
      lastAgreementBreaches: 0
    };
    if (typeof country.infoMetrics.aggressiveActions !== 'number') country.infoMetrics.aggressiveActions = 0;
    if (typeof country.infoMetrics.cooperativeActions !== 'number') country.infoMetrics.cooperativeActions = 0;
    if (typeof country.infoMetrics.agreementBreaches !== 'number') country.infoMetrics.agreementBreaches = 0;
    if (typeof country.infoMetrics.severePressureDays !== 'number') country.infoMetrics.severePressureDays = 0;
    if (typeof country.infoMetrics.lastAggressiveActions !== 'number') country.infoMetrics.lastAggressiveActions = 0;
    if (typeof country.infoMetrics.lastCooperativeActions !== 'number') country.infoMetrics.lastCooperativeActions = 0;
    if (typeof country.infoMetrics.lastAgreementBreaches !== 'number') country.infoMetrics.lastAgreementBreaches = 0;
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

    if (this.governmentProfileSystem) {
      this.governmentProfileSystem.ensureCountryProfile(country);
    }
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
      const resistanceOutputMod = Math.max(0.45, 1 - (country.resistanceEffects?.outputPenalty || 0));
      country.incomePerTick += ECONOMY_CONFIG.cityIncomePerDay * resistanceOutputMod;
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
      country.upkeepPerTick += country.resistanceEffects?.securityCost || 0;
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
