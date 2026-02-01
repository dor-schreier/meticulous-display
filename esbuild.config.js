const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

// Ensure dist/client directories exist
const dirs = ['dist/client', 'dist/client/js', 'dist/client/styles'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy static files
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

// Copy HTML
copyFile('src/client/index.html', 'dist/client/index.html');

// Copy CSS
copyFile('src/client/styles/main.css', 'dist/client/styles/main.css');

// Bundle JavaScript
esbuild.build({
  entryPoints: ['src/client/js/app.js'],
  bundle: true,
  outfile: 'dist/client/js/app.js',
  format: 'iife',
  minify: isProduction,
  sourcemap: !isProduction,
  target: ['es2020'],
  external: [], // Bundle everything
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
  }
}).then(() => {
  console.log('Client JS bundled successfully!');
}).catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});

console.log('Client files copied successfully!');
