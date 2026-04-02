window.createGeoCommandRuntime = function createGeoCommandRuntime() {
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
    proxyConflict: {
      operations: [],
      nextOperationId: 1,
      cooldownsByKey: {},
      lastTickAt: null,
      lastSummary: 'No proxy operations yet.',
      incidentLog: []
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
    },
    scenario: {
      id: 'modern',
      name: 'Modern Baseline',
      mode: 'standard',
      appliedAt: Date.parse(GAME_START_ISO)
    }
  };
  
  const gameClock = new GameClock({
    startTimeMs: gameState.currentTimeMs,
    speed: gameState.simulationSpeed
  });
  
  const scheduler = new TaskScheduler(gameState);
  const governmentProfileSystem = new GovernmentProfileSystem(gameState);
  const countrySystem = new CountrySystem(gameState, scheduler, governmentProfileSystem);
  const stateStructureSystem = new StateStructureSystem(gameState, scheduler, countrySystem);
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
  const internalResistanceSystem = new InternalResistanceSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, migrationSystem, stateStructureSystem);
  const localInstabilitySystem = new LocalInstabilitySystem(gameState, scheduler, countrySystem, migrationSystem, eventSystem, internalResistanceSystem, null, stateStructureSystem);
  const informationSystem = new InformationSystem(gameState, scheduler, countrySystem, diplomacySystem, eventSystem, migrationSystem, governmentProfileSystem);
  const influenceSystem = new InfluenceSystem(gameState, scheduler, countrySystem, diplomacySystem, governmentProfileSystem);
  const proxyConflictSystem = new ProxyConflictSystem(gameState, scheduler, countrySystem, diplomacySystem, localInstabilitySystem, factionSystem, blocSystem);
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
    governmentProfileSystem,
    stateStructureSystem,
    leadershipSystem
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
  const hudPlayerCountry = document.getElementById('hudPlayerCountry');
  const hudCurrentCountry = document.getElementById('hudCurrentCountry');
  const hudSelectionCue = document.getElementById('hudSelectionCue');
  const hudAlerts = document.getElementById('hudAlerts');
  const hudAlertFeed = document.getElementById('hudAlertFeed');
  const resetViewBtn = document.getElementById('resetViewBtn');
  const rightPanel = document.getElementById('rightPanel');
  const bottomDrawer = document.getElementById('bottomDrawer');
  const bottomDrawerTabs = document.getElementById('bottomDrawerTabs');
  const bottomDrawerContent = document.getElementById('bottomDrawerContent');
  const toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
  const economySummary = document.getElementById('economySummary');
  const quickSaveBtn = document.getElementById('quickSaveBtn');
  const quickLoadBtn = document.getElementById('quickLoadBtn');
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
  const leaderDisplayName = document.getElementById('leaderDisplayName');
  const leaderArchetypeLabel = document.getElementById('leaderArchetypeLabel');
  const leaderTraitRisk = document.getElementById('leaderTraitRisk');
  const leaderTraitRepression = document.getElementById('leaderTraitRepression');
  const leaderTraitEconomic = document.getElementById('leaderTraitEconomic');
  const leaderTraitDiplomatic = document.getElementById('leaderTraitDiplomatic');
  const leaderTraitCrisis = document.getElementById('leaderTraitCrisis');
  const leaderFlavorSummary = document.getElementById('leaderFlavorSummary');
  const leaderFlavorBio = document.getElementById('leaderFlavorBio');
  const leaderBehaviorExplanation = document.getElementById('leaderBehaviorExplanation');
  const leaderBehaviorHint = document.getElementById('leaderBehaviorHint');
  const leaderRenameInput = document.getElementById('leaderRenameInput');
  const leaderRenameBtn = document.getElementById('leaderRenameBtn');
  const leaderRegenerateBtn = document.getElementById('leaderRegenerateBtn');
  const leaderRefreshFlavorBtn = document.getElementById('leaderRefreshFlavorBtn');
  const leaderRerollIdentityBtn = document.getElementById('leaderRerollIdentityBtn');
  const leaderArchetypeSelect = document.getElementById('leaderArchetypeSelect');
  const leaderApplyArchetypeBtn = document.getElementById('leaderApplyArchetypeBtn');
  const leaderRiskUpBtn = document.getElementById('leaderRiskUpBtn');
  const leaderRiskDownBtn = document.getElementById('leaderRiskDownBtn');
  const leaderRepressionUpBtn = document.getElementById('leaderRepressionUpBtn');
  const leaderRepressionDownBtn = document.getElementById('leaderRepressionDownBtn');
  const leaderEconomicUpBtn = document.getElementById('leaderEconomicUpBtn');
  const leaderEconomicDownBtn = document.getElementById('leaderEconomicDownBtn');
  const leaderDiplomaticUpBtn = document.getElementById('leaderDiplomaticUpBtn');
  const leaderDiplomaticDownBtn = document.getElementById('leaderDiplomaticDownBtn');
  const electionOffsetDaysInput = document.getElementById('electionOffsetDaysInput');
  const applyElectionOffsetBtn = document.getElementById('applyElectionOffsetBtn');
  const stateStructureFocusCountry = document.getElementById('stateStructureFocusCountry');
  const stateStructureSummary = document.getElementById('stateStructureSummary');
  const stateAutonomyLabel = document.getElementById('stateAutonomyLabel');
  const stateGovernanceLabel = document.getElementById('stateGovernanceLabel');
  const stateEmergencyLabel = document.getElementById('stateEmergencyLabel');
  const stateTensionLabel = document.getElementById('stateTensionLabel');
  const stateStructureSelect = document.getElementById('stateStructureSelect');
  const autonomyUpBtn = document.getElementById('autonomyUpBtn');
  const autonomyDownBtn = document.getElementById('autonomyDownBtn');
  const governanceUpBtn = document.getElementById('governanceUpBtn');
  const governanceDownBtn = document.getElementById('governanceDownBtn');
  const tensionUpBtn = document.getElementById('tensionUpBtn');
  const tensionDownBtn = document.getElementById('tensionDownBtn');
  const toggleEmergencyPowersBtn = document.getElementById('toggleEmergencyPowersBtn');
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
  const proxyFocusCountry = document.getElementById('proxyFocusCountry');
  const proxySummary = document.getElementById('proxySummary');
  const proxyTypeSelect = document.getElementById('proxyTypeSelect');
  const proxyTargetCountrySelect = document.getElementById('proxyTargetCountrySelect');
  const proxyTargetHotspotSelect = document.getElementById('proxyTargetHotspotSelect');
  const proxyStrengthInput = document.getElementById('proxyStrengthInput');
  const proxyRiskInput = document.getElementById('proxyRiskInput');
  const proxyDurationInput = document.getElementById('proxyDurationInput');
  const startProxyOperationBtn = document.getElementById('startProxyOperationBtn');
  const cancelProxyOperationBtn = document.getElementById('cancelProxyOperationBtn');
  const forceExposeProxyOperationBtn = document.getElementById('forceExposeProxyOperationBtn');
  const activeProxyOperationSelect = document.getElementById('activeProxyOperationSelect');
  const activeProxyList = document.getElementById('activeProxyList');
  const proxyIncidentList = document.getElementById('proxyIncidentList');
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
  const latestSaveMeta = document.getElementById('latestSaveMeta');
  const manualSaveSlotSelect = document.getElementById('manualSaveSlotSelect');
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  const manualLoadBtn = document.getElementById('manualLoadBtn');
  const manualRenameBtn = document.getElementById('manualRenameBtn');
  const manualDeleteBtn = document.getElementById('manualDeleteBtn');
  const manualSaveLabelInput = document.getElementById('manualSaveLabelInput');
  const manualLoadPauseCheckbox = document.getElementById('manualLoadPauseCheckbox');
  const manualSaveList = document.getElementById('manualSaveList');
  const scenarioPresetList = document.getElementById('scenarioPresetList');
  
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
  let projection;
  let mapRenderer;
  let menuController;
  let layoutPanelController;
  let countryPanelController;
  let uiControllers;
  let playStep = 1;
  let lastFrameTime = performance.now();
  let lastAutosaveDay = null;
  const AUTOSAVE_INTERVAL_DAYS = 3;
  const alertHistory = [];
  
  const settingsState = {
    music: Number(localStorage.getItem('musicVolume') ?? 40),
    sfx: Number(localStorage.getItem('sfxVolume') ?? 60)
  };


  layoutPanelController = window.createLayoutPanelController({
    rightPanel,
    bottomDrawer,
    bottomDrawerTabs,
    bottomDrawerContent,
    toggleDrawerBtn,
    hudCurrentCountry,
    gameState
  });

  const panelScope = {
    gameState,
    gameClock,
    scheduler,
    governmentProfileSystem,
    countrySystem,
    stateStructureSystem,
    diplomacySystem,
    eventSystem,
    resourceSystem,
    chokepointSystem,
    blocSystem,
    tradeSystem,
    negotiationSystem,
    policySystem,
    domesticStateSystem,
    politicalSystem,
    factionSystem,
    leadershipSystem,
    migrationSystem,
    internalResistanceSystem,
    localInstabilitySystem,
    informationSystem,
    influenceSystem,
    proxyConflictSystem,
    productionSystem,
    movementSystem,
    combatSystem,
    captureSystem,
    economySystem,
    aiSystem,
    svg,
    mapWrap,
    tooltip,
    selectedCountryLabel,
    cityList,
    statusLabel,
    baseButtons,
    playerProfile,
    gameDateTime,
    simSpeedLabel,
    treasuryLabel,
    hudCurrentCountry,
    hudAlerts,
    resetViewBtn,
    rightPanel,
    bottomDrawer,
    bottomDrawerTabs,
    bottomDrawerContent,
    toggleDrawerBtn,
    economySummary,
    aiCountriesLabel,
    countryHudName,
    countryHudTreasury,
    countryHudPop,
    countryHudStability,
    countryHudOil,
    countryHudIndustry,
    countryHudManpower,
    countryHudStrain,
    countryHudAssets,
    countryHudFlow,
    diplomacyFocusCountry,
    diplomacySummary,
    diplomacyTargetCountry,
    declareWarBtn,
    makePeaceBtn,
    improveRelationsBtn,
    worsenRelationsBtn,
    relationsList,
    sanctionsStateLabel,
    tradeStateLabel,
    sanctionLightBtn,
    sanctionHeavyBtn,
    liftSanctionsBtn,
    toggleTradeBtn,
    negotiationSummary,
    negotiationCountryA,
    negotiationCountryB,
    ceasefireDaysInput,
    tradeRestoreDaysInput,
    declareCeasefireBtn,
    signPeaceDealBtn,
    grantSanctionsReliefBtn,
    borderDeEscalationBtn,
    restoreTradeBtn,
    negotiationStateList,
    policyFocusCountry,
    policySummary,
    militaryPolicySelect,
    industryPolicySelect,
    securityPolicySelect,
    applyPolicyBtn,
    policyCostLabel,
    govProfileFocusCountry,
    govProfileSummary,
    govProfileHint,
    regimeTypeSelect,
    economicOrientationSelect,
    foreignPolicyStyleSelect,
    applyGovernmentProfileBtn,
    domesticFocusCountry,
    domesticStability,
    domesticUnrest,
    domesticWarWeariness,
    domesticEconomicStress,
    domesticLegitimacy,
    domesticPublicSupport,
    domesticEliteSupport,
    domesticPoliticalLabel,
    domesticTrend,
    domesticLeaderApproval,
    domesticLeaderMandate,
    domesticGovernmentContinuity,
    domesticElectionDate,
    domesticLeadershipLabel,
    domesticLeadershipSummary,
    domesticFactionSummary,
    domesticFactionBias,
    domesticFactionsList,
    factionInfluenceUpBtn,
    factionInfluenceDownBtn,
    factionSatisfactionUpBtn,
    factionSatisfactionDownBtn,
    triggerFactionShiftBtn,
    resetFactionStateBtn,
    resistanceFocusCountry,
    resistanceInsurgency,
    resistanceSeparatist,
    resistanceControl,
    resistanceForeign,
    resistanceStatus,
    resistanceImpact,
    resistanceHotspots,
    raiseInsurgencyBtn,
    lowerInsurgencyBtn,
    raiseSeparatistBtn,
    lowerSeparatistBtn,
    raiseStateControlBtn,
    lowerStateControlBtn,
    raiseForeignPressureBtn,
    lowerForeignPressureBtn,
    triggerResistanceHotspotBtn,
    localHotspotFocusCountry,
    localHotspotSummary,
    localHotspotSelect,
    localHotspotMetrics,
    localHotspotTags,
    localHotspotPressure,
    localHotspotTagSelect,
    localHotspotList,
    raiseLocalUnrestBtn,
    lowerLocalUnrestBtn,
    raiseLocalControlBtn,
    lowerLocalControlBtn,
    raiseLocalStabilityBtn,
    lowerLocalStabilityBtn,
    createManualHotspotBtn,
    clearManualHotspotBtn,
    leaderApprovalUpBtn,
    leaderApprovalDownBtn,
    leaderMandateUpBtn,
    leaderMandateDownBtn,
    triggerElectionCheckBtn,
    triggerTurnoverBtn,
    leaderDisplayName,
    leaderArchetypeLabel,
    leaderTraitRisk,
    leaderTraitRepression,
    leaderTraitEconomic,
    leaderTraitDiplomatic,
    leaderTraitCrisis,
    leaderFlavorSummary,
    leaderFlavorBio,
    leaderBehaviorExplanation,
    leaderBehaviorHint,
    leaderRenameInput,
    leaderRenameBtn,
    leaderRegenerateBtn,
    leaderRefreshFlavorBtn,
    leaderRerollIdentityBtn,
    leaderArchetypeSelect,
    leaderApplyArchetypeBtn,
    leaderRiskUpBtn,
    leaderRiskDownBtn,
    leaderRepressionUpBtn,
    leaderRepressionDownBtn,
    leaderEconomicUpBtn,
    leaderEconomicDownBtn,
    leaderDiplomaticUpBtn,
    leaderDiplomaticDownBtn,
    electionOffsetDaysInput,
    applyElectionOffsetBtn,
    stateStructureFocusCountry,
    stateStructureSummary,
    stateAutonomyLabel,
    stateGovernanceLabel,
    stateEmergencyLabel,
    stateTensionLabel,
    stateStructureSelect,
    autonomyUpBtn,
    autonomyDownBtn,
    governanceUpBtn,
    governanceDownBtn,
    tensionUpBtn,
    tensionDownBtn,
    toggleEmergencyPowersBtn,
    infoFocusCountry,
    infoNarrativePressure,
    infoReputation,
    infoControl,
    infoLegitimacy,
    infoInfluenceSummary,
    infoLabel,
    reputationLabel,
    influenceTypeSelect,
    influenceTargetCountry,
    influenceIntensityInput,
    influenceDurationInput,
    startInfluenceOperationBtn,
    cancelInfluenceOperationBtn,
    activeInfluenceOperationSelect,
    activeInfluenceList,
    proxyFocusCountry,
    proxySummary,
    proxyTypeSelect,
    proxyTargetCountrySelect,
    proxyTargetHotspotSelect,
    proxyStrengthInput,
    proxyRiskInput,
    proxyDurationInput,
    startProxyOperationBtn,
    cancelProxyOperationBtn,
    forceExposeProxyOperationBtn,
    activeProxyOperationSelect,
    activeProxyList,
    proxyIncidentList,
    raiseNarrativePressureBtn,
    lowerNarrativePressureBtn,
    raiseReputationBtn,
    lowerReputationBtn,
    raiseInfoControlBtn,
    lowerInfoControlBtn,
    triggerInfoSuccessBtn,
    triggerInfoScandalBtn,
    migrationFocusCountry,
    migrationSummary,
    migrationInflowLabel,
    migrationOutflowLabel,
    migrationHumanitarianLabel,
    migrationFlowList,
    migrationOriginSelect,
    migrationDestinationSelect,
    triggerRefugeeFlowBtn,
    triggerEconomicMigrationBtn,
    migrationAmountInput,
    migrationFlowSelect,
    easeSelectedFlowBtn,
    recomputeMigrationBtn,
    eventSummary,
    eventTypeSelect,
    eventTargetCountry,
    eventSecondaryCountry,
    triggerEventBtn,
    activeEventsList,
    eventLogList,
    chokepointSummary,
    chokepointSelect,
    chokepointControllerSelect,
    chokepointOpenBtn,
    chokepointRestrictedBtn,
    chokepointBlockedBtn,
    chokepointContestedToggleBtn,
    assignChokepointControllerBtn,
    recomputeRoutePressureBtn,
    chokepointList,
    blocSummary,
    selectedCountryBlocs,
    blocNameInput,
    blocTypeSelect,
    createBlocBtn,
    blocSelect,
    blocMemberCountrySelect,
    addBlocMemberBtn,
    removeBlocMemberBtn,
    dissolveBlocBtn,
    blocList,
    tradeSummary,
    tradeBalanceSummary,
    toggleAutoTradeBtn,
    recomputeTradeBtn,
    tradeExporterSelect,
    tradeImporterSelect,
    tradeResourceSelect,
    tradeAmountInput,
    forceTradeBtn,
    blockTradePairBtn,
    tradeFlowsList,
    prodBaseLabel,
    prodUnitButtons,
    prodCurrent,
    prodQueue,
    unitCount,
    unitList,
    selectedUnitLabel,
    selectedUnitMeta,
    moveUnitBtn,
    attackUnitBtn,
    captureUnitBtn,
    clearUnitSelectionBtn,
    moveModeStatus,
    attackModeStatus,
    captureModeStatus,
    selectedAssetStatus,
    overlays,
    playTitle,
    playStepIndicator,
    playStepCountry,
    playStepLeader,
    playStepScenario,
    playStepConfirm,
    countrySelect,
    countryWarning,
    leaderNameInput,
    scenarioTypeSelect,
    simulationModeSelect,
    launchSummary,
    timeControlButtons,
    skipDayBtn,
    skipWeekBtn,
    skipMonthBtn,
    menuPreviewLabel,
    menuPreviewTitle,
    menuPreviewDescription,
    menuPreviewBullets,
    baseTypes,
    majorCities,
    selectedBaseType,
    selectedCountryFeature,
    countries,
    playStep,
    lastFrameTime,
    settingsState,
    refreshDomainPanels,
    bindDomainPanels,
    formatDateTime,
    refreshTimeHud,
    refreshEconomyHud,
    refreshCountryHud,
    getDiplomacyFocusCountry,
    refreshDiplomacyHud,
    refreshNegotiationHud,
    refreshGovernmentProfileHud,
    refreshPolicyHud,
    refreshDomesticHud,
    refreshStateStructureHud,
    refreshResistanceHud,
    refreshLocalHotspotHud,
    refreshInformationHud,
    refreshProxyConflictHud,
    refreshMigrationHud,
    refreshEventHud,
    refreshChokepointHud,
    refreshBlocHud,
    refreshTradeHud,
    setStatus,
    getMapLonLatFromEvent,
    shouldIgnoreMapClick,
    organizePanels,
    setDrawerCollapsed,
    attachDrawerControls,
    updateContextActionPanels,
    setOverlay,
    hideOverlays,
    updatePlayFlowUI,
    renderCityList,
    initializeCityState,
    updateCountryStyles,
    setPlayerCountry,
    spawnEnemyForces,
    pointInsideCountry,
    createBaseButtons,
    populateCountrySelect,
    applySettingsUI,
    setSimulationSpeed,
    attachTimeControls,
    skipGameTime,
    createBase,
    renderBases,
    renderCities,
    renderUnits,
    renderSelectedUnitPanel,
    renderProductionPanel,
    refreshProductionTicker,
    setMenuPreview,
    attachMenuHandlers,
    attachUnitControls,
    attachDiplomacyControls,
    attachNegotiationControls,
    attachPolicyControls,
    attachGovernmentProfileControls,
    attachInformationControls,
    attachProxyConflictControls,
    attachResistanceControls,
    attachLocalHotspotControls,
    attachLeadershipControls,
    attachFactionControls,
    attachStateStructureControls,
    attachMigrationControls,
    attachEventControls,
    attachChokepointControls,
    attachBlocControls,
    attachTradeControls,
    startSimulationLoop,
    placeBaseFromLonLat,
  };

  countryPanelController = window.createCountryPanelController({
    cityList,
    baseButtons,
    countrySelect,
    gameState,
    majorCities,
    baseTypes,
    getSelectedBaseType: () => selectedBaseType,
    setSelectedBaseType: (nextType) => {
      selectedBaseType = nextType;
    },
    setStatus
  });

  uiControllers = {
    diplomacy: window.createDiplomacyPanelController(panelScope),
    negotiation: window.createNegotiationPanelController(panelScope),
    government: window.createGovernmentPanelController(panelScope),
    stateStructure: window.createStateStructurePanelController(panelScope),
    resistance: window.createResistancePanelController(panelScope),
    localHotspot: window.createLocalHotspotPanelController(panelScope),
    information: window.createInformationPanelController(panelScope),
    proxy: window.createProxyPanelController(panelScope),
    migration: window.createMigrationPanelController(panelScope),
    event: window.createEventPanelController(panelScope),
    chokepoint: window.createChokepointPanelController(panelScope),
    bloc: window.createBlocPanelController(panelScope),
    trade: window.createTradePanelController(panelScope)
  };

  function refreshDomainPanels() {
    uiControllers.diplomacy.refresh();
    uiControllers.negotiation.refresh();
    uiControllers.government.refreshPolicyHud();
    uiControllers.government.refreshGovernmentProfileHud();
    uiControllers.government.refreshDomesticHud();
    uiControllers.stateStructure.refresh();
    uiControllers.resistance.refresh();
    uiControllers.localHotspot.refresh();
    uiControllers.information.refresh();
    uiControllers.proxy.refresh();
    uiControllers.migration.refresh();
    uiControllers.event.refresh();
    uiControllers.chokepoint.refresh();
    uiControllers.bloc.refresh();
    uiControllers.trade.refresh();
  }

  function bindDomainPanels() {
    uiControllers.diplomacy.bind();
    uiControllers.negotiation.bind();
    uiControllers.government.bindPolicyControls();
    uiControllers.government.bindGovernmentProfileControls();
    uiControllers.government.bindLeadershipControls();
    uiControllers.government.bindFactionControls();
    uiControllers.stateStructure.bind();
    uiControllers.resistance.bind();
    uiControllers.localHotspot.bind();
    uiControllers.information.bind();
    uiControllers.proxy.bind();
    uiControllers.migration.bind();
    uiControllers.event.bind();
    uiControllers.chokepoint.bind();
    uiControllers.bloc.bind();
    uiControllers.trade.bind();
  }

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
    return uiControllers.diplomacy.refresh();
  }
  
  function refreshNegotiationHud() {
    return uiControllers.negotiation.refresh();
  }
  
  
  function refreshGovernmentProfileHud() {
    return uiControllers.government.refreshGovernmentProfileHud();
  }
  
  function refreshPolicyHud() {
    return uiControllers.government.refreshPolicyHud();
  }
  
  function refreshDomesticHud() {
    return uiControllers.government.refreshDomesticHud();
  }
  
  function refreshStateStructureHud() {
    return uiControllers.stateStructure.refresh();
  }
  
  function refreshResistanceHud() {
    return uiControllers.resistance.refresh();
  }
  
  
  
  function refreshLocalHotspotHud() {
    return uiControllers.localHotspot.refresh();
  }
  
  function refreshInformationHud() {
    return uiControllers.information.refresh();
  }
  
  function refreshProxyConflictHud() {
    return uiControllers.proxy.refresh();
  }
  
  function refreshMigrationHud() {
    return uiControllers.migration.refresh();
  }
  
  function refreshEventHud() {
    return uiControllers.event.refresh();
  }
  
  function refreshChokepointHud() {
    return uiControllers.chokepoint.refresh();
  }
  
  function refreshBlocHud() {
    return uiControllers.bloc.refresh();
  }
  
  function refreshTradeHud() {
    return uiControllers.trade.refresh();
  }
  
  function setStatus(message, tone = false) {
    const level = tone === true ? 'danger' : (typeof tone === 'string' ? tone : 'info');
    const statusClass = `status-${level === 'danger' ? 'danger' : level === 'warning' ? 'warning' : level === 'success' ? 'success' : 'info'}`;
    statusLabel.textContent = message;
    statusLabel.classList.remove('status-success', 'status-warning', 'status-danger', 'status-info');
    statusLabel.classList.add(statusClass);

    hudAlerts.classList.remove('hud-alert-info', 'hud-alert-success', 'hud-alert-warning', 'hud-alert-danger');
    hudAlerts.classList.add(`hud-alert-${level === 'danger' ? 'danger' : level}`);
    hudAlerts.textContent = `${level.toUpperCase()}: ${message}`;

    alertHistory.unshift({ message, level, at: Date.now() });
    if (alertHistory.length > 6) alertHistory.length = 6;
    if (hudAlertFeed) {
      hudAlertFeed.innerHTML = '';
      alertHistory.slice(0, 3).forEach((entry) => {
        const el = document.createElement('div');
        el.className = `hud-alert-item ${entry.level}`;
        el.textContent = entry.message;
        hudAlertFeed.appendChild(el);
      });
    }
  }
  
  function getMapLonLatFromEvent(event) {
    return mapRenderer ? mapRenderer.getLonLatFromEvent(event) : null;
  }
  
  function shouldIgnoreMapClick() {
    return mapRenderer ? mapRenderer.shouldIgnoreMapClick() : false;
  }
  
  function organizePanels() {
    if (layoutPanelController) {
      layoutPanelController.organizePanels();
      return;
    }

    const cards = Array.from(document.querySelectorAll('.sidebar .card'));
    const byTitle = new Map(cards.map((card) => [card.querySelector('h2')?.textContent?.trim(), card]));
    const leftTitles = ['Geo Command', 'Simulation', 'Command Setup', 'Country Overview', 'Included Major Cities', 'Legend'];
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
    if (layoutPanelController) {
      layoutPanelController.attachDrawerControls();
      return;
    }

    if (!toggleDrawerBtn) return;
    setDrawerCollapsed(true);
    toggleDrawerBtn.addEventListener('click', () => {
      const collapsed = bottomDrawer.classList.contains('collapsed');
      setDrawerCollapsed(!collapsed);
    });
  }
  
  function updateContextActionPanels() {
    if (layoutPanelController) {
      layoutPanelController.updateContextActionPanels();
      return;
    }

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
    if (menuController) {
      menuController.setOverlay(name);
      return;
    }
    Object.entries(overlays).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  }
  
  function hideOverlays() {
    if (menuController) {
      menuController.hideOverlays();
      return;
    }
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
      bullets: ['Four-step launch sequence.', 'Scenario presets now apply real starting-state changes.']
    },
    loadScenario: {
      label: 'Archive & Scenario Deck',
      title: 'Load / Scenario Browser',
      description: 'Continue the latest autosave, manage manual slots, and review scenario presets.',
      bullets: ['Continue now loads persisted latest session.', 'Manual save slots include country/date metadata.']
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
    if (!countryPanelController) return;
    countryPanelController.renderCityList(countryName);
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
    if (!mapRenderer) return;
    mapRenderer.refreshSelection();
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
    selectedCountryLabel.textContent = `Inspected country: ${countryFeature.properties.name}`;
    selectedCountryLabel.classList.add('is-selected');
    economySystem.ensureCountry(countryFeature.properties.name);
    const playerCountryState = countrySystem.ensureCountry(countryFeature.properties.name, false);
    playerProfile.textContent = `Player country: ${countryFeature.properties.name} (${governmentProfileSystem.getProfileSummary(playerCountryState)})`;
    hudPlayerCountry.textContent = `Commander: ${countryFeature.properties.name}`;
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
    stateStructureSystem.start();
    politicalSystem.start();
    factionSystem.start();
    leadershipSystem.start();
    informationSystem.start();
    influenceSystem.start();
    migrationSystem.start();
    internalResistanceSystem.start();
    localInstabilitySystem.start();
    proxyConflictSystem.start();
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
    refreshStateStructureHud();
    refreshResistanceHud();
    refreshLocalHotspotHud();
    refreshInformationHud();
    refreshProxyConflictHud();
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
    refreshProxyConflictHud();
    refreshMigrationHud();
    refreshEventHud();
    refreshTradeHud();
  }
  
  function pointInsideCountry(countryFeature, lonLatPoint) {
    if (!countryFeature) return false;
    return d3.geoContains(countryFeature, lonLatPoint);
  }
  
  function createBaseButtons() {
    if (!countryPanelController) return;
    countryPanelController.createBaseButtons(() => gameState.selectedPlayerCountry?.properties?.name || null);
  }
  
  function populateCountrySelect() {
    if (!countryPanelController) return;
    countryPanelController.populateCountrySelect(countries);
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
      : `Simulation speed set to ${gameState.simulationSpeed}x.`, 'success');
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
    const visibleBases = gameState.bases.filter((base) => base.combatStatus !== 'destroyed');
    if (!mapRenderer) return;
    mapRenderer.renderBases(visibleBases, {
      getColor: (d) => baseTypes.find((b) => b.key === d.type).color,
      getClassName: (d) => `base ${d.status} ${d.combatStatus} ${gameState.aiCountries.includes(d.ownerCountry) ? 'enemy-owner' : ''} ${gameState.selectedBaseId === d.id ? 'selected-base' : ''}`,
      getTitle: (d) => `${d.type} base (${d.status}) HP ${d.health}/${d.maxHealth} - ${d.ownerCountry}`,
      onClick: (event, d) => {
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
        setStatus(`Base #${d.id} selected. Production controls updated.`, 'info');
        renderBases();
        renderProductionPanel();
        refreshCountryHud();
      }
    });
  }

  function renderCities() {
    const visibleCities = gameState.cities.filter((city) => city.status !== 'destroyed');
    if (!mapRenderer) return;
    mapRenderer.renderCities(visibleCities, {
      getClassName: (d) => {
        const severity = Number(d.hotspotSeverity || 0);
        const hotspotClass = severity >= 70 ? 'local-hotspot-critical' : (severity >= 45 ? 'local-hotspot-active' : '');
        return `city city-point ${d.controlStatus} ${hotspotClass}`.trim();
      },
      getTitle: (d) => `${d.name} (${d.ownerCountry}) - ${d.controlStatus} - Income ${Math.round(ECONOMY_CONFIG.cityIncomePerDay * (1 - (d.localEconomicPenalty || 0)))}/day - Local unrest ${(d.localUnrest || 0).toFixed(0)} - Local control ${(d.localStateControl || 0).toFixed(0)}`,
      onClick: (event, d) => {
        gameState.selectedAsset = { type: 'city', id: d.id };
        gameState.selectedCountryForHud = d.ownerCountry;
        selectedAssetStatus.textContent = `Selected asset: City ${d.name} • Owner ${d.ownerCountry} • ${d.controlStatus}`;
        setStatus(`City ${d.name} inspected. Country overview synced.`, 'info');
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
      }
    });
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

    if (!mapRenderer) return;
    mapRenderer.renderUnits(visibleUnits, {
      getClassName: (d) => `unit-marker unit-point ${d.combatStatus || ''} ${gameState.aiCountries.includes(d.ownerCountry) ? 'enemy-owner' : ''} ${gameState.selectedUnitId === d.id ? 'selected' : ''}`,
      getLonLat: (d) => movementSystem.getDisplayLonLat(d),
      getTitle: (d) => `${UNIT_DEFINITIONS[d.type].label} (${d.domain}) - ${d.status}`,
      onClick: (event, d) => {
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
        setStatus(`Unit #${d.id} selected for tactical orders.`, 'info');
        refreshCountryHud();
        renderUnits();
      }
    });
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
    const inspected = gameState.selectedCountryForHud || '--';
    const selectionParts = [];
    if (gameState.selectedUnitId) selectionParts.push(`Unit #${gameState.selectedUnitId}`);
    if (gameState.selectedBaseId) selectionParts.push(`Base #${gameState.selectedBaseId}`);
    if (gameState.selectedAsset?.type === 'city') selectionParts.push('City selected');
    hudSelectionCue.textContent = `Selection: ${selectionParts.length ? selectionParts.join(' • ') : `Country (${inspected})`}`;
    mapWrap.classList.toggle('mode-move', gameState.moveMode);
    mapWrap.classList.toggle('mode-attack', gameState.attackMode);
    mapWrap.classList.toggle('mode-capture', gameState.captureMode);
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
  


  function formatSaveMeta(metadata) {
    if (!metadata) return 'Empty';
    const stamp = metadata.updatedAt ? new Date(metadata.updatedAt).toLocaleString() : 'Unknown time';
    return `${metadata.slotName || metadata.slotId} · ${metadata.country || 'Unknown'} · ${metadata.inGameDate || '--'} · ${metadata.scenario || 'Unknown'} (${metadata.mode || 'standard'}) · ${stamp}`;
  }

  function cloneForSave(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function buildSerializableState() {
    return {
      selectedPlayerCountryName: gameState.selectedPlayerCountry?.properties?.name || null,
      selectedCountryForHud: gameState.selectedCountryForHud || null,
      selectedBaseId: gameState.selectedBaseId,
      selectedUnitId: gameState.selectedUnitId,
      selectedAsset: cloneForSave(gameState.selectedAsset),
      selectedHotspotId: gameState.localInstability?.selectedHotspotId || null,
      currentTimeMs: gameState.currentTimeMs,
      simulationSpeed: gameState.simulationSpeed,
      bases: cloneForSave(gameState.bases),
      cities: cloneForSave(gameState.cities),
      units: cloneForSave(gameState.units),
      pendingTasks: cloneForSave(gameState.pendingTasks),
      treasury: gameState.treasury,
      nextBaseId: gameState.nextBaseId,
      nextUnitId: gameState.nextUnitId,
      moveMode: false,
      attackMode: false,
      captureMode: false,
      enemySpawned: gameState.enemySpawned,
      aiCountries: cloneForSave(gameState.aiCountries),
      aiStateByCountry: cloneForSave(gameState.aiStateByCountry),
      countries: cloneForSave(gameState.countries),
      diplomacy: cloneForSave(gameState.diplomacy),
      negotiation: cloneForSave(gameState.negotiation),
      policy: cloneForSave(gameState.policy),
      domestic: cloneForSave(gameState.domestic),
      political: cloneForSave(gameState.political),
      factions: cloneForSave(gameState.factions),
      leadership: cloneForSave(gameState.leadership),
      information: cloneForSave(gameState.information),
      influence: cloneForSave(gameState.influence),
      proxyConflict: cloneForSave(gameState.proxyConflict),
      migration: cloneForSave(gameState.migration),
      resources: cloneForSave(gameState.resources),
      trade: cloneForSave(gameState.trade),
      chokepoints: cloneForSave(gameState.chokepoints),
      blocs: cloneForSave(gameState.blocs),
      events: cloneForSave(gameState.events),
      economy: cloneForSave(gameState.economy),
      internalResistance: cloneForSave(gameState.internalResistance),
      localInstability: cloneForSave(gameState.localInstability),
      scenario: cloneForSave(gameState.scenario),
      nextCounters: {
        negotiationAgreement: gameState.negotiation?.nextAgreementId || 0,
        influenceOperation: gameState.influence?.nextOperationId || 1,
        proxyOperation: gameState.proxyConflict?.nextOperationId || 1,
        migrationFlow: gameState.migration?.nextFlowId || 1,
        hotspot: gameState.localInstability?.nextHotspotId || 1,
        bloc: gameState.blocs?.nextBlocId || 1,
        schedulerTask: scheduler.nextTaskId,
        eventId: eventSystem.nextEventId
      }
    };
  }

  function createSnapshot(slotId, slotName) {
    const country = gameState.selectedPlayerCountry?.properties?.name || '--';
    const scenarioName = gameState.scenario?.name || window.getGeoScenarioPresetById?.(gameState.scenario?.id || 'modern')?.name || 'Modern Baseline';
    return {
      meta: {
        version: 1,
        slotId,
        slotName,
        country,
        inGameDate: formatDateTime(gameState.currentTimeMs),
        scenario: scenarioName,
        mode: gameState.scenario?.mode || (simulationModeSelect.value || 'standard'),
        updatedAt: new Date().toISOString()
      },
      scheduler: {
        nextTaskId: scheduler.nextTaskId
      },
      state: buildSerializableState()
    };
  }

  function buildTaskHandlerMap() {
    return {
      BASE_CONSTRUCTION_COMPLETE: ({ baseId }) => {
        const targetBase = gameState.bases.find((entry) => entry.id === baseId);
        if (!targetBase || targetBase.status === 'active') return;
        targetBase.status = 'active';
        setStatus(`${targetBase.type} base is now ACTIVE in ${targetBase.ownerCountry}.`);
        renderBases();
        renderProductionPanel();
      },
      UNIT_MOVE_COMPLETE: ({ unitId }) => movementSystem.completeMove(unitId),
      UNIT_PRODUCTION_COMPLETE: ({ baseId, unitId }) => productionSystem.completeProduction(baseId, unitId),
      COMBAT_TICK: ({ attackerId }) => combatSystem.resolveCombatTick(attackerId),
      CAPTURE_COMPLETE: (payload) => captureSystem.resolveCapture(payload),
      RESOURCE_TICK: () => resourceSystem.processTick(),
      FACTION_TICK: () => factionSystem.processTick(),
      CHOKEPOINT_TICK: () => chokepointSystem.processTick(),
      EVENT_TICK: () => eventSystem.processTick(),
      LOCAL_INSTABILITY_TICK: () => localInstabilitySystem.processTick(),
      INFLUENCE_TICK: () => influenceSystem.processTick(),
      INTERNAL_RESISTANCE_TICK: () => internalResistanceSystem.processTick(),
      DIPLOMACY_TICK: () => diplomacySystem.processTick(),
      STATE_STRUCTURE_TICK: () => stateStructureSystem.processTick(),
      ECONOMY_TICK: () => economySystem.processTick(),
      NEGOTIATION_TICK: () => negotiationSystem.processTick(),
      DOMESTIC_TICK: () => domesticStateSystem.processTick(),
      POLITICAL_TICK: () => politicalSystem.processTick(),
      TRADE_TICK: () => tradeSystem.processTick(),
      LEADERSHIP_TICK: () => leadershipSystem.processTick(),
      COUNTRY_TICK: () => countrySystem.processTick(),
      INFORMATION_TICK: () => informationSystem.processTick(),
      POLICY_TICK: () => policySystem.processTick(),
      AI_TICK: () => aiSystem.processTick(),
      AI_STRATEGIC_TICK: () => aiSystem.processStrategicTick(),
      MIGRATION_TICK: () => migrationSystem.processTick(),
      BLOC_TICK: () => blocSystem.processTick(),
      PROXY_CONFLICT_TICK: () => proxyConflictSystem.processTick()
    };
  }

  function restoreScheduledTasks(taskList = [], nextTaskId = 1) {
    scheduler.tasks = [];
    scheduler.nextTaskId = Math.max(1, Number(nextTaskId) || 1);
    const handlerMap = buildTaskHandlerMap();

    const guardResult = window.GeoCommandSaveRuntimeGuards?.sanitizeScheduledTasks
      ? window.GeoCommandSaveRuntimeGuards.sanitizeScheduledTasks(taskList, handlerMap)
      : { tasks: Array.isArray(taskList) ? taskList : [], report: { restored: 0, skippedUnknown: 0, skippedInvalid: 0 } };

    guardResult.tasks.forEach((task) => {
      const handler = handlerMap[task.type];
      if (!handler) return;
      scheduler.tasks.push({
        id: task.id,
        executeAt: task.executeAt,
        type: task.type,
        payload: task.payload,
        handler: () => {
          try {
            handler(task.payload || {});
          } catch (error) {
            console.warn('Scheduled task handler failed during replay:', task.type, error);
          }
        }
      });
    });

    scheduler.tasks.sort((a, b) => a.executeAt - b.executeAt || a.id - b.id);
    scheduler.syncPendingTasks();
    return {
      restored: scheduler.tasks.length,
      skippedUnknown: guardResult.report?.skippedUnknown || 0,
      skippedInvalid: guardResult.report?.skippedInvalid || 0
    };
  }

  function refreshAfterLoad() {
    renderBases();
    renderCities();
    renderUnits();
    renderProductionPanel();
    renderSelectedUnitPanel();
    refreshTimeHud();
    refreshEconomyHud();
    refreshCountryHud();
    refreshDiplomacyHud();
    refreshNegotiationHud();
    refreshPolicyHud();
    refreshGovernmentProfileHud();
    refreshDomesticHud();
    refreshStateStructureHud();
    refreshResistanceHud();
    refreshLocalHotspotHud();
    refreshInformationHud();
    refreshProxyConflictHud();
    refreshMigrationHud();
    refreshEventHud();
    refreshChokepointHud();
    refreshBlocHud();
    refreshTradeHud();
    updateCountryStyles();
    updateContextActionPanels();
  }

  function loadSnapshotIntoRuntime(snapshot, sourceLabel = 'session', options = {}) {
    if (!snapshot?.state) return { ok: false, message: 'Save payload is missing state.' };
    const { pauseAfterLoad = false } = options;
    const incoming = snapshot.state;
    const selectedCountryName = incoming.selectedPlayerCountryName || null;
    const selectedFeature = selectedCountryName ? countries.find((entry) => entry.properties?.name === selectedCountryName) || null : null;

    const targetSpeed = pauseAfterLoad ? 0 : (incoming.simulationSpeed ?? 1);
    gameClock.currentTimeMs = incoming.currentTimeMs || Date.parse(GAME_START_ISO);
    gameClock.setSpeed(targetSpeed);

    Object.assign(gameState, {
      selectedPlayerCountry: selectedFeature,
      selectedCountryForHud: incoming.selectedCountryForHud || selectedCountryName,
      selectedBaseId: incoming.selectedBaseId || null,
      selectedUnitId: incoming.selectedUnitId || null,
      selectedAsset: incoming.selectedAsset || null,
      currentTimeMs: incoming.currentTimeMs || Date.parse(GAME_START_ISO),
      simulationSpeed: targetSpeed,
      bases: incoming.bases || [],
      cities: incoming.cities || [],
      units: incoming.units || [],
      treasury: incoming.treasury || 0,
      nextBaseId: incoming.nextBaseId || 1,
      nextUnitId: incoming.nextUnitId || 1,
      moveMode: false,
      attackMode: false,
      captureMode: false,
      enemySpawned: Boolean(incoming.enemySpawned),
      aiCountries: incoming.aiCountries || [],
      aiStateByCountry: incoming.aiStateByCountry || {},
      countries: incoming.countries || {},
      diplomacy: incoming.diplomacy || gameState.diplomacy,
      negotiation: incoming.negotiation || gameState.negotiation,
      policy: incoming.policy || gameState.policy,
      domestic: incoming.domestic || gameState.domestic,
      political: incoming.political || gameState.political,
      factions: incoming.factions || gameState.factions,
      leadership: incoming.leadership || gameState.leadership,
      information: incoming.information || gameState.information,
      influence: incoming.influence || gameState.influence,
      proxyConflict: incoming.proxyConflict || gameState.proxyConflict,
      migration: incoming.migration || gameState.migration,
      resources: incoming.resources || gameState.resources,
      trade: incoming.trade || gameState.trade,
      chokepoints: incoming.chokepoints || gameState.chokepoints,
      blocs: incoming.blocs || gameState.blocs,
      events: incoming.events || gameState.events,
      economy: incoming.economy || gameState.economy,
      internalResistance: incoming.internalResistance || gameState.internalResistance,
      localInstability: incoming.localInstability || gameState.localInstability,
      scenario: incoming.scenario || gameState.scenario
    });

    if (incoming.nextCounters) {
      gameState.negotiation.nextAgreementId = incoming.nextCounters.negotiationAgreement || gameState.negotiation.nextAgreementId || 0;
      gameState.influence.nextOperationId = incoming.nextCounters.influenceOperation || gameState.influence.nextOperationId || 1;
      gameState.proxyConflict.nextOperationId = incoming.nextCounters.proxyOperation || gameState.proxyConflict.nextOperationId || 1;
      gameState.migration.nextFlowId = incoming.nextCounters.migrationFlow || gameState.migration.nextFlowId || 1;
      gameState.localInstability.nextHotspotId = incoming.nextCounters.hotspot || gameState.localInstability.nextHotspotId || 1;
      gameState.blocs.nextBlocId = incoming.nextCounters.bloc || gameState.blocs.nextBlocId || 1;
      eventSystem.nextEventId = incoming.nextCounters.eventId || eventSystem.nextEventId || 1;
    }

    selectedCountryFeature = selectedFeature;
    if (selectedFeature) {
      selectedCountryLabel.textContent = `Inspected country: ${selectedFeature.properties.name}`;
      selectedCountryLabel.classList.add('is-selected');
      hudPlayerCountry.textContent = `Commander: ${selectedFeature.properties.name}`;
    }

    playerProfile.textContent = selectedFeature
      ? `Loaded session for ${selectedFeature.properties.name} (${gameState.scenario?.name || 'Scenario'}).`
      : 'Loaded session with no active commander selected.';

    const taskRestoreReport = restoreScheduledTasks(incoming.pendingTasks || [], snapshot.scheduler?.nextTaskId || incoming.nextCounters?.schedulerTask || 1);
    refreshAfterLoad();
    const pausedLabel = pauseAfterLoad ? ' Simulation paused for inspection.' : '';
    const queueLabel = (taskRestoreReport.skippedUnknown || taskRestoreReport.skippedInvalid)
      ? ` Restored ${taskRestoreReport.restored} tasks; skipped ${taskRestoreReport.skippedUnknown} unknown and ${taskRestoreReport.skippedInvalid} invalid tasks.`
      : ` Restored ${taskRestoreReport.restored} scheduled tasks.`;
    setStatus(`Loaded ${sourceLabel} successfully.${pausedLabel}${queueLabel}`, 'success');
    return {
      ok: true,
      taskRestoreReport,
      pausedAfterLoad: pauseAfterLoad
    };
  }

  function getDefaultManualSlotLabel(slotId) {
    return `Manual Slot ${slotId.slice(-1)}`;
  }

  function getCurrentSlotMetadata(slotId) {
    const manifest = window.GeoCommandSaveSystem.getManifestView();
    return manifest.slots.find((entry) => entry.slotId === slotId)?.metadata || null;
  }

  function persistSave(slotId, slotName) {
    if (!window.GeoCommandSaveSystem) return { ok: false, message: 'Save subsystem unavailable.' };
    if (!gameState.selectedPlayerCountry) return { ok: false, message: 'Start a simulation before saving.' };
    const hadData = window.GeoCommandSaveSystem.hasSlotData(slotId);
    const snapshot = createSnapshot(slotId, slotName);
    const saved = window.GeoCommandSaveSystem.saveSnapshot({ slotId, slotName, snapshot });
    if (!saved.ok) return saved;
    saved.overwroteExisting = hadData;
    refreshLoadPanelUI();
    return saved;
  }

  function loadSaveSlot(slotId, sourceLabel = 'save slot', options = {}) {
    if (!window.GeoCommandSaveSystem) return { ok: false, message: 'Save subsystem unavailable.' };
    const loaded = window.GeoCommandSaveSystem.loadSnapshot(slotId);
    if (!loaded.ok) {
      if (Array.isArray(loaded.errors) && loaded.errors.length) {
        console.warn('Save validation errors:', loaded.errors);
      }
      return loaded;
    }
    const loadResult = loadSnapshotIntoRuntime(loaded.snapshot, sourceLabel, options);
    if (!loadResult.ok) return loadResult;
    return {
      ...loadResult,
      metadata: loaded.metadata,
      migrations: loaded.migrations || []
    };
  }

  function maybeAutosave(reason = 'autosave') {
    if (!gameState.selectedPlayerCountry) return;
    const dayIndex = Math.floor((gameState.currentTimeMs - Date.parse(GAME_START_ISO)) / DAY_MS);
    if (lastAutosaveDay != null && dayIndex - lastAutosaveDay < AUTOSAVE_INTERVAL_DAYS && reason !== 'launch' && reason !== 'unload') {
      return;
    }
    const result = persistSave(window.GeoCommandSaveSystem.LATEST_SLOT, 'Latest Session');
    if (result.ok) {
      lastAutosaveDay = dayIndex;
    }
  }

  function refreshLoadPanelUI() {
    if (!window.GeoCommandSaveSystem) return;
    const manifest = window.GeoCommandSaveSystem.getManifestView();
    if (latestSaveMeta) {
      latestSaveMeta.textContent = manifest.latest ? `Latest save: ${formatSaveMeta(manifest.latest)}` : 'Latest save: none';
    }

    const selectedSlotId = manualSaveSlotSelect?.value || 'slot1';
    const selectedMetadata = manifest.slots.find((entry) => entry.slotId === selectedSlotId)?.metadata || null;
    if (manualSaveLabelInput) {
      manualSaveLabelInput.value = selectedMetadata?.slotName || getDefaultManualSlotLabel(selectedSlotId);
    }

    if (manualSaveList) {
      manualSaveList.innerHTML = '';
      manifest.manualSlots.forEach((slotId, index) => {
        const metadata = manifest.slots.find((entry) => entry.slotId === slotId)?.metadata || null;
        const item = document.createElement('li');
        if (!metadata) {
          item.textContent = `Manual Slot ${index + 1}: Empty`;
        } else {
          item.textContent = `Manual Slot ${index + 1} (${metadata.slotName}): ${formatSaveMeta(metadata)}`;
        }
        manualSaveList.appendChild(item);
      });
    }

    if (scenarioPresetList) {
      scenarioPresetList.innerHTML = '';
      (window.GEO_SCENARIO_PRESETS || []).forEach((preset) => {
        const item = document.createElement('li');
        item.textContent = `${preset.name}: ${preset.description}`;
        scenarioPresetList.appendChild(item);
      });
    }
  }

  function attachSaveControls() {
    manualSaveSlotSelect?.addEventListener('change', refreshLoadPanelUI);

    manualSaveBtn?.addEventListener('click', () => {
      const slotId = manualSaveSlotSelect?.value || 'slot1';
      const currentMeta = getCurrentSlotMetadata(slotId);
      const customName = (manualSaveLabelInput?.value || '').trim();
      const slotLabel = customName || currentMeta?.slotName || getDefaultManualSlotLabel(slotId);
      if (currentMeta && !window.confirm(`Overwrite ${currentMeta.slotName}?`)) {
        setStatus('Save cancelled. Existing slot kept unchanged.', 'warning');
        return;
      }
      const result = persistSave(slotId, slotLabel);
      if (!result.ok) {
        setStatus(result.message, 'danger');
        return;
      }
      const overwriteLabel = result.overwroteExisting ? ' Overwrite confirmed.' : '';
      setStatus(`Saved to ${slotLabel}.${overwriteLabel}`, 'success');
    });

    manualLoadBtn?.addEventListener('click', () => {
      const slotId = manualSaveSlotSelect?.value || 'slot1';
      const slotMeta = getCurrentSlotMetadata(slotId);
      const slotLabel = slotMeta?.slotName || getDefaultManualSlotLabel(slotId);
      const pauseAfterLoad = Boolean(manualLoadPauseCheckbox?.checked);
      const result = loadSaveSlot(slotId, slotLabel, { pauseAfterLoad });
      if (!result.ok) {
        setStatus(result.message, 'danger');
        return;
      }
      hideOverlays();
    });

    manualRenameBtn?.addEventListener('click', () => {
      const slotId = manualSaveSlotSelect?.value || 'slot1';
      const slotLabel = (manualSaveLabelInput?.value || '').trim();
      const result = window.GeoCommandSaveSystem.renameManualSlot(slotId, slotLabel);
      if (!result.ok) {
        setStatus(result.message, 'danger');
        return;
      }
      refreshLoadPanelUI();
      setStatus(`Renamed ${getDefaultManualSlotLabel(slotId)} to ${result.metadata.slotName}.`, 'success');
    });

    manualDeleteBtn?.addEventListener('click', () => {
      const slotId = manualSaveSlotSelect?.value || 'slot1';
      const meta = getCurrentSlotMetadata(slotId);
      if (!meta) {
        setStatus('Selected manual slot is already empty.', 'warning');
        return;
      }
      if (!window.confirm(`Delete ${meta.slotName}? This cannot be undone.`)) {
        setStatus('Delete cancelled.', 'warning');
        return;
      }
      const result = window.GeoCommandSaveSystem.deleteManualSlot(slotId);
      if (!result.ok) {
        setStatus(result.message, 'danger');
        return;
      }
      refreshLoadPanelUI();
      setStatus(result.message, 'success');
    });

    quickSaveBtn?.addEventListener('click', () => {
      const result = persistSave(window.GeoCommandSaveSystem.LATEST_SLOT, 'Latest Session');
      setStatus(result.ok ? 'Quick save complete.' : result.message, result.ok ? 'success' : 'danger');
    });

    quickLoadBtn?.addEventListener('click', () => {
      const latest = window.GeoCommandSaveSystem.getLatestSnapshot();
      if (!latest.ok) {
        setStatus('No latest save found. Use Quick Save or manual slots first.', true);
        return;
      }
      const result = loadSnapshotIntoRuntime(latest.snapshot, 'latest session', { pauseAfterLoad: false });
      if (!result.ok) setStatus(result.message, true);
    });

    window.addEventListener('beforeunload', () => {
      maybeAutosave('unload');
    });
  }
  function setMenuPreview(key, source = menuPreviewData) {
    const preview = source[key] || source.newSimulation;
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

  function attachMenuHandlers() {
    menuController = window.createMenuController({
      overlays,
      menuButtons: Array.from(document.querySelectorAll('.menu-nav-btn')),
      menuPreviewData,
      setPreview: setMenuPreview,
      onNewSimulation: () => {
        playStep = 1;
        updatePlayFlowUI();
        countryWarning.textContent = '';
        leaderNameInput.value = '';
        scenarioTypeSelect.value = 'modern';
        simulationModeSelect.value = simulationModeSelect.value || 'standard';
        launchSummary.textContent = 'Review your setup before deployment.';
      },
      onContinue: ({ hideOverlays: hide }) => {
        const latest = window.GeoCommandSaveSystem?.getLatestSnapshot?.();
        if (!latest?.ok) {
          setStatus('No saved session found. Start a new simulation or create a save first.', true);
          return;
        }
        const result = loadSnapshotIntoRuntime(latest.snapshot, 'latest session');
        if (!result.ok) {
          setStatus(result.message, true);
          return;
        }
        hide();
      },
      onPlayBack: ({ setOverlay: setMenuOverlay }) => {
        if (playStep === 1) {
          setMenuOverlay('mainMenu');
          return;
        }
        playStep -= 1;
        updatePlayFlowUI();
      },
      onPlayNext: ({ hideOverlays: hide }) => {
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
        leadershipSystem.ensureLeadershipFields(playerCountryState);
        leadershipSystem.renameLeader(playerCountryState.name, leaderName);
        const modeLabel = simulationModeSelect.value === 'sandbox' ? 'Sandbox' : 'Standard';
        const preset = window.applyGeoScenarioPreset({
          presetId: scenarioTypeSelect.value,
          gameState,
          countrySystem,
          diplomacySystem,
          blocSystem,
          chokepointSystem,
          eventSystem,
          simulationMode: simulationModeSelect.value,
          selectedCountryName: gameState.selectedPlayerCountry.properties.name
        });
        playerProfile.textContent = `Leader ${playerCountryState.leaderName} of ${gameState.selectedPlayerCountry.properties.name} (${governmentProfileSystem.getProfileSummary(playerCountryState)} · ${playerCountryState.leaderSummary}) · Mode: ${modeLabel}`;
        refreshAfterLoad();
        setStatus(`Commander ${leaderName}, simulation launched in ${modeLabel} mode with ${preset.name}. Place bases and advance time to complete construction.`);
        persistSave(window.GeoCommandSaveSystem.LATEST_SLOT, 'Latest Session');
        lastAutosaveDay = Math.floor((gameState.currentTimeMs - Date.parse(GAME_START_ISO)) / DAY_MS);
        hide();
      },
      onTutorial: () => setStatus('Tutorial content is planned for a future update. Start with New Simulation.'),
      onExit: () => setStatus('Web build cannot quit directly. Close this browser tab to exit.'),
      onSandboxQuickStart: () => {
        simulationModeSelect.value = 'sandbox';
        document.getElementById('newSimulationBtn').click();
      },
      onOverlayChange: (name) => {
        if (name === 'loadPanel') refreshLoadPanelUI();
      },
      resetPlayFlow: () => {
        playStep = 1;
        updatePlayFlowUI();
      }
    });

    menuController.wireMenuPreview();
    menuController.bindPlayFlow(window.createGeoMenuRefs());
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
    return uiControllers.diplomacy.bind();
  }
  
  function attachNegotiationControls() {
    return uiControllers.negotiation.bind();
  }
  
  function attachPolicyControls() {
    return uiControllers.government.bindPolicyControls();
  }
  
  
  function attachGovernmentProfileControls() {
    return uiControllers.government.bindGovernmentProfileControls();
  }
  
  
  function attachInformationControls() {
    return uiControllers.information.bind();
  }
  
  function attachProxyConflictControls() {
    return uiControllers.proxy.bind();
  }
  
  function attachResistanceControls() {
    return uiControllers.resistance.bind();
  }
  
  
  function attachLocalHotspotControls() {
    return uiControllers.localHotspot.bind();
  }
  
  function attachLeadershipControls() {
    return uiControllers.government.bindLeadershipControls();
  }
  
  function attachFactionControls() {
    return uiControllers.government.bindFactionControls();
  }
  
  function attachStateStructureControls() {
    return uiControllers.stateStructure.bind();
  }
  
  function attachMigrationControls() {
    return uiControllers.migration.bind();
  }
  
  function attachEventControls() {
    return uiControllers.event.bind();
  }
  
  function attachChokepointControls() {
    return uiControllers.chokepoint.bind();
  }
  
  function attachBlocControls() {
    return uiControllers.bloc.bind();
  }
  
  function attachTradeControls() {
    return uiControllers.trade.bind();
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
      maybeAutosave('tick');
      countrySystem.syncOwnership();
      refreshTimeHud();
      refreshEconomyHud();
      refreshCountryHud();
      refreshDiplomacyHud();
      refreshNegotiationHud();
      refreshPolicyHud();
      refreshGovernmentProfileHud();
      refreshDomesticHud();
      refreshStateStructureHud();
      refreshResistanceHud();
      refreshInformationHud();
      refreshProxyConflictHud();
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
    initializeCityState();
    mapRenderer = window.createMapRenderer({
      svg,
      mapWrap,
      tooltip,
      resetViewBtn,
      loadCountries: loadCountriesData,
      onProjectionReady: (nextProjection) => {
        projection = nextProjection;
      },
      getCountryClass: (d) => {
        const selected = selectedCountryFeature && d.id === selectedCountryFeature.id ? 'selected' : '';
        const locked = gameState.selectedPlayerCountry && d.id !== gameState.selectedPlayerCountry.id ? 'locked' : '';
        return `${selected} ${locked}`.trim();
      },
      onCountrySelected: (d, event) => {
        if (!gameState.selectedPlayerCountry) {
          setStatus('Use Play in the main menu to choose your country first.', true);
          return;
        }
        if (d.id !== gameState.selectedPlayerCountry.id) {
          setStatus(`You are locked to ${gameState.selectedPlayerCountry.properties.name}.`, true);
          return;
        }
        selectedCountryFeature = d;
        selectedCountryLabel.textContent = `Inspected country: ${d.properties.name}`;
        selectedCountryLabel.classList.add('is-selected');
        renderCityList(d.properties.name);
        updateCountryStyles();
        placeBaseFromLonLat(getMapLonLatFromEvent(event));
      },
      onMapClick: (event, ctx) => {
        placeBaseFromLonLat(ctx.getLonLatFromEvent(event));
      },
      onMapDragStateChange: (isDragging) => {
        mapWrap.classList.toggle('panning', isDragging);
      }
    });

    const initResult = await mapRenderer.init();
    countries = initResult.countries;

    renderCities();
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

  function placeBaseFromLonLat(lonLat) {
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
    setStatus(`${base.type} base started construction. ETA: ${completeText}.`, 'success');
    refreshEconomyHud();
  }


  async function init() {
    organizePanels();
    attachDrawerControls();
    applySettingsUI();
    attachMenuHandlers();
    attachSaveControls();
    refreshLoadPanelUI();
    attachTimeControls();
    attachUnitControls();
    bindDomainPanels();
    refreshTimeHud();
    refreshEconomyHud();
    refreshCountryHud();
    refreshDomainPanels();
    renderSelectedUnitPanel();
    hudPlayerCountry.textContent = 'Commander: --';
    hudCurrentCountry.textContent = 'Inspecting: --';
    hudSelectionCue.textContent = 'Selection: none';
    setStatus('Command interface online. Choose New Simulation to begin.', 'info');
  
    try {
      await setupMap();
    } catch (err) {
      console.error(err);
      setStatus('Map data failed to load from all sources. Check internet access and refresh.', true);
    }
  
    startSimulationLoop();
  }

  return { init };
};
