// api/admin/linkedin-callback.js
export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET,
  });

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return res.status(500).json({ error: 'Token exchange failed', detail: tokenData });
  }

  // tokenData.access_token is what you need for LINKEDIN_ACCESS_TOKEN
  // Now fetch your URN using that token:
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();

  return res.status(200).json({
    access_token: tokenData.access_token,
    expires_in: tokenData.expires_in,
    person_urn: `urn:li:person:${profile.sub}`,
  });
}