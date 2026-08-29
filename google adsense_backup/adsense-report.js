// api/adsense-report.js
// Vercel serverless function — fetches AdSense report data server-side
// Usage from the dashboard:
//   GET /api/adsense-report?range=LAST_30_DAYS
//   range options: TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS, MONTH_TO_DATE, YEAR_TO_DATE

import { google } from 'googleapis';

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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

  const range = (req.query && req.query.range) || 'LAST_30_DAYS';
  const site = req.query && req.query.site;
  const siteFilters = site ? [`DOMAIN_NAME==${site}`] : [];
  const account = `accounts/${ADSENSE_ACCOUNT_ID}`;

  try {
    const oAuth2Client = new google.auth.OAuth2(ADSENSE_CLIENT_ID, ADSENSE_CLIENT_SECRET);
    oAuth2Client.setCredentials({ refresh_token: ADSENSE_REFRESH_TOKEN });

    const adsense = google.adsense({ version: 'v2', auth: oAuth2Client });

    const metrics = [
      'ESTIMATED_EARNINGS',
      'CLICKS',
      'IMPRESSIONS',
      'IMPRESSIONS_CTR',
      'IMPRESSIONS_RPM',
    ];

    // 1) Time series (also gives us totals for the summary cards)
    const timeSeriesResp = await adsense.accounts.reports.generate({
      account,
      dateRange: range,
      metrics,
      dimensions: ['DATE'],
      filters: siteFilters,
    });

    // 2) Breakdown by ad unit
    let byAdUnitRows = [];
    try {
      const adUnitResp = await adsense.accounts.reports.generate({
        account,
        dateRange: range,
        metrics,
        dimensions: ['AD_UNIT_NAME'],
        orderBy: ['-ESTIMATED_EARNINGS'],
        filters: siteFilters,
      });
      byAdUnitRows = adUnitResp.data.rows || [];
    } catch (e) {
      byAdUnitRows = [];
    }

    // 3) Breakdown by page (may be empty if page-level reporting isn't available)
    let byPageRows = [];
    try {
      const pageResp = await adsense.accounts.reports.generate({
        account,
        dateRange: range,
        metrics,
        dimensions: ['PAGE_URL'],
        orderBy: ['-ESTIMATED_EARNINGS'],
        filters: siteFilters,
      });
      byPageRows = pageResp.data.rows || [];
    } catch (e) {
      byPageRows = [];
    }

    const headers = (timeSeriesResp.data.headers || []).map((h) => h.name);
    const cellsToObj = (row) => {
      const obj = {};
      (row.cells || []).forEach((cell, i) => {
        obj[headers[i]] = cell.value;
      });
      return obj;
    };

    const rows = (timeSeriesResp.data.rows || []).map(cellsToObj);
    const totalsRow = timeSeriesResp.data.totals ? cellsToObj(timeSeriesResp.data.totals) : {};

    const num = (v) => (v === undefined || v === null ? 0 : parseFloat(v));

    const totals = {
      earnings: num(totalsRow.ESTIMATED_EARNINGS),
      clicks: num(totalsRow.CLICKS),
      impressions: num(totalsRow.IMPRESSIONS),
      ctr: num(totalsRow.IMPRESSIONS_CTR),
      rpm: num(totalsRow.IMPRESSIONS_RPM),
    };

    const timeSeries = rows.map((r) => ({
      date: r.DATE,
      earnings: num(r.ESTIMATED_EARNINGS),
      clicks: num(r.CLICKS),
      impressions: num(r.IMPRESSIONS),
    }));

    const adUnitHeaders = byAdUnitRows.length
      ? [] // headers same order as metrics/dimensions requested above
      : [];

    const mapBreakdownRows = (respRows, headerNames) =>
      respRows.map((row) => {
        const obj = {};
        (row.cells || []).forEach((cell, i) => {
          obj[headerNames[i]] = cell.value;
        });
        return {
          name: obj[headerNames[0]],
          earnings: num(obj.ESTIMATED_EARNINGS),
          clicks: num(obj.CLICKS),
          impressions: num(obj.IMPRESSIONS),
          ctr: num(obj.IMPRESSIONS_CTR),
          rpm: num(obj.IMPRESSIONS_RPM),
        };
      });

    const adUnitHeaderNames = ['AD_UNIT_NAME', ...metrics];
    const pageHeaderNames = ['PAGE_URL', ...metrics];

    const byAdUnit = mapBreakdownRows(byAdUnitRows, adUnitHeaderNames);
    const byPage = mapBreakdownRows(byPageRows, pageHeaderNames);

    res.status(200).json({
      range,
      totals,
      timeSeries,
      byAdUnit,
      byPage,
    });
  } catch (err) {
    console.error('AdSense API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch AdSense report', details: err.message });
  }
};