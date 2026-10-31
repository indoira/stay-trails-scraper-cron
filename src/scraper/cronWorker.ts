import { scrapeQuery, createBrowser } from './engine';
import { REGIONAL_QUERIES } from './queryCatalog';
import { pool } from '../db/client';

let cronTimer: any = null;
let isRunningBatch = false;
let lastRunTime: string | null = null;
let totalCronInserted = 0;

export async function findNextPriorityQuery() {
  // Find region + category with the largest remaining quota deficit
  const [rows] = await pool.query<any[]>(`
    SELECT 
      q.region, 
      q.category, 
      q.target_count,
      COUNT(l.id) as current_count,
      (q.target_count - COUNT(l.id)) as deficit
    FROM quotas q
    LEFT JOIN leads l ON q.region = l.region AND q.category = l.category
    GROUP BY q.region, q.category, q.target_count
    HAVING (q.target_count - COUNT(l.id)) > 0
    ORDER BY deficit DESC
    LIMIT 5;
  `);

  if (rows.length === 0) return null;

  // Find a matching query from REGIONAL_QUERIES
  for (const row of rows) {
    const match = REGIONAL_QUERIES.find(
      q => q.region === row.region && q.category === row.category
    );
    if (match) return match;
  }

  return REGIONAL_QUERIES[0] || null;
}

export async function executePeriodicScrape(onLog?: (msg: string) => void) {
  if (isRunningBatch) {
    if (onLog) onLog('⏳ A scrape job is already active in background. Skipping cycle.');
    return;
  }

  isRunningBatch = true;
  lastRunTime = new Date().toISOString();

  try {
    const query = await findNextPriorityQuery();
    if (!query) {
      if (onLog) onLog('✨ All 425 property targets have been discovered! Cron idle.');
      return;
    }

    if (onLog) onLog(`🤖 [Scheduled Cron] Auto-targeting deficit in ${query.region} - ${query.category}`);

    const browser = await createBrowser();
    try {
      const res = await scrapeQuery(query, {
        maxResults: 6, // Small stealth batch
        browser,
        onLog,
      });

      totalCronInserted += res.inserted;
      if (onLog) onLog(`🤖 [Scheduled Cron] Cycle complete: +${res.inserted} new leads added (Total cron leads: ${totalCronInserted})`);
    } finally {
      await browser.close();
    }
  } catch (err: any) {
    if (onLog) onLog(`❌ [Scheduled Cron Error]: ${err.message}`);
  } finally {
    isRunningBatch = false;
  }
}

export function startPeriodicCron(intervalMinutes = 60, onLog?: (msg: string) => void) {
  if (cronTimer) {
    clearInterval(cronTimer);
  }

  const ms = intervalMinutes * 60 * 1000;
  cronTimer = setInterval(() => {
    executePeriodicScrape(onLog);
  }, ms);

  console.log(`⏱️ Periodic scraper cron scheduled to run every ${intervalMinutes} minutes`);
}

export function stopPeriodicCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
}

export function getCronStatus() {
  return {
    isActive: cronTimer !== null,
    isRunningBatch,
    lastRunTime,
    totalCronInserted,
  };
}
