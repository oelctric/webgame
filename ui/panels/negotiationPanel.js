window.createNegotiationPanelController = function createNegotiationPanelController(scope) {
  return (function buildNegotiationPanelController() {
    with (scope) {
  function refreshNegotiationHud() {
    const names = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const previousA = negotiationCountryA.value;
    const previousB = negotiationCountryB.value;
    [negotiationCountryA, negotiationCountryB].forEach((select) => { select.innerHTML = ''; });
    names.forEach((name) => {
      const optA = document.createElement('option');
      optA.value = name;
      optA.textContent = name;
      negotiationCountryA.appendChild(optA);
      const optB = document.createElement('option');
      optB.value = name;
      optB.textContent = name;
      negotiationCountryB.appendChild(optB);
    });
    if (previousA && names.includes(previousA)) negotiationCountryA.value = previousA;
    if (previousB && names.includes(previousB)) negotiationCountryB.value = previousB;
    if (!negotiationCountryA.value && names.length) negotiationCountryA.value = names[0];
    if (!negotiationCountryB.value && names.length > 1) negotiationCountryB.value = names[1];
  
    const hasCountries = names.length >= 2;
    [
      declareCeasefireBtn,
      signPeaceDealBtn,
      grantSanctionsReliefBtn,
      borderDeEscalationBtn,
      restoreTradeBtn,
      negotiationCountryA,
      negotiationCountryB,
      ceasefireDaysInput,
      tradeRestoreDaysInput
    ].forEach((el) => { el.disabled = !hasCountries; });
  
    negotiationSummary.textContent = `Negotiation: ${gameState.negotiation.lastSummary}`;
    negotiationStateList.innerHTML = '';
    const ceasefires = Object.values(gameState.negotiation.ceasefiresByPair);
    const tradeDeals = Object.values(gameState.negotiation.tradeRestorationByPair);
    if (!ceasefires.length && !tradeDeals.length) {
      negotiationStateList.innerHTML = '<li>No active negotiated agreements.</li>';
      return;
    }
    ceasefires.forEach((agreement) => {
      const li = document.createElement('li');
      li.textContent = `Ceasefire ${agreement.countryA} ↔ ${agreement.countryB} (${negotiationSystem.formatDaysLeft(agreement.expiresAt)})`;
      negotiationStateList.appendChild(li);
    });
    tradeDeals.forEach((agreement) => {
      const li = document.createElement('li');
      li.textContent = `Temporary trade ${agreement.countryA} ↔ ${agreement.countryB} (${negotiationSystem.formatDaysLeft(agreement.expiresAt)})`;
      negotiationStateList.appendChild(li);
    });
  }

  function attachNegotiationControls() {
    const getPair = () => {
      const countryA = negotiationCountryA.value;
      const countryB = negotiationCountryB.value;
      if (!countryA || !countryB) {
        setStatus('Select two countries for negotiation.', true);
        return null;
      }
      if (countryA === countryB) {
        setStatus('Negotiation requires two different countries.', true);
        return null;
      }
      return { countryA, countryB };
    };
  
    declareCeasefireBtn.addEventListener('click', () => {
      const pair = getPair();
      if (!pair) return;
      const days = Math.max(0, Number(ceasefireDaysInput.value) || NEGOTIATION_CONFIG.ceasefireDefaultDays);
      const result = negotiationSystem.setCeasefire(pair.countryA, pair.countryB, days);
      if (!result) {
        setStatus('Failed to set ceasefire.', true);
        return;
      }
      refreshDiplomacyHud();
      refreshNegotiationHud();
      refreshTradeHud();
      setStatus(`Ceasefire declared between ${pair.countryA} and ${pair.countryB}.`);
    });
  
    signPeaceDealBtn.addEventListener('click', () => {
      const pair = getPair();
      if (!pair) return;
      const result = negotiationSystem.signPeaceDeal(pair.countryA, pair.countryB);
      if (!result) {
        setStatus('Failed to sign peace deal.', true);
        return;
      }
      refreshDiplomacyHud();
      refreshNegotiationHud();
      refreshTradeHud();
      setStatus(`Peace deal signed between ${pair.countryA} and ${pair.countryB}.`);
    });
  
    grantSanctionsReliefBtn.addEventListener('click', () => {
      const pair = getPair();
      if (!pair) return;
      const result = negotiationSystem.applySanctionsRelief(pair.countryA, pair.countryB);
      if (!result) {
        setStatus('Failed to apply sanctions relief.', true);
        return;
      }
      refreshDiplomacyHud();
      refreshNegotiationHud();
      refreshDomesticHud();
      refreshTradeHud();
      setStatus(`${pair.countryA} granted sanctions relief to ${pair.countryB}.`);
    });
  
    borderDeEscalationBtn.addEventListener('click', () => {
      const pair = getPair();
      if (!pair) return;
      const result = negotiationSystem.applyBorderDeEscalation(pair.countryA, pair.countryB);
      if (!result) {
        setStatus('Failed to apply border de-escalation.', true);
        return;
      }
      refreshDiplomacyHud();
      refreshNegotiationHud();
      refreshDomesticHud();
      setStatus(`Border de-escalation applied between ${pair.countryA} and ${pair.countryB}.`);
    });
  
    restoreTradeBtn.addEventListener('click', () => {
      const pair = getPair();
      if (!pair) return;
      const days = Math.max(0, Number(tradeRestoreDaysInput.value) || NEGOTIATION_CONFIG.temporaryTradeDefaultDays);
      const result = negotiationSystem.restoreTemporaryTrade(pair.countryA, pair.countryB, days);
      if (!result) {
        setStatus('Failed to restore temporary trade.', true);
        return;
      }
      refreshDiplomacyHud();
      refreshNegotiationHud();
      refreshTradeHud();
      refreshDomesticHud();
      setStatus(`Temporary trade restored between ${pair.countryA} and ${pair.countryB}.`);
    });
  }

      return {
        refresh: refreshNegotiationHud,
        bind: attachNegotiationControls
      };
    }
  }());
};
