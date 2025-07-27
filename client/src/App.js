import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const scenarios = {
  free: { title: '🗣️ Free Chat', prompt: '' },
  school: {
    title: '🏫 At School',
    prompt: 'You are a friendly teacher.\nAI: “Good morning! What’s your name?”'
  },
  store: {
    title: '🛒 At the Store',
    prompt: 'You are a shopkeeper.\nAI: “Welcome! What do you want to buy today?”'
  },
  home: {
    title: '🏠 At Home',
    prompt: 'You are a family member.\nAI: “Who do you live with?”'
  }
};

function App() {
  const [chatHistory, setChatHistory] = useState([]); // full conversation
  const [typedInput, setTypedInput] = useState('');
  const [mode, setMode] = useState('free');
  const [role, setRole] = useState('a helpful teacher');
  const [status, setStatus] = useState('');
  const [responseAudio, setResponseAudio] = useState(null);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (mode !== 'free') {
      const greeting = scenarios[mode].prompt.split('\n').find(line => line.startsWith('AI:'))?.replace('AI:', '').trim();
      if (greeting) {
        const welcomeMsg = { role: 'assistant', content: greeting };
        setChatHistory([welcomeMsg]);
        speakText(greeting);
      }
    } else {
      setChatHistory([]);
    }
  }, [mode]);

  const speakText = async (text) => {
    try {
      setStatus('🔊 Speaking...');
      const res = await axios.post('http://localhost:5000/api/speak', { text }, { responseType: 'blob' });
      const audioURL = URL.createObjectURL(res.data);
      setResponseAudio(audioURL);
      setStatus('');
    } catch (err) {
      console.error('TTS error:', err);
      setStatus('Speech failed');
    }
  };

  const handleTextSubmit = async () => {
    if (!typedInput.trim()) return;

    const updatedChat = [...chatHistory, { role: 'user', content: typedInput }];
    setChatHistory(updatedChat);
    setTypedInput('');
    setStatus('🤖 Thinking...');

    try {
      const { data: { reply } } = await axios.post('http://localhost:5000/api/gpt', {
        messages: [
          ...(scenarios[mode].prompt ? [{ role: 'system', content: scenarios[mode].prompt }] : []),
          ...updatedChat
        ]
      });

      const newChat = [...updatedChat, { role: 'assistant', content: reply }];
      setChatHistory(newChat);
      speakText(reply);
    } catch (err) {
      console.error('GPT error:', err);
      setStatus('Error getting reply');
    }
  };

  const startRecording = async () => {
    try {
      setStatus('🎙️ Listening...');
      setRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'input.webm');

        try {
          const { data: { text } } = await axios.post('http://localhost:5000/api/transcribe', formData);
          handleVoiceMessage(text);
        } catch (err) {
          console.error('Transcription error:', err);
          setStatus('Voice failed');
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
        setRecording(false);
      }, 4000);
    } catch (err) {
      console.error('Mic error:', err);
      setStatus('Mic access failed');
    }
  };

  const handleVoiceMessage = async (text) => {
    const updatedChat = [...chatHistory, { role: 'user', content: text }];
    setChatHistory(updatedChat);
    setStatus('🤖 Thinking...');

    try {
      const { data: { reply } } = await axios.post('http://localhost:5000/api/gpt', {
        messages: [
          ...(scenarios[mode].prompt ? [{ role: 'system', content: scenarios[mode].prompt }] : []),
          ...updatedChat
        ]
      });

      const newChat = [...updatedChat, { role: 'assistant', content: reply }];
      setChatHistory(newChat);
      speakText(reply);
    } catch (err) {
      console.error('GPT error:', err);
      setStatus('GPT failed');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🧞 SpeakGenie</h1>

      <select value={mode} onChange={e => setMode(e.target.value)} style={styles.select}>
        {Object.entries(scenarios).map(([key, { title }]) => (
          <option key={key} value={key}>{title}</option>
        ))}
      </select>

      <select style={styles.select} value={role} onChange={e => setRole(e.target.value)}>
        <option value="a helpful teacher">🧑‍🏫 Teacher</option>
        <option value="a friendly doctor">🩺 Doctor</option>
        <option value="a shopkeeper in a toy store">🧸 Toy Shopkeeper</option>
        <option value="a space alien learning Earth language">👽 Alien</option>
      </select>

      <div style={styles.chatBox}>
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.chatBubble,
              ...(msg.role === 'user' ? styles.userBubble : styles.genieBubble)
            }}
          >
            <strong>{msg.role === 'user' ? 'You' : 'Genie'}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <input
          type="text"
          value={typedInput}
          onChange={e => setTypedInput(e.target.value)}
          placeholder="Type your message..."
          style={styles.input}
        />
        <button onClick={handleTextSubmit} style={styles.smallBtn}>Send</button>
      </div>

      <button onClick={startRecording} disabled={recording} style={styles.button}>
        {recording ? '🎧 Listening...' : '🎤 Speak'}
      </button>

      {status && <p style={styles.status}>{status}</p>}
      {responseAudio && <audio src={responseAudio} controls autoPlay />}
    </div>
  );
}


const styles = {

container: {
  minHeight: '100vh',
  borderRadius: 20,
  padding: '20px',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#f0f4ff',
  boxShadow: '0 0 15px rgba(0,0,0,0.1)',
  textAlign: 'center',
  fontFamily: 'sans-serif',
  overflow: 'hidden',
 },

heading: {
    fontSize: 28,
    marginBottom: 10
  },
  select: {
    padding: 10,
    margin: 10,
    fontSize: 16,
    borderRadius: 8
  },
  chatBox: {
    background: '#fff',
    padding: 15,
    borderRadius: 10,
    maxHeight: 400,
    overflowY: 'auto',
    marginBottom: 10
  },
  chatBubble: {
    padding: 10,
    borderRadius: 10,
    margin: '8px 0',
    maxWidth: '50%',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  userBubble: {
    backgroundColor: '#d1e7ff',
    alignSelf: 'flex-end',
    textAlign: 'left',
    marginLeft: 'auto'
  },
  genieBubble: {
    backgroundColor: '#e8f5e9',
    alignSelf: 'flex-start',
    textAlign: 'left',
    marginRight: 'auto'
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    marginTop: 10
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    fontSize: 16
  },
  smallBtn: {
    padding: '10px 15px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: 8,
    cursor: 'pointer'
  },
  button: {
    marginTop: 10,
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: 8,
    cursor: 'pointer'
  },
  status: {
    fontStyle: 'italic',
    marginTop: 10
  }

};

export default App;
