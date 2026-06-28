import * as esbuild from 'esbuild';
const shared = { entryPoints: ['src/index.ts'], bundle: true, sourcemap: true, platform: 'node', target: ['node18'], logLevel: 'info' };
await esbuild.build({ ...shared, format: 'esm', outfile: 'dist/index.js' });
await esbuild.build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' });
console.log('dist/ собран: index.js (esm) + index.cjs');
