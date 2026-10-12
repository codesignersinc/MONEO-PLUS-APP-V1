import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bankForApp } from '../index';

// MONEO AUTO on Android: the phone (AutoListener.PACKAGES) and the server (auto-notify APPS)
// must accept exactly the same bank apps.
const root = `${__dirname}/../../../..`;
const java = readFileSync(
  `${root}/android/app/src/main/java/plus/moneo/app/auto/AutoListener.java`,
  'utf8'
);
const edge = readFileSync(`${root}/supabase/functions/auto-notify/index.ts`, 'utf8');

const javaPackages = [...java.matchAll(/^\s*"([a-z0-9_.]+)",/gm)].map((m) => m[1]).sort();
const edgeApps = Object.fromEntries(
  [...edge.matchAll(/^\s*'([a-z0-9_.]+)': '([A-Za-z]+)',/gm)].map((m) => [m[1], m[2]])
);

describe('MONEO AUTO bank apps', () => {
  it('the phone and auto-notify accept the same packages', () => {
    expect(javaPackages).toHaveLength(4);
    expect(Object.keys(edgeApps).sort()).toEqual(javaPackages);
  });

  it('each app name maps to its bank in the interpreter', () => {
    expect(Object.values(edgeApps).map((name) => bankForApp(name))).toEqual([
      'yape',
      'bcp',
      'interbank',
      'bbva',
    ]);
  });
});
