import dotenv from 'dotenv';
import { createBrowser, scrapeQuery } from './scraper/engine';
import { REGIONAL_QUERIES } from './scraper/queryCatalog';
import { findNextPriorityQuery } from './scraper/cronWorker';
import { notifyScraperFinished } from './services/discordService';
import { pool } from './db/client';

dotenv.config();

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { region?: string; category?: string; limit: number } = { limit: 8 };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) {
      options.region = args[++i];
    } else if (args[i] === '--category' && args[i + 1]) {
      options.category = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10) || 8;
    }
  }
  return options;
}

async function main() {
  console.log('🏔️ Stay Trails | Automated Google Maps Acquisition Runner');
  console.log('────────────────────────────────────────────────────────');

  const { region, category, limit } = parseArgs();
  let targetQuery: any = null;

  if (region && category) {
    targetQuery = REGIONAL_QUERIES.find(
      (q) =>
        q.region.toLowerCase() === region.toLowerCase() &&
        q.category.toLowerCase() === category.toLowerCase()
    );
    if (!targetQuery) {
      console.warn(`⚠️ No pre-configured query for ${region} - ${category}. Using fallback search.`);
      targetQuery = {
        region,
        category,
        microLocation: region,
        searchQuery: `${category} in ${region} North Bengal`,
      };
    }
  } else {
    console.log('🔍 Identifying highest deficit quota bucket in Neon Postgres...');
    targetQuery = await findNextPriorityQuery();
  }

  if (!targetQuery) {
    console.log('✨ All 425 catalogue target quotas have been satisfied! No deficit found.');
    process.exit(0);
  }

  console.log(`🎯 Target Query: "${targetQuery.searchQuery}"`);
  console.log(`📍 Region: ${targetQuery.region} | Category: ${targetQuery.category} | Batch Limit: ${limit}`);

  const startTime = Date.now();
  console.log('🚀 Launching headless Chromium browser...');
  const browser = await createBrowser();

  try {
    const result = await scrapeQuery(targetQuery, {
      maxResults: limit,
      browser,
      onLog: (msg) => console.log(`   [LOG] ${msg}`),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('────────────────────────────────────────────────────────');
    console.log(`✅ Scrape batch completed in ${elapsed}s!`);
    console.log(`📊 Found: ${result.totalFound} | Inserted: +${result.inserted} | Dupes: ${result.duplicates}`);

    await notifyScraperFinished({
      query: targetQuery.searchQuery,
      totalFound: result.totalFound,
      inserted: result.inserted,
      duplicates: result.duplicates,
    }).catch((err) => console.error('Discord notification failed:', err.message));

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Fatal error during scrape cycle:', err.message || err);
    process.exit(1);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error:', err);
  process.exit(1);
});
