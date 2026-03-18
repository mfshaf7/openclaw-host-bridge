import os from "node:os";
import fs from "node:fs/promises";

async function safeRead(commandOutput) {
  try {
    return await commandOutput();
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

export async function healthCheck(config) {
  const disks = await Promise.all(
    config.allowedRoots.map(async (root) => {
      const stats = await fs.stat(root).catch(() => null);
      return {
        path: root,
        exists: stats !== null,
      };
    }),
  );
  return {
    hostname: os.hostname(),
    platform: process.platform,
    release: os.release(),
    uptimeSec: os.uptime(),
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
    },
    allowedRoots: disks,
    integrations: {
      wsl: await safeRead(async () => ({ supported: process.platform === "win32" })),
      docker: { checked: false },
      ollama: { checked: false },
    },
  };
}
