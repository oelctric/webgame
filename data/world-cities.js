(function initGeoWorldCitiesData() {
  const SRC_GN = {
    sourceType: 'public_dataset',
    sourceName: 'GeoNames + UN World Urbanization Prospects (curated)',
    sourceDate: '2025-01-10',
    sourceUrl: 'https://www.geonames.org/',
    sourceRef: 'cities5000+strategic-curation',
    confidenceLevel: 'high',
    estimationMethod: 'direct'
  };

  window.GEO_WORLD_CITIES = [
    { id: 'city_us_nyc', name: 'New York City', country: 'United States of America', regionId: 'usa_new_york', lat: 40.7128, lon: -74.006, isCapital: false, population: 8400000, populationTier: 'megacity', roleTags: ['industrial', 'port', 'airport_hub', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_us_washington', name: 'Washington', country: 'United States of America', regionId: 'usa_virginia', lat: 38.9072, lon: -77.0369, isCapital: true, population: 680000, populationTier: 'major', roleTags: ['capital', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_us_los_angeles', name: 'Los Angeles', country: 'United States of America', regionId: 'usa_california', lat: 34.0522, lon: -118.2437, isCapital: false, population: 3900000, populationTier: 'megacity', roleTags: ['port', 'industrial', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_us_san_francisco', name: 'San Francisco', country: 'United States of America', regionId: 'usa_california', lat: 37.7749, lon: -122.4194, isCapital: false, population: 800000, populationTier: 'major', roleTags: ['port', 'industrial', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_us_houston', name: 'Houston', country: 'United States of America', regionId: 'usa_texas', lat: 29.7604, lon: -95.3698, isCapital: false, population: 2300000, populationTier: 'megacity', roleTags: ['energy_hub', 'port', 'industrial'], metadata: SRC_GN },
    { id: 'city_us_dallas', name: 'Dallas', country: 'United States of America', regionId: 'usa_texas', lat: 32.7767, lon: -96.797, isCapital: false, population: 1300000, populationTier: 'major', roleTags: ['industrial', 'airport_hub', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_us_honolulu', name: 'Honolulu', country: 'United States of America', regionId: 'usa_hawaii', lat: 21.3069, lon: -157.8583, isCapital: false, population: 350000, populationTier: 'regional', roleTags: ['port', 'airport_hub', 'logistics_hub'], metadata: SRC_GN },

    { id: 'city_cn_beijing', name: 'Beijing', country: 'China', regionId: 'chn_beijing', lat: 39.9042, lon: 116.4074, isCapital: true, population: 21800000, populationTier: 'megacity', roleTags: ['capital', 'industrial', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_cn_shanghai', name: 'Shanghai', country: 'China', regionId: 'chn_shanghai', lat: 31.2304, lon: 121.4737, isCapital: false, population: 24800000, populationTier: 'megacity', roleTags: ['port', 'industrial', 'airport_hub', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_cn_guangzhou', name: 'Guangzhou', country: 'China', regionId: 'chn_guangdong', lat: 23.1291, lon: 113.2644, isCapital: false, population: 15000000, populationTier: 'megacity', roleTags: ['industrial', 'port', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_cn_shenzhen', name: 'Shenzhen', country: 'China', regionId: 'chn_guangdong', lat: 22.5431, lon: 114.0579, isCapital: false, population: 17600000, populationTier: 'megacity', roleTags: ['industrial', 'port', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_cn_chengdu', name: 'Chengdu', country: 'China', regionId: 'chn_sichuan', lat: 30.5728, lon: 104.0668, isCapital: false, population: 21000000, populationTier: 'megacity', roleTags: ['industrial', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_cn_dalian', name: 'Dalian', country: 'China', regionId: 'chn_liaoning', lat: 38.914, lon: 121.6147, isCapital: false, population: 7400000, populationTier: 'major', roleTags: ['port', 'industrial'], metadata: SRC_GN },

    { id: 'city_in_delhi', name: 'Delhi', country: 'India', regionId: 'ind_delhi', lat: 28.6139, lon: 77.209, isCapital: true, population: 30000000, populationTier: 'megacity', roleTags: ['capital', 'industrial', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_in_mumbai', name: 'Mumbai', country: 'India', regionId: 'ind_maharashtra', lat: 19.076, lon: 72.8777, isCapital: false, population: 20000000, populationTier: 'megacity', roleTags: ['port', 'industrial', 'financial_hub'], metadata: SRC_GN },
    { id: 'city_in_pune', name: 'Pune', country: 'India', regionId: 'ind_maharashtra', lat: 18.5204, lon: 73.8567, isCapital: false, population: 7000000, populationTier: 'major', roleTags: ['industrial', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_in_chennai', name: 'Chennai', country: 'India', regionId: 'ind_tamil_nadu', lat: 13.0827, lon: 80.2707, isCapital: false, population: 11000000, populationTier: 'megacity', roleTags: ['port', 'industrial', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_in_ahmedabad', name: 'Ahmedabad', country: 'India', regionId: 'ind_gujarat', lat: 23.0225, lon: 72.5714, isCapital: false, population: 8000000, populationTier: 'major', roleTags: ['industrial'], metadata: SRC_GN },
    { id: 'city_in_kolkata', name: 'Kolkata', country: 'India', regionId: 'ind_west_bengal', lat: 22.5726, lon: 88.3639, isCapital: false, population: 15000000, populationTier: 'megacity', roleTags: ['port', 'industrial', 'logistics_hub'], metadata: SRC_GN },

    { id: 'city_ru_moscow', name: 'Moscow', country: 'Russia', regionId: 'rus_moscow_city', lat: 55.7558, lon: 37.6173, isCapital: true, population: 13000000, populationTier: 'megacity', roleTags: ['capital', 'industrial', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_ru_stp', name: 'Saint Petersburg', country: 'Russia', regionId: 'rus_st_petersburg', lat: 59.9311, lon: 30.3609, isCapital: false, population: 5600000, populationTier: 'major', roleTags: ['port', 'industrial'], metadata: SRC_GN },
    { id: 'city_ru_kaliningrad', name: 'Kaliningrad', country: 'Russia', regionId: 'rus_kaliningrad', lat: 54.7104, lon: 20.4522, isCapital: false, population: 490000, populationTier: 'regional', roleTags: ['port', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_ru_vladivostok', name: 'Vladivostok', country: 'Russia', regionId: 'rus_primorsky', lat: 43.1155, lon: 131.8855, isCapital: false, population: 600000, populationTier: 'regional', roleTags: ['port', 'naval_hub'], metadata: SRC_GN },

    { id: 'city_jp_tokyo', name: 'Tokyo', country: 'Japan', regionId: 'jpn_tokyo', lat: 35.6762, lon: 139.6503, isCapital: true, population: 37000000, populationTier: 'megacity', roleTags: ['capital', 'industrial', 'port', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_jp_yokohama', name: 'Yokohama', country: 'Japan', regionId: 'jpn_kanagawa', lat: 35.4437, lon: 139.638, isCapital: false, population: 3700000, populationTier: 'major', roleTags: ['port', 'industrial'], metadata: SRC_GN },
    { id: 'city_jp_osaka', name: 'Osaka', country: 'Japan', regionId: 'jpn_osaka', lat: 34.6937, lon: 135.5023, isCapital: false, population: 2700000, populationTier: 'major', roleTags: ['industrial', 'port', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_jp_sapporo', name: 'Sapporo', country: 'Japan', regionId: 'jpn_hokkaido', lat: 43.0618, lon: 141.3545, isCapital: false, population: 1900000, populationTier: 'major', roleTags: ['industrial', 'logistics_hub'], metadata: SRC_GN },

    { id: 'city_de_berlin', name: 'Berlin', country: 'Germany', regionId: 'deu_berlin', lat: 52.52, lon: 13.405, isCapital: true, population: 3800000, populationTier: 'major', roleTags: ['capital', 'industrial', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_de_hamburg', name: 'Hamburg', country: 'Germany', regionId: 'deu_nrw', lat: 53.5511, lon: 9.9937, isCapital: false, population: 1800000, populationTier: 'major', roleTags: ['port', 'industrial'], metadata: SRC_GN },
    { id: 'city_de_munich', name: 'Munich', country: 'Germany', regionId: 'deu_bavaria', lat: 48.1351, lon: 11.582, isCapital: false, population: 1500000, populationTier: 'major', roleTags: ['industrial', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_de_cologne', name: 'Cologne', country: 'Germany', regionId: 'deu_nrw', lat: 50.9375, lon: 6.9603, isCapital: false, population: 1100000, populationTier: 'major', roleTags: ['industrial', 'logistics_hub'], metadata: SRC_GN },

    { id: 'city_uk_london', name: 'London', country: 'United Kingdom', regionId: 'gbr_england', lat: 51.5072, lon: -0.1276, isCapital: true, population: 9600000, populationTier: 'megacity', roleTags: ['capital', 'financial_hub', 'airport_hub'], metadata: SRC_GN },
    { id: 'city_uk_manchester', name: 'Manchester', country: 'United Kingdom', regionId: 'gbr_england', lat: 53.4808, lon: -2.2426, isCapital: false, population: 560000, populationTier: 'major', roleTags: ['industrial', 'logistics_hub'], metadata: SRC_GN },
    { id: 'city_uk_glasgow', name: 'Glasgow', country: 'United Kingdom', regionId: 'gbr_scotland', lat: 55.8642, lon: -4.2518, isCapital: false, population: 630000, populationTier: 'major', roleTags: ['industrial', 'port'], metadata: SRC_GN },
    { id: 'city_uk_cardiff', name: 'Cardiff', country: 'United Kingdom', regionId: 'gbr_wales', lat: 51.4816, lon: -3.1791, isCapital: false, population: 360000, populationTier: 'regional', roleTags: ['port', 'logistics_hub'], metadata: SRC_GN }
  ];
})();
