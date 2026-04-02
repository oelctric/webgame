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
  let summaryWatchersBound = false;

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

  function extractSummaryText(summaryIds = []) {
    return summaryIds
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' • ');
  }

  function refreshDrawerSummaries() {
    bottomDrawerContent.querySelectorAll('.drawer-subsection').forEach((section) => {
      const summaryIds = (section.dataset.summaryIds || '').split(',').map((id) => id.trim()).filter(Boolean);
      const summaryEl = section.querySelector('.drawer-subsection-summary');
      if (!summaryEl) return;
      const summary = extractSummaryText(summaryIds);
      summaryEl.textContent = summary || section.dataset.fallbackSummary || 'No active data yet.';
    });
  }

  function bindSummaryWatchers() {
    if (summaryWatchersBound) return;
    const ids = new Set();
    bottomDrawerContent.querySelectorAll('.drawer-subsection').forEach((section) => {
      (section.dataset.summaryIds || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => ids.add(id));
    });

    ids.forEach((id) => {
      const target = document.getElementById(id);
      if (!target) return;
      const observer = new MutationObserver(() => refreshDrawerSummaries());
      observer.observe(target, { characterData: true, childList: true, subtree: true });
    });

    summaryWatchersBound = true;
  }

  function createSubsection({ title, subtitle, cards, defaultOpen, summaryIds, fallbackSummary, helperText }) {
    const section = document.createElement('section');
    section.className = 'drawer-subsection';
    section.dataset.summaryIds = (summaryIds || []).join(',');
    section.dataset.fallbackSummary = fallbackSummary || '';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drawer-subsection-header';
    button.setAttribute('aria-expanded', String(Boolean(defaultOpen)));
    button.innerHTML = `
      <div class="drawer-subsection-heading-wrap">
        <strong>${title}</strong>
        ${subtitle ? `<span>${subtitle}</span>` : ''}
      </div>
      <span class="drawer-subsection-toggle" aria-hidden="true">▾</span>
    `;

    const summary = document.createElement('p');
    summary.className = 'drawer-subsection-summary';

    const body = document.createElement('div');
    body.className = 'drawer-subsection-body';
    if (!defaultOpen) body.classList.add('collapsed');

    if (helperText) {
      const helper = document.createElement('p');
      helper.className = 'drawer-subsection-helper';
      helper.textContent = helperText;
      body.appendChild(helper);
    }

    if (cards.length) {
      const cardGrid = document.createElement('div');
      cardGrid.className = 'subsection-card-grid';
      cards.forEach((card) => cardGrid.appendChild(card));
      body.appendChild(cardGrid);
    }

    button.addEventListener('click', () => {
      const isCollapsed = body.classList.toggle('collapsed');
      button.setAttribute('aria-expanded', String(!isCollapsed));
    });

    section.appendChild(button);
    section.appendChild(summary);
    section.appendChild(body);
    return section;
  }

  function organizePanels() {
    const cards = Array.from(document.querySelectorAll('.sidebar .card'));
    const byTitle = new Map(cards.map((card) => [card.querySelector('h2')?.textContent?.trim(), card]));
    const leftTitles = ['Geo Command', 'Simulation', 'Command Setup', 'Country Overview', 'Included Major Cities', 'Legend'];
    const rightTitles = ['Unit Orders', 'Base Production', 'Units', 'Diplomacy', 'Domestic Policy', 'Government Profile'];
    const tabs = [
      {
        name: 'World',
        sections: [
          {
            title: 'Diplomatic Posture',
            subtitle: 'Quick strategic pulse from active diplomacy controls',
            summaryIds: ['diplomacySummary', 'sanctionsStateLabel', 'tradeStateLabel'],
            fallbackSummary: 'Use the right panel Diplomacy card for immediate actions.',
            helperText: 'Immediate diplomatic actions stay in the right panel. Use these World sections for coalition and settlement management.',
            cards: [],
            defaultOpen: true
          },
          {
            title: 'Negotiated Settlement',
            subtitle: 'Ceasefires, deals, and de-escalation tools',
            summaryIds: ['negotiationSummary'],
            fallbackSummary: 'Negotiation channels are ready.',
            cards: ['Negotiated Resolution'],
            defaultOpen: true
          },
          {
            title: 'Blocs & Strategic Alignments',
            subtitle: 'Alliance architecture and coalition pressure',
            summaryIds: ['blocSummary', 'selectedCountryBlocs'],
            fallbackSummary: 'No active bloc context.',
            cards: ['Blocs & Coalitions'],
            defaultOpen: false
          }
        ]
      },
      {
        name: 'Internal',
        sections: [
          {
            title: 'Domestic Stability',
            subtitle: 'Macro social pressure and regime resilience',
            summaryIds: ['domesticStability', 'domesticUnrest', 'domesticTrend'],
            fallbackSummary: 'Domestic stability details available.',
            cards: ['Domestic State'],
            defaultOpen: true
          },
          {
            title: 'Leadership & Factions',
            subtitle: 'Power structure, succession, and elite balance',
            summaryIds: ['domesticLeadershipLabel', 'domesticFactionSummary', 'leaderDisplayName'],
            fallbackSummary: 'Leadership and faction management available.',
            helperText: 'Leadership and faction levers are grouped in Domestic Stability to keep the full internal power model in one place.',
            cards: [],
            defaultOpen: false
          },
          {
            title: 'Resistance & Regional Flashpoints',
            subtitle: 'Local instability, hotspots, and control erosion',
            summaryIds: ['resistanceStatus', 'resistanceHotspots', 'localHotspotSummary'],
            fallbackSummary: 'No severe flashpoints reported.',
            cards: ['Internal Resistance', 'Regional Hotspots'],
            defaultOpen: false
          },
          {
            title: 'Narrative Operations',
            subtitle: 'Information control, influence ops, and proxy leverage',
            summaryIds: ['infoLabel', 'infoInfluenceSummary', 'proxySummary'],
            fallbackSummary: 'Narrative and proxy channels standing by.',
            helperText: 'Narrative controls are here; active proxy conflict controls remain in Crises to keep escalation tools centralized.',
            cards: ['Information & Narrative'],
            defaultOpen: false
          },
          {
            title: 'Power Structure',
            subtitle: 'State model, autonomy, and emergency posture',
            summaryIds: ['stateStructureSummary', 'stateEmergencyLabel', 'stateTensionLabel'],
            fallbackSummary: 'State structure controls available.',
            cards: ['State Structure'],
            defaultOpen: false
          }
        ]
      },
      {
        name: 'Economy',
        sections: [
          {
            title: 'Trade & Flows',
            subtitle: 'Commerce throughput and bilateral routing',
            summaryIds: ['tradeSummary', 'tradeBalanceSummary'],
            fallbackSummary: 'Trade network is available for routing.',
            cards: ['Trade Network'],
            defaultOpen: true
          },
          {
            title: 'Migration Pressures',
            subtitle: 'Humanitarian stress and population movement',
            summaryIds: ['migrationSummary', 'migrationInflowLabel', 'migrationOutflowLabel'],
            fallbackSummary: 'No major migration crisis detected.',
            cards: ['Migration & Humanitarian Pressure'],
            defaultOpen: false
          },
          {
            title: 'Route Pressure & Chokepoints',
            subtitle: 'Maritime bottlenecks and disruption controls',
            summaryIds: ['chokepointSummary'],
            fallbackSummary: 'Route pressure controls available.',
            cards: ['Chokepoints & Route Pressure'],
            defaultOpen: false
          }
        ]
      },
      {
        name: 'Crises',
        sections: [
          {
            title: 'Live Events',
            subtitle: 'Trigger, monitor, and review crisis events',
            summaryIds: ['eventSummary'],
            fallbackSummary: 'No active major event context.',
            cards: ['Crisis & Events'],
            defaultOpen: true
          },
          {
            title: 'Escalation Channels',
            subtitle: 'Indirect conflict pressure and destabilization tools',
            summaryIds: ['proxySummary', 'resistanceImpact'],
            fallbackSummary: 'Escalation tools are idle.',
            cards: ['Proxy Conflict'],
            defaultOpen: false
          }
        ]
      },
      {
        name: 'Sandbox',
        sections: [
          {
            title: 'Simulation Controls',
            subtitle: 'Scenario-level tuning and monitoring',
            summaryIds: ['economySummary', 'status'],
            fallbackSummary: 'Use top HUD and right panel for immediate controls.',
            helperText: 'Sandbox currently routes most direct controls through HUD and context panels. This area remains your advanced console anchor for future system expansions.',
            cards: [],
            defaultOpen: true
          }
        ]
      }
    ];

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
    tabs.forEach((tab, idx) => {
      const btn = document.createElement('button');
      btn.textContent = tab.name;
      btn.className = idx === 0 ? 'active' : '';

      const pane = document.createElement('div');
      pane.className = `drawer-pane ${idx === 0 ? 'active' : ''}`;

      const paneStack = document.createElement('div');
      paneStack.className = 'pane-stack';

      tab.sections.forEach((sectionConfig) => {
        const sectionCards = (sectionConfig.cards || [])
          .map((title) => byTitle.get(title))
          .filter(Boolean)
          .map((card) => {
            card.classList.remove('hidden-panel');
            return card;
          });

        paneStack.appendChild(
          createSubsection({
            ...sectionConfig,
            cards: sectionCards
          })
        );
      });

      pane.appendChild(paneStack);

      btn.addEventListener('click', () => {
        bottomDrawerTabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        bottomDrawerContent.querySelectorAll('.drawer-pane').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        pane.classList.add('active');
      });

      bottomDrawerTabs.appendChild(btn);
      bottomDrawerContent.appendChild(pane);
    });

    refreshDrawerSummaries();
    bindSummaryWatchers();
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

    refreshDrawerSummaries();
    hudCurrentCountry.textContent = `Inspecting: ${gameState.selectedCountryForHud || '--'}`;
  }

  return {
    organizePanels,
    attachDrawerControls,
    updateContextActionPanels
  };
};
