window.createChokepointPanelController = function createChokepointPanelController(scope) {
  return (function buildChokepointPanelController() {
    with (scope) {
  function refreshChokepointHud() {
    const chokepoints = gameState.chokepoints.points || [];
    chokepointSummary.textContent = `Route pressure: ${gameState.chokepoints.lastSummary}`;
    const previousChokepoint = chokepointSelect.value;
    chokepointSelect.innerHTML = '';
    chokepoints.forEach((cp) => {
      const option = document.createElement('option');
      option.value = cp.id;
      option.textContent = cp.name;
      chokepointSelect.appendChild(option);
    });
    if (previousChokepoint && chokepoints.some((cp) => cp.id === previousChokepoint)) {
      chokepointSelect.value = previousChokepoint;
    }
  
    const names = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const previousController = chokepointControllerSelect.value;
    chokepointControllerSelect.innerHTML = '<option value="">None</option>';
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      chokepointControllerSelect.appendChild(option);
    });
    if (previousController && names.includes(previousController)) {
      chokepointControllerSelect.value = previousController;
    }
  
    chokepointList.innerHTML = '';
    if (!chokepoints.length) {
      chokepointList.innerHTML = '<li>No chokepoints initialized.</li>';
      [chokepointOpenBtn, chokepointRestrictedBtn, chokepointBlockedBtn, chokepointContestedToggleBtn, assignChokepointControllerBtn]
        .forEach((btn) => { btn.disabled = true; });
      return;
    }
    [chokepointOpenBtn, chokepointRestrictedBtn, chokepointBlockedBtn, chokepointContestedToggleBtn, assignChokepointControllerBtn]
      .forEach((btn) => { btn.disabled = false; });
  
    chokepoints.forEach((cp) => {
      const linkedFlows = gameState.trade.flows.filter((flow) => flow.requiredChokepoints?.includes(cp.id));
      const affectedCountries = new Set(linkedFlows.flatMap((flow) => [flow.exporterCountryId, flow.importerCountryId]));
      const li = document.createElement('li');
      li.textContent = `${cp.name} • ${cp.openState.toUpperCase()} • controller ${cp.controllingCountryId || 'None'} • contested ${cp.contested ? 'Yes' : 'No'} • linked flows ${linkedFlows.length} • countries ${affectedCountries.size}`;
      chokepointList.appendChild(li);
    });
  
    const selected = chokepointSystem.getChokepoint(chokepointSelect.value);
    if (selected) {
      chokepointControllerSelect.value = selected.controllingCountryId || '';
      chokepointContestedToggleBtn.textContent = selected.contested ? 'Mark Not Contested' : 'Mark Contested';
    }
  }

  function attachChokepointControls() {
    const selectedId = () => chokepointSelect.value;
    const setState = (state) => {
      const chokepoint = chokepointSystem.setOpenState(selectedId(), state, 'manual');
      if (!chokepoint) {
        setStatus('Unable to update chokepoint state.', true);
        return;
      }
      tradeSystem.processTick();
      refreshChokepointHud();
      refreshTradeHud();
      setStatus(`${chokepoint.name} set to ${state}.`);
    };
  
    chokepointOpenBtn.addEventListener('click', () => setState('open'));
    chokepointRestrictedBtn.addEventListener('click', () => setState('restricted'));
    chokepointBlockedBtn.addEventListener('click', () => setState('blocked'));
    chokepointContestedToggleBtn.addEventListener('click', () => {
      const chokepoint = chokepointSystem.getChokepoint(selectedId());
      if (!chokepoint) {
        setStatus('Select a chokepoint first.', true);
        return;
      }
      chokepointSystem.setContested(chokepoint.id, !chokepoint.contested);
      tradeSystem.processTick();
      refreshChokepointHud();
      refreshTradeHud();
      setStatus(`${chokepoint.name} contestation toggled.`);
    });
    assignChokepointControllerBtn.addEventListener('click', () => {
      const chokepoint = chokepointSystem.setController(selectedId(), chokepointControllerSelect.value || null);
      if (!chokepoint) {
        setStatus('Unable to assign chokepoint controller.', true);
        return;
      }
      refreshChokepointHud();
      refreshDiplomacyHud();
      setStatus(`Controller updated for ${chokepoint.name}.`);
    });
    recomputeRoutePressureBtn.addEventListener('click', () => {
      tradeSystem.processTick();
      refreshTradeHud();
      refreshChokepointHud();
      setStatus('Route pressure recomputed.');
    });
    chokepointSelect.addEventListener('change', () => refreshChokepointHud());
  }

      return {
        refresh: refreshChokepointHud,
        bind: attachChokepointControls
      };
    }
  }());
};
