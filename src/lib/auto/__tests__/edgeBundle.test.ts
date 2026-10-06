import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTFILE, bundleInterpreter } from '../../../../scripts/build-edge-interpreter.mjs';

describe('auto-inbound Edge Function bundle', () => {
  it('interpreter.js is up to date with src/lib/auto (run `npm run build:edge`)', async () => {
    expect(readFileSync(OUTFILE, 'utf8')).toBe(await bundleInterpreter());
  }, 30000);
});
