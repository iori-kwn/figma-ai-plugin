// GitHub Actions向けのClaude APIプロキシ実装例

const fetch = require('node-fetch');

async function handleClaudeRequest(requestData) {
  const API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  console.log('Starting Claude API request...');
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestData),
      // GitHub Actionsでは長時間実行可能（最大60分）
      timeout: 300000, // 5分タイムアウト
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log(`Claude API request completed in ${duration}ms`);

    return {
      success: true,
      data: data,
      duration: duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Claude API request failed:', error);

    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

// GitHub Actionsから呼び出される場合
if (require.main === module) {
  const requestData = JSON.parse(process.env.REQUEST_DATA || '{}');

  handleClaudeRequest(requestData)
    .then((result) => {
      console.log('Result:', JSON.stringify(result, null, 2));
      // GitHubのoutputに結果を設定
      if (process.env.GITHUB_OUTPUT) {
        require('fs').appendFileSync(process.env.GITHUB_OUTPUT, `claude_response=${JSON.stringify(result)}\n`);
      }
    })
    .catch((error) => {
      console.error('Failed to handle request:', error);
      process.exit(1);
    });
}

module.exports = { handleClaudeRequest };
