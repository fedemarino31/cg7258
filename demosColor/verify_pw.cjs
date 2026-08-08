const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  
  try {
    await page.goto('http://localhost:10001', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'C:/Users/Fede/AppData/Local/Temp/verify_initial.png' });
    console.log('Title:', await page.title());
    console.log('Errors:', JSON.stringify(errors));
    console.log('Toolbar:', !!(await page.#view-toolbar));
    console.log('DotsBtn:', !!(await page.#btn-dots));
    console.log('PerspBtn:', !!(await page.#btn-perspective));
  } catch(e) {
    console.log('Error:', e.message);
    try { await page.screenshot({ path: 'C:/Users/Fede/AppData/Local/Temp/verify_error.png' }); } catch(_){}
  }
  await browser.close();
})();
