// api/admin/facebook-post.js
// This endpoint supports two actions:
// - "generate": Takes a prompt, returns an AI-written Facebook post.
// - "post": Takes the final text and publishes it to your Facebook Page.
// Both require a valid Firebase Auth token for admin access.

import { verifyIdToken } from '../../lib/firebaseAdmin.js';

const GRAPH_VERSION = 'v21.0'; // bump this periodically — Meta deprecates old versions

// ---------- Facebook Graph API helper ----------
async function createFacebookPost(text, pageId, accessToken) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
  const params = new URLSearchParams({ message: text, access_token: accessToken });

  const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
  const data = await res.json();

  if (!res.ok) {
    const message = data?.error?.message || JSON.stringify(data);
    throw new Error(`Facebook API error (${res.status}): ${message}`);
  }

  return data; // { id: "pageId_postId" }
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
            'You are a professional social media copywriter for a multi-sector African enterprise group (Marvini Elite Enterprises). Write warm, community-friendly Facebook posts — slightly more conversational than LinkedIn, no strict length limit but keep it readable (roughly under 500 characters unless the topic needs more). When the prompt includes specific details (dates, times, venues, figures), include them exactly as given — never alter, round, or omit them. Use 1-3 relevant hashtags. Avoid markdown, just plain text with natural line breaks.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const decoded = await verifyIdToken(token);
  if (!decoded) return res.status(403).json({ error: 'Invalid or expired token' });

  const { action, prompt, text } = req.body;

  if (action === 'generate') {
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required for generate action' });
    }
    try {
      const generatedText = await generatePost(prompt);
      return res.status(200).json({ success: true, generatedText });
    } catch (err) {
      console.error('Generate error:', err);
      return res.status(500).json({ error: err.message });
    }

  } else if (action === 'post') {
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for post action' });
    }

    const pageId = process.env.FB_PAGE_ID;
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
      return res.status(500).json({ error: 'Facebook credentials not configured' });
    }

    try {
      const result = await createFacebookPost(text, pageId, accessToken);
      const [returnedPageId, postId] = result.id.split('_');
      const postUrl = `https://www.facebook.com/${returnedPageId}/posts/${postId}`;
      return res.status(200).json({ success: true, postUrl, id: result.id });
    } catch (err) {
      console.error('Post error:', err);
      return res.status(500).json({ error: err.message });
    }

  } else {
    return res.status(400).json({ error: 'Invalid action. Use "generate" or "post".' });
  }
}