import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: path.resolve(__dirname, '../resume-dist'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/embed.tsx'),
      name: 'ResumeBuilderEmbed',
      formats: ['iife'],
      fileName: () => 'resume-builder.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) => (info.names?.[0]?.endsWith('.css') ? 'resume-builder.css' : '[name]-[hash][extname]'),
        inlineDynamicImports: true,
      },
    },
  },
});
