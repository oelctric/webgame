class LeadershipSystem {
  constructor(gameState, scheduler, countrySystem, governmentProfileSystem, policySystem, diplomacySystem, aiSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.policySystem = policySystem;
    this.diplomacySystem = diplomacySystem;
    this.aiSystem = aiSystem;
    this.started = false;
  }

  clamp(value) {
    return Math.max(LEADERSHIP_CONFIG.clampMin, Math.min(LEADERSHIP_CONFIG.clampMax, value));
  }

  ensureLeadershipFields(country) {
    if (!country) return;
    if (typeof country.leaderMandate !== 'number') country.leaderMandate = LEADERSHIP_CONFIG.defaultMandate;
    if (typeof country.leaderApproval !== 'number') country.leaderApproval = LEADERSHIP_CONFIG.defaultApproval;
    if (typeof country.governmentContinuity !== 'number') country.governmentContinuity = LEADERSHIP_CONFIG.defaultContinuity;
    if (typeof country.lastLeadershipReviewAt !== 'number') country.lastLeadershipReviewAt = this.gameState.currentTimeMs;
    if (typeof country.lastTurnoverAt !== 'number') country.lastTurnoverAt = 0;
    if (typeof country.electionCycleLengthMs !== 'number') {
      const cycleYears = this.getElectionCycleYears(country);
      country.electionCycleLengthMs = cycleYears ? cycleYears * 365 * DAY_MS : null;
    }
    if (country.nextElectionAt == null && this.usesElectionCycle(country)) {
      country.nextElectionAt = this.gameState.currentTimeMs + country.electionCycleLengthMs;
    }
  }

  usesElectionCycle(country) {
    return country.regimeType === 'democracy' || country.regimeType === 'hybrid';
  }

  getElectionCycleYears(country) {
    if (country.regimeType === 'democracy') return LEADERSHIP_CONFIG.electionCycleYears.democracy;
    if (country.regimeType === 'hybrid') return LEADERSHIP_CONFIG.electionCycleYears.hybrid;
    return null;
  }

  getLeadershipLabel(country) {
    if (country.governmentContinuity < 35 || country.leaderMandate < 35) return 'continuity at risk';
    if (country.leaderMandate > 68 && country.leaderApproval > 65) return 'strong mandate';
    if (this.usesElectionCycle(country) && country.nextElectionAt && country.nextElectionAt - this.gameState.currentTimeMs <= LEADERSHIP_CONFIG.electionApproachingMs) {
      return 'election approaching';
    }
    if (country.leaderApproval < 45 || country.leaderMandate < 45) return 'shaky government';
    return 'governing normally';
  }

  updateLeadershipPressure(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return;
    this.ensureLeadershipFields(country);

    const activeWars = this.diplomacySystem.getRelationsForCountry(countryName).filter((relation) => relation.status === 'war').length;
    const domesticRecovery = country.stability > 55 && country.unrest < 35 && country.economicStress < 45 ? 1 : 0;
    const profile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(country)
      : { narrativePressureSensitivity: 1 };

    const publicPain = Math.max(0, 50 - country.publicSupport) / 50;
    const legitimacyPain = Math.max(0, 50 - country.legitimacy) / 50;
    const unrestPain = Math.max(0, country.unrest - 35) / 65;
    const economicPain = Math.max(0, country.economicStress - 35) / 65;
    const warPain = Math.max(0, country.warWeariness - 30) / 70;
    const narrativePain = Math.max(0, country.domesticNarrativePressure - 35) / 65 * (profile.narrativePressureSensitivity || 1);
    const elitePain = Math.max(0, 48 - country.eliteSupport) / 52;

    const performanceBoost = domesticRecovery
      ? (0.34 + Math.max(0, country.publicSupport - 55) / 200)
      : 0;

    const approvalDelta =
      - (publicPain * 1.1)
      - (unrestPain * 0.65)
      - (economicPain * 0.58)
      - (warPain * 0.55)
      - (narrativePain * 0.62)
      + performanceBoost;

    const mandateDelta =
      - (legitimacyPain * 1.05)
      - (unrestPain * 0.48)
      - (economicPain * 0.36)
      - (warPain * 0.3)
      - (narrativePain * 0.42)
      + (country.legitimacy > 62 && country.publicSupport > 58 ? 0.22 : 0)
      + (country.internationalReputation > 25 ? 0.08 : 0);

    const continuityDelta =
      - (legitimacyPain * 0.82)
      - (elitePain * 0.82)
      - (unrestPain * 0.45)
      - (activeWars > 0 ? 0.15 : -0.06)
      - (narrativePain * 0.28)
      + (country.stability > 60 ? 0.18 : 0);

    country.leaderApproval = this.clamp(country.leaderApproval + approvalDelta);
    country.leaderMandate = this.clamp(country.leaderMandate + mandateDelta);
    country.governmentContinuity = this.clamp(country.governmentContinuity + continuityDelta);
    country.lastLeadershipReviewAt = this.gameState.currentTimeMs;
  }

  evaluateElection(countryName, reason = 'scheduled') {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureLeadershipFields(country);
    if (!this.usesElectionCycle(country)) return { ok: false, reason: 'No election cycle for regime.' };

    const weakApproval = country.leaderApproval < LEADERSHIP_CONFIG.turnoverThresholds.democracy.approval;
    const weakMandate = country.leaderMandate < LEADERSHIP_CONFIG.turnoverThresholds.democracy.mandate;
    const weakLegitimacy = country.legitimacy < LEADERSHIP_CONFIG.turnoverThresholds.democracy.legitimacy;
    const weakContinuity = country.governmentContinuity < LEADERSHIP_CONFIG.turnoverThresholds.democracy.continuity;

    const shouldTurnover = weakApproval || (weakMandate && weakLegitimacy) || (weakContinuity && weakApproval);
    if (shouldTurnover) {
      return this.applyGovernmentTurnover(countryName, reason === 'manual' ? 'manual_election_turnover' : 'election_turnover');
    }

    country.leaderMandate = this.clamp(country.leaderMandate + 10);
    country.leaderApproval = this.clamp(country.leaderApproval + 6);
    country.governmentContinuity = this.clamp(country.governmentContinuity + 8);
    this.scheduleNextElection(country);
    this.gameState.leadership.lastSummary = `${countryName} renewed its governing mandate.`;
    return { ok: true, type: 'renewal' };
  }

  evaluateNonElectoralContinuity(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureLeadershipFields(country);

    const severeStress = country.economicStress > 72 || country.unrest > 70 || country.warWeariness > 72 || country.domesticNarrativePressure > 75;
    const weakCore = country.governmentContinuity < LEADERSHIP_CONFIG.turnoverThresholds.nondemocratic.continuity
      && country.legitimacy < LEADERSHIP_CONFIG.turnoverThresholds.nondemocratic.legitimacy
      && country.eliteSupport < LEADERSHIP_CONFIG.turnoverThresholds.nondemocratic.elite;

    if (severeStress && weakCore) {
      return this.applyGovernmentTurnover(countryName, 'continuity_break');
    }

    if (country.governmentContinuity < 42 && country.regimeType === 'authoritarian') {
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: country.policy?.militarySpendingLevel === 'high' ? 'normal' : 'high',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: 'high'
      });
      country.leaderMandate = this.clamp(country.leaderMandate - 3);
      this.gameState.leadership.lastSummary = `${countryName} hardened domestic control to preserve continuity.`;
      return { ok: true, type: 'hardening' };
    }
    return { ok: true, type: 'no_change' };
  }

  applyGovernmentTurnover(countryName, source = 'pressure_turnover') {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureLeadershipFields(country);

    const priorRegime = country.regimeType;
    country.governmentContinuity = this.clamp(58 + Math.random() * 16);
    country.leaderMandate = this.clamp(46 + Math.random() * 18);
    country.leaderApproval = this.clamp(44 + Math.random() * 20);
    country.legitimacy = this.clamp(country.legitimacy + 8);
    country.publicSupport = this.clamp(country.publicSupport + 6);
    country.lastTurnoverAt = this.gameState.currentTimeMs;

    if (priorRegime === 'democracy') {
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: country.warWeariness > 45 ? 'low' : 'normal',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: 'normal'
      });
      if (country.foreignPolicyStyle === 'aggressive') country.foreignPolicyStyle = 'pragmatic';
    } else if (priorRegime === 'authoritarian') {
      const highThreat = country.warWeariness > 62 || country.unrest > 66;
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: highThreat ? 'high' : 'normal',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: highThreat ? 'high' : 'normal'
      });
      if (!highThreat && country.foreignPolicyStyle === 'aggressive') country.foreignPolicyStyle = 'pragmatic';
    } else {
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: country.warWeariness > 50 ? 'low' : 'normal',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: country.unrest > 55 ? 'high' : 'normal'
      });
      if (country.warWeariness > 55 && country.foreignPolicyStyle === 'aggressive') country.foreignPolicyStyle = 'pragmatic';
    }

    this.scheduleNextElection(country);

    if (country.aiControlled && this.aiSystem?.onLeadershipTurnover) {
      this.aiSystem.onLeadershipTurnover(countryName, source);
    }

    this.gameState.leadership.lastSummary = `${countryName} leadership turnover (${source}).`;
    return { ok: true, type: 'turnover', source };
  }

  scheduleNextElection(country) {
    if (!this.usesElectionCycle(country)) {
      country.nextElectionAt = null;
      country.electionCycleLengthMs = null;
      return;
    }
    const cycleYears = this.getElectionCycleYears(country);
    country.electionCycleLengthMs = cycleYears * 365 * DAY_MS;
    country.nextElectionAt = this.gameState.currentTimeMs + country.electionCycleLengthMs;
  }

  setElectionOffsetDays(countryName, days) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    this.ensureLeadershipFields(country);
    if (!this.usesElectionCycle(country)) return false;
    const safeDays = Math.max(1, Number(days) || 1);
    country.nextElectionAt = this.gameState.currentTimeMs + safeDays * DAY_MS;
    return true;
  }

  processTick() {
    this.gameState.leadership.lastSummary = 'Leadership mandate and continuity reviewed.';
    Object.keys(this.gameState.countries).forEach((countryName) => {
      const country = this.countrySystem.ensureCountry(countryName);
      this.ensureLeadershipFields(country);
      this.updateLeadershipPressure(countryName);
      if (this.usesElectionCycle(country) && country.nextElectionAt <= this.gameState.currentTimeMs) {
        const result = this.evaluateElection(countryName);
        const playerCountry = this.gameState.selectedPlayerCountry?.properties?.name;
        if (countryName === playerCountry) {
          const msg = result?.type === 'turnover'
            ? `${countryName} election triggered government turnover.`
            : `${countryName} election renewed the current mandate.`;
          setStatus(msg);
        }
      } else if (!this.usesElectionCycle(country)) {
        const result = this.evaluateNonElectoralContinuity(countryName);
        if (result?.type === 'turnover') {
          const playerCountry = this.gameState.selectedPlayerCountry?.properties?.name;
          if (countryName === playerCountry) {
            setStatus(`${countryName} leadership changed under continuity pressure.`);
          }
        }
      }
    });

    this.gameState.leadership.lastTickAt = this.gameState.currentTimeMs;
    refreshCountryHud();
    refreshDomesticHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + LEADERSHIP_CONFIG.tickMs,
      type: 'LEADERSHIP_TICK',
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
