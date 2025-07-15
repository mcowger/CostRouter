import axios from 'axios';

async function main() {
  const response = await axios.post(
    "http://localhost:3000/v1/chat/completions",
    {
      //model: "gpt-4o",
      model: "moonshotai/kimi-k2:free",
      // model: "nonexistent-model",
      messages: [{ role: "user", content: "are you gpt-4o or gpt-4.1?" }],
      stream: false,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  console.log(`Response: ${response.data.text.slice(0, 1000)}...`);
  console.log("Usage:", response.data.usage);
}

main().catch(console.error);
