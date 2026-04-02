window.createMenuController = function createMenuController({ overlays, onOverlayChange }) {
  let activeOverlay = null;

  function hideOverlays() {
    Object.values(overlays).forEach((panel) => panel && panel.classList.add('hidden'));
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

  return {
    hideOverlays,
    setOverlay,
    getActiveOverlay
  };
};
