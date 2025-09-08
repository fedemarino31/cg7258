import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	server: {
		port: 10001, // Personaliza el puerto aquí
	},
	build: {
		outDir: 'dist', // Personaliza el directorio de salida aquí
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'demoInstancedGeometry.html'),
			},
		},
	},
	base: './', // Personaliza el directorio base de los links del HTML aquí
});
