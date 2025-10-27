import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 10001, // Personaliza el puerto aquí
	},
	build: {
		outDir: 'dist', // Personaliza la carpeta de salida del build aquí
	},
	base: './', // Personaliza el directorio base de los links del HTML aquí
});
