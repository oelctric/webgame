class ChokepointSystem {
  constructor(gameState, scheduler, diplomacySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.diplomacySystem = diplomacySystem;
    this.started = false;
  }

  initializeDefaults() {
    if (this.gameState.chokepoints.points.length) return;
    this.gameState.chokepoints.points = CHOKEPOINT_DEFINITIONS.map((cp) => ({
      ...cp,
      contested: false,
      openState: 'open',
      connectedTradeFlowIds: [],
      lastChangedAt: this.gameState.currentTimeMs,
      disruptionSource: null
    }));
  }

  getChokepoint(chokepointId) {
    return this.gameState.chokepoints.points.find((cp) => cp.id === chokepointId) || null;
  }

  setOpenState(chokepointId, openState, reason = 'manual') {
    const chokepoint = this.getChokepoint(chokepointId);
    if (!chokepoint || !CHOKEPOINT_CONFIG.stateEfficiency[openState]) return null;
    chokepoint.openState = openState;
    chokepoint.lastChangedAt = this.gameState.currentTimeMs;
    chokepoint.disruptionSource = reason;
    this.gameState.chokepoints.lastSummary = `${chokepoint.name} set to ${openState.toUpperCase()} (${reason}).`;
    return chokepoint;
  }

  setController(chokepointId, controllingCountryId) {
    const chokepoint = this.getChokepoint(chokepointId);
    if (!chokepoint) return null;
    chokepoint.controllingCountryId = controllingCountryId || null;
    chokepoint.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.chokepoints.lastSummary = `${chokepoint.name} control set to ${controllingCountryId || 'None'}.`;
    return chokepoint;
  }

  setContested(chokepointId, contested = true) {
    const chokepoint = this.getChokepoint(chokepointId);
    if (!chokepoint) return null;
    chokepoint.contested = Boolean(contested);
    chokepoint.lastChangedAt = this.gameState.currentTimeMs;
    this.gameState.chokepoints.lastSummary = `${chokepoint.name} is now ${contested ? 'contested' : 'stable'}.`;
    return chokepoint;
  }

  getRouteEfficiency(flow) {
    if (!flow.requiredChokepoints?.length) return { efficiency: 1, reason: null };
    let efficiency = 1;
    let hardBlockedBy = null;
    flow.requiredChokepoints.forEach((id) => {
      const chokepoint = this.getChokepoint(id);
      if (!chokepoint) return;
      const stateEff = CHOKEPOINT_CONFIG.stateEfficiency[chokepoint.openState] ?? 1;
      efficiency *= stateEff;
      if (chokepoint.contested) efficiency *= CHOKEPOINT_CONFIG.contestedPenalty;
      if (stateEff <= 0.01) hardBlockedBy = chokepoint.name;
    });
    if (hardBlockedBy) return { efficiency: 0, reason: `chokepoint_blocked:${hardBlockedBy}` };
    return { efficiency, reason: efficiency < 0.999 ? 'chokepoint_restriction' : null };
  }

  assignFlowDependencies(flow) {
    const routeRules = [
      { id: 'hormuz_strait', exporters: ['Saudi Arabia', 'Iraq', 'Iran', 'Kuwait', 'United Arab Emirates', 'Qatar', 'Oman'], resources: ['oil'] },
      { id: 'suez_corridor', exporters: ['Saudi Arabia', 'Iraq', 'Kuwait', 'United Arab Emirates', 'Egypt'], importers: ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'], resources: ['oil', 'industry_support'] },
      { id: 'malacca_strait', exporters: ['Saudi Arabia', 'United Arab Emirates', 'India', 'Australia'], importers: ['China', 'Japan', 'South Korea', 'Indonesia'], resources: ['oil', 'industry_support'] },
      { id: 'gibraltar_passage', exporters: ['United States of America', 'Brazil', 'Argentina'], importers: ['France', 'Germany', 'Italy', 'Egypt'], resources: ['oil', 'industry_support'] }
    ];
    const deps = routeRules
      .filter((rule) => (!rule.exporters || rule.exporters.includes(flow.exporterCountryId))
        && (!rule.importers || rule.importers.includes(flow.importerCountryId))
        && (!rule.resources || rule.resources.includes(flow.resourceType)))
      .map((rule) => rule.id);
    flow.requiredChokepoints = deps;
    return deps;
  }

  applyWarPressure() {
    this.gameState.chokepoints.points.forEach((chokepoint) => {
      if (!chokepoint.controllingCountryId) return;
      const relations = this.diplomacySystem.getRelationsForCountry(chokepoint.controllingCountryId);
      const atWar = relations.some((relation) => relation.status === 'war');
      const hostile = relations.some((relation) => relation.status === 'hostile' && relation.relationScore < -60);
      if (atWar && chokepoint.openState === 'open') {
        chokepoint.openState = 'restricted';
        chokepoint.disruptionSource = 'war_pressure';
      } else if (!atWar && !hostile && chokepoint.disruptionSource === 'war_pressure') {
        chokepoint.openState = 'open';
        chokepoint.disruptionSource = 'stabilized';
      }
      chokepoint.contested = atWar || hostile;
    });
  }

  applyEventPressure() {
    this.gameState.chokepoints.points.forEach((chokepoint) => {
      if (chokepoint.disruptionSource?.startsWith('event:')) {
        chokepoint.openState = 'open';
        chokepoint.contested = false;
        chokepoint.disruptionSource = 'event_resolved';
      }
    });
    const disruptions = this.gameState.events.active.filter((event) => event.active && event.type === 'chokepoint_disruption');
    disruptions.forEach((event) => {
      const chokepoint = this.getChokepoint(event.targetChokepointId);
      if (!chokepoint) return;
      chokepoint.openState = event.effects.chokepointOpenState || 'restricted';
      chokepoint.contested = true;
      chokepoint.disruptionSource = `event:${event.title}`;
      chokepoint.lastChangedAt = this.gameState.currentTimeMs;
    });
  }

  processTick() {
    this.applyWarPressure();
    this.applyEventPressure();
    refreshChokepointHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + CHOKEPOINT_CONFIG.tickMs,
      type: 'CHOKEPOINT_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.initializeDefaults();
    this.scheduleTick();
  }
}
