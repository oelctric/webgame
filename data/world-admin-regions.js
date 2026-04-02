(function initGeoAdminRegionsData() {
  const SOURCE = {
    sourceType: 'public_dataset',
    sourceName: 'Natural Earth Admin-1 + curated simplification',
    sourceDate: '2025-01-15',
    sourceRef: 'ne_10m_admin_1_states_provinces',
    sourceUrl: 'https://www.naturalearthdata.com/',
    confidenceLevel: 'high',
    estimationMethod: 'direct'
  };

  window.GEO_ADMIN1_BOUNDARY_RECORDS = [
    { id: 'bnd_usa_west_coast', country: 'United States of America', kind: 'admin1_aggregate', path: [[-124.6, 48.9], [-124.3, 42.0], [-117.1, 32.5]] },
    { id: 'bnd_usa_tx_ny', country: 'United States of America', kind: 'admin1_corridor', path: [[-106.6, 31.8], [-99.9, 36.5], [-90.0, 39.0], [-79.8, 42.5]] },
    { id: 'bnd_china_east', country: 'China', kind: 'admin1_aggregate', path: [[120.0, 39.5], [118.5, 32.0], [113.0, 23.5]] },
    { id: 'bnd_india_north_south', country: 'India', kind: 'admin1_aggregate', path: [[77.2, 30.0], [78.5, 23.0], [77.5, 13.0]] },
    { id: 'bnd_russia_west', country: 'Russia', kind: 'admin1_aggregate', path: [[30.2, 60.5], [37.6, 56.0], [49.1, 55.7]] },
    { id: 'bnd_japan_honshu', country: 'Japan', kind: 'admin1_aggregate', path: [[139.7, 35.6], [136.9, 35.1], [132.4, 34.2]] },
    { id: 'bnd_germany_axis', country: 'Germany', kind: 'admin1_aggregate', path: [[6.8, 51.5], [11.3, 51.0], [13.4, 48.8]] },
    { id: 'bnd_uk_axis', country: 'United Kingdom', kind: 'admin1_aggregate', path: [[-4.2, 57.2], [-2.0, 53.5], [-0.1, 51.5]] }
  ];

  window.GEO_ADMIN1_REGIONS = [
    { id: 'usa_california', country: 'United States of America', countryId: 'usa', name: 'California', regionType: 'state', boundaryRef: 'bnd_usa_west_coast', metadata: SOURCE },
    { id: 'usa_texas', country: 'United States of America', countryId: 'usa', name: 'Texas', regionType: 'state', boundaryRef: 'bnd_usa_tx_ny', metadata: SOURCE },
    { id: 'usa_new_york', country: 'United States of America', countryId: 'usa', name: 'New York', regionType: 'state', boundaryRef: 'bnd_usa_tx_ny', metadata: SOURCE },
    { id: 'usa_virginia', country: 'United States of America', countryId: 'usa', name: 'Virginia', regionType: 'state', boundaryRef: 'bnd_usa_tx_ny', metadata: SOURCE },
    { id: 'usa_hawaii', country: 'United States of America', countryId: 'usa', name: 'Hawaii', regionType: 'state', boundaryRef: 'bnd_usa_west_coast', metadata: { ...SOURCE, confidenceLevel: 'medium', estimationMethod: 'hand-curated fallback' } },

    { id: 'chn_beijing', country: 'China', countryId: 'chn', name: 'Beijing Municipality', regionType: 'municipality', boundaryRef: 'bnd_china_east', metadata: SOURCE },
    { id: 'chn_shanghai', country: 'China', countryId: 'chn', name: 'Shanghai Municipality', regionType: 'municipality', boundaryRef: 'bnd_china_east', metadata: SOURCE },
    { id: 'chn_guangdong', country: 'China', countryId: 'chn', name: 'Guangdong', regionType: 'province', boundaryRef: 'bnd_china_east', metadata: SOURCE },
    { id: 'chn_sichuan', country: 'China', countryId: 'chn', name: 'Sichuan', regionType: 'province', boundaryRef: 'bnd_china_east', metadata: SOURCE },
    { id: 'chn_liaoning', country: 'China', countryId: 'chn', name: 'Liaoning', regionType: 'province', boundaryRef: 'bnd_china_east', metadata: SOURCE },

    { id: 'ind_delhi', country: 'India', countryId: 'ind', name: 'National Capital Territory of Delhi', regionType: 'union_territory', boundaryRef: 'bnd_india_north_south', metadata: SOURCE },
    { id: 'ind_maharashtra', country: 'India', countryId: 'ind', name: 'Maharashtra', regionType: 'state', boundaryRef: 'bnd_india_north_south', metadata: SOURCE },
    { id: 'ind_tamil_nadu', country: 'India', countryId: 'ind', name: 'Tamil Nadu', regionType: 'state', boundaryRef: 'bnd_india_north_south', metadata: SOURCE },
    { id: 'ind_gujarat', country: 'India', countryId: 'ind', name: 'Gujarat', regionType: 'state', boundaryRef: 'bnd_india_north_south', metadata: SOURCE },
    { id: 'ind_west_bengal', country: 'India', countryId: 'ind', name: 'West Bengal', regionType: 'state', boundaryRef: 'bnd_india_north_south', metadata: SOURCE },

    { id: 'rus_moscow_city', country: 'Russia', countryId: 'rus', name: 'Moscow', regionType: 'federal_city', boundaryRef: 'bnd_russia_west', metadata: SOURCE },
    { id: 'rus_st_petersburg', country: 'Russia', countryId: 'rus', name: 'Saint Petersburg', regionType: 'federal_city', boundaryRef: 'bnd_russia_west', metadata: SOURCE },
    { id: 'rus_kaliningrad', country: 'Russia', countryId: 'rus', name: 'Kaliningrad Oblast', regionType: 'oblast', boundaryRef: 'bnd_russia_west', metadata: SOURCE },
    { id: 'rus_primorsky', country: 'Russia', countryId: 'rus', name: 'Primorsky Krai', regionType: 'krai', boundaryRef: 'bnd_russia_west', metadata: { ...SOURCE, confidenceLevel: 'medium', estimationMethod: 'hand-curated fallback' } },

    { id: 'jpn_tokyo', country: 'Japan', countryId: 'jpn', name: 'Tokyo', regionType: 'metropolis', boundaryRef: 'bnd_japan_honshu', metadata: SOURCE },
    { id: 'jpn_osaka', country: 'Japan', countryId: 'jpn', name: 'Osaka', regionType: 'prefecture', boundaryRef: 'bnd_japan_honshu', metadata: SOURCE },
    { id: 'jpn_kanagawa', country: 'Japan', countryId: 'jpn', name: 'Kanagawa', regionType: 'prefecture', boundaryRef: 'bnd_japan_honshu', metadata: SOURCE },
    { id: 'jpn_hokkaido', country: 'Japan', countryId: 'jpn', name: 'Hokkaido', regionType: 'prefecture', boundaryRef: 'bnd_japan_honshu', metadata: { ...SOURCE, confidenceLevel: 'medium', estimationMethod: 'hand-curated fallback' } },

    { id: 'deu_berlin', country: 'Germany', countryId: 'deu', name: 'Berlin', regionType: 'state', boundaryRef: 'bnd_germany_axis', metadata: SOURCE },
    { id: 'deu_bavaria', country: 'Germany', countryId: 'deu', name: 'Bavaria', regionType: 'state', boundaryRef: 'bnd_germany_axis', metadata: SOURCE },
    { id: 'deu_nrw', country: 'Germany', countryId: 'deu', name: 'North Rhine-Westphalia', regionType: 'state', boundaryRef: 'bnd_germany_axis', metadata: SOURCE },

    { id: 'gbr_england', country: 'United Kingdom', countryId: 'gbr', name: 'England', regionType: 'country', boundaryRef: 'bnd_uk_axis', metadata: SOURCE },
    { id: 'gbr_scotland', country: 'United Kingdom', countryId: 'gbr', name: 'Scotland', regionType: 'country', boundaryRef: 'bnd_uk_axis', metadata: SOURCE },
    { id: 'gbr_wales', country: 'United Kingdom', countryId: 'gbr', name: 'Wales', regionType: 'country', boundaryRef: 'bnd_uk_axis', metadata: SOURCE }
  ];
})();
