import { spawn } from "node:child_process";

/** Readiness belongs to this child, not an unrelated server on the same port. */
export function reviewPreview(root, port) {
  const child = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: root, stdio: "pipe" },
  );
  let output = "";
  const ready = new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
      child.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onData = (data) => {
      output += data;
      if (/Local:\s+http/.test(output)) finish();
    };
    const onExit = (code) =>
      finish(new Error(`The review preview exited (${code}): ${output.trim()}`));
    const onError = (error) => finish(error);
    const timer = setTimeout(
      () => finish(new Error(`The review preview did not start: ${output.trim()}`)),
      10000,
    );
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", onExit);
    child.on("error", onError);
  });
  return { ready, stop: () => child.kill("SIGTERM") };
}
