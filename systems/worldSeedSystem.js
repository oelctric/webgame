window.WorldSeedSystem = class WorldSeedSystem {
  constructor(gameState) {
    this.gameState = gameState;
  }

  ensureWorldContainers() {
    if (!this.gameState.world) {
      this.gameState.world = {
        regions: [],
        adminBoundaries: [],
        infrastructure: [],
        militarySites: [],
        strategicRoutes: [],
        indexById: {},
        seededAt: null,
        seedVersion: 'v1',
        summary: {}
      };
    }
  }

  seedBaseWorld() {
    this.ensureWorldContainers();
    const world = this.gameState.world;
    if (world.seededAt) return;

    world.regions = (window.GEO_ADMIN1_REGIONS || []).map((region) => ({ ...region }));
    world.adminBoundaries = (window.GEO_ADMIN1_BOUNDARY_RECORDS || []).map((boundary) => ({ ...boundary }));
    world.infrastructure = (window.GEO_INFRASTRUCTURE_SEEDS || []).map((node) => ({ ...node, lonLat: [node.lon, node.lat], status: 'active' }));
    world.militarySites = (window.GEO_MILITARY_SITES || []).map((site) => ({
      ...site,
      lonLat: [site.lon, site.lat],
      status: 'active',
      forcePosture: 'baseline'
    }));

    const cityRecords = (window.GEO_WORLD_CITIES || []).map((city, idx) => ({
      id: idx + 1,
      sourceId: city.id,
      name: city.name,
      ownerCountry: city.country,
      countryId: city.countryId || null,
      regionId: city.regionId || null,
      lonLat: [city.lon, city.lat],
      isCapital: Boolean(city.isCapital),
      population: city.population || null,
      populationTier: city.populationTier || 'regional',
      roleTags: Array.isArray(city.roleTags) ? city.roleTags.slice() : [],
      metadata: city.metadata || null,
      controlStatus: 'normal',
      captureState: null,
      status: 'active'
    }));
    this.gameState.cities = cityRecords;

    world.strategicRoutes = (window.GEO_STRATEGIC_ROUTES || []).map((route) => ({
      ...route,
      status: 'active'
    }));

    world.indexById = this.buildNodeIndex({
      cities: cityRecords,
      infrastructure: world.infrastructure,
      militarySites: world.militarySites
    });

    this.seedMilitaryAsOperationalBases();

    world.seededAt = this.gameState.currentTimeMs;
    world.summary = {
      regions: world.regions.length,
      cities: cityRecords.length,
      infrastructure: world.infrastructure.length,
      militarySites: world.militarySites.length,
      strategicRoutes: world.strategicRoutes.length
    };
  }

  buildNodeIndex({ cities, infrastructure, militarySites }) {
    const index = {};
    cities.forEach((city) => { index[city.sourceId] = city; });
    infrastructure.forEach((node) => { index[node.id] = node; });
    militarySites.forEach((site) => { index[site.id] = site; });
    return index;
  }

  seedMilitaryAsOperationalBases() {
    const activeMilitaryBases = this.gameState.bases.filter((base) => base.seedSource === 'military_site');
    if (activeMilitaryBases.length) return;

    const now = this.gameState.currentTimeMs;
    const mapSiteTypeToBase = {
      air_base: 'air',
      naval_base: 'naval',
      army_base: 'ground',
      missile_air_defense_site: 'antiAir',
      logistics_support_installation: 'ground'
    };

    const selectedSites = this.gameState.world.militarySites.filter((site) => ['high', 'medium'].includes(site.confidenceLevel)).slice(0, 10);
    selectedSites.forEach((site) => {
      const baseType = mapSiteTypeToBase[site.siteType] || 'ground';
      const base = {
        id: this.gameState.nextBaseId++,
        ownerCountry: site.country,
        type: baseType,
        lonLat: [site.lon, site.lat],
        status: 'active',
        combatStatus: 'idle',
        controlStatus: 'normal',
        captureState: null,
        createdAt: now,
        buildStartedAt: now,
        buildCompleteAt: now,
        seedSource: 'military_site',
        militarySiteId: site.id,
        metadata: site.metadata || null,
        health: 320,
        maxHealth: 320,
        defense: 14,
        production: { currentUnitId: null, currentCompleteAt: null, queue: [] }
      };
      this.gameState.bases.push(base);
    });
  }

  applyScenarioWorldModifiers({ presetId }) {
    this.ensureWorldContainers();
    if (!this.gameState.world?.militarySites?.length) return;

    const setPostureByCountry = (country, posture) => {
      this.gameState.world.militarySites.forEach((site) => {
        if (site.country === country) site.forcePosture = posture;
      });
    };

    if (presetId === 'high_tension') {
      ['United States of America', 'China', 'Russia', 'India'].forEach((country) => setPostureByCountry(country, 'heightened'));
      this.gameState.world.infrastructure.forEach((node) => {
        if (node.type === 'port' || node.type === 'airport') {
          node.disruptionRisk = 0.2;
        }
      });
    } else if (presetId === 'economic_shock') {
      this.gameState.world.infrastructure.forEach((node) => {
        if (['port', 'refinery', 'energy_facility'].includes(node.type)) {
          node.disruptionRisk = 0.35;
          node.throughputModifier = 0.84;
        }
      });
      this.gameState.world.strategicRoutes.forEach((route) => {
        if (route.type === 'energy_corridor' || route.type === 'port_access_route') {
          route.congestion = 'high';
        }
      });
    } else {
      this.gameState.world.militarySites.forEach((site) => {
        site.forcePosture = 'baseline';
      });
      this.gameState.world.infrastructure.forEach((node) => {
        node.disruptionRisk = 0.05;
        node.throughputModifier = 1;
      });
      this.gameState.world.strategicRoutes.forEach((route) => {
        route.congestion = 'normal';
      });
    }
  }

  resolveRoutePath(route) {
    const fromNode = this.gameState.world.indexById[route.fromNodeId];
    const toNode = this.gameState.world.indexById[route.toNodeId];
    if (!fromNode || !toNode) return null;
    const from = fromNode.lonLat || [fromNode.lon, fromNode.lat];
    const to = toNode.lonLat || [toNode.lon, toNode.lat];
    if (!from || !to) return null;
    return [from, to];
  }
};
