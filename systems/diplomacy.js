class DiplomacySystem {
  constructor(gameState, scheduler, countrySystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
  }

  pairKey(countryA, countryB) {
    const [a, b] = [countryA, countryB].sort((x, y) => x.localeCompare(y));
    return `${a}::${b}`;
  }

  clampScore(score) {
    return Math.max(DIPLOMACY_CONFIG.minScore, Math.min(DIPLOMACY_CONFIG.maxScore, Math.round(score)));
  }

  deriveStatusFromScore(score) {
    if (score >= DIPLOMACY_CONFIG.friendlyThreshold) return 'friendly';
    if (score <= DIPLOMACY_CONFIG.hostileThreshold) return 'hostile';
    return 'neutral';
  }

  ensureRelation(countryA, countryB) {
    if (!countryA || !countryB || countryA === countryB) return null;
    this.countrySystem.ensureCountry(countryA);
    this.countrySystem.ensureCountry(countryB);
    const key = this.pairKey(countryA, countryB);
    if (!this.gameState.diplomacy.relationsByPair[key]) {
      const [a, b] = key.split('::');
      this.gameState.diplomacy.relationsByPair[key] = {
        countryA: a,
        countryB: b,
        relationScore: 0,
        status: 'neutral',
        tradeAllowed: true,
        sanctions: false,
        sanctionsLevel: 'none',
        sanctionsSourceCountry: null,
        sanctionsStartedAt: null,
        sanctionsBySource: {},
        lastChangedAt: this.gameState.currentTimeMs,
        lastConflictAt: null
      };
    }
    return this.gameState.diplomacy.relationsByPair[key];
  }

  getRelation(countryA, countryB) {
    return this.ensureRelation(countryA, countryB);
  }

  updateStatusFromScore(relation, preserveWar = true) {
    if (!relation) return;
    if (preserveWar && relation.status === 'war') return;
    relation.status = this.deriveStatusFromScore(relation.relationScore);
  }

  recordCountryBehavior(countryName, { aggressive = 0, cooperative = 0, agreementBreach = 0 } = {}) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country?.infoMetrics) return;
    country.infoMetrics.aggressiveActions = Math.max(0, (country.infoMetrics.aggressiveActions || 0) + aggressive);
    country.infoMetrics.cooperativeActions = Math.max(0, (country.infoMetrics.cooperativeActions || 0) + cooperative);
    country.infoMetrics.agreementBreaches = Math.max(0, (country.infoMetrics.agreementBreaches || 0) + agreementBreach);
  }

  getCooperationModifier(sourceCountry) {
    const source = this.countrySystem.ensureCountry(sourceCountry);
    if (!source) return 1;
    const reputation = source.internationalReputation || 0;
    const breaches = source.infoMetrics?.agreementBreaches || 0;
    const base = 1 + (reputation / 220);
    const breachPenalty = Math.min(0.35, breaches * 0.03);
    return Math.max(0.55, Math.min(1.3, base - breachPenalty));
  }

  adjustRelationScore(countryA, countryB, delta, reason = 'Relation changed', markConflict = false) {
    const relation = this.ensureRelation(countryA, countryB);
    if (!relation) return null;
    const adjustedDelta = delta > 0 ? delta * this.getCooperationModifier(countryA) : delta;
    relation.relationScore = this.clampScore(relation.relationScore + adjustedDelta);
    relation.lastChangedAt = this.gameState.currentTimeMs;
    if (markConflict) relation.lastConflictAt = this.gameState.currentTimeMs;
    this.updateStatusFromScore(relation, true);
    this.gameState.diplomacy.lastSummary = `${relation.countryA} ↔ ${relation.countryB}: ${reason} (${relation.relationScore})`;
    if (delta > 0) this.recordCountryBehavior(countryA, { cooperative: 0.2 });
    if (delta < 0 && markConflict) this.recordCountryBehavior(countryA, { aggressive: 0.2 });
    return relation;
  }

  setStatus(countryA, countryB, status, reason = 'Diplomacy status changed') {
    const relation = this.ensureRelation(countryA, countryB);
    if (!relation) return null;
    relation.status = status;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    if (status === 'war') relation.lastConflictAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${relation.countryA} ↔ ${relation.countryB}: ${reason}`;
    return relation;
  }

  declareWar(countryA, countryB, reason = 'War declared') {
    const relationBefore = this.ensureRelation(countryA, countryB);
    const preWarStatus = relationBefore ? relationBefore.status : null;
    const relation = this.setStatus(countryA, countryB, 'war', reason);
    if (!relation) return null;
    relation.relationScore = this.clampScore(Math.min(relation.relationScore, -70));
    relation.tradeAllowed = false;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    relation.sanctionsBySource[countryA] = {
      sanctionsLevel: relation.sanctionsBySource[countryA]?.sanctionsLevel || 'none',
      tradeAllowed: false,
      startedAt: relation.sanctionsBySource[countryA]?.startedAt || null
    };
    relation.sanctionsBySource[countryB] = {
      sanctionsLevel: relation.sanctionsBySource[countryB]?.sanctionsLevel || 'none',
      tradeAllowed: false,
      startedAt: relation.sanctionsBySource[countryB]?.startedAt || null
    };
    const brokeAgreement = preWarStatus === 'ceasefire'
      || (preWarStatus === 'friendly' && relation.relationScore > 20)
      || Boolean(negotiationSystem?.hasTemporaryTradeRestoration?.(countryA, countryB));
    this.recordCountryBehavior(countryA, { aggressive: 1.2, agreementBreach: brokeAgreement ? 1 : 0 });
    this.recordCountryBehavior(countryB, { aggressive: 0.25 });
    return relation;
  }

  makePeace(countryA, countryB, reason = 'Peace declared') {
    const relation = this.ensureRelation(countryA, countryB);
    if (!relation) return null;
    relation.relationScore = this.clampScore(Math.max(relation.relationScore, -20));
    relation.tradeAllowed = true;
    relation.sanctions = false;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    relation.status = this.deriveStatusFromScore(relation.relationScore);
    this.gameState.diplomacy.lastSummary = `${relation.countryA} ↔ ${relation.countryB}: ${reason}`;
    this.recordCountryBehavior(countryA, { cooperative: 1 });
    this.recordCountryBehavior(countryB, { cooperative: 1 });
    return relation;
  }

  canStartOffensiveAction(attackerCountry, targetCountry) {
    if (!attackerCountry || !targetCountry) return { ok: false, message: 'Missing country context.' };
    if (attackerCountry === targetCountry) return { ok: false, message: 'Offensive actions against own country are blocked.' };
    if (negotiationSystem?.isOffensiveBlocked(attackerCountry, targetCountry)) {
      return { ok: false, message: `Offensive action blocked by active ceasefire between ${attackerCountry} and ${targetCountry}.` };
    }
    const relation = this.ensureRelation(attackerCountry, targetCountry);
    if (relation.status === 'war') return { ok: true, relation, autoDeclaredWar: false };
    const declared = this.declareWar(attackerCountry, targetCountry, `${attackerCountry} initiated military action against ${targetCountry}.`);
    return {
      ok: true,
      relation: declared,
      autoDeclaredWar: true,
      message: `War declared: ${attackerCountry} vs ${targetCountry}.`
    };
  }

  getRelationsForCountry(countryName) {
    if (!countryName) return [];
    return Object.values(this.gameState.diplomacy.relationsByPair)
      .filter((relation) => relation.countryA === countryName || relation.countryB === countryName)
      .map((relation) => ({
        ...relation,
        counterpart: relation.countryA === countryName ? relation.countryB : relation.countryA
      }))
      .sort((a, b) => a.counterpart.localeCompare(b.counterpart));
  }

  getDirectionalPressure(sourceCountry, targetCountry) {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation) return { sanctionsLevel: 'none', tradeAllowed: true, startedAt: null };
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    const sourceState = relation.sanctionsBySource[sourceCountry];
    return sourceState || { sanctionsLevel: 'none', tradeAllowed: true, startedAt: null };
  }

  imposeSanctions(sourceCountry, targetCountry, level = 'light') {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation || !['light', 'heavy'].includes(level)) return null;
    if (blocSystem?.areInSameBloc(sourceCountry, targetCountry) && BLOC_CONFIG.sanctionDiscourage) {
      this.gameState.diplomacy.lastSummary = `${sourceCountry} avoided sanctioning bloc partner ${targetCountry}.`;
      return null;
    }
    const sourceProfile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getForeignPolicyBias(this.countrySystem.ensureCountry(sourceCountry))
      : { sanctionsBias: 1 };
    const requestedLevel = level === 'heavy' && (sourceProfile.sanctionsBias || 1) < 0.9 ? 'light' : level;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    relation.sanctionsBySource[sourceCountry] = {
      sanctionsLevel: requestedLevel,
      tradeAllowed: relation.sanctionsBySource[sourceCountry]?.tradeAllowed ?? true,
      startedAt: this.gameState.currentTimeMs
    };
    relation.sanctions = true;
    relation.sanctionsLevel = requestedLevel;
    relation.sanctionsSourceCountry = sourceCountry;
    relation.sanctionsStartedAt = this.gameState.currentTimeMs;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${sourceCountry} imposed ${requestedLevel} sanctions on ${targetCountry}.`;
    this.recordCountryBehavior(sourceCountry, { aggressive: requestedLevel === 'heavy' ? 0.7 : 0.45 });
    return relation;
  }

  liftSanctions(sourceCountry, targetCountry) {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation) return null;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    relation.sanctionsBySource[sourceCountry] = {
      sanctionsLevel: 'none',
      tradeAllowed: relation.sanctionsBySource[sourceCountry]?.tradeAllowed ?? true,
      startedAt: null
    };
    const activeLevels = Object.values(relation.sanctionsBySource)
      .map((state) => state.sanctionsLevel)
      .filter((level) => level && level !== 'none');
    const stillSanctioned = activeLevels.length > 0;
    relation.sanctions = stillSanctioned;
    relation.sanctionsLevel = activeLevels.includes('heavy') ? 'heavy' : (activeLevels.includes('light') ? 'light' : 'none');
    if (!stillSanctioned) relation.sanctionsSourceCountry = null;
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${sourceCountry} lifted sanctions on ${targetCountry}.`;
    this.recordCountryBehavior(sourceCountry, { cooperative: 0.7 });
    return relation;
  }

  setTradeAllowed(sourceCountry, targetCountry, allowed) {
    const relation = this.ensureRelation(sourceCountry, targetCountry);
    if (!relation) return null;
    relation.sanctionsBySource = relation.sanctionsBySource || {};
    const existing = relation.sanctionsBySource[sourceCountry] || { sanctionsLevel: 'none', tradeAllowed: true, startedAt: null };
    relation.sanctionsBySource[sourceCountry] = { ...existing, tradeAllowed: Boolean(allowed) };
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.diplomacy.lastSummary = `${sourceCountry} ${allowed ? 'allowed' : 'blocked'} trade with ${targetCountry}.`;
    this.recordCountryBehavior(sourceCountry, allowed ? { cooperative: 0.45 } : { aggressive: 0.35 });
    return relation;
  }

  getEconomicPressureOnCountry(targetCountry) {
    const incoming = this.getRelationsForCountry(targetCountry)
      .map((relation) => {
        const source = relation.counterpart;
        return { source, state: this.getDirectionalPressure(source, targetCountry) };
      })
      .filter(({ state }) => (state.sanctionsLevel && state.sanctionsLevel !== 'none') || state.tradeAllowed === false);

    let incomeMultiplier = 1;
    let industryMultiplier = 1;
    let stressDrift = 0;
    let stabilityDrift = 0;
    let blockedTradeCount = 0;
    let oilPenalty = 0;

    const target = this.countrySystem.ensureCountry(targetCountry);
    const economicProfile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getEconomicModifiers(target)
      : {
        sanctionsStressMult: 1,
        sanctionsIndustryMult: 1,
        sanctionsIncomeMult: 1,
        sanctionsOilPenaltyMult: 1
      };

    incoming.forEach(({ state }) => {
      if (state.sanctionsLevel === 'light') {
        incomeMultiplier *= 0.9;
        industryMultiplier *= 0.92;
        stressDrift += 0.12;
        oilPenalty += 0.05;
      } else if (state.sanctionsLevel === 'heavy') {
        incomeMultiplier *= 0.75;
        industryMultiplier *= 0.8;
        stressDrift += 0.3;
        stabilityDrift += 0.04;
        oilPenalty += 0.14;
      }
      if (state.tradeAllowed === false) {
        incomeMultiplier *= 0.95;
        industryMultiplier *= 0.96;
        stressDrift += 0.06;
        blockedTradeCount += 1;
        oilPenalty += 0.03;
      }
    });

    incomeMultiplier = 1 - ((1 - incomeMultiplier) * (economicProfile.sanctionsIncomeMult || 1));
    industryMultiplier = 1 - ((1 - industryMultiplier) * (economicProfile.sanctionsIndustryMult || 1));
    stressDrift *= (economicProfile.sanctionsStressMult || 1);
    oilPenalty *= (economicProfile.sanctionsOilPenaltyMult || 1);

    return {
      incomingCount: incoming.length,
      blockedTradeCount,
      incomeMultiplier: Math.max(0.45, incomeMultiplier),
      industryMultiplier: Math.max(0.5, industryMultiplier),
      oilPenalty: Math.max(0, Math.min(0.5, oilPenalty)),
      stressDrift,
      stabilityDrift
    };
  }

  tick() {
    Object.values(this.gameState.diplomacy.relationsByPair).forEach((relation) => {
      if (relation.status === 'war') return;
      if (relation.relationScore === 0) return;
      const drift = relation.relationScore > 0 ? -DIPLOMACY_CONFIG.normalizationStep : DIPLOMACY_CONFIG.normalizationStep;
      relation.relationScore = this.clampScore(relation.relationScore + drift);
      relation.lastChangedAt = this.gameState.currentTimeMs;
      this.updateStatusFromScore(relation, false);
    });
    refreshDiplomacyHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + DIPLOMACY_CONFIG.tickMs,
      type: 'DIPLOMACY_TICK',
      payload: {},
      handler: () => this.tick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }
}
