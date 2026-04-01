class BlocSystem {
  constructor(gameState, scheduler, diplomacySystem, countrySystem) {
    this.gameState = gameState;
    this.scheduler = scheduler;
    this.diplomacySystem = diplomacySystem;
    this.countrySystem = countrySystem;
    this.started = false;
  }

  createBloc({ name, type = 'mixed', description = '' }) {
    if (!name || !['defense', 'trade', 'mixed'].includes(type)) return null;
    const bloc = {
      id: `bloc_${this.gameState.blocs.nextBlocId++}`,
      name,
      type,
      memberCountryIds: [],
      foundedAt: this.gameState.currentTimeMs,
      active: true,
      description,
      sharedModifiers: {
        diplomacyBias: type === 'trade' ? 2 : 3,
        tradeBias: type === 'defense' ? 1.12 : 1.2,
        sanctionTolerance: type === 'defense' ? 'very_low' : 'low'
      }
    };
    this.gameState.blocs.items.push(bloc);
    this.gameState.blocs.lastSummary = `Bloc created: ${bloc.name} (${bloc.type}).`;
    return bloc;
  }

  getBloc(blocId) {
    return this.gameState.blocs.items.find((bloc) => bloc.id === blocId && bloc.active) || null;
  }

  getCountryBlocs(countryName) {
    if (!countryName) return [];
    return this.gameState.blocs.items.filter((bloc) => bloc.active && bloc.memberCountryIds.includes(countryName));
  }

  areInSameBloc(countryA, countryB) {
    if (!countryA || !countryB || countryA === countryB) return false;
    const blocA = this.getCountryBlocs(countryA);
    return blocA.some((bloc) => bloc.memberCountryIds.includes(countryB));
  }

  joinBloc(blocId, countryName) {
    const bloc = this.getBloc(blocId);
    if (!bloc || !countryName) return null;
    this.countrySystem.ensureCountry(countryName);
    if (!bloc.memberCountryIds.includes(countryName)) {
      bloc.memberCountryIds.push(countryName);
    }
    this.gameState.blocs.lastSummary = `${countryName} joined ${bloc.name}.`;
    return bloc;
  }

  leaveBloc(blocId, countryName) {
    const bloc = this.getBloc(blocId);
    if (!bloc || !countryName) return null;
    bloc.memberCountryIds = bloc.memberCountryIds.filter((member) => member !== countryName);
    this.gameState.blocs.lastSummary = `${countryName} left ${bloc.name}.`;
    return bloc;
  }

  dissolveBloc(blocId) {
    const bloc = this.getBloc(blocId);
    if (!bloc) return null;
    bloc.active = false;
    bloc.memberCountryIds = [];
    this.gameState.blocs.lastSummary = `Bloc dissolved: ${bloc.name}.`;
    return bloc;
  }

  getTradePreferenceMultiplier(exporter, importer) {
    if (this.areInSameBloc(exporter, importer)) return BLOC_CONFIG.tradePreferenceBonus;
    return 1;
  }

  handleAggression(attackerCountry, targetCountry) {
    this.gameState.blocs.items
      .filter((bloc) => bloc.active && bloc.memberCountryIds.includes(targetCountry))
      .forEach((bloc) => {
        bloc.memberCountryIds
          .filter((member) => member !== targetCountry && member !== attackerCountry)
          .forEach((member) => {
            this.diplomacySystem.adjustRelationScore(member, attackerCountry, BLOC_CONFIG.aggressionResponseDelta, `${bloc.name} reacted to aggression on ${targetCountry}.`, true);
          });
      });
  }

  applyDiplomaticBias() {
    const countries = Object.keys(this.gameState.countries);
    this.gameState.blocs.items.filter((bloc) => bloc.active).forEach((bloc) => {
      bloc.memberCountryIds.forEach((memberA) => {
        bloc.memberCountryIds.forEach((memberB) => {
          if (memberA >= memberB) return;
          this.diplomacySystem.adjustRelationScore(memberA, memberB, BLOC_CONFIG.diplomacyInBlocDelta, `${bloc.name} alignment drift`);
        });
        countries
          .filter((other) => other !== memberA && !bloc.memberCountryIds.includes(other))
          .slice(0, 3)
          .forEach((other) => {
            this.diplomacySystem.adjustRelationScore(memberA, other, BLOC_CONFIG.diplomacyOutBlocDelta, `${bloc.name} external mistrust`);
          });
      });
    });
  }

  processTick() {
    this.applyDiplomaticBias();
    refreshBlocHud();
    this.scheduleTick();
  }

  scheduleTick() {
    this.scheduler.schedule({
      executeAt: this.gameState.currentTimeMs + BLOC_CONFIG.tickMs,
      type: 'BLOC_TICK',
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
