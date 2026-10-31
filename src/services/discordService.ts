import dotenv from 'dotenv';

dotenv.config();

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

export const BOT_CONFIG = {
  username: 'Stay Trails Acquisition Bot',
  avatar_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=256&auto=format&fit=crop&q=80',
  footer_icon: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=64&auto=format&fit=crop&q=80',
  footer_text: 'Stay Trails Property Catalogue Acquisition • Indoira Ventures',
};

// Discord embed colors
export const EMBED_COLORS = {
  newLead: 0x10b981, // Emerald green
  contacted: 0x0284c7, // Sky blue
  interested: 0x6366f1, // Indigo
  detailsReceived: 0x8b5cf6, // Violet
  verified: 0xf59e0b, // Amber
  onboarded: 0x059669, // Deep emerald (celebration)
  rejected: 0xef4444, // Red
  scraper: 0x0ea5e9, // Cyan
  system: 0x64748b, // Slate
};

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
}

async function sendDiscordWebhook(embed: DiscordEmbed): Promise<boolean> {
  if (!webhookUrl) {
    return false;
  }

  try {
    const payload = {
      username: BOT_CONFIG.username,
      avatar_url: BOT_CONFIG.avatar_url,
      embeds: [
        {
          ...embed,
          footer: embed.footer || {
            text: BOT_CONFIG.footer_text,
            icon_url: BOT_CONFIG.footer_icon,
          },
          timestamp: embed.timestamp || new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok || res.status === 204;
  } catch (err) {
    console.warn('⚠️ Could not send Discord webhook alert:', err);
    return false;
  }
}

/**
 * 1. Alert for New Lead Discovered (Scraper or Manual)
 */
export async function notifyNewLead(lead: {
  id?: number | string;
  name: string;
  region: string;
  category: string;
  microLocation?: string;
  phone?: string;
  whatsapp?: string;
  rating?: number | string;
  reviewsCount?: number | string;
  googleMapsUrl?: string;
  source?: string;
  selectionRationale?: string;
}): Promise<boolean> {
  const fields: DiscordField[] = [
    { name: '📍 Region & Location', value: `${lead.region}${lead.microLocation ? ` • *${lead.microLocation}*` : ''}`, inline: true },
    { name: '🏷️ Category', value: lead.category, inline: true },
    { name: '📞 Contact / Phone', value: lead.phone ? `\`${lead.phone}\`` : '*Not available*', inline: true },
  ];

  if (lead.whatsapp) {
    const cleanPhone = lead.whatsapp.replace(/\D/g, '');
    fields.push({
      name: '💬 WhatsApp Direct',
      value: `[Open Chat (wa.me/91...)](https://wa.me/91${cleanPhone.slice(-10)})`,
      inline: true,
    });
  }

  if (lead.rating) {
    fields.push({
      name: '⭐ Rating & Reviews',
      value: `**${lead.rating}★** (${lead.reviewsCount || 0} reviews)`,
      inline: true,
    });
  }

  fields.push({
    name: '📥 Source',
    value: lead.source || 'Google Maps Scraper',
    inline: true,
  });

  if (lead.selectionRationale) {
    fields.push({
      name: '✨ Selection Rationale',
      value: lead.selectionRationale.slice(0, 500),
      inline: false,
    });
  }

  return sendDiscordWebhook({
    title: `🏔️ New Stay Cataloged: ${lead.name}`,
    url: lead.googleMapsUrl || undefined,
    description: `A new property was discovered and added to the **Stay Trails** acquisition pipeline.`,
    color: EMBED_COLORS.newLead,
    fields,
  });
}

/**
 * 2. Alert for Lead Status Change (e.g. Contacted, Interested, Onboarded)
 */
export async function notifyStatusChange(lead: {
  id: number | string;
  name: string;
  region: string;
  category: string;
  phone?: string;
}, oldStatus: string, newStatus: string): Promise<boolean> {
  let color = EMBED_COLORS.contacted;
  let statusEmoji = '🔄';

  if (newStatus === 'interested') {
    color = EMBED_COLORS.interested;
    statusEmoji = '🎯';
  } else if (newStatus === 'details_received') {
    color = EMBED_COLORS.detailsReceived;
    statusEmoji = '📋';
  } else if (newStatus === 'verified') {
    color = EMBED_COLORS.verified;
    statusEmoji = '✅';
  } else if (newStatus === 'onboarded') {
    color = EMBED_COLORS.onboarded;
    statusEmoji = '🎉';
  } else if (newStatus === 'rejected') {
    color = EMBED_COLORS.rejected;
    statusEmoji = '❌';
  }

  return sendDiscordWebhook({
    title: `${statusEmoji} Lead Status Advanced: ${lead.name}`,
    description: `Pipeline stage updated for property **#${lead.id}** (${lead.region} • ${lead.category}).`,
    color,
    fields: [
      { name: 'Previous Stage', value: `\`${oldStatus}\``, inline: true },
      { name: 'Current Stage', value: `**\`${newStatus.toUpperCase()}\`**`, inline: true },
      { name: 'Contact Phone', value: lead.phone ? `\`${lead.phone}\`` : '*N/A*', inline: true },
    ],
  });
}

/**
 * 3. Alert for Outreach Logged / WhatsApp Pitch Dispatched
 */
export async function notifyOutreachLogged(lead: {
  id: number | string;
  name: string;
  phone?: string;
  region: string;
}, details: {
  channel: string;
  language: string;
  templateName?: string;
  notes?: string;
}): Promise<boolean> {
  return sendDiscordWebhook({
    title: `💬 Outreach Initiated: ${lead.name}`,
    description: `Host pitch outreach logged via **${details.channel.toUpperCase()}** (${details.language.toUpperCase()}).`,
    color: EMBED_COLORS.contacted,
    fields: [
      { name: 'Lead ID', value: `#${lead.id}`, inline: true },
      { name: 'Region', value: lead.region, inline: true },
      { name: 'Recipient Phone', value: lead.phone ? `\`${lead.phone}\`` : '*N/A*', inline: true },
      { name: 'Pitch Template', value: details.templateName || 'Initial Partnership Pitch', inline: true },
      { name: 'Language', value: details.language.toUpperCase(), inline: true },
    ],
  });
}

/**
 * 4. Alert for Scraper Job Completion
 */
export async function notifyScraperFinished(stats: {
  query: string;
  totalFound: number;
  inserted: number;
  duplicates: number;
}): Promise<boolean> {
  return sendDiscordWebhook({
    title: `🤖 Google Maps Scrape Completed`,
    description: `Search query run finished: \`${stats.query}\``,
    color: EMBED_COLORS.scraper,
    fields: [
      { name: 'Total Evaluated', value: `${stats.totalFound}`, inline: true },
      { name: '✨ New Leads Added', value: `**+${stats.inserted}**`, inline: true },
      { name: '🔁 Deduplicated', value: `${stats.duplicates}`, inline: true },
    ],
  });
}

/**
 * 5. Alert for Inbound WhatsApp Host Reply
 */
export async function notifyInboundReply(lead: {
  id: number | string;
  name: string;
  phone?: string;
}, messageText: string, isInterested: boolean): Promise<boolean> {
  return sendDiscordWebhook({
    title: `${isInterested ? '🔥 Host Interested! Inbound Reply' : '📩 Inbound Host Reply'}`,
    description: `Message received from **${lead.name}** (Lead #${lead.id}).`,
    color: isInterested ? EMBED_COLORS.interested : EMBED_COLORS.contacted,
    fields: [
      { name: 'Message Content', value: `"${messageText.slice(0, 800)}"`, inline: false },
      { name: 'Host Phone', value: lead.phone ? `\`${lead.phone}\`` : '*N/A*', inline: true },
      { name: 'Auto-detected Intent', value: isInterested ? '✅ High Interest / Partnership' : 'ℹ️ General Reply', inline: true },
    ],
  });
}
