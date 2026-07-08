// api/analytics.js
// Returns 30-day active users from GA4 for the admin dashboard.

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
  // CORS — allow calls from your Firebase Hosting admin dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = getClient();
    const propertyId = process.env.GA_PROPERTY_ID;

    const [summary] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    });
    const visitors = Number(summary.rows?.[0]?.metricValues?.[0]?.value || 0);

    // GA4 only accepts YYYY-MM-DD, NdaysAgo, yesterday, or today — no NmonthsAgo.
    const [monthly] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '243daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'yearMonth' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    });

    const monthlyVisitors = (monthly.rows || []).map((row) => ({
      yearMonth: row.dimensionValues[0].value, // e.g. "202607"
      visitors: Number(row.metricValues[0].value),
    }));

    res.status(200).json({ visitors, monthlyVisitors, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('GA4 analytics fetch failed:', err);
    res.status(500).json({ error: 'Could not fetch analytics data' });
  }
}