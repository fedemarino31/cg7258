// Prueba de humo en un navegador real (Chrome/Edge instalado): node tools/dev/smoke.mjs [url]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5175/';
const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync);
if (!exe) throw new Error('No encuentro Chrome/Edge');

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1700, height: 950 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const count = (sel) => page.$$eval(sel, (a) => a.length);

await page.goto(URL_ + '?ex=ejercicio-11.json', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(URL_ + '?ex=ejercicio-11.json', { waitUntil: 'networkidle0' });
await sleep(300);

check('carga el ejemplo: 9 nodos en el grafo', (await count('[data-node]')) === 9, `${await count('[data-node]')} nodos`);
check('sin problemas de validación', (await text('.status')).includes('Sin problemas'), await text('.status'));

// seleccionar un nodo en el grafo
await page.click('[data-node="n5"]');
await sleep(150);
check('seleccionar nodo muestra la fórmula', (await page.$eval('.textrow input', (e) => e.value)) === 'T(40,0)*E(3,1)');
check('panel de cadena con 3 factores', (await count('.chain li')) === 3, `${await count('.chain li')}`);

// editar por texto → undo
const input = await page.$('.textrow input');
await input.click();
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await input.type('T(40,0)*E(3,1)*R(90)');
await sleep(150);
check('editar fórmula agrega un chip', (await count('.chips .chip')) === 3, `${await count('.chips .chip')}`);
await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
await page.click('body', { offset: { x: 5, y: 500 } }).catch(() => {});
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
await sleep(150);
await page.click('[data-node="n5"]');
await sleep(100);
check('deshacer restaura la fórmula', (await page.$eval('.textrow input', (e) => e.value)) === 'T(40,0)*E(3,1)');

// agregar operación con el botón +
await page.evaluate(() => [...document.querySelectorAll('.chips .add')].at(-1).click());
await sleep(100);
await page.evaluate(() => [...document.querySelectorAll('.picker .chip')].find((b) => b.textContent.startsWith('R')).click());
await sleep(150);
check('agregar R al final', (await page.$eval('.textrow input', (e) => e.value)) === 'T(40,0)*E(3,1)*R(90)');

// reordenar con drag & drop de chips (HTML5): simulado con DataTransfer
await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.chips .chip')];
  const dt = new DataTransfer();
  const fire = (el, type, x) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x }));
  const r = chips[2].getBoundingClientRect();
  fire(chips[2], 'dragstart', r.left + 2);
  const r0 = chips[0].getBoundingClientRect();
  fire(chips[0], 'dragover', r0.left + 1);
  fire(chips[0], 'drop', r0.left + 1);
  fire(chips[2], 'dragend', 0);
});
await sleep(150);
check('drag & drop reordena', (await page.$eval('.textrow input', (e) => e.value)) === 'R(90)*T(40,0)*E(3,1)', await page.$eval('.textrow input', (e) => e.value));
await page.evaluate(() => document.querySelector('header .icon[title^="Deshacer"]').click());
await page.evaluate(() => document.querySelector('header .icon[title^="Deshacer"]').click());
await sleep(150);

// animación
await page.evaluate(() => document.querySelector('.tl .primary').click());
await sleep(1800);
const status = await text('.tl .status');
check('la animación avanza (estado de etapa)', /Etapa \d+\/4/.test(status), status);
await page.evaluate(() => document.querySelector('.tl .primary').click());
await page.evaluate(() => document.querySelector('.tl button[title="Ver resultado final"]').click());

// aislar subárbol
await page.click('[data-node="n2"]');
await sleep(100);
await page.evaluate(() => [...document.querySelectorAll('.graph header button')].find((b) => b.textContent.trim() === 'Aislar').click());
await sleep(150);
check('aislar muestra chip de subárbol aislado', (await text('.scene .chip.iso')) !== null);
await page.evaluate(() => document.querySelector('.scene .chip.iso button').click());

// generar
await page.evaluate(() => [...document.querySelectorAll('.top button')].find((b) => b.textContent.startsWith('Generar')).click());
await sleep(150);
await page.evaluate(() => [...document.querySelectorAll('.dlg button')].find((b) => b.textContent.trim() === 'Generar').click());
await sleep(1500);
check('generar crea un ejercicio válido', (await text('.status')).includes('Sin problemas') && (await count('[data-node]')) > 4, `${await count('[data-node]')} nodos`);

// imprimir
await page.evaluate(() => [...document.querySelectorAll('.top .filemenu > button')][0].click());
await page.evaluate(() => [...document.querySelectorAll('.menu button')].find((b) => b.textContent.includes('Imprimir')).click());
await sleep(300);
check('el diálogo de impresión muestra la hoja', (await count('.sheet')) === 1);
await page.keyboard.press('Escape');

check('sin errores de consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
