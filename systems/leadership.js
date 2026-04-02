class LeadershipSystem {
  constructor(gameState, scheduler, countrySystem, governmentProfileSystem, policySystem, diplomacySystem, aiSystem = null, factionSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.policySystem = policySystem;
    this.diplomacySystem = diplomacySystem;
    this.aiSystem = aiSystem;
    this.factionSystem = factionSystem;
    this.started = false;
  }

  clamp(value) {
    return Math.max(LEADERSHIP_CONFIG.clampMin, Math.min(LEADERSHIP_CONFIG.clampMax, value));
  }

  clampTrait(value) {
    return Math.max(LEADER_CONFIG.traitMin, Math.min(LEADER_CONFIG.traitMax, Number(value) || 0));
  }

  randomInRange(base, variance = 14) {
    return this.clampTrait(base + ((Math.random() * 2) - 1) * variance);
  }

  pickLeaderName() {
    const first = LEADER_CONFIG.firstNames[Math.floor(Math.random() * LEADER_CONFIG.firstNames.length)] || 'Alex';
    const last = LEADER_CONFIG.lastNames[Math.floor(Math.random() * LEADER_CONFIG.lastNames.length)] || 'Hale';
    return `${first} ${last}`;
  }

  pickArchetypeForCountry(country) {
    if (country.regimeType === 'authoritarian') return Math.random() > 0.45 ? 'strongman' : 'hardliner';
    if (country.economicOrientation === 'market') return Math.random() > 0.5 ? 'technocrat' : 'pragmatist';
    if (country.regimeType === 'democracy') return Math.random() > 0.5 ? 'reformer' : 'pragmatist';
    const keys = Object.keys(LEADER_CONFIG.archetypes);
    return keys[Math.floor(Math.random() * keys.length)] || 'pragmatist';
  }

  generateLeaderProfile(country, options = {}) {
    const archetype = options.archetype && LEADER_CONFIG.archetypes[options.archetype]
      ? options.archetype
      : this.pickArchetypeForCountry(country);
    const base = LEADER_CONFIG.archetypes[archetype] || LEADER_CONFIG.archetypes.pragmatist;
    const traits = {
      riskTolerance: this.randomInRange(base.riskTolerance),
      repressionPreference: this.randomInRange(base.repressionPreference),
      economicCompetence: this.randomInRange(base.economicCompetence),
      diplomaticFlexibility: this.randomInRange(base.diplomaticFlexibility),
      crisisManagement: this.randomInRange(base.crisisManagement)
    };

    return {
      leaderId: options.leaderId || `${country.id || 'country'}_${this.gameState.currentTimeMs}_${Math.floor(Math.random() * 1_000_000)}`,
      leaderName: options.leaderName || this.pickLeaderName(),
      leaderArchetype: archetype,
      leaderTraits: traits
    };
  }

  generateLeaderFlavor(country, options = {}) {
    const traits = country.leaderTraits || {};
    const risk = traits.riskTolerance || 50;
    const repression = traits.repressionPreference || 50;
    const econ = traits.economicCompetence || 50;
    const diplomacy = traits.diplomaticFlexibility || 50;
    const crisis = traits.crisisManagement || 50;
    const temperament = risk >= 65 ? 'assertive' : (risk <= 35 ? 'cautious' : 'measured');
    const governance = repression >= 65 ? 'security-centered' : (repression <= 35 ? 'consensus-seeking' : 'institutional');
    const economics = econ >= 65 ? 'technocratic' : (econ <= 35 ? 'patronage-prone' : 'pragmatic');
    const diplomatic = diplomacy >= 65 ? 'negotiation-forward' : (diplomacy <= 35 ? 'rigidly adversarial' : 'transactional');
    const crisisStyle = crisis >= 65 ? 'calm under pressure' : (crisis <= 35 ? 'reactive in shocks' : 'steady in disruptions');
    const archetypeLabel = options.archetypeLabel
      || `${temperament} ${country.leaderArchetype}`.replace(/\s+/g, ' ').trim();
    const summary = `${country.leaderName} is a ${archetypeLabel} with ${economics} economic instincts and a ${governance} governing posture.`;
    const bio = `${country.leaderName} governs with a ${diplomatic} external style and is generally ${crisisStyle}.`;
    const explanation = this.getLeaderBehaviorExplanation(country);
    return { archetypeLabel, summary, bio, explanation };
  }

  getLeaderBehaviorExplanation(country) {
    const t = country.leaderTraits || {};
    const lines = [];
    if ((t.riskTolerance || 50) >= 65 && (t.diplomaticFlexibility || 50) <= 40) lines.push('Escalation-prone: high risk tolerance and low diplomatic flexibility.');
    else if ((t.riskTolerance || 50) <= 35) lines.push('Stabilization-prone: low risk tolerance favors caution.');
    if ((t.repressionPreference || 50) >= 65) lines.push('Coercive tendency: high repression preference favors security-heavy responses.');
    if ((t.economicCompetence || 50) >= 65) lines.push('Economic resilience: strong competence improves recovery tradeoffs.');
    if ((t.diplomaticFlexibility || 50) >= 65) lines.push('Negotiation-forward: high flexibility raises ceasefire/trade-repair preference.');
    if ((t.crisisManagement || 50) >= 65) lines.push('Crisis-capable: stronger shock management and continuity handling.');
    return lines.slice(0, 3).join(' ');
  }

  describeLeaderShift(previousTraits = {}, nextTraits = {}) {
    const shifts = [];
    const compare = (key, label) => {
      const delta = (nextTraits[key] || 50) - (previousTraits[key] || 50);
      if (delta >= 12) shifts.push(`${label} ↑`);
      else if (delta <= -12) shifts.push(`${label} ↓`);
    };
    compare('riskTolerance', 'risk');
    compare('repressionPreference', 'repression');
    compare('economicCompetence', 'economy');
    compare('diplomaticFlexibility', 'diplomacy');
    compare('crisisManagement', 'crisis');
    return shifts.length ? shifts.join(', ') : 'leadership profile shifted modestly';
  }

  refreshLeaderFlavor(country, options = {}) {
    if (!country) return;
    country.leaderFlavor = this.generateLeaderFlavor(country, options);
    country.leaderSummary = this.getLeaderSummary(country);
  }

  getLeaderBehaviorBias(country) {
    const traits = country.leaderTraits || {};
    const norm = (v) => ((Number(v) || 50) - 50) / 50;
    const regimeWeight = country.regimeType === 'authoritarian'
      ? { repression: 1.25, diplomacy: 0.85, public: 0.8 }
      : (country.regimeType === 'democracy' ? { repression: 0.8, diplomacy: 1.15, public: 1.15 } : { repression: 1, diplomacy: 1, public: 1 });
    const faction = country.factionEffects || {};

    const risk = norm(traits.riskTolerance);
    const repression = norm(traits.repressionPreference);
    const econ = norm(traits.economicCompetence);
    const diplomacy = norm(traits.diplomaticFlexibility);
    const crisis = norm(traits.crisisManagement);

    return {
      escalationBias: risk * 0.9 + repression * 0.25 + (faction.hardlinePostureBias || 0) * 0.35,
      deescalationBias: diplomacy * 0.9 - risk * 0.35 + (faction.deescalationBias || 0) * 0.25,
      internalSecurityBias: (repression * regimeWeight.repression) + (faction.internalSecurityBias || 0) * 0.35,
      economicStabilizationBias: econ * 0.8 + crisis * 0.3 + (faction.tradeRestorationBias || 0) * 0.2,
      negotiationBias: diplomacy * regimeWeight.diplomacy - risk * 0.25,
      mandateSensitivity: regimeWeight.public * (diplomacy * 0.4 - repression * 0.2),
      factionSecurityAlignment: repression * 0.7 + (faction.internalSecurityBias || 0) * 0.4,
      factionReformAlignment: diplomacy * 0.7 + econ * 0.4 - repression * 0.4,
      crisisResilienceBias: crisis * 0.8 + econ * 0.35 - risk * 0.2
    };
  }

  getLeaderSummary(country) {
    const t = country.leaderTraits || {};
    const labels = [];
    if ((t.riskTolerance || 50) >= 65) labels.push('high-risk');
    else if ((t.riskTolerance || 50) <= 35) labels.push('cautious');

    if ((t.repressionPreference || 50) >= 65) labels.push('security-first');
    if ((t.diplomaticFlexibility || 50) >= 65) labels.push('diplomatic');
    if ((t.economicCompetence || 50) >= 68) labels.push('technocratic');
    if ((t.diplomaticFlexibility || 50) >= 62 && (t.repressionPreference || 50) <= 40) labels.push('reformist');
    labels.push(country.leaderArchetype || 'pragmatist');
    return labels.slice(0, 3).join(' ');
  }

  ensureLeadershipFields(country) {
    if (!country) return;
    if (typeof country.leaderMandate !== 'number') country.leaderMandate = LEADERSHIP_CONFIG.defaultMandate;
    if (typeof country.leaderApproval !== 'number') country.leaderApproval = LEADERSHIP_CONFIG.defaultApproval;
    if (typeof country.governmentContinuity !== 'number') country.governmentContinuity = LEADERSHIP_CONFIG.defaultContinuity;
    if (typeof country.lastLeadershipReviewAt !== 'number') country.lastLeadershipReviewAt = this.gameState.currentTimeMs;
    if (typeof country.lastTurnoverAt !== 'number') country.lastTurnoverAt = 0;

    if (!country.leaderTraits || typeof country.leaderTraits !== 'object') {
      Object.assign(country, this.generateLeaderProfile(country));
    }
    if (!country.leaderId) country.leaderId = `${country.id || 'country'}_${this.gameState.currentTimeMs}_${Math.floor(Math.random() * 1_000_000)}`;
    if (!country.leaderName || !country.leaderName.trim()) {
      country.leaderName = this.pickLeaderName();
    }

    country.leaderTraits.riskTolerance = this.clampTrait(country.leaderTraits.riskTolerance);
    country.leaderTraits.repressionPreference = this.clampTrait(country.leaderTraits.repressionPreference);
    country.leaderTraits.economicCompetence = this.clampTrait(country.leaderTraits.economicCompetence);
    country.leaderTraits.diplomaticFlexibility = this.clampTrait(country.leaderTraits.diplomaticFlexibility);
    country.leaderTraits.crisisManagement = this.clampTrait(country.leaderTraits.crisisManagement);

    country.leaderBehaviorBias = this.getLeaderBehaviorBias(country);
    this.refreshLeaderFlavor(country);

    if (typeof country.electionCycleLengthMs !== 'number') {
      const cycleYears = this.getElectionCycleYears(country);
      country.electionCycleLengthMs = cycleYears ? cycleYears * 365 * DAY_MS : null;
    }
    if (country.nextElectionAt == null && this.usesElectionCycle(country)) {
      country.nextElectionAt = this.gameState.currentTimeMs + country.electionCycleLengthMs;
    }
  }

  renameLeader(countryName, leaderName) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    this.ensureLeadershipFields(country);
    const clean = String(leaderName || '').trim();
    if (!clean) return false;
    country.leaderName = clean.slice(0, 36);
    this.refreshLeaderFlavor(country);
    return true;
  }

  regenerateLeader(countryName, options = {}) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureLeadershipFields(country);
    const previous = `${country.leaderName} (${country.leaderArchetype})`;
    Object.assign(country, this.generateLeaderProfile(country, options));
    country.leaderBehaviorBias = this.getLeaderBehaviorBias(country);
    this.refreshLeaderFlavor(country);
    const message = `${countryName} leadership shifted from ${previous} to ${country.leaderName} (${country.leaderSummary}).`;
    this.gameState.leadership.lastSummary = message;
    return { ok: true, message };
  }

  setLeaderTrait(countryName, trait, value) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return false;
    this.ensureLeadershipFields(country);
    if (!Object.prototype.hasOwnProperty.call(country.leaderTraits, trait)) return false;
    country.leaderTraits[trait] = this.clampTrait(value);
    country.leaderBehaviorBias = this.getLeaderBehaviorBias(country);
    this.refreshLeaderFlavor(country);
    return true;
  }

  regenerateLeaderFlavor(countryName, options = {}) {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureLeadershipFields(country);
    if (options.rerollNameOnly) {
      country.leaderName = this.pickLeaderName();
    }
    this.refreshLeaderFlavor(country);
    const msg = `${countryName} leader flavor refreshed for ${country.leaderName} (${country.leaderFlavor?.archetypeLabel || country.leaderSummary}).`;
    this.gameState.leadership.lastSummary = msg;
    return { ok: true, message: msg };
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

  applyLeaderEffects(country) {
    const bias = country.leaderBehaviorBias || this.getLeaderBehaviorBias(country);
    const stabilityLift = (bias.crisisResilienceBias || 0) * 0.16;
    const economicRecovery = (bias.economicStabilizationBias || 0) * 0.22;
    const repressionBoost = (bias.internalSecurityBias || 0) * 0.18;
    const democraticLegitimacyDrag = country.regimeType === 'democracy' ? Math.max(0, repressionBoost) * 0.2 : 0;
    const authoritarianOrderGain = country.regimeType === 'authoritarian' ? Math.max(0, repressionBoost) * 0.18 : 0;

    country.economicStress = this.clamp(country.economicStress - economicRecovery);
    country.stability = this.clamp(country.stability + stabilityLift + authoritarianOrderGain * 0.5);
    country.unrest = this.clamp(country.unrest - Math.max(0, repressionBoost) * 0.28 - Math.max(0, stabilityLift) * 0.18 + Math.max(0, democraticLegitimacyDrag) * 0.12);
    country.legitimacy = this.clamp(country.legitimacy - democraticLegitimacyDrag + (country.regimeType === 'democracy' ? Math.max(0, bias.negotiationBias || 0) * 0.08 : 0));
    country.publicSupport = this.clamp(country.publicSupport
      + (country.regimeType === 'democracy' ? (bias.mandateSensitivity || 0) * 0.16 : 0)
      - (country.regimeType === 'authoritarian' ? Math.max(0, repressionBoost) * 0.08 : 0));

    if (this.factionSystem) this.factionSystem.ensureCountryFactions(country);
    if (country.factions) {
      country.factions.security_elite.satisfaction = this.clamp((country.factions.security_elite.satisfaction || 50) + (bias.factionSecurityAlignment || 0) * 0.35);
      country.factions.public_civic_pressure.satisfaction = this.clamp((country.factions.public_civic_pressure.satisfaction || 50) + (bias.factionReformAlignment || 0) * 0.28 - (bias.factionSecurityAlignment || 0) * 0.2);
      country.factions.hardliner_reform_bloc.pressureDirection = (bias.factionSecurityAlignment || 0) > 0.25 ? 'hardline' : 'reform';
    }
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
    if (this.factionSystem) this.factionSystem.ensureCountryFactions(country);
    const factionEffects = country.factionEffects || {};

    const leaderBias = country.leaderBehaviorBias || this.getLeaderBehaviorBias(country);

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
      - (economicPain * (0.58 - Math.max(0, leaderBias.economicStabilizationBias || 0) * 0.12))
      - (warPain * (0.55 + Math.max(0, leaderBias.escalationBias || 0) * 0.08))
      - (narrativePain * 0.62)
      + performanceBoost
      + Math.max(0, leaderBias.negotiationBias || 0) * 0.12;

    const mandateDelta =
      - (legitimacyPain * 1.05)
      - (unrestPain * (0.48 + Math.max(0, leaderBias.internalSecurityBias || 0) * 0.12))
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
      + (country.stability > 60 ? 0.18 : 0)
      + Math.max(0, leaderBias.crisisResilienceBias || 0) * 0.15;

    country.leaderApproval = this.clamp(country.leaderApproval + approvalDelta + ((factionEffects.mandateDrift || 0) * 0.7));
    country.leaderMandate = this.clamp(country.leaderMandate + mandateDelta + (factionEffects.mandateDrift || 0));
    country.governmentContinuity = this.clamp(country.governmentContinuity + continuityDelta + (factionEffects.continuityDrift || 0));
    this.applyLeaderEffects(country);
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
    if (this.factionSystem?.onLeadershipTurnover) this.factionSystem.onLeadershipTurnover(countryName);
    this.gameState.leadership.lastSummary = `${countryName} renewed ${country.leaderName}'s mandate.`;
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
      const repressionHeavy = (country.leaderTraits?.repressionPreference || 50) >= 62;
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: country.policy?.militarySpendingLevel === 'high' ? 'normal' : 'high',
        industryInvestmentLevel: repressionHeavy ? 'low' : 'normal',
        internalSecurityLevel: 'high'
      });
      country.leaderMandate = this.clamp(country.leaderMandate - 3);
      this.gameState.leadership.lastSummary = `${countryName} hardened domestic control under ${country.leaderName}.`;
      return { ok: true, type: 'hardening' };
    }
    return { ok: true, type: 'no_change' };
  }

  applyGovernmentTurnover(countryName, source = 'pressure_turnover') {
    const country = this.countrySystem.ensureCountry(countryName);
    if (!country) return null;
    this.ensureLeadershipFields(country);

    const priorRegime = country.regimeType;
    const previousLeader = `${country.leaderName} (${country.leaderSummary || country.leaderArchetype})`;
    const previousTraits = { ...(country.leaderTraits || {}) };
    country.governmentContinuity = this.clamp(58 + Math.random() * 16);
    country.leaderMandate = this.clamp(46 + Math.random() * 18);
    country.leaderApproval = this.clamp(44 + Math.random() * 20);
    country.legitimacy = this.clamp(country.legitimacy + 8);
    country.publicSupport = this.clamp(country.publicSupport + 6);
    country.lastTurnoverAt = this.gameState.currentTimeMs;

    this.regenerateLeader(countryName);

    if (priorRegime === 'democracy') {
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: country.warWeariness > 45 ? 'low' : 'normal',
        industryInvestmentLevel: country.leaderTraits.economicCompetence > 60 ? 'high' : 'normal',
        internalSecurityLevel: country.leaderTraits.repressionPreference > 66 ? 'high' : 'normal'
      });
      if (country.foreignPolicyStyle === 'aggressive' && country.leaderTraits.diplomaticFlexibility > 48) country.foreignPolicyStyle = 'pragmatic';
    } else if (priorRegime === 'authoritarian') {
      const highThreat = country.warWeariness > 62 || country.unrest > 66;
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: highThreat || country.leaderTraits.riskTolerance > 64 ? 'high' : 'normal',
        industryInvestmentLevel: country.leaderTraits.economicCompetence < 42 ? 'low' : 'normal',
        internalSecurityLevel: highThreat || country.leaderTraits.repressionPreference > 55 ? 'high' : 'normal'
      });
      if (!highThreat && country.foreignPolicyStyle === 'aggressive' && country.leaderTraits.diplomaticFlexibility > 58) country.foreignPolicyStyle = 'pragmatic';
    } else {
      this.policySystem.setPolicyBundle(countryName, {
        militarySpendingLevel: country.warWeariness > 50 ? 'low' : 'normal',
        industryInvestmentLevel: country.leaderTraits.economicCompetence > 62 ? 'high' : 'normal',
        internalSecurityLevel: country.unrest > 55 || country.leaderTraits.repressionPreference > 58 ? 'high' : 'normal'
      });
      if (country.warWeariness > 55 && country.foreignPolicyStyle === 'aggressive' && country.leaderTraits.diplomaticFlexibility > 52) country.foreignPolicyStyle = 'pragmatic';
    }

    this.scheduleNextElection(country);

    if (country.aiControlled && this.aiSystem?.onLeadershipTurnover) {
      this.aiSystem.onLeadershipTurnover(countryName, source);
    }
    if (this.factionSystem?.onLeadershipTurnover) this.factionSystem.onLeadershipTurnover(countryName);

    const shift = this.describeLeaderShift(previousTraits, country.leaderTraits);
    this.gameState.leadership.lastSummary = `${countryName} leadership turnover (${source}): ${previousLeader} -> ${country.leaderName} (${country.leaderSummary}; ${shift}).`;
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
            ? `${countryName} election replaced leadership with ${country.leaderName} (${country.leaderSummary}).`
            : `${countryName} election renewed ${country.leaderName}'s mandate.`;
          setStatus(msg);
        }
      } else if (!this.usesElectionCycle(country)) {
        const result = this.evaluateNonElectoralContinuity(countryName);
        if (result?.type === 'turnover') {
          const playerCountry = this.gameState.selectedPlayerCountry?.properties?.name;
          if (countryName === playerCountry) {
            setStatus(`${countryName} leadership changed under continuity pressure. ${country.leaderName} now leads (${country.leaderSummary}).`);
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
