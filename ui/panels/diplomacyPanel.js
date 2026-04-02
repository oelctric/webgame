window.createDiplomacyPanelController = function createDiplomacyPanelController(scope) {
  return (function buildDiplomacyPanelController() {
    with (scope) {
  function refreshDiplomacyHud() {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      diplomacyFocusCountry.textContent = 'Diplomacy for: --';
      diplomacySummary.textContent = 'Diplomacy: --';
      relationsList.innerHTML = '<li>No country selected.</li>';
      diplomacyTargetCountry.innerHTML = '';
      sanctionsStateLabel.textContent = 'Sanctions: --';
      tradeStateLabel.textContent = 'Trade: --';
      [declareWarBtn, makePeaceBtn, improveRelationsBtn, worsenRelationsBtn, sanctionLightBtn, sanctionHeavyBtn, liftSanctionsBtn, toggleTradeBtn]
        .forEach((btn) => { btn.disabled = true; });
      return;
    }
  
    countrySystem.ensureCountry(focusCountry);
    Object.keys(gameState.countries).forEach((otherCountry) => {
      if (otherCountry !== focusCountry) diplomacySystem.ensureRelation(focusCountry, otherCountry);
    });
  
    const relations = diplomacySystem.getRelationsForCountry(focusCountry);
    diplomacyFocusCountry.textContent = `Diplomacy for: ${focusCountry}`;
    diplomacySummary.textContent = `Diplomacy: ${gameState.diplomacy.lastSummary}`;
  
    relationsList.innerHTML = '';
    if (!relations.length) {
      relationsList.innerHTML = '<li>No bilateral relations yet.</li>';
    } else {
      relations.forEach((relation) => {
        const li = document.createElement('li');
        const directional = diplomacySystem.getDirectionalPressure(focusCountry, relation.counterpart);
        const blocAligned = blocSystem.areInSameBloc(focusCountry, relation.counterpart) ? ' • same bloc' : '';
        li.textContent = `${relation.counterpart}: ${relation.status.toUpperCase()} (${relation.relationScore}) • Sanctions ${directional.sanctionsLevel} • Trade ${directional.tradeAllowed ? 'on' : 'blocked'}${blocAligned}`;
        relationsList.appendChild(li);
      });
    }
  
    const previousTarget = diplomacyTargetCountry.value;
    diplomacyTargetCountry.innerHTML = '';
    relations.forEach((relation) => {
      const option = document.createElement('option');
      option.value = relation.counterpart;
      option.textContent = relation.counterpart;
      diplomacyTargetCountry.appendChild(option);
    });
    if (previousTarget && relations.some((relation) => relation.counterpart === previousTarget)) {
      diplomacyTargetCountry.value = previousTarget;
    }
  
    const hasTarget = Boolean(diplomacyTargetCountry.value);
    [declareWarBtn, makePeaceBtn, improveRelationsBtn, worsenRelationsBtn, sanctionLightBtn, sanctionHeavyBtn, liftSanctionsBtn, toggleTradeBtn]
      .forEach((btn) => { btn.disabled = !hasTarget; });
  
    if (hasTarget) {
      const directional = diplomacySystem.getDirectionalPressure(focusCountry, diplomacyTargetCountry.value);
      sanctionsStateLabel.textContent = `Sanctions: ${directional.sanctionsLevel.toUpperCase()} (${focusCountry} → ${diplomacyTargetCountry.value})`;
      tradeStateLabel.textContent = `Trade: ${directional.tradeAllowed ? 'Allowed' : 'Blocked'} (${focusCountry} → ${diplomacyTargetCountry.value})`;
      toggleTradeBtn.textContent = directional.tradeAllowed ? 'Block Trade' : 'Allow Trade';
    } else {
      sanctionsStateLabel.textContent = 'Sanctions: --';
      tradeStateLabel.textContent = 'Trade: --';
      toggleTradeBtn.textContent = 'Toggle Trade';
    }
  }

  function attachDiplomacyControls() {
    const runAction = (action) => {
      const focusCountry = getDiplomacyFocusCountry();
      const targetCountry = diplomacyTargetCountry.value;
      if (!focusCountry || !targetCountry) {
        setStatus('Select a diplomacy target first.', true);
        return false;
      }
      if (focusCountry === targetCountry) {
        setStatus('Cannot apply diplomacy action to the same country.', true);
        return false;
      }
      const result = action(focusCountry, targetCountry);
      if (!result) {
        setStatus('Diplomacy action failed.', true);
        return false;
      }
      refreshDiplomacyHud();
      refreshCountryHud();
      return true;
    };
  
    declareWarBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.declareWar(focus, target, `${focus} declared war on ${target}.`))) {
        setStatus('War declared.');
      }
    });
    makePeaceBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.makePeace(focus, target, `${focus} made peace with ${target}.`))) {
        setStatus('Peace declared.');
      }
    });
    improveRelationsBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.adjustRelationScore(focus, target, 10, `${focus} improved relations with ${target}.`))) {
        setStatus('Relations improved.');
      }
    });
    worsenRelationsBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.adjustRelationScore(focus, target, -10, `${focus} worsened relations with ${target}.`, true))) {
        setStatus('Relations worsened.');
      }
    });
    sanctionLightBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.imposeSanctions(focus, target, 'light'))) {
        setStatus('Light sanctions imposed.');
      }
    });
    sanctionHeavyBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.imposeSanctions(focus, target, 'heavy'))) {
        setStatus('Heavy sanctions imposed.');
      }
    });
    liftSanctionsBtn.addEventListener('click', () => {
      if (runAction((focus, target) => diplomacySystem.liftSanctions(focus, target))) {
        setStatus('Sanctions lifted.');
      }
    });
    toggleTradeBtn.addEventListener('click', () => {
      const focusCountry = getDiplomacyFocusCountry();
      const targetCountry = diplomacyTargetCountry.value;
      if (!focusCountry || !targetCountry) {
        setStatus('Select a diplomacy target first.', true);
        return;
      }
      const currentState = diplomacySystem.getDirectionalPressure(focusCountry, targetCountry);
      runAction((focus, target) => diplomacySystem.setTradeAllowed(focus, target, !currentState.tradeAllowed));
      setStatus(currentState.tradeAllowed ? 'Trade blocked.' : 'Trade restored.');
    });
    diplomacyTargetCountry.addEventListener('change', () => refreshDiplomacyHud());
  }

      return {
        refresh: refreshDiplomacyHud,
        bind: attachDiplomacyControls
      };
    }
  }());
};
