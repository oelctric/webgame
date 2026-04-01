class AISystem {
  constructor(gameState, scheduler, systems) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.productionSystem = systems.productionSystem;
    this.movementSystem = systems.movementSystem;
    this.combatSystem = systems.combatSystem;
    this.captureSystem = systems.captureSystem;
    this.economySystem = systems.economySystem;
    this.policySystem = systems.policySystem;
    this.diplomacySystem = systems.diplomacySystem;
    this.resourceSystem = systems.resourceSystem;
    this.countrySystem = systems.countrySystem;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleNext();
  }

  scheduleNext() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + AI_CONFIG.tickMs,
      type: 'AI_TICK',
      payload: {},
      handler: () => this.tick()
    });
  }

  tick() {
    this.gameState.aiCountries.forEach((country) => {
      this.evaluateStrategicState(country);
      this.runCountryTick(country);
    });
    this.scheduleNext();
  }

  ensureAiState(countryName) {
    if (!this.gameState.aiStateByCountry[countryName]) {
      this.gameState.aiStateByCountry[countryName] = {
        posture: 'build_up',
        lastPostureChangeAt: 0,
        lastPolicyChangeAt: 0,
        lastDiplomacyActionAt: 0,
        notes: 'Initial posture'
      };
    }
    return this.gameState.aiStateByCountry[countryName];
  }

  evaluateStrategicState(countryName) {
    const state = this.ensureAiState(countryName);
    const country = this.countrySystem.ensureCountry(countryName);
    const now = this.gameState.currentTimeMs;
    const relations = this.diplomacySystem.getRelationsForCountry(countryName);
    const activeWars = relations.filter((relation) => relation.status === 'war');
    const hostileRelations = relations.filter((relation) => relation.status === 'hostile' || relation.relationScore < -45);
    const pressure = this.diplomacySystem.getEconomicPressureOnCountry(countryName);
    const strongestRival = [...relations].sort((a, b) => a.relationScore - b.relationScore)[0];

    let nextPosture = state.posture;
    if (country.warWeariness > 65 || country.stability < 28) {
      nextPosture = 'seek_peace';
    } else if (country.stability < 45 || country.unrest > 55 || country.economicStress > 62) {
      nextPosture = 'stabilize';
    } else if (country.treasury < 900 || country.oil < 70 || country.manpowerPool < 1200 || pressure.incomingCount > 0) {
      nextPosture = 'defend';
    } else if (hostileRelations.length && country.treasury > 2500 && country.stability > 55) {
      nextPosture = 'pressure_rival';
    } else if (!activeWars.length && country.industrialCapacity > 55 && country.manpowerPool > 3500) {
      nextPosture = 'expand';
    } else {
      nextPosture = 'build_up';
    }

    if (nextPosture !== state.posture && now - state.lastPostureChangeAt >= AI_CONFIG.postureCooldownMs) {
      state.posture = nextPosture;
      state.lastPostureChangeAt = now;
      state.notes = `Shifted to ${nextPosture}`;
      if (this.gameState.selectedCountryForHud === countryName) setStatus(`AI posture changed: ${countryName} -> ${nextPosture}`);
    }

    if (now - state.lastPolicyChangeAt >= AI_CONFIG.policyCooldownMs) {
      const nextPolicy = this.buildPolicyForPosture(state.posture, country);
      const changed = country.policy.militarySpendingLevel !== nextPolicy.militarySpendingLevel
        || country.policy.industryInvestmentLevel !== nextPolicy.industryInvestmentLevel
        || country.policy.internalSecurityLevel !== nextPolicy.internalSecurityLevel;
      if (changed) {
        this.policySystem.setPolicyBundle(countryName, nextPolicy);
        state.lastPolicyChangeAt = now;
      }
    }

    if (now - state.lastDiplomacyActionAt >= AI_CONFIG.diplomacyCooldownMs && strongestRival) {
      this.applyDiplomacyPosture(countryName, strongestRival.counterpart, strongestRival, state.posture, country);
      state.lastDiplomacyActionAt = now;
    }
  }

  buildPolicyForPosture(posture, country) {
    if (posture === 'seek_peace' || posture === 'stabilize') {
      return {
        militarySpendingLevel: country.treasury < 1400 ? 'low' : 'normal',
        industryInvestmentLevel: country.economicStress > 60 ? 'low' : 'normal',
        internalSecurityLevel: 'high'
      };
    }
    if (posture === 'defend') {
      return {
        militarySpendingLevel: country.treasury > 1800 ? 'normal' : 'low',
        industryInvestmentLevel: 'normal',
        internalSecurityLevel: 'normal'
      };
    }
    if (posture === 'pressure_rival' || posture === 'expand') {
      return {
        militarySpendingLevel: 'high',
        industryInvestmentLevel: country.treasury > 2600 ? 'high' : 'normal',
        internalSecurityLevel: 'normal'
      };
    }
    return {
      militarySpendingLevel: 'normal',
      industryInvestmentLevel: 'normal',
      internalSecurityLevel: 'normal'
    };
  }

  applyDiplomacyPosture(countryName, rivalName, relation, posture, country) {
    if (!rivalName) return;
    if (posture === 'seek_peace' && relation.status === 'war') {
      this.diplomacySystem.makePeace(countryName, rivalName, `${countryName} sought de-escalation due to war strain.`);
      return;
    }
    if (posture === 'pressure_rival' && relation.relationScore < -25) {
      if (country.treasury > 1800) this.diplomacySystem.imposeSanctions(countryName, rivalName, relation.relationScore < -55 ? 'heavy' : 'light');
      return;
    }
    if (posture === 'stabilize' && relation.status !== 'war') {
      this.diplomacySystem.liftSanctions(countryName, rivalName);
    }
  }

  runCountryTick(country) {
    const aiState = this.ensureAiState(country);
    const posture = aiState.posture;
    const aiBases = this.gameState.bases.filter((b) => b.ownerCountry === country && b.status === 'active' && b.combatStatus !== 'destroyed');
    const aiUnits = this.gameState.units.filter((u) => u.ownerCountry === country && u.status === 'active');
    const warCountries = new Set(this.diplomacySystem.getRelationsForCountry(country).filter((relation) => relation.status === 'war').map((relation) => relation.counterpart));
    const canGoOffensive = ['expand', 'pressure_rival'].includes(posture) || warCountries.size > 0;
    const targetFilter = (ownerCountry) => ownerCountry !== country && (canGoOffensive || warCountries.has(ownerCountry));
    const enemyCities = this.gameState.cities.filter((c) => targetFilter(c.ownerCountry) && c.status !== 'destroyed');
    const enemyBases = this.gameState.bases.filter((b) => targetFilter(b.ownerCountry) && b.combatStatus !== 'destroyed');
    const enemyUnits = this.gameState.units.filter((u) => targetFilter(u.ownerCountry) && u.status !== 'destroyed');
    const countryState = this.countrySystem.ensureCountry(country);
    const lowOil = countryState.oil < 70;
    const lowManpower = countryState.manpowerPool < 1600;

    aiBases.forEach((base) => {
      if (base.production.currentUnitId || base.production.queue.length) return;
      let options = this.productionSystem.getAllowedUnitsForBase(base).sort((a, b) => (ECONOMY_CONFIG.unitBuildCost[a.key] || 0) - (ECONOMY_CONFIG.unitBuildCost[b.key] || 0));
      if (lowOil) options = options.filter((option) => (this.resourceSystem.getUnitResourceCost(option.key).oil || 0) < 25);
      if (lowManpower || posture === 'stabilize') options = options.filter((option) => (this.resourceSystem.getUnitResourceCost(option.key).manpower || 0) <= 220);
      if (posture === 'defend') options = options.filter((option) => option.domain !== 'air');
      for (const option of options) {
        const result = this.productionSystem.queueUnit(base.id, option.key, country);
        if (result.ok) break;
      }
    });

    aiUnits.forEach((unit) => {
      if (unit.movement || unit.captureTarget || unit.combatStatus === 'attacking' || unit.combatStatus === 'defending') return;
      if ((posture === 'stabilize' || posture === 'seek_peace') && !warCountries.size) return;

      const capturableCity = enemyCities.find((city) => this.distanceKm(unit, city.lonLat) <= CAPTURE_CONFIG.captureRangeKm && unit.domain === 'ground');
      if (capturableCity && canGoOffensive) {
        this.captureSystem.startCapture(unit.id, 'city', capturableCity.id, true);
        return;
      }
      const capturableBase = enemyBases.find((base) => this.distanceKm(unit, base.lonLat) <= CAPTURE_CONFIG.captureRangeKm && unit.domain === 'ground');
      if (capturableBase && canGoOffensive) {
        this.captureSystem.startCapture(unit.id, 'base', capturableBase.id, true);
        return;
      }

      const attackableUnit = enemyUnits.find((target) => this.distanceKm(unit, this.movementSystem.getDisplayLonLat(target)) <= unit.rangeKm);
      if (attackableUnit) {
        this.combatSystem.startAttack(unit.id, 'unit', attackableUnit.id, false, true);
        return;
      }
      const attackableBase = enemyBases.find((target) => this.distanceKm(unit, target.lonLat) <= unit.rangeKm);
      if (attackableBase) {
        this.combatSystem.startAttack(unit.id, 'base', attackableBase.id, false, true);
        return;
      }

      const nearestTarget = this.findNearestTargetLonLat(unit, [...enemyCities.map((c) => c.lonLat), ...enemyBases.map((b) => b.lonLat)]);
      if (nearestTarget && (canGoOffensive || warCountries.size)) {
        this.movementSystem.issueMoveOrder(unit.id, nearestTarget, true);
      }
    });

    if (posture !== 'seek_peace' && posture !== 'stabilize'
      && aiBases.length < AI_CONFIG.baseThreshold
      && this.economySystem.getTreasury(country) >= AI_CONFIG.baseExpansionTreasury
      && countryState.manpowerPool > 1500) {
      const ownedCity = this.gameState.cities.find((city) => city.ownerCountry === country);
      if (ownedCity && this.economySystem.spend(country, ECONOMY_CONFIG.baseBuildCost.ground, 'AI base expansion')) {
        const lonLat = [ownedCity.lonLat[0] + 1.5, ownedCity.lonLat[1] + 1];
        const base = createBase('ground', lonLat, country);
        base.status = 'active';
        base.buildCompleteAt = this.gameState.currentTimeMs;
      }
    }
  }

  distanceKm(unit, lonLat) {
    return d3.geoDistance(this.movementSystem.getDisplayLonLat(unit), lonLat) * 6371;
  }

  findNearestTargetLonLat(unit, targetLonLats) {
    if (!targetLonLats.length) return null;
    let best = targetLonLats[0];
    let bestDistance = this.distanceKm(unit, best);
    for (const target of targetLonLats.slice(1)) {
      const d = this.distanceKm(unit, target);
      if (d < bestDistance) {
        bestDistance = d;
        best = target;
      }
    }
    return best;
  }
}
