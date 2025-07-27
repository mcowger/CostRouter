import OpenAI from 'openai';

async function generateTextExample() {
  // Create OpenAI client configured to use the local CostRouter server
  const client = new OpenAI({
    baseURL: 'http://localhost:3000/v1',
    apiKey: 'dummy-key', // CostRouter doesn't require a real API key for local testing
  });

  try {
    console.log('Sending chat completion request...');

    const completion = await client.chat.completions.create({
      model: "sonnet",
      //model: "gpt-4.1",
      //model: "gemini-2.5-flash",
      // model: "nonexistent-model",
      messages: [{ role: "user", content: "are you gpt-4o or gpt-4.1?" }],
      stream: false, // Set to false for non-streaming response
    });

    console.log('Response received:');
    console.log('Model:', completion.model);
    console.log('Content:', completion.choices[0]?.message?.content);
    console.log('Usage:', completion.usage);
    console.log('Full response:', JSON.stringify(completion, null, 2));

  } catch (error) {
    console.error('Error occurred:', error);
  }
}

async function streamingExample() {
  // Create OpenAI client configured to use the local CostRouter server
  const client = new OpenAI({
    baseURL: 'http://localhost:3000/v1',
    apiKey: 'dummy-key', // CostRouter doesn't require a real API key for local testing
  });

  try {
    console.log('\nSending streaming chat completion request...');

    const stream = await client.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "Tell me a short story about a robot learning to paint." }],
      stream: true,
    });

    console.log('Streaming response:');
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log('\n\nStreaming completed.');

  } catch (error) {
    console.error('Streaming error occurred:', error);
  }
}

generateTextExample();
//ThistreamingExample();
