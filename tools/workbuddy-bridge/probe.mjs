import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const bundledCli = '/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy';

export function classifyFailure(text) {
  if (/EPERM|EACCES|operation not permitted|permission denied/i.test(text)) return 'local_permission';
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|network error|fetch failed/i.test(text)) return 'network';
  if (/401|not logged|not authenticated|login required|please log|unauthorized|未登录|请登录|需要登录|登录鉴权失败|认证失败/i.test(text)) return 'authentication';
  if (/429|quota|余额不足|额度不足|rate.limit/i.test(text)) return 'quota';
  if (/login|authenticat|登录|鉴权|认证/i.test(text)) return 'authentication';
  return 'cli_failed';
}

export function safeEnvironment() {
  // Preserve the original system paths; never inherit business/API credentials.
  const env = {};
  for (const key of ['HOME','PATH','USER','LOGNAME','SHELL','LANG','LC_ALL','TMPDIR','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','SSL_CERT_FILE','SSL_CERT_DIR']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

export function runCli(args, { cwd, timeoutMs = 45_000, configDir, cliPath = bundledCli } = {}) {
  return new Promise((resolve) => {
    // Do not let CLI startup automatically load instructions from the business repo.
    const isolatedCwd = cwd ?? mkdtempSync(join(tmpdir(), 'xiangqiao-workbuddy-probe-'));
    const env = {
      ...safeEnvironment(),
      DISABLE_TELEMETRY: '1',
      DISABLE_ERROR_REPORTING: '1',
      DISABLE_AUTOUPDATER: '1',
      CODEBUDDY_DISABLE_COMPILE_CACHE: '1',
      CODEBUDDY_MAX_RETRIES: '0',
      CODEBUDDY_FIRST_TOKEN_TIMEOUT_MS: '30000',
    };
    if (configDir) env.CODEBUDDY_CONFIG_DIR = configDir;
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: isolatedCwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let out = '';
    let err = '';
    let timedOut = false;
    const cap = 2_000_000;
    child.stdout.on('data', (data) => { if (out.length < cap) out += data.toString(); });
    child.stderr.on('data', (data) => { if (err.length < cap) err += data.toString(); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    let killTimer;
    child.on('exit', () => { clearTimeout(timer); clearTimeout(killTimer); });
    const terminateTimer = setTimeout(() => {
      if (timedOut && child.exitCode === null) child.kill('SIGKILL');
    }, timeoutMs + 2_000);
    killTimer = terminateTimer;
    child.once('error', (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({ ok: false, category: error.code === 'ENOENT' ? 'cli_not_found' : 'spawn_failed' });
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (timedOut) return resolve({ ok: false, category: 'timeout', code, signal });
      // Do not log raw output: upstream CLI errors can contain credentials or headers.
      const candidates = [out.trim(), ...out.trim().split('\n').reverse()];
      const jsonShapes = [];
      for (const candidate of candidates) {
        try {
          const data = JSON.parse(candidate);
          if (data && typeof data === 'object' && !Array.isArray(data)) jsonShapes.push(Object.keys(data).slice(0,20));
          if (typeof data.result === 'string') {
            return resolve({
              ok: code === 0 && data.is_error !== true,
              category: code === 0 && data.is_error !== true ? 'success' : classifyFailure(data.result),
              result: data.result,
              code,
            });
          }
        } catch { /* Try the next JSON line. */ }
      }
      resolve({
        ok: false, category: classifyFailure(out + '\n' + err), code, jsonOutputFound: false,
        diagnostics: {
          stdoutChars: out.length, stderrChars: err.length, jsonShapes: jsonShapes.slice(0,3),
          mentionsLogin: /login|authenticat|登录|鉴权|认证/i.test(out + err),
          mentionsUnknownOption: /unknown option|unknown argument|未知参数/i.test(out + err),
          mentionsToken: /token|credential|凭证/i.test(out + err),
          mentionsPlan: /plan|计划模式/i.test(out + err),
          mentionsError: /error|错误|失败/i.test(out + err),
        },
      });
    });
  });
}

export const noToolsArgs = [
  '--print',
  '--output-format', 'json',
  '--tools', '',
  '--strict-mcp-config',
  '--mcp-config', '{"mcpServers":{}}',
  '--setting-sources', '',
  '--settings', '{"disableAllHooks":true,"enabledPlugins":{}}',
  '--permission-mode', 'plan',
  '--no-session-persistence',
  '--max-turns', '1',
];

export async function probe(options = {}) {
  const response = await runCli([...noToolsArgs, '这是连接测试，不使用任何工具，不读取任何文件、不调用其他服务。请仅回复 WORKBUDDY_BRIDGE_READY。'], options);
  if (response.ok && response.result.trim() === 'WORKBUDDY_BRIDGE_READY') {
    return { ok: true, category: 'success', reply: 'WORKBUDDY_BRIDGE_READY', toolsEnabled: false, externalBusinessWrites: false };
  }
  const { result, ...safe } = response;
  return { ...safe, ok: false, ...(response.ok ? { category: 'unexpected_reply' } : {}) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await probe({ configDir: process.env.XQ_WB_CONFIG_DIR }), null, 2));
}
