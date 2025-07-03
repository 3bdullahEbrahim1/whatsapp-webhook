require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const port = process.env.PORT || 3000

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

app.use(cors())
app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('🟢 Webhook is live!')
})

app.get('/webhook', (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode && token && mode === 'subscribe' && token === verify_token) {
    console.log('✅ Webhook verified')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0]
  const changes = entry?.changes?.[0]?.value?.messages?.[0]

  if (!changes) return res.sendStatus(200)

  const message = {
    message_id: changes.id,
    from_number: changes.from,
    to_number: entry.id,
    message_body: changes.text?.body || '',
    message_type: changes.type,
    received_at: new Date().toISOString(),
  }

  console.log('📩 Incoming Message:', message)

  await supabase.from('whatsapp_webhooks').insert([message])
  res.sendStatus(200)
})

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`)
})
 
