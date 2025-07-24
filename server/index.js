// server/index.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

/**
 * 1) Speech → Text (Whisper)
 */
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioPath = path.join(__dirname, req.file.path);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-1');

    const whisperRes = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    fs.unlinkSync(audioPath);
    const text = whisperRes.data.text;
    console.log('🎙️ Transcribed:', text);
    res.json({ text });
  } catch (err) {
    console.error('❌ Transcription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

/**
 * 2) GPT (OpenRouter) – accepts full conversation history
 */
app.post('/api/gpt', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct', // pick any valid OpenRouter model
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SpeakGenie',
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('❌ GPT error:', err.response?.data || err.message);
    res.status(500).json({ error: 'GPT request failed' });
  }
});

/**
 * 3) Text → Speech (ElevenLabs)
 */
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.7,
        },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length,
    });
    res.send(response.data);
  } catch (err) {
    console.error('❌ TTS error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
