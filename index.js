 
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get('/', (req, res) => {
  res.send('WhatsApp Webhook Running ✅');
});

app.get('/webhook', (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verify_token) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;

  console.log('Webhook Received:', JSON.stringify(body, null, 2));

  // تخزين الرسالة في Supabase
  const { error } = await supabase
    .from('whatsapp_webhooks')
    .insert({ payload: body });

  if (error) {
    console.error('Database Error:', error);
    return res.status(500).send('Error saving message');
  }

  res.sendStatus(200);
});

// ✅ استخدم البورت الصحيح لـ Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
