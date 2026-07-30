import "dotenv/config";
import {
  BRIDGE_SOURCE_STATUSES,
  purgeNonAllowlistFromDatabaseUrl,
} from "@trademark-engine/corpus-bridge";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  console.log(
    `Purging engine trademarks outside filter 1 (${BRIDGE_SOURCE_STATUSES.join(", ")})…`,
  );

  const result = await purgeNonAllowlistFromDatabaseUrl(databaseUrl);
  console.log(`Done. deletedTrademarks=${result.deletedTrademarks.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
