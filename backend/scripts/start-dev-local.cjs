const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');

const environment = {
  ...process.env,
  JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: randomBytes(48).toString('base64url'),
};

const isWindows = process.platform === 'win32';
const child = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'start:dev'], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit',
  shell: isWindows,
});

console.log('Starting local development with temporary JWT keys held in memory.');

child.on('error', (error) => {
  console.error(`Could not start the NestJS development server: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
