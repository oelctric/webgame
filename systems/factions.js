class FactionSystem {
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
    return Math.max(FACTION_CONFIG.clampMin, Math.min(FACTION_CONFIG.clampMax, value));
  }

  ensureCountryFactions(country) {
    if (!country) return null;
    const defaults = {
      public_civic_pressure: { id: 'public_civic_pressure', influence: 58, satisfaction: 56, pressureDirection: 'relief' },
      security_elite: { id: 'security_elite', influence: 52, satisfaction: 58, pressureDirection: 'order' },
      economic_elite: { id: 'economic_elite', influence: 54, satisfaction: 57, pressureDirection: 'stability' },
      hardliner_reform_bloc: { id: 'hardliner_reform_bloc', influence: 50, satisfaction: 52, pressureDirection: 'reform' }
    };
    if (!country.factions) country.factions = {};
    Object.keys(defaults).forEach((id) => {
      const current = country.factions[id] || {};
      country.factions[id] = {
        id,
        influence: this.clamp(typeof current.influence === 'number' ? current.influence : defaults[id].influence),
        satisfaction: this.clamp(typeof current.satisfaction === 'number' ? current.satisfaction : defaults[id].satisfaction),
        pressureDirection: current.pressureDirection || defaults[id].pressureDirection,
        activeBiases: current.activeBiases || {}
      };
    });
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
      interpretation: 'Faction pressure balanced.'
    };
    return country.factions;
  }

  getFactionWeight(country, id) {
    let weight = 1;
    if (country.regimeType === 'democracy' && id === 'public_civic_pressure') weight += 0.35;
    if (country.regimeType === 'authoritarian' && id === 'security_elite') weight += 0.4;
    if (country.economicOrientation === 'market' && id === 'economic_elite') weight += 0.28;
    if (country.foreignPolicyStyle === 'aggressive' && id === 'hardliner_reform_bloc') weight += 0.2;
    if (country.foreignPolicyStyle === 'cooperative' && id === 'economic_elite') weight += 0.14;
    return weight;
  }

  computePressure(country) {
    this.ensureCountryFactions(country);
    const values = country.factions;
    const weighted = (id) => {
      const f = values[id];
      const net = ((f.satisfaction - 50) * 0.55) + ((f.influence - 50) * 0.45);
      return net * this.getFactionWeight(country, id) / 50;
    };

    const civic = weighted('public_civic_pressure');
    const security = weighted('security_elite');
    const economic = weighted('economic_elite');
    const bloc = weighted('hardliner_reform_bloc');
    const reformVsHardline = (country.factions.hardliner_reform_bloc.pressureDirection === 'hardline' ? 1 : -1) * Math.abs(bloc);

    const mandateDrift = this.clamp(50 + civic * 2.3 + economic * 1.7 - security * 1.1) - 50;
    const continuityDrift = this.clamp(50 + security * 2.4 + economic * 1.2 - civic * 0.8 - Math.abs(bloc) * 1.2) - 50;

    return {
      policyCostMultiplier: Math.max(0.8, Math.min(1.35, 1 + (Math.abs(civic - security) + Math.abs(economic - reformVsHardline)) * 0.03)),
      policyEffectivenessMultiplier: Math.max(0.82, Math.min(1.18, 1 + (economic + security - Math.abs(civic)) * 0.02)),
      mandateDrift: mandateDrift * 0.04,
      continuityDrift: continuityDrift * 0.035,
      warToleranceBias: Math.max(-1, Math.min(1, (security + reformVsHardline * 0.9 - civic * 0.7) / 3.4)),
      deescalationBias: Math.max(-1, Math.min(1, (civic + economic - security - reformVsHardline) / 3.6)),
      tradeRestorationBias: Math.max(-1, Math.min(1, (economic + civic * 0.3 - security * 0.45) / 3.2)),
      internalSecurityBias: Math.max(-1, Math.min(1, (security - civic * 0.7 + Math.max(0, reformVsHardline) * 0.6) / 3.1)),
      hardlinePostureBias: Math.max(-1, Math.min(1, (security + reformVsHardline - economic * 0.5) / 3.2)),
      politicalCostByAction: {
        raise_internal_security: 1 - Math.max(-0.35, Math.min(0.35, (security - civic) * 0.12)),
        raise_military_spending: 1 - Math.max(-0.35, Math.min(0.35, (security + reformVsHardline - economic) * 0.1)),
        deescalate_conflict: 1 - Math.max(-0.35, Math.min(0.35, (civic + economic - security - reformVsHardline) * 0.12)),
        restore_trade: 1 - Math.max(-0.35, Math.min(0.35, (economic - security * 0.5) * 0.12)),
        hardline_foreign_posture: 1 - Math.max(-0.35, Math.min(0.35, (security + reformVsHardline - civic - economic * 0.3) * 0.11))
      },
      interpretation: this.getInterpretation(country)
    };
  }

  getInterpretation(country) {
    const sorted = Object.values(country.factions)
      .map((f) => ({ ...f, score: f.influence * 0.6 + f.satisfaction * 0.4 }))
      .sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const weakest = sorted[sorted.length - 1];
    const topLabel = top.id.replace(/_/g, ' ');
    const weakLabel = weakest.id.replace(/_/g, ' ');
    const pressureTrend = top.satisfaction < 46 ? `${topLabel} dissatisfied` : `${topLabel} dominant`;
    return `${pressureTrend}; ${weakLabel} lagging`;
  }

  updateCountry(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    this.ensureCountryFactions(country);

    const wars = this.diplomacySystem.getRelationsForCountry(countryName).filter((r) => r.status === 'war').length;
    const economicPressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const crisisCount = this.eventSystem.getActiveEventsForCountry(countryName).length;

    const civic = country.factions.public_civic_pressure;
    const security = country.factions.security_elite;
    const economic = country.factions.economic_elite;
    const bloc = country.factions.hardliner_reform_bloc;

    civic.satisfaction = this.clamp(civic.satisfaction
      - Math.max(0, country.warWeariness - 28) / 30
      - Math.max(0, country.economicStress - 35) / 34
      - Math.max(0, country.humanitarianBurden || 0) / 45
      - Math.max(0, country.domesticNarrativePressure - 45) / 55
      + Math.max(0, country.publicSupport - 58) / 60);
    civic.influence = this.clamp(civic.influence
      + Math.max(0, country.unrest - 40) / 45
      + Math.max(0, 45 - country.legitimacy) / 65
      + crisisCount * 0.2
      - (country.regimeType === 'authoritarian' ? 0.18 : 0));

    security.satisfaction = this.clamp(security.satisfaction
      + Math.max(0, country.stateControl - 62) / 48
      + (country.policy?.internalSecurityLevel === 'high' ? 0.45 : -0.2)
      - Math.max(0, country.insurgencyPressure - 38) / 34
      - Math.max(0, country.separatistPressure - 35) / 40);
    security.influence = this.clamp(security.influence
      + Math.max(0, country.insurgencyPressure - 28) / 40
      + Math.max(0, country.separatistPressure - 28) / 50
      + (country.regimeType === 'authoritarian' ? 0.3 : 0.08)
      + (wars > 0 ? 0.16 : -0.06));

    economic.satisfaction = this.clamp(economic.satisfaction
      - Math.max(0, economicPressure.incomingCount - 1) * 0.42
      - Math.max(0, country.economicStress - 30) / 30
      - Math.max(0, economicPressure.blockedTradeCount) * 0.35
      + Math.max(0, country.tradeIncomeBonus || 0) / 70
      + (country.policy?.industryInvestmentLevel === 'high' ? 0.24 : 0));
    economic.influence = this.clamp(economic.influence
      + (country.economicOrientation === 'market' ? 0.22 : 0.1)
      + Math.max(0, country.industrialCapacity - 28) / 240
      - Math.max(0, country.unrest - 55) / 80);

    const hardlineBase = (country.foreignPolicyStyle === 'aggressive' ? 0.26 : -0.16) + (wars > 0 ? 0.2 : -0.1);
    bloc.satisfaction = this.clamp(bloc.satisfaction
      + hardlineBase
      - Math.max(0, country.warWeariness - 50) / 42
      - Math.max(0, country.economicStress - 62) / 48
      + (country.foreignPolicyStyle === 'cooperative' ? 0.12 : 0));

    if (bloc.satisfaction < 42) bloc.pressureDirection = 'hardline';
    else if (bloc.satisfaction > 58) bloc.pressureDirection = 'reform';

    bloc.influence = this.clamp(bloc.influence
      + Math.max(0, 55 - country.leaderMandate) / 120
      + crisisCount * 0.12
      + Math.max(0, country.domesticNarrativePressure - 60) / 90);

    country.factionEffects = this.computePressure(country);
    country.factionLastTickAt = this.gameState.currentTimeMs;

    const playerCountry = this.gameState.selectedPlayerCountry?.properties?.name;
    if (countryName === playerCountry && country.factionEffects.interpretation !== country.lastFactionInterpretation
      && this.gameState.currentTimeMs - (country.lastFactionAlertAt || 0) >= FACTION_CONFIG.alertCooldownMs) {
      setStatus(`Faction shift: ${country.factionEffects.interpretation}.`);
      country.lastFactionInterpretation = country.factionEffects.interpretation;
      country.lastFactionAlertAt = this.gameState.currentTimeMs;
    }
  }

  adjustFaction(countryName, factionId, field, delta) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    this.ensureCountryFactions(country);
    const faction = country.factions[factionId];
    if (!faction || !['influence', 'satisfaction'].includes(field)) return false;
    faction[field] = this.clamp(faction[field] + delta);
    country.factionEffects = this.computePressure(country);
    return true;
  }

  triggerPressureShift(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    this.ensureCountryFactions(country);
    const shift = (Math.random() * 10) + 5;
    country.factions.public_civic_pressure.influence = this.clamp(country.factions.public_civic_pressure.influence + shift);
    country.factions.security_elite.influence = this.clamp(country.factions.security_elite.influence + shift * 0.7);
    country.factions.economic_elite.satisfaction = this.clamp(country.factions.economic_elite.satisfaction - shift * 0.8);
    country.factions.hardliner_reform_bloc.pressureDirection = country.factions.hardliner_reform_bloc.pressureDirection === 'hardline' ? 'reform' : 'hardline';
    country.factionEffects = this.computePressure(country);
    return true;
  }

  resetCountryFactions(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    country.factions = null;
    this.ensureCountryFactions(country);
    country.factionEffects = this.computePressure(country);
    return true;
  }

  onLeadershipTurnover(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    this.ensureCountryFactions(country);
    Object.values(country.factions).forEach((f) => {
      f.satisfaction = this.clamp(f.satisfaction + (Math.random() * 8) - 2);
    });
    country.factions.security_elite.influence = this.clamp(country.factions.security_elite.influence + (country.regimeType === 'authoritarian' ? 4 : -2));
    country.factions.public_civic_pressure.influence = this.clamp(country.factions.public_civic_pressure.influence + (country.regimeType === 'democracy' ? 5 : 1));
    country.factionEffects = this.computePressure(country);
  }

  processTick() {
    Object.keys(this.gameState.countries).forEach((countryName) => this.updateCountry(countryName));
    this.gameState.factions.lastTickAt = this.gameState.currentTimeMs;
    this.gameState.factions.lastSummary = 'Internal faction pressure updated.';
    refreshDomesticHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + FACTION_CONFIG.tickMs,
      type: 'FACTION_TICK',
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
