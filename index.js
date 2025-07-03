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

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Verified ✅');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ Route استقبال رسائل WhatsApp من Meta
app.post('/webhook', async (req, res) => {
  const body = req.body;

  console.log('📩 Received Webhook:', JSON.stringify(body, null, 2));

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const messageData = change?.value?.messages?.[0];
    const from = messageData?.from;
    const to = change?.value?.metadata?.display_phone_number;
    const text = messageData?.text?.body;

    if (from && text) {
      await supabase.from('whatsapp_webhooks').insert({
        from_number: from,
        to_number: to,
        message_body: text,
        message_type: messageData.type,
        received_at: new Date().toISOString(),
      });

      console.log('✅ Message saved to Supabase');
    }
  } catch (e) {
    console.error('❌ Error saving message:', e);
  }

  res.sendStatus(200);
});

// ✅ Route لإرسال رسائل WhatsApp من Bolt
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  const phoneId = '669480912922601';
  const token = process.env.WHATSAPP_TOKEN;

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

    const data = await response.json();

    await supabase.from('messages').insert([
      {
        content: message,
        sender: 'admin',
        receiver: to,
        message_type: 'sent'
      }
    ]);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ Sending Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ تشغيل السيرفر
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
});
