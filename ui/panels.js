window.createPanelsController = function createPanelsController({ refreshers = {}, binders = {} } = {}) {
  function bindAll() {
    Object.values(binders).forEach((bind) => {
      if (typeof bind === 'function') bind();
    });
  }

  function refreshAll() {
    Object.values(refreshers).forEach((refresh) => {
      if (typeof refresh === 'function') refresh();
    });
  }

  return { bindAll, refreshAll };
};
