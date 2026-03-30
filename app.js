const GAME_START_ISO = '2026-01-01T00:00:00Z';
const DAY_MS = 24 * 60 * 60 * 1000;

const BASE_BUILD_DURATIONS_MS = {
  ground: 3 * DAY_MS,
  air: 5 * DAY_MS,
  naval: 7 * DAY_MS,
  antiAir: 2 * DAY_MS
};

class GameClock {
  constructor({ startTimeMs, speed = 1 }) {
    this.currentTimeMs = startTimeMs;
    this.speed = speed;
  }

  pause() {
    this.speed = 0;
  }

  resume() {
    if (this.speed === 0) this.speed = 1;
  }

  setSpeed(multiplier) {
    this.speed = Math.max(0, Number(multiplier) || 0);
  }

  getCurrentTime() {
    return this.currentTimeMs;
  }

  advanceBy(realDeltaMs) {
    const safeDelta = Math.max(0, realDeltaMs || 0);
    const gameDelta = safeDelta * this.speed;
    this.currentTimeMs += gameDelta;
    return gameDelta;
  }

  update(realDeltaMs) {
    return this.advanceBy(realDeltaMs);
  }

  skipGameTime(gameDeltaMs) {
    const safeDelta = Math.max(0, gameDeltaMs || 0);
    this.currentTimeMs += safeDelta;
    return safeDelta;
  }
}

class TaskScheduler {
  constructor(gameState) {
    this.gameState = gameState;
    this.tasks = [];
    this.nextTaskId = 1;
  }

  schedule({ executeAt, type, payload, handler }) {
    const task = {
      id: this.nextTaskId++,
      executeAt,
      type,
      payload,
      handler
    };

    this.tasks.push(task);
    this.tasks.sort((a, b) => a.executeAt - b.executeAt || a.id - b.id);
    this.syncPendingTasks();
    return task.id;
  }

  processDue(currentTimeMs) {
    const dueTasks = [];
    while (this.tasks.length && this.tasks[0].executeAt <= currentTimeMs) {
      dueTasks.push(this.tasks.shift());
    }

    dueTasks.forEach((task) => task.handler(task.payload, task));
    this.syncPendingTasks();
  }

  syncPendingTasks() {
    this.gameState.pendingTasks = this.tasks.map((task) => ({
      id: task.id,
      type: task.type,
      executeAt: task.executeAt,
      payload: task.payload
    }));
  }
}

const gameState = {
  selectedPlayerCountry: null,
  currentTimeMs: Date.parse(GAME_START_ISO),
  simulationSpeed: 1,
  bases: [],
  cities: [],
  units: [],
  pendingTasks: [],
  treasury: 0,
  nextBaseId: 1
};

const gameClock = new GameClock({
  startTimeMs: gameState.currentTimeMs,
  speed: gameState.simulationSpeed
});

const scheduler = new TaskScheduler(gameState);

const svg = d3.select('#map');
const mapWrap = document.getElementById('mapWrap');
const tooltip = document.getElementById('tooltip');
const selectedCountryLabel = document.getElementById('selectedCountry');
const cityList = document.getElementById('cityList');
const statusLabel = document.getElementById('status');
const baseButtons = document.getElementById('baseButtons');
const playerProfile = document.getElementById('playerProfile');
const gameDateTime = document.getElementById('gameDateTime');
const simSpeedLabel = document.getElementById('simSpeedLabel');

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
const timeControlButtons = document.getElementById('timeControlButtons');
const skipDayBtn = document.getElementById('skipDayBtn');
const skipWeekBtn = document.getElementById('skipWeekBtn');
const skipMonthBtn = document.getElementById('skipMonthBtn');

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
let countries = [];
let countriesLayer;
let basesLayer;
let projection;
let playStep = 1;
let lastFrameTime = performance.now();

const settingsState = {
  music: Number(localStorage.getItem('musicVolume') ?? 40),
  sfx: Number(localStorage.getItem('sfxVolume') ?? 60)
};

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function refreshTimeHud() {
  gameDateTime.textContent = `Date: ${formatDateTime(gameState.currentTimeMs)}`;
  simSpeedLabel.textContent = `Speed: ${gameState.simulationSpeed === 0 ? 'Paused' : `${gameState.simulationSpeed}x`}`;
  timeControlButtons.querySelectorAll('button').forEach((btn) => {
    const speed = Number(btn.dataset.speed);
    btn.classList.toggle('active', speed === gameState.simulationSpeed);
  });
}

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

function updateCountryStyles() {
  if (!countriesLayer) return;
  countriesLayer
    .selectAll('path')
    .classed('selected', (d) => selectedCountryFeature && d.id === selectedCountryFeature.id)
    .classed('locked', (d) => gameState.selectedPlayerCountry && d.id !== gameState.selectedPlayerCountry.id);
}

function setPlayerCountry(countryFeature) {
  gameState.selectedPlayerCountry = countryFeature;
  selectedCountryFeature = countryFeature;
  selectedCountryLabel.textContent = `Selected: ${countryFeature.properties.name}`;
  renderCityList(countryFeature.properties.name);
  updateCountryStyles();
}

function pointInsideCountry(countryFeature, lonLatPoint) {
  if (!countryFeature) return false;
  return d3.geoContains(countryFeature, lonLatPoint);
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
      if (gameState.selectedPlayerCountry) {
        setStatus(`Build mode: ${type.label}. Click inside ${gameState.selectedPlayerCountry.properties.name}.`);
      }
    });
    baseButtons.appendChild(btn);
  });
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

function setSimulationSpeed(multiplier) {
  gameClock.setSpeed(multiplier);
  gameState.simulationSpeed = gameClock.speed;
  refreshTimeHud();
}

function attachTimeControls() {
  timeControlButtons.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setSimulationSpeed(Number(btn.dataset.speed)));
  });

  skipDayBtn.addEventListener('click', () => skipGameTime(1 * DAY_MS));
  skipWeekBtn.addEventListener('click', () => skipGameTime(7 * DAY_MS));
  skipMonthBtn.addEventListener('click', () => skipGameTime(30 * DAY_MS));
}

function skipGameTime(deltaGameMs) {
  gameClock.skipGameTime(deltaGameMs);
  gameState.currentTimeMs = gameClock.getCurrentTime();
  scheduler.processDue(gameState.currentTimeMs);
  renderBases();
  refreshTimeHud();
}

function createBase({ type, lonLat }) {
  const now = gameState.currentTimeMs;
  const buildDurationMs = BASE_BUILD_DURATIONS_MS[type] ?? 3 * DAY_MS;
  const base = {
    id: gameState.nextBaseId++,
    ownerCountry: gameState.selectedPlayerCountry.properties.name,
    type,
    lonLat,
    status: 'building',
    createdAt: now,
    buildStartedAt: now,
    buildCompleteAt: now + buildDurationMs
  };

  gameState.bases.push(base);

  scheduler.schedule({
    executeAt: base.buildCompleteAt,
    type: 'BASE_CONSTRUCTION_COMPLETE',
    payload: { baseId: base.id },
    handler: ({ baseId }) => {
      const targetBase = gameState.bases.find((entry) => entry.id === baseId);
      if (!targetBase || targetBase.status === 'active') return;
      targetBase.status = 'active';
      setStatus(`${targetBase.type} base is now ACTIVE in ${targetBase.ownerCountry}.`);
      renderBases();
    }
  });

  return base;
}

function renderBases() {
  if (!basesLayer || !projection) return;

  const points = basesLayer.selectAll('g.base-point').data(gameState.bases, (d) => d.id);
  const enter = points.enter().append('g').attr('class', 'base-point');

  enter
    .append('rect')
    .attr('class', 'base')
    .attr('width', 8)
    .attr('height', 8)
    .attr('x', -4)
    .attr('y', -4)
    .attr('rx', 1.5);

  enter.append('title');

  points
    .merge(enter)
    .attr('transform', (d) => {
      const [x, y] = projection(d.lonLat);
      return `translate(${x}, ${y})`;
    })
    .select('rect')
    .attr('fill', (d) => baseTypes.find((b) => b.key === d.type).color)
    .attr('class', (d) => `base ${d.status}`);

  points
    .merge(enter)
    .select('title')
    .text((d) => `${d.type} base (${d.status}) - ${d.ownerCountry}`);
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
      alert('Please enter a leader name.');
      return;
    }

    playerProfile.textContent = `Leader ${leaderName} of ${gameState.selectedPlayerCountry.properties.name}`;
    setStatus(`Commander ${leaderName}, place bases and run time to complete construction.`);
    hideOverlays();
  });
}

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
  return topojson.feature(worldData, worldData.objects.countries).features.map((country) => ({
    ...country,
    properties: {
      ...(country.properties || {}),
      name: nameById.get(country.id) || `Country ${country.id}`
    }
  }));
}

function startSimulationLoop() {
  const tick = (now) => {
    const realDeltaMs = now - lastFrameTime;
    lastFrameTime = now;

    gameClock.update(realDeltaMs);
    gameState.currentTimeMs = gameClock.getCurrentTime();
    gameState.simulationSpeed = gameClock.speed;

    scheduler.processDue(gameState.currentTimeMs);
    refreshTimeHud();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

async function setupMap() {
  const width = mapWrap.clientWidth;
  const height = mapWrap.clientHeight;
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const projectionFactory = d3.geoRobinson ? d3.geoRobinson : d3.geoNaturalEarth1;
  projection = projectionFactory().fitExtent([[15, 15], [width - 15, height - 15]], { type: 'Sphere' });
  const path = d3.geoPath(projection);

  const root = svg.append('g');
  countriesLayer = root.append('g').attr('id', 'countriesLayer');
  const citiesLayer = root.append('g').attr('id', 'citiesLayer');
  basesLayer = root.append('g').attr('id', 'basesLayer');

  countries = await loadCountriesData();

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
    .on('mouseleave', () => {
      tooltip.style.opacity = 0;
    })
    .on('click', function (event, d) {
      event.stopPropagation();
      if (!gameState.selectedPlayerCountry) {
        setStatus('Use Play in the main menu to choose your country first.', true);
        return;
      }
      if (d.id !== gameState.selectedPlayerCountry.id) {
        setStatus(`You are locked to ${gameState.selectedPlayerCountry.properties.name}.`, true);
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

  svg.on('click', function (event) {
    const [x, y] = d3.pointer(event, this);
    const lonLat = projection.invert([x, y]);
    if (!lonLat) return;

    if (!gameState.selectedPlayerCountry) {
      setStatus('Start from Play in the main menu before placing bases.', true);
      return;
    }

    const clickedCountry = countries.find((country) => pointInsideCountry(country, lonLat));
    if (!clickedCountry || clickedCountry.id !== gameState.selectedPlayerCountry.id) {
      setStatus(`Place bases only inside ${gameState.selectedPlayerCountry.properties.name}.`, true);
      return;
    }

    const base = createBase({ type: selectedBaseType, lonLat });
    renderBases();

    const completeText = formatDateTime(base.buildCompleteAt);
    setStatus(`${base.type} base started construction. ETA: ${completeText}.`);
  });

  renderCityList();
  createBaseButtons();
  populateCountrySelect();
  setOverlay('mainMenu');

  if (!d3.geoRobinson) {
    setStatus('Robinson projection plugin unavailable; using Natural Earth fallback.', true);
  }
}

async function init() {
  applySettingsUI();
  attachMenuHandlers();
  attachTimeControls();
  refreshTimeHud();

  try {
    await setupMap();
  } catch (err) {
    console.error(err);
    setStatus('Map data failed to load from all sources. Check internet access and refresh.', true);
  }

  startSimulationLoop();
}

init();
