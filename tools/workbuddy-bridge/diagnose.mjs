import { fileURLToPath } from 'node:url';
import { loadSdk } from './sdk.mjs';

const { Client, StdioClientTransport } = loadSdk();
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('./server.mjs', import.meta.url))],
  stderr: 'pipe',
  env: process.env.XQ_WB_CONFIG_DIR ? { XQ_WB_CONFIG_DIR: process.env.XQ_WB_CONFIG_DIR } : {},
});
// Deliberately discard raw stderr; it can include upstream credentials on failures.
transport.stderr?.on('data', () => {});
const client = new Client({ name: 'xiangqiao-workbuddy-diagnostic', version: '0.1.0' });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(JSON.stringify({ handshake: 'passed', toolNames: tools.tools.map((t) => t.name) }));
  const status = await client.callTool({ name: 'workbuddy_status', arguments: {} });
  console.log(JSON.stringify({ status: status.structuredContent }));
  if (process.argv.includes('--live')) {
    const probe = await client.callTool({ name: 'workbuddy_probe', arguments: {} }, undefined, { timeout: 55_000 });
    console.log(JSON.stringify({ liveProbe: probe.structuredContent }));
    if (probe.isError) process.exitCode = 2;
  }
} catch {
  console.log(JSON.stringify({ ok: false, category: 'mcp_transport_failed' }));
  process.exitCode = 1;
} finally {
  await client.close();
}
