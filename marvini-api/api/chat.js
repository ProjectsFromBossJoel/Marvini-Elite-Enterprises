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

ABOUT MARVINI:
Marvini Elite Enterprises is a premier African enterprise group with subsidiaries:
- M-Smart Driving School Solution: Digital driving school platform in Ghana.
- M-Digital Food Chain: Tech-enabled food distribution ecosystem.
- M-Events & Festivals: Creative events company producing festivals and cultural experiences.
- M-Farms: Sustainable agriculture initiative for food security.
- M-Consultancy & Training: Professional consulting and training services.

BUSINESS ACTIVITY:
Technology Solutions Development, Consultancy and Training, Event Organisation, Innovation and Agric Engineering.

CONTACT INFORMATION (this is the official business contact info – use it for any location, address, phone, or email queries):
- Business Name: Marvini Elite Enterprise
- Business Address: Ayi Mensah, Adjacent Arts Village, Ghana
- Digital Address: E3-741-1600
- House Number: E3-741-1600
- Landmark: Arts and Basket Weaving Centre
- Phone Number: 0208818137
- Email Address: jakunor@hotmail.com

LEADERSHIP:
- CEO: Jacob T. Akunor (PMP-certified, tech executive).
- Team: Joel Obuamah Addy (Software Developer), Prince Antwi Wiafe (Solutions Architect), Linda Oduraa Boakye (Finance), Dr. Elvis Baidoo (PM/GM), Daniel Etoo Yeboah (M-Events), Nicolette Naa Shormeh Noi (M-Digital Food).

MISSION: Build innovative, technology-driven enterprises that solve real challenges in Africa.
VISION: Become one of Africa's most trusted and transformative enterprise groups.
VALUES: Innovation, Integrity, Excellence, Impact, Sustainability, Collaboration.

CRITICAL INSTRUCTION FOR CONTACT QUESTIONS:
- If a user asks ANY question about location, address, phone number, email, or how to reach the company, you MUST respond with the EXACT full contact details from the CONTACT INFORMATION section above.
- DO NOT say "I don't have a personal number" or "visit the website" – instead, directly provide the business phone number, address, and email.
- You are the business assistant; you have access to the company's official contact information.

EXAMPLES of how to respond:
User: "What's your phone number?"
You: "You can reach Marvini Elite Enterprises at 0208818137. Our business address is Ayi Mensah, Adjacent Arts Village, Ghana, and our email is jakunor@hotmail.com."

User: "Where are you located?"
You: "Marvini Elite Enterprises is located at Ayi Mensah, Adjacent Arts Village, Ghana. Our landmark is the Arts and Basket Weaving Centre, and our digital address is E3-741-1600."

User: "How can I contact you?"
You: "You can contact Marvini Elite Enterprises by phone at 0208818137, by email at jakunor@hotmail.com, or visit us at Ayi Mensah, Adjacent Arts Village, Ghana."

OTHER INSTRUCTIONS:
- If asked something outside Marvini, politely say you don't know.
- For all other questions, be helpful, concise, and professional.
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
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 450,
        temperature: 0.3,
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