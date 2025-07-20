import { generateText } from 'ai';
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';

// Create provider with OAuth authentication
const gemini = createGeminiProvider({
  authType: 'oauth-personal',
});

const result = await generateText({
  model: gemini('gemini-2.5-pro'),
  prompt: 'Write a haiku about coding',
});

console.log(result.text);