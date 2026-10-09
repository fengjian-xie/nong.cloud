// Deterministic fixture, not an AI session or a substitute for a live result.
const args = process.argv.slice(2);
if (args.includes('--timeout-fixture')) {
  setTimeout(() => {}, 10_000);
} else if (args.includes('--stderr-fixture')) {
  console.error('Please login. token=do-not-print-this-fixture-secret');
} else if (args.includes('--json-error-fixture')) {
  console.log(JSON.stringify({ result: 'Authentication failed; secret=do-not-print-this-fixture-secret', is_error: true }));
} else {
  console.log(JSON.stringify({ result: args.at(-1).includes('WORKBUDDY_BRIDGE_READY') ? 'WORKBUDDY_BRIDGE_READY' : '建议统一金额为整数分；这只是审查建议。', is_error: false }));
}
