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
  factions: {
    lastTickAt: null,
    lastSummary: 'No faction updates yet.'
  },
  internalResistance: {
    lastTickAt: null,
    lastSummary: 'No internal resistance updates yet.'
  },
  localInstability: {
    hotspotsById: {},
    hotspotIdsByCountry: {},
    selectedHotspotId: null,
    nextHotspotId: 1,
    lastTickAt: null,
    lastSummary: 'No local hotspot activity yet.',
    lastStatusAt: null
  },
  leadership: {
    lastTickAt: null,
    lastSummary: 'No leadership cycle updates yet.'
  },
  information: {
    lastTickAt: null,
    lastSummary: 'No information updates yet.'
  },
  influence: {
    operations: [],
    nextOperationId: 1,
    cooldownsByKey: {},
    lastTickAt: null,
    lastSummary: 'No influence operations yet.'
  },
  migration: {
    flows: [],
    nextFlowId: 1,
    lastTickAt: null,
    lastSummary: 'No migration activity yet.',
    lastStatusAt: null
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
const governmentProfileSystem = new GovernmentProfileSystem(gameState);
const countrySystem = new CountrySystem(gameState, scheduler, governmentProfileSystem);
const diplomacySystem = new DiplomacySystem(gameState, scheduler, countrySystem, governmentProfileSystem);
const eventSystem = new EventSystem(gameState, scheduler, countrySystem, diplomacySystem);
const resourceSystem = new ResourceSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem);
const chokepointSystem = new ChokepointSystem(gameState, scheduler, diplomacySystem);
const blocSystem = new BlocSystem(gameState, scheduler, diplomacySystem, countrySystem);
const tradeSystem = new TradeSystem(gameState, scheduler, countrySystem, diplomacySystem, chokepointSystem, blocSystem, governmentProfileSystem);
const negotiationSystem = new NegotiationSystem(gameState, scheduler, diplomacySystem, tradeSystem);
const policySystem = new PolicySystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, governmentProfileSystem);
const domesticStateSystem = new DomesticStateSystem(gameState, scheduler, countrySystem, diplomacySystem, policySystem, eventSystem, governmentProfileSystem);
const politicalSystem = new PoliticalSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, governmentProfileSystem);
const factionSystem = new FactionSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, governmentProfileSystem);
const leadershipSystem = new LeadershipSystem(gameState, scheduler, countrySystem, governmentProfileSystem, policySystem, diplomacySystem, null, factionSystem);
const migrationSystem = new MigrationSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, governmentProfileSystem);
const internalResistanceSystem = new InternalResistanceSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, migrationSystem);
const localInstabilitySystem = new LocalInstabilitySystem(gameState, scheduler, countrySystem, migrationSystem, eventSystem, internalResistanceSystem);
const informationSystem = new InformationSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, migrationSystem, governmentProfileSystem);
const influenceSystem = new InfluenceSystem(gameState, scheduler, countrySystem, diplomacySystem, governmentProfileSystem);
policySystem.factionSystem = factionSystem;
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
  factionSystem,
  diplomacySystem,
  resourceSystem,
  countrySystem,
  tradeSystem,
  chokepointSystem,
  blocSystem,
  eventSystem,
  internalResistanceSystem,
  influenceSystem,
  negotiationSystem,
  governmentProfileSystem
});
leadershipSystem.aiSystem = aiSystem;

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
const hudCurrentCountry = document.getElementById('hudCurrentCountry');
const hudAlerts = document.getElementById('hudAlerts');
const resetViewBtn = document.getElementById('resetViewBtn');
const rightPanel = document.getElementById('rightPanel');
const bottomDrawer = document.getElementById('bottomDrawer');
const bottomDrawerTabs = document.getElementById('bottomDrawerTabs');
const bottomDrawerContent = document.getElementById('bottomDrawerContent');
const toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
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
const govProfileFocusCountry = document.getElementById('govProfileFocusCountry');
const govProfileSummary = document.getElementById('govProfileSummary');
const govProfileHint = document.getElementById('govProfileHint');
const regimeTypeSelect = document.getElementById('regimeTypeSelect');
const economicOrientationSelect = document.getElementById('economicOrientationSelect');
const foreignPolicyStyleSelect = document.getElementById('foreignPolicyStyleSelect');
const applyGovernmentProfileBtn = document.getElementById('applyGovernmentProfileBtn');
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
const domesticLeaderApproval = document.getElementById('domesticLeaderApproval');
const domesticLeaderMandate = document.getElementById('domesticLeaderMandate');
const domesticGovernmentContinuity = document.getElementById('domesticGovernmentContinuity');
const domesticElectionDate = document.getElementById('domesticElectionDate');
const domesticLeadershipLabel = document.getElementById('domesticLeadershipLabel');
const domesticLeadershipSummary = document.getElementById('domesticLeadershipSummary');
const domesticFactionSummary = document.getElementById('domesticFactionSummary');
const domesticFactionBias = document.getElementById('domesticFactionBias');
const domesticFactionsList = document.getElementById('domesticFactionsList');
const factionInfluenceUpBtn = document.getElementById('factionInfluenceUpBtn');
const factionInfluenceDownBtn = document.getElementById('factionInfluenceDownBtn');
const factionSatisfactionUpBtn = document.getElementById('factionSatisfactionUpBtn');
const factionSatisfactionDownBtn = document.getElementById('factionSatisfactionDownBtn');
const triggerFactionShiftBtn = document.getElementById('triggerFactionShiftBtn');
const resetFactionStateBtn = document.getElementById('resetFactionStateBtn');
const resistanceFocusCountry = document.getElementById('resistanceFocusCountry');
const resistanceInsurgency = document.getElementById('resistanceInsurgency');
const resistanceSeparatist = document.getElementById('resistanceSeparatist');
const resistanceControl = document.getElementById('resistanceControl');
const resistanceForeign = document.getElementById('resistanceForeign');
const resistanceStatus = document.getElementById('resistanceStatus');
const resistanceImpact = document.getElementById('resistanceImpact');
const resistanceHotspots = document.getElementById('resistanceHotspots');
const raiseInsurgencyBtn = document.getElementById('raiseInsurgencyBtn');
const lowerInsurgencyBtn = document.getElementById('lowerInsurgencyBtn');
const raiseSeparatistBtn = document.getElementById('raiseSeparatistBtn');
const lowerSeparatistBtn = document.getElementById('lowerSeparatistBtn');
const raiseStateControlBtn = document.getElementById('raiseStateControlBtn');
const lowerStateControlBtn = document.getElementById('lowerStateControlBtn');
const raiseForeignPressureBtn = document.getElementById('raiseForeignPressureBtn');
const lowerForeignPressureBtn = document.getElementById('lowerForeignPressureBtn');
const triggerResistanceHotspotBtn = document.getElementById('triggerResistanceHotspotBtn');
const localHotspotFocusCountry = document.getElementById('localHotspotFocusCountry');
const localHotspotSummary = document.getElementById('localHotspotSummary');
const localHotspotSelect = document.getElementById('localHotspotSelect');
const localHotspotMetrics = document.getElementById('localHotspotMetrics');
const localHotspotTags = document.getElementById('localHotspotTags');
const localHotspotPressure = document.getElementById('localHotspotPressure');
const localHotspotTagSelect = document.getElementById('localHotspotTagSelect');
const localHotspotList = document.getElementById('localHotspotList');
const raiseLocalUnrestBtn = document.getElementById('raiseLocalUnrestBtn');
const lowerLocalUnrestBtn = document.getElementById('lowerLocalUnrestBtn');
const raiseLocalControlBtn = document.getElementById('raiseLocalControlBtn');
const lowerLocalControlBtn = document.getElementById('lowerLocalControlBtn');
const raiseLocalStabilityBtn = document.getElementById('raiseLocalStabilityBtn');
const lowerLocalStabilityBtn = document.getElementById('lowerLocalStabilityBtn');
const createManualHotspotBtn = document.getElementById('createManualHotspotBtn');
const clearManualHotspotBtn = document.getElementById('clearManualHotspotBtn');
const leaderApprovalUpBtn = document.getElementById('leaderApprovalUpBtn');
const leaderApprovalDownBtn = document.getElementById('leaderApprovalDownBtn');
const leaderMandateUpBtn = document.getElementById('leaderMandateUpBtn');
const leaderMandateDownBtn = document.getElementById('leaderMandateDownBtn');
const triggerElectionCheckBtn = document.getElementById('triggerElectionCheckBtn');
const triggerTurnoverBtn = document.getElementById('triggerTurnoverBtn');
const electionOffsetDaysInput = document.getElementById('electionOffsetDaysInput');
const applyElectionOffsetBtn = document.getElementById('applyElectionOffsetBtn');
const infoFocusCountry = document.getElementById('infoFocusCountry');
const infoNarrativePressure = document.getElementById('infoNarrativePressure');
const infoReputation = document.getElementById('infoReputation');
const infoControl = document.getElementById('infoControl');
const infoLegitimacy = document.getElementById('infoLegitimacy');
const infoInfluenceSummary = document.getElementById('infoInfluenceSummary');
const infoLabel = document.getElementById('infoLabel');
const reputationLabel = document.getElementById('reputationLabel');
const influenceTypeSelect = document.getElementById('influenceTypeSelect');
const influenceTargetCountry = document.getElementById('influenceTargetCountry');
const influenceIntensityInput = document.getElementById('influenceIntensityInput');
const influenceDurationInput = document.getElementById('influenceDurationInput');
const startInfluenceOperationBtn = document.getElementById('startInfluenceOperationBtn');
const cancelInfluenceOperationBtn = document.getElementById('cancelInfluenceOperationBtn');
const activeInfluenceOperationSelect = document.getElementById('activeInfluenceOperationSelect');
const activeInfluenceList = document.getElementById('activeInfluenceList');
const raiseNarrativePressureBtn = document.getElementById('raiseNarrativePressureBtn');
const lowerNarrativePressureBtn = document.getElementById('lowerNarrativePressureBtn');
const raiseReputationBtn = document.getElementById('raiseReputationBtn');
const lowerReputationBtn = document.getElementById('lowerReputationBtn');
const raiseInfoControlBtn = document.getElementById('raiseInfoControlBtn');
const lowerInfoControlBtn = document.getElementById('lowerInfoControlBtn');
const triggerInfoSuccessBtn = document.getElementById('triggerInfoSuccessBtn');
const triggerInfoScandalBtn = document.getElementById('triggerInfoScandalBtn');
const migrationFocusCountry = document.getElementById('migrationFocusCountry');
const migrationSummary = document.getElementById('migrationSummary');
const migrationInflowLabel = document.getElementById('migrationInflowLabel');
const migrationOutflowLabel = document.getElementById('migrationOutflowLabel');
const migrationHumanitarianLabel = document.getElementById('migrationHumanitarianLabel');
const migrationFlowList = document.getElementById('migrationFlowList');
const migrationOriginSelect = document.getElementById('migrationOriginSelect');
const migrationDestinationSelect = document.getElementById('migrationDestinationSelect');
const triggerRefugeeFlowBtn = document.getElementById('triggerRefugeeFlowBtn');
const triggerEconomicMigrationBtn = document.getElementById('triggerEconomicMigrationBtn');
const migrationAmountInput = document.getElementById('migrationAmountInput');
const migrationFlowSelect = document.getElementById('migrationFlowSelect');
const easeSelectedFlowBtn = document.getElementById('easeSelectedFlowBtn');
const recomputeMigrationBtn = document.getElementById('recomputeMigrationBtn');
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
  loadPanel: document.getElementById('loadPanel'),
  sandboxPanel: document.getElementById('sandboxPanel'),
  settingsPanel: document.getElementById('settingsPanel'),
  creditsPanel: document.getElementById('creditsPanel')
};

const playTitle = document.getElementById('playTitle');
const playStepIndicator = document.getElementById('playStepIndicator');
const playStepCountry = document.getElementById('playStepCountry');
const playStepLeader = document.getElementById('playStepLeader');
const playStepScenario = document.getElementById('playStepScenario');
const playStepConfirm = document.getElementById('playStepConfirm');
const countrySelect = document.getElementById('countrySelect');
const countryWarning = document.getElementById('countryWarning');
const leaderNameInput = document.getElementById('leaderName');
const scenarioTypeSelect = document.getElementById('scenarioType');
const simulationModeSelect = document.getElementById('simulationMode');
const launchSummary = document.getElementById('launchSummary');
const timeControlButtons = document.getElementById('timeControlButtons');
const skipDayBtn = document.getElementById('skipDayBtn');
const skipWeekBtn = document.getElementById('skipWeekBtn');
const skipMonthBtn = document.getElementById('skipMonthBtn');
const menuPreviewLabel = document.getElementById('menuPreviewLabel');
const menuPreviewTitle = document.getElementById('menuPreviewTitle');
const menuPreviewDescription = document.getElementById('menuPreviewDescription');
const menuPreviewBullets = document.getElementById('menuPreviewBullets');

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
let mapRoot;
let mapZoomBehavior;
let suppressMapClick = false;
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
    updateContextActionPanels();
    return;
  }
  const country = countrySystem.ensureCountry(countryName);
  const aiState = gameState.aiStateByCountry[countryName];
  const aiPosture = aiState?.posture;
  const strategicGoal = aiState?.strategicGoal;
  const profileSummary = governmentProfileSystem.getProfileSummary(country);
  countryHudName.textContent = `Country: ${country.name}${country.aiControlled ? ` (AI${strategicGoal ? `: ${strategicGoal}` : ''}${aiPosture ? ` / ${aiPosture}` : ''})` : ''} • ${profileSummary}`;
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
  if (country.stateControl < 55) strainFlags.push('state control weakening');
  if (country.insurgencyPressure > 50) strainFlags.push('insurgency rising');
  const aiReason = country.aiControlled && aiState?.strategicReason ? ` • AI rationale: ${aiState.strategicReason}` : '';
  countryHudStrain.textContent = `Resource strain: ${strainFlags.length ? strainFlags.join(', ') : 'none'}${aiReason}`;
  countryHudAssets.textContent = `Cities/Bases/Units: ${country.controlledCityIds.length}/${country.controlledBaseIds.length}/${country.controlledUnitIds.length}`;
  countryHudFlow.textContent = `Income/Upkeep/Net: +${country.incomePerTick}/-${country.upkeepPerTick}/${country.netPerTick >= 0 ? '+' : ''}${country.netPerTick}`;
  updateContextActionPanels();
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


function refreshGovernmentProfileHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    govProfileFocusCountry.textContent = 'Profile for: --';
    govProfileSummary.textContent = 'Government profile: --';
    govProfileHint.textContent = 'Profile effect: --';
    [regimeTypeSelect, economicOrientationSelect, foreignPolicyStyleSelect, applyGovernmentProfileBtn]
      .forEach((el) => { el.disabled = true; });
    return;
  }

  const country = countrySystem.ensureCountry(focusCountry);
  const profile = governmentProfileSystem.getProfile(country);
  govProfileFocusCountry.textContent = `Profile for: ${focusCountry}`;
  govProfileSummary.textContent = `Government profile: ${governmentProfileSystem.getProfileSummary(country)}`;
  govProfileHint.textContent = `Profile effect: ${governmentProfileSystem.getProfileHint(country)}`;
  regimeTypeSelect.value = profile.regimeType;
  economicOrientationSelect.value = profile.economicOrientation;
  foreignPolicyStyleSelect.value = profile.foreignPolicyStyle;
  [regimeTypeSelect, economicOrientationSelect, foreignPolicyStyleSelect, applyGovernmentProfileBtn]
    .forEach((el) => { el.disabled = false; });
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
    domesticLeaderApproval.textContent = 'Leader approval: --';
    domesticLeaderMandate.textContent = 'Leader mandate: --';
    domesticGovernmentContinuity.textContent = 'Government continuity: --';
    domesticElectionDate.textContent = 'Next election: --';
    domesticLeadershipLabel.textContent = 'Leadership status: --';
    domesticLeadershipSummary.textContent = 'Leadership cycle: --';
    domesticFactionSummary.textContent = 'Faction pressure: --';
    domesticFactionBias.textContent = 'Faction policy bias: --';
    domesticFactionsList.innerHTML = '<li>No faction data.</li>';
    return;
  }
  const country = countrySystem.ensureCountry(focusCountry);
  leadershipSystem.ensureLeadershipFields(country);
  domesticFocusCountry.textContent = `Domestic state for: ${focusCountry}`;
  domesticStability.textContent = `Stability: ${country.stability.toFixed(1)} / 100`;
  domesticUnrest.textContent = `Unrest: ${country.unrest.toFixed(1)} / 100`;
  domesticWarWeariness.textContent = `War weariness: ${country.warWeariness.toFixed(1)} / 100`;
  domesticEconomicStress.textContent = `Economic stress: ${country.economicStress.toFixed(1)} / 100`;
  domesticLegitimacy.textContent = `Legitimacy: ${country.legitimacy.toFixed(1)} / 100`;
  domesticPublicSupport.textContent = `Public support: ${country.publicSupport.toFixed(1)} / 100`;
  domesticEliteSupport.textContent = `Elite support: ${country.eliteSupport.toFixed(1)} / 100`;
  domesticPoliticalLabel.textContent = `Political pressure: ${politicalSystem.getPoliticalLabel(country)}`;
  domesticLeaderApproval.textContent = `Leader approval: ${country.leaderApproval.toFixed(1)} / 100`;
  domesticLeaderMandate.textContent = `Leader mandate: ${country.leaderMandate.toFixed(1)} / 100`;
  domesticGovernmentContinuity.textContent = `Government continuity: ${country.governmentContinuity.toFixed(1)} / 100`;
  domesticElectionDate.textContent = leadershipSystem.usesElectionCycle(country) && country.nextElectionAt
    ? `Next election: ${formatDateTime(country.nextElectionAt)}`
    : 'Next election: n/a for current regime';
  domesticLeadershipLabel.textContent = `Leadership status: ${leadershipSystem.getLeadershipLabel(country)}`;
  domesticLeadershipSummary.textContent = `Leadership cycle: ${gameState.leadership.lastSummary}`;
  factionSystem.ensureCountryFactions(country);
  const factionEffects = country.factionEffects || {};
  domesticFactionSummary.textContent = `Faction pressure: ${factionEffects.interpretation || 'balanced'}`;
  domesticFactionBias.textContent = `Faction policy bias: security ${((factionEffects.internalSecurityBias || 0) * 100).toFixed(0)} • war ${((factionEffects.warToleranceBias || 0) * 100).toFixed(0)} • de-escalation ${((factionEffects.deescalationBias || 0) * 100).toFixed(0)} • trade ${((factionEffects.tradeRestorationBias || 0) * 100).toFixed(0)}`;
  domesticFactionsList.innerHTML = '';
  Object.values(country.factions || {}).forEach((faction) => {
    const li = document.createElement('li');
    li.textContent = `${faction.id.replace(/_/g, ' ')} | influence ${faction.influence.toFixed(1)} | support ${faction.satisfaction.toFixed(1)} | direction ${faction.pressureDirection}`;
    domesticFactionsList.appendChild(li);
  });
  const trendLabel = country.stability >= 60 ? 'Stable' : (country.stability >= 35 ? 'Strained' : 'Fragile');
  const pressure = diplomacySystem.getEconomicPressureOnCountry(focusCountry);
  domesticTrend.textContent = `Domestic trend: ${trendLabel} • Output x${country.domesticOutputModifier.toFixed(2)} • Sanction sources ${pressure.incomingCount} • Policy effectiveness x${(country.politicalEffects?.policyEffectiveness || 1).toFixed(2)}`;
}

function refreshResistanceHud() {
  const focusCountry = getDiplomacyFocusCountry();
  if (!focusCountry) {
    resistanceFocusCountry.textContent = 'Internal resistance for: --';
    resistanceInsurgency.textContent = 'Insurgency pressure: --';
    resistanceSeparatist.textContent = 'Separatist pressure: --';
    resistanceControl.textContent = 'State control: --';
    resistanceForeign.textContent = 'Foreign-backed pressure: --';
    resistanceStatus.textContent = 'Resistance status: --';
    resistanceImpact.textContent = 'Resistance effects: --';
    resistanceHotspots.textContent = 'Hotspots: --';
    return;
  }
  const country = countrySystem.ensureCountry(focusCountry);
  const effects = country.resistanceEffects || {};
  resistanceFocusCountry.textContent = `Internal resistance for: ${focusCountry}`;
  resistanceInsurgency.textContent = `Insurgency pressure: ${country.insurgencyPressure.toFixed(1)} / 100`;
  resistanceSeparatist.textContent = `Separatist pressure: ${country.separatistPressure.toFixed(1)} / 100`;
  resistanceControl.textContent = `State control: ${country.stateControl.toFixed(1)} / 100`;
  resistanceForeign.textContent = `Foreign-backed pressure: ${(country.foreignBackedPressure || 0).toFixed(1)} / 100`;
  resistanceStatus.textContent = `Resistance status: ${internalResistanceSystem.getResistanceLabel(country)} • ${gameState.internalResistance.lastSummary}`;
  resistanceImpact.textContent = `Resistance effects: output -${((effects.outputPenalty || 0) * 100).toFixed(1)}% • manpower -${((effects.manpowerPenalty || 0) * 100).toFixed(1)}% • security cost +${Math.round(effects.securityCost || 0)}/day`;
  const hotspotLabel = (country.resistanceHotspots || [])
    .slice(0, 2)
    .map((hotspot) => `${hotspot.label} (ins ${hotspot.insurgencyPressure.toFixed(0)}, sep ${hotspot.separatistPressure.toFixed(0)}, ctrl ${hotspot.stateControl.toFixed(0)})`)
    .join(' • ');
  resistanceHotspots.textContent = `Hotspots: ${hotspotLabel || 'none'}`;
}



function refreshLocalHotspotHud() {
  const focusCountry = getDiplomacyFocusCountry();
  localHotspotSummary.textContent = gameState.localInstability?.lastSummary || 'Local instability: --';
  if (!focusCountry) {
    localHotspotFocusCountry.textContent = 'Hotspots for: --';
    localHotspotMetrics.textContent = 'Local stability/unrest/control: --';
    localHotspotTags.textContent = 'Hotspot tags: --';
    localHotspotPressure.textContent = 'Local pressures: --';
    localHotspotSelect.innerHTML = '<option value="">No hotspots</option>';
    localHotspotList.innerHTML = '<li>No local hotspots.</li>';
    return;
  }
  localInstabilitySystem.ensureHotspots();
  const hotspots = localInstabilitySystem.getCountryHotspots(focusCountry);
  localHotspotFocusCountry.textContent = `Hotspots for: ${focusCountry}`;
  const previousSelection = gameState.localInstability.selectedHotspotId;
  localHotspotSelect.innerHTML = '';
  hotspots.forEach((hotspot) => {
    const option = document.createElement('option');
    option.value = hotspot.id;
    option.textContent = `${hotspot.name} (${hotspot.severityLabel}, ${hotspot.severity.toFixed(0)})`;
    localHotspotSelect.appendChild(option);
  });
  if (!hotspots.length) {
    localHotspotSelect.innerHTML = '<option value="">No hotspots</option>';
    localHotspotMetrics.textContent = 'Local stability/unrest/control: --';
    localHotspotTags.textContent = 'Hotspot tags: --';
    localHotspotPressure.textContent = 'Local pressures: --';
    localHotspotList.innerHTML = '<li>No local hotspots.</li>';
    return;
  }
  if (previousSelection && hotspots.some((hotspot) => hotspot.id === previousSelection)) {
    localHotspotSelect.value = previousSelection;
  } else {
    localHotspotSelect.value = hotspots[0].id;
  }
  gameState.localInstability.selectedHotspotId = localHotspotSelect.value;
  const selected = hotspots.find((hotspot) => hotspot.id === localHotspotSelect.value) || hotspots[0];
  localHotspotMetrics.textContent = `Local stability/unrest/control: ${selected.localStability.toFixed(1)} / ${selected.localUnrest.toFixed(1)} / ${selected.localStateControl.toFixed(1)}`;
  localHotspotTags.textContent = `Hotspot tags: ${(selected.hotspotTags || []).join(', ') || 'none'}`;
  localHotspotPressure.textContent = `Local pressures: migration ${(selected.activePressures?.migration || 0).toFixed(1)} • insurgency ${(selected.activePressures?.insurgency || 0).toFixed(1)} • crisis ${(selected.activePressures?.crisis || 0).toFixed(1)}`;

  localHotspotList.innerHTML = '';
  hotspots.slice(0, 6).forEach((hotspot) => {
    const li = document.createElement('li');
    li.textContent = `${hotspot.name}: ${hotspot.severityLabel} (${hotspot.severity.toFixed(0)}) • tags ${hotspot.hotspotTags?.join(', ') || 'none'}`;
    localHotspotList.appendChild(li);
  });
}

function refreshInformationHud() {
  const focusCountry = getDiplomacyFocusCountry();
  const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
  const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
  const previousTarget = influenceTargetCountry.value;
  influenceTargetCountry.innerHTML = '';
  countryNames.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    influenceTargetCountry.appendChild(option);
  });
  if (previousTarget && countryNames.includes(previousTarget)) influenceTargetCountry.value = previousTarget;
  if (!influenceTargetCountry.value && playerCountry) influenceTargetCountry.value = playerCountry;

  if (!focusCountry) {
    infoFocusCountry.textContent = 'Information state for: --';
    infoNarrativePressure.textContent = 'Domestic narrative pressure: --';
    infoReputation.textContent = 'International reputation: --';
    infoControl.textContent = 'Information control: --';
    infoLegitimacy.textContent = 'Legitimacy impact: --';
    infoInfluenceSummary.textContent = 'Influence ops: --';
    infoLabel.textContent = 'Narrative status: --';
    reputationLabel.textContent = 'Reputation status: --';
    activeInfluenceList.innerHTML = '<li>No active influence operations.</li>';
    activeInfluenceOperationSelect.innerHTML = '<option value="">No active operations</option>';
    startInfluenceOperationBtn.disabled = true;
    cancelInfluenceOperationBtn.disabled = true;
    return;
  }

  const country = countrySystem.ensureCountry(focusCountry);
  infoFocusCountry.textContent = `Information state for: ${focusCountry}`;
  infoNarrativePressure.textContent = `Domestic narrative pressure: ${country.domesticNarrativePressure.toFixed(1)} / 100`;
  infoReputation.textContent = `International reputation: ${country.internationalReputation.toFixed(1)} / 100`;
  infoControl.textContent = `Information control: ${country.informationControl.toFixed(1)} / 100`;
  infoLegitimacy.textContent = `Legitimacy/Public support: ${country.legitimacy.toFixed(1)} / ${country.publicSupport.toFixed(1)}`;
  infoInfluenceSummary.textContent = `Influence ops: ${gameState.influence.lastSummary}`;
  infoLabel.textContent = `Narrative status: ${informationSystem.getNarrativeLabel(country)}`;
  reputationLabel.textContent = `Reputation status: ${informationSystem.getReputationLabel(country)}`;
  startInfluenceOperationBtn.disabled = !playerCountry || playerCountry !== focusCountry;
  influenceTargetCountry.disabled = !INFLUENCE_CONFIG.types[influenceTypeSelect.value]?.requiresForeignTarget;

  const playerOps = (gameState.influence.operations || []).filter((operation) => operation.sourceCountryId === playerCountry && operation.active);
  const previousActiveOperation = activeInfluenceOperationSelect.value;
  activeInfluenceOperationSelect.innerHTML = '<option value="">Select operation</option>';
  playerOps.forEach((operation) => {
    const option = document.createElement('option');
    option.value = String(operation.id);
    const targetLabel = operation.targetCountryId === operation.sourceCountryId ? 'domestic' : operation.targetCountryId;
    option.textContent = `#${operation.id} ${influenceSystem.getOperationLabel(operation.type)} → ${targetLabel}`;
    activeInfluenceOperationSelect.appendChild(option);
  });
  if (previousActiveOperation && playerOps.some((operation) => String(operation.id) === previousActiveOperation)) {
    activeInfluenceOperationSelect.value = previousActiveOperation;
  }
  cancelInfluenceOperationBtn.disabled = !activeInfluenceOperationSelect.value;

  activeInfluenceList.innerHTML = '';
  if (!playerOps.length) {
    activeInfluenceList.innerHTML = '<li>No active influence operations.</li>';
  } else {
    playerOps.forEach((operation) => {
      const li = document.createElement('li');
      const remainingDays = Math.ceil(influenceSystem.getRemainingDuration(operation) / DAY_MS);
      const targetLabel = operation.targetCountryId === operation.sourceCountryId ? 'Domestic' : operation.targetCountryId;
      li.textContent = `${influenceSystem.getOperationLabel(operation.type)} | Target: ${targetLabel} | Strength ${operation.intensity.toFixed(1)} | ${remainingDays}d left`;
      activeInfluenceList.appendChild(li);
    });
  }
}

function refreshMigrationHud() {
  const focusCountry = getDiplomacyFocusCountry();
  migrationSummary.textContent = gameState.migration?.lastSummary
    ? `Migration: ${gameState.migration.lastSummary}`
    : 'Migration: --';

  const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
  const previousOrigin = migrationOriginSelect.value;
  const previousDestination = migrationDestinationSelect.value;
  migrationOriginSelect.innerHTML = '';
  migrationDestinationSelect.innerHTML = '';
  countryNames.forEach((name) => {
    const originOption = document.createElement('option');
    originOption.value = name;
    originOption.textContent = name;
    migrationOriginSelect.appendChild(originOption);
    const destinationOption = document.createElement('option');
    destinationOption.value = name;
    destinationOption.textContent = name;
    migrationDestinationSelect.appendChild(destinationOption);
  });
  if (previousOrigin && countryNames.includes(previousOrigin)) migrationOriginSelect.value = previousOrigin;
  if (previousDestination && countryNames.includes(previousDestination)) migrationDestinationSelect.value = previousDestination;

  const activeFlows = (gameState.migration?.flows || []).filter((flow) => flow.active);
  const previousFlowId = Number(migrationFlowSelect.value);
  migrationFlowSelect.innerHTML = '<option value="">Select active flow</option>';
  activeFlows.forEach((flow) => {
    const option = document.createElement('option');
    option.value = String(flow.id);
    option.textContent = `#${flow.id} ${flow.type} ${flow.originCountryId}→${flow.destinationCountryId} (${flow.amount.toFixed(1)})`;
    migrationFlowSelect.appendChild(option);
  });
  if (previousFlowId && activeFlows.some((flow) => flow.id === previousFlowId)) {
    migrationFlowSelect.value = String(previousFlowId);
  }

  if (!focusCountry) {
    migrationFocusCountry.textContent = 'Migration focus: --';
    migrationInflowLabel.textContent = 'Inflow pressure: --';
    migrationOutflowLabel.textContent = 'Outflow pressure: --';
    migrationHumanitarianLabel.textContent = 'Humanitarian burden: --';
    migrationFlowList.innerHTML = '<li>No country selected.</li>';
    return;
  }

  const country = countrySystem.ensureCountry(focusCountry);
  const inflow = activeFlows
    .filter((flow) => flow.destinationCountryId === focusCountry)
    .reduce((sum, flow) => sum + flow.amount, 0);
  const outflow = activeFlows
    .filter((flow) => flow.originCountryId === focusCountry)
    .reduce((sum, flow) => sum + flow.amount, 0);
  const refugeeIn = activeFlows
    .filter((flow) => flow.destinationCountryId === focusCountry && flow.type === 'refugee')
    .reduce((sum, flow) => sum + flow.amount, 0);

  migrationFocusCountry.textContent = `Migration focus: ${focusCountry}`;
  migrationInflowLabel.textContent = `Inflow pressure: ${inflow.toFixed(1)} (refugee ${refugeeIn.toFixed(1)})`;
  migrationOutflowLabel.textContent = `Outflow pressure: ${outflow.toFixed(1)}`;
  migrationHumanitarianLabel.textContent = `Humanitarian burden: ${(country.humanitarianBurden || 0).toFixed(1)} / 100`;

  const flows = activeFlows.filter((flow) => flow.originCountryId === focusCountry || flow.destinationCountryId === focusCountry);
  migrationFlowList.innerHTML = '';
  if (!flows.length) {
    migrationFlowList.innerHTML = '<li>No active migration/refugee flows for this country.</li>';
    return;
  }

  flows
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
    .forEach((flow) => {
      const li = document.createElement('li');
      li.textContent = `${flow.type.toUpperCase()} ${flow.originCountryId} → ${flow.destinationCountryId} • pressure ${flow.amount.toFixed(1)} • cause ${flow.cause || 'n/a'} • ${flow.severity}`;
      migrationFlowList.appendChild(li);
    });
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
  hudAlerts.textContent = `Alerts: ${message}`;
}

function getMapLonLatFromEvent(event) {
  const [x, y] = d3.pointer(event, svg.node());
  const transform = d3.zoomTransform(svg.node());
  const [worldX, worldY] = transform.invert([x, y]);
  return projection.invert([worldX, worldY]);
}

function shouldIgnoreMapClick() {
  if (!suppressMapClick) return false;
  suppressMapClick = false;
  return true;
}

function organizePanels() {
  const cards = Array.from(document.querySelectorAll('.sidebar .card'));
  const byTitle = new Map(cards.map((card) => [card.querySelector('h2')?.textContent?.trim(), card]));
  const leftTitles = ['Geo Command', 'Simulation', 'Build Mode', 'Country State', 'Included Major Cities', 'Legend'];
  const rightTitles = ['Unit Orders', 'Base Production', 'Units', 'Domestic Policy', 'Government Profile', 'Diplomacy'];
  const tabs = {
    World: ['Blocs & Coalitions', 'Negotiated Resolution'],
    Systems: ['Domestic State', 'Information & Narrative', 'Internal Resistance'],
    Economy: ['Trade Network', 'Migration & Humanitarian Pressure'],
    Crises: ['Crisis & Events'],
    Sandbox: ['Chokepoints & Route Pressure']
  };

  cards.forEach((card) => card.classList.add('hidden-panel'));
  leftTitles.forEach((title) => byTitle.get(title)?.classList.remove('hidden-panel'));
  rightTitles.forEach((title) => {
    const card = byTitle.get(title);
    if (card) {
      card.classList.remove('hidden-panel');
      rightPanel.appendChild(card);
    }
  });

  bottomDrawerTabs.innerHTML = '';
  bottomDrawerContent.innerHTML = '';
  Object.entries(tabs).forEach(([tabName, titles], idx) => {
    const btn = document.createElement('button');
    btn.textContent = tabName;
    btn.className = idx === 0 ? 'active' : '';
    const pane = document.createElement('div');
    pane.className = `drawer-pane ${idx === 0 ? 'active' : ''}`;
    const grid = document.createElement('div');
    grid.className = 'pane-grid';
    titles.forEach((title) => {
      const card = byTitle.get(title);
      if (card) {
        card.classList.remove('hidden-panel');
        grid.appendChild(card);
      }
    });
    pane.appendChild(grid);
    btn.addEventListener('click', () => {
      bottomDrawerTabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      bottomDrawerContent.querySelectorAll('.drawer-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      pane.classList.add('active');
    });
    bottomDrawerTabs.appendChild(btn);
    bottomDrawerContent.appendChild(pane);
  });
}

function setDrawerCollapsed(collapsed) {
  if (!bottomDrawer || !toggleDrawerBtn) return;
  bottomDrawer.classList.toggle('collapsed', collapsed);
  toggleDrawerBtn.textContent = collapsed ? 'Open Drawer' : 'Close Drawer';
  toggleDrawerBtn.setAttribute('aria-expanded', String(!collapsed));
}

function attachDrawerControls() {
  if (!toggleDrawerBtn) return;
  setDrawerCollapsed(true);
  toggleDrawerBtn.addEventListener('click', () => {
    const collapsed = bottomDrawer.classList.contains('collapsed');
    setDrawerCollapsed(!collapsed);
  });
}

function updateContextActionPanels() {
  const unitOrdersCard = Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === 'Unit Orders');
  const productionCard = Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === 'Base Production');
  const diplomacyCard = Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === 'Diplomacy');
  const hasUnit = Boolean(gameState.selectedUnitId);
  const hasBase = Boolean(gameState.selectedBaseId);
  const hasCountry = Boolean(gameState.selectedCountryForHud);
  if (unitOrdersCard) unitOrdersCard.style.display = hasUnit ? '' : 'none';
  if (productionCard) productionCard.style.display = hasBase ? '' : 'none';
  if (diplomacyCard) diplomacyCard.style.display = hasCountry ? '' : 'none';
  hudCurrentCountry.textContent = `Country: ${gameState.selectedCountryForHud || '--'}`;
}

function setOverlay(name) {
  Object.entries(overlays).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
}

function hideOverlays() {
  Object.values(overlays).forEach((el) => el.classList.add('hidden'));
}

const menuPreviewData = {
  continue: {
    label: 'Operational Resume',
    title: 'Continue',
    description: 'Return to your active command theater with current geopolitical conditions and system state.',
    bullets: ['Best for long-form campaigns.', 'Disabled until a simulation is initialized.']
  },
  newSimulation: {
    label: 'Simulation Setup',
    title: 'New Simulation',
    description: 'Launch a structured setup flow: country, leader profile, start conditions, and simulation mode.',
    bullets: ['Four-step launch sequence.', 'Designed for expansion with future scenario logic.']
  },
  loadScenario: {
    label: 'Archive & Scenario Deck',
    title: 'Load / Scenario Browser',
    description: 'Browse recent sessions and scenario templates with clear placeholders for save integration.',
    bullets: ['Continue last session entrypoint.', 'Scenario cards prepared for future content packs.']
  },
  sandbox: {
    label: 'Sandbox Command Deck',
    title: 'Sandbox',
    description: 'Start fast with preset world options and a dedicated freeform experimentation path.',
    bullets: ['Quick-start sandbox action.', 'Custom world hooks prepared as placeholders.']
  },
  settings: {
    label: 'Systems Configuration',
    title: 'Settings',
    description: 'Adjust audio, interface scale, and simulation-facing defaults in a structured control layout.',
    bullets: ['Persistent browser-stored audio levels.', 'UI and graphics/simulation placeholders ready.']
  },
  tutorial: {
    label: 'Learning Path',
    title: 'Tutorial / How to Play',
    description: 'Step-by-step onboarding is scaffolded for future instructional content.',
    bullets: ['Will include diplomacy and economy primers.', 'Current build uses in-menu placeholders.']
  },
  credits: {
    label: 'Project Information',
    title: 'Credits',
    description: 'View project identity, simulator framing, and version details.',
    bullets: ['Geo Command browser prototype.', 'Focused on geopolitical systems simulation.']
  },
  exit: {
    label: 'Exit',
    title: 'Exit / Quit',
    description: 'Web builds cannot fully close themselves; this prompts a graceful browser-level fallback.',
    bullets: ['Shows a clear, intentional web message.', 'No abrupt behavior changes.']
  }
};

function setMainMenuPreview(key) {
  const preview = menuPreviewData[key] || menuPreviewData.newSimulation;
  menuPreviewLabel.textContent = preview.label;
  menuPreviewTitle.textContent = preview.title;
  menuPreviewDescription.textContent = preview.description;
  menuPreviewBullets.innerHTML = '';
  preview.bullets.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    menuPreviewBullets.appendChild(li);
  });
}

function updatePlayFlowUI() {
  playStepIndicator.textContent = String(playStep);
  const stepViews = [
    { title: 'New Simulation Setup · Country Selection', element: playStepCountry },
    { title: 'New Simulation Setup · Leader Profile', element: playStepLeader },
    { title: 'New Simulation Setup · Start Conditions', element: playStepScenario },
    { title: 'New Simulation Setup · Confirmation', element: playStepConfirm }
  ];
  stepViews.forEach((step, idx) => {
    step.element.classList.toggle('hidden', idx !== playStep - 1);
  });
  playTitle.textContent = stepViews[playStep - 1]?.title || 'New Simulation Setup';
  document.getElementById('playNextBtn').textContent = playStep === 4 ? 'Launch Simulation' : 'Next';
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
  const playerCountryState = countrySystem.ensureCountry(countryFeature.properties.name, false);
  playerProfile.textContent = `Player country: ${countryFeature.properties.name} (${governmentProfileSystem.getProfileSummary(playerCountryState)})`;
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
  factionSystem.start();
  leadershipSystem.start();
  informationSystem.start();
  influenceSystem.start();
  migrationSystem.start();
  internalResistanceSystem.start();
  localInstabilitySystem.start();
  countrySystem.syncOwnership();
  renderProductionPanel();
  renderSelectedUnitPanel();
  refreshEconomyHud();
  refreshCountryHud();
  refreshDiplomacyHud();
  refreshNegotiationHud();
  refreshPolicyHud();
  refreshGovernmentProfileHud();
  refreshDomesticHud();
  refreshResistanceHud();
  refreshLocalHotspotHud();
  refreshInformationHud();
  refreshMigrationHud();
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
  refreshGovernmentProfileHud();
  refreshDomesticHud();
  refreshResistanceHud();
  refreshLocalHotspotHud();
  refreshInformationHud();
  refreshMigrationHud();
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
  refreshMigrationHud();
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
      if (shouldIgnoreMapClick()) return;
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
    .attr('class', (d) => {
      const severity = Number(d.hotspotSeverity || 0);
      const hotspotClass = severity >= 70 ? 'local-hotspot-critical' : (severity >= 45 ? 'local-hotspot-active' : '');
      return `city city-point ${d.controlStatus} ${hotspotClass}`.trim();
    })
    .attr('cx', (d) => projection(d.lonLat)[0])
    .attr('cy', (d) => projection(d.lonLat)[1])
    .on('click', (event, d) => {
      event.stopPropagation();
      if (shouldIgnoreMapClick()) return;
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
    .text((d) => `${d.name} (${d.ownerCountry}) - ${d.controlStatus} - Income ${Math.round(ECONOMY_CONFIG.cityIncomePerDay * (1 - (d.localEconomicPenalty || 0)))}/day - Local unrest ${(d.localUnrest || 0).toFixed(0)} - Local control ${(d.localStateControl || 0).toFixed(0)}`);

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
      if (shouldIgnoreMapClick()) return;
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
  updateContextActionPanels();
}

function renderProductionPanel() {
  const base = gameState.bases.find((entry) => entry.id === gameState.selectedBaseId);
  prodUnitButtons.innerHTML = '';
  prodQueue.innerHTML = '';

  if (!base) {
    prodBaseLabel.textContent = 'Select a base to manage production.';
    prodCurrent.textContent = 'Current: --';
    updateContextActionPanels();
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
  updateContextActionPanels();

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
  const menuButtons = Array.from(document.querySelectorAll('.menu-nav-btn'));
  menuButtons.forEach((btn) => {
    const previewKey = btn.dataset.preview;
    btn.addEventListener('mouseenter', () => {
      menuButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === btn));
      if (previewKey) setMainMenuPreview(previewKey);
    });
    btn.addEventListener('focus', () => {
      menuButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === btn));
      if (previewKey) setMainMenuPreview(previewKey);
    });
  });
  setMainMenuPreview('newSimulation');

  document.getElementById('newSimulationBtn').addEventListener('click', () => {
    playStep = 1;
    updatePlayFlowUI();
    countryWarning.textContent = '';
    leaderNameInput.value = '';
    scenarioTypeSelect.value = 'modern';
    simulationModeSelect.value = simulationModeSelect.value || 'standard';
    launchSummary.textContent = 'Review your setup before deployment.';
    setOverlay('playFlow');
  });

  document.getElementById('continueBtn').addEventListener('click', () => {
    if (!gameState.selectedPlayerCountry) {
      setStatus('No active session found. Start a new simulation first.', true);
      return;
    }
    hideOverlays();
    setStatus(`Resuming command of ${gameState.selectedPlayerCountry.properties.name}.`);
  });
  document.getElementById('loadScenarioBtn').addEventListener('click', () => setOverlay('loadPanel'));
  document.getElementById('sandboxBtn').addEventListener('click', () => setOverlay('sandboxPanel'));
  document.getElementById('settingsBtn').addEventListener('click', () => setOverlay('settingsPanel'));
  document.getElementById('creditsBtn').addEventListener('click', () => setOverlay('creditsPanel'));
  document.getElementById('tutorialBtn').addEventListener('click', () => {
    setStatus('Tutorial content is planned for a future update. Start with New Simulation.');
  });
  document.getElementById('exitBtn').addEventListener('click', () => {
    setStatus('Web build cannot quit directly. Close this browser tab to exit.');
  });

  document.getElementById('settingsBackBtn').addEventListener('click', () => setOverlay('mainMenu'));
  document.getElementById('loadBackBtn').addEventListener('click', () => setOverlay('mainMenu'));
  document.getElementById('sandboxBackBtn').addEventListener('click', () => setOverlay('mainMenu'));
  document.getElementById('creditsBackBtn').addEventListener('click', () => setOverlay('mainMenu'));
  document.getElementById('loadContinueBtn').addEventListener('click', () => document.getElementById('continueBtn').click());
  document.getElementById('sandboxQuickStartBtn').addEventListener('click', () => {
    simulationModeSelect.value = 'sandbox';
    document.getElementById('newSimulationBtn').click();
  });

  document.getElementById('playBackBtn').addEventListener('click', () => {
    if (playStep === 1) {
      setOverlay('mainMenu');
      return;
    }
    playStep -= 1;
    updatePlayFlowUI();
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
      updatePlayFlowUI();
      return;
    }

    if (playStep === 2) {
      const leaderName = leaderNameInput.value.trim();
      if (!leaderName) {
        alert('Please enter a leader name.');
        return;
      }
      playStep = 3;
      updatePlayFlowUI();
      return;
    }

    if (playStep === 3) {
      const scenarioLabel = scenarioTypeSelect.options[scenarioTypeSelect.selectedIndex]?.textContent || 'Modern Baseline';
      const modeLabel = simulationModeSelect.options[simulationModeSelect.selectedIndex]?.textContent || 'Standard Simulation';
      launchSummary.textContent = `Country: ${gameState.selectedPlayerCountry.properties.name} · Leader: ${leaderNameInput.value.trim()} · Scenario: ${scenarioLabel} · Mode: ${modeLabel}`;
      playStep = 4;
      updatePlayFlowUI();
      return;
    }

    const leaderName = leaderNameInput.value.trim();
    const playerCountryState = countrySystem.ensureCountry(gameState.selectedPlayerCountry.properties.name);
    const modeLabel = simulationModeSelect.value === 'sandbox' ? 'Sandbox' : 'Standard';
    playerProfile.textContent = `Leader ${leaderName} of ${gameState.selectedPlayerCountry.properties.name} (${governmentProfileSystem.getProfileSummary(playerCountryState)}) · Mode: ${modeLabel}`;
    setStatus(`Commander ${leaderName}, simulation launched in ${modeLabel} mode. Place bases and advance time to complete construction.`);
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


function attachGovernmentProfileControls() {
  applyGovernmentProfileBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    governmentProfileSystem.setCountryProfile(country, {
      regimeType: regimeTypeSelect.value,
      economicOrientation: economicOrientationSelect.value,
      foreignPolicyStyle: foreignPolicyStyleSelect.value
    });
    leadershipSystem.ensureLeadershipFields(country);
    leadershipSystem.scheduleNextElection(country);
    gameState.policy.lastSummary = `${focusCountry} profile set to ${governmentProfileSystem.getProfileSummary(country)}.`;
    setStatus(`Government profile updated for ${focusCountry}.`);
    refreshGovernmentProfileHud();
    refreshCountryHud();
    refreshPolicyHud();
    refreshDomesticHud();
    refreshDiplomacyHud();
    refreshTradeHud();
    refreshMigrationHud();
  });
}


function attachInformationControls() {
  const syncInfluenceTargetState = () => {
    const focusCountry = getDiplomacyFocusCountry();
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    const selectedType = influenceTypeSelect.value;
    const typeMeta = INFLUENCE_CONFIG.types[selectedType];
    const requiresForeignTarget = Boolean(typeMeta?.requiresForeignTarget);
    influenceTargetCountry.disabled = !requiresForeignTarget;
    if (!playerCountry || !focusCountry) {
      startInfluenceOperationBtn.disabled = true;
      return;
    }
    const canOperate = focusCountry === playerCountry;
    startInfluenceOperationBtn.disabled = !canOperate;
    if (!requiresForeignTarget) {
      influenceTargetCountry.value = playerCountry;
    } else if (influenceTargetCountry.value === playerCountry) {
      const fallback = Object.keys(gameState.countries).find((name) => name !== playerCountry);
      if (fallback) influenceTargetCountry.value = fallback;
    }
  };

  influenceTypeSelect.addEventListener('change', syncInfluenceTargetState);
  activeInfluenceOperationSelect.addEventListener('change', () => {
    cancelInfluenceOperationBtn.disabled = !activeInfluenceOperationSelect.value;
  });
  startInfluenceOperationBtn.addEventListener('click', () => {
    const playerCountry = gameState.selectedPlayerCountry ? gameState.selectedPlayerCountry.properties.name : null;
    const focusCountry = getDiplomacyFocusCountry();
    if (!playerCountry || !focusCountry || focusCountry !== playerCountry) {
      setStatus('Influence operations can only be started for your selected country.', true);
      return;
    }
    const type = influenceTypeSelect.value;
    const typeMeta = INFLUENCE_CONFIG.types[type];
    const rawDuration = Math.max(INFLUENCE_CONFIG.minDurationDays, Math.min(INFLUENCE_CONFIG.maxDurationDays, Number(influenceDurationInput.value) || INFLUENCE_CONFIG.defaultDurationDays));
    const rawIntensity = Math.max(INFLUENCE_CONFIG.minIntensity, Math.min(INFLUENCE_CONFIG.maxIntensity, Number(influenceIntensityInput.value) || 1));
    const targetCountryId = typeMeta?.requiresForeignTarget ? influenceTargetCountry.value : playerCountry;
    const result = influenceSystem.startOperation({
      type,
      sourceCountryId: playerCountry,
      targetCountryId,
      durationDays: rawDuration,
      intensity: rawIntensity
    });
    if (!result.ok) {
      setStatus(result.reason || 'Unable to start influence operation.', true);
      return;
    }
    setStatus(`Started ${influenceSystem.getOperationLabel(type)} targeting ${result.operation.targetCountryId}.`);
    refreshInformationHud();
    refreshEconomyHud();
    refreshDomesticHud();
    refreshDiplomacyHud();
    refreshResistanceHud();
  });

  cancelInfluenceOperationBtn.addEventListener('click', () => {
    const operationId = Number(activeInfluenceOperationSelect.value);
    if (!operationId) {
      setStatus('Select an active operation to cancel.', true);
      return;
    }
    const canceled = influenceSystem.cancelOperation(operationId, 'canceled');
    if (!canceled) {
      setStatus('Unable to cancel that operation.', true);
      return;
    }
    setStatus(`Influence operation #${operationId} canceled.`);
    refreshInformationHud();
  });

  const mutate = (mutator, message) => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    mutator(country);
    refreshInformationHud();
    refreshDomesticHud();
    refreshDiplomacyHud();
    setStatus(message);
  };

  raiseNarrativePressureBtn.addEventListener('click', () => mutate((country) => {
    country.domesticNarrativePressure = Math.min(100, country.domesticNarrativePressure + 8);
  }, 'Domestic narrative pressure increased.'));
  lowerNarrativePressureBtn.addEventListener('click', () => mutate((country) => {
    country.domesticNarrativePressure = Math.max(0, country.domesticNarrativePressure - 8);
  }, 'Domestic narrative pressure reduced.'));
  raiseReputationBtn.addEventListener('click', () => mutate((country) => {
    country.internationalReputation = Math.min(100, country.internationalReputation + 8);
  }, 'International reputation improved.'));
  lowerReputationBtn.addEventListener('click', () => mutate((country) => {
    country.internationalReputation = Math.max(-100, country.internationalReputation - 8);
  }, 'International reputation damaged.'));
  raiseInfoControlBtn.addEventListener('click', () => mutate((country) => {
    country.informationControl = Math.min(100, country.informationControl + 6);
  }, 'Information control strengthened.'));
  lowerInfoControlBtn.addEventListener('click', () => mutate((country) => {
    country.informationControl = Math.max(0, country.informationControl - 6);
  }, 'Information control weakened.'));
  triggerInfoSuccessBtn.addEventListener('click', () => mutate((country) => {
    country.domesticNarrativePressure = Math.max(0, country.domesticNarrativePressure - 10);
    country.internationalReputation = Math.min(100, country.internationalReputation + 4);
    country.infoMetrics.cooperativeActions += 0.6;
  }, 'Information campaign succeeded.'));
  triggerInfoScandalBtn.addEventListener('click', () => mutate((country) => {
    country.domesticNarrativePressure = Math.min(100, country.domesticNarrativePressure + 12);
    country.internationalReputation = Math.max(-100, country.internationalReputation - 7);
    country.infoMetrics.aggressiveActions += 0.4;
  }, 'Information scandal spread.'));
  syncInfluenceTargetState();
}

function attachResistanceControls() {
  const mutateResistance = (mutator, message) => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    mutator(country, focusCountry);
    refreshResistanceHud();
    refreshDomesticHud();
    refreshCountryHud();
    refreshEconomyHud();
    setStatus(message);
  };

  raiseInsurgencyBtn.addEventListener('click', () => mutateResistance((country) => {
    country.insurgencyPressure = internalResistanceSystem.clamp(country.insurgencyPressure + 8);
  }, 'Insurgency pressure increased.'));
  lowerInsurgencyBtn.addEventListener('click', () => mutateResistance((country) => {
    country.insurgencyPressure = internalResistanceSystem.clamp(country.insurgencyPressure - 8);
  }, 'Insurgency pressure reduced.'));
  raiseSeparatistBtn.addEventListener('click', () => mutateResistance((country) => {
    country.separatistPressure = internalResistanceSystem.clamp(country.separatistPressure + 8);
  }, 'Separatist pressure increased.'));
  lowerSeparatistBtn.addEventListener('click', () => mutateResistance((country) => {
    country.separatistPressure = internalResistanceSystem.clamp(country.separatistPressure - 8);
  }, 'Separatist pressure reduced.'));
  raiseStateControlBtn.addEventListener('click', () => mutateResistance((country) => {
    country.stateControl = internalResistanceSystem.clamp(country.stateControl + 8);
  }, 'State control strengthened.'));
  lowerStateControlBtn.addEventListener('click', () => mutateResistance((country) => {
    country.stateControl = internalResistanceSystem.clamp(country.stateControl - 8);
  }, 'State control weakened.'));
  raiseForeignPressureBtn.addEventListener('click', () => mutateResistance((country) => {
    country.foreignBackedPressure = internalResistanceSystem.clamp((country.foreignBackedPressure || 0) + 6);
  }, 'Foreign-backed pressure increased.'));
  lowerForeignPressureBtn.addEventListener('click', () => mutateResistance((country) => {
    country.foreignBackedPressure = internalResistanceSystem.clamp((country.foreignBackedPressure || 0) - 6);
  }, 'Foreign-backed pressure reduced.'));
  triggerResistanceHotspotBtn.addEventListener('click', () => mutateResistance((country) => {
    internalResistanceSystem.ensureHotspot(country, `Unstable zone ${Date.now().toString().slice(-3)}`);
  }, 'Internal resistance hotspot created.'));
}


function attachLocalHotspotControls() {
  const mutateLocal = (mutator, message) => {
    const hotspotId = localHotspotSelect.value || gameState.localInstability.selectedHotspotId;
    if (!hotspotId) {
      setStatus('Select a local hotspot first.', true);
      return;
    }
    mutator(hotspotId);
    refreshLocalHotspotHud();
    refreshResistanceHud();
    refreshDomesticHud();
    refreshCountryHud();
    refreshEconomyHud();
    renderCities();
    setStatus(message);
  };

  localHotspotSelect.addEventListener('change', () => {
    gameState.localInstability.selectedHotspotId = localHotspotSelect.value;
    refreshLocalHotspotHud();
  });
  raiseLocalUnrestBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localUnrest', 8), 'Local unrest increased.'));
  lowerLocalUnrestBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localUnrest', -8), 'Local unrest reduced.'));
  raiseLocalControlBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStateControl', 8), 'Local state control increased.'));
  lowerLocalControlBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStateControl', -8), 'Local state control reduced.'));
  raiseLocalStabilityBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStability', 8), 'Local stability increased.'));
  lowerLocalStabilityBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.adjustHotspotMetric(id, 'localStability', -8), 'Local stability reduced.'));
  createManualHotspotBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const hotspots = localInstabilitySystem.getCountryHotspots(focusCountry);
    const pick = hotspots[0];
    if (!pick) {
      setStatus('No city hotspots available for this country.', true);
      return;
    }
    localInstabilitySystem.createManualHotspot(focusCountry, pick.linkedCityId, localHotspotTagSelect.value || 'unrest hotspot');
    refreshLocalHotspotHud();
    renderCities();
    setStatus('Manual local hotspot created.');
  });
  clearManualHotspotBtn.addEventListener('click', () => mutateLocal((id) => localInstabilitySystem.clearHotspot(id), 'Local hotspot cleared.'));
  localHotspotTagSelect.addEventListener('change', () => {
    const hotspotId = localHotspotSelect.value || gameState.localInstability.selectedHotspotId;
    if (!hotspotId) return;
    localInstabilitySystem.setHotspotTag(hotspotId, localHotspotTagSelect.value);
    refreshLocalHotspotHud();
    renderCities();
  });
}

function attachLeadershipControls() {
  const mutateLeadership = (mutator, message) => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    leadershipSystem.ensureLeadershipFields(country);
    mutator(country, focusCountry);
    refreshDomesticHud();
    refreshCountryHud();
    setStatus(message);
  };

  leaderApprovalUpBtn.addEventListener('click', () => mutateLeadership((country) => {
    country.leaderApproval = Math.min(100, country.leaderApproval + 8);
  }, 'Leader approval increased.'));
  leaderApprovalDownBtn.addEventListener('click', () => mutateLeadership((country) => {
    country.leaderApproval = Math.max(0, country.leaderApproval - 8);
  }, 'Leader approval reduced.'));
  leaderMandateUpBtn.addEventListener('click', () => mutateLeadership((country) => {
    country.leaderMandate = Math.min(100, country.leaderMandate + 8);
  }, 'Leader mandate increased.'));
  leaderMandateDownBtn.addEventListener('click', () => mutateLeadership((country) => {
    country.leaderMandate = Math.max(0, country.leaderMandate - 8);
  }, 'Leader mandate reduced.'));

  triggerElectionCheckBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const result = leadershipSystem.evaluateElection(focusCountry, 'manual');
    if (!result || result.ok === false) {
      setStatus('Election check skipped: regime does not run standard elections.', true);
      return;
    }
    setStatus(result.type === 'turnover'
      ? `${focusCountry} election triggered turnover.`
      : `${focusCountry} election renewed mandate.`);
    refreshDomesticHud();
    refreshCountryHud();
  });

  triggerTurnoverBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    leadershipSystem.applyGovernmentTurnover(focusCountry, 'manual_override');
    setStatus(`Manual government turnover applied for ${focusCountry}.`);
    refreshDomesticHud();
    refreshCountryHud();
    refreshDiplomacyHud();
    refreshPolicyHud();
  });

  applyElectionOffsetBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const days = Math.max(1, Number(electionOffsetDaysInput.value) || 30);
    const changed = leadershipSystem.setElectionOffsetDays(focusCountry, days);
    if (!changed) {
      setStatus('Election timing update not available for this regime.', true);
      return;
    }
    setStatus(`Election timing moved to ${days} days from now for ${focusCountry}.`);
    refreshDomesticHud();
  });
}

function attachFactionControls() {
  const mutateFaction = (mutator, message) => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    const country = countrySystem.ensureCountry(focusCountry);
    factionSystem.ensureCountryFactions(country);
    mutator(country, focusCountry);
    country.factionEffects = factionSystem.computePressure(country);
    refreshDomesticHud();
    setStatus(message);
  };

  factionInfluenceUpBtn.addEventListener('click', () => mutateFaction((country) => {
    country.factions.security_elite.influence = factionSystem.clamp(country.factions.security_elite.influence + 8);
  }, 'Security-elite influence increased.'));
  factionInfluenceDownBtn.addEventListener('click', () => mutateFaction((country) => {
    country.factions.security_elite.influence = factionSystem.clamp(country.factions.security_elite.influence - 8);
  }, 'Security-elite influence reduced.'));
  factionSatisfactionUpBtn.addEventListener('click', () => mutateFaction((country) => {
    country.factions.public_civic_pressure.satisfaction = factionSystem.clamp(country.factions.public_civic_pressure.satisfaction + 8);
  }, 'Public/civic support increased.'));
  factionSatisfactionDownBtn.addEventListener('click', () => mutateFaction((country) => {
    country.factions.public_civic_pressure.satisfaction = factionSystem.clamp(country.factions.public_civic_pressure.satisfaction - 8);
  }, 'Public/civic support reduced.'));
  triggerFactionShiftBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    factionSystem.triggerPressureShift(focusCountry);
    refreshDomesticHud();
    setStatus(`Faction pressure shift triggered for ${focusCountry}.`);
  });
  resetFactionStateBtn.addEventListener('click', () => {
    const focusCountry = getDiplomacyFocusCountry();
    if (!focusCountry) {
      setStatus('Select a country first.', true);
      return;
    }
    factionSystem.resetCountryFactions(focusCountry);
    refreshDomesticHud();
    setStatus(`Faction state reset for ${focusCountry}.`);
  });
}

function attachMigrationControls() {
  triggerRefugeeFlowBtn.addEventListener('click', () => {
    const origin = migrationOriginSelect.value;
    const destination = migrationDestinationSelect.value;
    const amount = Number(migrationAmountInput.value) || 10;
    const result = migrationSystem.triggerManualFlow(origin, destination, 'refugee', amount, 'manual_refugee_shock');
    if (!result.ok) {
      setStatus(result.message, true);
      return;
    }
    setStatus(`Manual refugee flow triggered: ${origin} → ${destination}.`);
    refreshMigrationHud();
    refreshDomesticHud();
  });

  triggerEconomicMigrationBtn.addEventListener('click', () => {
    const origin = migrationOriginSelect.value;
    const destination = migrationDestinationSelect.value;
    const amount = Number(migrationAmountInput.value) || 10;
    const result = migrationSystem.triggerManualFlow(origin, destination, 'migration', amount, 'manual_economic_pressure');
    if (!result.ok) {
      setStatus(result.message, true);
      return;
    }
    setStatus(`Manual economic migration flow triggered: ${origin} → ${destination}.`);
    refreshMigrationHud();
    refreshDomesticHud();
  });

  easeSelectedFlowBtn.addEventListener('click', () => {
    const flowId = Number(migrationFlowSelect.value);
    if (!flowId) {
      setStatus('Select an active flow to ease.', true);
      return;
    }
    const reduced = migrationSystem.reduceFlow(flowId, 0.35);
    if (!reduced) {
      setStatus('Unable to reduce selected flow.', true);
      return;
    }
    setStatus(`Flow #${flowId} reduced.`);
    refreshMigrationHud();
  });

  recomputeMigrationBtn.addEventListener('click', () => {
    migrationSystem.recomputeNow();
    setStatus('Migration system recomputed.');
    refreshMigrationHud();
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
    refreshGovernmentProfileHud();
    refreshDomesticHud();
    refreshResistanceHud();
    refreshInformationHud();
    refreshMigrationHud();
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

  mapRoot = svg.append('g').attr('id', 'mapRoot');
  countriesLayer = mapRoot.append('g').attr('id', 'countriesLayer');
  citiesLayer = mapRoot.append('g').attr('id', 'citiesLayer');
  basesLayer = mapRoot.append('g').attr('id', 'basesLayer');
  unitsLayer = mapRoot.append('g').attr('id', 'unitsLayer');

  countries = await loadCountriesData();
  initializeCityState();

  function placeBaseFromEvent(event) {
    if (shouldIgnoreMapClick()) return;
    const lonLat = getMapLonLatFromEvent(event);
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
      if (shouldIgnoreMapClick()) return;
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

  mapZoomBehavior = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[-width * 0.6, -height * 0.6], [width * 1.6, height * 1.6]])
    .on('start', () => {
      mapWrap.classList.add('panning');
    })
    .on('zoom', (event) => {
      if (!mapRoot) return;
      mapRoot.attr('transform', event.transform);
      const source = event.sourceEvent;
      if (source && (source.type === 'mousemove' || source.type === 'pointermove') && (Math.abs(source.movementX) > 2 || Math.abs(source.movementY) > 2)) {
        suppressMapClick = true;
      }
    })
    .on('end', () => {
      mapWrap.classList.remove('panning');
      setTimeout(() => { suppressMapClick = false; }, 0);
    });

  svg.call(mapZoomBehavior).on('dblclick.zoom', null);
  resetViewBtn.addEventListener('click', () => {
    svg.transition().duration(250).call(mapZoomBehavior.transform, d3.zoomIdentity);
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
  organizePanels();
  attachDrawerControls();
  applySettingsUI();
  attachMenuHandlers();
  attachTimeControls();
  attachUnitControls();
  attachDiplomacyControls();
  attachNegotiationControls();
  attachPolicyControls();
  attachGovernmentProfileControls();
  attachLeadershipControls();
  attachInformationControls();
  attachResistanceControls();
  attachLocalHotspotControls();
  attachFactionControls();
  attachMigrationControls();
  attachEventControls();
  attachChokepointControls();
  attachBlocControls();
  attachTradeControls();
  refreshTimeHud();
  refreshEconomyHud();
  refreshCountryHud();
  refreshDiplomacyHud();
  refreshPolicyHud();
  refreshGovernmentProfileHud();
  refreshDomesticHud();
  refreshResistanceHud();
  refreshLocalHotspotHud();
  refreshInformationHud();
  refreshMigrationHud();
  refreshEventHud();
  refreshChokepointHud();
  refreshBlocHud();
  refreshTradeHud();
  renderSelectedUnitPanel();
  hudAlerts.textContent = 'Alerts: Ready';

  try {
    await setupMap();
  } catch (err) {
    console.error(err);
    setStatus('Map data failed to load from all sources. Check internet access and refresh.', true);
  }

  startSimulationLoop();
}

init();
