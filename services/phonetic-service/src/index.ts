import { buildServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "3010", 10);

async function main() {
  const app = await buildServer();
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
