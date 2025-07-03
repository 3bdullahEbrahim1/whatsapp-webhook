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

// Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Route for testing
app.get('/', (req, res) => {
  res.send('🚀 WhatsApp Webhook + Telegram Sender is Live!');
});

// Route for validating Webhook connection with Meta
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

// Route for receiving messages from WhatsApp Webhook
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
      // Insert received WhatsApp message into Supabase
      await supabase.from('whatsapp_webhooks').insert({
        from_number: from,
        to_number: to,
        message_body: text,
        message_type: message.type,
        received_at: new Date().toISOString(),
      });

      // Send the message to Telegram
      await sendMessageToTelegram(from, text);  // Send the same message to Telegram
    }
  } catch (error) {
    console.error('Webhook Error:', error);
  }

  res.sendStatus(200);
});

// Function to send messages to Telegram
const sendMessageToTelegram = async (chatId, message) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, // Use the correct chatId
      text: message,
    }),
  });

  const result = await response.json();
  if (result.ok) {
    console.log(`Message sent to Telegram: ${message}`);
  } else {
    console.error(`Failed to send message to Telegram: ${result.error}`);
  }
};

// Route for sending messages from the CRM to Telegram
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  try {
    // Send the message to Telegram
    const telegramResponse = await sendMessageToTelegram(to, message);

    if (telegramResponse) {
      // Store the message in Supabase after sending it
      await supabase.from('messages').insert([
        {
          content: message,
          sender: 'admin',
          receiver: to,
          message_type: 'sent',
        }
      ]);
      res.status(200).json({ success: true, data: telegramResponse });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send message to Telegram' });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
});
