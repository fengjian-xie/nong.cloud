import { createRequire } from 'node:module';

export function loadSdk() {
  const candidates = [
    import.meta.url,
    '/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/node_modules/@tencent/tencent-docs-ai-engine/package.json',
  ];
  for (const anchor of candidates) {
    try {
      const require = createRequire(anchor);
      return {
        McpServer: require('@modelcontextprotocol/sdk/server/mcp.js').McpServer,
        StdioServerTransport: require('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport,
        Client: require('@modelcontextprotocol/sdk/client/index.js').Client,
        StdioClientTransport: require('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport,
        InMemoryTransport: require('@modelcontextprotocol/sdk/inMemory.js').InMemoryTransport,
        z: require('zod').z,
      };
    } catch { /* Try the already installed WorkBuddy SDK. */ }
  }
  throw new Error('MCP_SDK_UNAVAILABLE: install the pinned dependencies in tools/workbuddy-bridge.');
}
