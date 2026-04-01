class AISystem {
  constructor(gameState, scheduler, systems) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.productionSystem = systems.productionSystem;
    this.movementSystem = systems.movementSystem;
    this.combatSystem = systems.combatSystem;
    this.captureSystem = systems.captureSystem;
    this.economySystem = systems.economySystem;
    this.policySystem = systems.policySystem;
    this.diplomacySystem = systems.diplomacySystem;
    this.resourceSystem = systems.resourceSystem;
    this.countrySystem = systems.countrySystem;
    this.tradeSystem = systems.tradeSystem;
    this.chokepointSystem = systems.chokepointSystem;
    this.blocSystem = systems.blocSystem;
    this.eventSystem = systems.eventSystem;
    this.internalResistanceSystem = systems.internalResistanceSystem || null;
    this.negotiationSystem = systems.negotiationSystem;
    this.governmentProfileSystem = systems.governmentProfileSystem || null;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleOperationalTick();
    this.scheduleStrategicTick();
  }

  scheduleOperationalTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + AI_CONFIG.tickMs,
      type: 'AI_TICK',
      payload: {},
      handler: () => this.tickOperational()
    });
  }

  scheduleStrategicTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + AI_CONFIG.strategicTickMs,
      type: 'AI_STRATEGIC_TICK',
      payload: {},
      handler: () => this.tickStrategic()
    });
  }

  tickOperational() {
    this.gameState.aiCountries.forEach((country) => {
      this.runCountryTick(country);
    });
    this.scheduleOperationalTick();
  }

  tickStrategic() {
    this.gameState.aiCountries.forEach((countryName) => {
      this.evaluateStrategicState(countryName);
    });
    refreshCountryHud();
    this.scheduleStrategicTick();
  }

  ensureAiState(countryName) {
    if (!this.gameState.aiStateByCountry[countryName]) {
      this.gameState.aiStateByCountry[countryName] = {
        posture: 'build_up',
        strategicGoal: 'build_up',
        strategicReason: 'Initial strategic posture.',
        goalScore: 0,
        lastStrategicTickAt: 0,
        lastGoalChangeAt: 0,
        lastPostureChangeAt: 0,
        lastPolicyChangeAt: 0,
        lastDiplomacyActionAt: 0,
        lastStrategicAnnouncementAt: 0,
        lastActionAtByType: {},
        lastActionSignatureByType: {},
        focusRival: null,
        notes: 'Initial posture',
        evaluation: null
      };
    }
    return this.gameState.aiStateByCountry[countryName];
  }

  onLeadershipTurnover(countryName, source = 'turnover') {
    const state = this.ensureAiState(countryName);
    state.strategicGoal = 'stabilize_domestic';
    state.posture = 'stabilize';
    state.strategicReason = `Leadership reset (${source}) shifted priorities to domestic stabilization.`;
    state.lastGoalChangeAt = this.gameState.currentTimeMs;
    state.lastPostureChangeAt = this.gameState.currentTimeMs;
  }

  evaluateStrategicState(countryName) {
    const state = this.ensureAiState(countryName);
    const now = this.gameState.currentTimeMs;
    const evaluation = this.evaluateCountryGeopolitics(countryName);
    state.evaluation = evaluation;
    state.lastStrategicTickAt = now;

    const nextGoal = this.selectStrategicGoal(state, evaluation, now);
    if (nextGoal.goal !== state.strategicGoal) {
      state.strategicGoal = nextGoal.goal;
      state.goalScore = nextGoal.score;
      state.strategicReason = nextGoal.reason;
      state.lastGoalChangeAt = now;
      state.notes = `Strategic shift to ${nextGoal.goal}: ${nextGoal.reason}`;
      if (now - state.lastStrategicAnnouncementAt >= AI_CONFIG.strategicAnnouncementCooldownMs) {
        setStatus(`AI strategic shift: ${countryName} -> ${nextGoal.goal}`);
        state.lastStrategicAnnouncementAt = now;
      }
    }

    const nextPosture = this.mapGoalToOperationalPosture(state.strategicGoal, evaluation);
    if (nextPosture !== state.posture && now - state.lastPostureChangeAt >= AI_CONFIG.postureCooldownMs) {
      state.posture = nextPosture;
      state.lastPostureChangeAt = now;
    }

    if (now - state.lastPolicyChangeAt >= AI_CONFIG.policyCooldownMs) {
      const nextPolicy = this.buildPolicyForGoal(state.strategicGoal, evaluation.country);
      const changed = evaluation.country.policy.militarySpendingLevel !== nextPolicy.militarySpendingLevel
        || evaluation.country.policy.industryInvestmentLevel !== nextPolicy.industryInvestmentLevel
        || evaluation.country.policy.internalSecurityLevel !== nextPolicy.internalSecurityLevel;
      if (changed) {
        this.policySystem.setPolicyBundle(countryName, nextPolicy);
        state.lastPolicyChangeAt = now;
      }
    }

    this.applyStrategicActions(countryName, state, evaluation, now);
  }

  evaluateCountryGeopolitics(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    const relations = this.diplomacySystem.getRelationsForCountry(countryName);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const wars = relations.filter((r) => r.status === 'war');
    const hostiles = relations.filter((r) => r.status === 'hostile' || r.relationScore < -45);
    const blocs = this.blocSystem.getCountryBlocs(countryName);
    const activeEvents = this.eventSystem.getActiveEventsForCountry(countryName);
    const borderIncidentCount = activeEvents.filter((event) => event.type === 'border_incident').length;

    const importFlows = this.gameState.trade.flows.filter((flow) => flow.active
      && flow.importerCountryId === countryName
      && flow.flowAmount > 0.05);
    const exportFlows = this.gameState.trade.flows.filter((flow) => flow.active
      && flow.exporterCountryId === countryName
      && flow.flowAmount > 0.05);
    const oilImport = importFlows.filter((flow) => flow.resourceType === 'oil').reduce((sum, flow) => sum + flow.flowAmount, 0);
    const oilNeed = country.tradeBalance?.oil?.need || 0;
    const oilDeficit = country.tradeBalance?.oil?.deficit || 0;
    const industryDeficit = country.tradeBalance?.industry_support?.deficit || 0;
    const importDependencyRatio = oilNeed > 0.1 ? Math.min(1.5, oilImport / oilNeed) : 0;

    const vulnerableImportFlows = importFlows.filter((flow) => {
      const route = this.chokepointSystem.getRouteEfficiency(flow);
      return route.efficiency < 0.85 || String(route.reason || '').startsWith('chokepoint_blocked');
    });
    const chokepointDependent = importFlows.filter((flow) => flow.requiredChokepoints?.length).length;
    const chokepointPressure = vulnerableImportFlows.length + pressure.blockedTradeCount;

    const sanctionsSent = relations.reduce((count, relation) => {
      const directional = this.diplomacySystem.getDirectionalPressure(countryName, relation.counterpart);
      return count + ((directional.sanctionsLevel && directional.sanctionsLevel !== 'none') ? 1 : 0);
    }, 0);

    const supplierCountries = [...new Set(importFlows.map((flow) => flow.exporterCountryId))];
    const keyTradePartners = supplierCountries
      .map((name) => ({
        name,
        deliveredOil: importFlows.filter((flow) => flow.exporterCountryId === name && flow.resourceType === 'oil').reduce((sum, flow) => sum + flow.flowAmount, 0)
      }))
      .sort((a, b) => b.deliveredOil - a.deliveredOil);

    const strongestRival = [...relations]
      .filter((relation) => relation.counterpart)
      .sort((a, b) => a.relationScore - b.relationScore)[0] || null;

    let rivalCountry = null;
    let rivalBlocSize = 0;
    let rivalCrisisPressure = 0;
    if (strongestRival?.counterpart) {
      rivalCountry = this.countrySystem.ensureCountry(strongestRival.counterpart);
      rivalBlocSize = this.blocSystem.getCountryBlocs(strongestRival.counterpart)
        .reduce((sum, bloc) => sum + bloc.memberCountryIds.length, 0);
      rivalCrisisPressure = this.eventSystem.getActiveEventsForCountry(strongestRival.counterpart).length;
    }

    const strengthScore = country.stability + country.industrialCapacity + (country.treasury / 120) + (country.manpowerPool / 220) - country.economicStress - country.warWeariness;

    const foreignProfile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getForeignPolicyBias(country)
      : {
        escalationBias: 0,
        deescalationBias: 1,
        sanctionsBias: 1,
        blocAffinity: 1,
        tradePreservationBias: 1,
        hostilityPersistence: 1
      };
    const domesticProfile = this.governmentProfileSystem
      ? this.governmentProfileSystem.getDomesticModifiers(country)
      : { warWearinessDriftMult: 1 };
    const leadershipPressure = Math.max(0, 60 - (country.leaderMandate || 0)) * 0.6
      + Math.max(0, 60 - (country.leaderApproval || 0)) * 0.55
      + Math.max(0, 55 - (country.governmentContinuity || 0)) * 0.7;
    const resistanceScore = (country.insurgencyPressure || 0) * 0.62 + (country.separatistPressure || 0) * 0.38;
    const leadershipWeak = leadershipPressure >= 35;
    const recentTurnover = (this.gameState.currentTimeMs - (country.lastTurnoverAt || 0)) <= 120 * DAY_MS;

    const rivalStrengthScore = rivalCountry
      ? (rivalCountry.stability + rivalCountry.industrialCapacity + (rivalCountry.treasury / 120) + (rivalCountry.manpowerPool / 220) - rivalCountry.economicStress)
      : 0;

    return {
      country,
      relations,
      pressure,
      wars,
      hostiles,
      blocs,
      activeEvents,
      borderIncidentCount,
      importFlows,
      exportFlows,
      keyTradePartners,
      strongestRival,
      sanctionsSent,
      metrics: {
        oilDeficit,
        industryDeficit,
        importDependencyRatio,
        chokepointDependent,
        chokepointPressure,
        vulnerableImportFlowCount: vulnerableImportFlows.length,
        activeCrisisCount: activeEvents.length,
        treasuryLow: country.treasury < 1100,
        domesticStrain: country.stability < 42 || country.unrest > 58 || country.economicStress > 60 || country.legitimacy < 45 || country.publicSupport < 43,
        severeWarFatigue: country.warWeariness > (58 / (domesticProfile.warWearinessDriftMult || 1)) || (country.warWeariness > 48 && country.economicStress > 55) || country.publicSupport < 35,
        isolated: blocs.length === 0,
        rivalBlocSize,
        rivalCrisisPressure,
        strengthDelta: strengthScore - rivalStrengthScore,
        politicalWeakness: country.legitimacy < 40 || country.publicSupport < 38 || country.eliteSupport < 36,
        narrativeCrisis: country.domesticNarrativePressure > 68,
        internalResistanceSevere: resistanceScore > 58 || (country.stateControl || 70) < 45,
        stateControlWeak: (country.stateControl || 70) < 55,
        reputationCrisis: country.internationalReputation < -45,
        reputationStrong: country.internationalReputation > 35,
        leadershipPressure,
        leadershipWeak,
        recentTurnover
      },
      profile: {
        foreign: foreignProfile,
        domestic: domesticProfile
      }
    };
  }

  selectStrategicGoal(state, evaluation, now) {
    const { country, wars, hostiles, pressure, strongestRival, metrics, profile } = evaluation;
    const scores = {
      stabilize_domestic: 8,
      secure_resources: 8,
      protect_trade: 8,
      join_or_strengthen_bloc: 7,
      isolate_rival: 6,
      pressure_rival: 6,
      deescalate_conflict: 7,
      expand_influence: 7,
      defend_chokepoints: 6
    };
    const reasons = {};

    scores.protect_trade += (profile.foreign.tradePreservationBias - 1) * 22;
    scores.join_or_strengthen_bloc += (profile.foreign.blocAffinity - 1) * 18;
    scores.deescalate_conflict += (profile.foreign.deescalationBias - 1) * 26;
    scores.pressure_rival += profile.foreign.escalationBias * 20;
    scores.isolate_rival += (profile.foreign.sanctionsBias - 1) * 18;


    if (metrics.narrativeCrisis) {
      scores.stabilize_domestic += 34;
      scores.deescalate_conflict += 22;
      scores.pressure_rival -= 18;
      reasons.stabilize_domestic = 'Domestic narrative pressure is severe and politically costly.';
    }
    if (metrics.reputationCrisis) {
      scores.join_or_strengthen_bloc -= 16;
      scores.expand_influence -= 18;
      scores.pressure_rival += profile.foreign.escalationBias > 0 ? 4 : -6;
      scores.deescalate_conflict += 16;
      scores.secure_resources += 8;
    }
    if (metrics.reputationStrong) {
      scores.join_or_strengthen_bloc += 14;
      scores.deescalate_conflict += 10;
      scores.expand_influence += 10;
    }
    if (metrics.domesticStrain) {
      scores.stabilize_domestic += 45;
      reasons.stabilize_domestic = 'Domestic stability, unrest, or economic stress is elevated.';
    }
    if (metrics.internalResistanceSevere) {
      scores.stabilize_domestic += 52;
      scores.deescalate_conflict += 20;
      scores.pressure_rival -= 20;
      reasons.stabilize_domestic = 'Insurgency/separatist pressure is threatening state control.';
    }
    if (metrics.stateControlWeak) {
      scores.stabilize_domestic += 28;
      scores.protect_trade -= 8;
      scores.expand_influence -= 12;
    }
    if (metrics.politicalWeakness) {
      scores.stabilize_domestic += 24;
      scores.deescalate_conflict += 18;
      reasons.stabilize_domestic = 'Domestic political legitimacy/support is weak.';
    }
    if (metrics.leadershipWeak) {
      scores.stabilize_domestic += 38;
      scores.deescalate_conflict += 24;
      scores.pressure_rival -= 24;
      scores.expand_influence -= 10;
      reasons.stabilize_domestic = 'Leadership mandate and approval are under pressure.';
    }
    if (metrics.recentTurnover) {
      scores.stabilize_domestic += 20;
      scores.deescalate_conflict += 16;
      scores.isolate_rival -= 8;
    }
    if (metrics.severeWarFatigue) {
      scores.deescalate_conflict += 55;
      reasons.deescalate_conflict = 'War weariness and economic strain favor de-escalation.';
    }
    if (metrics.oilDeficit > 6 || country.oil < 85 || metrics.importDependencyRatio > 0.75) {
      scores.secure_resources += 42;
      reasons.secure_resources = 'Oil security is fragile due to deficit, low stock, or import dependence.';
    }
    if (metrics.chokepointDependent > 0) {
      scores.protect_trade += 20;
      reasons.protect_trade = 'National trade relies on vulnerable routes.';
    }
    if (metrics.chokepointPressure > 0) {
      scores.defend_chokepoints += 40;
      reasons.defend_chokepoints = 'Chokepoint restrictions are pressuring imports.';
      scores.protect_trade += 15;
    }
    if (pressure.incomingCount > 0 || pressure.blockedTradeCount > 0) {
      scores.secure_resources += 18;
      scores.protect_trade += 16;
    }
    if (metrics.activeCrisisCount > 0) {
      scores.stabilize_domestic += 18;
      scores.deescalate_conflict += 10;
    }
    if (metrics.isolated && (hostiles.length > 0 || strongestRival?.relationScore < -30)) {
      scores.join_or_strengthen_bloc += 38;
      reasons.join_or_strengthen_bloc = 'Isolation and threat pressure favor bloc cooperation.';
    }
    if (metrics.rivalBlocSize >= 4) {
      scores.deescalate_conflict += 12;
      scores.join_or_strengthen_bloc += 14;
    }
    if (metrics.strengthDelta > 26 && !metrics.domesticStrain && !metrics.severeWarFatigue && strongestRival && strongestRival.relationScore < -20) {
      scores.pressure_rival += 34;
      scores.isolate_rival += 24;
      reasons.pressure_rival = 'Relative strength advantage supports coercive pressure.';
    }
    if (metrics.strengthDelta > 22 && metrics.rivalCrisisPressure > 0 && !wars.length) {
      scores.expand_influence += 30;
      reasons.expand_influence = 'Rival crises create opportunities for influence gains.';
    }
    if (wars.length > 0 && !metrics.severeWarFatigue && country.stability > 52 && country.treasury > 1800) {
      scores.pressure_rival += 12;
    }

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [candidateGoal, candidateScore] = ranked[0];
    const [secondGoal, secondScore] = ranked[1] || [candidateGoal, candidateScore];

    const minDurationMet = now - state.lastGoalChangeAt >= AI_CONFIG.strategicGoalMinDurationMs;
    const emergencyOverride = metrics.severeWarFatigue || (metrics.domesticStrain && country.stability < 30);

    if (!state.strategicGoal || state.strategicGoal === 'build_up') {
      return {
        goal: candidateGoal,
        score: candidateScore,
        reason: reasons[candidateGoal] || `Selected for current pressure mix (${candidateScore.toFixed(0)}).`
      };
    }

    if (!minDurationMet && !emergencyOverride) {
      const currentScore = scores[state.strategicGoal] || 0;
      const shouldHold = candidateGoal !== state.strategicGoal && (candidateScore - currentScore) < AI_CONFIG.strategicGoalShiftMargin;
      if (shouldHold) {
        return {
          goal: state.strategicGoal,
          score: currentScore,
          reason: state.strategicReason || `Maintaining ${state.strategicGoal} to avoid oscillation.`
        };
      }
    }

    if (candidateGoal !== state.strategicGoal && secondGoal === state.strategicGoal && (candidateScore - secondScore) < AI_CONFIG.strategicGoalShiftMargin) {
      return {
        goal: state.strategicGoal,
        score: secondScore,
        reason: state.strategicReason || `Maintaining ${state.strategicGoal} due to close strategic scores.`
      };
    }

    return {
      goal: candidateGoal,
      score: candidateScore,
      reason: reasons[candidateGoal] || `Selected for current pressure mix (${candidateScore.toFixed(0)}).`
    };
  }

  mapGoalToOperationalPosture(goal, evaluation) {
    if (goal === 'deescalate_conflict') return 'seek_peace';
    if (goal === 'stabilize_domestic' || goal === 'secure_resources' || goal === 'protect_trade') return 'stabilize';
    if (goal === 'join_or_strengthen_bloc' || goal === 'defend_chokepoints') return 'defend';
    if (goal === 'pressure_rival' || goal === 'isolate_rival') return 'pressure_rival';
    if (goal === 'expand_influence' && evaluation.country.stability > 55) return 'expand';
    return 'build_up';
  }

  buildPolicyForGoal(goal, country) {
    const foreign = this.governmentProfileSystem ? this.governmentProfileSystem.getForeignPolicyBias(country) : { escalationBias: 0 };
    const domestic = this.governmentProfileSystem ? this.governmentProfileSystem.getDomesticModifiers(country) : { securitySuppressionMult: 1 };
    const weakMandate = country.leaderMandate < 42 || country.leaderApproval < 44 || country.governmentContinuity < 40;
    if (goal === 'deescalate_conflict' || goal === 'stabilize_domestic') {
      return {
        militarySpendingLevel: country.treasury < 1500 || weakMandate ? 'low' : 'normal',
        industryInvestmentLevel: country.economicStress > 58 ? 'low' : 'normal',
        internalSecurityLevel: (country.insurgencyPressure > 45 || country.stateControl < 58 || domestic.securitySuppressionMult > 1.15) ? 'high' : 'normal'
      };
    }
    if (goal === 'secure_resources' || goal === 'protect_trade') {
      return {
        militarySpendingLevel: country.warWeariness > 45 ? 'low' : 'normal',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: 'normal'
      };
    }
    if (goal === 'join_or_strengthen_bloc') {
      return {
        militarySpendingLevel: 'normal',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: country.unrest > 40 ? 'high' : 'normal'
      };
    }
    if (goal === 'pressure_rival' || goal === 'isolate_rival' || goal === 'defend_chokepoints') {
      return {
        militarySpendingLevel: weakMandate ? 'normal' : (foreign.escalationBias > 0 ? 'high' : 'normal'),
        industryInvestmentLevel: country.treasury > 2600 ? 'high' : 'normal',
        internalSecurityLevel: weakMandate ? 'high' : 'normal'
      };
    }
    if (goal === 'expand_influence') {
      return {
        militarySpendingLevel: 'normal',
        industryInvestmentLevel: country.treasury > 2200 ? 'high' : 'normal',
        internalSecurityLevel: 'normal'
      };
    }
    return {
      militarySpendingLevel: 'normal',
      industryInvestmentLevel: 'normal',
      internalSecurityLevel: 'normal'
    };
  }

  applyStrategicActions(countryName, state, evaluation, now) {
    const { strongestRival, keyTradePartners, metrics, relations, country } = evaluation;
    if (!strongestRival?.counterpart) return;
    state.focusRival = strongestRival.counterpart;

    if (state.strategicGoal === 'deescalate_conflict') {
      const activeWar = evaluation.wars[0];
      if (activeWar?.counterpart) {
        this.performStrategicAction(state, now, 'deescalate', `ceasefire:${activeWar.counterpart}`, () => {
          if (this.negotiationSystem) {
            this.negotiationSystem.setCeasefire(countryName, activeWar.counterpart, 25);
          } else {
            this.diplomacySystem.makePeace(countryName, activeWar.counterpart, `${countryName} de-escalated under domestic strain.`);
          }
        });
      }
      this.performStrategicAction(state, now, 'sanctions_relief', `lift:${strongestRival.counterpart}`, () => {
        if (this.negotiationSystem) this.negotiationSystem.applySanctionsRelief(countryName, strongestRival.counterpart);
        else this.diplomacySystem.liftSanctions(countryName, strongestRival.counterpart);
      });
      return;
    }

    if (state.strategicGoal === 'stabilize_domestic') {
      if (strongestRival.relationScore < -35 && strongestRival.status !== 'war') {
        this.performStrategicAction(state, now, 'border_deescalation', `border:${strongestRival.counterpart}`, () => {
          if (this.negotiationSystem) this.negotiationSystem.applyBorderDeEscalation(countryName, strongestRival.counterpart);
          else this.diplomacySystem.adjustRelationScore(countryName, strongestRival.counterpart, 6, `${countryName} de-escalation posture`);
        });
      }
      return;
    }

    if (state.strategicGoal === 'secure_resources' || state.strategicGoal === 'protect_trade') {
      const topSupplier = keyTradePartners[0]?.name;
      if (topSupplier) {
        this.performStrategicAction(state, now, 'trade_restore', `restore:${topSupplier}`, () => {
          if (this.negotiationSystem) this.negotiationSystem.restoreTemporaryTrade(countryName, topSupplier, 45);
          else this.diplomacySystem.setTradeAllowed(countryName, topSupplier, true);
        });
        this.performStrategicAction(state, now, 'improve_supplier', `relation:${topSupplier}`, () => {
          this.diplomacySystem.adjustRelationScore(countryName, topSupplier, 5, `${countryName} sought resource security.`);
        });
      }
      return;
    }

    if (state.strategicGoal === 'join_or_strengthen_bloc') {
      const ownBlocs = this.blocSystem.getCountryBlocs(countryName);
      if (!ownBlocs.length) {
        const preferredBloc = this.selectBlocToJoin(countryName, relations);
        if (preferredBloc) {
          this.performStrategicAction(state, now, 'join_bloc', `join:${preferredBloc.id}`, () => {
            this.blocSystem.joinBloc(preferredBloc.id, countryName);
          });
        }
      } else {
        const partner = relations.find((relation) => relation.relationScore > 20 && !this.blocSystem.areInSameBloc(countryName, relation.counterpart));
        if (partner) {
          this.performStrategicAction(state, now, 'cohesion_diplomacy', `cohesion:${partner.counterpart}`, () => {
            this.diplomacySystem.adjustRelationScore(countryName, partner.counterpart, 4, `${countryName} pursued bloc cohesion.`);
          });
        }
      }
      return;
    }

    if (state.strategicGoal === 'defend_chokepoints') {
      const controlledPoint = this.gameState.chokepoints.points.find((cp) => cp.controllingCountryId === countryName);
      if (controlledPoint && controlledPoint.openState !== 'open' && country.stability > 35) {
        this.performStrategicAction(state, now, 'reopen_chokepoint', `chokepoint:${controlledPoint.id}`, () => {
          this.chokepointSystem.setOpenState(controlledPoint.id, 'open', 'ai_route_stabilization');
        });
      }
      return;
    }

    if (state.strategicGoal === 'isolate_rival' || state.strategicGoal === 'pressure_rival') {
      const foreign = this.governmentProfileSystem
        ? this.governmentProfileSystem.getForeignPolicyBias(country)
        : { sanctionsBias: 1, escalationBias: 0 };
      const rivalName = strongestRival.counterpart;
      this.performStrategicAction(state, now, 'sanction_rival', `sanction:${rivalName}`, () => {
        const level = foreign.sanctionsBias > 1.15 || strongestRival.relationScore < -60 ? 'heavy' : 'light';
        this.diplomacySystem.imposeSanctions(countryName, rivalName, level);
      });
      if (metrics.strengthDelta > (foreign.escalationBias > 0 ? 10 : 16)) {
        this.performStrategicAction(state, now, 'harden_relations', `harden:${rivalName}`, () => {
          this.diplomacySystem.adjustRelationScore(countryName, rivalName, -6, `${countryName} strategic pressure campaign`, true);
        });
      }
      return;
    }

    if (state.strategicGoal === 'expand_influence') {
      const candidate = relations
        .filter((relation) => relation.counterpart !== strongestRival.counterpart && relation.relationScore >= -15 && relation.status !== 'war')
        .sort((a, b) => a.relationScore - b.relationScore)[0];
      if (candidate) {
        this.performStrategicAction(state, now, 'influence_push', `influence:${candidate.counterpart}`, () => {
          this.diplomacySystem.adjustRelationScore(countryName, candidate.counterpart, 7, `${countryName} expanded diplomatic influence.`);
        });
      }
    }
  }

  performStrategicAction(state, now, actionType, signature, actionFn) {
    const lastActionAt = state.lastActionAtByType[actionType] || 0;
    const lastSignature = state.lastActionSignatureByType[actionType] || null;
    if (lastSignature === signature && now - lastActionAt < AI_CONFIG.strategicActionCooldownMs) return false;
    if (now - lastActionAt < AI_CONFIG.strategicActionCooldownMs) return false;
    actionFn();
    state.lastActionAtByType[actionType] = now;
    state.lastActionSignatureByType[actionType] = signature;
    state.lastDiplomacyActionAt = now;
    return true;
  }

  selectBlocToJoin(countryName, relations) {
    const activeBlocs = this.gameState.blocs.items.filter((bloc) => bloc.active && !bloc.memberCountryIds.includes(countryName));
    if (!activeBlocs.length) return null;
    const relationMap = new Map(relations.map((relation) => [relation.counterpart, relation.relationScore]));
    const ranked = activeBlocs
      .map((bloc) => {
        const affinity = bloc.memberCountryIds.reduce((sum, member) => sum + (relationMap.get(member) || 0), 0);
        return { bloc, score: affinity + bloc.memberCountryIds.length * 3 };
      })
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.score > 0 ? ranked[0].bloc : null;
  }

  runCountryTick(country) {
    const aiState = this.ensureAiState(country);
    const posture = aiState.posture;
    const strategicGoal = aiState.strategicGoal;
    const aiBases = this.gameState.bases.filter((b) => b.ownerCountry === country && b.status === 'active' && b.combatStatus !== 'destroyed');
    const aiUnits = this.gameState.units.filter((u) => u.ownerCountry === country && u.status === 'active');
    const relations = this.diplomacySystem.getRelationsForCountry(country);
    const warCountries = new Set(relations.filter((relation) => relation.status === 'war').map((relation) => relation.counterpart));
    const tradePartners = new Set(this.gameState.trade.flows
      .filter((flow) => flow.active && (flow.exporterCountryId === country || flow.importerCountryId === country))
      .map((flow) => (flow.exporterCountryId === country ? flow.importerCountryId : flow.exporterCountryId)));
    const countryState = this.countrySystem.ensureCountry(country);
    const leadershipCaution = countryState.leaderMandate < 42 || countryState.leaderApproval < 44 || countryState.governmentContinuity < 38;
    const canGoOffensive = (!leadershipCaution && ['expand', 'pressure_rival'].includes(posture)) || warCountries.size > 0;
    const cautiousTradeGoals = ['secure_resources', 'protect_trade', 'deescalate_conflict', 'stabilize_domestic'].includes(strategicGoal);
    const targetFilter = (ownerCountry) => {
      if (ownerCountry === country) return false;
      if (cautiousTradeGoals && tradePartners.has(ownerCountry) && !warCountries.has(ownerCountry)) return false;
      return canGoOffensive || warCountries.has(ownerCountry);
    };

    const enemyCities = this.gameState.cities.filter((c) => targetFilter(c.ownerCountry) && c.status !== 'destroyed');
    const enemyBases = this.gameState.bases.filter((b) => targetFilter(b.ownerCountry) && b.combatStatus !== 'destroyed');
    const enemyUnits = this.gameState.units.filter((u) => targetFilter(u.ownerCountry) && u.status !== 'destroyed');
    const lowOil = countryState.oil < 70;
    const lowManpower = countryState.manpowerPool < 1600;

    aiBases.forEach((base) => {
      if (base.production.currentUnitId || base.production.queue.length) return;
      let options = this.productionSystem.getAllowedUnitsForBase(base).sort((a, b) => (ECONOMY_CONFIG.unitBuildCost[a.key] || 0) - (ECONOMY_CONFIG.unitBuildCost[b.key] || 0));
      if (lowOil || strategicGoal === 'secure_resources') options = options.filter((option) => (this.resourceSystem.getUnitResourceCost(option.key).oil || 0) < 25);
      if (lowManpower || posture === 'stabilize') options = options.filter((option) => (this.resourceSystem.getUnitResourceCost(option.key).manpower || 0) <= 220);
      if (posture === 'defend') options = options.filter((option) => option.domain !== 'air');
      if (strategicGoal === 'defend_chokepoints') options = options.sort((a, b) => (a.domain === 'naval' ? -1 : 1) - (b.domain === 'naval' ? -1 : 1));
      for (const option of options) {
        const result = this.productionSystem.queueUnit(base.id, option.key, country);
        if (result.ok) break;
      }
    });

    aiUnits.forEach((unit) => {
      if (unit.movement || unit.captureTarget || unit.combatStatus === 'attacking' || unit.combatStatus === 'defending') return;
      if ((posture === 'stabilize' || posture === 'seek_peace') && !warCountries.size) return;

      const capturableCity = enemyCities.find((city) => this.distanceKm(unit, city.lonLat) <= CAPTURE_CONFIG.captureRangeKm && unit.domain === 'ground');
      if (capturableCity && canGoOffensive) {
        this.captureSystem.startCapture(unit.id, 'city', capturableCity.id, true);
        return;
      }
      const capturableBase = enemyBases.find((base) => this.distanceKm(unit, base.lonLat) <= CAPTURE_CONFIG.captureRangeKm && unit.domain === 'ground');
      if (capturableBase && canGoOffensive) {
        this.captureSystem.startCapture(unit.id, 'base', capturableBase.id, true);
        return;
      }

      const attackableUnit = enemyUnits.find((target) => this.distanceKm(unit, this.movementSystem.getDisplayLonLat(target)) <= unit.rangeKm);
      if (attackableUnit) {
        this.combatSystem.startAttack(unit.id, 'unit', attackableUnit.id, false, true);
        return;
      }
      const attackableBase = enemyBases.find((target) => this.distanceKm(unit, target.lonLat) <= unit.rangeKm);
      if (attackableBase) {
        this.combatSystem.startAttack(unit.id, 'base', attackableBase.id, false, true);
        return;
      }

      const nearestTarget = this.findNearestTargetLonLat(unit, [...enemyCities.map((c) => c.lonLat), ...enemyBases.map((b) => b.lonLat)]);
      if (nearestTarget && (canGoOffensive || warCountries.size)) {
        this.movementSystem.issueMoveOrder(unit.id, nearestTarget, true);
      }
    });

    if (posture !== 'seek_peace' && posture !== 'stabilize'
      && aiBases.length < AI_CONFIG.baseThreshold
      && this.economySystem.getTreasury(country) >= AI_CONFIG.baseExpansionTreasury
      && countryState.manpowerPool > 1500
      && strategicGoal !== 'secure_resources') {
      const ownedCity = this.gameState.cities.find((city) => city.ownerCountry === country);
      if (ownedCity && this.economySystem.spend(country, ECONOMY_CONFIG.baseBuildCost.ground, 'AI base expansion')) {
        const lonLat = [ownedCity.lonLat[0] + 1.5, ownedCity.lonLat[1] + 1];
        const base = createBase('ground', lonLat, country);
        base.status = 'active';
        base.buildCompleteAt = this.gameState.currentTimeMs;
      }
    }
  }

  distanceKm(unit, lonLat) {
    return d3.geoDistance(this.movementSystem.getDisplayLonLat(unit), lonLat) * 6371;
  }

  findNearestTargetLonLat(unit, targetLonLats) {
    if (!targetLonLats.length) return null;
    let best = targetLonLats[0];
    let bestDistance = this.distanceKm(unit, best);
    for (const target of targetLonLats.slice(1)) {
      const d = this.distanceKm(unit, target);
      if (d < bestDistance) {
        bestDistance = d;
        best = target;
      }
    }
    return best;
  }
}
