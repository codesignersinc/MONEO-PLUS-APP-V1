import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTFILES, bundleInterpreter } from '../../../../scripts/build-edge-interpreter.mjs';

describe('Edge Function interpreter bundles', () => {
  it('interpreter.js is up to date with src/lib/auto (run `npm run build:edge`)', async () => {
    const code = await bundleInterpreter();
    for (const file of OUTFILES) expect(readFileSync(file, 'utf8')).toBe(code);
  }, 30000);
});
