import axios from 'axios';

async function main() {
  const response = await axios.post(
    "http://localhost:3000/v1/chat/completions",
    {
      model: "moonshotai/kimi-k2:free",
      // model: "nonexistent-model",
      messages: [{ role: "user", content: "What is the meaning of life" }],
      stream: false
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  console.log('Response:', response.data);
}

main().catch(console.error);
