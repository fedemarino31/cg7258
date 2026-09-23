import { SECTIONS } from './sections.js';
import { buildLabLayout } from '../layout/LabLayout.js';

export class App {
	constructor(topbar, stage) {
		this.topbar = topbar;
		this.stage = stage;
		this.lab = null;
		this.layout = null;
		this.route = { section: null, tab: null };
		window.addEventListener('hashchange', () => this.applyHash());
		const loop = (now) => {
			this.lab?.tick(now);
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
		this.applyHash();
	}

	applyHash() {
		const [, sid, tid] = location.hash.split('/');
		const section = SECTIONS.find((s) => s.id === sid);
		if (!section) return this.show(null, null);
		const tab = section.tabs.find((t) => t.id === tid) || section.tabs[0];
		this.show(section, tab);
	}

	go(section, tab) {
		location.hash = section ? `#/${section.id}/${tab ? tab.id : section.tabs[0].id}` : '#/';
	}

	unmount() {
		this.lab?.dispose();
		this.lab = null;
		this.layout?.dispose();
		this.layout = null;
		this.stage.innerHTML = '';
	}

	show(section, tab) {
		this.route = { section, tab };
		this.unmount();
		this.renderTopbar();
		if (!section) return this.renderHome();
		this.mountLab();
	}

	mountLab() {
		this.unmount();
		const { Lab } = this.route.tab;
		this.layout = buildLabLayout(this.stage, Lab);
		this.lab = new Lab(this.layout);
	}

	reset() {
		if (this.route.tab) this.mountLab();
	}

	renderHome() {
		const home = document.createElement('div');
		home.className = 'home';
		home.innerHTML = `<h1>Laboratorio interactivo de texturas</h1>
			<div class="cards"></div>`;
		const cards = home.querySelector('.cards');
		for (const s of SECTIONS) {
			const b = document.createElement('button');
			b.className = 'card';
			b.innerHTML = `<div class="thumb">${s.thumb}</div>
				<div class="body"><h2><span class="num">${s.number}</span>${s.title}</h2><p>${s.blurb}</p></div>`;
			b.addEventListener('click', () => this.go(s));
			cards.appendChild(b);
		}
		this.stage.appendChild(home);
	}

	renderTopbar() {
		const { section, tab } = this.route;
		const bar = this.topbar;
		bar.innerHTML = '';
		const mk = (txt, cls, fn) => {
			const b = document.createElement('button');
			b.className = 'btn ' + cls;
			b.textContent = txt;
			b.addEventListener('click', fn);
			return b;
		};
		if (!section) {
			bar.style.display = 'none';
			return;
		}
		bar.style.display = '';
		bar.appendChild(mk('Inicio', '', () => this.go(null)));
		const title = document.createElement('span');
		title.className = 'tb-title';
		title.innerHTML = `<span class="num">${section.number}</span>${section.title}`;
		bar.appendChild(title);
		const tabs = document.createElement('nav');
		tabs.className = 'tb-tabs';
		for (const t of section.tabs) {
			const b = mk(t.title, 'tab' + (t === tab ? ' active' : ''), () => this.go(section, t));
			b.setAttribute('aria-current', t === tab ? 'page' : 'false');
			tabs.appendChild(b);
		}
		bar.appendChild(tabs);
		const sp = document.createElement('span');
		sp.className = 'tb-spacer';
		bar.appendChild(sp);
		bar.appendChild(mk('Ayuda', '', () => this.toggleHelp()));
		bar.appendChild(
			mk('Pantalla completa', '', () => {
				if (document.fullscreenElement) document.exitFullscreen();
				else document.documentElement.requestFullscreen?.();
			})
		);
		bar.appendChild(mk('Restablecer', '', () => this.reset()));
	}

	toggleHelp() {
		const old = this.stage.querySelector('.helpbox');
		if (old) return old.remove();
		const items = this.route.tab?.Lab.help || [];
		const box = document.createElement('div');
		box.className = 'helpbox';
		box.innerHTML = `<h3>${this.route.tab.title}: cómo interactuar</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
		box.addEventListener('click', () => box.remove());
		this.stage.appendChild(box);
	}
}
