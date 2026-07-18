// api/admin/linkedin-post.js
// This endpoint supports two actions:
// - "generate": Takes a prompt, returns an AI-written LinkedIn post.
// - "post": Takes the final text and publishes it to LinkedIn.
// Both require a valid Firebase Auth token for admin access.

import { verifyIdToken } from '../../lib/firebaseAdmin.js';


// ---------- LinkedIn API helper ----------
async function createLinkedInPost(text, accessToken, personUrn) {
  const url = 'https://api.linkedin.com/v2/posts';
  const body = {
    author: personUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202305', // Use a recent version
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`LinkedIn API error (${res.status}): ${errorBody}`);
  }

  // LinkedIn returns 201 Created with an EMPTY body on success — the new
  // post's ID comes back in the response headers, not a JSON payload.
  // Calling res.json() here throws on the empty body, so read the header
  // instead and only fall back to parsing JSON if there actually is one.
  const postId = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id');
  const rawBody = await res.text();
  const data = rawBody ? JSON.parse(rawBody) : {};
  return { id: postId || data.id, ...data };
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
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional social media copywriter for a multi-sector African enterprise group (Marvini Elite Enterprises). Write concise, engaging LinkedIn posts. When the prompt includes specific details (dates, times, venues, figures), include them exactly as given — never alter, round, or omit them. Include relevant hashtags. Avoid markdown, just plain text with line breaks.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ---------- Main handler ----------
export default async function handler(req, res) {
  // ---------- CORS ----------
  // Browsers block cross-origin requests unless the server explicitly allows
  // it. This lets your dashboard (local dev on 127.0.0.1, or your real
  // domain) call this endpoint. The actual security boundary is still the
  // Firebase Auth check below — CORS only controls which sites' JS is
  // allowed to make the request, not who can call the API directly.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Browsers send a preflight OPTIONS request before the real POST — answer
  // it immediately with no body, before any auth checks run.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST requests
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
    // ---------- GENERATE STEP ----------
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
    // ---------- POST STEP ----------
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for post action' });
    }

    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const personUrn = process.env.PERSON_URN;

    if (!accessToken || !personUrn) {
      return res.status(500).json({ error: 'LinkedIn credentials not configured' });
    }

    try {
      const result = await createLinkedInPost(text, accessToken, personUrn);
      const postUrl = `https://www.linkedin.com/feed/update/${result.id}`;
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