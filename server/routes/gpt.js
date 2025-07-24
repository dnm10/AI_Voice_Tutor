import axios from 'axios';

export async function getGptAndSpeech(message, role) {
  const { data: { reply } } = await axios.post('http://localhost:5000/api/gpt', {
    message,
    role,
  });

  const ttsRes = await axios.post('http://localhost:5000/api/speak', {
    text: reply
  }, {
    responseType: 'blob'
  });

  return {
    reply,
    audioURL: URL.createObjectURL(ttsRes.data),
  };
}
