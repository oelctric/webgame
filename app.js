const GAME_START_ISO = '2026-01-01T00:00:00Z';
const DAY_MS = 24 * 60 * 60 * 1000;
const GAME_TIME_SCALE = 600; // 1 real second = 10 in-game minutes at 1x

const BASE_BUILD_DURATIONS_MS = {
  ground: 3 * DAY_MS,
  air: 5 * DAY_MS,
  naval: 7 * DAY_MS,
  antiAir: 2 * DAY_MS
};

const UNIT_DEFINITIONS = {
  infantry: { label: 'Infantry', domain: 'ground', durationMs: 2 * DAY_MS, health: 100, strength: 20 },
  armor: { label: 'Armor', domain: 'ground', durationMs: 5 * DAY_MS, health: 150, strength: 50 },
  fighter: { label: 'Fighter', domain: 'air', durationMs: 4 * DAY_MS, health: 90, strength: 45 },
  bomber: { label: 'Bomber', domain: 'air', durationMs: 6 * DAY_MS, health: 120, strength: 60 },
  patrolBoat: { label: 'Patrol Boat', domain: 'naval', durationMs: 5 * DAY_MS, health: 130, strength: 40 },
  destroyer: { label: 'Destroyer', domain: 'naval', durationMs: 10 * DAY_MS, health: 220, strength: 85 }
};

const BASE_TO_DOMAIN = {
  ground: 'ground',
  air: 'air',
  naval: 'naval',
  antiAir: null
};

const UNIT_SPEED_KM_PER_DAY = {
  infantry: 220,
  armor: 420,
  fighter: 2400,
  bomber: 1800,
  patrolBoat: 480,
  destroyer: 520
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
    const gameDelta = safeDelta * this.speed * GAME_TIME_SCALE;
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

class ProductionSystem {
  constructor(gameState, scheduler) {
    this.gameState = gameState;
    this.scheduler = scheduler;
  }

  getAllowedUnitsForBase(base) {
    const domain = BASE_TO_DOMAIN[base.type];
    if (!domain) return [];
    return Object.entries(UNIT_DEFINITIONS)
      .filter(([, def]) => def.domain === domain)
      .map(([key, def]) => ({ key, ...def }));
  }

  queueUnit(baseId, unitType) {
    const base = this.gameState.bases.find((entry) => entry.id === baseId);
    const unitDef = UNIT_DEFINITIONS[unitType];
    if (!base || !unitDef) return { ok: false, message: 'Invalid base or unit type.' };
    if (base.status !== 'active') return { ok: false, message: 'Base must be active before production can begin.' };

    const baseDomain = BASE_TO_DOMAIN[base.type];
    if (!baseDomain) return { ok: false, message: 'Anti-air bases cannot produce units.' };
    if (unitDef.domain !== baseDomain) return { ok: false, message: `${base.type} base cannot produce ${unitDef.label}.` };

    const unit = {
      id: this.gameState.nextUnitId++,
      ownerCountry: base.ownerCountry,
      type: unitType,
      domain: unitDef.domain,
      status: 'queued',
      createdAt: this.gameState.currentTimeMs,
      activatedAt: null,
      sourceBaseId: base.id,
      lonLat: [...base.lonLat],
      health: unitDef.health,
      strength: unitDef.strength
    };

    this.gameState.units.push(unit);
    base.production.queue.push(unit.id);
    this.tryStartNext(base.id);
    return { ok: true, unit };
  }

  tryStartNext(baseId) {
    const base = this.gameState.bases.find((entry) => entry.id === baseId);
    if (!base || base.status !== 'active') return;
    if (base.production.currentUnitId) return;
    if (!base.production.queue.length) return;

    const unitId = base.production.queue.shift();
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!unit) return;

    const unitDef = UNIT_DEFINITIONS[unit.type];
    base.production.currentUnitId = unit.id;
    base.production.currentCompleteAt = this.gameState.currentTimeMs + unitDef.durationMs;

    this.scheduler.schedule({
      executeAt: base.production.currentCompleteAt,
      type: 'UNIT_PRODUCTION_COMPLETE',
      payload: { baseId: base.id, unitId: unit.id },
      handler: ({ baseId: doneBaseId, unitId: doneUnitId }) => this.completeProduction(doneBaseId, doneUnitId)
    });
  }

  completeProduction(baseId, unitId) {
    const base = this.gameState.bases.find((entry) => entry.id === baseId);
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!base || !unit) return;

    unit.status = 'active';
    unit.activatedAt = this.gameState.currentTimeMs;
    unit.lonLat = [base.lonLat[0] + (unit.id % 4) * 0.35, base.lonLat[1] + ((unit.id % 3) - 1) * 0.25];

    base.production.currentUnitId = null;
    base.production.currentCompleteAt = null;
    this.tryStartNext(baseId);
    setStatus(`${UNIT_DEFINITIONS[unit.type].label} completed at base #${base.id}.`);
    renderProductionPanel();
    renderUnits();
    renderSelectedUnitPanel();
  }
}

class MovementSystem {
  constructor(gameState, scheduler) {
    this.gameState = gameState;
    this.scheduler = scheduler;
  }

  issueMoveOrder(unitId, targetLonLat) {
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!unit) return { ok: false, message: 'Select a valid unit first.' };
    if (unit.status !== 'active') return { ok: false, message: 'Only active units can receive new move orders.' };

    const startLonLat = this.getDisplayLonLat(unit);
    const distanceKm = d3.geoDistance(startLonLat, targetLonLat) * 6371;
    const speed = UNIT_SPEED_KM_PER_DAY[unit.type] || 300;
    const durationMs = Math.max(1, (distanceKm / speed) * DAY_MS);

    unit.status = 'moving';
    unit.movement = {
      startLonLat,
      targetLonLat: [...targetLonLat],
      startedAt: this.gameState.currentTimeMs,
      arrivalAt: this.gameState.currentTimeMs + durationMs,
      speedKmPerDay: speed,
      taskId: null
    };

    const taskId = this.scheduler.schedule({
      executeAt: unit.movement.arrivalAt,
      type: 'UNIT_MOVE_COMPLETE',
      payload: { unitId: unit.id },
      handler: ({ unitId: doneUnitId }) => this.completeMove(doneUnitId)
    });

    unit.movement.taskId = taskId;
    return { ok: true, unit };
  }

  completeMove(unitId) {
    const unit = this.gameState.units.find((entry) => entry.id === unitId);
    if (!unit || !unit.movement) return;
    unit.lonLat = [...unit.movement.targetLonLat];
    unit.movement = null;
    unit.status = 'active';
    setStatus(`${UNIT_DEFINITIONS[unit.type].label} arrived at destination.`);
    renderUnits();
    renderSelectedUnitPanel();
  }

  getDisplayLonLat(unit) {
    if (!unit.movement || unit.status !== 'moving') return unit.lonLat;
    const { startLonLat, targetLonLat, startedAt, arrivalAt } = unit.movement;
    const total = Math.max(1, arrivalAt - startedAt);
    const progress = Math.min(1, Math.max(0, (this.gameState.currentTimeMs - startedAt) / total));
    return [
      startLonLat[0] + (targetLonLat[0] - startLonLat[0]) * progress,
      startLonLat[1] + (targetLonLat[1] - startLonLat[1]) * progress
    ];
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
  nextBaseId: 1,
  nextUnitId: 1,
  selectedBaseId: null,
  selectedUnitId: null,
  moveMode: false
};

const gameClock = new GameClock({
  startTimeMs: gameState.currentTimeMs,
  speed: gameState.simulationSpeed
});

const scheduler = new TaskScheduler(gameState);
const productionSystem = new ProductionSystem(gameState, scheduler);
const movementSystem = new MovementSystem(gameState, scheduler);

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
const prodBaseLabel = document.getElementById('prodBaseLabel');
const prodUnitButtons = document.getElementById('prodUnitButtons');
const prodCurrent = document.getElementById('prodCurrent');
const prodQueue = document.getElementById('prodQueue');
const unitCount = document.getElementById('unitCount');
const unitList = document.getElementById('unitList');
const selectedUnitLabel = document.getElementById('selectedUnitLabel');
const selectedUnitMeta = document.getElementById('selectedUnitMeta');
const moveUnitBtn = document.getElementById('moveUnitBtn');
const clearUnitSelectionBtn = document.getElementById('clearUnitSelectionBtn');
const moveModeStatus = document.getElementById('moveModeStatus');

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

let selectedBaseType = null;
let selectedCountryFeature = null;
let countries = [];
let countriesLayer;
let basesLayer;
let unitsLayer;
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
  if (gameState.simulationSpeed === 0) {
    simSpeedLabel.textContent = 'Speed: Paused';
  } else {
    const gameMinutesPerRealSecond = (GAME_TIME_SCALE * gameState.simulationSpeed) / (60 * 1000) * 1000;
    simSpeedLabel.textContent = `Speed: ${gameState.simulationSpeed}x (${gameMinutesPerRealSecond.toFixed(0)} game min/sec)`;
  }
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
  gameState.selectedBaseId = null;
  gameState.selectedUnitId = null;
  gameState.moveMode = false;
  selectedCountryLabel.textContent = `Selected: ${countryFeature.properties.name}`;
  renderCityList(countryFeature.properties.name);
  updateCountryStyles();
  renderProductionPanel();
  renderSelectedUnitPanel();
}

function pointInsideCountry(countryFeature, lonLatPoint) {
  if (!countryFeature) return false;
  return d3.geoContains(countryFeature, lonLatPoint);
}

function createBaseButtons() {
  baseButtons.innerHTML = '';
  const noneBtn = document.createElement('button');
  noneBtn.textContent = 'No Build';
  noneBtn.classList.toggle('active', selectedBaseType === null);
  noneBtn.addEventListener('click', () => {
    selectedBaseType = null;
    baseButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === noneBtn));
    setStatus('Build mode off. You can inspect/select without placing bases.');
  });
  baseButtons.appendChild(noneBtn);

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
  setStatus(gameState.simulationSpeed === 0
    ? 'Simulation paused.'
    : `Simulation speed set to ${gameState.simulationSpeed}x.`);
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
    buildCompleteAt: now + buildDurationMs,
    production: {
      currentUnitId: null,
      currentCompleteAt: null,
      queue: []
    }
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
      renderProductionPanel();
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
    .on('click', (event, d) => {
      event.stopPropagation();
      gameState.selectedBaseId = d.id;
      renderBases();
      renderProductionPanel();
    })
    .select('rect')
    .attr('fill', (d) => baseTypes.find((b) => b.key === d.type).color)
    .attr('class', (d) => `base ${d.status} ${gameState.selectedBaseId === d.id ? 'selected-base' : ''}`);

  points
    .merge(enter)
    .select('title')
    .text((d) => `${d.type} base (${d.status}) - ${d.ownerCountry}`);
}

function renderUnits() {
  const visibleUnits = gameState.units.filter((unit) => unit.status === 'active' || unit.status === 'moving');
  unitCount.textContent = `Total units: ${visibleUnits.length}`;
  unitList.innerHTML = '';

  if (!visibleUnits.length) {
    const li = document.createElement('li');
    li.textContent = 'No units yet.';
    unitList.appendChild(li);
  } else {
    visibleUnits.slice(-8).forEach((unit) => {
      const li = document.createElement('li');
      li.textContent = `${UNIT_DEFINITIONS[unit.type].label} (${unit.status})`;
      unitList.appendChild(li);
    });
  }

  if (!unitsLayer || !projection) return;
  const markers = unitsLayer.selectAll('circle.unit-point').data(visibleUnits, (d) => d.id);
  const enter = markers.enter().append('circle').attr('class', 'unit-marker unit-point').attr('r', 2.3);
  enter.append('title');
  markers
    .merge(enter)
    .attr('class', (d) => `unit-marker unit-point ${gameState.selectedUnitId === d.id ? 'selected' : ''}`)
    .attr('cx', (d) => projection(movementSystem.getDisplayLonLat(d))[0])
    .attr('cy', (d) => projection(movementSystem.getDisplayLonLat(d))[1])
    .on('click', (event, d) => {
      event.stopPropagation();
      gameState.selectedUnitId = d.id;
      gameState.moveMode = false;
      renderSelectedUnitPanel();
      renderUnits();
    })
    .select('title')
    .text((d) => `${UNIT_DEFINITIONS[d.type].label} (${d.domain}) - ${d.status}`);
  markers.exit().remove();
}

function renderSelectedUnitPanel() {
  const unit = gameState.units.find((entry) => entry.id === gameState.selectedUnitId);
  if (!unit) {
    selectedUnitLabel.textContent = 'No unit selected.';
    selectedUnitMeta.textContent = 'Status: --';
  } else {
    selectedUnitLabel.textContent = `Unit #${unit.id}: ${UNIT_DEFINITIONS[unit.type].label} (${unit.ownerCountry})`;
    if (unit.status === 'moving' && unit.movement) {
      selectedUnitMeta.textContent = `Status: moving • ETA ${formatDateTime(unit.movement.arrivalAt)} • Target ${unit.movement.targetLonLat.map((n) => n.toFixed(1)).join(', ')}`;
    } else {
      selectedUnitMeta.textContent = `Status: active • Position ${unit.lonLat.map((n) => n.toFixed(1)).join(', ')}`;
    }
  }
  moveModeStatus.textContent = `Move mode: ${gameState.moveMode ? 'On (click map destination)' : 'Off'}`;
}

function renderProductionPanel() {
  const base = gameState.bases.find((entry) => entry.id === gameState.selectedBaseId);
  prodUnitButtons.innerHTML = '';
  prodQueue.innerHTML = '';

  if (!base) {
    prodBaseLabel.textContent = 'Select a base to manage production.';
    prodCurrent.textContent = 'Current: --';
    return;
  }

  prodBaseLabel.textContent = `Base #${base.id} (${base.type}) - ${base.status}`;
  const currentUnit = base.production.currentUnitId
    ? gameState.units.find((unit) => unit.id === base.production.currentUnitId)
    : null;

  if (currentUnit) {
    const remainingMs = Math.max(0, base.production.currentCompleteAt - gameState.currentTimeMs);
    const remainingDays = (remainingMs / DAY_MS).toFixed(2);
    prodCurrent.textContent = `Current: ${UNIT_DEFINITIONS[currentUnit.type].label} (${remainingDays} days left)`;
  } else {
    prodCurrent.textContent = 'Current: Idle';
  }

  base.production.queue.forEach((unitId) => {
    const unit = gameState.units.find((entry) => entry.id === unitId);
    if (!unit) return;
    const li = document.createElement('li');
    li.textContent = UNIT_DEFINITIONS[unit.type].label;
    prodQueue.appendChild(li);
  });

  if (!base.production.queue.length) {
    const li = document.createElement('li');
    li.textContent = 'Queue empty';
    prodQueue.appendChild(li);
  }

  const allowedUnits = productionSystem.getAllowedUnitsForBase(base);
  if (!allowedUnits.length) {
    const info = document.createElement('p');
    info.textContent = 'This base cannot produce units.';
    prodUnitButtons.appendChild(info);
    return;
  }

  allowedUnits.forEach((unit) => {
    const btn = document.createElement('button');
    btn.textContent = `Queue ${unit.label}`;
    btn.addEventListener('click', () => {
      const result = productionSystem.queueUnit(base.id, unit.key);
      if (!result.ok) {
        setStatus(result.message, true);
      } else {
        setStatus(`${unit.label} queued at base #${base.id}.`);
      }
      renderProductionPanel();
      renderUnits();
    });
    prodUnitButtons.appendChild(btn);
  });
}

function refreshProductionTicker() {
  const base = gameState.bases.find((entry) => entry.id === gameState.selectedBaseId);
  if (!base) return;
  const currentUnit = base.production.currentUnitId
    ? gameState.units.find((unit) => unit.id === base.production.currentUnitId)
    : null;
  if (!currentUnit) return;
  const remainingMs = Math.max(0, base.production.currentCompleteAt - gameState.currentTimeMs);
  const remainingDays = (remainingMs / DAY_MS).toFixed(2);
  prodCurrent.textContent = `Current: ${UNIT_DEFINITIONS[currentUnit.type].label} (${remainingDays} days left)`;
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

function attachUnitControls() {
  moveUnitBtn.addEventListener('click', () => {
    if (!gameState.selectedUnitId) {
      setStatus('Select a unit first, then enable move mode.', true);
      return;
    }
    gameState.moveMode = true;
    renderSelectedUnitPanel();
    setStatus('Move mode enabled. Click destination on the map.');
  });

  clearUnitSelectionBtn.addEventListener('click', () => {
    gameState.selectedUnitId = null;
    gameState.moveMode = false;
    renderSelectedUnitPanel();
    renderUnits();
  });
}

async function loadCountriesData() {
  const geoJsonSources = [
    'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
    'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json'
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
    refreshProductionTicker();
    renderSelectedUnitPanel();
    renderUnits();

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
  unitsLayer = root.append('g').attr('id', 'unitsLayer');

  countries = await loadCountriesData();

  function placeBaseFromEvent(event) {
    const [x, y] = d3.pointer(event, svg.node());
    const lonLat = projection.invert([x, y]);
    if (!lonLat) return;

    if (gameState.moveMode && gameState.selectedUnitId) {
      const result = movementSystem.issueMoveOrder(gameState.selectedUnitId, lonLat);
      if (!result.ok) {
        setStatus(result.message, true);
      } else {
        const unitDef = UNIT_DEFINITIONS[result.unit.type];
        setStatus(`${unitDef.label} moving. ETA: ${formatDateTime(result.unit.movement.arrivalAt)}.`);
      }
      gameState.moveMode = false;
      renderSelectedUnitPanel();
      renderUnits();
      return;
    }

    if (!gameState.selectedPlayerCountry) {
      setStatus('Start from Play in the main menu before placing bases.', true);
      return;
    }

    if (!selectedBaseType) {
      setStatus('Build mode is off. Choose a base type to place a base.');
      return;
    }

    const clickedCountry = countries.find((country) => pointInsideCountry(country, lonLat));
    if (!clickedCountry || clickedCountry.id !== gameState.selectedPlayerCountry.id) {
      setStatus(`Place bases only inside ${gameState.selectedPlayerCountry.properties.name}.`, true);
      return;
    }

    const base = createBase({ type: selectedBaseType, lonLat });
    gameState.selectedBaseId = base.id;
    renderBases();
    renderProductionPanel();

    const completeText = formatDateTime(base.buildCompleteAt);
    setStatus(`${base.type} base started construction. ETA: ${completeText}.`);
  }

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

      // When already in-game and clicking inside your country, place a base.
      placeBaseFromEvent(event);
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
    placeBaseFromEvent(event);
  });

  renderCityList();
  createBaseButtons();
  populateCountrySelect();
  renderProductionPanel();
  renderUnits();
  renderSelectedUnitPanel();
  setOverlay('mainMenu');

  if (!d3.geoRobinson) {
    setStatus('Robinson projection plugin unavailable; using Natural Earth fallback.', true);
  }
}

async function init() {
  applySettingsUI();
  attachMenuHandlers();
  attachTimeControls();
  attachUnitControls();
  refreshTimeHud();
  renderSelectedUnitPanel();

  try {
    await setupMap();
  } catch (err) {
    console.error(err);
    setStatus('Map data failed to load from all sources. Check internet access and refresh.', true);
  }

  startSimulationLoop();
}

init();
