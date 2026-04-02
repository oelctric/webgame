window.createMapRenderer = function createMapRenderer({
  svg,
  mapWrap,
  tooltip,
  resetViewBtn,
  loadCountries,
  onCountrySelected,
  onMapClick,
  getCountryClass,
  onMapDragStateChange,
  onProjectionReady
}) {
  let projection;
  let path;
  let mapRoot;
  let countriesLayer;
  let adminLayer;
  let routesLayer;
  let citiesLayer;
  let infrastructureLayer;
  let militarySitesLayer;
  let basesLayer;
  let unitsLayer;
  let zoomBehavior;
  let countriesData = [];
  let suppressClick = false;

  function initLayers(width, height) {
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const projectionFactory = d3.geoRobinson ? d3.geoRobinson : d3.geoNaturalEarth1;
    projection = projectionFactory().fitExtent([[15, 15], [width - 15, height - 15]], { type: 'Sphere' });
    path = d3.geoPath(projection);

    mapRoot = svg.append('g').attr('id', 'mapRoot');
    countriesLayer = mapRoot.append('g').attr('id', 'countriesLayer');
    adminLayer = mapRoot.append('g').attr('id', 'adminLayer');
    routesLayer = mapRoot.append('g').attr('id', 'routesLayer');
    citiesLayer = mapRoot.append('g').attr('id', 'citiesLayer');
    infrastructureLayer = mapRoot.append('g').attr('id', 'infrastructureLayer');
    militarySitesLayer = mapRoot.append('g').attr('id', 'militarySitesLayer');
    basesLayer = mapRoot.append('g').attr('id', 'basesLayer');
    unitsLayer = mapRoot.append('g').attr('id', 'unitsLayer');

    zoomBehavior = d3.zoom()
      .scaleExtent([1, 8])
      .translateExtent([[-width * 0.6, -height * 0.6], [width * 1.6, height * 1.6]])
      .on('start', () => {
        if (typeof onMapDragStateChange === 'function') onMapDragStateChange(true);
      })
      .on('zoom', (event) => {
        if (mapRoot) mapRoot.attr('transform', event.transform);
        const source = event.sourceEvent;
        if (source && (source.type === 'mousemove' || source.type === 'pointermove') && (Math.abs(source.movementX) > 2 || Math.abs(source.movementY) > 2)) {
          suppressClick = true;
        }
      })
      .on('end', () => {
        if (typeof onMapDragStateChange === 'function') onMapDragStateChange(false);
        setTimeout(() => { suppressClick = false; }, 0);
      });

    svg.call(zoomBehavior).on('dblclick.zoom', null);
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', resetView);
    }
    if (typeof onProjectionReady === 'function') {
      onProjectionReady(projection);
    }
  }

  function shouldIgnoreMapClick() {
    if (!suppressClick) return false;
    suppressClick = false;
    return true;
  }

  function resetView() {
    svg.transition().duration(250).call(zoomBehavior.transform, d3.zoomIdentity);
  }

  function mapPoint(lon, lat) {
    if (!projection) return null;
    return projection([lon, lat]);
  }

  function getLonLatFromEvent(event) {
    const [x, y] = d3.pointer(event, svg.node());
    const transform = d3.zoomTransform(svg.node());
    const [worldX, worldY] = transform.invert([x, y]);
    return projection.invert([worldX, worldY]);
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
        if (shouldIgnoreMapClick()) return;
        if (typeof onCountrySelected === 'function') onCountrySelected(country, event);
      });

    selection.exit().remove();
  }

  function renderCities(cities = [], { getClassName, getTitle, onClick } = {}) {
    if (!citiesLayer) return;
    const selection = citiesLayer
      .selectAll('circle.city-point')
      .data(cities, (d) => d.id || `${d.ownerCountry || d.country}:${d.name}`);

    selection.enter().append('circle').attr('class', 'city city-point').attr('r', 3)
      .merge(selection)
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'city city-point'))
      .attr('cx', (d) => mapPoint(d.lonLat?.[0] ?? d.lon, d.lonLat?.[1] ?? d.lat)?.[0] ?? -999)
      .attr('cy', (d) => mapPoint(d.lonLat?.[0] ?? d.lon, d.lonLat?.[1] ?? d.lat)?.[1] ?? -999)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (shouldIgnoreMapClick()) return;
        if (typeof onClick === 'function') onClick(event, d);
      });

    selection.selectAll('title').data((d) => [d]).join('title').text((d) => (typeof getTitle === 'function' ? getTitle(d) : d.name || 'City'));
    selection.exit().remove();
  }

  function renderBases(bases = [], { getClassName, getColor, getTitle, onClick } = {}) {
    if (!basesLayer) return;
    const selection = basesLayer
      .selectAll('g.base-point')
      .data(bases, (d) => d.id);

    const enter = selection.enter().append('g').attr('class', 'base-point');
    enter
      .append('rect')
      .attr('class', 'base')
      .attr('width', 8)
      .attr('height', 8)
      .attr('x', -4)
      .attr('y', -4)
      .attr('rx', 1.5);
    enter.append('title');

    selection
      .merge(enter)
      .attr('transform', (d) => {
        const p = mapPoint(d.lonLat[0], d.lonLat[1]);
        return `translate(${p?.[0] ?? -999}, ${p?.[1] ?? -999})`;
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (shouldIgnoreMapClick()) return;
        if (typeof onClick === 'function') onClick(event, d);
      })
      .select('rect')
      .attr('fill', (d) => (typeof getColor === 'function' ? getColor(d) : 'var(--base-ground)'))
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'base'));

    selection
      .merge(enter)
      .select('title')
      .text((d) => (typeof getTitle === 'function' ? getTitle(d) : `Base ${d.id}`));

    selection.exit().remove();
  }

  function renderUnits(units = [], { getClassName, getTitle, getLonLat, onClick } = {}) {
    if (!unitsLayer) return;
    const selection = unitsLayer
      .selectAll('circle.unit-point')
      .data(units, (d) => d.id);

    const enter = selection.enter().append('circle').attr('class', 'unit-marker unit-point').attr('r', 2.3);
    enter.append('title');

    selection
      .merge(enter)
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'unit-marker unit-point'))
      .attr('cx', (d) => {
        const point = typeof getLonLat === 'function' ? getLonLat(d) : d.lonLat;
        return mapPoint(point[0], point[1])?.[0] ?? -999;
      })
      .attr('cy', (d) => {
        const point = typeof getLonLat === 'function' ? getLonLat(d) : d.lonLat;
        return mapPoint(point[0], point[1])?.[1] ?? -999;
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (shouldIgnoreMapClick()) return;
        if (typeof onClick === 'function') onClick(event, d);
      });

    selection
      .merge(enter)
      .select('title')
      .text((d) => (typeof getTitle === 'function' ? getTitle(d) : `Unit ${d.id}`));

    selection.exit().remove();
  }



  function renderAdminBoundaries(boundaries = [], { getClassName, getTitle } = {}) {
    if (!adminLayer) return;
    const selection = adminLayer.selectAll('path.admin-boundary').data(boundaries, (d) => d.id);
    selection.enter().append('path').attr('class', 'admin-boundary')
      .merge(selection)
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'admin-boundary'))
      .attr('d', (d) => {
        const coords = Array.isArray(d.path) ? d.path : [];
        if (coords.length < 2) return null;
        const line = d3.line()
          .x((point) => mapPoint(point[0], point[1])?.[0] ?? -999)
          .y((point) => mapPoint(point[0], point[1])?.[1] ?? -999);
        return line(coords);
      });

    selection.selectAll('title').data((d) => [d]).join('title').text((d) => (typeof getTitle === 'function' ? getTitle(d) : d.id));
    selection.exit().remove();
  }

  function renderStrategicRoutes(routes = [], { getClassName, getTitle } = {}) {
    if (!routesLayer) return;
    const selection = routesLayer.selectAll('path.strategic-route').data(routes, (d) => d.id);
    selection.enter().append('path').attr('class', 'strategic-route')
      .merge(selection)
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'strategic-route'))
      .attr('d', (d) => {
        const coords = Array.isArray(d.path) ? d.path : [];
        if (coords.length < 2) return null;
        const line = d3.line()
          .x((point) => mapPoint(point[0], point[1])?.[0] ?? -999)
          .y((point) => mapPoint(point[0], point[1])?.[1] ?? -999);
        return line(coords);
      });

    selection.selectAll('title').data((d) => [d]).join('title').text((d) => (typeof getTitle === 'function' ? getTitle(d) : d.id));
    selection.exit().remove();
  }

  function renderInfrastructure(nodes = [], { getClassName, getTitle, onClick } = {}) {
    if (!infrastructureLayer) return;
    const selection = infrastructureLayer.selectAll('path.infrastructure-point').data(nodes, (d) => d.id);
    const symbol = d3.symbol().type(d3.symbolDiamond).size(32);

    const enter = selection.enter().append('path').attr('class', 'infrastructure-point');
    enter.append('title');

    selection.merge(enter)
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'infrastructure-point'))
      .attr('transform', (d) => {
        const p = mapPoint(d.lonLat?.[0] ?? d.lon, d.lonLat?.[1] ?? d.lat);
        return `translate(${p?.[0] ?? -999}, ${p?.[1] ?? -999})`;
      })
      .attr('d', symbol)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (shouldIgnoreMapClick()) return;
        if (typeof onClick === 'function') onClick(event, d);
      });

    selection.merge(enter).select('title').text((d) => (typeof getTitle === 'function' ? getTitle(d) : d.name));
    selection.exit().remove();
  }

  function renderMilitarySites(sites = [], { getClassName, getTitle, onClick } = {}) {
    if (!militarySitesLayer) return;
    const selection = militarySitesLayer.selectAll('path.military-site-point').data(sites, (d) => d.id);
    const symbol = d3.symbol().type(d3.symbolTriangle).size(34);

    const enter = selection.enter().append('path').attr('class', 'military-site-point');
    enter.append('title');

    selection.merge(enter)
      .attr('class', (d) => (typeof getClassName === 'function' ? getClassName(d) : 'military-site-point'))
      .attr('transform', (d) => {
        const p = mapPoint(d.lonLat?.[0] ?? d.lon, d.lonLat?.[1] ?? d.lat);
        return `translate(${p?.[0] ?? -999}, ${p?.[1] ?? -999})`;
      })
      .attr('d', symbol)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (shouldIgnoreMapClick()) return;
        if (typeof onClick === 'function') onClick(event, d);
      });

    selection.merge(enter).select('title').text((d) => (typeof getTitle === 'function' ? getTitle(d) : d.name));
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
    svg.on('click', (event) => {
      if (shouldIgnoreMapClick()) return;
      if (typeof onMapClick === 'function') {
        onMapClick(event, { projection, countries: countriesData, getLonLatFromEvent });
      }
    });
    return { projection, countries: countriesData };
  }

  return {
    init,
    renderCountries,
    renderAdminBoundaries,
    renderStrategicRoutes,
    renderCities,
    renderInfrastructure,
    renderMilitarySites,
    renderBases,
    renderUnits,
    resetView,
    refreshSelection,
    getLonLatFromEvent,
    shouldIgnoreMapClick
  };
};
