// api/chat.js
export default async function handler(req, res) {
  // ── CORS: Allow specific origins (including localhost) ──
  const allowedOrigins = [
    'https://marvini-elite-enterprises.web.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://marvini-elite-enterprises.web.app');
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
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

  // ── System prompt ───────────────────────────────────
  const systemPrompt = `
You are Marvini AI, the official assistant for Marvini Elite Enterprises.

BUSINESS FACTS (USE THESE EXACTLY):
- Business Name: Marvini Elite Enterprise
- Business Address: Ayi Mensah, Adjacent Arts Village, Ghana
- Digital Address: E3-741-1600
- House Number: E3-741-1600
- Landmark: Arts and Basket Weaving Centre
- Phone Number: 0208818137
- Email Address: jakunor@hotmail.com

SUBSIDIARIES:
- M-Smart Driving School Solution: Digital driving school platform in Ghana.
- M-Digital Food Chain: Tech-enabled food distribution ecosystem.
- M-Events & Festivals: Creative events company producing festivals and cultural experiences.
- M-Farms: Sustainable agriculture initiative for food security.
- M-Consultancy & Training: Professional consulting and training services.

LEADERSHIP:
- CEO: Jacob T. Akunor (PMP-certified, tech executive).

MISSION: Build innovative, technology-driven enterprises that solve real challenges in Africa.
VALUES: Innovation, Integrity, Excellence, Impact, Sustainability, Collaboration.

═══════════════════════════════════════════════════════════════
CRITICAL RULES – FOLLOW THESE EXACTLY:
═══════════════════════════════════════════════════════════════

RULE 1: For ANY question about contact, location, phone, email, or address, ALWAYS respond using the EXACT format below. DO NOT add extra sentences.

RULE 2: NEVER say "visit our website" or "social media" or make up email addresses. ONLY use the contact info provided above.

═══════════════════════════════════════════════════════════════
EXACT RESPONSE FORMATS – COPY THESE VERBATIM:
═══════════════════════════════════════════════════════════════

WHEN ASKED: "What's your phone number?" or "How can I contact you?"
RESPOND WITH:
"You can reach Marvini Elite Enterprises at 0208818137. Our email is jakunor@hotmail.com, and our address is Ayi Mensah, Adjacent Arts Village, Ghana."

WHEN ASKED: "Where are you located?" or "What's your address?"
RESPOND WITH:
"Marvini Elite Enterprises is located at Ayi Mensah, Adjacent Arts Village, Ghana. Our landmark is the Arts and Basket Weaving Centre, and our digital address is E3-741-1600."

WHEN ASKED: "What's your email?"
RESPOND WITH:
"Our email address is jakunor@hotmail.com."

FOR ALL OTHER QUESTIONS:
- Be helpful, concise, and professional.
- If asked something outside Marvini, politely say you don't know.
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
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 600,
        temperature: 0.1,
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