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
  infantry: { label: 'Infantry', domain: 'ground', durationMs: 2 * DAY_MS, maxHealth: 100, attack: 14, defense: 6, rangeKm: 260, attackCooldownMs: 8 * 60 * 60 * 1000 },
  armor: { label: 'Armor', domain: 'ground', durationMs: 5 * DAY_MS, maxHealth: 150, attack: 24, defense: 10, rangeKm: 340, attackCooldownMs: 6 * 60 * 60 * 1000 },
  fighter: { label: 'Fighter', domain: 'air', durationMs: 4 * DAY_MS, maxHealth: 90, attack: 30, defense: 7, rangeKm: 1200, attackCooldownMs: 3 * 60 * 60 * 1000 },
  bomber: { label: 'Bomber', domain: 'air', durationMs: 6 * DAY_MS, maxHealth: 120, attack: 36, defense: 8, rangeKm: 1400, attackCooldownMs: 4 * 60 * 60 * 1000 },
  patrolBoat: { label: 'Patrol Boat', domain: 'naval', durationMs: 5 * DAY_MS, maxHealth: 130, attack: 20, defense: 9, rangeKm: 500, attackCooldownMs: 6 * 60 * 60 * 1000 },
  destroyer: { label: 'Destroyer', domain: 'naval', durationMs: 10 * DAY_MS, maxHealth: 220, attack: 32, defense: 14, rangeKm: 620, attackCooldownMs: 5 * 60 * 60 * 1000 }
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

const CAPTURE_CONFIG = {
  cityDurationMs: 2 * DAY_MS,
  baseDurationMs: 3 * DAY_MS,
  captureRangeKm: 320
};

const ECONOMY_CONFIG = {
  tickMs: DAY_MS,
  cityIncomePerDay: 100,
  baseUpkeepPerDay: { ground: 20, air: 35, naval: 50, antiAir: 15 },
  unitUpkeepPerDay: { infantry: 5, armor: 12, fighter: 15, bomber: 20, patrolBoat: 18, destroyer: 30 },
  baseBuildCost: { ground: 500, air: 900, naval: 1200, antiAir: 350 },
  unitBuildCost: { infantry: 120, armor: 280, fighter: 420, bomber: 560, patrolBoat: 450, destroyer: 900 },
  defaultTreasury: 4000
};

const AI_CONFIG = {
  tickMs: 12 * 60 * 60 * 1000,
  strategicTickMs: 2 * DAY_MS,
  baseThreshold: 2,
  baseExpansionTreasury: 2500,
  postureCooldownMs: 2 * DAY_MS,
  strategicGoalMinDurationMs: 4 * DAY_MS,
  strategicGoalShiftMargin: 18,
  policyCooldownMs: 3 * DAY_MS,
  diplomacyCooldownMs: 2 * DAY_MS,
  strategicActionCooldownMs: 2 * DAY_MS,
  strategicAnnouncementCooldownMs: 2 * DAY_MS
};

const COUNTRY_CONFIG = {
  tickMs: DAY_MS,
  basePopulation: 1_000_000,
  cityPopulation: 500_000,
  baseIndustry: 5,
  cityIndustry: 8,
  baseManpower: 1000,
  cityManpower: 2000
};

const DIPLOMACY_CONFIG = {
  tickMs: 7 * DAY_MS,
  minScore: -100,
  maxScore: 100,
  friendlyThreshold: 35,
  hostileThreshold: -35,
  normalizationStep: 1,
  actionImpacts: {
    attackOrder: -4,
    attackDestroyed: -6,
    captureAsset: -12
  }
};

const POLICY_CONFIG = {
  tickMs: DAY_MS,
  levels: ['low', 'normal', 'high'],
  dailyCosts: {
    militarySpendingLevel: { low: 5, normal: 20, high: 45 },
    industryInvestmentLevel: { low: 8, normal: 25, high: 60 },
    internalSecurityLevel: { low: 4, normal: 18, high: 42 }
  },
  dailyEffects: {
    militarySpendingLevel: {
      low: { manpower: -20, stability: 0.08, readiness: -0.4 },
      normal: { manpower: 0, stability: 0, readiness: 0.2 },
      high: { manpower: 35, stability: -0.08, readiness: 0.8 }
    },
    industryInvestmentLevel: {
      low: { industrialCapacity: 0.05, treasuryBonus: 5 },
      normal: { industrialCapacity: 0.16, treasuryBonus: 0 },
      high: { industrialCapacity: 0.32, treasuryBonus: -6 }
    },
    internalSecurityLevel: {
      low: { stability: -0.12, readiness: -0.1 },
      normal: { stability: 0.05, readiness: 0.05 },
      high: { stability: 0.22, readiness: 0.12 }
    }
  }
};

const DOMESTIC_CONFIG = {
  tickMs: DAY_MS,
  clampMin: 0,
  clampMax: 100,
  unrestSecurityDrift: { low: 0.12, normal: -0.18, high: -0.45 },
  stabilitySecurityBonus: { low: -0.08, normal: 0.04, high: 0.12 }
};

const POLITICAL_CONFIG = {
  tickMs: DAY_MS,
  clampMin: 0,
  clampMax: 100,
  alertCooldownMs: 2 * DAY_MS
};


const INFORMATION_CONFIG = {
  tickMs: DAY_MS,
  pressureMin: 0,
  pressureMax: 100,
  reputationMin: -100,
  reputationMax: 100,
  controlMin: 0,
  controlMax: 100,
  severePressureThreshold: 70,
  alertCooldownMs: 2 * DAY_MS
};

const RESOURCE_CONFIG = {
  tickMs: DAY_MS,
  defaultOil: 220,
  defaultMaxOil: 1200,
  defaultManpowerPool: 8000,
  manpowerPoolMax: 150000,
  oilShortageThreshold: 40,
  productionCosts: {
    infantry: { manpower: 140, oil: 0 },
    armor: { manpower: 260, oil: 16 },
    fighter: { manpower: 180, oil: 36 },
    bomber: { manpower: 220, oil: 44 },
    patrolBoat: { manpower: 200, oil: 42 },
    destroyer: { manpower: 320, oil: 68 }
  },
  operationsOilCost: {
    move: { air: 8, naval: 6 },
    combatTick: { air: 5, naval: 4 }
  }
};

const EVENT_CONFIG = {
  tickMs: DAY_MS,
  randomChancePerTick: 0.08,
  maxRecentLog: 14,
  defaultSeverity: 'medium',
  typeDurations: {
    oil_supply_shock: 10 * DAY_MS,
    industrial_strike: 8 * DAY_MS,
    financial_panic: 9 * DAY_MS,
    protest_wave: 7 * DAY_MS,
    border_incident: 5 * DAY_MS,
    chokepoint_disruption: 6 * DAY_MS
  }
};

const TRADE_CONFIG = {
  tickMs: DAY_MS,
  autoGenerationEnabled: true,
  resources: ['oil', 'industry_support']
};

const NEGOTIATION_CONFIG = {
  ceasefireDefaultDays: 30,
  temporaryTradeDefaultDays: 60,
  tickMs: DAY_MS
};

const CHOKEPOINT_CONFIG = {
  tickMs: DAY_MS,
  stateEfficiency: {
    open: 1,
    restricted: 0.55,
    blocked: 0
  },
  contestedPenalty: 0.8
};

const CHOKEPOINT_DEFINITIONS = [
  {
    id: 'suez_corridor',
    name: 'Suez Corridor',
    position: [32.3, 30.0],
    region: 'Mediterranean-Red Sea',
    controllingCountryId: 'Egypt',
    strategicValue: 92
  },
  {
    id: 'malacca_strait',
    name: 'Malacca Strait',
    position: [101.0, 2.5],
    region: 'Indian-Pacific',
    controllingCountryId: 'Singapore',
    strategicValue: 95
  },
  {
    id: 'hormuz_strait',
    name: 'Strait of Hormuz',
    position: [56.3, 26.5],
    region: 'Gulf Gateway',
    controllingCountryId: 'Oman',
    strategicValue: 90
  },
  {
    id: 'gibraltar_passage',
    name: 'Gibraltar Passage',
    position: [-5.4, 35.9],
    region: 'Atlantic-Mediterranean',
    controllingCountryId: 'Spain',
    strategicValue: 78
  }
];

const BLOC_CONFIG = {
  tickMs: DAY_MS,
  diplomacyInBlocDelta: 1.5,
  diplomacyOutBlocDelta: -0.6,
  tradePreferenceBonus: 1.25,
  sanctionDiscourage: true,
  aggressionResponseDelta: -8
};

const MIGRATION_CONFIG = {
  tickMs: DAY_MS,
  minPressureToFlow: 8,
  maxDestinationsPerType: 2,
  manualFlowDurationMs: 14 * DAY_MS,
  flowFadeRate: 0.78,
  flowEasingThreshold: 5,
  humanitarianDecayPerTick: 0.9,
  statusCooldownMs: 2 * DAY_MS
};
