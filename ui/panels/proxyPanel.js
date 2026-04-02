window.createProxyPanelController = function createProxyPanelController(scope) {
  return (function buildProxyPanelController() {
    with (scope) {
  function refreshProxyConflictHud() {
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    const focusCountry = getDiplomacyFocusCountry();
    const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const previousTarget = proxyTargetCountrySelect.value;
    proxyTargetCountrySelect.innerHTML = '';
    countryNames
      .filter((name) => name !== playerCountry)
      .forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        proxyTargetCountrySelect.appendChild(option);
      });
    if (previousTarget && countryNames.includes(previousTarget)) proxyTargetCountrySelect.value = previousTarget;
    if (!proxyTargetCountrySelect.value && proxyTargetCountrySelect.options.length) proxyTargetCountrySelect.value = proxyTargetCountrySelect.options[0].value;
  
    const targetCountryId = proxyTargetCountrySelect.value;
    localInstabilitySystem.ensureHotspots();
    const hotspots = targetCountryId ? localInstabilitySystem.getCountryHotspots(targetCountryId) : [];
    const previousHotspot = proxyTargetHotspotSelect.value;
    proxyTargetHotspotSelect.innerHTML = '<option value="">Auto / country-level target</option>';
    hotspots.slice(0, 10).forEach((hotspot) => {
      const option = document.createElement('option');
      option.value = hotspot.id;
      option.textContent = `${hotspot.name} (${hotspot.severityLabel})`;
      proxyTargetHotspotSelect.appendChild(option);
    });
    if (previousHotspot && hotspots.some((hotspot) => hotspot.id === previousHotspot)) {
      proxyTargetHotspotSelect.value = previousHotspot;
    }
  
    if (!focusCountry) {
      proxyFocusCountry.textContent = 'Proxy operations for: --';
      proxySummary.textContent = 'Proxy summary: --';
      activeProxyOperationSelect.innerHTML = '<option value="">No active proxy operations</option>';
      activeProxyList.innerHTML = '<li>No active proxy operations.</li>';
      proxyIncidentList.innerHTML = '<li>No proxy incidents.</li>';
      startProxyOperationBtn.disabled = true;
      cancelProxyOperationBtn.disabled = true;
      forceExposeProxyOperationBtn.disabled = true;
      return;
    }
  
    proxyFocusCountry.textContent = `Proxy operations for: ${focusCountry}`;
    proxySummary.textContent = `Proxy summary: ${gameState.proxyConflict.lastSummary}`;
    const canOperate = Boolean(playerCountry && focusCountry === playerCountry);
    startProxyOperationBtn.disabled = !canOperate || !proxyTargetCountrySelect.value;
  
    const activePlayerOps = (gameState.proxyConflict.operations || [])
      .filter((operation) => operation.active && operation.sourceCountryId === playerCountry);
    const previousOp = activeProxyOperationSelect.value;
    activeProxyOperationSelect.innerHTML = '<option value="">Select operation</option>';
    activePlayerOps.forEach((operation) => {
      const option = document.createElement('option');
      option.value = operation.id;
      option.textContent = `${operation.id} • ${proxyConflictSystem.getOperationLabel(operation.supportType)} → ${operation.targetCountryId}`;
      activeProxyOperationSelect.appendChild(option);
    });
    if (previousOp && activePlayerOps.some((operation) => operation.id === previousOp)) activeProxyOperationSelect.value = previousOp;
    cancelProxyOperationBtn.disabled = !activeProxyOperationSelect.value;
    forceExposeProxyOperationBtn.disabled = !activeProxyOperationSelect.value;
  
    activeProxyList.innerHTML = '';
    if (!activePlayerOps.length) {
      activeProxyList.innerHTML = '<li>No active proxy operations.</li>';
    } else {
      activePlayerOps.forEach((operation) => {
        const li = document.createElement('li');
        const remainingDays = Math.ceil(proxyConflictSystem.getRemainingDuration(operation) / DAY_MS);
        const status = operation.exposed ? 'EXPOSED' : 'deniable';
        li.textContent = `${proxyConflictSystem.getOperationLabel(operation.supportType)} | Target: ${proxyConflictSystem.resolveTargetDescriptor(operation)} | Strength ${operation.strength.toFixed(2)} | Risk ${(operation.attributionRisk * 100).toFixed(0)}% | ${status} | ${remainingDays}d left`;
        activeProxyList.appendChild(li);
      });
    }
  
    proxyIncidentList.innerHTML = '';
    const incidents = gameState.proxyConflict.incidentLog || [];
    if (!incidents.length) {
      proxyIncidentList.innerHTML = '<li>No proxy incidents.</li>';
    } else {
      incidents.slice(0, 6).forEach((incident) => {
        const li = document.createElement('li');
        li.textContent = `${formatDateTime(incident.at)}: ${incident.message}`;
        proxyIncidentList.appendChild(li);
      });
    }
  }

  function attachProxyConflictControls() {
    const syncControls = () => {
      refreshProxyConflictHud();
    };
  
    proxyTypeSelect.addEventListener('change', syncControls);
    proxyTargetCountrySelect.addEventListener('change', syncControls);
    activeProxyOperationSelect.addEventListener('change', () => {
      const enabled = Boolean(activeProxyOperationSelect.value);
      cancelProxyOperationBtn.disabled = !enabled;
      forceExposeProxyOperationBtn.disabled = !enabled;
    });
  
    startProxyOperationBtn.addEventListener('click', () => {
      const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
      const focusCountry = getDiplomacyFocusCountry();
      if (!playerCountry || !focusCountry || focusCountry !== playerCountry) {
        setStatus('Proxy operations can only be started for your selected country.', true);
        return;
      }
      const result = proxyConflictSystem.startOperation({
        sourceCountryId: playerCountry,
        targetCountryId: proxyTargetCountrySelect.value,
        targetHotspotId: proxyTargetHotspotSelect.value || null,
        supportType: proxyTypeSelect.value,
        strength: Number(proxyStrengthInput.value),
        attributionRisk: Number(proxyRiskInput.value),
        durationDays: Number(proxyDurationInput.value)
      });
      if (!result.ok) {
        setStatus(result.reason || 'Unable to start proxy operation.', true);
        return;
      }
      setStatus(`Started ${proxyConflictSystem.getOperationLabel(result.operation.supportType)} targeting ${proxyConflictSystem.resolveTargetDescriptor(result.operation)}.`);
      refreshProxyConflictHud();
      refreshResistanceHud();
      refreshLocalHotspotHud();
      refreshEconomyHud();
    });
  
    cancelProxyOperationBtn.addEventListener('click', () => {
      const operationId = activeProxyOperationSelect.value;
      if (!operationId) {
        setStatus('Select an operation to cancel.', true);
        return;
      }
      if (!proxyConflictSystem.cancelOperation(operationId)) {
        setStatus('Unable to cancel selected proxy operation.', true);
        return;
      }
      setStatus(`Canceled proxy operation ${operationId}.`);
      refreshProxyConflictHud();
    });
  
    forceExposeProxyOperationBtn.addEventListener('click', () => {
      const operationId = activeProxyOperationSelect.value;
      if (!operationId) {
        setStatus('Select an operation to expose.', true);
        return;
      }
      const ok = proxyConflictSystem.forceExpose(operationId);
      if (!ok) {
        setStatus('Unable to force exposure for selected operation.', true);
        return;
      }
      setStatus(`Forced exposure for ${operationId}.`);
      refreshProxyConflictHud();
      refreshDiplomacyHud();
    });
  
    syncControls();
  }

      return {
        refresh: refreshProxyConflictHud,
        bind: attachProxyConflictControls
      };
    }
  }());
};
