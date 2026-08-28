// api/adsense-debug.js
// TEMPORARY - lists AdSense accounts visible to this token.
// Delete this file once adsense-report.js is confirmed working.

import { google } from 'googleapis';

export default async function handler(req, res) {
  const {
    ADSENSE_CLIENT_ID,
    ADSENSE_CLIENT_SECRET,
    ADSENSE_REFRESH_TOKEN,
  } = process.env;
 
  try {
    const oAuth2Client = new google.auth.OAuth2(ADSENSE_CLIENT_ID, ADSENSE_CLIENT_SECRET);
    oAuth2Client.setCredentials({ refresh_token: ADSENSE_REFRESH_TOKEN });

    const adsense = google.adsense({ version: 'v2', auth: oAuth2Client });

    const response = await adsense.accounts.list({});

    res.status(200).json({
      accounts: response.data.accounts || [],
      raw: response.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}