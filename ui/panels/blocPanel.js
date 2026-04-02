window.createBlocPanelController = function createBlocPanelController(scope) {
  return (function buildBlocPanelController() {
    with (scope) {
  function refreshBlocHud() {
    const blocs = gameState.blocs.items.filter((bloc) => bloc.active);
    const names = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    blocSummary.textContent = `Blocs: ${gameState.blocs.lastSummary}`;
    const selectedCountry = getDiplomacyFocusCountry();
    const countryBlocs = selectedCountry ? blocSystem.getCountryBlocs(selectedCountry) : [];
    selectedCountryBlocs.textContent = `Selected country blocs: ${selectedCountry ? (countryBlocs.map((bloc) => bloc.name).join(', ') || 'none') : '--'}`;
  
    const previousBloc = blocSelect.value;
    blocSelect.innerHTML = '';
    blocs.forEach((bloc) => {
      const option = document.createElement('option');
      option.value = bloc.id;
      option.textContent = `${bloc.name} (${bloc.type})`;
      blocSelect.appendChild(option);
    });
    if (previousBloc && blocs.some((bloc) => bloc.id === previousBloc)) blocSelect.value = previousBloc;
  
    const previousMember = blocMemberCountrySelect.value;
    blocMemberCountrySelect.innerHTML = '';
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      blocMemberCountrySelect.appendChild(option);
    });
    if (previousMember && names.includes(previousMember)) blocMemberCountrySelect.value = previousMember;
  
    blocList.innerHTML = '';
    if (!blocs.length) {
      blocList.innerHTML = '<li>No active blocs.</li>';
      [addBlocMemberBtn, removeBlocMemberBtn, dissolveBlocBtn].forEach((btn) => { btn.disabled = true; });
      return;
    }
    [addBlocMemberBtn, removeBlocMemberBtn, dissolveBlocBtn].forEach((btn) => { btn.disabled = false; });
    blocs.forEach((bloc) => {
      const li = document.createElement('li');
      li.textContent = `${bloc.name} [${bloc.type}] • members: ${bloc.memberCountryIds.join(', ') || 'none'} • founded ${formatDateTime(bloc.foundedAt)}`;
      blocList.appendChild(li);
    });
  }

  function attachBlocControls() {
    createBlocBtn.addEventListener('click', () => {
      const name = blocNameInput.value.trim();
      if (!name) {
        setStatus('Enter a bloc name.', true);
        return;
      }
      const bloc = blocSystem.createBloc({ name, type: blocTypeSelect.value, description: `${blocTypeSelect.value} bloc` });
      if (!bloc) {
        setStatus('Failed to create bloc.', true);
        return;
      }
      blocNameInput.value = '';
      refreshBlocHud();
      refreshDiplomacyHud();
      setStatus(`Bloc created: ${bloc.name}.`);
    });
  
    addBlocMemberBtn.addEventListener('click', () => {
      const bloc = blocSystem.joinBloc(blocSelect.value, blocMemberCountrySelect.value);
      if (!bloc) {
        setStatus('Failed to add bloc member.', true);
        return;
      }
      refreshBlocHud();
      refreshDiplomacyHud();
      refreshTradeHud();
      setStatus(`${blocMemberCountrySelect.value} added to ${bloc.name}.`);
    });
  
    removeBlocMemberBtn.addEventListener('click', () => {
      const bloc = blocSystem.leaveBloc(blocSelect.value, blocMemberCountrySelect.value);
      if (!bloc) {
        setStatus('Failed to remove bloc member.', true);
        return;
      }
      refreshBlocHud();
      refreshDiplomacyHud();
      refreshTradeHud();
      setStatus(`${blocMemberCountrySelect.value} removed from ${bloc.name}.`);
    });
  
    dissolveBlocBtn.addEventListener('click', () => {
      const bloc = blocSystem.dissolveBloc(blocSelect.value);
      if (!bloc) {
        setStatus('Failed to dissolve bloc.', true);
        return;
      }
      refreshBlocHud();
      refreshDiplomacyHud();
      refreshTradeHud();
      setStatus(`Bloc dissolved: ${bloc.name}.`);
    });
  
    blocSelect.addEventListener('change', () => refreshBlocHud());
  }

      return {
        refresh: refreshBlocHud,
        bind: attachBlocControls
      };
    }
  }());
};
