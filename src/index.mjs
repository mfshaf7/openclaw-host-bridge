import { createServer } from "./server.mjs";

async function main() {
  const server = await createServer();
  await server.start();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
