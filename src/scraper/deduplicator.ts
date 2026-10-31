import { pool } from '../db/client';

export function normalizePhone(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  // Remove non-digit characters
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length < 10) return null;

  // Take the last 10 digits for Indian mobile numbers
  const normalized = digits.slice(-10);
  if (normalized.length === 10) {
    return normalized;
  }
  return null;
}

export function normalizePhoneForWhatsApp(phoneNumber: string): string {
  if (!phoneNumber) return '';
  let cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length === 10) {
    return '91' + cleaned;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  return cleaned;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'phone' | 'maps_url' | 'name_and_location';
  matchedLeadId?: number;
}

export async function checkDuplicate(
  name: string,
  region: string,
  rawPhone?: string,
  googleMapsUrl?: string
): Promise<DuplicateCheckResult> {
  const normalizedPhone = normalizePhone(rawPhone);

  // 1. Check by Normalized Phone
  if (normalizedPhone) {
    const [rows] = await pool.query<any[]>(
      `SELECT id FROM leads WHERE phone_normalized = ? OR phone LIKE ? LIMIT 1`,
      [normalizedPhone, `%${normalizedPhone}%`]
    );
    if (rows && rows.length > 0 && rows[0]) {
      return { isDuplicate: true, reason: 'phone', matchedLeadId: rows[0].id };
    }
  }

  // 2. Check by Google Maps URL
  if (googleMapsUrl && googleMapsUrl.length > 15) {
    const [rows] = await pool.query<any[]>(
      `SELECT id FROM leads WHERE google_maps_url = ? LIMIT 1`,
      [googleMapsUrl]
    );
    if (rows && rows.length > 0 && rows[0]) {
      return { isDuplicate: true, reason: 'maps_url', matchedLeadId: rows[0].id };
    }
  }

  // 3. Check by Normalized Name + Region
  const cleanName = normalizeName(name);
  if (cleanName.length > 3) {
    const [rows] = await pool.query<any[]>(
      `SELECT id, name FROM leads WHERE region = ? LIMIT 200`,
      [region]
    );

    if (rows) {
      for (const r of rows) {
        const existingClean = normalizeName(r.name);
        if (existingClean === cleanName || existingClean.includes(cleanName) || cleanName.includes(existingClean)) {
          return { isDuplicate: true, reason: 'name_and_location', matchedLeadId: r.id };
        }
      }
    }
  }

  return { isDuplicate: false };
}
