window.createCountryPanelController = function createCountryPanelController({
  cityList,
  baseButtons,
  countrySelect,
  gameState,
  baseTypes,
  getSelectedBaseType,
  setSelectedBaseType,
  setStatus
}) {
  function renderCityList(countryName) {
    cityList.innerHTML = '';
    const sourceCities = gameState.cities.length ? gameState.cities : [];
    const visibleCities = countryName
      ? sourceCities.filter((city) => (city.ownerCountry || city.country) === countryName)
      : sourceCities;
    if (!visibleCities.length) {
      const li = document.createElement('li');
      li.textContent = 'No major cities configured for this country yet.';
      cityList.appendChild(li);
      return;
    }

    visibleCities.forEach((city) => {
      const li = document.createElement('li');
      li.textContent = `${city.name} (${city.ownerCountry || city.country})`;
      cityList.appendChild(li);
    });
  }

  function createBaseButtons(playerCountryNameProvider) {
    baseButtons.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.textContent = 'No Build';
    noneBtn.classList.toggle('active', getSelectedBaseType() === null);
    noneBtn.addEventListener('click', () => {
      setSelectedBaseType(null);
      baseButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === noneBtn));
      setStatus('Build mode off. You can inspect/select without placing bases.');
    });
    baseButtons.appendChild(noneBtn);

    baseTypes.forEach((type) => {
      const btn = document.createElement('button');
      btn.textContent = type.label;
      btn.dataset.type = type.key;
      btn.classList.toggle('active', type.key === getSelectedBaseType());
      btn.addEventListener('click', () => {
        setSelectedBaseType(type.key);
        baseButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
        const playerName = typeof playerCountryNameProvider === 'function' ? playerCountryNameProvider() : null;
        if (playerName) setStatus(`Build mode: ${type.label}. Click inside ${playerName}.`);
      });
      baseButtons.appendChild(btn);
    });
  }

  function populateCountrySelect(countries) {
    countrySelect.innerHTML = '<option value="">Choose a country</option>';
    countries
      .map((c) => c.properties.name)
      .sort((a, b) => a.localeCompare(b))
      .forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        countrySelect.appendChild(option);
      });
  }

  return {
    renderCityList,
    createBaseButtons,
    populateCountrySelect
  };
};
