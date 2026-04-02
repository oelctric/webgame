import { chromium } from 'playwright';

const SMOKE_URL = process.env.PERSISTENCE_SMOKE_URL || 'http://127.0.0.1:8080/tests/persistence-smoke.html?ci=1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  console.log(`[browser:${msg.type()}] ${msg.text()}`);
});

try {
  await page.goto(SMOKE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERSISTENCE_SMOKE_DONE === true, { timeout: 60000 });

  const results = await page.evaluate(() => window.__PERSISTENCE_SMOKE_RESULTS);
  if (!results || results.error) {
    throw new Error(`Smoke harness returned error: ${results?.error || 'unknown error'}`);
  }

  console.log('Fixture expectation report:');
  for (const row of results.results) {
    console.log(`- ${row.fixture}: expected=${row.expected} actual=${row.actual} migration=${row.phases.migration.ok} normalize=${row.phases.normalization.ok} validation=${row.phases.validation.ok} runtime=${row.phases.runtime.ok} schedulerSkipped=${row.phases.scheduler.skippedTaskCount} uiRefresh=${row.phases.uiRefresh.ok} error=${row.error || row.restoreMessage || row.phases.validation.message || row.phases.runtime.message || ''}`);
  }

  if (results.mismatches > 0) {
    throw new Error(`Fixture classification mismatch count: ${results.mismatches}`);
  }

  console.log(`Persistence smoke passed (${results.total} fixtures).`);
} finally {
  await browser.close();
}
