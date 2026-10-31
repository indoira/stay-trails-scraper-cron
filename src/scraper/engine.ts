import puppeteer, { type Browser, type Page } from 'puppeteer';
import { type TargetQuery } from './queryCatalog';
import { checkDuplicate, normalizePhone, normalizePhoneForWhatsApp } from './deduplicator';
import { pool } from '../db/client';
import { notifyNewLead } from '../services/discordService';

export interface ScrapedProperty {
  name: string;
  region: string;
  microLocation: string;
  category: string;
  phone: string;
  phoneNormalized: string;
  googleMapsUrl: string;
  rating?: number;
  reviewsCount?: number;
  address?: string;
  selectionRationale: string;
  specs: Record<string, any>;
}

export interface ScrapeResult {
  totalFound: number;
  inserted: number;
  duplicates: number;
  skippedNoPhone: number;
  skippedNotLodging: number;
  properties: ScrapedProperty[];
  logs: string[];
}

const LODGING_KEYWORDS = [
  'homestay', 'home stay', 'farmstay', 'farm stay', 'estate', 'tea garden',
  'resort', 'cottage', 'cabin', 'lodge', 'retreat', 'guest house', 'guesthouse',
  'bed and breakfast', 'b&b', 'glamping', 'tent', 'camp', 'hotel', 'villa', 'inn', 'residency'
];

function isLodging(text: string): boolean {
  const lower = text.toLowerCase();
  return LODGING_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Detects OTA (Booking.com, Airbnb, Bluepillow) specific room-level card titles
 * such as "Sherpa Homestay - Double Room", "Live in Nature - Double Room", etc.
 * Google Maps vacation rental integration lists individual rooms that never have phone numbers.
 */
function isOtaRoomListing(title: string): boolean {
  return (
    /-\s*(?:deluxe\s+|standard\s+|budget\s+)?(?:double|twin|single|queen|king|quadruple|family)\s+room/i.test(title) ||
    /\b(?:1|2|3|4)\s+bedroom\s+(?:apartment|unit|house)\b/i.test(title) ||
    /room with (?:balcony|terrace|mountain view|private bathroom)/i.test(title) ||
    /\b(?:bed in \d|bunk bed)\b/i.test(title)
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createBrowser(): Promise<Browser> {
  return await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--lang=en-US,en',
    ],
  });
}

export async function scrapeQuery(
  query: TargetQuery,
  options: {
    maxResults?: number;
    browser?: Browser;
    onLog?: (msg: string) => void;
  } = {}
): Promise<ScrapeResult> {
  const maxResults = options.maxResults || 10;
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    if (options.onLog) options.onLog(msg);
  };

  const shouldCloseBrowser = !options.browser;
  const browser = options.browser || (await createBrowser());

  const result: ScrapeResult = {
    totalFound: 0,
    inserted: 0,
    duplicates: 0,
    skippedNoPhone: 0,
    skippedNotLodging: 0,
    properties: [],
    logs,
  };

  let page: Page | null = null;

  try {
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query.searchQuery)}`;
    log(`🔍 Navigating to Google Maps: "${query.searchQuery}"`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    // Check if directly redirected to a single place page
    const currentUrl = page.url();
    if (currentUrl.includes('/maps/place/')) {
      log(`📍 Direct place page detected`);
      const singleOutcome = await extractSinglePlaceDetails(page, query, currentUrl);
      if (singleOutcome.property) {
        await processAndSaveProperty(singleOutcome.property, result, log);
      }
      return result;
    }

    // Otherwise, wait for result cards
    try {
      await page.waitForSelector('a[href*="/maps/place/"], div[role="feed"]', { timeout: 10000 });
    } catch {
      log(`⚠️ No result cards found for "${query.searchQuery}"`);
      return result;
    }

    // Scroll results feed to load items
    await scrollFeed(page);

    // Extract links to all place items
    const placeLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      const seen = new Set<string>();
      const links: { title: string; url: string }[] = [];

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        const title = a.getAttribute('aria-label') || a.textContent?.trim() || '';
        // Extract clean place url
        const cleanUrl = href.split('?')[0];
        if (cleanUrl && !seen.has(cleanUrl) && title.length > 1) {
          seen.add(cleanUrl);
          links.push({ title, url: href });
        }
      }
      return links;
    });

    log(`📋 Found ${placeLinks.length} places in search results`);
    result.totalFound = placeLinks.length;

    // Filter out OTA room-level cards so we prioritize authentic business profiles with direct phone numbers
    const validPlaces = placeLinks.filter(item => !isOtaRoomListing(item.title));
    const candidatePool = validPlaces.length >= maxResults ? validPlaces : placeLinks;
    const targets = candidatePool.slice(0, maxResults);

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      if (!item) continue;
      log(`🔎 [${i + 1}/${targets.length}] Inspecting: "${item.title}"`);

      // Initial lodging check on name
      if (!isLodging(item.title + ' ' + query.category)) {
        log(`⏩ Skipping non-lodging: "${item.title}"`);
        result.skippedNotLodging++;
        continue;
      }

      // Check if it's an OTA room listing that somehow slipped through
      if (isOtaRoomListing(item.title)) {
        log(`⏩ Skipping OTA room-level card (no direct phone): "${item.title}"`);
        result.skippedNoPhone++;
        continue;
      }

      // Humanized delay between place visits
      await delay(1800 + Math.random() * 1200);

      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        try {
          await page.waitForSelector('h1, div[role="main"]', { timeout: 5000 });
        } catch {
          // ignore
        }
        await delay(1200);

        const outcome = await extractSinglePlaceDetails(page, query, item.url, item.title);
        if (!outcome.property) {
          if (outcome.status === 'no_phone') {
            log(`📞 Skipped (no direct phone number on Google Maps): "${item.title}"`);
            result.skippedNoPhone++;
          } else if (outcome.status === 'not_lodging') {
            log(`⏩ Skipped non-lodging: "${item.title}"`);
            result.skippedNotLodging++;
          } else {
            log(`⚠️ Could not extract details for: "${item.title}"`);
          }
          continue;
        }

        await processAndSaveProperty(outcome.property, result, log);
      } catch (err: any) {
        log(`⚠️ Error extracting ${item.title}: ${err.message}`);
      }
    }
  } catch (err: any) {
    log(`❌ Scraping error on "${query.searchQuery}": ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
    if (shouldCloseBrowser) await browser.close().catch(() => {});
  }

  log(`🏁 Completed query "${query.searchQuery}": ${result.inserted} added, ${result.duplicates} duplicate, ${result.skippedNoPhone} no-phone`);
  return result;
}

async function scrollFeed(page: Page) {
  try {
    const feed = await page.$('div[role="feed"]');
    if (feed) {
      for (let i = 0; i < 4; i++) {
        await feed.evaluate(el => (el.scrollTop += 1800));
        await delay(1000);
      }
    }
  } catch {
    // Scroll fallback
  }
}

interface ExtractionOutcome {
  property: ScrapedProperty | null;
  status: 'success' | 'no_phone' | 'invalid_phone' | 'not_lodging' | 'no_name';
}

async function extractSinglePlaceDetails(
  page: Page,
  query: TargetQuery,
  url: string,
  fallbackTitle?: string
): Promise<ExtractionOutcome> {
  const data = await page.evaluate((defaultName) => {
    // 1. Title
    const h1 = document.querySelector('h1')?.textContent?.trim();
    const name = h1 || defaultName || '';

    // 2. Rating & Review Count
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
    const rating = ratingEl ? parseFloat(ratingEl.textContent?.trim() || '0') : undefined;

    const reviewsEl = document.querySelector('div.F7nice span[aria-label*="reviews"], div.F7nice span:last-child');
    let reviewsCount: number | undefined;
    if (reviewsEl) {
      const match = reviewsEl.textContent?.match(/\d[\d,]*/);
      if (match) reviewsCount = parseInt(match[0].replace(/,/g, ''), 10);
    }

    // 3. Category / Subtitle
    const categoryBtn = document.querySelector('button[jsaction*="category"]')?.textContent?.trim();

    // 4. Phone Number
    let phone: string | undefined;
    const phoneBtn = document.querySelector(
      'button[data-tooltip="Copy phone number"], button[data-item-id*="phone:tel:"], a[href^="tel:"]'
    );
    if (phoneBtn) {
      const text = phoneBtn.getAttribute('aria-label') || phoneBtn.getAttribute('href') || phoneBtn.textContent || '';
      const match = text.match(/(?:phone:?\s*|tel:)?([+\d\s\(\)-]{10,})/i);
      if (match && match[1]) phone = match[1].trim();
    }

    // Fallback: search phone buttons across the side panel
    if (!phone) {
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of allButtons) {
        const aria = btn.getAttribute('aria-label') || '';
        const href = btn.getAttribute('href') || '';
        const itemId = btn.getAttribute('data-item-id') || '';
        if (aria.toLowerCase().includes('phone') || href.startsWith('tel:') || itemId.includes('phone')) {
          const match = (aria || href || btn.textContent || '').match(/(?:phone:?\s*|tel:)?([+\d\s\(\)-]{10,})/i);
          if (match && match[1]) {
            phone = match[1].trim();
            break;
          }
        }
      }
    }

    // 5. Address
    let address: string | undefined;
    const addressBtn = document.querySelector('button[data-tooltip="Copy address"], button[data-item-id="address"]');
    if (addressBtn) {
      address = addressBtn.getAttribute('aria-label')?.replace(/Address:\s*/i, '').trim() || addressBtn.textContent?.trim();
    }

    return {
      name,
      rating,
      reviewsCount,
      categoryBtn,
      phone,
      address,
    };
  }, fallbackTitle);

  if (!data.name) {
    return { property: null, status: 'no_name' };
  }

  if (!data.phone) {
    return { property: null, status: 'no_phone' };
  }

  const phoneNorm = normalizePhone(data.phone);
  if (!phoneNorm) {
    return { property: null, status: 'invalid_phone' };
  }

  // Double check lodging classification
  const fullText = `${data.name} ${data.categoryBtn || ''} ${query.category}`;
  if (!isLodging(fullText)) {
    return { property: null, status: 'not_lodging' };
  }

  const rationale = `Matched query "${query.searchQuery}" for ${query.region} (${query.microLocation}). Classified under "${data.categoryBtn || query.category}" with ${data.rating ? data.rating + '★' : 'unrated'} (${data.reviewsCount || 0} reviews).`;

  // Format WhatsApp number cleanly (e.g. 91XXXXXXXXXX)
  const whatsappNumber = normalizePhoneForWhatsApp(data.phone);

  return {
    status: 'success',
    property: {
      name: data.name,
      region: query.region,
      microLocation: query.microLocation,
      category: query.category,
      phone: data.phone,
      phoneNormalized: phoneNorm,
      googleMapsUrl: url,
      rating: data.rating,
      reviewsCount: data.reviewsCount,
      address: data.address,
      selectionRationale: rationale,
      specs: {
        rating: data.rating,
        reviewsCount: data.reviewsCount,
        address: data.address,
        googleCategory: data.categoryBtn,
        whatsappNumber,
        scrapedAt: new Date().toISOString(),
        sourceQuery: query.searchQuery,
      },
    },
  };
}

async function processAndSaveProperty(
  prop: ScrapedProperty,
  result: ScrapeResult,
  log: (msg: string) => void
): Promise<void> {
  // Check duplicates
  const dupCheck = await checkDuplicate(prop.name, prop.region, prop.phone, prop.googleMapsUrl);
  if (dupCheck.isDuplicate) {
    log(`🔁 Duplicate detected (${dupCheck.reason}): "${prop.name}" -> Skipped`);
    result.duplicates++;
    return;
  }

  // Insert Lead
  try {
    const whatsappClean = normalizePhoneForWhatsApp(prop.phone);
    const [insertResult] = await pool.query<any>(
      `INSERT INTO leads (
        name, region, micro_location, category, phone, phone_normalized, whatsapp,
        google_maps_url, rating, reviews_count, selection_rationale, specs, source, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Google Maps Scraper', 'discovered')`,
      [
        prop.name,
        prop.region,
        prop.microLocation,
        prop.category,
        prop.phone,
        prop.phoneNormalized,
        whatsappClean,
        prop.googleMapsUrl,
        prop.rating || null,
        prop.reviewsCount || null,
        prop.selectionRationale,
        JSON.stringify(prop.specs),
      ]
    );

    log(`✅ Successfully added [ID #${insertResult.insertId}]: "${prop.name}" (${prop.region} - ${prop.microLocation}) 📞 ${prop.phone}`);
    result.inserted++;
    result.properties.push(prop);

    // Dispatch Discord alert
    notifyNewLead({
      id: insertResult.insertId,
      name: prop.name,
      region: prop.region,
      microLocation: prop.microLocation,
      category: prop.category,
      phone: prop.phone,
      whatsapp: whatsappClean,
      rating: prop.rating,
      reviewsCount: prop.reviewsCount,
      googleMapsUrl: prop.googleMapsUrl,
      source: 'Google Maps Scraper',
      selectionRationale: prop.selectionRationale,
    }).catch(() => {});
  } catch (err: any) {
    log(`❌ Failed inserting "${prop.name}": ${err.message}`);
  }
}
