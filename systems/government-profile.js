class GovernmentProfileSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.profileOptions = {
      regimeType: ['democracy', 'hybrid', 'authoritarian'],
      economicOrientation: ['market', 'mixed', 'state_led'],
      foreignPolicyStyle: ['cooperative', 'pragmatic', 'aggressive']
    };
  }

  hashName(name) {
    const seed = String(name || 'country');
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  getDefaultProfile(countryName) {
    const hash = this.hashName(countryName);
    return {
      regimeType: this.profileOptions.regimeType[hash % this.profileOptions.regimeType.length],
      economicOrientation: this.profileOptions.economicOrientation[Math.floor(hash / 3) % this.profileOptions.economicOrientation.length],
      foreignPolicyStyle: this.profileOptions.foreignPolicyStyle[Math.floor(hash / 7) % this.profileOptions.foreignPolicyStyle.length]
    };
  }

  ensureCountryProfile(country) {
    if (!country) return null;
    const defaults = this.getDefaultProfile(country.name);
    country.regimeType = this.profileOptions.regimeType.includes(country.regimeType) ? country.regimeType : defaults.regimeType;
    country.economicOrientation = this.profileOptions.economicOrientation.includes(country.economicOrientation)
      ? country.economicOrientation
      : defaults.economicOrientation;
    country.foreignPolicyStyle = this.profileOptions.foreignPolicyStyle.includes(country.foreignPolicyStyle)
      ? country.foreignPolicyStyle
      : defaults.foreignPolicyStyle;
    return country;
  }

  getProfile(country) {
    if (!country) return this.getDefaultProfile('country');
    this.ensureCountryProfile(country);
    return {
      regimeType: country.regimeType,
      economicOrientation: country.economicOrientation,
      foreignPolicyStyle: country.foreignPolicyStyle
    };
  }

  getDomesticModifiers(country) {
    const profile = this.getProfile(country);
    const byRegime = {
      democracy: {
        warWearinessDriftMult: 1.25,
        unrestSensitivity: 1.1,
        securitySuppressionMult: 0.85,
        repressionSupportPenaltyMult: 1.35,
        legitimacyRecoveryMult: 1.1,
        legitimacyCrisisThreshold: 28,
        legitimacyCollapseMult: 0.9,
        migrationShockMult: 1.12
      },
      hybrid: {
        warWearinessDriftMult: 1,
        unrestSensitivity: 1,
        securitySuppressionMult: 1,
        repressionSupportPenaltyMult: 1,
        legitimacyRecoveryMult: 1,
        legitimacyCrisisThreshold: 24,
        legitimacyCollapseMult: 1.05,
        migrationShockMult: 1
      },
      authoritarian: {
        warWearinessDriftMult: 0.72,
        unrestSensitivity: 0.9,
        securitySuppressionMult: 1.35,
        repressionSupportPenaltyMult: 0.75,
        legitimacyRecoveryMult: 0.82,
        legitimacyCrisisThreshold: 22,
        legitimacyCollapseMult: 1.45,
        migrationShockMult: 0.9
      }
    };
    return byRegime[profile.regimeType] || byRegime.hybrid;
  }

  getEconomicModifiers(country) {
    const profile = this.getProfile(country);
    const byOrientation = {
      market: {
        tradeIncomeMult: 1.22,
        tradeStressReliefMult: 1.12,
        industryGrowthMult: 1.16,
        sanctionsStressMult: 1.22,
        sanctionsIndustryMult: 1.12,
        sanctionsIncomeMult: 1.1,
        sanctionsOilPenaltyMult: 1.1
      },
      mixed: {
        tradeIncomeMult: 1,
        tradeStressReliefMult: 1,
        industryGrowthMult: 1,
        sanctionsStressMult: 1,
        sanctionsIndustryMult: 1,
        sanctionsIncomeMult: 1,
        sanctionsOilPenaltyMult: 1
      },
      state_led: {
        tradeIncomeMult: 0.82,
        tradeStressReliefMult: 0.86,
        industryGrowthMult: 0.9,
        sanctionsStressMult: 0.82,
        sanctionsIndustryMult: 0.9,
        sanctionsIncomeMult: 0.9,
        sanctionsOilPenaltyMult: 0.86
      }
    };
    return byOrientation[profile.economicOrientation] || byOrientation.mixed;
  }

  getForeignPolicyBias(country) {
    const profile = this.getProfile(country);
    const byStyle = {
      cooperative: {
        escalationBias: -1,
        deescalationBias: 1.35,
        sanctionsBias: 0.72,
        blocAffinity: 1.18,
        tradePreservationBias: 1.24,
        hostilityPersistence: 0.85
      },
      pragmatic: {
        escalationBias: 0,
        deescalationBias: 1,
        sanctionsBias: 1,
        blocAffinity: 1,
        tradePreservationBias: 1,
        hostilityPersistence: 1
      },
      aggressive: {
        escalationBias: 1,
        deescalationBias: 0.68,
        sanctionsBias: 1.32,
        blocAffinity: 0.9,
        tradePreservationBias: 0.78,
        hostilityPersistence: 1.24
      }
    };
    return byStyle[profile.foreignPolicyStyle] || byStyle.pragmatic;
  }

  getPolicyModifiers(country) {
    const domestic = this.getDomesticModifiers(country);
    const economic = this.getEconomicModifiers(country);
    const foreign = this.getForeignPolicyBias(country);
    return {
      internalSecurityEffectiveness: domestic.securitySuppressionMult,
      internalSecuritySupportPenalty: domestic.repressionSupportPenaltyMult,
      industryPolicyEffectiveness: economic.industryGrowthMult,
      militaryPreference: foreign.escalationBias > 0 ? 1.15 : (foreign.escalationBias < 0 ? 0.9 : 1),
      militaryReadinessEffectiveness: foreign.escalationBias > 0 ? 1.08 : 0.98,
      policyCostMultiplier: this.getProfile(country).economicOrientation === 'state_led' ? 0.95 : 1
    };
  }

  getProfileSummary(country) {
    const profile = this.getProfile(country);
    return `${profile.regimeType} / ${profile.economicOrientation.replace('_', '-')} / ${profile.foreignPolicyStyle}`;
  }

  getProfileHint(country) {
    const profile = this.getProfile(country);
    const hints = [];
    if (profile.regimeType === 'democracy') hints.push('high sensitivity to war weariness and repression backlash');
    if (profile.regimeType === 'authoritarian') hints.push('strong short-term control, sharper crisis legitimacy cliffs');
    if (profile.regimeType === 'hybrid') hints.push('balanced domestic sensitivity');
    if (profile.economicOrientation === 'market') hints.push('trade gains are stronger, sanction shocks are sharper');
    if (profile.economicOrientation === 'state_led') hints.push('more sanction resilience, slower trade-led growth');
    if (profile.foreignPolicyStyle === 'cooperative') hints.push('prefers de-escalation and agreement preservation');
    if (profile.foreignPolicyStyle === 'aggressive') hints.push('more tolerant of confrontation and pressure campaigns');
    if (profile.foreignPolicyStyle === 'pragmatic') hints.push('balances coercion and de-escalation');
    return hints.slice(0, 2).join(' • ');
  }

  setCountryProfile(country, updates) {
    if (!country || !updates) return null;
    this.ensureCountryProfile(country);
    if (updates.regimeType && this.profileOptions.regimeType.includes(updates.regimeType)) {
      country.regimeType = updates.regimeType;
    }
    if (updates.economicOrientation && this.profileOptions.economicOrientation.includes(updates.economicOrientation)) {
      country.economicOrientation = updates.economicOrientation;
    }
    if (updates.foreignPolicyStyle && this.profileOptions.foreignPolicyStyle.includes(updates.foreignPolicyStyle)) {
      country.foreignPolicyStyle = updates.foreignPolicyStyle;
    }
    return this.getProfile(country);
  }
}
