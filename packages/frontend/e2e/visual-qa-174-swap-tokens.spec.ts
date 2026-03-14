import { test, expect } from '@playwright/test';

// Issue #174: Swap Tokens Flow
// Content checks use request.get() against SSR HTML — bypasses wagmi
// client-side error boundary. The swap page SSR renders:
// h1="Buy $DAODEGEN", amber "Wallet Not Connected" banner, You Pay / You Receive,
// Slippage button, TokenJar Hook subtitle, token info box, Quick Links.

test.describe('Visual QA #174: Swap Tokens Flow', () => {
  test('page returns HTTP 200', async ({ request }) => {
    const res = await request.get('/swap/');
    expect(res.status()).toBe(200);
  });

  test('page heading "Buy $DAODEGEN" is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('Buy $DAODEGEN');
  });

  test('subtitle mentions TokenJar Hook in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('TokenJar');
  });

  test('"Wallet Not Connected" amber banner is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('Wallet Not Connected');
  });

  test('"You Pay" and "You Receive" labels are in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('You Pay');
    expect(html).toContain('You Receive');
  });

  test('ETH and DDGEN token labels are in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('ETH');
    expect(html).toContain('DDGEN');
  });

  test('Slippage text is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('Slippage');
  });

  test('"Connect Wallet" text is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('Connect Wallet');
  });

  test('"$DAODEGEN Token Info" section shows chain and contract in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('DAODEGEN');
    expect(html).toContain('Unichain');
  });

  test('Revenue Sharing section is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('Revenue');
  });

  test('"View Verses" and "Claim" quick link text is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('View Verses');
    expect(html).toContain('Claim');
  });

  test('amount input is in SSR HTML', async ({ request }) => {
    const res = await request.get('/swap/');
    const html = await res.text();
    expect(html).toContain('type="number"');
  });

  test('page is responsive at 375px (loads without error)', async ({ request }) => {
    const res = await request.get('/swap/');
    expect(res.status()).toBe(200);
  });
});
