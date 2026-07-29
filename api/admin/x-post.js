// api/admin/x-post.js
// This endpoint supports two actions:
// - "generate": Takes a prompt, returns an AI-written X (Twitter) post.
// - "post": Takes the final text and publishes it to X.
// Both require a valid Firebase Auth token for admin access.

import crypto from 'crypto';
import { verifyIdToken } from '../../lib/firebaseAdmin.js';

// ---------- X (Twitter) OAuth 1.0a signing ----------
// X's v2 tweet-creation endpoint requires OAuth 1.0a user-context signing
// (there's no simple Bearer-token option for posting on a user's behalf).
// This builds the signature by hand since no OAuth library is in use
// elsewhere in this project.
function oauthPercentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildOAuthHeader({ method, url, apiKey, apiSecret, accessToken, accessSecret }) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // For a JSON POST body (not form-encoded params), only the oauth_* params
  // themselves are included in the signature base string.
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${oauthPercentEncode(key)}=${oauthPercentEncode(oauthParams[key])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    oauthPercentEncode(url),
    oauthPercentEncode(sortedParams),
  ].join('&');

  const signingKey = `${oauthPercentEncode(apiSecret)}&${oauthPercentEncode(accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString = Object.keys(headerParams)
    .sort()
    .map((key) => `${oauthPercentEncode(key)}="${oauthPercentEncode(headerParams[key])}"`)
    .join(', ');

  return `OAuth ${headerString}`;
}

// ---------- X API helper ----------
async function createXPost(text) {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X (Twitter) credentials not configured');
  }

  const url = 'https://api.twitter.com/2/tweets';
  const authHeader = buildOAuthHeader({
    method: 'POST',
    url,
    apiKey,
    apiSecret,
    accessToken,
    accessSecret,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.detail || data?.title || JSON.stringify(data);
    throw new Error(`X API error (${res.status}): ${message}`);
  }

  return data.data; // { id, text }
}

// ---------- Groq helper ----------
async function generatePost(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional social media copywriter for a multi-sector African enterprise group (Marvini Elite Enterprises). Write concise, punchy X (Twitter) posts under 280 characters. When the prompt includes specific details (dates, times, venues, figures), include them exactly as given — never alter, round, or omit them. Use at most 1-2 relevant hashtags. Avoid markdown, just plain text.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  const cleaned = typeof content === 'string' ? content.trim() : '';
  if (!cleaned || /^(undefined|null)$/i.test(cleaned)) {
    throw new Error('Groq returned no usable content — try regenerating');
  }
  return cleaned;
}

// ---------- Main handler ----------
export default async function handler(req, res) {
  // ---------- CORS ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify admin authentication
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // 2. Determine action
  const { action, prompt, text } = req.body;

  if (action === 'generate') {
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required for generate action' });
    }

    try {
      const generatedText = await generatePost(prompt);
      return res.status(200).json({
        success: true,
        generatedText,
      });
    } catch (err) {
      console.error('Generate error:', err);
      return res.status(500).json({ error: err.message });
    }

  } else if (action === 'post') {
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for post action' });
    }
    if (text.length > 280) {
      return res.status(400).json({ error: 'Text exceeds 280 characters' });
    }

    try {
      const result = await createXPost(text);
      const postUrl = `https://x.com/i/web/status/${result.id}`;
      return res.status(200).json({
        success: true,
        postUrl,
        id: result.id,
      });
    } catch (err) {
      console.error('Post error:', err);
      return res.status(500).json({ error: err.message });
    }

  } else {
    return res.status(400).json({ error: 'Invalid action. Use "generate" or "post".' });
  }
}