import "dotenv/config";
import {
  BRIDGE_SOURCE_STATUSES,
  bridgeFirstNFromSupabase,
  resolveCorpusLimit,
} from "@trademark-engine/corpus-bridge";

async function main(): Promise<void> {
  const limit = resolveCorpusLimit();
  const limitLabel = limit === null ? "uncapped (full allowlist)" : limit.toLocaleString();

  console.log(
    `Bridging ${limitLabel} from Supabase (read-only). Filter 1 statuses: ${BRIDGE_SOURCE_STATUSES.join(", ")}`,
  );

  const result = await bridgeFirstNFromSupabase({
    ...(limit === null ? { limit: 0 } : { limit }),
    // PostgREST/Supabase default max rows per request is 1000
    pageSize: 1_000,
    onProgress: ({ fetched, upserted, unchanged, elapsedMs }) => {
      const rate = fetched > 0 ? (fetched / elapsedMs) * 1000 : 0;
      console.log(
        `[bridge] fetched=${fetched.toLocaleString()} upserted=${upserted.toLocaleString()} unchanged=${unchanged.toLocaleString()} elapsedMs=${elapsedMs} rate=${rate.toFixed(1)}/s`,
      );
    },
  });

  console.log(
    `Done. fetched=${result.fetched.toLocaleString()} upserted=${result.upserted.toLocaleString()} unchanged=${result.unchanged.toLocaleString()} elapsedMs=${result.elapsedMs} runId=${result.runId ?? "n/a"}`,
  );
  console.log("Next: pnpm corpus:preprocess");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
