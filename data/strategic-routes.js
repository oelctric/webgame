(function initGeoStrategicRoutes() {
  const SRC = {
    sourceType: 'public_dataset',
    sourceName: 'UNESCAP transport corridors + national freight corridors (curated)',
    sourceDate: '2025-01-22',
    sourceRef: 'strategic-corridors-v1',
    sourceUrl: 'https://unece.org/transport',
    confidenceLevel: 'medium',
    estimationMethod: 'inferred'
  };

  window.GEO_STRATEGIC_ROUTES = [
    { id: 'route_us_northeast', type: 'rail_logistics_corridor', fromNodeId: 'city_us_washington', toNodeId: 'city_us_nyc', country: 'United States of America', strategicValue: 82, metadata: SRC },
    { id: 'route_us_texas_port', type: 'energy_corridor', fromNodeId: 'city_us_houston', toNodeId: 'infra_us_hou_refinery', country: 'United States of America', strategicValue: 88, metadata: SRC },
    { id: 'route_us_pacific', type: 'port_access_route', fromNodeId: 'city_us_los_angeles', toNodeId: 'infra_us_la_port', country: 'United States of America', strategicValue: 90, metadata: SRC },

    { id: 'route_cn_delta', type: 'primary_road_corridor', fromNodeId: 'city_cn_guangzhou', toNodeId: 'city_cn_shenzhen', country: 'China', strategicValue: 86, metadata: SRC },
    { id: 'route_cn_north_south', type: 'rail_logistics_corridor', fromNodeId: 'city_cn_beijing', toNodeId: 'city_cn_shanghai', country: 'China', strategicValue: 92, metadata: SRC },

    { id: 'route_in_west_coast', type: 'port_access_route', fromNodeId: 'city_in_mumbai', toNodeId: 'infra_in_mumbai_port', country: 'India', strategicValue: 84, metadata: SRC },
    { id: 'route_in_north_logistics', type: 'primary_road_corridor', fromNodeId: 'city_in_delhi', toNodeId: 'city_in_ahmedabad', country: 'India', strategicValue: 74, metadata: SRC },

    { id: 'route_ru_euro_axis', type: 'rail_logistics_corridor', fromNodeId: 'city_ru_moscow', toNodeId: 'city_ru_stp', country: 'Russia', strategicValue: 79, metadata: SRC },
    { id: 'route_ru_far_east', type: 'port_access_route', fromNodeId: 'city_ru_vladivostok', toNodeId: 'infra_ru_vladivostok_log', country: 'Russia', strategicValue: 68, metadata: SRC },

    { id: 'route_jp_tokyo_bay', type: 'port_access_route', fromNodeId: 'city_jp_tokyo', toNodeId: 'infra_jp_yokohama_port', country: 'Japan', strategicValue: 83, metadata: SRC },
    { id: 'route_jp_energy', type: 'energy_corridor', fromNodeId: 'city_jp_tokyo', toNodeId: 'infra_jp_tokyo_power', country: 'Japan', strategicValue: 77, metadata: SRC },

    { id: 'route_de_industry_port', type: 'rail_logistics_corridor', fromNodeId: 'infra_de_ruhr_industry', toNodeId: 'infra_de_hamburg_port', country: 'Germany', strategicValue: 82, metadata: SRC },
    { id: 'route_uk_capital_port', type: 'port_access_route', fromNodeId: 'city_uk_london', toNodeId: 'infra_uk_felixstowe', country: 'United Kingdom', strategicValue: 79, metadata: SRC },
    { id: 'route_uk_air_london', type: 'primary_road_corridor', fromNodeId: 'city_uk_london', toNodeId: 'infra_uk_heathrow', country: 'United Kingdom', strategicValue: 76, metadata: SRC },

    { id: 'route_us_uk_atlantic', type: 'rail_logistics_corridor', fromNodeId: 'city_us_nyc', toNodeId: 'city_uk_london', country: 'transnational', strategicValue: 70, metadata: { ...SRC, estimationMethod: 'scenario-adjusted', confidenceLevel: 'low' } }
  ];
})();
