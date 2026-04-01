class TaskScheduler {
  constructor(gameState) {
    this.gameState = gameState;
    this.tasks = [];
    this.nextTaskId = 1;
  }

  schedule({ executeAt, type, payload, handler }) {
    const task = {
      id: this.nextTaskId++,
      executeAt,
      type,
      payload,
      handler
    };

    this.tasks.push(task);
    this.tasks.sort((a, b) => a.executeAt - b.executeAt || a.id - b.id);
    this.syncPendingTasks();
    return task.id;
  }

  processDue(currentTimeMs) {
    const dueTasks = [];
    while (this.tasks.length && this.tasks[0].executeAt <= currentTimeMs) {
      dueTasks.push(this.tasks.shift());
    }

    dueTasks.forEach((task) => task.handler(task.payload, task));
    this.syncPendingTasks();
  }

  syncPendingTasks() {
    this.gameState.pendingTasks = this.tasks.map((task) => ({
      id: task.id,
      type: task.type,
      executeAt: task.executeAt,
      payload: task.payload
    }));
  }
}
