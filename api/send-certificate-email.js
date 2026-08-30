// api/send-certificate-email.js
export default async function handler(req, res) {
  // Reuses the same ALLOWED_ORIGIN env var as your other API functions
  // (e.g. api/adsense.js) so CORS config stays in one place.
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://marvini-elite-enterprises.web.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { to_email, to_name, program_name, cert_id, completion_date, certificate_image_url, certificate_link, signer_title } = req.body || {};

  if (!to_email || !certificate_image_url) {
    return res.status(400).json({ success: false, error: 'Missing recipient email or certificate image URL' });
  }

  try {
    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_CERT_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email, to_name, program_name, cert_id,
          completion_date, certificate_image_url, certificate_link, signer_title
        }
      })
    });

    const text = await emailRes.text();
    if (!emailRes.ok) {
      console.error('EmailJS error:', text);
      return res.status(502).json({ success: false, error: text || 'EmailJS request failed' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending certificate email:', err);
    return res.status(500).json({ success: false, error: 'Server error sending email' });
  }
}