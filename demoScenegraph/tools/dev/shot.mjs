import puppeteer from 'puppeteer-core';
const [,, out, url, ...steps] = process.argv;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1700, height: 950 });
await page.goto(url, { waitUntil: 'networkidle0' });
for (const s of steps) { await page.evaluate(s); await new Promise((r) => setTimeout(r, 250)); }
await page.screenshot({ path: out });
await browser.close();
