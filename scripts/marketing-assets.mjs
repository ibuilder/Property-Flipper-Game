#!/usr/bin/env node
/**
 * The store art, cut to the sizes each storefront actually wants.
 *
 * Two pieces of commissioned key art in `docs/marketing/source/`, and every
 * shop wants them at a different aspect ratio. Doing that by hand means the day
 * one of them is recropped the others quietly disagree, so it is done here and
 * the outputs are build artefacts that happen to be committed -- same argument
 * as the contact sheets and the screenshots.
 *
 * What this deliberately does *not* produce is store screenshots. Those come
 * from `npm run shots`, which photographs the running game. Key art is allowed
 * to be a poster; a screenshot is a claim about what the software looks like.
 *
 *     node scripts/marketing-assets.mjs
 */
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fit, readPng, writePng } from './image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'docs', 'marketing', 'source');
const out = path.join(root, 'docs', 'marketing');

/*
 * `anchorY` is the interesting parameter and it is not 0.5.
 *
 * Both pieces put the title in the upper third, which is where a poster puts a
 * title. A centred crop to a wide banner cuts the top off the lettering and
 * leaves a strip of lawn, so the banner is anchored high. The cover is close to
 * the source ratio and only loses width, so it stays centred.
 */
const JOBS = [
  {
    file: 'cover-630x500.png',
    from: 'key-art-cutaway.png',
    w: 630,
    h: 500,
    anchorY: 0.5,
    note: 'itch.io cover / thumbnail. Shown in browse and search listings.',
  },
  {
    file: 'banner-1920x620.png',
    from: 'key-art-before-after.png',
    w: 1920,
    h: 620,
    anchorY: 0.05,
    note: 'itch.io page banner, above the description.',
  },
  {
    file: 'social-1200x630.png',
    from: 'key-art-before-after.png',
    w: 1200,
    h: 630,
    anchorY: 0.08,
    note: 'Open Graph / link preview card for anywhere the URL gets pasted.',
  },
];

mkdirSync(out, { recursive: true });

let failed = false;
for (const job of JOBS) {
  const from = path.join(src, job.from);
  try {
    const img = readPng(from);
    const dest = path.join(out, job.file);
    writePng(dest, fit(img, job.w, job.h, job.anchorY));
    const kb = Math.round(statSync(dest).size / 1024);
    console.log(`  ${job.file.padEnd(24)} ${job.w}x${job.h}  ${String(kb).padStart(4)}kB  ${job.note}`);
  } catch (err) {
    failed = true;
    console.error(`  ${job.file}: ${err.message}`);
  }
}

if (failed) {
  console.error('\nmarketing: at least one asset could not be written.');
  process.exit(1);
}
console.log(`\nmarketing: ${JOBS.length} assets in docs/marketing/`);
