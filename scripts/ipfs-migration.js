#!/usr/bin/env node

/**
 * IPFS Migration Script for Dao DeGen Verse Illustrations
 *
 * Provider-agnostic: supports Pinata, Filebase, or any S3-compatible
 * IPFS pinning service. Set IPFS_PROVIDER env var to select.
 *
 * Usage:
 *   IPFS_PROVIDER=pinata PINATA_JWT=<jwt> node scripts/ipfs-migration.js
 *   IPFS_PROVIDER=filebase FILEBASE_KEY=<key> FILEBASE_SECRET=<secret> FILEBASE_BUCKET=<bucket> node scripts/ipfs-migration.js
 *   IPFS_PROVIDER=kubo KUBO_API=http://localhost:5001 node scripts/ipfs-migration.js
 */

const fs = require('fs').promises;
const path = require('path');

const ILLUSTRATIONS_DIR = path.join(__dirname, '../packages/frontend/public/illustrations');
const VERSES_FILE = path.join(__dirname, '../packages/frontend/src/data/verses.json');
const OUTPUT_FILE = path.join(__dirname, '../ipfs-migration-results.json');

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

// --- Provider implementations ---

async function createProvider() {
  const provider = (process.env.IPFS_PROVIDER || '').toLowerCase();

  switch (provider) {
    case 'pinata':
      return createPinataProvider();
    case 'filebase':
      return createFilebaseProvider();
    case 'kubo':
      return createKuboProvider();
    default:
      console.error(`Unknown IPFS_PROVIDER: "${provider}"`);
      console.error('Supported: pinata, filebase, kubo');
      console.error('');
      console.error('Examples:');
      console.error('  IPFS_PROVIDER=pinata PINATA_JWT=<jwt> node scripts/ipfs-migration.js');
      console.error('  IPFS_PROVIDER=filebase FILEBASE_KEY=<key> FILEBASE_SECRET=<secret> FILEBASE_BUCKET=<bucket> node scripts/ipfs-migration.js');
      console.error('  IPFS_PROVIDER=kubo KUBO_API=http://localhost:5001 node scripts/ipfs-migration.js');
      process.exit(1);
  }
}

function createPinataProvider() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('PINATA_JWT environment variable required for Pinata provider.');
  }

  return {
    name: 'Pinata',

    async validate() {
      const res = await fetch('https://api.pinata.cloud/data/testAuthentication', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error(`Pinata auth failed: ${res.status}`);
      console.log('Pinata authentication successful');
    },

    async upload(filePath, fileName) {
      const fileData = await fs.readFile(filePath);
      const form = new FormData();
      form.append('file', new Blob([fileData]), fileName);
      form.append(
        'pinataMetadata',
        JSON.stringify({ name: fileName, keyvalues: { project: 'dao-degen' } })
      );
      form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Pinata upload failed (${res.status}): ${body}`);
      }

      const data = await res.json();
      return { cid: data.IpfsHash, size: data.PinSize };
    },
  };
}

function createFilebaseProvider() {
  const key = process.env.FILEBASE_KEY;
  const secret = process.env.FILEBASE_SECRET;
  const bucket = process.env.FILEBASE_BUCKET;
  if (!key || !secret || !bucket) {
    throw new Error('FILEBASE_KEY, FILEBASE_SECRET, and FILEBASE_BUCKET required for Filebase provider.');
  }

  // Filebase uses S3-compatible API. The CID is returned in the x-amz-meta-cid header.
  return {
    name: 'Filebase',

    async validate() {
      const res = await fetch(`https://s3.filebase.com/${bucket}`, {
        method: 'HEAD',
        headers: {
          Authorization: `AWS ${key}:${secret}`,
        },
      });
      // HEAD on bucket -- 200 or 404 (empty bucket) both indicate valid creds
      if (res.status >= 500) throw new Error(`Filebase auth failed: ${res.status}`);
      console.log('Filebase credentials validated');
    },

    async upload(filePath, fileName) {
      const fileData = await fs.readFile(filePath);

      const res = await fetch(`https://s3.filebase.com/${bucket}/${fileName}`, {
        method: 'PUT',
        headers: {
          Authorization: `AWS ${key}:${secret}`,
          'Content-Type': 'image/png',
        },
        body: fileData,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Filebase upload failed (${res.status}): ${body}`);
      }

      const cid = res.headers.get('x-amz-meta-cid');
      if (!cid) throw new Error('Filebase response missing x-amz-meta-cid header');
      return { cid, size: fileData.length };
    },
  };
}

function createKuboProvider() {
  const api = process.env.KUBO_API || 'http://localhost:5001';

  return {
    name: 'Kubo (local IPFS node)',

    async validate() {
      const res = await fetch(`${api}/api/v0/id`, { method: 'POST' });
      if (!res.ok) throw new Error(`Kubo API not reachable at ${api}`);
      const data = await res.json();
      console.log(`Kubo node connected: ${data.ID}`);
    },

    async upload(filePath, fileName) {
      const fileData = await fs.readFile(filePath);
      const form = new FormData();
      form.append('file', new Blob([fileData]), fileName);

      const res = await fetch(`${api}/api/v0/add?cid-version=1`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Kubo upload failed (${res.status}): ${body}`);
      }

      const data = await res.json();
      return { cid: data.Hash, size: parseInt(data.Size, 10) };
    },
  };
}

// --- Migration logic ---

async function run() {
  console.log('Starting IPFS migration for Dao DeGen illustrations\n');

  const provider = await createProvider();
  console.log(`Provider: ${provider.name}\n`);

  await provider.validate();

  const files = await fs.readdir(ILLUSTRATIONS_DIR);
  const pngFiles = files.filter((f) => f.endsWith('.png')).sort();
  console.log(`\nFound ${pngFiles.length} PNG files to upload\n`);

  const results = { uploaded: [], errors: [], totalSize: 0 };

  for (let i = 0; i < pngFiles.length; i++) {
    const fileName = pngFiles[i];
    const filePath = path.join(ILLUSTRATIONS_DIR, fileName);
    console.log(`[${i + 1}/${pngFiles.length}] ${fileName}`);

    try {
      const stats = await fs.stat(filePath);
      const { cid, size } = await provider.upload(filePath, fileName);
      console.log(`  -> ${cid}`);
      results.uploaded.push({ fileName, cid, size: size || stats.size });
      results.totalSize += stats.size;
      // Rate limit -- 1 req/s
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.errors.push({ fileName, error: err.message });
    }
  }

  // Update verses.json
  console.log('\nUpdating verses.json with IPFS CIDs...');
  const versesData = JSON.parse(await fs.readFile(VERSES_FILE, 'utf8'));
  let updated = 0;

  for (const verse of versesData) {
    const fileName = path.basename(verse.image);
    const match = results.uploaded.find((u) => u.fileName === fileName);
    if (match) {
      verse.image = `ipfs://${match.cid}`;
      verse.ipfsHash = match.cid;
      updated++;
    }
  }

  await fs.copyFile(VERSES_FILE, `${VERSES_FILE}.backup`);
  await fs.writeFile(VERSES_FILE, JSON.stringify(versesData, null, 2));
  console.log(`Updated ${updated} verses. Backup at verses.json.backup`);

  // Save results
  const summary = {
    timestamp: new Date().toISOString(),
    provider: provider.name,
    totalFiles: results.uploaded.length,
    totalSize: `${(results.totalSize / 1024 / 1024).toFixed(2)} MB`,
    totalErrors: results.errors.length,
    gateways: IPFS_GATEWAYS,
    uploaded: results.uploaded,
    errors: results.errors,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to ${OUTPUT_FILE}`);
  console.log(`Uploaded: ${results.uploaded.length} / ${pngFiles.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nFailed files:');
    results.errors.forEach((e) => console.log(`  ${e.fileName}: ${e.error}`));
  }
}

run().catch((err) => {
  console.error(`\nMigration failed: ${err.message}`);
  process.exit(1);
});
