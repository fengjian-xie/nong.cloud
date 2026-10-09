import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { classifyFailure, noToolsArgs, probe, runCli, safeEnvironment } from '../probe.mjs';
import { createServer, redact } from '../server.mjs';
import { loadSdk } from '../sdk.mjs';

const fixture = fileURLToPath(new URL('./fixture-cli.mjs', import.meta.url));
const cliOptions = { cliPath: fixture };

test('permission bypass and live MCP services are never enabled', () => {
  assert.ok(!noToolsArgs.includes('-y'));
  assert.ok(!noToolsArgs.includes('--dangerously-skip-permissions'));
  assert.equal(noToolsArgs[noToolsArgs.indexOf('--tools')+1], '');
  assert.equal(noToolsArgs[noToolsArgs.indexOf('--mcp-config')+1], '{"mcpServers":{}}');
  assert.equal(noToolsArgs[noToolsArgs.indexOf('--permission-mode')+1], 'plan');
  assert.equal(noToolsArgs[noToolsArgs.indexOf('--setting-sources')+1], '');
  assert.equal(JSON.parse(noToolsArgs[noToolsArgs.indexOf('--settings')+1]).disableAllHooks, true);
});

test('business and API credentials are not inherited from the parent process', () => {
  process.env.XQ_FIXTURE_SECRET = 'never-forward-this';
  try { assert.equal(safeEnvironment().XQ_FIXTURE_SECRET, undefined); }
  finally { delete process.env.XQ_FIXTURE_SECRET; }
});

test('known permission, network, login and quota errors have separate categories', () => {
  assert.equal(classifyFailure('EPERM'), 'local_permission');
  assert.equal(classifyFailure('EAI_AGAIN'), 'network');
  assert.equal(classifyFailure('Please login'), 'authentication');
  assert.equal(classifyFailure('quota exceeded'), 'quota');
});

test('probe requires an exact successful sentinel (fixture)', async () => {
  const data = await probe(cliOptions);
  assert.deepEqual(data, { ok: true, category: 'success', reply: 'WORKBUDDY_BRIDGE_READY', toolsEnabled: false, externalBusinessWrites: false });
});

test('exit code zero without model response is not treated as success', async () => {
  const data = await runCli(['--stderr-fixture'], cliOptions);
  assert.equal(data.ok, false);
  assert.equal(data.category, 'authentication');
  assert.ok(!JSON.stringify(data).includes('do-not-print'));
});

test('JSON provider errors are failures even with exit code zero', async () => {
  const data = await runCli(['--json-error-fixture'], cliOptions);
  assert.equal(data.ok, false);
  assert.equal(data.category, 'authentication');
});

test('hung CLI processes are stopped and reported as timeouts', async () => {
  const data = await runCli(['--timeout-fixture'], { ...cliOptions, timeoutMs: 100 });
  assert.equal(data.ok, false);
  assert.equal(data.category, 'timeout');
});

test('credentials are redacted from advisory output', () => {
  assert.equal(redact('Bearer abcdefghijklmnopqrstuvwxyz'), 'Bearer [REDACTED]');
  assert.ok(!redact('api_key=abcdefghijklmnop').includes('abcdefghijklmnop'));
  assert.ok(!redact('-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----').includes('fixture'));
});

async function connectMemory(options) {
  const { Client, InMemoryTransport } = loadSdk();
  const [a,b] = InMemoryTransport.createLinkedPair();
  const server = createServer(options);
  const client = new Client({ name: 'bridge-test-fixture', version: '0.1.0' });
  await server.connect(a);
  await client.connect(b);
  return { server, client };
}

test('MCP protocol lists the three dedicated tools', async () => {
  const { server, client } = await connectMemory({ cliOptions });
  try {
    assert.deepEqual((await client.listTools()).tools.map(x=>x.name), ['workbuddy_status','workbuddy_probe','workbuddy_review_snapshot']);
    const p = await client.callTool({ name:'workbuddy_probe', arguments:{} });
    assert.equal(p.structuredContent.ok,true);
  } finally { await client.close(); await server.close(); }
});

test('review is disabled until explicitly enabled', async () => {
  const { server, client } = await connectMemory({ cliOptions, allowReview:false });
  try {
    const r = await client.callTool({ name:'workbuddy_review_snapshot', arguments:{question:'审查',snapshot:'non-sensitive fixture'} });
    assert.equal(r.structuredContent.category,'review_not_enabled');
    assert.equal(r.isError,true);
  } finally { await client.close(); await server.close(); }
});

test('advisory review uses only caller-provided text (fixture)', async () => {
  const { server, client } = await connectMemory({ cliOptions, allowReview:true });
  try {
    const r = await client.callTool({ name:'workbuddy_review_snapshot', arguments:{question:'审查',snapshot:'amountFen=100'} });
    assert.equal(r.structuredContent.advisoryOnly,true);
    assert.equal(r.structuredContent.toolsEnabled,false);
    const blocked = await client.callTool({ name:'workbuddy_review_snapshot', arguments:{question:'审查',snapshot:'api_key=abcdefghijklmnop'} });
    assert.equal(blocked.structuredContent.category,'sensitive_input_rejected');
  } finally { await client.close(); await server.close(); }
});

test('unexpected tool arguments and arbitrary working directories are rejected', async () => {
  const { server, client } = await connectMemory({ cliOptions });
  try {
    const r = await client.callTool({ name:'workbuddy_probe', arguments:{cwd:'/tmp',command:'arbitrary'} });
    assert.equal(r.isError,true);
  } finally { await client.close(); await server.close(); }
});
