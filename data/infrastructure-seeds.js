(function initGeoInfrastructureSeeds() {
  const SRC = {
    sourceType: 'public_dataset',
    sourceName: 'OpenStreetMap + World Port Index + airport operator reports (curated)',
    sourceDate: '2025-02-01',
    sourceRef: 'osm-wpi-airport-curation-v1',
    sourceUrl: 'https://www.openstreetmap.org/',
    confidenceLevel: 'medium',
    estimationMethod: 'direct'
  };

  window.GEO_INFRASTRUCTURE_SEEDS = [
    { id: 'infra_us_la_port', name: 'Port of Los Angeles-Long Beach', type: 'port', country: 'United States of America', regionId: 'usa_california', lat: 33.74, lon: -118.26, strategicValue: 92, capacityTier: 'very_high', metadata: SRC },
    { id: 'infra_us_jfk', name: 'JFK International Gateway', type: 'airport', country: 'United States of America', regionId: 'usa_new_york', lat: 40.6413, lon: -73.7781, strategicValue: 82, capacityTier: 'very_high', metadata: SRC },
    { id: 'infra_us_hou_refinery', name: 'Houston Refining Cluster', type: 'refinery', country: 'United States of America', regionId: 'usa_texas', lat: 29.73, lon: -95.13, strategicValue: 88, capacityTier: 'very_high', metadata: { ...SRC, estimationMethod: 'inferred' } },
    { id: 'infra_cn_shanghai_port', name: 'Port of Shanghai', type: 'port', country: 'China', regionId: 'chn_shanghai', lat: 31.35, lon: 121.8, strategicValue: 95, capacityTier: 'very_high', metadata: SRC },
    { id: 'infra_cn_baiyun', name: 'Guangzhou Baiyun Hub', type: 'airport', country: 'China', regionId: 'chn_guangdong', lat: 23.3924, lon: 113.2988, strategicValue: 80, capacityTier: 'high', metadata: SRC },
    { id: 'infra_cn_ningbo_energy', name: 'East Coast Energy Hub', type: 'energy_facility', country: 'China', regionId: 'chn_shanghai', lat: 29.87, lon: 121.55, strategicValue: 78, capacityTier: 'high', metadata: { ...SRC, confidenceLevel: 'low', estimationMethod: 'inferred' } },
    { id: 'infra_in_mumbai_port', name: 'Mumbai Port Complex', type: 'port', country: 'India', regionId: 'ind_maharashtra', lat: 18.95, lon: 72.85, strategicValue: 84, capacityTier: 'high', metadata: SRC },
    { id: 'infra_in_jnpt_logistics', name: 'JNPT Logistics Corridor Hub', type: 'logistics_hub', country: 'India', regionId: 'ind_maharashtra', lat: 18.95, lon: 73.02, strategicValue: 79, capacityTier: 'high', metadata: SRC },
    { id: 'infra_in_chennai_port', name: 'Chennai Port', type: 'port', country: 'India', regionId: 'ind_tamil_nadu', lat: 13.1, lon: 80.3, strategicValue: 74, capacityTier: 'high', metadata: SRC },
    { id: 'infra_ru_ust_luga', name: 'Ust-Luga Port', type: 'port', country: 'Russia', regionId: 'rus_st_petersburg', lat: 59.67, lon: 28.28, strategicValue: 75, capacityTier: 'high', metadata: SRC },
    { id: 'infra_ru_vladivostok_log', name: 'Vladivostok Pacific Logistics Hub', type: 'logistics_hub', country: 'Russia', regionId: 'rus_primorsky', lat: 43.11, lon: 131.89, strategicValue: 72, capacityTier: 'medium', metadata: { ...SRC, confidenceLevel: 'medium', estimationMethod: 'scenario-adjusted' } },
    { id: 'infra_jp_tokyo_power', name: 'Greater Tokyo Power Hub', type: 'power_hub', country: 'Japan', regionId: 'jpn_tokyo', lat: 35.63, lon: 139.8, strategicValue: 81, capacityTier: 'high', metadata: { ...SRC, estimationMethod: 'inferred' } },
    { id: 'infra_jp_yokohama_port', name: 'Port of Yokohama', type: 'port', country: 'Japan', regionId: 'jpn_kanagawa', lat: 35.45, lon: 139.65, strategicValue: 76, capacityTier: 'high', metadata: SRC },
    { id: 'infra_de_hamburg_port', name: 'Port of Hamburg', type: 'port', country: 'Germany', regionId: 'deu_nrw', lat: 53.54, lon: 9.96, strategicValue: 82, capacityTier: 'high', metadata: SRC },
    { id: 'infra_de_ruhr_industry', name: 'Ruhr Industrial Belt', type: 'industrial_hub', country: 'Germany', regionId: 'deu_nrw', lat: 51.48, lon: 7.22, strategicValue: 79, capacityTier: 'high', metadata: { ...SRC, estimationMethod: 'inferred' } },
    { id: 'infra_uk_felixstowe', name: 'Port of Felixstowe', type: 'port', country: 'United Kingdom', regionId: 'gbr_england', lat: 51.96, lon: 1.31, strategicValue: 73, capacityTier: 'high', metadata: SRC },
    { id: 'infra_uk_heathrow', name: 'Heathrow Airport Hub', type: 'airport', country: 'United Kingdom', regionId: 'gbr_england', lat: 51.47, lon: -0.4543, strategicValue: 83, capacityTier: 'very_high', metadata: SRC }
  ];
})();
