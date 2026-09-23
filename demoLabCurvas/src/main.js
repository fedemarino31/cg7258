import './styles.css';
import 'katex/dist/katex.min.css';
import { BezierLab } from './ui/app.js';

const lab = new BezierLab(document.querySelector('#app'));
lab.start();
window.__BEZIER_LAB__ = lab;
