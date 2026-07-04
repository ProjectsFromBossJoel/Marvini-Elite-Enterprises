// api/chat.js
export default async function handler(req, res) {
  // ── CORS: Allow only your Firebase domain (+ local dev) ──────────
  const allowedOrigins = [
    'https://marvini-elite-enterprises.web.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5501'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback: default to the production domain
    res.setHeader('Access-Control-Allow-Origin', 'https://marvini-elite-enterprises.web.app');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ── Handle preflight OPTIONS request ──────────────
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Only allow POST ────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Get the user's message ─────────────────────────
  const { message } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // ── System prompt (train the AI) ───────────────────
  const systemPrompt = `
You are Marvini AI, the official assistant for Marvini Elite Enterprises.

ABOUT MARVINI:
Marvini Elite Enterprises is a premier African enterprise group with subsidiaries:
- M-Smart Driving School Solution: Digital driving school platform in Ghana.
- M-Digital Food Chain: Tech-enabled food distribution ecosystem.
- M-Events & Festivals: Creative events company producing festivals and cultural experiences.
- M-Farms: Sustainable agriculture initiative for food security.
- M-Consultancy & Training: Professional consulting and training services.

LEADERSHIP:
- CEO: Jacob T. Akunor (PMP-certified, tech executive).
- Team: Joel Obuamah Addy (Software Developer), Prince Antwi Wiafe (Solutions Architect), Linda Oduraa Boakye (Finance), Dr. Elvis Baidoo (PM/GM), Daniel Etoo Yeboah (M-Events), Nicolette Naa Shormeh Noi (M-Digital Food).

MISSION: Build innovative, technology-driven enterprises that solve real challenges in Africa.
VISION: Become one of Africa's most trusted and transformative enterprise groups.
VALUES: Innovation, Integrity, Excellence, Impact, Sustainability, Collaboration.

INSTRUCTIONS:
- Be helpful, concise, and professional.
- If asked something outside Marvini, politely say you don't know.
- Keep responses under 200 words.
- Use a friendly but professional tone.
`;

  // ── Get API key from environment variables ──────────
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('Missing GROQ_API_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // ── Call Groq API ──────────────────────────────────
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Free, fast, and powerful
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Groq API error:', data.error);
      return res.status(500).json({
        reply: 'I\'m having a bit of trouble. Please email info@marvini.com for assistance.'
      });
    }

    const reply = data.choices?.[0]?.message?.content || 'Sorry, I didn\'t catch that. Can you rephrase?';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Error in chat function:', error);
    return res.status(500).json({
      reply: '⚠️ I\'m currently unavailable. Please try again later or contact us directly.'
    });
  }
}