import { generateText } from 'ai';
import { createClaudeCode, claudeCode } from 'ai-sdk-provider-claude-code';


const claude = createClaudeCode({
  defaultSettings: {
    pathToClaudeCodeExecutable: '/usr/local/bin/claude',
    permissionMode: 'default', // Ask for permissions
    customSystemPrompt: 'You are a helpful coding assistant.',
  }
});

claude.

  // const { text } = await generateText({
  //   model: claudeCode('sonnet'),
  //   prompt: 'Hello, Claude!'
  // });

  console.log(text);