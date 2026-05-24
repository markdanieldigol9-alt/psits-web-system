import { execFileSync } from 'node:child_process';

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' });
}

function toPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function unique(values) {
  return [...new Set(values)];
}

function ensurePortFreeWin32(port) {
  const output = run('netstat', ['-ano', '-p', 'TCP']);
  const pids = unique(
    output
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /\sLISTENING\s/i.test(line))
      .filter((line) => new RegExp(`:${port}\\s`).test(line))
      .map((line) => line.split(/\s+/).at(-1))
      .filter((pid) => pid && /^\d+$/.test(pid))
  );

  if (pids.length === 0) return;

  for (const pid of pids) {
    const tasklist = run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']).trim();
    const processName = tasklist.split(',')[0]?.replaceAll('"', '').trim();

    if (!processName) continue;
    if (!/^node(\.exe)?$/i.test(processName)) {
      // eslint-disable-next-line no-console
      console.error(`Port ${port} is already in use by PID ${pid} (${processName}). Refusing to kill a non-node process.`);
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Port ${port} in use by PID ${pid} (${processName}); stopping it...`);
    run('taskkill', ['/PID', pid, '/F', '/T']);
  }
}

function ensurePortFreePosix(port) {
  let pids = [];
  try {
    const output = run('lsof', ['-ti', `:${port}`]).trim();
    pids = unique(output.split(/\r?\n/g).map((v) => v.trim()).filter(Boolean));
  } catch {
    return;
  }

  for (const pid of pids) {
    let comm = '';
    try {
      comm = run('ps', ['-p', pid, '-o', 'comm=']).trim();
    } catch {
      continue;
    }

    if (!/^node$/i.test(comm)) {
      // eslint-disable-next-line no-console
      console.error(`Port ${port} is already in use by PID ${pid} (${comm}). Refusing to kill a non-node process.`);
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Port ${port} in use by PID ${pid} (${comm}); stopping it...`);
    run('kill', ['-9', pid]);
  }
}

const port = toPort(process.argv[2] ?? '3000');
if (process.platform === 'win32') ensurePortFreeWin32(port);
else ensurePortFreePosix(port);

