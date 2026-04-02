window.createMigrationPanelController = function createMigrationPanelController(scope) {
  return (function buildMigrationPanelController() {
    with (scope) {
  function refreshMigrationHud() {
    const focusCountry = getDiplomacyFocusCountry();
    migrationSummary.textContent = gameState.migration?.lastSummary
      ? `Migration: ${gameState.migration.lastSummary}`
      : 'Migration: --';
  
    const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const previousOrigin = migrationOriginSelect.value;
    const previousDestination = migrationDestinationSelect.value;
    migrationOriginSelect.innerHTML = '';
    migrationDestinationSelect.innerHTML = '';
    countryNames.forEach((name) => {
      const originOption = document.createElement('option');
      originOption.value = name;
      originOption.textContent = name;
      migrationOriginSelect.appendChild(originOption);
      const destinationOption = document.createElement('option');
      destinationOption.value = name;
      destinationOption.textContent = name;
      migrationDestinationSelect.appendChild(destinationOption);
    });
    if (previousOrigin && countryNames.includes(previousOrigin)) migrationOriginSelect.value = previousOrigin;
    if (previousDestination && countryNames.includes(previousDestination)) migrationDestinationSelect.value = previousDestination;
  
    const activeFlows = (gameState.migration?.flows || []).filter((flow) => flow.active);
    const previousFlowId = Number(migrationFlowSelect.value);
    migrationFlowSelect.innerHTML = '<option value="">Select active flow</option>';
    activeFlows.forEach((flow) => {
      const option = document.createElement('option');
      option.value = String(flow.id);
      option.textContent = `#${flow.id} ${flow.type} ${flow.originCountryId}→${flow.destinationCountryId} (${flow.amount.toFixed(1)})`;
      migrationFlowSelect.appendChild(option);
    });
    if (previousFlowId && activeFlows.some((flow) => flow.id === previousFlowId)) {
      migrationFlowSelect.value = String(previousFlowId);
    }
  
    if (!focusCountry) {
      migrationFocusCountry.textContent = 'Migration focus: --';
      migrationInflowLabel.textContent = 'Inflow pressure: --';
      migrationOutflowLabel.textContent = 'Outflow pressure: --';
      migrationHumanitarianLabel.textContent = 'Humanitarian burden: --';
      migrationFlowList.innerHTML = '<li>No country selected.</li>';
      return;
    }
  
    const country = countrySystem.ensureCountry(focusCountry);
    const inflow = activeFlows
      .filter((flow) => flow.destinationCountryId === focusCountry)
      .reduce((sum, flow) => sum + flow.amount, 0);
    const outflow = activeFlows
      .filter((flow) => flow.originCountryId === focusCountry)
      .reduce((sum, flow) => sum + flow.amount, 0);
    const refugeeIn = activeFlows
      .filter((flow) => flow.destinationCountryId === focusCountry && flow.type === 'refugee')
      .reduce((sum, flow) => sum + flow.amount, 0);
  
    migrationFocusCountry.textContent = `Migration focus: ${focusCountry}`;
    migrationInflowLabel.textContent = `Inflow pressure: ${inflow.toFixed(1)} (refugee ${refugeeIn.toFixed(1)})`;
    migrationOutflowLabel.textContent = `Outflow pressure: ${outflow.toFixed(1)}`;
    migrationHumanitarianLabel.textContent = `Humanitarian burden: ${(country.humanitarianBurden || 0).toFixed(1)} / 100`;
  
    const flows = activeFlows.filter((flow) => flow.originCountryId === focusCountry || flow.destinationCountryId === focusCountry);
    migrationFlowList.innerHTML = '';
    if (!flows.length) {
      migrationFlowList.innerHTML = '<li>No active migration/refugee flows for this country.</li>';
      return;
    }
  
    flows
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .forEach((flow) => {
        const li = document.createElement('li');
        li.textContent = `${flow.type.toUpperCase()} ${flow.originCountryId} → ${flow.destinationCountryId} • pressure ${flow.amount.toFixed(1)} • cause ${flow.cause || 'n/a'} • ${flow.severity}`;
        migrationFlowList.appendChild(li);
      });
  }

  function attachMigrationControls() {
    triggerRefugeeFlowBtn.addEventListener('click', () => {
      const origin = migrationOriginSelect.value;
      const destination = migrationDestinationSelect.value;
      const amount = Number(migrationAmountInput.value) || 10;
      const result = migrationSystem.triggerManualFlow(origin, destination, 'refugee', amount, 'manual_refugee_shock');
      if (!result.ok) {
        setStatus(result.message, true);
        return;
      }
      setStatus(`Manual refugee flow triggered: ${origin} → ${destination}.`);
      refreshMigrationHud();
      refreshDomesticHud();
    });
  
    triggerEconomicMigrationBtn.addEventListener('click', () => {
      const origin = migrationOriginSelect.value;
      const destination = migrationDestinationSelect.value;
      const amount = Number(migrationAmountInput.value) || 10;
      const result = migrationSystem.triggerManualFlow(origin, destination, 'migration', amount, 'manual_economic_pressure');
      if (!result.ok) {
        setStatus(result.message, true);
        return;
      }
      setStatus(`Manual economic migration flow triggered: ${origin} → ${destination}.`);
      refreshMigrationHud();
      refreshDomesticHud();
    });
  
    easeSelectedFlowBtn.addEventListener('click', () => {
      const flowId = Number(migrationFlowSelect.value);
      if (!flowId) {
        setStatus('Select an active flow to ease.', true);
        return;
      }
      const reduced = migrationSystem.reduceFlow(flowId, 0.35);
      if (!reduced) {
        setStatus('Unable to reduce selected flow.', true);
        return;
      }
      setStatus(`Flow #${flowId} reduced.`);
      refreshMigrationHud();
    });
  
    recomputeMigrationBtn.addEventListener('click', () => {
      migrationSystem.recomputeNow();
      setStatus('Migration system recomputed.');
      refreshMigrationHud();
    });
  }

      return {
        refresh: refreshMigrationHud,
        bind: attachMigrationControls
      };
    }
  }());
};
