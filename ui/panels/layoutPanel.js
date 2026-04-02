window.createLayoutPanelController = function createLayoutPanelController({
  rightPanel,
  bottomDrawer,
  bottomDrawerTabs,
  bottomDrawerContent,
  toggleDrawerBtn,
  hudCurrentCountry,
  gameState
}) {
  let contextCard = null;

  function getRightCard(title) {
    return Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === title);
  }

  function ensureContextCard() {
    if (contextCard) return contextCard;
    contextCard = document.createElement('section');
    contextCard.className = 'card context-card compact';
    contextCard.id = 'commandContextCard';
    contextCard.innerHTML = `
      <h2>Command Focus</h2>
      <p class="context-kicker" id="contextKicker">Overview</p>
      <p class="context-main" id="contextMain">Select a country, base, or unit to focus your command panel.</p>
      <p class="context-sub" id="contextSub">Tip: use the map to inspect assets, then open Advanced Systems for deeper controls.</p>
    `;
    rightPanel.prepend(contextCard);
    return contextCard;
  }

  function organizePanels() {
    const cards = Array.from(document.querySelectorAll('.sidebar .card'));
    const byTitle = new Map(cards.map((card) => [card.querySelector('h2')?.textContent?.trim(), card]));
    const leftTitles = ['Geo Command', 'Simulation', 'Command Setup', 'Country Overview', 'Included Major Cities', 'Legend'];
    const rightTitles = ['Unit Orders', 'Base Production', 'Units', 'Diplomacy', 'Domestic Policy', 'Government Profile'];
    const tabs = {
      World: ['Blocs & Coalitions', 'Negotiated Resolution'],
      Internal: ['Domestic State', 'State Structure', 'Information & Narrative', 'Internal Resistance', 'Regional Hotspots'],
      Economy: ['Trade Network', 'Migration & Humanitarian Pressure', 'Chokepoints & Route Pressure'],
      Crises: ['Crisis & Events', 'Proxy Conflict'],
      Sandbox: []
    };

    cards.forEach((card) => card.classList.add('hidden-panel'));
    leftTitles.forEach((title) => byTitle.get(title)?.classList.remove('hidden-panel'));
    rightTitles.forEach((title) => {
      const card = byTitle.get(title);
      if (card) {
        card.classList.remove('hidden-panel');
        rightPanel.appendChild(card);
      }
    });

    ensureContextCard();

    bottomDrawerTabs.innerHTML = '';
    bottomDrawerContent.innerHTML = '';
    Object.entries(tabs).forEach(([tabName, titles], idx) => {
      const btn = document.createElement('button');
      btn.textContent = tabName;
      btn.className = idx === 0 ? 'active' : '';
      const pane = document.createElement('div');
      pane.className = `drawer-pane ${idx === 0 ? 'active' : ''}`;
      const grid = document.createElement('div');
      grid.className = 'pane-grid';
      titles.forEach((title) => {
        const card = byTitle.get(title);
        if (card) {
          card.classList.remove('hidden-panel');
          grid.appendChild(card);
        }
      });
      pane.appendChild(grid);
      btn.addEventListener('click', () => {
        bottomDrawerTabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        bottomDrawerContent.querySelectorAll('.drawer-pane').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        pane.classList.add('active');
      });
      bottomDrawerTabs.appendChild(btn);
      bottomDrawerContent.appendChild(pane);
    });
  }

  function setDrawerCollapsed(collapsed) {
    if (!bottomDrawer || !toggleDrawerBtn) return;
    bottomDrawer.classList.toggle('collapsed', collapsed);
    toggleDrawerBtn.textContent = collapsed ? 'Open Systems Drawer' : 'Close Systems Drawer';
    toggleDrawerBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  function attachDrawerControls() {
    if (!toggleDrawerBtn) return;
    setDrawerCollapsed(true);
    toggleDrawerBtn.addEventListener('click', () => {
      const collapsed = bottomDrawer.classList.contains('collapsed');
      setDrawerCollapsed(!collapsed);
    });
  }

  function updateContextActionPanels() {
    const unitOrdersCard = getRightCard('Unit Orders');
    const productionCard = getRightCard('Base Production');
    const diplomacyCard = getRightCard('Diplomacy');
    const hasUnit = Boolean(gameState.selectedUnitId);
    const hasBase = Boolean(gameState.selectedBaseId);
    const hasCountry = Boolean(gameState.selectedCountryForHud);

    if (unitOrdersCard) unitOrdersCard.style.order = hasUnit ? '0' : '2';
    if (productionCard) productionCard.style.order = hasBase ? '0' : '2';
    if (diplomacyCard) diplomacyCard.style.order = hasCountry ? '1' : '3';

    const card = ensureContextCard();
    const kicker = card.querySelector('#contextKicker');
    const main = card.querySelector('#contextMain');
    const sub = card.querySelector('#contextSub');

    if (hasUnit) {
      kicker.textContent = 'Unit Command';
      main.textContent = `Unit #${gameState.selectedUnitId} selected. Prioritize move, attack, and capture orders.`;
      sub.textContent = hasBase
        ? `Base #${gameState.selectedBaseId} is also selected for production support.`
        : 'Tip: choose a base to coordinate reinforcements.';
    } else if (hasBase) {
      kicker.textContent = 'Base Command';
      main.textContent = `Base #${gameState.selectedBaseId} selected. Production and queue controls are now prioritized.`;
      sub.textContent = 'Tip: select a unit from the map to chain production with frontline operations.';
    } else if (hasCountry) {
      kicker.textContent = 'Country Command';
      main.textContent = `${gameState.selectedCountryForHud} is in focus. Diplomacy and national controls are prioritized.`;
      sub.textContent = 'Tip: use the map to select a base or unit for tactical actions.';
    } else {
      kicker.textContent = 'Overview';
      main.textContent = 'No active selection. Choose a country, unit, or base on the map to open contextual actions.';
      sub.textContent = 'The drawer holds advanced systems; keep it collapsed for a cleaner command view.';
    }

    hudCurrentCountry.textContent = `Inspecting: ${gameState.selectedCountryForHud || '--'}`;
  }

  return {
    organizePanels,
    attachDrawerControls,
    updateContextActionPanels
  };
};
