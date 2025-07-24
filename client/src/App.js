import React, { useState, useRef, useEffect} from 'react';
import axios from 'axios';

const scenarios = {
    free: {               
      title: 'Free Chat',
      prompt: '',         
    },
    school: {
      title: '🏫 At School',
      prompt: `You are a friendly teacher on the first day of class.
      AI: “Good morning! What’s your name?”`,
    },
    store: {
      title: '🛒 At the Store',
      prompt: `You are a shopkeeper in a grocery store.
      AI: “Welcome! What do you want to buy today?”`,
    },
    home: {
      title: '👨‍👩‍👧 At Home',
      prompt: `You are a family member at home.
      AI: “Who do you live with?”`,
    },
  };

function App() {
  const [recording, setRecording] = useState(false);
  const [responseAudio, setResponseAudio] = useState(null);
  const [role, setRole] = useState('a helpful teacher');
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [replyText, setReplyText] = useState('');
  const [typedInput, setTypedInput] = useState('');
  const [mode, setMode] = useState('free');



  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleTextSubmit = async () => {
    if (!typedInput.trim()) return;

    setTranscript(typedInput);
    setStatus('🤖 Thinking...');
    try {
      const { data: { reply } } = await axios.post('http://localhost:5000/api/gpt', {
        message: typedInput,
        role,
        prompt: scenarios[mode].prompt
      });
      setReplyText(reply);

      const ttsRes = await axios.post('http://localhost:5000/api/speak', { text: reply }, { responseType: 'blob' });
      const audioURL = URL.createObjectURL(ttsRes.data);
      setResponseAudio(audioURL);
      setStatus('Done!!!');
    } catch (err) {
      console.error('Error:', err);
      setStatus('Text input failed');
    }
  };

  const startRecording = async () => {
    setStatus('🎙️ Listening...');
    setTranscript('');
    setReplyText('');
    setResponseAudio(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setStatus('Stopped Processing...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'input.webm');

        try {
          const { data: { text } } = await axios.post('http://localhost:5000/api/transcribe', formData);
          setTranscript(text);
          setStatus('Getting response...');

          const { data: { reply } } = await axios.post('http://localhost:5000/api/gpt', {
            message: text,
            role,
          });

          setReplyText(reply);

          const ttsRes = await axios.post('http://localhost:5000/api/speak', { text: reply }, { responseType: 'blob' });
          const audioURL = URL.createObjectURL(ttsRes.data);
          setResponseAudio(audioURL);
          setStatus('Done!!!');
        } catch (err) {
          console.error('Error:', err);
          setStatus('Voice input failed');
        }
      };

      mediaRecorder.start();
      setRecording(true);
      setTimeout(() => {
        mediaRecorder.stop();
        setRecording(false);
      }, 4000);
    } catch (err) {
      console.error('🎙️ Microphone error:', err);
      setStatus('Microphone access error');
    }
  };

  const currentPrompt = scenarios[mode].prompt;
  
  useEffect(() => {

      if (mode !== 'free') {
        
        const lines = scenarios[mode].prompt.split('\n');
        
        const aiLine = lines.find(l => l.trim().startsWith('AI:'));
        if (aiLine) {
          
          const greeting = aiLine.replace(/^AI:\s*/, '').trim();
         
          setReplyText(greeting);
          
          setTranscript('');
          
          setStatus('🔊 Speaking...');
          
          axios.post('http://localhost:5000/api/speak', { text: greeting }, { responseType: 'blob' })
            .then(res => {
              const url = URL.createObjectURL(res.data);
              setResponseAudio(url);
              setStatus('');  
            })
            .catch(err => {
              console.error('TTS error:', err);
              setStatus('TTS failed');
            });
        }
      } else {
        
        setReplyText('');
        setResponseAudio(null);
        setStatus('');
      }
  }, [mode, currentPrompt]);



  


  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🧞 SpeakGenie</h1>
      
      <div style={styles.modeSelector}>
        <select
          value={mode}
          onChange={e => setMode(e.target.value)}
          style={styles.select}
        >
          {Object.entries(scenarios).map(([key, { title }]) => (
            <option key={key} value={key}>{title}</option>
          ))}
        </select>
      </div>


      <select style={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="a helpful teacher">🧑‍🏫 Teacher</option>
        <option value="a friendly doctor">🩺 Doctor</option>
        <option value="a shopkeeper in a toy store">🧸 Toy Shopkeeper</option>
        <option value="a space alien learning Earth language">👽 Alien</option>
        <option value="a travel agent helping a kid">🌍 Travel Agent</option>
      </select>

      <div style={{ marginBottom: 15 }}>
        <input
          type="text"
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Type your message..."
          style={styles.input}
        />
        <button onClick={handleTextSubmit} style={styles.smallBtn}>Send</button>
      </div>

      <button onClick={startRecording} disabled={recording} style={styles.button}>
        {recording ? '🎧 Listening...' : '🎤 Speak'}
      </button>

      {status && <p style={styles.status}>{status}</p>}

      <div style={styles.chatContainer}>
        {transcript && (
          <div style={{ ...styles.chatBubble, ...styles.userBubble }}>
            <div><strong>You said:</strong></div>
            <div>{transcript}</div>
          </div>
        )}

        {replyText && (
          <div style={{ ...styles.chatBubble, ...styles.genieBubble }}>
            <div><strong>Genie says:</strong></div>
            <div>{replyText}</div>
          </div>
        )}
      </div>


      {responseAudio && (
        <div style={{ marginTop: 20 }}>
          <audio controls autoPlay src={responseAudio}></audio>
        </div>
      )}
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
    fontSize: 32,
    marginBottom: 20,
  },
  select: {
    padding: 10,
    fontSize: 16,
    borderRadius: 8,
    marginBottom: 20,
  },

  modeSelector: {
    padding: 10,
    fontSize: 16,
    borderRadius: 8,
    marginBottom: 20,
  },

  
  input: {
    padding: 10,
    fontSize: 16,
    width: '65%',
    borderRadius: 8,
    marginRight: 10,
  },
  smallBtn: {
    padding: '10px 15px',
    fontSize: 16,
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  button: {
    padding: '10px 20px',
    fontSize: 18,
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  status: {
    fontStyle: 'italic',
    margin: '10px 0',
  },
  box: {
    background: 'white',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    textAlign: 'left',
  },

  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 20,
  },

  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 1.4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },

  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#d1e7ff',
    textAlign: 'right',
  },

  genieBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    textAlign: 'left',
  }

};

export default App;
