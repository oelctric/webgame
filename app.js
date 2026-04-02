// Thin bootstrap/orchestrator. Runtime/UI logic moved to focused modules.
(function bootstrapGeoCommand() {
  const runtimeFactory = window.createGeoCommandRuntime;
  if (typeof runtimeFactory !== 'function') {
    console.error('Geo Command runtime factory not found.');
    return;
  }
  const runtime = runtimeFactory();
  runtime.init();
})();
