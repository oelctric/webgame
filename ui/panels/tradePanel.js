window.createTradePanelController = function createTradePanelController(scope) {
  return (function buildTradePanelController() {
    with (scope) {
  function refreshTradeHud() {
    const focusCountry = getDiplomacyFocusCountry();
    const names = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const prevExp = tradeExporterSelect.value;
    const prevImp = tradeImporterSelect.value;
    [tradeExporterSelect, tradeImporterSelect].forEach((select) => { select.innerHTML = ''; });
    names.forEach((name) => {
      const opt1 = document.createElement('option');
      opt1.value = name;
      opt1.textContent = name;
      tradeExporterSelect.appendChild(opt1);
      const opt2 = document.createElement('option');
      opt2.value = name;
      opt2.textContent = name;
      tradeImporterSelect.appendChild(opt2);
    });
    if (prevExp && names.includes(prevExp)) tradeExporterSelect.value = prevExp;
    if (prevImp && names.includes(prevImp)) tradeImporterSelect.value = prevImp;
    toggleAutoTradeBtn.textContent = `Auto Trade: ${gameState.trade.autoEnabled ? 'On' : 'Off'}`;
    tradeSummary.textContent = `Trade: ${gameState.trade.flows.filter((flow) => flow.active).length} active flows`;
  
    if (!focusCountry) {
      tradeBalanceSummary.textContent = 'Balance: --';
      tradeFlowsList.innerHTML = '<li>No country selected.</li>';
      return;
    }
  
    const country = countrySystem.ensureCountry(focusCountry);
    tradeBalanceSummary.textContent = `Balance: Oil ${country.tradeBalance?.oil?.surplus?.toFixed(1) || 0}/${country.tradeBalance?.oil?.deficit?.toFixed(1) || 0} (surplus/deficit), Industry ${country.tradeBalance?.industry_support?.surplus?.toFixed(1) || 0}/${country.tradeBalance?.industry_support?.deficit?.toFixed(1) || 0}`;
    const flows = gameState.trade.flows.filter((flow) => flow.exporterCountryId === focusCountry || flow.importerCountryId === focusCountry);
    tradeFlowsList.innerHTML = '';
    if (!flows.length) {
      tradeFlowsList.innerHTML = '<li>No trade links.</li>';
    } else {
      flows.slice(-10).forEach((flow) => {
        const li = document.createElement('li');
        const dir = `${flow.exporterCountryId} → ${flow.importerCountryId}`;
        const routeLabel = flow.requiredChokepoints?.length ? ` via ${flow.requiredChokepoints.join(',')}` : '';
        const efficiency = typeof flow.routeEfficiency === 'number' ? ` eff ${(flow.routeEfficiency * 100).toFixed(0)}%` : '';
        li.textContent = `${flow.resourceType} ${flow.flowAmount.toFixed(1)} (${dir}) ${flow.active ? `ACTIVE${efficiency}` : `BLOCKED:${flow.blockedReason || 'n/a'}`}${routeLabel}${flow.blockedReason && flow.active ? ` (${flow.blockedReason})` : ''}`;
        tradeFlowsList.appendChild(li);
      });
    }
  }

  function attachTradeControls() {
    toggleAutoTradeBtn.addEventListener('click', () => {
      gameState.trade.autoEnabled = !gameState.trade.autoEnabled;
      refreshTradeHud();
      setStatus(`Auto trade ${gameState.trade.autoEnabled ? 'enabled' : 'disabled'}.`);
    });
    recomputeTradeBtn.addEventListener('click', () => {
      tradeSystem.processTick();
      setStatus('Trade flows recomputed.');
    });
    forceTradeBtn.addEventListener('click', () => {
      const exporter = tradeExporterSelect.value;
      const importer = tradeImporterSelect.value;
      const resourceType = tradeResourceSelect.value;
      const amount = Number(tradeAmountInput.value);
      if (!exporter || !importer || exporter === importer) {
        setStatus('Choose different exporter/importer countries.', true);
        return;
      }
      const result = tradeSystem.createManualFlow(exporter, importer, resourceType, amount);
      if (!result.ok) {
        setStatus(result.message, true);
        return;
      }
      tradeSystem.applyFlows();
      refreshTradeHud();
      setStatus('Manual trade flow applied.');
    });
    blockTradePairBtn.addEventListener('click', () => {
      const exporter = tradeExporterSelect.value;
      const importer = tradeImporterSelect.value;
      if (!exporter || !importer || exporter === importer) {
        setStatus('Choose different countries to block trade.', true);
        return;
      }
      diplomacySystem.setTradeAllowed(exporter, importer, false);
      diplomacySystem.setTradeAllowed(importer, exporter, false);
      tradeSystem.processTick();
      refreshDiplomacyHud();
      setStatus(`Trade blocked between ${exporter} and ${importer}.`);
    });
  }

      return {
        refresh: refreshTradeHud,
        bind: attachTradeControls
      };
    }
  }());
};
