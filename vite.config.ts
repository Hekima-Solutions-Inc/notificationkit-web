import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

type Lib = 'sdk' | 'worker';

const libConfig: Record<Lib, { entry: string; name: string; formats: ('es' | 'cjs' | 'iife')[]; fileName: (format: string) => string }> = {
  sdk: {
    entry: './src/entries/sdk.ts',
    name: 'NotificationKit',
    formats: ['es', 'cjs', 'iife'],
    fileName: (format: string) => {
      if (format === 'es') return 'notificationkit.mjs';
      if (format === 'cjs') return 'notificationkit.cjs';
      return 'notificationkit.iife.js';
    },
  },
  worker: {
    entry: './src/entries/worker.ts',
    name: 'NotificationKitWorker',
    formats: ['iife'],
    fileName: () => 'NotificationKitWorker.js',
  },
};

export default defineConfig(({ mode }) => {
  const lib = (process.env.LIB || 'sdk') as Lib;
  const config = libConfig[lib];
  const isProd = mode === 'production';

  return {
    plugins: [
      ...(lib === 'sdk'
        ? [dts({ rollupTypes: true, outDir: 'dist', include: ['src'] })]
        : []),
    ],
    build: {
      target: 'es2022',
      minify: isProd ? 'terser' : false,
      terserOptions: isProd
        ? {
            compress: { passes: 2 },
            mangle: {
              properties: { regex: /^_/, keep_quoted: true },
            },
          }
        : undefined,
      lib: {
        entry: config.entry,
        name: config.name,
        formats: config.formats,
        fileName: config.fileName,
      },
      outDir: 'dist',
      emptyOutDir: lib === 'sdk',
      sourcemap: true,
      rollupOptions: {
        treeshake: lib === 'worker' ? false : 'smallest',
      },
    },
    define: {
      __VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    },
  };
});
