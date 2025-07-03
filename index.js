require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Route للعرض التجريبي
app.get('/', (req, res) => {
  res.send('🚀 WhatsApp Webhook + Sender is Live!');
});

// ✅ Route التحقق من Webhook عند ربطه بـ Meta
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ استقبال الرسائل من WhatsApp
app.post('/webhook', async (req, res) => {
  const body = req.body;

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body;
    const to = change?.value?.metadata?.display_phone_number;

    if (from && text) {
      await supabase.from('whatsapp_webhooks').insert({
        from_number: from,
        to_number: to,
        message_body: text,
        message_type: message.type,
        received_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Webhook Error:', error);
  }

  res.sendStatus(200);
});

// ✅ إرسال الرسائل من Bolt
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = '669480912922601';

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      })
    });

    const result = await response.json();

    await supabase.from('messages').insert([{
      content: message,
      sender: 'admin',
      receiver: to,
      message_type: 'sent',
    }]);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Send Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ تشغيل السيرفر
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
});
