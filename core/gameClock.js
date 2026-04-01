class GameClock {
  constructor({ startTimeMs, speed = 1 }) {
    this.currentTimeMs = startTimeMs;
    this.speed = speed;
  }

  pause() {
    this.speed = 0;
  }

  resume() {
    if (this.speed === 0) this.speed = 1;
  }

  setSpeed(multiplier) {
    this.speed = Math.max(0, Number(multiplier) || 0);
  }

  getCurrentTime() {
    return this.currentTimeMs;
  }

  advanceBy(realDeltaMs) {
    const safeDelta = Math.max(0, realDeltaMs || 0);
    const gameDelta = safeDelta * this.speed * GAME_TIME_SCALE;
    this.currentTimeMs += gameDelta;
    return gameDelta;
  }

  update(realDeltaMs) {
    return this.advanceBy(realDeltaMs);
  }

  skipGameTime(gameDeltaMs) {
    const safeDelta = Math.max(0, gameDeltaMs || 0);
    this.currentTimeMs += safeDelta;
    return safeDelta;
  }
}
