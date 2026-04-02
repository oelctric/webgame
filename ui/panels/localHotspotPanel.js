window.createLocalHotspotPanelController = function createLocalHotspotPanelController(scope) {
  return (function buildLocalHotspotPanelController() {
    with (scope) {
  function refreshLocalHotspotHud() {
    const focusCountry = getDiplomacyFocusCountry();
    localHotspotSummary.textContent = gameState.localInstability?.lastSummary || 'Local instability: --';
    if (!focusCountry) {
      localHotspotFocusCountry.textContent = 'Hotspots for: --';
      localHotspotMetrics.textContent = 'Local stability/unrest/control: --';
      localHotspotTags.textContent = 'Hotspot tags: --';
      localHotspotPressure.textContent = 'Local pressures: --';
      localHotspotSelect.innerHTML = '<option value="">No hotspots</option>';
      localHotspotList.innerHTML = '<li>No local hotspots.</li>';
      return;
    }
    localInstabilitySystem.ensureHotspots();
    const hotspots = localInstabilitySystem.getCountryHotspots(focusCountry);
    localHotspotFocusCountry.textContent = `Hotspots for: ${focusCountry}`;
    const previousSelection = gameState.localInstability.selectedHotspotId;
    localHotspotSelect.innerHTML = '';
    hotspots.forEach((hotspot) => {
      const option = document.createElement('option');
      option.value = hotspot.id;
      option.textContent = `${hotspot.name} (${hotspot.severityLabel}, ${hotspot.severity.toFixed(0)})`;
      localHotspotSelect.appendChild(option);
    });
    if (!hotspots.length) {
      localHotspotSelect.innerHTML = '<option value="">No hotspots</option>';
      localHotspotMetrics.textContent = 'Local stability/unrest/control: --';
      localHotspotTags.textContent = 'Hotspot tags: --';
      localHotspotPressure.textContent = 'Local pressures: --';
      localHotspotList.innerHTML = '<li>No local hotspots.</li>';
      return;
    }
    if (previousSelection && hotspots.some((hotspot) => hotspot.id === previousSelection)) {
      localHotspotSelect.value = previousSelection;
    } else {
      localHotspotSelect.value = hotspots[0].id;
    }
    gameState.localInstability.selectedHotspotId = localHotspotSelect.value;
    const selected = hotspots.find((hotspot) => hotspot.id === localHotspotSelect.value) || hotspots[0];
    localHotspotMetrics.textContent = `Local stability/unrest/control: ${selected.localStability.toFixed(1)} / ${selected.localUnrest.toFixed(1)} / ${selected.localStateControl.toFixed(1)}`;
    localHotspotTags.textContent = `Hotspot tags: ${(selected.hotspotTags || []).join(', ') || 'none'}`;
    localHotspotPressure.textContent = `Local pressures: migration ${(selected.activePressures?.migration || 0).toFixed(1)} • insurgency ${(selected.activePressures?.insurgency || 0).toFixed(1)} • crisis ${(selected.activePressures?.crisis || 0).toFixed(1)}`;
  
    localHotspotList.innerHTML = '';
    hotspots.slice(0, 6).forEach((hotspot) => {
      const li = document.createElement('li');
      li.textContent = `${hotspot.name}: ${hotspot.severityLabel} (${hotspot.severity.toFixed(0)}) • tags ${hotspot.hotspotTags?.join(', ') || 'none'}`;
      localHotspotList.appendChild(li);
    });
  }

  function attachLocalHotspotControls() {
    const mutateLocal = (mutator, message) => {
      const hotspotId = localHotspotSelect.value || gameState.localInstability.selectedHotspotId;
      if (!hotspotId) {
        setStatus('Select a local hotspot first.', true);
        return;
      }
      mutator(hotspotId);
      refreshLocalHotspotHud();
      refreshResistanceHud();
      refreshDomesticHud();
      refreshStateStructureHud();
      refreshCountryHud();
      refreshEconomyHud();
      renderCities();
      setStatus(message);
    };
  
    localHotspotSelect.addEventListener('change', () => {
      gameState.localInstability.selectedHotspotId = localHotspotSelect.value;
      refreshLocalHotspotHud();
    });
    raiseLocalUnrestBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localUnrest', 8), 'Local unrest increased.'));
    lowerLocalUnrestBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localUnrest', -8), 'Local unrest reduced.'));
    raiseLocalControlBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStateControl', 8), 'Local state control increased.'));
    lowerLocalControlBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStateControl', -8), 'Local state control reduced.'));
    raiseLocalStabilityBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStability', 8), 'Local stability increased.'));
    lowerLocalStabilityBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStability', -8), 'Local stability reduced.'));
    createManualHotspotBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const hotspots = localInstabilitySystem.getCountryHotspots(focusCountry);
      const pick = hotspots[0];
      if (!pick) {
        setStatus('No city hotspots available for this country.', true);
        return;
      }
      localInstabilitySystem.createManualHotspot(focusCountry, pick.linkedCityId, localHotspotTagSelect.value || 'unrest hotspot');
      refreshLocalHotspotHud();
      renderCities();
      setStatus('Manual local hotspot created.');
    });
    clearManualHotspotBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.clearHotspot(id), 'Local hotspot cleared.'));
    localHotspotTagSelect.addEventListener('change', () => {
      const hotspotId = localHotspotSelect.value || gameState.localInstability.selectedHotspotId;
      if (!hotspotId) return;
      localInstabilitySystem.setHotspotTag(hotspotId, localHotspotTagSelect.value);
      refreshLocalHotspotHud();
      renderCities();
    });
  }

      return {
        refresh: refreshLocalHotspotHud,
        bind: attachLocalHotspotControls
      };
    }
  }());
};
