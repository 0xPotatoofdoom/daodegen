import { chromium } from 'playwright'

const BASE = 'http://localhost:3033'
const TIMEOUT = 60_000

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser] ${msg.text()}`)
  })
  page.on('pageerror', err => console.log(`  [pageerror] ${err.message}`))
  let pass = 0
  let fail = 0

  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      console.log(`  PASS  ${name}`)
      pass++
    } catch (e: any) {
      console.log(`  FAIL  ${name}: ${e.message}`)
      fail++
    }
  }

  // 1. Homepage loads
  await check('Homepage loads', async () => {
    await page.goto(BASE, { waitUntil: 'load', timeout: TIMEOUT })
    await page.waitForSelector('h1', { timeout: TIMEOUT })
    const h1 = await page.textContent('h1')
    if (!h1?.includes('Dao DeGen')) throw new Error(`h1 was "${h1}"`)
  })

  // 2. No emoji on homepage
  await check('No emoji on homepage', async () => {
    const text = await page.textContent('body')
    // Common emoji ranges
    const emojiRe = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}]/u
    if (emojiRe.test(text || '')) throw new Error('Found emoji on homepage')
  })

  // 3. "Think for yourself" heading present
  await check('"Think for yourself" heading', async () => {
    const text = await page.textContent('body')
    if (!text?.includes('Think for yourself the best path forward')) throw new Error('Missing heading')
  })

  // 4. For Humans section
  await check('For Humans section present', async () => {
    const text = await page.textContent('body')
    if (!text?.includes('For Humans')) throw new Error('Missing For Humans')
  })

  // 5. For Agents section
  await check('For Agents section present', async () => {
    const text = await page.textContent('body')
    if (!text?.includes('For Agents')) throw new Error('Missing For Agents')
  })

  // 6. Email signup form present
  await check('Email signup form present', async () => {
    await page.waitForSelector('input[type="email"]', { timeout: TIMEOUT })
  })

  // 7. Footer links present
  await check('Footer links present', async () => {
    const links = await page.$$eval('footer a', els => els.map(e => e.getAttribute('href')))
    const expected = ['xykdoesntcare.com', 'internetmoneyisserious.business', 'x.com/daodegenbook', 'github.com/0xPotatoofdoom']
    for (const href of expected) {
      if (!links.some(l => l?.includes(href))) throw new Error(`Missing footer link: ${href}`)
    }
  })

  // 8. Navigate to /verses
  await check('Navigate to /verses', async () => {
    await page.click('a[href="/verses"], a[href="/verses/"]', { timeout: TIMEOUT })
    await page.waitForURL(/\/verses/, { timeout: TIMEOUT })
    await page.waitForSelector('h1', { timeout: TIMEOUT })
  })

  // 9. Click into verse 1
  await check('Click into verse 1', async () => {
    await page.click('a[href="/verse/1"], a[href="/verse/1/"]', { timeout: TIMEOUT })
    await page.waitForURL(/\/verse\/1/, { timeout: TIMEOUT })
    await page.waitForSelector('h1', { timeout: TIMEOUT })
    const h1 = await page.textContent('h1')
    if (!h1?.includes('Eternal Protocol')) throw new Error(`h1 was "${h1}"`)
  })

  // 10. Close button navigates back to /verses
  await check('Close button works', async () => {
    await page.click('a:has-text("Close")', { timeout: TIMEOUT })
    await page.waitForURL(/\/verses/, { timeout: TIMEOUT })
  })

  // 11. Navigate back home
  await check('Navigate back to home', async () => {
    await page.click('a[href="/"], a[href="/home"]', { timeout: TIMEOUT })
    await page.waitForURL(/localhost:3033\/$/, { timeout: TIMEOUT })
  })

  // 12. Stats bar has skeletons or data
  await check('Stats bar renders', async () => {
    await page.goto(BASE, { waitUntil: 'load', timeout: TIMEOUT })
    // Either skeleton loaders or actual stat values should be present
    const statsSection = await page.$('.grid.grid-cols-2')
    if (!statsSection) throw new Error('Stats grid not found')
  })

  // 13. Mobile viewport check
  await check('Mobile responsive (375px)', async () => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE, { waitUntil: 'load', timeout: TIMEOUT })
    await page.waitForSelector('h1', { timeout: TIMEOUT })
    const h1Box = await page.$eval('h1', el => {
      const rect = el.getBoundingClientRect()
      return { width: rect.width, visible: rect.width > 0 && rect.height > 0 }
    })
    if (!h1Box.visible) throw new Error('h1 not visible at 375px')
    if (h1Box.width > 375) throw new Error(`h1 overflows viewport: ${h1Box.width}px`)
  })

  // 14. Email signup endpoint works
  await check('POST /api/notify/ returns 200', async () => {
    const res = await page.request.post(`${BASE}/api/notify/`, {
      data: { email: 'playwright@test.dev' },
    })
    if (res.status() !== 200) throw new Error(`Status: ${res.status()}`)
    const body = await res.json()
    if (!body.ok) throw new Error(`Response: ${JSON.stringify(body)}`)
  })

  await browser.close()

  console.log(`\nResults: ${pass} passed, ${fail} failed out of ${pass + fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
