import * as fs from 'fs';
import * as path from 'path';

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const OUTPUT_FILE = 'copilot.data';

const MANDATORY_HEADERS = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'User-Agent': 'costrouter-Token-Generator/1.0',
};

async function startDeviceLogin() {
  console.log('Requesting device code from GitHub...');
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: MANDATORY_HEADERS,
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'read:user' }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Failed to get device code:', data);
    return;
  }

  const { device_code, user_code, verification_uri, expires_in, interval } = data;

  console.log('\n----------------------------------------');
  console.log('Please go to the following URL to authorize this application:');
  console.log(`URL: ${verification_uri}`);
  console.log(`Your user code is: ${user_code}`);
  console.log('----------------------------------------\n');
  console.log('Waiting for authorization...');

  await pollForToken(device_code, interval);
}

async function pollForToken(deviceCode: string, intervalSeconds: number) {
  const intervalMs = intervalSeconds * 1000;

  while (true) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));

    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: MANDATORY_HEADERS,
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await res.json();

    if (data.error) {
      if (data.error === 'authorization_pending') {
        // Continue polling
        process.stdout.write('.');
      } else {
        console.error(`\nError fetching token: ${data.error_description || data.error}`);
        break;
      }
    } else if (data.access_token) {
      console.log('\nAuthorization successful!');
      const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
      fs.writeFileSync(outputPath, data.access_token);
      console.log(`Token saved to ${outputPath}`);
      break;
    }
  }
}

startDeviceLogin().catch(err => {
  console.error('An unexpected error occurred:', err);
});