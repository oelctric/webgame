window.createEventPanelController = function createEventPanelController(scope) {
  return (function buildEventPanelController() {
    with (scope) {
  function refreshEventHud() {
    const focusCountry = getDiplomacyFocusCountry();
    eventSummary.textContent = `Events: ${gameState.events.active.length} active globally`;
    const countryNames = Object.keys(gameState.countries).sort((a, b) => a.localeCompare(b));
    const previousPrimary = eventTargetCountry.value;
    const previousSecondary = eventSecondaryCountry.value;
    eventTargetCountry.innerHTML = '';
    eventSecondaryCountry.innerHTML = '<option value="">None</option>';
    countryNames.forEach((name) => {
      const optA = document.createElement('option');
      optA.value = name;
      optA.textContent = name;
      eventTargetCountry.appendChild(optA);
      const optB = document.createElement('option');
      optB.value = name;
      optB.textContent = name;
      eventSecondaryCountry.appendChild(optB);
    });
    if (previousPrimary && countryNames.includes(previousPrimary)) eventTargetCountry.value = previousPrimary;
    if (previousSecondary && countryNames.includes(previousSecondary)) eventSecondaryCountry.value = previousSecondary;
  
    const active = focusCountry ? eventSystem.getActiveEventsForCountry(focusCountry) : [];
    activeEventsList.innerHTML = '';
    if (!active.length) {
      activeEventsList.innerHTML = '<li>No active events.</li>';
    } else {
      active.forEach((event) => {
        const li = document.createElement('li');
        const remainingDays = Math.max(0, (event.endTime - gameState.currentTimeMs) / DAY_MS).toFixed(1);
        const chokepointTag = event.targetChokepointId ? ` • chokepoint ${event.targetChokepointId}` : '';
        li.textContent = `${event.title} (${remainingDays} days left)${chokepointTag}`;
        activeEventsList.appendChild(li);
      });
    }
  
    eventLogList.innerHTML = '';
    if (!gameState.events.recentLog.length) {
      eventLogList.innerHTML = '<li>No events logged.</li>';
    } else {
      gameState.events.recentLog.slice(0, 8).forEach((entry) => {
        const li = document.createElement('li');
        li.textContent = `${formatDateTime(entry.at)}: ${entry.message}`;
        eventLogList.appendChild(li);
      });
    }
  }

  function attachEventControls() {
    triggerEventBtn.addEventListener('click', () => {
      const type = eventTypeSelect.value;
      const primary = eventTargetCountry.value;
      const secondary = eventSecondaryCountry.value;
      if (!primary) {
        setStatus('Select a target country for the event.', true);
        return;
      }
      let created = null;
      if (type === 'border_incident') {
        if (!secondary || secondary === primary) {
          setStatus('Border incident requires two different countries.', true);
          return;
        }
        created = eventSystem.createEvent(type, { targetCountryIds: [primary, secondary] });
      } else if (type === 'chokepoint_disruption') {
        const chokepointId = chokepointSelect.value;
        if (!chokepointId) {
          setStatus('Select a chokepoint before triggering chokepoint disruption.', true);
          return;
        }
        created = eventSystem.createEvent(type, { targetCountryId: primary, targetChokepointId: chokepointId });
      } else {
        created = eventSystem.createEvent(type, { targetCountryId: primary });
      }
      if (!created) {
        setStatus('Event not created (duplicate active event or invalid target).', true);
        return;
      }
      refreshEventHud();
    });
  }

      return {
        refresh: refreshEventHud,
        bind: attachEventControls
      };
    }
  }());
};
