window.createStateStructurePanelController = function createStateStructurePanelController(scope) {
  return (function buildStateStructurePanelController() {
    with (scope) {
  function refreshStateStructureHud() {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      stateStructureFocusCountry.textContent = 'Structure for: --';
      stateStructureSummary.textContent = 'State structure: --';
      stateAutonomyLabel.textContent = 'Regional autonomy: --';
      stateGovernanceLabel.textContent = 'Local governance capacity: --';
      stateEmergencyLabel.textContent = 'Emergency powers: --';
      stateTensionLabel.textContent = 'Center-region tension: --';
      [stateStructureSelect, autonomyUpBtn, autonomyDownBtn, governanceUpBtn, governanceDownBtn, tensionUpBtn, tensionDownBtn, toggleEmergencyPowersBtn]
        .forEach((el) => { el.disabled = true; });
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    stateStructureSystem.ensureCountryFields(country);
    stateStructureFocusCountry.textContent = `Structure for: ${focusCountry}`;
    stateStructureSummary.textContent = `State structure: ${stateStructureSystem.getStructureLabel(country)}`;
    stateAutonomyLabel.textContent = `Regional autonomy: ${country.regionalAutonomy.toFixed(1)} / 100`;
    stateGovernanceLabel.textContent = `Local governance capacity: ${country.localGovernanceCapacity.toFixed(1)} / 100 (${stateStructureSystem.getGovernanceLabel(country)})`;
    stateEmergencyLabel.textContent = `Emergency powers: ${country.emergencyPowersActive ? 'emergency rule active' : 'inactive'}`;
    stateTensionLabel.textContent = `Center-region tension: ${country.centerRegionTension.toFixed(1)} / 100`;
    stateStructureSelect.value = country.stateStructure;
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    const editable = playerCountry && focusCountry === playerCountry;
    [stateStructureSelect, autonomyUpBtn, autonomyDownBtn, governanceUpBtn, governanceDownBtn, tensionUpBtn, tensionDownBtn, toggleEmergencyPowersBtn]
      .forEach((el) => { el.disabled = !editable; });
  }

  function attachStateStructureControls() {
    const mutate = (mutator, successMessage) => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      mutator(focusCountry);
      refreshStateStructureHud();
      refreshDomesticHud();
      refreshResistanceHud();
      refreshLocalHotspotHud();
      refreshCountryHud();
      setStatus(successMessage);
    };
  
    stateStructureSelect.addEventListener('change', () => mutate((focusCountry) => {
      stateStructureSystem.setStateStructure(focusCountry, stateStructureSelect.value);
    }, 'State structure updated.'));
    autonomyUpBtn.addEventListener('click', () => mutate((focusCountry) => stateStructureSystem.adjustRegionalAutonomy(focusCountry, 8), 'Regional autonomy increased.'));
    autonomyDownBtn.addEventListener('click', () => mutate((focusCountry) => stateStructureSystem.adjustRegionalAutonomy(focusCountry, -8), 'Regional autonomy reduced.'));
    governanceUpBtn.addEventListener('click', () => mutate((focusCountry) => stateStructureSystem.adjustLocalGovernance(focusCountry, 8), 'Local governance capacity increased.'));
    governanceDownBtn.addEventListener('click', () => mutate((focusCountry) => stateStructureSystem.adjustLocalGovernance(focusCountry, -8), 'Local governance capacity reduced.'));
    tensionUpBtn.addEventListener('click', () => mutate((focusCountry) => stateStructureSystem.adjustCenterRegionTension(focusCountry, 8), 'Center-region tension increased.'));
    tensionDownBtn.addEventListener('click', () => mutate((focusCountry) => stateStructureSystem.adjustCenterRegionTension(focusCountry, -8), 'Center-region tension reduced.'));
    toggleEmergencyPowersBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const result = stateStructureSystem.toggleEmergencyPowers(focusCountry);
      if (!result.ok) {
        setStatus(result.reason, true);
        return;
      }
      refreshStateStructureHud();
      refreshDomesticHud();
      refreshResistanceHud();
      refreshLocalHotspotHud();
      refreshCountryHud();
      setStatus(`Emergency powers ${result.active ? 'activated' : 'deactivated'} for ${focusCountry}.`);
    });
  }

      return {
        refresh: refreshStateStructureHud,
        bind: attachStateStructureControls
      };
    }
  }());
};
