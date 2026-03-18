#!/usr/bin/env node
/**
 * DaoDeGen Production Monitor
 *
 * Checks:
 *   1. Frontend health (/api/health) — daodegen.com + 0xdead.church
 *   2. Facilitator health
 *   3. On-chain: Jar ETH balance (unclaimed fees alert)
 *   4. On-chain: Facilitator wallet ETH balance (gas alert)
 *   5. Ponder indexer lag (block distance from chain head)
 *
 * Alerts via Telegram webhook. Designed to run every 5 minutes via cron or systemd timer.
 *
 * Required env vars:
 *   MONITOR_TELEGRAM_BOT_TOKEN   — Telegram bot token
 *   MONITOR_TELEGRAM_CHAT_ID     — Chat or channel ID to send alerts to
 *   MONITOR_FRONTEND_URL         — e.g. https://daodegen.com (default)
 *   MONITOR_TEMPLE_URL           — e.g. https://0xdead.church (default)
 *   MONITOR_FACILITATOR_URL      — e.g. http://localhost:8402 (default)
 *   MONITOR_RPC_URL              — Unichain mainnet or sepolia RPC
 *   MONITOR_JAR_ADDRESS          — DaoDeGenJar contract address
 *   MONITOR_FACILITATOR_WALLET   — Facilitator EOA address (for balance check)
 *   MONITOR_PONDER_URL           — Ponder indexer API URL
 *   MONITOR_JAR_ALERT_ETH        — Alert if jar balance > this (default 0.1 ETH)
 *   MONITOR_WALLET_LOW_ETH       — Alert if facilitator wallet < this (default 0.01 ETH)
 *   MONITOR_PONDER_LAG_BLOCKS    — Alert if indexer > this many blocks behind (default 100)
 *   MONITOR_STATE_FILE           — Path to persist last-alert state (default /tmp/daodegen-monitor-state.json)
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  frontendUrl:       process.env.MONITOR_FRONTEND_URL     || 'https://daodegen.com',
  templeUrl:         process.env.MONITOR_TEMPLE_URL       || 'https://0xdead.church',
  facilitatorUrl:    process.env.MONITOR_FACILITATOR_URL  || 'http://localhost:8402',
  rpcUrl:            process.env.MONITOR_RPC_URL          || 'https://mainnet.unichain.org',
  jarAddress:        process.env.MONITOR_JAR_ADDRESS      || '0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b',
  facilitatorWallet: process.env.MONITOR_FACILITATOR_WALLET || '',
  ponderUrl:         process.env.MONITOR_PONDER_URL       || 'http://localhost:42069',
  tgToken:           process.env.MONITOR_TELEGRAM_BOT_TOKEN || '',
  tgChatId:          process.env.MONITOR_TELEGRAM_CHAT_ID  || '',
  jarAlertEth:       parseFloat(process.env.MONITOR_JAR_ALERT_ETH    || '0.1'),
  walletLowEth:      parseFloat(process.env.MONITOR_WALLET_LOW_ETH   || '0.01'),
  ponderLagBlocks:   parseInt(process.env.MONITOR_PONDER_LAG_BLOCKS  || '100', 10),
  stateFile:         process.env.MONITOR_STATE_FILE || '/tmp/daodegen-monitor-state.json',
};

// ── Helpers: BigInt-safe ETH formatting ──────────────────────────────────────

/** Convert a float ETH threshold to wei (BigInt). */
function ethToWei(eth) {
  // Multiply by 1e18 via string to avoid float precision issues
  const [whole = '0', frac = ''] = String(eth).split('.');
  const padded = (frac + '000000000000000000').slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(padded);
}

/** Format wei (BigInt) as a decimal ETH string with 6 decimal places. */
function weiToEthString(wei) {
  const sign = wei < 0n ? '-' : '';
  const abs = wei < 0n ? -wei : wei;
  const whole = abs / 10n ** 18n;
  const remainder = abs % 10n ** 18n;
  const frac = remainder.toString().padStart(18, '0').slice(0, 6);
  return `${sign}${whole}.${frac}`;
}

// ── State (throttle duplicate alerts) ────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8')); } catch { return {}; }
}
function saveState(state) {
  try { fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2)); } catch {}
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const timeout = opts.timeout || 8000;
    const req = lib.request(url, { method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function rpcCall(method, params = []) {
  return fetchJson(CONFIG.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }).then(r => r.data?.result);
}

// ── Telegram alert ────────────────────────────────────────────────────────────

async function sendAlert(message) {
  if (!CONFIG.tgToken || !CONFIG.tgChatId) {
    console.error('[monitor] No Telegram config — would alert:', message);
    return;
  }
  try {
    await fetchJson(`https://api.telegram.org/bot${CONFIG.tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.tgChatId,
        text: `🚨 *DaoDeGen Monitor*\n\n${message}`,
        parse_mode: 'Markdown',
      }),
    });
    console.log('[monitor] Alert sent:', message.slice(0, 80));
  } catch (err) {
    console.error('[monitor] Failed to send alert:', err.message);
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkHealth(name, url) {
  try {
    const { status, data } = await fetchJson(`${url}/api/health`);
    const ok = status === 200 && data?.status === 'ok';
    const degraded = status === 200 && data?.status === 'degraded';
    return {
      name,
      ok,
      degraded,
      detail: degraded
        ? Object.entries(data?.checks || {})
            .filter(([, v]) => v.status !== 'ok')
            .map(([k, v]) => `${k}: ${v.error || 'fail'}`)
            .join(', ')
        : null,
    };
  } catch (err) {
    return { name, ok: false, degraded: false, error: err.message };
  }
}

async function checkFacilitator() {
  try {
    const { status, data } = await fetchJson(`${CONFIG.facilitatorUrl}/`);
    const ok = status === 200 && Array.isArray(data);
    return { name: 'facilitator', ok, error: ok ? null : `HTTP ${status}` };
  } catch (err) {
    return { name: 'facilitator', ok: false, error: err.message };
  }
}

async function checkJarBalance() {
  try {
    // eth_getBalance for the jar contract
    const hex = await rpcCall('eth_getBalance', [CONFIG.jarAddress, 'latest']);
    const wei = BigInt(hex || '0x0');
    const alert = wei > ethToWei(CONFIG.jarAlertEth);
    return { name: 'jar_balance', eth: weiToEthString(wei), alert, ok: true };
  } catch (err) {
    return { name: 'jar_balance', ok: false, error: err.message };
  }
}

async function checkFacilitatorWallet() {
  if (!CONFIG.facilitatorWallet) return null;
  try {
    const hex = await rpcCall('eth_getBalance', [CONFIG.facilitatorWallet, 'latest']);
    const wei = BigInt(hex || '0x0');
    const low = wei < ethToWei(CONFIG.walletLowEth);
    return { name: 'facilitator_wallet', eth: weiToEthString(wei), low, ok: true };
  } catch (err) {
    return { name: 'facilitator_wallet', ok: false, error: err.message };
  }
}

async function checkPonderLag() {
  try {
    // Get chain head
    const chainHeadHex = await rpcCall('eth_blockNumber');
    const chainHead = parseInt(chainHeadHex, 16);

    // Get Ponder's indexed block
    const { data } = await fetchJson(`${CONFIG.ponderUrl}/status`);
    const ponderBlock = data?.blockNumber || data?.lastIndexedBlock || 0;

    const lag = chainHead - ponderBlock;
    const behind = lag > CONFIG.ponderLagBlocks;
    return { name: 'ponder_lag', chainHead, ponderBlock, lag, behind, ok: true };
  } catch (err) {
    return { name: 'ponder_lag', ok: false, error: err.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const state = loadState();
  const now = Date.now();
  const alerts = [];

  const [frontend, temple, facilitator, jar, wallet, ponder] = await Promise.all([
    checkHealth('daodegen.com', CONFIG.frontendUrl),
    checkHealth('0xdead.church', CONFIG.templeUrl),
    checkFacilitator(),
    checkJarBalance(),
    checkFacilitatorWallet(),
    checkPonderLag(),
  ]);

  // Log summary
  for (const c of [frontend, temple, facilitator, jar, wallet, ponder]) {
    if (!c) continue;
    const status = c.ok ? (c.degraded || c.alert || c.low || c.behind ? '⚠️' : '✅') : '❌';
    console.log(`[monitor] ${status} ${c.name}`, JSON.stringify({
      ...c, name: undefined
    }));
  }

  // --- Health alerts (throttle: once per 15min) ---
  for (const check of [frontend, temple]) {
    if (!check) continue;
    const key = `health_${check.name}`;
    const lastAlert = state[key] || 0;
    const throttle = 15 * 60 * 1000;
    if (!check.ok && now - lastAlert > throttle) {
      alerts.push(`*${check.name}* is DOWN\nError: ${check.error || 'no response'}`);
      state[key] = now;
    } else if (check.degraded && now - lastAlert > throttle) {
      alerts.push(`*${check.name}* is DEGRADED\nFailing checks: ${check.detail}`);
      state[key] = now;
    } else if (check.ok && !check.degraded) {
      delete state[key]; // clear alert state when recovered
    }
  }

  // --- Facilitator down (throttle: once per 15min) ---
  if (facilitator && !facilitator.ok) {
    const key = 'facilitator_down';
    if (now - (state[key] || 0) > 15 * 60 * 1000) {
      alerts.push(`*Facilitator* is DOWN\nError: ${facilitator.error}`);
      state[key] = now;
    }
  } else if (facilitator?.ok) {
    delete state['facilitator_down'];
  }

  // --- Jar balance (throttle: once per 4h) ---
  if (jar?.ok && jar.alert) {
    const key = 'jar_high';
    if (now - (state[key] || 0) > 4 * 60 * 60 * 1000) {
      alerts.push(`*DaoDeGenJar* balance is high: ${jar.eth} ETH\nFees may be accumulating unclaimed — consider calling \`release()\``);
      state[key] = now;
    }
  } else if (jar?.ok && !jar.alert) {
    delete state['jar_high'];
  }

  // --- Facilitator wallet low (throttle: once per 1h) ---
  if (wallet?.ok && wallet.low) {
    const key = 'wallet_low';
    if (now - (state[key] || 0) > 60 * 60 * 1000) {
      alerts.push(`*Facilitator wallet* is low on gas: ${wallet.eth} ETH\nAddress: \`${CONFIG.facilitatorWallet}\``);
      state[key] = now;
    }
  } else if (wallet?.ok && !wallet.low) {
    delete state['wallet_low'];
  }

  // --- Ponder lag (throttle: once per 30min) ---
  if (ponder?.ok && ponder.behind) {
    const key = 'ponder_lag';
    if (now - (state[key] || 0) > 30 * 60 * 1000) {
      alerts.push(`*Ponder indexer* is ${ponder.lag} blocks behind chain head (${ponder.chainHead})\nLast indexed: ${ponder.ponderBlock}`);
      state[key] = now;
    }
  } else if (ponder?.ok && !ponder.behind) {
    delete state['ponder_lag'];
  }

  // Send alerts
  for (const msg of alerts) {
    await sendAlert(msg);
  }

  saveState(state);
  console.log(`[monitor] Done. ${alerts.length} alert(s) sent.`);
}

run().catch((err) => {
  console.error('[monitor] Fatal:', err);
  process.exit(1);
});
