window.createMapRenderer = function createMapRenderer({
  svg,
  mapWrap,
  tooltip,
  resetViewBtn,
  loadCountries,
  onCountrySelected,
  onMapClick,
  getCountryClass,
  cities = [],
  bases = [],
  units = []
}) {
  let projection;
  let path;
  let mapRoot;
  let countriesLayer;
  let citiesLayer;
  let basesLayer;
  let unitsLayer;
  let zoomBehavior;
  let countriesData = [];

  function initLayers(width, height) {
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const projectionFactory = d3.geoRobinson ? d3.geoRobinson : d3.geoNaturalEarth1;
    projection = projectionFactory().fitExtent([[15, 15], [width - 15, height - 15]], { type: 'Sphere' });
    path = d3.geoPath(projection);

    mapRoot = svg.append('g').attr('id', 'mapRoot');
    countriesLayer = mapRoot.append('g').attr('id', 'countriesLayer');
    citiesLayer = mapRoot.append('g').attr('id', 'citiesLayer');
    basesLayer = mapRoot.append('g').attr('id', 'basesLayer');
    unitsLayer = mapRoot.append('g').attr('id', 'unitsLayer');

    zoomBehavior = d3.zoom()
      .scaleExtent([1, 8])
      .translateExtent([[-width * 0.6, -height * 0.6], [width * 1.6, height * 1.6]])
      .on('zoom', (event) => mapRoot && mapRoot.attr('transform', event.transform));

    svg.call(zoomBehavior).on('dblclick.zoom', null);
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', resetView);
    }
  }

  function resetView() {
    svg.transition().duration(250).call(zoomBehavior.transform, d3.zoomIdentity);
  }

  function mapPoint(lon, lat) {
    if (!projection) return null;
    return projection([lon, lat]);
  }

  function renderCountries() {
    if (!countriesLayer || !path) return;
    const selection = countriesLayer
      .selectAll('path.country')
      .data(countriesData, (d) => d.id || d.properties?.name);

    selection.enter()
      .append('path')
      .attr('class', 'country')
      .merge(selection)
      .attr('d', path)
      .attr('data-name', (d) => d.properties?.name || '')
      .attr('class', (d) => `country ${getCountryClass ? getCountryClass(d) : ''}`)
      .on('mousemove', function onMouseMove(event, d) {
        if (!tooltip) return;
        tooltip.style.opacity = 1;
        tooltip.style.left = `${event.clientX - mapWrap.getBoundingClientRect().left}px`;
        tooltip.style.top = `${event.clientY - mapWrap.getBoundingClientRect().top}px`;
        tooltip.textContent = d.properties?.name || 'Unknown';
      })
      .on('mouseleave', () => {
        if (tooltip) tooltip.style.opacity = 0;
      })
      .on('click', (event, country) => {
        event.stopPropagation();
        if (typeof onCountrySelected === 'function') onCountrySelected(country, event);
      });

    selection.exit().remove();
  }

  function renderCities(nextCities = cities) {
    if (!citiesLayer) return;
    const selection = citiesLayer
      .selectAll('circle.city')
      .data(nextCities, (d) => d.id || `${d.country}:${d.name}`);

    selection.enter().append('circle').attr('class', 'city')
      .merge(selection)
      .attr('cx', (d) => mapPoint(d.lon, d.lat)?.[0] ?? -999)
      .attr('cy', (d) => mapPoint(d.lon, d.lat)?.[1] ?? -999)
      .attr('r', 2.6);

    selection.exit().remove();
  }

  function renderBases(nextBases = bases) {
    if (!basesLayer) return;
    const selection = basesLayer
      .selectAll('circle.base')
      .data(nextBases, (d) => d.id);

    selection.enter().append('circle').attr('class', 'base')
      .merge(selection)
      .attr('cx', (d) => mapPoint(d.lonLat[0], d.lonLat[1])?.[0] ?? -999)
      .attr('cy', (d) => mapPoint(d.lonLat[0], d.lonLat[1])?.[1] ?? -999)
      .attr('r', 5);

    selection.exit().remove();
  }

  function renderUnits(nextUnits = units) {
    if (!unitsLayer) return;
    const selection = unitsLayer
      .selectAll('circle.unit')
      .data(nextUnits, (d) => d.id);

    selection.enter().append('circle').attr('class', 'unit')
      .merge(selection)
      .attr('cx', (d) => mapPoint(d.lonLat[0], d.lonLat[1])?.[0] ?? -999)
      .attr('cy', (d) => mapPoint(d.lonLat[0], d.lonLat[1])?.[1] ?? -999)
      .attr('r', 4);

    selection.exit().remove();
  }

  function refreshSelection() {
    renderCountries();
  }

  async function init() {
    const width = mapWrap.clientWidth;
    const height = mapWrap.clientHeight;
    initLayers(width, height);
    countriesData = await loadCountries();
    renderCountries();
    renderCities();
    renderBases();
    renderUnits();
    svg.on('click', (event) => typeof onMapClick === 'function' && onMapClick(event, { projection, countries: countriesData }));
    return { projection, countries: countriesData };
  }

  return {
    init,
    renderCountries,
    renderCities,
    renderBases,
    renderUnits,
    resetView,
    refreshSelection
  };
};
