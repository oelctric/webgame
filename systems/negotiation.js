class NegotiationSystem {
  constructor(gameState, scheduler, diplomacySystem, tradeSystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.diplomacySystem = diplomacySystem;
    this.tradeSystem = tradeSystem;
    this.started = false;
  }

  pairKey(countryA, countryB) {
    const [a, b] = [countryA, countryB].sort((x, y) => x.localeCompare(y));
    return `${a}::${b}`;
  }

  createAgreementId(prefix) {
    this.gameState.negotiation.nextAgreementId += 1;
    return `${prefix}-${this.gameState.negotiation.nextAgreementId}`;
  }

  getActiveAgreement(collection, countryA, countryB) {
    const key = this.pairKey(countryA, countryB);
    const agreement = collection[key];
    if (!agreement) return null;
    if (agreement.expiresAt && agreement.expiresAt <= this.gameState.currentTimeMs) return null;
    return agreement;
  }

  isOffensiveBlocked(countryA, countryB) {
    return Boolean(this.getActiveAgreement(this.gameState.negotiation.ceasefiresByPair, countryA, countryB));
  }

  hasTemporaryTradeRestoration(countryA, countryB) {
    return Boolean(this.getActiveAgreement(this.gameState.negotiation.tradeRestorationByPair, countryA, countryB));
  }

  formatDaysLeft(expiresAt) {
    if (!expiresAt) return 'indefinite';
    const days = Math.max(0, (expiresAt - this.gameState.currentTimeMs) / DAY_MS);
    return `${days.toFixed(1)}d`;
  }

  cancelHostileIntent(countryA, countryB) {
    this.gameState.units.forEach((unit) => {
      if (unit.status === 'destroyed') return;
      if (unit.combatStatus !== 'attacking') return;
      const targetCountry = unit.targetType === 'unit'
        ? this.gameState.units.find((u) => u.id === unit.currentTargetId)?.ownerCountry
        : this.gameState.bases.find((b) => b.id === unit.currentTargetId)?.ownerCountry;
      if (!targetCountry) return;
      const matching = (unit.ownerCountry === countryA && targetCountry === countryB)
        || (unit.ownerCountry === countryB && targetCountry === countryA);
      if (matching) combatSystem.clearUnitCombat(unit);
    });

    const assets = [...this.gameState.bases, ...this.gameState.cities];
    assets.forEach((asset) => {
      if (!asset.captureState) return;
      const unit = this.gameState.units.find((u) => u.id === asset.captureState.captorUnitId);
      if (!unit) return;
      const matching = (unit.ownerCountry === countryA && asset.ownerCountry === countryB)
        || (unit.ownerCountry === countryB && asset.ownerCountry === countryA);
      if (matching) {
        asset.captureState = null;
        asset.controlStatus = 'normal';
        unit.captureTarget = null;
      }
    });
  }

  setCeasefire(countryA, countryB, durationDays = NEGOTIATION_CONFIG.ceasefireDefaultDays) {
    const relation = this.diplomacySystem.getRelation(countryA, countryB);
    if (!relation) return null;
    const key = this.pairKey(countryA, countryB);
    const expiresAt = durationDays > 0 ? this.gameState.currentTimeMs + durationDays * DAY_MS : null;
    this.gameState.negotiation.ceasefiresByPair[key] = {
      id: this.createAgreementId('ceasefire'),
      countryA: relation.countryA,
      countryB: relation.countryB,
      startedAt: this.gameState.currentTimeMs,
      expiresAt,
      previousStatus: relation.status
    };
    relation.status = 'ceasefire';
    relation.relationScore = this.diplomacySystem.clampScore(Math.max(relation.relationScore, -45));
    relation.lastChangedAt = this.gameState.currentTimeMs;
    this.cancelHostileIntent(countryA, countryB);
    this.diplomacySystem.adjustRelationScore(countryA, countryB, 6, 'Ceasefire signed');
    this.gameState.negotiation.lastSummary = `Ceasefire: ${countryA} ↔ ${countryB} (${this.formatDaysLeft(expiresAt)}).`;
    return this.gameState.negotiation.ceasefiresByPair[key];
  }

  signPeaceDeal(countryA, countryB) {
    delete this.gameState.negotiation.ceasefiresByPair[this.pairKey(countryA, countryB)];
    this.cancelHostileIntent(countryA, countryB);
    const relation = this.diplomacySystem.makePeace(countryA, countryB, `${countryA} and ${countryB} signed a peace deal.`);
    if (!relation) return null;
    this.diplomacySystem.adjustRelationScore(countryA, countryB, 12, 'Peace deal normalization');
    gameState.chokepoints.points
      .filter((cp) => [countryA, countryB].includes(cp.controllingCountryId) && cp.disruptionSource === 'war_pressure')
      .forEach((cp) => {
        cp.openState = 'open';
        cp.contested = false;
        cp.disruptionSource = 'peace_reopened';
      });
    this.gameState.negotiation.lastSummary = `Peace deal signed: ${countryA} ↔ ${countryB}.`;
    return relation;
  }

  applySanctionsRelief(sourceCountry, targetCountry) {
    const relation = this.diplomacySystem.liftSanctions(sourceCountry, targetCountry);
    if (!relation) return null;
    const source = countrySystem.ensureCountry(sourceCountry);
    const target = countrySystem.ensureCountry(targetCountry);
    source.economicStress = Math.max(0, source.economicStress - 1);
    target.economicStress = Math.max(0, target.economicStress - 4);
    target.unrest = Math.max(0, target.unrest - 1.5);
    this.diplomacySystem.adjustRelationScore(sourceCountry, targetCountry, 5, 'Sanctions relief');
    this.gameState.negotiation.lastSummary = `${sourceCountry} granted sanctions relief to ${targetCountry}.`;
    return relation;
  }

  applyBorderDeEscalation(countryA, countryB) {
    const relation = this.diplomacySystem.getRelation(countryA, countryB);
    if (!relation) return null;
    this.diplomacySystem.adjustRelationScore(countryA, countryB, 8, 'Border de-escalation');
    relation.lastConflictAt = null;
    const countryOne = countrySystem.ensureCountry(countryA);
    const countryTwo = countrySystem.ensureCountry(countryB);
    [countryOne, countryTwo].forEach((country) => {
      country.unrest = Math.max(0, country.unrest - 1.2);
      country.warWeariness = Math.max(0, country.warWeariness - 1.8);
    });
    this.gameState.negotiation.lastSummary = `Border de-escalation: ${countryA} ↔ ${countryB}.`;
    return relation;
  }

  restoreTemporaryTrade(countryA, countryB, durationDays = NEGOTIATION_CONFIG.temporaryTradeDefaultDays) {
    const relation = this.diplomacySystem.getRelation(countryA, countryB);
    if (!relation) return null;
    const key = this.pairKey(countryA, countryB);
    const expiresAt = durationDays > 0 ? this.gameState.currentTimeMs + durationDays * DAY_MS : null;
    this.gameState.negotiation.tradeRestorationByPair[key] = {
      id: this.createAgreementId('trade'),
      countryA: relation.countryA,
      countryB: relation.countryB,
      startedAt: this.gameState.currentTimeMs,
      expiresAt
    };
    this.diplomacySystem.setTradeAllowed(countryA, countryB, true);
    this.diplomacySystem.setTradeAllowed(countryB, countryA, true);
    gameState.chokepoints.points
      .filter((cp) => [countryA, countryB].includes(cp.controllingCountryId) && cp.openState === 'restricted')
      .forEach((cp) => { cp.openState = 'open'; cp.disruptionSource = 'trade_restoration'; });
    this.diplomacySystem.adjustRelationScore(countryA, countryB, 4, 'Temporary trade restoration');
    this.tradeSystem.processTick();
    this.gameState.negotiation.lastSummary = `Temporary trade restored: ${countryA} ↔ ${countryB} (${this.formatDaysLeft(expiresAt)}).`;
    return this.gameState.negotiation.tradeRestorationByPair[key];
  }

  processExpiries() {
    const now = this.gameState.currentTimeMs;
    Object.entries(this.gameState.negotiation.ceasefiresByPair).forEach(([key, ceasefire]) => {
      if (!ceasefire.expiresAt || ceasefire.expiresAt > now) return;
      delete this.gameState.negotiation.ceasefiresByPair[key];
      const relation = this.diplomacySystem.getRelation(ceasefire.countryA, ceasefire.countryB);
      if (relation && relation.status === 'ceasefire') {
        relation.status = this.diplomacySystem.deriveStatusFromScore(relation.relationScore);
        relation.lastChangedAt = now;
      }
      this.gameState.negotiation.lastSummary = `Ceasefire expired: ${ceasefire.countryA} ↔ ${ceasefire.countryB}.`;
    });
    Object.entries(this.gameState.negotiation.tradeRestorationByPair).forEach(([key, agreement]) => {
      if (!agreement.expiresAt || agreement.expiresAt > now) return;
      delete this.gameState.negotiation.tradeRestorationByPair[key];
      this.gameState.negotiation.lastSummary = `Temporary trade restoration expired: ${agreement.countryA} ↔ ${agreement.countryB}.`;
    });
  }

  processTick() {
    this.processExpiries();
    refreshNegotiationHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + NEGOTIATION_CONFIG.tickMs,
      type: 'NEGOTIATION_TICK',
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
