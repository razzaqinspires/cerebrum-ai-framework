// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'examples/final_chat_example.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});