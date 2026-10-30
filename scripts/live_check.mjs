import { searchWeb } from '../dist/client.js';
try {
  const results = await searchWeb('bittensor', 10);
  console.log(`Result count: ${results.length}`);
  console.log(`First title: ${(results[0]?.title ?? '').replace(/[\r\n\u001b]/g, ' ')}`);
} catch {
  // No exception details, request headers, or credentials are emitted.
  process.exitCode = 1;
}
