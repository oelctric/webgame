(function initGeoMilitarySites() {
  const SRC = {
    sourceType: 'public_dataset',
    sourceName: 'IISS Military Balance + public base registries + satellite-reviewed OSINT (curated)',
    sourceDate: '2025-02-20',
    sourceRef: 'mbalance-osint-curation-v1',
    sourceUrl: 'https://www.iiss.org/',
    confidenceLevel: 'medium',
    estimationMethod: 'direct'
  };

  const estimated = (min, max, confidence = 'medium', method = 'estimated') => ({ mode: 'range', min, max, confidenceLevel: confidence, estimateType: method });
  const exact = (value, confidence = 'high') => ({ mode: 'exact', value, confidenceLevel: confidence, estimateType: 'confirmed' });

  window.GEO_MILITARY_SITES = [
    {
      id: 'mil_us_norfolk',
      name: 'Naval Station Norfolk',
      country: 'United States of America',
      regionId: 'usa_virginia',
      lat: 36.95,
      lon: -76.33,
      siteType: 'naval_base',
      readinessTags: ['high_readiness', 'blue_water_projection'],
      postureTags: ['atlantic_deterrence'],
      capacityTier: 'very_high',
      personnel: estimated(18000, 26000, 'medium'),
      confidenceLevel: 'high',
      metadata: SRC,
      estimatedInventory: {
        navalCombatants: estimated(8, 14, 'medium', 'inferred_from_berthing'),
        submarines: estimated(0, 4, 'low', 'inferred_from_fleet_rotation'),
        airDefenseSystems: estimated(2, 5, 'low', 'inferred')
      }
    },
    {
      id: 'mil_us_langley',
      name: 'Joint Base Langley-Eustis',
      country: 'United States of America',
      regionId: 'usa_virginia',
      lat: 37.0829,
      lon: -76.3605,
      siteType: 'air_base',
      readinessTags: ['quick_reaction_alert'],
      postureTags: ['air_superiority'],
      capacityTier: 'high',
      personnel: estimated(5000, 9000, 'medium'),
      confidenceLevel: 'high',
      metadata: SRC,
      estimatedInventory: {
        fighters: estimated(36, 72, 'medium', 'squadron_range'),
        transportAircraft: estimated(4, 14, 'low', 'inferred_from_role'),
        helicopters: estimated(6, 18, 'low', 'inferred_from_role'),
        personnel: exact(7200, 'medium')
      }
    },
    {
      id: 'mil_cn_sanya',
      name: 'Yulin Naval Base (Sanya)',
      country: 'China',
      regionId: 'chn_guangdong',
      lat: 18.22,
      lon: 109.63,
      siteType: 'naval_base',
      readinessTags: ['regional_surge_capable'],
      postureTags: ['south_china_sea_presence'],
      capacityTier: 'high',
      personnel: estimated(8000, 14000, 'low'),
      confidenceLevel: 'medium',
      metadata: { ...SRC, confidenceLevel: 'medium', estimationMethod: 'inferred' },
      estimatedInventory: {
        navalCombatants: estimated(6, 12, 'low', 'inferred_from_satellite_dock_counts'),
        submarines: estimated(2, 8, 'low', 'inferred_from_pier_type'),
        airDefenseSystems: estimated(4, 10, 'medium', 'regional_air_defense_network')
      }
    },
    {
      id: 'mil_cn_luliang',
      name: 'Luliang Air Base Sector',
      country: 'China',
      regionId: 'chn_sichuan',
      lat: 24.2,
      lon: 106.9,
      siteType: 'air_base',
      readinessTags: ['rotational_air_wing'],
      postureTags: ['air_denial'],
      capacityTier: 'high',
      personnel: estimated(3500, 7000, 'low'),
      confidenceLevel: 'low',
      metadata: { ...SRC, confidenceLevel: 'low', estimationMethod: 'inferred' },
      estimatedInventory: {
        fighters: estimated(24, 56, 'low', 'squadron_range'),
        bombers: estimated(0, 12, 'low', 'role_inference'),
        transportAircraft: estimated(2, 8, 'low', 'role_inference')
      }
    },
    {
      id: 'mil_in_karwar',
      name: 'INS Kadamba (Karwar)',
      country: 'India',
      regionId: 'ind_maharashtra',
      lat: 14.82,
      lon: 74.13,
      siteType: 'naval_base',
      readinessTags: ['fleet_support'],
      postureTags: ['arabian_sea_security'],
      capacityTier: 'high',
      personnel: estimated(4000, 9000, 'medium'),
      confidenceLevel: 'medium',
      metadata: SRC,
      estimatedInventory: {
        navalCombatants: estimated(4, 10, 'medium', 'fleet_role_estimate'),
        submarines: estimated(0, 4, 'low', 'rotational_presence')
      }
    },
    {
      id: 'mil_in_hindon',
      name: 'Hindon Air Force Station',
      country: 'India',
      regionId: 'ind_delhi',
      lat: 28.707,
      lon: 77.358,
      siteType: 'air_base',
      readinessTags: ['airlift_ready'],
      postureTags: ['northern_theater_support'],
      capacityTier: 'medium',
      personnel: estimated(2500, 5000, 'medium'),
      confidenceLevel: 'medium',
      metadata: SRC,
      estimatedInventory: {
        transportAircraft: estimated(14, 30, 'medium', 'airlift_order_of_battle_estimate'),
        helicopters: estimated(6, 16, 'medium', 'support_wing_estimate'),
        fighters: estimated(0, 12, 'low', 'detachment_possible')
      }
    },
    {
      id: 'mil_ru_severomorsk',
      name: 'Severomorsk Naval Cluster',
      country: 'Russia',
      regionId: 'rus_st_petersburg',
      lat: 69.07,
      lon: 33.42,
      siteType: 'naval_base',
      readinessTags: ['strategic_deterrence_support'],
      postureTags: ['northern_fleet'],
      capacityTier: 'very_high',
      personnel: estimated(12000, 22000, 'low'),
      confidenceLevel: 'medium',
      metadata: { ...SRC, confidenceLevel: 'medium', estimationMethod: 'scenario-adjusted' },
      estimatedInventory: {
        navalCombatants: estimated(8, 16, 'low', 'fleet_order_estimate'),
        submarines: estimated(4, 12, 'low', 'strategic_submarine_role'),
        airDefenseSystems: estimated(6, 14, 'medium', 'regional_integrated_air_defense')
      }
    },
    {
      id: 'mil_ru_kaliningrad_ad',
      name: 'Kaliningrad Air Defense District',
      country: 'Russia',
      regionId: 'rus_kaliningrad',
      lat: 54.7,
      lon: 20.5,
      siteType: 'missile_air_defense_site',
      readinessTags: ['high_alert'],
      postureTags: ['a2ad_enclave'],
      capacityTier: 'high',
      personnel: estimated(1800, 4200, 'low'),
      confidenceLevel: 'medium',
      metadata: { ...SRC, estimationMethod: 'inferred' },
      estimatedInventory: {
        airDefenseSystems: estimated(6, 18, 'medium', 'battery_estimate'),
        artillery: estimated(12, 40, 'low', 'co_located_support_estimate')
      }
    },
    {
      id: 'mil_jp_yokosuka',
      name: 'Yokosuka Naval Base',
      country: 'Japan',
      regionId: 'jpn_kanagawa',
      lat: 35.281,
      lon: 139.667,
      siteType: 'naval_base',
      readinessTags: ['allied_integration'],
      postureTags: ['western_pacific_presence'],
      capacityTier: 'high',
      personnel: estimated(7000, 13000, 'medium'),
      confidenceLevel: 'high',
      metadata: SRC,
      estimatedInventory: {
        navalCombatants: estimated(4, 10, 'medium', 'berth_rotation_estimate'),
        submarines: estimated(0, 4, 'low', 'regional_rotation')
      }
    },
    {
      id: 'mil_jp_misawa',
      name: 'Misawa Air Base',
      country: 'Japan',
      regionId: 'jpn_hokkaido',
      lat: 40.7032,
      lon: 141.367,
      siteType: 'air_base',
      readinessTags: ['air_defense_quick_response'],
      postureTags: ['northeast_air_sector'],
      capacityTier: 'medium',
      personnel: estimated(2800, 5800, 'medium'),
      confidenceLevel: 'medium',
      metadata: SRC,
      estimatedInventory: {
        fighters: estimated(18, 48, 'medium', 'squadron_range'),
        transportAircraft: estimated(2, 8, 'low', 'support_estimate')
      }
    },
    {
      id: 'mil_de_wilhelmshaven',
      name: 'Wilhelmshaven Naval Installation',
      country: 'Germany',
      regionId: 'deu_nrw',
      lat: 53.53,
      lon: 8.11,
      siteType: 'naval_base',
      readinessTags: ['nato_support'],
      postureTags: ['north_sea_security'],
      capacityTier: 'medium',
      personnel: estimated(2200, 4600, 'medium'),
      confidenceLevel: 'medium',
      metadata: SRC,
      estimatedInventory: {
        navalCombatants: estimated(2, 6, 'medium', 'fleet_role_estimate'),
        helicopters: estimated(2, 8, 'low', 'support_estimate')
      }
    },
    {
      id: 'mil_uk_portsmouth',
      name: 'HMNB Portsmouth',
      country: 'United Kingdom',
      regionId: 'gbr_england',
      lat: 50.8,
      lon: -1.11,
      siteType: 'naval_base',
      readinessTags: ['expeditionary_support'],
      postureTags: ['atlantic_maritime_security'],
      capacityTier: 'high',
      personnel: estimated(4500, 9000, 'medium'),
      confidenceLevel: 'high',
      metadata: SRC,
      estimatedInventory: {
        navalCombatants: estimated(4, 8, 'medium', 'homeport_estimate'),
        submarines: estimated(0, 2, 'low', 'rotational_presence')
      }
    }
  ];
})();
