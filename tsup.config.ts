// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false,
  platform: 'node',
  // --- PERUBAHAN PALING PENTING ADA DI SINI ---
  // Baris ini memberitahu tsup: "Jangan gabungkan paket-paket dari node_modules
  // ke dalam hasil build. Biarkan mereka sebagai 'import' atau 'require' biasa."
  noExternal: [],
  external: ['gpt-3-encoder', '@xenova/transformers'], // Daftarkan paket yang menyebabkan masalah
});