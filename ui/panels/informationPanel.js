window.createInformationPanelController = function createInformationPanelController(scope) {
  return (function buildInformationPanelController() {
    with (scope) {
  function refreshInformationHud() {
    const focusCountry = getDiplomacyFocusCountry();
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const previousTarget = influenceTargetCountry.value;
    influenceTargetCountry.innerHTML = '';
    countryNames.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      influenceTargetCountry.appendChild(option);
    });
    if (previousTarget && countryNames.includes(previousTarget)) influenceTargetCountry.value = previousTarget;
    if (!influenceTargetCountry.value && playerCountry) influenceTargetCountry.value = playerCountry;
  
    if (!focusCountry) {
      infoFocusCountry.textContent = 'Information state for: --';
      infoNarrativePressure.textContent = 'Domestic narrative pressure: --';
      infoReputation.textContent = 'International reputation: --';
      infoControl.textContent = 'Information control: --';
      infoLegitimacy.textContent = 'Legitimacy impact: --';
      infoInfluenceSummary.textContent = 'Influence ops: --';
      infoLabel.textContent = 'Narrative status: --';
      reputationLabel.textContent = 'Reputation status: --';
      activeInfluenceList.innerHTML = '<li>No active influence operations.</li>';
      activeInfluenceOperationSelect.innerHTML = '<option value="">No active operations</option>';
      startInfluenceOperationBtn.disabled = true;
      cancelInfluenceOperationBtn.disabled = true;
      return;
    }
  
    const country = countrySystem.ensureCountry(focusCountry);
    infoFocusCountry.textContent = `Information state for: ${focusCountry}`;
    infoNarrativePressure.textContent = `Domestic narrative pressure: ${country.domesticNarrativePressure.toFixed(1)} / 100`;
    infoReputation.textContent = `International reputation: ${country.internationalReputation.toFixed(1)} / 100`;
    infoControl.textContent = `Information control: ${country.informationControl.toFixed(1)} / 100`;
    infoLegitimacy.textContent = `Legitimacy/Public support: ${country.legitimacy.toFixed(1)} / ${country.publicSupport.toFixed(1)}`;
    infoInfluenceSummary.textContent = `Influence ops: ${gameState.influence.lastSummary}`;
    infoLabel.textContent = `Narrative status: ${informationSystem.getNarrativeLabel(country)}`;
    reputationLabel.textContent = `Reputation status: ${informationSystem.getReputationLabel(country)}`;
    startInfluenceOperationBtn.disabled = !playerCountry || playerCountry !== focusCountry;
    influenceTargetCountry.disabled = !INFLUENCE_CONFIG.types[influenceTypeSelect.value]?.requiresForeignTarget;
  
    const playerOps = (gameState.influence.operations || []).filter((operation) => operation.sourceCountryId === playerCountry && operation.active);
    const previousActiveOperation = activeInfluenceOperationSelect.value;
    activeInfluenceOperationSelect.innerHTML = '<option value="">Select operation</option>';
    playerOps.forEach((operation) => {
      const option = document.createElement('option');
      option.value = String(operation.id);
      const targetLabel = operation.targetCountryId === operation.sourceCountryId ? 'domestic' : operation.targetCountryId;
      option.textContent = `#${operation.id} ${influenceSystem.getOperationLabel(operation.type)} → ${targetLabel}`;
      activeInfluenceOperationSelect.appendChild(option);
    });
    if (previousActiveOperation && playerOps.some((operation) => String(operation.id) === previousActiveOperation)) {
      activeInfluenceOperationSelect.value = previousActiveOperation;
    }
    cancelInfluenceOperationBtn.disabled = !activeInfluenceOperationSelect.value;
  
    activeInfluenceList.innerHTML = '';
    if (!playerOps.length) {
      activeInfluenceList.innerHTML = '<li>No active influence operations.</li>';
    } else {
      playerOps.forEach((operation) => {
        const li = document.createElement('li');
        const remainingDays = Math.ceil(influenceSystem.getRemainingDuration(operation) / DAY_MS);
        const targetLabel = operation.targetCountryId === operation.sourceCountryId ? 'Domestic' : operation.targetCountryId;
        li.textContent = `${influenceSystem.getOperationLabel(operation.type)} | Target: ${targetLabel} | Strength ${operation.intensity.toFixed(1)} | ${remainingDays}d left`;
        activeInfluenceList.appendChild(li);
      });
    }
  }

  function attachInformationControls() {
    const syncInfluenceTargetState = () => {
      const focusCountry = getDiplomacyFocusCountry();
      const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
      const selectedType = influenceTypeSelect.value;
      const typeMeta = INFLUENCE_CONFIG.types[selectedType];
      const requiresForeignTarget = Boolean(typeMeta?.requiresForeignTarget);
      influenceTargetCountry.disabled = !requiresForeignTarget;
      if (!playerCountry || !focusCountry) {
        startInfluenceOperationBtn.disabled = true;
        return;
      }
      const canOperate = focusCountry === playerCountry;
      startInfluenceOperationBtn.disabled = !canOperate;
      if (!requiresForeignTarget) {
        influenceTargetCountry.value = playerCountry;
      } else if (influenceTargetCountry.value === playerCountry) {
        const fallback = Object.keys(gameState.countries).find((name) => name !== playerCountry);
        if (fallback) influenceTargetCountry.value = fallback;
      }
    };
  
    influenceTypeSelect.addEventListener('change', syncInfluenceTargetState);
    activeInfluenceOperationSelect.addEventListener('change', () => {
      cancelInfluenceOperationBtn.disabled = !activeInfluenceOperationSelect.value;
    });
    startInfluenceOperationBtn.addEventListener('click', () => {
      const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
      const focusCountry = getDiplomacyFocusCountry();
      if (!playerCountry || !focusCountry || focusCountry !== playerCountry) {
        setStatus('Influence operations can only be started for your selected country.', true);
        return;
      }
      const type = influenceTypeSelect.value;
      const typeMeta = INFLUENCE_CONFIG.types[type];
      const rawDuration = Math.max(INFLUENCE_CONFIG.minDurationDays, Math.min(INFLUENCE_CONFIG.maxDurationDays, Number(influenceDurationInput.value) || INFLUENCE_CONFIG.defaultDurationDays));
      const rawIntensity = Math.max(INFLUENCE_CONFIG.minIntensity, Math.min(INFLUENCE_CONFIG.maxIntensity, Number(influenceIntensityInput.value) || 1));
      const targetCountryId = typeMeta?.requiresForeignTarget ? influenceTargetCountry.value : playerCountry;
      const result = influenceSystem.startOperation({
        type,
        sourceCountryId: playerCountry,
        targetCountryId,
        durationDays: rawDuration,
        intensity: rawIntensity
      });
      if (!result.ok) {
        setStatus(result.reason || 'Unable to start influence operation.', true);
        return;
      }
      setStatus(`Started ${influenceSystem.getOperationLabel(type)} targeting ${result.operation.targetCountryId}.`);
      refreshInformationHud();
      refreshEconomyHud();
      refreshDomesticHud();
      refreshDiplomacyHud();
      refreshResistanceHud();
    });
  
    cancelInfluenceOperationBtn.addEventListener('click', () => {
      const operationId = Number(activeInfluenceOperationSelect.value);
      if (!operationId) {
        setStatus('Select an active operation to cancel.', true);
        return;
      }
      const canceled = influenceSystem.cancelOperation(operationId, 'canceled');
      if (!canceled) {
        setStatus('Unable to cancel that operation.', true);
        return;
      }
      setStatus(`Influence operation #${operationId} canceled.`);
      refreshInformationHud();
    });
  
    const mutate = (mutator, message) => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const country = countrySystem.ensureCountry(focusCountry);
      mutator(country);
      refreshInformationHud();
      refreshDomesticHud();
      refreshDiplomacyHud();
      setStatus(message);
    };
  
    raiseNarrativePressureBtn.addEventListener('click', () => mutate((country) => {
      country.domesticNarrativePressure = Math.min(100, country.domesticNarrativePressure + 8);
    }, 'Domestic narrative pressure increased.'));
    lowerNarrativePressureBtn.addEventListener('click', () => mutate((country) => {
      country.domesticNarrativePressure = Math.max(0, country.domesticNarrativePressure - 8);
    }, 'Domestic narrative pressure reduced.'));
    raiseReputationBtn.addEventListener('click', () => mutate((country) => {
      country.internationalReputation = Math.min(100, country.internationalReputation + 8);
    }, 'International reputation improved.'));
    lowerReputationBtn.addEventListener('click', () => mutate((country) => {
      country.internationalReputation = Math.max(-100, country.internationalReputation - 8);
    }, 'International reputation damaged.'));
    raiseInfoControlBtn.addEventListener('click', () => mutate((country) => {
      country.informationControl = Math.min(100, country.informationControl + 6);
    }, 'Information control strengthened.'));
    lowerInfoControlBtn.addEventListener('click', () => mutate((country) => {
      country.informationControl = Math.max(0, country.informationControl - 6);
    }, 'Information control weakened.'));
    triggerInfoSuccessBtn.addEventListener('click', () => mutate((country) => {
      country.domesticNarrativePressure = Math.max(0, country.domesticNarrativePressure - 10);
      country.internationalReputation = Math.min(100, country.internationalReputation + 4);
      country.infoMetrics.cooperativeActions += 0.6;
    }, 'Information campaign succeeded.'));
    triggerInfoScandalBtn.addEventListener('click', () => mutate((country) => {
      country.domesticNarrativePressure = Math.min(100, country.domesticNarrativePressure + 12);
      country.internationalReputation = Math.max(-100, country.internationalReputation - 7);
      country.infoMetrics.aggressiveActions += 0.4;
    }, 'Information scandal spread.'));
    syncInfluenceTargetState();
  }

      return {
        refresh: refreshInformationHud,
        bind: attachInformationControls
      };
    }
  }());
};
