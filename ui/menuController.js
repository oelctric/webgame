window.createMenuController = function createMenuController({
  overlays,
  menuButtons,
  menuPreviewData,
  setPreview,
  onNewSimulation,
  onContinue,
  onPlayBack,
  onPlayNext,
  onTutorial,
  onExit,
  onSandboxQuickStart,
  onOverlayChange,
  resetPlayFlow
}) {
  let activeOverlay = null;

  function hideOverlays() {
    Object.values(overlays).forEach((panel) => panel && panel.classList.add('hidden'));
    activeOverlay = null;
  }

  function setOverlay(name) {
    hideOverlays();
    const panel = overlays[name];
    if (panel) panel.classList.remove('hidden');
    activeOverlay = name;
    if (typeof onOverlayChange === 'function') onOverlayChange(name);
  }

  function getActiveOverlay() {
    return activeOverlay;
  }

  function wireMenuPreview() {
    menuButtons.forEach((btn) => {
      const previewKey = btn.dataset.preview;
      const activate = () => {
        menuButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === btn));
        if (previewKey && typeof setPreview === 'function') setPreview(previewKey, menuPreviewData);
      };
      btn.addEventListener('mouseenter', activate);
      btn.addEventListener('focus', activate);
    });
    if (typeof setPreview === 'function') setPreview('newSimulation', menuPreviewData);
  }

  function bindPlayFlow(els) {
    els.newSimulationBtn?.addEventListener('click', () => {
      if (typeof resetPlayFlow === 'function') resetPlayFlow();
      if (typeof onNewSimulation === 'function') onNewSimulation();
      setOverlay('playFlow');
    });
    els.continueBtn?.addEventListener('click', () => typeof onContinue === 'function' && onContinue({ hideOverlays }));
    els.loadScenarioBtn?.addEventListener('click', () => setOverlay('loadPanel'));
    els.sandboxBtn?.addEventListener('click', () => setOverlay('sandboxPanel'));
    els.settingsBtn?.addEventListener('click', () => setOverlay('settingsPanel'));
    els.creditsBtn?.addEventListener('click', () => setOverlay('creditsPanel'));
    els.tutorialBtn?.addEventListener('click', () => typeof onTutorial === 'function' && onTutorial());
    els.exitBtn?.addEventListener('click', () => typeof onExit === 'function' && onExit());

    els.settingsBackBtn?.addEventListener('click', () => setOverlay('mainMenu'));
    els.loadBackBtn?.addEventListener('click', () => setOverlay('mainMenu'));
    els.sandboxBackBtn?.addEventListener('click', () => setOverlay('mainMenu'));
    els.creditsBackBtn?.addEventListener('click', () => setOverlay('mainMenu'));
    els.loadContinueBtn?.addEventListener('click', () => els.continueBtn?.click());
    els.sandboxQuickStartBtn?.addEventListener('click', () => typeof onSandboxQuickStart === 'function' && onSandboxQuickStart());

    els.playBackBtn?.addEventListener('click', () => typeof onPlayBack === 'function' && onPlayBack({ setOverlay }));
    els.playNextBtn?.addEventListener('click', () => typeof onPlayNext === 'function' && onPlayNext({ hideOverlays }));
  }

  return {
    hideOverlays,
    setOverlay,
    getActiveOverlay,
    wireMenuPreview,
    bindPlayFlow
  };
};
