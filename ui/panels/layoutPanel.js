window.createLayoutPanelController = function createLayoutPanelController({
  rightPanel,
  bottomDrawer,
  bottomDrawerTabs,
  bottomDrawerContent,
  toggleDrawerBtn,
  hudCurrentCountry,
  gameState
}) {
  function organizePanels() {
    const cards = Array.from(document.querySelectorAll('.sidebar .card'));
    const byTitle = new Map(cards.map((card) => [card.querySelector('h2')?.textContent?.trim(), card]));
    const leftTitles = ['Geo Command', 'Simulation', 'Build Mode', 'Country State', 'Included Major Cities', 'Legend'];
    const rightTitles = ['Unit Orders', 'Base Production', 'Units', 'Domestic Policy', 'Government Profile', 'Diplomacy'];
    const tabs = {
      World: ['Blocs & Coalitions', 'Negotiated Resolution'],
      Systems: ['Domestic State', 'Information & Narrative', 'Internal Resistance'],
      Economy: ['Trade Network', 'Migration & Humanitarian Pressure'],
      Crises: ['Crisis & Events'],
      Sandbox: ['Chokepoints & Route Pressure']
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
    toggleDrawerBtn.textContent = collapsed ? 'Open Drawer' : 'Close Drawer';
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
    const unitOrdersCard = Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === 'Unit Orders');
    const productionCard = Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === 'Base Production');
    const diplomacyCard = Array.from(rightPanel.querySelectorAll('.card')).find((card) => card.querySelector('h2')?.textContent.trim() === 'Diplomacy');
    const hasUnit = Boolean(gameState.selectedUnitId);
    const hasBase = Boolean(gameState.selectedBaseId);
    const hasCountry = Boolean(gameState.selectedCountryForHud);
    if (unitOrdersCard) unitOrdersCard.style.display = hasUnit ? '' : 'none';
    if (productionCard) productionCard.style.display = hasBase ? '' : 'none';
    if (diplomacyCard) diplomacyCard.style.display = hasCountry ? '' : 'none';
    hudCurrentCountry.textContent = `Country: ${gameState.selectedCountryForHud || '--'}`;
  }

  return {
    organizePanels,
    attachDrawerControls,
    updateContextActionPanels
  };
};
