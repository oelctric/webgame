window.createDomRefs = function createDomRefs(ids) {
  const refs = {};
  Object.entries(ids).forEach(([key, id]) => {
    refs[key] = document.getElementById(id);
  });
  return refs;
};

window.createGeoMenuRefs = function createGeoMenuRefs() {
  return window.createDomRefs({
    newSimulationBtn: 'newSimulationBtn',
    continueBtn: 'continueBtn',
    loadScenarioBtn: 'loadScenarioBtn',
    sandboxBtn: 'sandboxBtn',
    settingsBtn: 'settingsBtn',
    creditsBtn: 'creditsBtn',
    tutorialBtn: 'tutorialBtn',
    exitBtn: 'exitBtn',
    settingsBackBtn: 'settingsBackBtn',
    loadBackBtn: 'loadBackBtn',
    sandboxBackBtn: 'sandboxBackBtn',
    creditsBackBtn: 'creditsBackBtn',
    loadContinueBtn: 'loadContinueBtn',
    sandboxQuickStartBtn: 'sandboxQuickStartBtn',
    playBackBtn: 'playBackBtn',
    playNextBtn: 'playNextBtn'
  });
};
