class TradeSystem {
  constructor(gameState, scheduler, countrySystem, diplomacySystem, chokepointSystem, blocSystem, governmentProfileSystem = null) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.countrySystem = countrySystem;
    this.diplomacySystem = diplomacySystem;
    this.chokepointSystem = chokepointSystem;
    this.blocSystem = blocSystem;
    this.governmentProfileSystem = governmentProfileSystem;
    this.started = false;
    this.nextFlowId = 1;
  }

  evaluateCountryBalances(countryName) {
    const country = this.countrySystem.ensureCountry(countryName);
    const units = country.controlledUnitIds.length;
    const bases = country.controlledBaseIds.length;
    const oilNeed = 10 + units * 1.6 + bases * 2.2 + (country.policy?.militarySpendingLevel === 'high' ? 12 : 0);
    const oilSupply = country.oilPerTick || 0;
    const industryNeed = 8 + bases * 3 + units * 1.2;
    const industrySupply = Math.max(0, (country.industrialCapacity || 0) * 0.22);
    country.tradeBalance = {
      oil: { supply: oilSupply, need: oilNeed, surplus: Math.max(0, oilSupply - oilNeed), deficit: Math.max(0, oilNeed - oilSupply) },
      industry_support: { supply: industrySupply, need: industryNeed, surplus: Math.max(0, industrySupply - industryNeed), deficit: Math.max(0, industryNeed - industrySupply) }
    };
    return country.tradeBalance;
  }

  canTrade(exporter, importer) {
    const relation = this.diplomacySystem.getRelation(exporter, importer);
    if (!relation) return { ok: false, reason: 'no_relation' };
    if (relation.status === 'war') return { ok: false, reason: 'war' };
    const expToImp = this.diplomacySystem.getDirectionalPressure(exporter, importer);
    const impToExp = this.diplomacySystem.getDirectionalPressure(importer, exporter);
    const temporaryRestore = negotiationSystem?.hasTemporaryTradeRestoration(exporter, importer);
    if (!temporaryRestore && (expToImp.tradeAllowed === false || impToExp.tradeAllowed === false)) {
      return { ok: false, reason: 'trade_blocked' };
    }
    if (this.blocSystem.areInSameBloc(exporter, importer)) {
      if (expToImp.sanctionsLevel === 'heavy' || impToExp.sanctionsLevel === 'heavy') return { ok: false, reason: 'heavy_sanctions' };
      return { ok: true, blocPreferred: true };
    }
    if (expToImp.sanctionsLevel === 'heavy' || impToExp.sanctionsLevel === 'heavy') return { ok: false, reason: 'heavy_sanctions' };
    if (relation.status === 'hostile' && relation.relationScore < -55) return { ok: false, reason: 'hostile_relations' };
    return { ok: true };
  }

  upsertFlow({ exporterCountryId, importerCountryId, resourceType, flowAmount, tradeValue = 0, active = true, blockedReason = null, manual = false }) {
    const existing = this.gameState.trade.flows.find((flow) => flow.exporterCountryId === exporterCountryId
      && flow.importerCountryId === importerCountryId
      && flow.resourceType === resourceType
      && flow.manual === manual);
    if (existing) {
      existing.flowAmount = flowAmount;
      existing.tradeValue = tradeValue;
      existing.active = active;
      existing.blockedReason = blockedReason;
      if (!existing.requiredChokepoints) existing.requiredChokepoints = [];
      existing.updatedAt = this.gameState.currentTimeMs;
      this.chokepointSystem.assignFlowDependencies(existing);
      return existing;
    }
    const flow = {
      id: this.nextFlowId++,
      exporterCountryId,
      importerCountryId,
      resourceType,
      flowAmount,
      active,
      startedAt: this.gameState.currentTimeMs,
      updatedAt: this.gameState.currentTimeMs,
      blockedReason,
      tradeValue,
      manual,
      requiredChokepoints: [],
      routeEfficiency: 1
    };
    this.chokepointSystem.assignFlowDependencies(flow);
    this.gameState.trade.flows.push(flow);
    return flow;
  }

  buildAutoFlows() {
    if (!this.gameState.trade.autoEnabled) return;
    const countryNames = Object.keys(this.gameState.countries);
    countryNames.forEach((name) => this.evaluateCountryBalances(name));
    TRADE_CONFIG.resources.forEach((resourceType) => {
      const importers = countryNames
        .map((name) => ({ name, deficit: this.gameState.countries[name].tradeBalance[resourceType].deficit }))
        .filter((entry) => entry.deficit > 0.1)
        .sort((a, b) => b.deficit - a.deficit);
      const exporters = countryNames
        .map((name) => ({ name, surplus: this.gameState.countries[name].tradeBalance[resourceType].surplus }))
        .filter((entry) => entry.surplus > 0.1)
        .sort((a, b) => b.surplus - a.surplus);

      importers.forEach((importer) => {
        let remaining = importer.deficit;
        for (const exporter of exporters) {
          if (remaining <= 0) break;
          if (exporter.name === importer.name || exporter.surplus <= 0) continue;
          const viability = this.canTrade(exporter.name, importer.name);
          if (!viability.ok) {
            this.upsertFlow({
              exporterCountryId: exporter.name,
              importerCountryId: importer.name,
              resourceType,
              flowAmount: 0,
              tradeValue: 0,
              active: false,
              blockedReason: viability.reason
            });
            continue;
          }
          const blocTradeBoost = this.blocSystem.getTradePreferenceMultiplier(exporter.name, importer.name);
          const flowAmount = Math.min(remaining, exporter.surplus * blocTradeBoost);
          if (flowAmount <= 0) continue;
          exporter.surplus -= flowAmount;
          remaining -= flowAmount;
          this.upsertFlow({
            exporterCountryId: exporter.name,
            importerCountryId: importer.name,
            resourceType,
            flowAmount,
            tradeValue: flowAmount * 2,
            active: true
          });
        }
      });
    });
  }

  applyFlows() {
    Object.values(this.gameState.countries).forEach((country) => {
      country.tradeIncomeBonus = 0;
      country.tradeStressRelief = 0;
      country.tradeIndustrySupportBonus = 0;
    });

    this.gameState.trade.flows.forEach((flow) => {
      if (!flow.active || flow.flowAmount <= 0) return;
      const exporter = this.countrySystem.ensureCountry(flow.exporterCountryId);
      const importer = this.countrySystem.ensureCountry(flow.importerCountryId);
      if (!exporter || !importer) return;
      const route = this.chokepointSystem.getRouteEfficiency(flow);
      const exporterEco = this.governmentProfileSystem ? this.governmentProfileSystem.getEconomicModifiers(exporter) : { tradeIncomeMult: 1 };
      const importerEco = this.governmentProfileSystem ? this.governmentProfileSystem.getEconomicModifiers(importer) : { tradeIncomeMult: 1, tradeStressReliefMult: 1 };
      flow.routeEfficiency = route.efficiency;
      const blocMultiplier = this.blocSystem.getTradePreferenceMultiplier(flow.exporterCountryId, flow.importerCountryId);
      if (route.reason?.startsWith('chokepoint_blocked')) {
        flow.blockedReason = route.reason;
        return;
      }
      const effectiveFlow = flow.flowAmount * Math.max(0, route.efficiency) * blocMultiplier;
      if (effectiveFlow <= 0.05) return;
      flow.blockedReason = route.reason;
      if (flow.resourceType === 'oil') {
        const deliverable = Math.min(effectiveFlow, exporter.oil);
        exporter.oil -= deliverable;
        importer.oil += deliverable;
        importer.tradeStressRelief += deliverable * 0.02 * (importerEco.tradeStressReliefMult || 1);
      } else if (flow.resourceType === 'industry_support') {
        importer.tradeIndustrySupportBonus += effectiveFlow * 0.12;
        importer.tradeStressRelief += effectiveFlow * 0.015 * (importerEco.tradeStressReliefMult || 1);
      }
      const effectiveTradeValue = flow.tradeValue * Math.max(0, route.efficiency) * blocMultiplier;
      exporter.tradeIncomeBonus += effectiveTradeValue * (exporterEco.tradeIncomeMult || 1);
      importer.tradeIncomeBonus += effectiveTradeValue * 0.35 * (importerEco.tradeIncomeMult || 1);
    });
  }

  createManualFlow(exporterCountryId, importerCountryId, resourceType, flowAmount) {
    const viability = this.canTrade(exporterCountryId, importerCountryId);
    if (!viability.ok) return { ok: false, message: `Trade blocked: ${viability.reason}` };
    const flow = this.upsertFlow({
      exporterCountryId,
      importerCountryId,
      resourceType,
      flowAmount: Math.max(0, Number(flowAmount) || 0),
      tradeValue: Math.max(0, Number(flowAmount) || 0) * 2,
      active: true,
      blockedReason: null,
      manual: true
    });
    return { ok: true, flow };
  }

  processTick() {
    this.buildAutoFlows();
    this.applyFlows();
    this.gameState.trade.lastTickAt = this.gameState.currentTimeMs;
    refreshTradeHud();
    refreshCountryHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + TRADE_CONFIG.tickMs,
      type: 'TRADE_TICK',
      payload: {},
      handler: () => this.processTick()
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTick();
  }
}
