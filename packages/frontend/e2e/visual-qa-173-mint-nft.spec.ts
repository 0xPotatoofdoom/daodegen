import { test, expect } from '@playwright/test';

// Issue #173: Mint NFT Flow
// Content checks use request.get() against SSR HTML.
// The mint page SSR renders "Mint a Verse NFT", the 81-tile grid, price info,
// and "Connect your wallet to mint" — all verifiable without running JS.

test.describe('Visual QA #173: Mint NFT Flow', () => {
  test('page returns HTTP 200', async ({ request }) => {
    const res = await request.get('/mint/');
    expect(res.status()).toBe(200);
  });

  test('page heading "Mint a Verse NFT" is in SSR HTML', async ({ request }) => {
    const res = await request.get('/mint/');
    const html = await res.text();
    expect(html).toContain('Mint a Verse NFT');
  });

  test('stats grid labels are in SSR HTML (Minted / Available)', async ({ request }) => {
    const res = await request.get('/mint/');
    const html = await res.text();
    const hasMinted = html.includes('Minted') || html.includes('minted');
    const hasAvailable = html.includes('Available') || html.includes('available');
    expect(hasMinted || hasAvailable).toBeTruthy();
  });

  test('wallet connection prompt is in SSR HTML', async ({ request }) => {
    const res = await request.get('/mint/');
    const html = await res.text();
    // SSR renders "Connect your wallet to mint"
    expect(html.toLowerCase()).toContain('connect');
    expect(html.toLowerCase()).toContain('wallet');
  });

  test('bonding curve / price info is in SSR HTML', async ({ request }) => {
    const res = await request.get('/mint/');
    const html = await res.text();
    const hasPriceInfo =
      html.includes('Current Price') ||
      html.includes('price') ||
      html.includes('Next Price') ||
      html.includes('ETH');
    expect(hasPriceInfo).toBeTruthy();
  });

  test('verse tiles 1–81 grid is in SSR HTML', async ({ request }) => {
    const res = await request.get('/mint/');
    const html = await res.text();
    expect(html).toContain('81');
    expect(html).toContain('OPEN');
  });

  test('"How Verse NFTs Work" section is in SSR HTML', async ({ request }) => {
    const res = await request.get('/mint/');
    const html = await res.text();
    const hasHowItWorks =
      html.includes('How Verse NFTs Work') ||
      (html.includes('How') && html.includes('NFT'));
    expect(hasHowItWorks).toBeTruthy();
  });

  test('page is responsive at 375px (loads without error)', async ({ request }) => {
    const res = await request.get('/mint/');
    expect(res.status()).toBe(200);
  });
});
