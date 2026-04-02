window.createResistancePanelController = function createResistancePanelController(scope) {
  return (function buildResistancePanelController() {
    with (scope) {
  function refreshResistanceHud() {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      resistanceFocusCountry.textContent = 'Internal resistance for: --';
      resistanceInsurgency.textContent = 'Insurgency pressure: --';
      resistanceSeparatist.textContent = 'Separatist pressure: --';
      resistanceControl.textContent = 'State control: --';
      resistanceForeign.textContent = 'Foreign-backed pressure: --';
      resistanceStatus.textContent = 'Resistance status: --';
      resistanceImpact.textContent = 'Resistance effects: --';
      resistanceHotspots.textContent = 'Hotspots: --';
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    const effects = country.resistanceEffects || {};
    resistanceFocusCountry.textContent = `Internal resistance for: ${focusCountry}`;
    resistanceInsurgency.textContent = `Insurgency pressure: ${country.insurgencyPressure.toFixed(1)} / 100`;
    resistanceSeparatist.textContent = `Separatist pressure: ${country.separatistPressure.toFixed(1)} / 100`;
    resistanceControl.textContent = `State control: ${country.stateControl.toFixed(1)} / 100`;
    resistanceForeign.textContent = `Foreign-backed pressure: ${(country.foreignBackedPressure || 0).toFixed(1)} / 100`;
    resistanceStatus.textContent = `Resistance status: ${internalResistanceSystem.getResistanceLabel(country)} • ${gameState.internalResistance.lastSummary}`;
    resistanceImpact.textContent = `Resistance effects: output -${((effects.outputPenalty || 0) * 100).toFixed(1)}% • manpower -${((effects.manpowerPenalty || 0) * 100).toFixed(1)}% • security cost +${Math.round(effects.securityCost || 0)}/day`;
    const hotspotLabel = (country.resistanceHotspots || [])
      .slice(0, 2)
      .map((hotspot) => `${hotspot.label} (ins ${hotspot.insurgencyPressure.toFixed(0)}, sep ${hotspot.separatistPressure.toFixed(0)}, ctrl ${hotspot.stateControl.toFixed(0)})`)
      .join(' • ');
    resistanceHotspots.textContent = `Hotspots: ${hotspotLabel || 'none'}`;
  }

  function attachResistanceControls() {
    const mutateResistance = (mutator, message) => {
      const focusCountry = getDiplomacyFocusCountry();
      if (!focusCountry) {
        setStatus('Select a country first.', true);
        return;
      }
      const country = countrySystem.ensureCountry(focusCountry);
      mutator(country, focusCountry);
      refreshResistanceHud();
      refreshDomesticHud();
      refreshStateStructureHud();
      refreshCountryHud();
      refreshEconomyHud();
      setStatus(message);
    };
  
    raiseInsurgencyBtn.addEventListener('click', () => mutateResistance((country) => {
      country.insurgencyPressure = internalResistanceSystem.clamp(country.insurgencyPressure + 8);
    }, 'Insurgency pressure increased.'));
    lowerInsurgencyBtn.addEventListener('click', () => mutateResistance((country) => {
      country.insurgencyPressure = internalResistanceSystem.clamp(country.insurgencyPressure - 8);
    }, 'Insurgency pressure reduced.'));
    raiseSeparatistBtn.addEventListener('click', () => mutateResistance((country) => {
      country.separatistPressure = internalResistanceSystem.clamp(country.separatistPressure + 8);
    }, 'Separatist pressure increased.'));
    lowerSeparatistBtn.addEventListener('click', () => mutateResistance((country) => {
      country.separatistPressure = internalResistanceSystem.clamp(country.separatistPressure - 8);
    }, 'Separatist pressure reduced.'));
    raiseStateControlBtn.addEventListener('click', () => mutateResistance((country) => {
      country.stateControl = internalResistanceSystem.clamp(country.stateControl + 8);
    }, 'State control strengthened.'));
    lowerStateControlBtn.addEventListener('click', () => mutateResistance((country) => {
      country.stateControl = internalResistanceSystem.clamp(country.stateControl - 8);
    }, 'State control weakened.'));
    raiseForeignPressureBtn.addEventListener('click', () => mutateResistance((country) => {
      country.foreignBackedPressure = internalResistanceSystem.clamp((country.foreignBackedPressure || 0) + 6);
    }, 'Foreign-backed pressure increased.'));
    lowerForeignPressureBtn.addEventListener('click', () => mutateResistance((country) => {
      country.foreignBackedPressure = internalResistanceSystem.clamp((country.foreignBackedPressure || 0) - 6);
    }, 'Foreign-backed pressure reduced.'));
    triggerResistanceHotspotBtn.addEventListener('click', () => mutateResistance((country) => {
      internalResistanceSystem.ensureHotspot(country, `Unstable zone ${Date.now().toString().slice(-3)}`);
    }, 'Internal resistance hotspot created.'));
  }

      return {
        refresh: refreshResistanceHud,
        bind: attachResistanceControls
      };
    }
  }());
};
