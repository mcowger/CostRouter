import { CopilotTokenManager } from '../server/components/CopilotTokenManager';

const COPILOT_API_HOST = "api.githubcopilot.com";

async function getModels() {
  console.log("Fetching available models from Copilot...");

  try {
    const tokenManager = CopilotTokenManager.getInstance();
    const bearerToken = await tokenManager.getBearerToken();

    if (!bearerToken) {
      console.error("Failed to get bearer token. Please ensure copilot.data is present and valid.");
      return;
    }

    const response = await fetch(`https://${COPILOT_API_HOST}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        accept: "application/json",
        "editor-version": "vscode/1.85.1",
        "Copilot-Integration-Id": "vscode-chat",
        "content-type": "application/json",
        "user-agent": "GithubCopilot/1.155.0",
        "accept-encoding": "gzip,deflate,br",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      const body = await response.text();
      console.error('Response body:', body);
      return;
    }

    const data = await response.json();
    console.log("\nSupported Copilot Models:");
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

getModels();