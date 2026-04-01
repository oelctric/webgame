// Module refactor note: core/data/systems code is split across script files loaded from index.html.
// This file retains runtime wiring, UI logic, and rendering flow.

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
  moveMode: false,
  attackMode: false,
  captureMode: false,
  selectedAsset: null,
  enemySpawned: false,
  aiCountries: [],
  aiStateByCountry: {},
  countries: {},
  selectedCountryForHud: null,
  diplomacy: {
    relationsByPair: {},
    lastSummary: 'No diplomacy events yet.'
  },
  negotiation: {
    ceasefiresByPair: {},
    tradeRestorationByPair: {},
    nextAgreementId: 0,
    lastSummary: 'No negotiated resolutions yet.'
  },
  policy: {
    lastTickAt: null,
    lastSummary: 'No policy changes yet.'
  },
  domestic: {
    lastTickAt: null,
    lastSummary: 'No domestic updates yet.'
  },
  political: {
    lastTickAt: null,
    lastSummary: 'No political updates yet.'
  },
  resources: {
    lastTickAt: null
  },
  trade: {
    flows: [],
    autoEnabled: TRADE_CONFIG.autoGenerationEnabled,
    lastTickAt: null
  },
  chokepoints: {
    points: [],
    lastSummary: 'No chokepoint updates yet.'
  },
  blocs: {
    items: [],
    nextBlocId: 1,
    lastSummary: 'No bloc updates yet.'
  },
  events: {
    active: [],
    recentLog: []
  },
  economy: {
    treasuryByCountry: {},
    lastTickAt: null,
    lastSummary: 'No economy tick yet.',
    started: false
  }
};

const gameClock = new GameClock({
  startTimeMs: gameState.currentTimeMs,
  speed: gameState.simulationSpeed
});

const scheduler = new TaskScheduler(gameState);
const countrySystem = new CountrySystem(gameState, scheduler);
const diplomacySystem = new DiplomacySystem(gameState, scheduler, countrySystem);
const eventSystem = new EventSystem(gameState, scheduler, countrySystem, diplomacySystem);
const resourceSystem = new ResourceSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem);
const chokepointSystem = new ChokepointSystem(gameState, scheduler, diplomacySystem);
const blocSystem = new BlocSystem(gameState, scheduler, diplomacySystem, countrySystem);
const tradeSystem = new TradeSystem(gameState, scheduler, countrySystem, diplomacySystem, chokepointSystem, blocSystem);
const negotiationSystem = new NegotiationSystem(gameState, scheduler, diplomacySystem, tradeSystem);
const policySystem = new PolicySystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem);
const domesticStateSystem = new DomesticStateSystem(gameState, scheduler, countrySystem, diplomacySystem, policySystem, eventSystem);
const politicalSystem = new PoliticalSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem);
const productionSystem = new ProductionSystem(gameState, scheduler, resourceSystem);
const movementSystem = new MovementSystem(gameState, scheduler, resourceSystem);
const combatSystem = new CombatSystem(gameState, scheduler, movementSystem, diplomacySystem, resourceSystem);
const captureSystem = new CaptureSystem(gameState, scheduler, movementSystem, diplomacySystem);
const economySystem = new EconomySystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem);
const aiSystem = new AISystem(gameState, scheduler, {
  productionSystem,
  movementSystem,
  combatSystem,
  captureSystem,
  economySystem,
  policySystem,
  diplomacySystem,
  resourceSystem,
  countrySystem,
  tradeSystem,
  chokepointSystem,
  blocSystem,
  eventSystem,
  negotiationSystem
});

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
const treasuryLabel = document.getElementById('treasuryLabel');
const economySummary = document.getElementById('economySummary');
const aiCountriesLabel = document.getElementById('aiCountriesLabel');
const countryHudName = document.getElementById('countryHudName');
const countryHudTreasury = document.getElementById('countryHudTreasury');
const countryHudPop = document.getElementById('countryHudPop');
const countryHudStability = document.getElementById('countryHudStability');
const countryHudOil = document.getElementById('countryHudOil');
const countryHudIndustry = document.getElementById('countryHudIndustry');
const countryHudManpower = document.getElementById('countryHudManpower');
const countryHudStrain = document.getElementById('countryHudStrain');
const countryHudAssets = document.getElementById('countryHudAssets');
const countryHudFlow = document.getElementById('countryHudFlow');
const diplomacyFocusCountry = document.getElementById('diplomacyFocusCountry');
const diplomacySummary = document.getElementById('diplomacySummary');
const diplomacyTargetCountry = document.getElementById('diplomacyTargetCountry');
const declareWarBtn = document.getElementById('declareWarBtn');
const makePeaceBtn = document.getElementById('makePeaceBtn');
const improveRelationsBtn = document.getElementById('improveRelationsBtn');
const worsenRelationsBtn = document.getElementById('worsenRelationsBtn');
const relationsList = document.getElementById('relationsList');
const sanctionsStateLabel = document.getElementById('sanctionsStateLabel');
const tradeStateLabel = document.getElementById('tradeStateLabel');
const sanctionLightBtn = document.getElementById('sanctionLightBtn');
const sanctionHeavyBtn = document.getElementById('sanctionHeavyBtn');
const liftSanctionsBtn = document.getElementById('liftSanctionsBtn');
const toggleTradeBtn = document.getElementById('toggleTradeBtn');
const negotiationSummary = document.getElementById('negotiationSummary');
const negotiationCountryA = document.getElementById('negotiationCountryA');
const negotiationCountryB = document.getElementById('negotiationCountryB');
const ceasefireDaysInput = document.getElementById('ceasefireDaysInput');
const tradeRestoreDaysInput = document.getElementById('tradeRestoreDaysInput');
const declareCeasefireBtn = document.getElementById('declareCeasefireBtn');
const signPeaceDealBtn = document.getElementById('signPeaceDealBtn');
const grantSanctionsReliefBtn = document.getElementById('grantSanctionsReliefBtn');
const borderDeEscalationBtn = document.getElementById('borderDeEscalationBtn');
const restoreTradeBtn = document.getElementById('restoreTradeBtn');
const negotiationStateList = document.getElementById('negotiationStateList');
const policyFocusCountry = document.getElementById('policyFocusCountry');
const policySummary = document.getElementById('policySummary');
const militaryPolicySelect = document.getElementById('militaryPolicySelect');
const industryPolicySelect = document.getElementById('industryPolicySelect');
const securityPolicySelect = document.getElementById('securityPolicySelect');
const applyPolicyBtn = document.getElementById('applyPolicyBtn');
const policyCostLabel = document.getElementById('policyCostLabel');
const domesticFocusCountry = document.getElementById('domesticFocusCountry');
const domesticStability = document.getElementById('domesticStability');
const domesticUnrest = document.getElementById('domesticUnrest');
const domesticWarWeariness = document.getElementById('domesticWarWeariness');
const domesticEconomicStress = document.getElementById('domesticEconomicStress');
const domesticLegitimacy = document.getElementById('domesticLegitimacy');
const domesticPublicSupport = document.getElementById('domesticPublicSupport');
const domesticEliteSupport = document.getElementById('domesticEliteSupport');
const domesticPoliticalLabel = document.getElementById('domesticPoliticalLabel');
const domesticTrend = document.getElementById('domesticTrend');
const eventSummary = document.getElementById('eventSummary');
const eventTypeSelect = document.getElementById('eventTypeSelect');
const eventTargetCountry = document.getElementById('eventTargetCountry');
const eventSecondaryCountry = document.getElementById('eventSecondaryCountry');
const triggerEventBtn = document.getElementById('triggerEventBtn');
const activeEventsList = document.getElementById('activeEventsList');
const eventLogList = document.getElementById('eventLogList');
const chokepointSummary = document.getElementById('chokepointSummary');
const chokepointSelect = document.getElementById('chokepointSelect');
const chokepointControllerSelect = document.getElementById('chokepointControllerSelect');
const chokepointOpenBtn = document.getElementById('chokepointOpenBtn');
const chokepointRestrictedBtn = document.getElementById('chokepointRestrictedBtn');
const chokepointBlockedBtn = document.getElementById('chokepointBlockedBtn');
const chokepointContestedToggleBtn = document.getElementById('chokepointContestedToggleBtn');
const assignChokepointControllerBtn = document.getElementById('assignChokepointControllerBtn');
const recomputeRoutePressureBtn = document.getElementById('recomputeRoutePressureBtn');
const chokepointList = document.getElementById('chokepointList');
const blocSummary = document.getElementById('blocSummary');
const selectedCountryBlocs = document.getElementById('selectedCountryBlocs');
const blocNameInput = document.getElementById('blocNameInput');
const blocTypeSelect = document.getElementById('blocTypeSelect');
const createBlocBtn = document.getElementById('createBlocBtn');
const blocSelect = document.getElementById('blocSelect');
const blocMemberCountrySelect = document.getElementById('blocMemberCountrySelect');
const addBlocMemberBtn = document.getElementById('addBlocMemberBtn');
const removeBlocMemberBtn = document.getElementById('removeBlocMemberBtn');
const dissolveBlocBtn = document.getElementById('dissolveBlocBtn');
const blocList = document.getElementById('blocList');
const tradeSummary = document.getElementById('tradeSummary');
const tradeBalanceSummary = document.getElementById('tradeBalanceSummary');
const toggleAutoTradeBtn = document.getElementById('toggleAutoTradeBtn');
const recomputeTradeBtn = document.getElementById('recomputeTradeBtn');
const tradeExporterSelect = document.getElementById('tradeExporterSelect');
const tradeImporterSelect = document.getElementById('tradeImporterSelect');
const tradeResourceSelect = document.getElementById('tradeResourceSelect');
const tradeAmountInput = document.getElementById('tradeAmountInput');
const forceTradeBtn = document.getElementById('forceTradeBtn');
const blockTradePairBtn = document.getElementById('blockTradePairBtn');
const tradeFlowsList = document.getElementById('tradeFlowsList');
const prodBaseLabel = document.getElementById('prodBaseLabel');
const prodUnitButtons = document.getElementById('prodUnitButtons');
const prodCurrent = document.getElementById('prodCurrent');
const prodQueue = document.getElementById('prodQueue');
const unitCount = document.getElementById('unitCount');
const unitList = document.getElementById('unitList');
const selectedUnitLabel = document.getElementById('selectedUnitLabel');
const selectedUnitMeta = document.getElementById('selectedUnitMeta');
const moveUnitBtn = document.getElementById('moveUnitBtn');
const attackUnitBtn = document.getElementById('attackUnitBtn');
const captureUnitBtn = document.getElementById('captureUnitBtn');
const clearUnitSelectionBtn = document.getElementById('clearUnitSelectionBtn');
const moveModeStatus = document.getElementById('moveModeStatus');
const attackModeStatus = document.getElementById('attackModeStatus');
const captureModeStatus = document.getElementById('captureModeStatus');
const selectedAssetStatus = document.getElementById('selectedAssetStatus');

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
let citiesLayer;
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

function refreshEconomyHud() {
  if (!gameState.selectedPlayerCountry) {
    treasuryLabel.textContent = 'Treasury: --';
    aiCountriesLabel.textContent = 'AI Countries: --';
    economySummary.textContent = 'Economy: --';
    return;
  }
  const country = gameState.selectedPlayerCountry.properties.name;
  const treasury = economySystem.getTreasury(country);
  treasuryLabel.textContent = `Treasury: ${treasury.toLocaleString()}`;
  aiCountriesLabel.textContent = `AI Countries: ${gameState.aiCountries.length ? gameState.aiCountries.join(', ') : 'none'}`;
  economySummary.textContent = `Economy: ${gameState.economy.lastSummary}`;
}

function refreshCountryHud() {
  const countryName = gameState.selectedCountryForHud
    || (gameState.selectedPlayerCountry && gameState.selectedPlayerCountry.properties.name);
  if (!countryName) {
    countryHudName.textContent = 'Country: --';
    countryHudTreasury.textContent = 'Treasury: --';
    countryHudPop.textContent = 'Population: --';
    countryHudStability.textContent = 'Stability: --';
    countryHudOil.textContent = 'Oil: --';
    countryHudIndustry.textContent = 'Industry: --';
    countryHudManpower.textContent = 'Manpower: --';
    countryHudStrain.textContent = 'Resource strain: --';
    countryHudAssets.textContent = 'Cities/Bases/Units: --';
    countryHudFlow.textContent = 'Income/Upkeep/Net: --';
    return;
  }
  const country = countrySystem.ensureCountry(countryName);
  const aiState = gameState.aiStateByCountry[countryName];
  const aiPosture = aiState?.posture;
  const strategicGoal = aiState?.strategicGoal;
  countryHudName.textContent = `Country: ${country.name}${country.aiControlled ? ` (AI${strategicGoal ? `: ${strategicGoal}` : ''}${aiPosture ? ` / ${aiPosture}` : ''})` : ''}`;
  countryHudTreasury.textContent = `Treasury: ${Math.round(country.treasury).toLocaleString()}`;
  countryHudPop.textContent = `Population: ${Math.round(country.population).toLocaleString()}`;
  countryHudStability.textContent = `Stability: ${country.stability.toFixed(1)}`;
  countryHudOil.textContent = `Oil: ${country.oil.toFixed(1)} (+${country.oilPerTick.toFixed(1)}/day)`;
  countryHudIndustry.textContent = `Industry: ${country.industrialCapacity.toFixed(1)}`;
  countryHudManpower.textContent = `Manpower: pool ${Math.round(country.manpowerPool).toLocaleString()} (+${Math.round(country.manpowerRegenPerTick)}/day), capacity ${Math.round(country.manpower).toLocaleString()}`;
  const strainFlags = [];
  if (country.oil < RESOURCE_CONFIG.oilShortageThreshold) strainFlags.push('oil shortage');
  if (country.manpowerPool < 1200) strainFlags.push('manpower shortage');
  if (country.industrialCapacity < 22) strainFlags.push('industrial strain');
  const aiReason = country.aiControlled && aiState?.strategicReason ? ` • AI rationale: ${aiState.strategicReason}` : '';
  countryHudStrain.textContent = `Resource strain: ${strainFlags.length ? strainFlags.join(', ') : 'none'}${aiReason}`;
  countryHudAssets.textContent = `Cities/Bases/Units: ${country.controlledCityIds.length}/${country.controlledBaseIds.length}/${country.controlledUnitIds.length}`;
  countryHudFlow.textContent = `Income/Upkeep/Net: +${country.incomePerTick}/-${country.upkeepPerTick}/${country.netPerTick >= 0 ? '+' : ''}${country.netPerTick}`;
}

function getDiplomacyFocusCountry() {
  return gameState.selectedCountryForHud
    || (gameState.selectedPlayerCountry && gameState.selectedPlayerCountry.properties.name);
}

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

function refreshPolicyHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    policyFocusCountry.textContent = 'Policy for: --';
    policySummary.textContent = 'Policy: --';
    policyCostLabel.textContent = 'Daily policy cost: --';
    [militaryPolicySelect, industryPolicySelect, securityPolicySelect, applyPolicyBtn].forEach((el) => { el.disabled = true; });
    return;
  }

  const country = countrySystem.ensureCountry(focusCountry);
  policySystem.updateCountryPolicyCost(focusCountry);
  policyFocusCountry.textContent = `Policy for: ${focusCountry}`;
  policySummary.textContent = `Policy: ${gameState.policy.lastSummary}`;
  policyCostLabel.textContent = `Daily policy cost: ${Math.round(country.policyDailyCost)}`;
  militaryPolicySelect.value = country.policy.militarySpendingLevel;
  industryPolicySelect.value = country.policy.industryInvestmentLevel;
  securityPolicySelect.value = country.policy.internalSecurityLevel;

  const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
  const editable = playerCountry && focusCountry === playerCountry;
  [militaryPolicySelect, industryPolicySelect, securityPolicySelect, applyPolicyBtn].forEach((el) => { el.disabled = !editable; });
}

function refreshDomesticHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    domesticFocusCountry.textContent = 'Domestic state for: --';
    domesticStability.textContent = 'Stability: --';
    domesticUnrest.textContent = 'Unrest: --';
    domesticWarWeariness.textContent = 'War weariness: --';
    domesticEconomicStress.textContent = 'Economic stress: --';
    domesticLegitimacy.textContent = 'Legitimacy: --';
    domesticPublicSupport.textContent = 'Public support: --';
    domesticEliteSupport.textContent = 'Elite support: --';
    domesticPoliticalLabel.textContent = 'Political pressure: --';
    domesticTrend.textContent = 'Domestic trend: --';
    return;
  }
  const country = countrySystem.ensureCountry(focusCountry);
  domesticFocusCountry.textContent = `Domestic state for: ${focusCountry}`;
  domesticStability.textContent = `Stability: ${country.stability.toFixed(1)} / 100`;
  domesticUnrest.textContent = `Unrest: ${country.unrest.toFixed(1)} / 100`;
  domesticWarWeariness.textContent = `War weariness: ${country.warWeariness.toFixed(1)} / 100`;
  domesticEconomicStress.textContent = `Economic stress: ${country.economicStress.toFixed(1)} / 100`;
  domesticLegitimacy.textContent = `Legitimacy: ${country.legitimacy.toFixed(1)} / 100`;
  domesticPublicSupport.textContent = `Public support: ${country.publicSupport.toFixed(1)} / 100`;
  domesticEliteSupport.textContent = `Elite support: ${country.eliteSupport.toFixed(1)} / 100`;
  domesticPoliticalLabel.textContent = `Political pressure: ${politicalSystem.getPoliticalLabel(country)}`;
  const trendLabel = country.stability >= 60 ? 'Stable' : (country.stability >= 35 ? 'Strained' : 'Fragile');
  const pressure = diplomacySystem.getEconomicPressureOnCountry(focusCountry);
  domesticTrend.textContent = `Domestic trend: ${trendLabel} • Output x${country.domesticOutputModifier.toFixed(2)} • Sanction sources ${pressure.incomingCount} • Policy effectiveness x${(country.politicalEffects?.policyEffectiveness || 1).toFixed(2)}`;
}

function refreshEventHud() {
  const focusCountry = getDiplomacyFocusCountry();
  eventSummary.textContent = `Events: ${gameState.events.active.length} active globally`;
  const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
  const previousPrimary = eventTargetCountry.value;
  const previousSecondary = eventSecondaryCountry.value;
  eventTargetCountry.innerHTML = '';
  eventSecondaryCountry.innerHTML = '<option value="">None</option>';
  countryNames.forEach((name) => {
    const optA = document.createElement('option');
    optA.value = name;
    optA.textContent = name;
    eventTargetCountry.appendChild(optA);
    const optB = document.createElement('option');
    optB.value = name;
    optB.textContent = name;
    eventSecondaryCountry.appendChild(optB);
  });
  if (previousPrimary && countryNames.includes(previousPrimary)) eventTargetCountry.value = previousPrimary;
  if (previousSecondary && countryNames.includes(previousSecondary)) eventSecondaryCountry.value = previousSecondary;

  const active = focusCountry ? eventSystem.getActiveEventsForCountry(focusCountry) : [];
  activeEventsList.innerHTML = '';
  if (!active.length) {
    activeEventsList.innerHTML = '<li>No active events.</li>';
  } else {
    active.forEach((event) => {
      const li = document.createElement('li');
      const remainingDays = Math.max(0, (event.endTime - gameState.currentTimeMs) / DAY_MS).toFixed(1);
      const chokepointTag = event.targetChokepointId ? ` • chokepoint ${event.targetChokepointId}` : '';
      li.textContent = `${event.title} (${remainingDays} days left)${chokepointTag}`;
      activeEventsList.appendChild(li);
    });
  }

  eventLogList.innerHTML = '';
  if (!gameState.events.recentLog.length) {
    eventLogList.innerHTML = '<li>No events logged.</li>';
  } else {
    gameState.events.recentLog.slice(0, 8).forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = `${formatDateTime(entry.at)}: ${entry.message}`;
      eventLogList.appendChild(li);
    });
  }
}

function refreshChokepointHud() {
  const chokepoints = gameState.chokepoints.points || [];
  chokepointSummary.textContent = `Route pressure: ${gameState.chokepoints.lastSummary}`;
  const previousChokepoint = chokepointSelect.value;
  chokepointSelect.innerHTML = '';
  chokepoints.forEach((cp) => {
    const option = document.createElement('option');
    option.value = cp.id;
    option.textContent = cp.name;
    chokepointSelect.appendChild(option);
  });
  if (previousChokepoint && chokepoints.some((cp) => cp.id === previousChokepoint)) {
    chokepointSelect.value = previousChokepoint;
  }

  const names = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
  const previousController = chokepointControllerSelect.value;
  chokepointControllerSelect.innerHTML = '<option value="">None</option>';
  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    chokepointControllerSelect.appendChild(option);
  });
  if (previousController && names.includes(previousController)) {
    chokepointControllerSelect.value = previousController;
  }

  chokepointList.innerHTML = '';
  if (!chokepoints.length) {
    chokepointList.innerHTML = '<li>No chokepoints initialized.</li>';
    [chokepointOpenBtn, chokepointRestrictedBtn, chokepointBlockedBtn, chokepointContestedToggleBtn, assignChokepointControllerBtn]
      .forEach((btn) => { btn.disabled = true; });
    return;
  }
  [chokepointOpenBtn, chokepointRestrictedBtn, chokepointBlockedBtn, chokepointContestedToggleBtn, assignChokepointControllerBtn]
    .forEach((btn) => { btn.disabled = false; });

  chokepoints.forEach((cp) => {
    const linkedFlows = gameState.trade.flows.filter((flow) => flow.requiredChokepoints?.includes(cp.id));
    const affectedCountries = new Set(linkedFlows.flatMap((flow) => [flow.exporterCountryId, flow.importerCountryId]));
    const li = document.createElement('li');
    li.textContent = `${cp.name} • ${cp.openState.toUpperCase()} • controller ${cp.controllingCountryId || 'None'} • contested ${cp.contested ? 'Yes' : 'No'} • linked flows ${linkedFlows.length} • countries ${affectedCountries.size}`;
    chokepointList.appendChild(li);
  });

  const selected = chokepointSystem.getChokepoint(chokepointSelect.value);
  if (selected) {
    chokepointControllerSelect.value = selected.controllingCountryId || '';
    chokepointContestedToggleBtn.textContent = selected.contested ? 'Mark Not Contested' : 'Mark Contested';
  }
}

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
  const sourceCities = gameState.cities.length ? gameState.cities : majorCities.map((c) => ({ name: c.name, ownerCountry: c.country }));
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

function initializeCityState() {
  if (gameState.cities.length) return;
  gameState.cities = majorCities.map((city, idx) => ({
    id: idx + 1,
    name: city.name,
    ownerCountry: city.country,
    lonLat: [city.lon, city.lat],
    controlStatus: 'normal',
    captureState: null,
    status: 'active'
  }));
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
  gameState.attackMode = false;
  gameState.captureMode = false;
  gameState.selectedAsset = null;
  selectedCountryLabel.textContent = `Selected: ${countryFeature.properties.name}`;
  economySystem.ensureCountry(countryFeature.properties.name);
  countrySystem.ensureCountry(countryFeature.properties.name, false);
  gameState.selectedCountryForHud = countryFeature.properties.name;
  renderCityList(countryFeature.properties.name);
  updateCountryStyles();
  spawnEnemyForces();
  economySystem.startEconomyLoop();
  countrySystem.start();
  eventSystem.start();
  diplomacySystem.start();
  resourceSystem.start();
  chokepointSystem.start();
  blocSystem.start();
  tradeSystem.start();
  negotiationSystem.start();
  policySystem.start();
  domesticStateSystem.start();
  politicalSystem.start();
  countrySystem.syncOwnership();
  renderProductionPanel();
  renderSelectedUnitPanel();
  refreshEconomyHud();
  refreshCountryHud();
  refreshDiplomacyHud();
  refreshNegotiationHud();
  refreshPolicyHud();
  refreshDomesticHud();
  refreshEventHud();
  refreshChokepointHud();
  refreshBlocHud();
  refreshTradeHud();
}

function spawnEnemyForces() {
  if (gameState.enemySpawned || !projection || !countries.length || !gameState.selectedPlayerCountry) return;
  const enemyCountry = countries.find((c) => c.id !== gameState.selectedPlayerCountry.id) || countries[0];
  if (!enemyCountry) return;
  const [lon, lat] = d3.geoCentroid(enemyCountry);

  const enemyBase = {
    id: gameState.nextBaseId++,
    ownerCountry: `Enemy ${enemyCountry.properties.name}`,
    type: 'ground',
    lonLat: [lon, lat],
    status: 'active',
    combatStatus: 'idle',
    controlStatus: 'normal',
    captureState: null,
    createdAt: gameState.currentTimeMs,
    buildStartedAt: gameState.currentTimeMs,
    buildCompleteAt: gameState.currentTimeMs,
    health: 260,
    maxHealth: 260,
    defense: 10,
    production: { currentUnitId: null, currentCompleteAt: null, queue: [] }
  };
  gameState.bases.push(enemyBase);
  economySystem.ensureCountry(enemyBase.ownerCountry);
  countrySystem.ensureCountry(enemyBase.ownerCountry, true);
  if (!gameState.aiCountries.includes(enemyBase.ownerCountry)) {
    gameState.aiCountries.push(enemyBase.ownerCountry);
  }

  const def = UNIT_DEFINITIONS.infantry;
  gameState.units.push({
    id: gameState.nextUnitId++,
    ownerCountry: enemyBase.ownerCountry,
    type: 'infantry',
    domain: def.domain,
    status: 'active',
    createdAt: gameState.currentTimeMs,
    activatedAt: gameState.currentTimeMs,
    sourceBaseId: enemyBase.id,
    lonLat: [lon + 1.3, lat + 0.6],
    health: def.maxHealth,
    maxHealth: def.maxHealth,
    attack: def.attack,
    defense: def.defense,
    rangeKm: def.rangeKm,
    attackCooldownMs: def.attackCooldownMs,
    combatStatus: 'idle',
    currentTargetId: null,
    targetType: null,
    strength: def.attack,
    movement: null,
    captureTarget: null
  });

  gameState.enemySpawned = true;
  aiSystem.start();
  renderBases();
  renderUnits();
  refreshDiplomacyHud();
  refreshPolicyHud();
  refreshDomesticHud();
  refreshEventHud();
  refreshTradeHud();
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

function createBase(baseInput, lonLatArg = null, ownerCountryArg = null) {
  const type = typeof baseInput === 'string' ? baseInput : baseInput.type;
  const lonLat = Array.isArray(lonLatArg) ? lonLatArg : baseInput.lonLat;
  const ownerCountry = ownerCountryArg || (gameState.selectedPlayerCountry && gameState.selectedPlayerCountry.properties.name);
  const now = gameState.currentTimeMs;
  const buildDurationMs = BASE_BUILD_DURATIONS_MS[type] ?? 3 * DAY_MS;
  const base = {
    id: gameState.nextBaseId++,
    ownerCountry,
    type,
    lonLat,
    status: 'building',
    combatStatus: 'idle',
    controlStatus: 'normal',
    captureState: null,
    createdAt: now,
    buildStartedAt: now,
    buildCompleteAt: now + buildDurationMs,
    health: 300,
    maxHealth: 300,
    defense: 12,
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

  const visibleBases = gameState.bases.filter((base) => base.combatStatus !== 'destroyed');
  const points = basesLayer.selectAll('g.base-point').data(visibleBases, (d) => d.id);
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
      if (gameState.attackMode && gameState.selectedUnitId) {
        const result = combatSystem.startAttack(gameState.selectedUnitId, 'base', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Combat started against base #${d.id}.` : `Combat started against base #${d.id}.`);
        }
        gameState.attackMode = false;
        renderSelectedUnitPanel();
        renderUnits();
        return;
      }
      if (gameState.captureMode && gameState.selectedUnitId) {
        const result = captureSystem.startCapture(gameState.selectedUnitId, 'base', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Capture started on base #${d.id}.` : `Capture started on base #${d.id}.`);
        }
        gameState.captureMode = false;
        renderSelectedUnitPanel();
        renderBases();
        return;
      }
      gameState.selectedBaseId = d.id;
      gameState.selectedAsset = { type: 'base', id: d.id };
      gameState.selectedCountryForHud = d.ownerCountry;
      selectedAssetStatus.textContent = `Selected asset: Base #${d.id} • Owner ${d.ownerCountry} • ${d.controlStatus || 'normal'}`;
      renderBases();
      renderProductionPanel();
      refreshCountryHud();
    })
    .select('rect')
    .attr('fill', (d) => baseTypes.find((b) => b.key === d.type).color)
    .attr('class', (d) => `base ${d.status} ${d.combatStatus} ${gameState.aiCountries.includes(d.ownerCountry) ? 'enemy-owner' : ''} ${gameState.selectedBaseId === d.id ? 'selected-base' : ''}`);

  points
    .merge(enter)
    .select('title')
    .text((d) => `${d.type} base (${d.status}) HP ${d.health}/${d.maxHealth} - ${d.ownerCountry}`);

  points.exit().remove();
}

function renderCities() {
  if (!citiesLayer || !projection) return;
  const visibleCities = gameState.cities.filter((city) => city.status !== 'destroyed');
  const points = citiesLayer.selectAll('circle.city-point').data(visibleCities, (d) => d.id);
  const enter = points.enter().append('circle').attr('class', 'city city-point').attr('r', 3);
  enter.append('title');

  points
    .merge(enter)
    .attr('class', (d) => `city city-point ${d.controlStatus}`)
    .attr('cx', (d) => projection(d.lonLat)[0])
    .attr('cy', (d) => projection(d.lonLat)[1])
    .on('click', (event, d) => {
      event.stopPropagation();
      gameState.selectedAsset = { type: 'city', id: d.id };
      gameState.selectedCountryForHud = d.ownerCountry;
      selectedAssetStatus.textContent = `Selected asset: City ${d.name} • Owner ${d.ownerCountry} • ${d.controlStatus}`;
      refreshCountryHud();
      if (gameState.captureMode && gameState.selectedUnitId) {
        const result = captureSystem.startCapture(gameState.selectedUnitId, 'city', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Capture started on city ${d.name}.` : `Capture started on city ${d.name}.`);
        }
        gameState.captureMode = false;
        renderSelectedUnitPanel();
        renderCities();
      }
    })
    .select('title')
    .text((d) => `${d.name} (${d.ownerCountry}) - ${d.controlStatus} - Income ${ECONOMY_CONFIG.cityIncomePerDay}/day`);

  points.exit().remove();
}

function renderUnits() {
  const visibleUnits = gameState.units.filter((unit) => unit.status !== 'destroyed');
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
    .attr('class', (d) => `unit-marker unit-point ${d.combatStatus || ''} ${gameState.aiCountries.includes(d.ownerCountry) ? 'enemy-owner' : ''} ${gameState.selectedUnitId === d.id ? 'selected' : ''}`)
    .attr('cx', (d) => projection(movementSystem.getDisplayLonLat(d))[0])
    .attr('cy', (d) => projection(movementSystem.getDisplayLonLat(d))[1])
    .on('click', (event, d) => {
      event.stopPropagation();
      if (gameState.attackMode && gameState.selectedUnitId && gameState.selectedUnitId !== d.id) {
        const result = combatSystem.startAttack(gameState.selectedUnitId, 'unit', d.id);
        if (!result.ok) {
          setStatus(result.message, true);
        } else {
          setStatus(result.autoDeclaredWar ? `${result.message} Combat started against unit #${d.id}.` : `Combat started against unit #${d.id}.`);
        }
        gameState.attackMode = false;
        renderSelectedUnitPanel();
        renderUnits();
        return;
      }
      gameState.selectedUnitId = d.id;
      gameState.moveMode = false;
      gameState.attackMode = false;
      gameState.captureMode = false;
      gameState.selectedCountryForHud = d.ownerCountry;
      renderSelectedUnitPanel();
      refreshCountryHud();
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
    } else if (unit.status === 'destroyed') {
      selectedUnitMeta.textContent = 'Status: destroyed';
    } else {
      const canCapture = unit.domain === 'ground' && unit.status === 'active' && unit.combatStatus === 'idle';
      selectedUnitMeta.textContent = `Status: ${unit.status} • HP ${unit.health}/${unit.maxHealth} • ATK ${unit.attack} DEF ${unit.defense} RNG ${unit.rangeKm}km • Capture ${canCapture ? 'Yes' : 'No'}`;
    }
  }
  moveModeStatus.textContent = `Move mode: ${gameState.moveMode ? 'On (click map destination)' : 'Off'}`;
  attackModeStatus.textContent = `Attack mode: ${gameState.attackMode ? 'On (click enemy unit/base)' : 'Off'}`;
  captureModeStatus.textContent = `Capture mode: ${gameState.captureMode ? 'On (click enemy city/base)' : 'Off'}`;
  if (!gameState.selectedAsset) selectedAssetStatus.textContent = 'Selected asset: none';
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

  const upkeep = ECONOMY_CONFIG.baseUpkeepPerDay[base.type] || 0;
  prodBaseLabel.textContent = `Base #${base.id} (${base.type}) - ${base.status} - HP ${base.health}/${base.maxHealth} - Upkeep ${upkeep}/day`;
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

  if (!gameState.selectedPlayerCountry || base.ownerCountry !== gameState.selectedPlayerCountry.properties.name) {
    const info = document.createElement('p');
    info.textContent = 'Enemy base: production controls unavailable.';
    prodUnitButtons.appendChild(info);
    return;
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
      refreshEconomyHud();
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
    gameState.attackMode = false;
    gameState.captureMode = false;
    renderSelectedUnitPanel();
    setStatus('Move mode enabled. Click destination on the map.');
  });

  attackUnitBtn.addEventListener('click', () => {
    if (!gameState.selectedUnitId) {
      setStatus('Select a unit first, then enable attack mode.', true);
      return;
    }
    gameState.attackMode = true;
    gameState.moveMode = false;
    gameState.captureMode = false;
    renderSelectedUnitPanel();
    setStatus('Attack mode enabled. Click an enemy unit or enemy base in range.');
  });

  captureUnitBtn.addEventListener('click', () => {
    if (!gameState.selectedUnitId) {
      setStatus('Select a unit first, then enable capture mode.', true);
      return;
    }
    gameState.captureMode = true;
    gameState.attackMode = false;
    gameState.moveMode = false;
    renderSelectedUnitPanel();
    setStatus('Capture mode enabled. Click enemy city/base in capture range.');
  });

  clearUnitSelectionBtn.addEventListener('click', () => {
    gameState.selectedUnitId = null;
    gameState.moveMode = false;
    gameState.attackMode = false;
    gameState.captureMode = false;
    renderSelectedUnitPanel();
    renderUnits();
  });
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

function attachPolicyControls() {
  applyPolicyBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    if (!focusCountry || !playerCountry || focusCountry !== playerCountry) {
      setStatus('Policies can only be changed for your selected country.', true);
      return;
    }
    policySystem.setPolicyBundle(focusCountry, {
      militarySpendingLevel: militaryPolicySelect.value,
      industryInvestmentLevel: industryPolicySelect.value,
      internalSecurityLevel: securityPolicySelect.value
    });
    setStatus(`Policy updated for ${focusCountry}.`);
    refreshPolicyHud();
    refreshCountryHud();
    refreshDomesticHud();
  });
}

function attachEventControls() {
  triggerEventBtn.addEventListener('click', () => {
    const type = eventTypeSelect.value;
    const primary = eventTargetCountry.value;
    const secondary = eventSecondaryCountry.value;
    if (!primary) {
      setStatus('Select a target country for the event.', true);
      return;
    }
    let created = null;
    if (type === 'border_incident') {
      if (!secondary || secondary === primary) {
        setStatus('Border incident requires two different countries.', true);
        return;
      }
      created = eventSystem.createEvent(type, { targetCountryIds: [primary, secondary] });
    } else if (type === 'chokepoint_disruption') {
      const chokepointId = chokepointSelect.value;
      if (!chokepointId) {
        setStatus('Select a chokepoint before triggering chokepoint disruption.', true);
        return;
      }
      created = eventSystem.createEvent(type, { targetCountryId: primary, targetChokepointId: chokepointId });
    } else {
      created = eventSystem.createEvent(type, { targetCountryId: primary });
    }
    if (!created) {
      setStatus('Event not created (duplicate active event or invalid target).', true);
      return;
    }
    refreshEventHud();
  });
}

function attachChokepointControls() {
  const selectedId = () => chokepointSelect.value;
  const setState = (state) => {
    const chokepoint = chokepointSystem.setOpenState(selectedId(), state, 'manual');
    if (!chokepoint) {
      setStatus('Unable to update chokepoint state.', true);
      return;
    }
    tradeSystem.processTick();
    refreshChokepointHud();
    refreshTradeHud();
    setStatus(`${chokepoint.name} set to ${state}.`);
  };

  chokepointOpenBtn.addEventListener('click', () => setState('open'));
  chokepointRestrictedBtn.addEventListener('click', () => setState('restricted'));
  chokepointBlockedBtn.addEventListener('click', () => setState('blocked'));
  chokepointContestedToggleBtn.addEventListener('click', () => {
    const chokepoint = chokepointSystem.getChokepoint(selectedId());
    if (!chokepoint) {
      setStatus('Select a chokepoint first.', true);
      return;
    }
    chokepointSystem.setContested(chokepoint.id, !chokepoint.contested);
    tradeSystem.processTick();
    refreshChokepointHud();
    refreshTradeHud();
    setStatus(`${chokepoint.name} contestation toggled.`);
  });
  assignChokepointControllerBtn.addEventListener('click', () => {
    const chokepoint = chokepointSystem.setController(selectedId(), chokepointControllerSelect.value || null);
    if (!chokepoint) {
      setStatus('Unable to assign chokepoint controller.', true);
      return;
    }
    refreshChokepointHud();
    refreshDiplomacyHud();
    setStatus(`Controller updated for ${chokepoint.name}.`);
  });
  recomputeRoutePressureBtn.addEventListener('click', () => {
    tradeSystem.processTick();
    refreshTradeHud();
    refreshChokepointHud();
    setStatus('Route pressure recomputed.');
  });
  chokepointSelect.addEventListener('change', () => refreshChokepointHud());
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
    countrySystem.syncOwnership();
    refreshTimeHud();
    refreshEconomyHud();
    refreshCountryHud();
    refreshDiplomacyHud();
    refreshNegotiationHud();
    refreshPolicyHud();
    refreshDomesticHud();
    refreshEventHud();
    refreshChokepointHud();
    refreshBlocHud();
    refreshTradeHud();
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
  citiesLayer = root.append('g').attr('id', 'citiesLayer');
  basesLayer = root.append('g').attr('id', 'basesLayer');
  unitsLayer = root.append('g').attr('id', 'unitsLayer');

  countries = await loadCountriesData();
  initializeCityState();

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

    if (gameState.attackMode && gameState.selectedUnitId) {
      setStatus('Click an enemy unit or enemy base marker to attack.', true);
      return;
    }

    if (gameState.captureMode && gameState.selectedUnitId) {
      setStatus('Click an enemy city or enemy base marker to capture.', true);
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

    const playerCountry = gameState.selectedPlayerCountry.properties.name;
    const baseCost = ECONOMY_CONFIG.baseBuildCost[selectedBaseType] || 0;
    if (!economySystem.spend(playerCountry, baseCost, `build ${selectedBaseType} base`)) {
      setStatus(`Insufficient funds for ${selectedBaseType} base (${baseCost}).`, true);
      refreshEconomyHud();
      return;
    }

    const base = createBase({ type: selectedBaseType, lonLat });
    gameState.selectedBaseId = base.id;
    renderBases();
    renderProductionPanel();

    const completeText = formatDateTime(base.buildCompleteAt);
    setStatus(`${base.type} base started construction. ETA: ${completeText}.`);
    refreshEconomyHud();
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

  renderCities();

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
  attachDiplomacyControls();
  attachNegotiationControls();
  attachPolicyControls();
  attachEventControls();
  attachChokepointControls();
  attachBlocControls();
  attachTradeControls();
  refreshTimeHud();
  refreshEconomyHud();
  refreshCountryHud();
  refreshDiplomacyHud();
  refreshPolicyHud();
  refreshDomesticHud();
  refreshEventHud();
  refreshChokepointHud();
  refreshBlocHud();
  refreshTradeHud();
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
