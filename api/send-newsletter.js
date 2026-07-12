// api/send-newsletter.js
// Manually-triggered (for now) digest: pulls unsent published news from Firestore,
// asks Groq to write a subject + summary, emails every newsletter subscriber via EmailJS.
//
// Env vars needed (set in Vercel → Project → Settings → Environment Variables):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY        (paste with \n escaped, code below un-escapes it)
//   GROQ_API_KEY
//   EMAILJS_SERVICE_ID
//   EMAILJS_TEMPLATE_ID
//   EMAILJS_PUBLIC_KEY
//   EMAILJS_PRIVATE_KEY         (EmailJS "Private Key" — required for server-side calls)
//   NEWSLETTER_TRIGGER_SECRET   (any random string you choose, to protect this URL)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Init Firebase Admin (once per cold start) ──
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

export default async function handler(req, res) {
  // ── Simple shared-secret protection (swap for Vercel Cron's built-in auth later) ──
  const providedSecret = req.query.secret || req.headers['x-newsletter-secret'];
  if (providedSecret !== process.env.NEWSLETTER_TRIGGER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── 1. Find published news items since the last send ──
    const settingsRef = db.collection('settings').doc('newsletter');
    const settingsSnap = await settingsRef.get();
    const lastSentAt = settingsSnap.exists ? settingsSnap.data().lastSentAt : null;

    let newsQuery = db.collection('news')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(10);
    if (lastSentAt) {
      newsQuery = db.collection('news')
        .where('status', '==', 'published')
        .where('createdAt', '>', lastSentAt)
        .orderBy('createdAt', 'desc')
        .limit(10);
    }
    const newsSnap = await newsQuery.get();

    if (newsSnap.empty) {
      return res.status(200).json({ success: true, message: 'No new published news items since last send.' });
    }

    const newsItems = newsSnap.docs.map(d => {
      const data = d.data();
      return {
        title: data.title || 'Untitled',
        excerpt: data.excerpt || '',
        tag: data.tag || 'Update',
      };
    });

    // ── 2. Ask Groq to write a subject line + short digest copy ──
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              'You write short, upbeat newsletter digests for Marvini Elite Enterprises, an African enterprise group. Given a list of news items (title, tag, excerpt), return STRICT JSON only: {"subject": "...", "intro": "...", "items": [{"title": "...", "blurb": "..."}]}. Keep the intro to 1-2 sentences and each blurb to 1 sentence. No markdown, no preamble.',
          },
          { role: 'user', content: JSON.stringify(newsItems) },
        ],
        temperature: 0.6,
      }),
    });
    const groqData = await groqRes.json();

    if (groqData.error) {
      console.error('Groq API error:', groqData.error);
      return res.status(500).json({ error: 'Groq summarization failed', details: groqData.error });
    }

    const digest = JSON.parse(groqData.choices[0].message.content);

    // ── 3. Get subscriber list ──
    const subsSnap = await db.collection('newsletter').get();
    const subscribers = subsSnap.docs.map(d => d.data().email).filter(Boolean);

    if (subscribers.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscribers to send to.' });
    }

    // ── 4. Send via EmailJS REST API (one call per subscriber) ──
    const itemsHtml = digest.items
      .map(i => `<p><strong>${i.title}</strong><br/>${i.blurb}</p>`)
      .join('');

    let sentCount = 0;
    const failures = [];

    for (const email of subscribers) {
      try {
        const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_TEMPLATE_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY,
            accessToken: process.env.EMAILJS_PRIVATE_KEY,
            template_params: {
              to_email: email,
              subject: digest.subject,
              intro: digest.intro,
              items_html: itemsHtml,
            },
          }),
        });
        if (emailRes.ok) {
          sentCount++;
        } else {
          const errText = await emailRes.text();
          failures.push({ email, status: emailRes.status, error: errText });
        }
      } catch (err) {
        failures.push({ email, error: err.message });
      }
    }

    // ── 5. Mark the send time so we don't resend the same news next run ──
    await settingsRef.set({ lastSentAt: new Date() }, { merge: true });

    return res.status(200).json({
      success: true,
      subject: digest.subject,
      newsItemsIncluded: newsItems.length,
      subscriberCount: subscribers.length,
      sentCount,
      failures,
    });
  } catch (err) {
    console.error('Newsletter send failed:', err);
    return res.status(500).json({ error: 'Newsletter send failed', details: err.message });
  }
}