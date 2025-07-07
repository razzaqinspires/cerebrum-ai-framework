import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // <-- HANYA BUAT format ES Module
  dts: true,       // Tetap buat file definisi tipe
  splitting: false,
  sourcemap: true,
  clean: true,
  // Baris ini memberitahu tsup untuk tidak mengutak-atik dependensi
  // Biarkan Node.js yang menanganinya saat runtime.
  noExternal: [], 
  external: ['@xenova/transformers', 'gpt-3-encoder']
});