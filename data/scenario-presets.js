window.GEO_SCENARIO_PRESETS = [
  {
    id: 'modern',
    name: 'Modern Baseline',
    description: 'Balanced multipolar baseline with moderate relations and open trade lanes.',
    eventSeeds: []
  },
  {
    id: 'high_tension',
    name: 'High Tension Standoff',
    description: 'Rival blocs harden, border friction rises, and chokepoints become contested.',
    eventSeeds: ['border_incident']
  },
  {
    id: 'economic_shock',
    name: 'Economic Shockwave',
    description: 'Global markets are stressed by financial panic, supply pressure, and migration surges.',
    eventSeeds: ['financial_panic', 'oil_supply_shock']
  }
];

window.getGeoScenarioPresetById = function getGeoScenarioPresetById(id) {
  return window.GEO_SCENARIO_PRESETS.find((preset) => preset.id === id) || window.GEO_SCENARIO_PRESETS[0];
};

window.applyGeoScenarioPreset = function applyGeoScenarioPreset({
  presetId,
  gameState,
  countrySystem,
  diplomacySystem,
  blocSystem,
  chokepointSystem,
  eventSystem,
  worldSeedSystem = null,
  simulationMode = 'standard',
  selectedCountryName = null
}) {
  const preset = window.getGeoScenarioPresetById(presetId);
  const isSandbox = simulationMode === 'sandbox';
  const anchorCountry = selectedCountryName || gameState.selectedPlayerCountry?.properties?.name || null;
  const majorPowers = [
    'United States of America',
    'China',
    'Russia',
    'India',
    'Germany',
    'Japan'
  ];
  const participants = Array.from(new Set([anchorCountry, ...majorPowers].filter(Boolean)));

  participants.forEach((name) => countrySystem.ensureCountry(name, name !== anchorCountry));

  const applyCountryDrift = ({ unrest = 0, stress = 0, stability = 0, warWeariness = 0, legitimacy = 0, reputation = 0 }) => {
    participants.forEach((countryName) => {
      const country = countrySystem.ensureCountry(countryName, countryName !== anchorCountry);
      if (!country) return;
      country.unrest = Math.max(0, Math.min(100, country.unrest + unrest));
      country.economicStress = Math.max(0, Math.min(100, country.economicStress + stress));
      country.stability = Math.max(0, Math.min(100, country.stability + stability));
      country.warWeariness = Math.max(0, Math.min(100, country.warWeariness + warWeariness));
      country.legitimacy = Math.max(0, Math.min(100, country.legitimacy + legitimacy));
      country.internationalReputation = Math.max(-100, Math.min(100, country.internationalReputation + reputation));
    });
  };

  const pair = (a, b, score, status = null, tradeAllowed = true, sanctionsLevel = 'none') => {
    const relation = diplomacySystem.ensureRelation(a, b);
    if (!relation) return;
    relation.relationScore = score;
    relation.status = status || diplomacySystem.deriveStatusFromScore(score);
    relation.tradeAllowed = tradeAllowed;
    relation.sanctions = sanctionsLevel !== 'none';
    relation.sanctionsLevel = sanctionsLevel;
    relation.lastChangedAt = gameState.currentTimeMs;
  };

  const maybeSeedEvent = (type, targetCountryId, secondaryCountryId = null) => {
    if (isSandbox || !type || !targetCountryId) return;
    if (type === 'border_incident' && secondaryCountryId) {
      eventSystem.createEvent(type, { targetCountryIds: [targetCountryId, secondaryCountryId] });
      return;
    }
    eventSystem.createEvent(type, { targetCountryId });
  };

  if (preset.id === 'high_tension') {
    applyCountryDrift({ unrest: 8, stress: 6, stability: -5, warWeariness: 10, legitimacy: -4, reputation: -3 });

    pair('United States of America', 'China', -52, 'hostile', false, 'heavy');
    pair('United States of America', 'Russia', -68, 'hostile', false, 'heavy');
    pair('China', 'Japan', -28, 'neutral', true, 'light');
    pair('India', 'China', -44, 'hostile', true, 'light');

    const alignmentBloc = blocSystem.createBloc({ name: 'Strategic Alignment Front', type: 'defense', description: 'Escalatory defense alignment under high tension conditions.' });
    if (alignmentBloc) {
      ['United States of America', 'Japan', 'Germany'].forEach((member) => blocSystem.joinBloc(alignmentBloc.id, member));
    }

    if (gameState.chokepoints.points.length) {
      chokepointSystem.setOpenState('hormuz_strait', 'restricted', 'scenario:high_tension');
      chokepointSystem.setContested('hormuz_strait', true);
      chokepointSystem.setOpenState('malacca_strait', 'restricted', 'scenario:high_tension');
    }

    maybeSeedEvent('border_incident', 'India', 'China');
    gameState.diplomacy.lastSummary = 'Scenario applied: High Tension Standoff hardened relations and raised military strain.';
  } else if (preset.id === 'economic_shock') {
    applyCountryDrift({ unrest: 6, stress: 20, stability: -9, warWeariness: 3, legitimacy: -6, reputation: -1 });

    participants.forEach((countryName) => {
      const country = countrySystem.ensureCountry(countryName, countryName !== anchorCountry);
      if (!country) return;
      country.tradeIncomeBonus = Math.max(-0.35, (country.tradeIncomeBonus || 0) - 0.18);
      country.tradeStressRelief = Math.max(-0.25, (country.tradeStressRelief || 0) - 0.1);
      country.domesticNarrativePressure = Math.max(0, Math.min(100, (country.domesticNarrativePressure || 20) + 12));
    });

    pair('United States of America', 'China', -24, 'neutral', true, 'light');
    pair('Germany', 'Russia', -40, 'hostile', false, 'heavy');

    if (gameState.chokepoints.points.length) {
      chokepointSystem.setOpenState('suez_corridor', 'restricted', 'scenario:economic_shock');
      chokepointSystem.setContested('suez_corridor', true);
    }

    maybeSeedEvent('financial_panic', anchorCountry || 'United States of America');
    maybeSeedEvent('oil_supply_shock', 'Germany');
    maybeSeedEvent('protest_wave', 'India');
    gameState.economy.lastSummary = 'Scenario applied: Economic Shockwave added stress, narrative pressure, and trade friction.';
  } else {
    applyCountryDrift({ unrest: 0, stress: 0, stability: 0, warWeariness: 0, legitimacy: 0, reputation: 0 });
    pair('United States of America', 'Germany', 25, 'friendly', true, 'none');
    pair('United States of America', 'Japan', 20, 'friendly', true, 'none');
    pair('India', 'Japan', 10, 'neutral', true, 'none');
    pair('China', 'Russia', 12, 'neutral', true, 'none');
    pair('United States of America', 'China', -6, 'neutral', true, 'none');
    gameState.diplomacy.lastSummary = 'Scenario applied: Modern Baseline with balanced diplomatic footing.';
  }

  gameState.scenario = {
    id: preset.id,
    name: preset.name,
    mode: simulationMode,
    appliedAt: gameState.currentTimeMs
  };

  if (worldSeedSystem && typeof worldSeedSystem.applyScenarioWorldModifiers === 'function') {
    worldSeedSystem.applyScenarioWorldModifiers({ presetId: preset.id, simulationMode });
  }

  return preset;
};
