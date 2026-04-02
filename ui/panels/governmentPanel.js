window.createGovernmentPanelController = function createGovernmentPanelController(scope) {
  return (function buildGovernmentPanelController() {
    with (scope) {
  function refreshGovernmentProfileHud() {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      govProfileFocusCountry.textContent = 'Profile for: --';
      govProfileSummary.textContent = 'Government profile: --';
      govProfileHint.textContent = 'Profile effect: --';
      [regimeTypeSelect, economicOrientationSelect, foreignPolicyStyleSelect, applyGovernmentProfileBtn]
        .forEach((el) => { el.disabled = true; });
      return;
    }
  
    const country = countrySystem.ensureCountry(focusCountry);
    const profile = governmentProfileSystem.getProfile(country);
    govProfileFocusCountry.textContent = `Profile for: ${focusCountry}`;
    govProfileSummary.textContent = `Government profile: ${governmentProfileSystem.getProfileSummary(country)}`;
    govProfileHint.textContent = `Profile effect: ${governmentProfileSystem.getProfileHint(country)}`;
    regimeTypeSelect.value = profile.regimeType;
    economicOrientationSelect.value = profile.economicOrientation;
    foreignPolicyStyleSelect.value = profile.foreignPolicyStyle;
    [regimeTypeSelect, economicOrientationSelect, foreignPolicyStyleSelect, applyGovernmentProfileBtn]
      .forEach((el) => { el.disabled = false; });
  }

  function attachGovernmentProfileControls() {
    applyGovernmentProfileBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const country = countrySystem.ensureCountry(focusCountry);
      governmentProfileSystem.setCountryProfile(country, {
        regimeType: regimeTypeSelect.value,
        economicOrientation: economicOrientationSelect.value,
        foreignPolicyStyle: foreignPolicyStyleSelect.value
      });
      leadershipSystem.ensureLeadershipFields(country);
      leadershipSystem.scheduleNextElection(country);
      gameState.policy.lastSummary = `${focusCountry} profile set to ${governmentProfileSystem.getProfileSummary(country)}.`;
      setStatus(`Government profile updated for ${focusCountry}.`);
      refreshGovernmentProfileHud();
      refreshCountryHud();
      refreshPolicyHud();
      refreshDomesticHud();
      refreshDiplomacyHud();
      refreshTradeHud();
      refreshMigrationHud();
    });
  }

  function refreshPolicyHud() {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      policyFocusCountry.textContent = 'Policy for: --';
      policySummary.textContent = 'Policy: --';
      policyCostLabel.textContent = 'Daily policy cost: --';
      [militaryPolicySelect, industryPolicySelect, securityPolicySelect, applyPolicyBtn].forEach((el) => { el.disabled = true; });
      return;
    }
  
    const country = countrySystem.ensureCountry(focusCountry);
    policySystem.updateCountryPolicyCost(focusCountry);
    policyFocusCountry.textContent = `Policy for: ${focusCountry}`;
    policySummary.textContent = `Policy: ${gameState.policy.lastSummary}`;
    policyCostLabel.textContent = `Daily policy cost: ${Math.round(country.policyDailyCost)}`;
    militaryPolicySelect.value = country.policy.militarySpendingLevel;
    industryPolicySelect.value = country.policy.industryInvestmentLevel;
    securityPolicySelect.value = country.policy.internalSecurityLevel;
  
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    const editable = playerCountry && focusCountry === playerCountry;
    [militaryPolicySelect, industryPolicySelect, securityPolicySelect, applyPolicyBtn].forEach((el) => { el.disabled = !editable; });
  }

  function attachPolicyControls() {
    applyPolicyBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
      if (!focusCountry || !playerCountry || focusCountry !== playerCountry) {
        setStatus('Policies can only be changed for your selected country.', true);
        return;
      }
      policySystem.setPolicyBundle(focusCountry, {
        militarySpendingLevel: militaryPolicySelect.value,
        industryInvestmentLevel: industryPolicySelect.value,
        internalSecurityLevel: securityPolicySelect.value
      });
      setStatus(`Policy updated for ${focusCountry}.`);
      refreshPolicyHud();
      refreshCountryHud();
      refreshDomesticHud();
    });
  }

  function refreshDomesticHud() {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      domesticFocusCountry.textContent = 'Domestic state for: --';
      domesticStability.textContent = 'Stability: --';
      domesticUnrest.textContent = 'Unrest: --';
      domesticWarWeariness.textContent = 'War weariness: --';
      domesticEconomicStress.textContent = 'Economic stress: --';
      domesticLegitimacy.textContent = 'Legitimacy: --';
      domesticPublicSupport.textContent = 'Public support: --';
      domesticEliteSupport.textContent = 'Elite support: --';
      domesticPoliticalLabel.textContent = 'Political pressure: --';
      domesticTrend.textContent = 'Domestic trend: --';
      domesticLeaderApproval.textContent = 'Leader approval: --';
      domesticLeaderMandate.textContent = 'Leader mandate: --';
      domesticGovernmentContinuity.textContent = 'Government continuity: --';
      domesticElectionDate.textContent = 'Next election: --';
      domesticLeadershipLabel.textContent = 'Leadership status: --';
      domesticLeadershipSummary.textContent = 'Leadership cycle: --';
      leaderDisplayName.textContent = 'Leader: --';
      leaderArchetypeLabel.textContent = 'Archetype: --';
      leaderTraitRisk.textContent = 'Risk tolerance: --';
      leaderTraitRepression.textContent = 'Repression preference: --';
      leaderTraitEconomic.textContent = 'Economic competence: --';
      leaderTraitDiplomatic.textContent = 'Diplomatic flexibility: --';
      leaderTraitCrisis.textContent = 'Crisis management: --';
      leaderFlavorSummary.textContent = 'Leader flavor: --';
      leaderFlavorBio.textContent = 'Leader bio: --';
      leaderBehaviorExplanation.textContent = 'Leader explanation: --';
      leaderBehaviorHint.textContent = 'Leader bias: --';
      domesticFactionSummary.textContent = 'Faction pressure: --';
      domesticFactionBias.textContent = 'Faction policy bias: --';
      domesticFactionsList.innerHTML = '<li>No faction data.</li>';
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    leadershipSystem.ensureLeadershipFields(country);
    domesticFocusCountry.textContent = `Domestic state for: ${focusCountry}`;
    domesticStability.textContent = `Stability: ${country.stability.toFixed(1)} / 100`;
    domesticUnrest.textContent = `Unrest: ${country.unrest.toFixed(1)} / 100`;
    domesticWarWeariness.textContent = `War weariness: ${country.warWeariness.toFixed(1)} / 100`;
    domesticEconomicStress.textContent = `Economic stress: ${country.economicStress.toFixed(1)} / 100`;
    domesticLegitimacy.textContent = `Legitimacy: ${country.legitimacy.toFixed(1)} / 100`;
    domesticPublicSupport.textContent = `Public support: ${country.publicSupport.toFixed(1)} / 100`;
    domesticEliteSupport.textContent = `Elite support: ${country.eliteSupport.toFixed(1)} / 100`;
    domesticPoliticalLabel.textContent = `Political pressure: ${politicalSystem.getPoliticalLabel(country)}`;
    domesticLeaderApproval.textContent = `Leader approval: ${country.leaderApproval.toFixed(1)} / 100`;
    domesticLeaderMandate.textContent = `Leader mandate: ${country.leaderMandate.toFixed(1)} / 100`;
    domesticGovernmentContinuity.textContent = `Government continuity: ${country.governmentContinuity.toFixed(1)} / 100`;
    domesticElectionDate.textContent = leadershipSystem.usesElectionCycle(country) && country.nextElectionAt
      ? `Next election: ${formatDateTime(country.nextElectionAt)}`
      : 'Next election: n/a for current regime';
    domesticLeadershipLabel.textContent = `Leadership status: ${leadershipSystem.getLeadershipLabel(country)}`;
    domesticLeadershipSummary.textContent = `Leadership cycle: ${gameState.leadership.lastSummary}`;
    leaderDisplayName.textContent = `Leader: ${country.leaderName}`;
    leaderArchetypeLabel.textContent = `Archetype: ${country.leaderArchetype} (${country.leaderSummary})`;
    leaderTraitRisk.textContent = `Risk tolerance: ${country.leaderTraits.riskTolerance.toFixed(0)} / 100`;
    leaderTraitRepression.textContent = `Repression preference: ${country.leaderTraits.repressionPreference.toFixed(0)} / 100`;
    leaderTraitEconomic.textContent = `Economic competence: ${country.leaderTraits.economicCompetence.toFixed(0)} / 100`;
    leaderTraitDiplomatic.textContent = `Diplomatic flexibility: ${country.leaderTraits.diplomaticFlexibility.toFixed(0)} / 100`;
    leaderTraitCrisis.textContent = `Crisis management: ${country.leaderTraits.crisisManagement.toFixed(0)} / 100`;
    leaderFlavorSummary.textContent = `Leader flavor: ${country.leaderFlavor?.summary || '--'}`;
    leaderFlavorBio.textContent = `Leader bio: ${country.leaderFlavor?.bio || '--'}`;
    leaderBehaviorExplanation.textContent = `Leader explanation: ${country.leaderFlavor?.explanation || '--'}`;
    const bias = country.leaderBehaviorBias || {};
    leaderBehaviorHint.textContent = `Leader bias: escalation ${((bias.escalationBias || 0) * 100).toFixed(0)} • de-escalation ${((bias.deescalationBias || 0) * 100).toFixed(0)} • security ${((bias.internalSecurityBias || 0) * 100).toFixed(0)} • economic stabilization ${((bias.economicStabilizationBias || 0) * 100).toFixed(0)}`;
    leaderArchetypeSelect.value = country.leaderArchetype || 'pragmatist';
    factionSystem.ensureCountryFactions(country);
    const factionEffects = country.factionEffects || {};
    domesticFactionSummary.textContent = `Faction pressure: ${factionEffects.interpretation || 'balanced'}`;
    domesticFactionBias.textContent = `Faction policy bias: security ${((factionEffects.internalSecurityBias || 0) * 100).toFixed(0)} • war ${((factionEffects.warToleranceBias || 0) * 100).toFixed(0)} • de-escalation ${((factionEffects.deescalationBias || 0) * 100).toFixed(0)} • trade ${((factionEffects.tradeRestorationBias || 0) * 100).toFixed(0)}`;
    domesticFactionsList.innerHTML = '';
    Object.values(country.factions || {}).forEach((faction) => {
      const li = document.createElement('li');
      li.textContent = `${faction.id.replace(/_/g, ' ')} | influence ${faction.influence.toFixed(1)} | support ${faction.satisfaction.toFixed(1)} | direction ${faction.pressureDirection}`;
      domesticFactionsList.appendChild(li);
    });
    const trendLabel = country.stability >= 60 ? 'Stable' : (country.stability >= 35 ? 'Strained' : 'Fragile');
    const pressure = diplomacySystem.getEconomicPressureOnCountry(focusCountry);
    domesticTrend.textContent = `Domestic trend: ${trendLabel} • Output x${country.domesticOutputModifier.toFixed(2)} • Sanction sources ${pressure.incomingCount} • Policy effectiveness x${(country.politicalEffects?.policyEffectiveness || 1).toFixed(2)}`;
  }

  function attachLeadershipControls() {
    const mutateLeadership = (mutator, message) => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const country = countrySystem.ensureCountry(focusCountry);
      leadershipSystem.ensureLeadershipFields(country);
      mutator(country, focusCountry);
      refreshDomesticHud();
      refreshCountryHud();
      refreshPolicyHud();
      refreshDiplomacyHud();
      setStatus(message);
    };
  
    const mutateLeaderTrait = (trait, delta, label) => mutateLeadership((country, countryName) => {
      const current = country.leaderTraits?.[trait] ?? 50;
      leadershipSystem.setLeaderTrait(countryName, trait, current + delta);
    }, `${label} adjusted.`);
  
    leaderApprovalUpBtn.addEventListener('click', () => mutateLeadership((country) => {
      country.leaderApproval = Math.min(100, country.leaderApproval + 8);
    }, 'Leader approval increased.'));
    leaderApprovalDownBtn.addEventListener('click', () => mutateLeadership((country) => {
      country.leaderApproval = Math.max(0, country.leaderApproval - 8);
    }, 'Leader approval reduced.'));
    leaderMandateUpBtn.addEventListener('click', () => mutateLeadership((country) => {
      country.leaderMandate = Math.min(100, country.leaderMandate + 8);
    }, 'Leader mandate increased.'));
    leaderMandateDownBtn.addEventListener('click', () => mutateLeadership((country) => {
      country.leaderMandate = Math.max(0, country.leaderMandate - 8);
    }, 'Leader mandate reduced.'));
  
    triggerElectionCheckBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const result = leadershipSystem.evaluateElection(focusCountry, 'manual');
      if (!result || result.ok === false) {
        setStatus('Election check skipped: regime does not run standard elections.', true);
        return;
      }
      setStatus(result.type === 'turnover'
        ? `${focusCountry} election triggered turnover.`
        : `${focusCountry} election renewed mandate.`);
      refreshDomesticHud();
      refreshCountryHud();
    });
  
    triggerTurnoverBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      leadershipSystem.applyGovernmentTurnover(focusCountry, 'manual_override');
      setStatus(`Manual government turnover applied for ${focusCountry}.`);
      refreshDomesticHud();
      refreshCountryHud();
      refreshDiplomacyHud();
      refreshPolicyHud();
    });
  
    leaderRenameBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const nextName = leaderRenameInput.value.trim();
      if (!nextName) {
        setStatus('Enter a leader name first.', true);
        return;
      }
      const changed = leadershipSystem.renameLeader(focusCountry, nextName);
      if (!changed) {
        setStatus('Unable to rename leader.', true);
        return;
      }
      setStatus(`${focusCountry} leader renamed to ${nextName}.`);
      refreshDomesticHud();
    });
  
    leaderRegenerateBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const result = leadershipSystem.regenerateLeader(focusCountry);
      setStatus(result?.message || 'Leader regenerated.');
      refreshDomesticHud();
      refreshCountryHud();
    });
  
    leaderRefreshFlavorBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const result = leadershipSystem.regenerateLeaderFlavor(focusCountry);
      setStatus(result?.message || 'Leader flavor refreshed.');
      refreshDomesticHud();
    });
  
    leaderRerollIdentityBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const result = leadershipSystem.regenerateLeaderFlavor(focusCountry, { rerollNameOnly: true });
      setStatus(result?.message || 'Leader identity rerolled.');
      refreshDomesticHud();
      refreshCountryHud();
    });
  
    leaderApplyArchetypeBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const archetype = leaderArchetypeSelect.value || 'pragmatist';
      const result = leadershipSystem.regenerateLeader(focusCountry, { archetype });
      setStatus(result?.message || `Leader archetype changed to ${archetype}.`);
      refreshDomesticHud();
      refreshCountryHud();
    });
  
    leaderRiskUpBtn.addEventListener('click', () => mutateLeaderTrait('riskTolerance', 8, 'Leader risk tolerance'));
    leaderRiskDownBtn.addEventListener('click', () => mutateLeaderTrait('riskTolerance', -8, 'Leader risk tolerance'));
    leaderRepressionUpBtn.addEventListener('click', () => mutateLeaderTrait('repressionPreference', 8, 'Leader repression preference'));
    leaderRepressionDownBtn.addEventListener('click', () => mutateLeaderTrait('repressionPreference', -8, 'Leader repression preference'));
    leaderEconomicUpBtn.addEventListener('click', () => mutateLeaderTrait('economicCompetence', 8, 'Leader economic competence'));
    leaderEconomicDownBtn.addEventListener('click', () => mutateLeaderTrait('economicCompetence', -8, 'Leader economic competence'));
    leaderDiplomaticUpBtn.addEventListener('click', () => mutateLeaderTrait('diplomaticFlexibility', 8, 'Leader diplomatic flexibility'));
    leaderDiplomaticDownBtn.addEventListener('click', () => mutateLeaderTrait('diplomaticFlexibility', -8, 'Leader diplomatic flexibility'));
  
    applyElectionOffsetBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const days = Math.max(1, Number(electionOffsetDaysInput.value) || 30);
      const changed = leadershipSystem.setElectionOffsetDays(focusCountry, days);
      if (!changed) {
        setStatus('Election timing update not available for this regime.', true);
        return;
      }
      setStatus(`Election timing moved to ${days} days from now for ${focusCountry}.`);
      refreshDomesticHud();
    });
  }

  function attachFactionControls() {
    const mutateFaction = (mutator, message) => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const country = countrySystem.ensureCountry(focusCountry);
      factionSystem.ensureCountryFactions(country);
      mutator(country, focusCountry);
      country.factionEffects = factionSystem.computePressure(country);
      refreshDomesticHud();
      setStatus(message);
    };
  
    factionInfluenceUpBtn.addEventListener('click', () => mutateFaction((country) => {
      country.factions.security_elite.influence = factionSystem.clamp(country.factions.security_elite.influence + 8);
    }, 'Security-elite influence increased.'));
    factionInfluenceDownBtn.addEventListener('click', () => mutateFaction((country) => {
      country.factions.security_elite.influence = factionSystem.clamp(country.factions.security_elite.influence - 8);
    }, 'Security-elite influence reduced.'));
    factionSatisfactionUpBtn.addEventListener('click', () => mutateFaction((country) => {
      country.factions.public_civic_pressure.satisfaction = factionSystem.clamp(country.factions.public_civic_pressure.satisfaction + 8);
    }, 'Public/civic support increased.'));
    factionSatisfactionDownBtn.addEventListener('click', () => mutateFaction((country) => {
      country.factions.public_civic_pressure.satisfaction = factionSystem.clamp(country.factions.public_civic_pressure.satisfaction - 8);
    }, 'Public/civic support reduced.'));
    triggerFactionShiftBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      factionSystem.triggerPressureShift(focusCountry);
      refreshDomesticHud();
      setStatus(`Faction pressure shift triggered for ${focusCountry}.`);
    });
    resetFactionStateBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      factionSystem.resetCountryFactions(focusCountry);
      refreshDomesticHud();
      setStatus(`Faction state reset for ${focusCountry}.`);
    });
  }

      return {
        refreshGovernmentProfileHud,
        refreshPolicyHud,
        refreshDomesticHud,
        bindGovernmentProfileControls: attachGovernmentProfileControls,
        bindPolicyControls: attachPolicyControls,
        bindLeadershipControls: attachLeadershipControls,
        bindFactionControls: attachFactionControls
      };
    }
  }());
};
