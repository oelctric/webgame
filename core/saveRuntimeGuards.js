(function initGeoCommandSaveRuntimeGuards() {
  function sanitizeScheduledTasks(taskList, handlerMap) {
    const sanitizedTasks = [];
    let skippedUnknown = 0;
    let skippedInvalid = 0;

    (Array.isArray(taskList) ? taskList : []).forEach((task) => {
      if (!task || typeof task !== 'object') {
        skippedInvalid += 1;
        return;
      }
      const taskId = Number(task.id);
      const executeAt = Number(task.executeAt);
      if (!Number.isFinite(taskId) || !Number.isFinite(executeAt) || typeof task.type !== 'string' || !task.type) {
        skippedInvalid += 1;
        return;
      }
      if (!handlerMap[task.type]) {
        skippedUnknown += 1;
        return;
      }
      sanitizedTasks.push({
        id: taskId,
        executeAt,
        type: task.type,
        payload: task.payload && typeof task.payload === 'object' ? task.payload : {}
      });
    });

    sanitizedTasks.sort((a, b) => a.executeAt - b.executeAt || a.id - b.id);
    return {
      tasks: sanitizedTasks,
      report: {
        restored: sanitizedTasks.length,
        skippedUnknown,
        skippedInvalid
      }
    };
  }

  window.GeoCommandSaveRuntimeGuards = {
    sanitizeScheduledTasks
  };
})();
