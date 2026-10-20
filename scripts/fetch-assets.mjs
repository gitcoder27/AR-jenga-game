#!/usr/bin/env node
/**
 * Self-hosted runtime assets (O-3, H-9). Runs before `dev` and `build`.
 *
 * - The MediaPipe WASM is copied from node_modules, so it always matches the
 *   installed @mediapipe/tasks-vision JS API.
 * - The hand model and the studio HDR aren't in any npm package. They are
 *   downloaded once from pinned URLs, verified by SHA-256, and kept out of
 *   git (see .gitignore). After the first run the app needs no network.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const DOWNLOADS = [
    {
        file: 'mediapipe/hand_landmarker.task',
        sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
        urls: ['https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'],
    },
    {
        // The file drei's <Environment preset="studio"> loads, at the commit drei pins
        file: 'hdri/studio_small_03_1k.hdr',
        sha256: '29267a4aa8c10de26cae758e4e3c4daadde88673798666ad657724bab7224a35',
        urls: [
            'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/studio_small_03_1k.hdr',
            'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/studio_small_03_1k.hdr',
        ],
    },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function download({ file, sha256: expected, urls }) {
    const target = join(pub, file);
    if (existsSync(target) && sha256(readFileSync(target)) === expected) return;
    mkdirSync(dirname(target), { recursive: true });
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const got = sha256(buf);
            if (got !== expected) throw new Error(`sha256 ${got}, expected ${expected}`);
            writeFileSync(target, buf);
            console.log(`fetch-assets: ${file} (${(buf.length / 1e6).toFixed(1)} MB) from ${new URL(url).host}`);
            return;
        } catch (err) {
            console.warn(`fetch-assets: ${url}: ${err.message}`);
        }
    }
    throw new Error(`fetch-assets: could not download ${file}. Connect once, or place the file at public/${file}.`);
}

const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
cpSync(wasmSrc, join(pub, 'mediapipe/wasm'), { recursive: true });

try {
    for (const asset of DOWNLOADS) await download(asset);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
