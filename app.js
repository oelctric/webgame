    const svg = d3.select('#map');
    const mapWrap = document.getElementById('mapWrap');
    const tooltip = document.getElementById('tooltip');
    const selectedCountryLabel = document.getElementById('selectedCountry');
    const cityList = document.getElementById('cityList');
    const statusLabel = document.getElementById('status');
    const baseButtons = document.getElementById('baseButtons');
    const playerProfile = document.getElementById('playerProfile');

    const overlays = {
      mainMenu: document.getElementById('mainMenu'),
      playFlow: document.getElementById('playFlow'),
      settingsPanel: document.getElementById('settingsPanel')
    };

    const playTitle = document.getElementById('playTitle');
    const playStepCountry = document.getElementById('playStepCountry');
    const playStepLeader = document.getElementById('playStepLeader');
    const countrySelect = document.getElementById('countrySelect');
    const countryWarning = document.getElementById('countryWarning');
    const leaderNameInput = document.getElementById('leaderName');

    const baseTypes = [
      { key: 'ground', label: 'Ground', color: 'var(--base-ground)' },
      { key: 'air', label: 'Air', color: 'var(--base-air)' },
      { key: 'naval', label: 'Naval', color: 'var(--base-naval)' },
      { key: 'antiAir', label: 'Anti-Air', color: 'var(--base-aa)' }
    ];

    const majorCities = [
      { name: 'New York', country: 'United States of America', lat: 40.7128, lon: -74.0060 },
      { name: 'Los Angeles', country: 'United States of America', lat: 34.0522, lon: -118.2437 },
      { name: 'London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276 },
      { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
      { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
      { name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
      { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
      { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
      { name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
      { name: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
      { name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
      { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
      { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333 },
      { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
      { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
      { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 }
    ];

    let selectedBaseType = 'ground';
    let selectedCountryFeature = null;
    let playerCountryFeature = null;
    let countries = [];
    let countriesLayer;
    const bases = [];
    let playStep = 1;

    const settingsState = {
      music: Number(localStorage.getItem('musicVolume') ?? 40),
      sfx: Number(localStorage.getItem('sfxVolume') ?? 60)
    };

    function setStatus(message, isError = false) {
      statusLabel.textContent = message;
      statusLabel.style.color = isError ? '#ff9aa9' : '#93a4c8';
    }

    function setOverlay(name) {
      Object.entries(overlays).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
    }

    function hideOverlays() {
      Object.values(overlays).forEach((el) => el.classList.add('hidden'));
    }

    function renderCityList(countryName) {
      cityList.innerHTML = '';
      const visibleCities = countryName ? majorCities.filter((city) => city.country === countryName) : majorCities;
      if (!visibleCities.length) {
        const li = document.createElement('li');
        li.textContent = 'No major cities configured for this country yet.';
        cityList.appendChild(li);
        return;
      }
      visibleCities.forEach((city) => {
        const li = document.createElement('li');
        li.textContent = `${city.name} (${city.country})`;
        cityList.appendChild(li);
      });
    }

    function createBaseButtons() {
      baseButtons.innerHTML = '';
      baseTypes.forEach((type) => {
        const btn = document.createElement('button');
        btn.textContent = type.label;
        btn.dataset.type = type.key;
        btn.classList.toggle('active', type.key === selectedBaseType);
        btn.addEventListener('click', () => {
          selectedBaseType = type.key;
          baseButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
          if (playerCountryFeature) {
            setStatus(`Build mode: ${type.label}. Click inside ${playerCountryFeature.properties.name}.`);
          }
        });
        baseButtons.appendChild(btn);
      });
    }

    function updateCountryStyles() {
      if (!countriesLayer) return;
      countriesLayer.selectAll('path')
        .classed('selected', (d) => selectedCountryFeature && d.id === selectedCountryFeature.id)
        .classed('locked', (d) => playerCountryFeature && d.id !== playerCountryFeature.id);
    }

    function setPlayerCountry(countryFeature) {
      playerCountryFeature = countryFeature;
      selectedCountryFeature = countryFeature;
      selectedCountryLabel.textContent = `Selected: ${countryFeature.properties.name}`;
      renderCityList(countryFeature.properties.name);
      updateCountryStyles();
    }

    function pointInsideCountry(countryFeature, lonLatPoint) {
      if (!countryFeature) return false;
      return d3.geoContains(countryFeature, lonLatPoint);
    }

    function populateCountrySelect() {
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

    function applySettingsUI() {
      const musicSlider = document.getElementById('musicVolume');
      const sfxSlider = document.getElementById('sfxVolume');
      const musicValue = document.getElementById('musicValue');
      const sfxValue = document.getElementById('sfxValue');
      musicSlider.value = settingsState.music;
      sfxSlider.value = settingsState.sfx;
      musicValue.textContent = settingsState.music;
      sfxValue.textContent = settingsState.sfx;

      musicSlider.addEventListener('input', (e) => {
        settingsState.music = Number(e.target.value);
        musicValue.textContent = settingsState.music;
        localStorage.setItem('musicVolume', String(settingsState.music));
      });

      sfxSlider.addEventListener('input', (e) => {
        settingsState.sfx = Number(e.target.value);
        sfxValue.textContent = settingsState.sfx;
        localStorage.setItem('sfxVolume', String(settingsState.sfx));
      });
    }

    function attachMenuHandlers() {
      document.getElementById('playBtn').addEventListener('click', () => {
        playStep = 1;
        playTitle.textContent = 'Choose Your Country';
        playStepCountry.classList.remove('hidden');
        playStepLeader.classList.add('hidden');
        countryWarning.textContent = '';
        leaderNameInput.value = '';
        setOverlay('playFlow');
      });

      document.getElementById('settingsBtn').addEventListener('click', () => setOverlay('settingsPanel'));
      document.getElementById('settingsBackBtn').addEventListener('click', () => setOverlay('mainMenu'));

      document.getElementById('playBackBtn').addEventListener('click', () => {
        if (playStep === 1) {
          setOverlay('mainMenu');
          return;
        }
        playStep = 1;
        playTitle.textContent = 'Choose Your Country';
        playStepCountry.classList.remove('hidden');
        playStepLeader.classList.add('hidden');
      });

      document.getElementById('playNextBtn').addEventListener('click', () => {
        if (playStep === 1) {
          const chosen = countrySelect.value;
          if (!chosen) {
            countryWarning.textContent = 'Please choose a country to continue.';
            return;
          }
          const chosenFeature = countries.find((c) => c.properties.name === chosen);
          if (!chosenFeature) {
            countryWarning.textContent = 'Country data unavailable. Choose another country.';
            return;
          }
          countryWarning.textContent = '';
          setPlayerCountry(chosenFeature);
          playStep = 2;
          playTitle.textContent = `Create Leader for ${chosen}`;
          playStepCountry.classList.add('hidden');
          playStepLeader.classList.remove('hidden');
          return;
        }

        const leaderName = leaderNameInput.value.trim();
        if (!leaderName) {
          countryWarning.textContent = '';
          alert('Please enter a leader name.');
          return;
        }

        playerProfile.textContent = `Leader ${leaderName} of ${playerCountryFeature.properties.name}`;
        setStatus(`Commander ${leaderName}, deploy ${selectedBaseType} bases within ${playerCountryFeature.properties.name}.`);
        hideOverlays();
      });
    }

    function setup() {
      const width = mapWrap.clientWidth;
      const height = mapWrap.clientHeight;
      svg.attr('viewBox', `0 0 ${width} ${height}`);

      const projectionFactory = d3.geoRobinson ? d3.geoRobinson : d3.geoNaturalEarth1;
      const projection = projectionFactory().fitExtent([[15, 15], [width - 15, height - 15]], { type: 'Sphere' });
      const path = d3.geoPath(projection);

      const root = svg.append('g');
      countriesLayer = root.append('g').attr('id', 'countriesLayer');
      const citiesLayer = root.append('g').attr('id', 'citiesLayer');
      const basesLayer = root.append('g').attr('id', 'basesLayer');

      async function loadCountriesData() {
        const geoJsonSources = [
          'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/dist/countries.geo.json',
          'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'
        ];

        for (const url of geoJsonSources) {
          try {
            const geoJson = await d3.json(url);
            if (geoJson && Array.isArray(geoJson.features) && geoJson.features.length) {
              return geoJson.features.map((feature) => {
                const countryName =
                  feature.properties?.name ||
                  feature.properties?.ADMIN ||
                  feature.properties?.admin ||
                  feature.properties?.name_long ||
                  'Unknown Country';
                return {
                  ...feature,
                  properties: {
                    ...(feature.properties || {}),
                    name: countryName
                  }
                };
              });
            }
          } catch (error) {
            console.warn(`GeoJSON source failed: ${url}`, error);
          }
        }

        const [worldData, namesData] = await Promise.all([
          d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
          d3.tsv('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv')
        ]);
        const nameById = new Map(namesData.map((row) => [row.id, row.name]));
        return topojson.feature(worldData, worldData.objects.countries).features.map((c) => ({
          ...c,
          properties: {
            ...(c.properties || {}),
            name: nameById.get(c.id) || `Country ${c.id}`
          }
        }));
      }

      loadCountriesData().then((loadedCountries) => {
        countries = loadedCountries;

        countriesLayer
          .selectAll('path')
          .data(countries)
          .enter()
          .append('path')
          .attr('class', 'country')
          .attr('d', path)
          .on('mousemove', function (event, d) {
            tooltip.style.opacity = 1;
            tooltip.style.left = `${event.clientX - mapWrap.getBoundingClientRect().left}px`;
            tooltip.style.top = `${event.clientY - mapWrap.getBoundingClientRect().top}px`;
            tooltip.textContent = d.properties.name;
          })
          .on('mouseleave', () => { tooltip.style.opacity = 0; })
          .on('click', function (event, d) {
            event.stopPropagation();
            if (!playerCountryFeature) {
              setStatus('Use Play in the main menu to choose your country first.', true);
              return;
            }
            if (d.id !== playerCountryFeature.id) {
              setStatus(`You are locked to ${playerCountryFeature.properties.name}.`, true);
              return;
            }
            selectedCountryFeature = d;
            selectedCountryLabel.textContent = `Selected: ${d.properties.name}`;
            renderCityList(d.properties.name);
            updateCountryStyles();
          });

        citiesLayer
          .selectAll('circle')
          .data(majorCities)
          .enter()
          .append('circle')
          .attr('class', 'city')
          .attr('r', 3)
          .attr('cx', (d) => projection([d.lon, d.lat])[0])
          .attr('cy', (d) => projection([d.lon, d.lat])[1])
          .append('title')
          .text((d) => `${d.name}, ${d.country}`);

        function renderBases() {
          const points = basesLayer.selectAll('g.base-point').data(bases, (_, i) => i);
          const enter = points.enter().append('g').attr('class', 'base-point');
          enter
            .append('rect')
            .attr('class', 'base')
            .attr('width', 8)
            .attr('height', 8)
            .attr('x', -4)
            .attr('y', -4)
            .attr('rx', 1.5)
            .attr('fill', (d) => baseTypes.find((b) => b.key === d.type).color);
          enter.append('title').text((d) => `${d.type} base in ${d.country}`);
          points.merge(enter).attr('transform', (d) => {
            const [x, y] = projection(d.lonLat);
            return `translate(${x}, ${y})`;
          });
        }

        svg.on('click', function (event) {
          const [x, y] = d3.pointer(event, this);
          const lonLat = projection.invert([x, y]);
          if (!lonLat) return;

          if (!playerCountryFeature) {
            setStatus('Start from Play in the main menu before placing bases.', true);
            return;
          }

          const clickedCountry = countries.find((country) => pointInsideCountry(country, lonLat));
          if (!clickedCountry || clickedCountry.id !== playerCountryFeature.id) {
            setStatus(`Place bases only inside ${playerCountryFeature.properties.name}.`, true);
            return;
          }

          bases.push({ type: selectedBaseType, country: playerCountryFeature.properties.name, lonLat });
          renderBases();
          setStatus(`${selectedBaseType} base placed in ${playerCountryFeature.properties.name}.`);
        });

        renderCityList();
        createBaseButtons();
        populateCountrySelect();
        setOverlay('mainMenu');
      }).catch((err) => {
        console.error(err);
        setStatus('Map data failed to load from all sources. Check internet access and refresh.', true);
      });

      if (!d3.geoRobinson) {
        setStatus('Robinson projection plugin unavailable; using Natural Earth fallback.', true);
      }
    }

    applySettingsUI();
    attachMenuHandlers();
    setup();
  
