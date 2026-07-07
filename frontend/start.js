const { spawn } = require('child_process');

const port = process.env.PORT;

if (port) {
  console.log(`Starting production server on port ${port}...`);
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npx.cmd' : 'npx';
  const child = spawn(cmd, ['serve', '-s', 'dist/frontend/browser', '-l', port], { stdio: 'inherit', shell: true });
  child.on('close', (code) => {
    process.exit(code);
  });
} else {
  console.log('No PORT environment variable detected. Launching Angular development server (ng serve)...');
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npx.cmd' : 'npx';
  const child = spawn(cmd, ['ng', 'serve'], { stdio: 'inherit', shell: true });
  child.on('close', (code) => {
    process.exit(code);
  });
}
