// api/analytics-realtime.js
// Returns current active users and which pages they're on, via GA4 Realtime Reporting API.

import { BetaAnalyticsDataClient } from '@google-analytics/data';

let analyticsDataClient;

function getClient() {
  if (!analyticsDataClient) {
    const credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON);
    analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
  }
  return analyticsDataClient;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = getClient();
    const propertyId = process.env.GA_PROPERTY_ID;

    const [pageReport] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
      dimensions: [{ name: 'unifiedScreenName' }], // page title/screen name
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const [locationReport] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
      dimensions: [{ name: 'countryId' }, { name: 'country' }, { name: 'city' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const totalActiveUsers = (pageReport.rows || []).reduce(
      (sum, row) => sum + Number(row.metricValues[0].value),
      0
    );

    const byPage = (pageReport.rows || []).map((row) => ({
      page: row.dimensionValues[0].value || '(not set)',
      activeUsers: Number(row.metricValues[0].value),
    }));

    const byLocation = (locationReport.rows || []).map((row) => ({
      countryId: row.dimensionValues[0].value || '',
      country: row.dimensionValues[1].value || 'Unknown',
      city: row.dimensionValues[2].value || 'Unknown',
      activeUsers: Number(row.metricValues[0].value),
    }));

    // Aggregate by country for the map (city-level rows can duplicate a country)
    const byCountry = {};
    byLocation.forEach(({ countryId, country, activeUsers }) => {
      if (!countryId) return;
      if (!byCountry[countryId]) byCountry[countryId] = { country, activeUsers: 0 };
      byCountry[countryId].activeUsers += activeUsers;
    });

    res.status(200).json({ totalActiveUsers, byPage, byLocation, byCountry, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('GA4 realtime fetch failed:', err);
    res.status(500).json({ error: 'Could not fetch realtime data' });
  }
}