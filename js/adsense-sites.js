// api/adsense-sites.js
// Vercel serverless function — lists real AdSense sites via accounts.sites.list()

import { google } from 'googleapis';

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const {
    ADSENSE_CLIENT_ID,
    ADSENSE_CLIENT_SECRET,
    ADSENSE_REFRESH_TOKEN,
    ADSENSE_ACCOUNT_ID,
  } = process.env;

  if (!ADSENSE_CLIENT_ID || !ADSENSE_CLIENT_SECRET || !ADSENSE_REFRESH_TOKEN || !ADSENSE_ACCOUNT_ID) {
    res.status(500).json({ error: 'Missing AdSense environment variables on the server.' });
    return;
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(ADSENSE_CLIENT_ID, ADSENSE_CLIENT_SECRET);
    oAuth2Client.setCredentials({ refresh_token: ADSENSE_REFRESH_TOKEN });
    const adsense = google.adsense({ version: 'v2', auth: oAuth2Client });

    const resp = await adsense.accounts.sites.list({
      parent: `accounts/${ADSENSE_ACCOUNT_ID}`,
    });

    const sites = (resp.data.sites || []).map((s) => ({
      domain: s.domain,
      state: s.state,
      autoAdsEnabled: !!s.autoAdsEnabled,
    }));

    res.status(200).json({ sites });
  } catch (err) {
    console.error('AdSense sites API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch AdSense sites', details: err.message });
  }
};