// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Hanya build library, bukan contoh
  format: ['esm'], // <-- HANYA BUAT ESM
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false, // <-- Jadikan satu file agar lebih sederhana
  minify: false,
});