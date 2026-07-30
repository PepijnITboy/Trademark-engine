import Fastify from "fastify";
import { z } from "zod";
import { stubPhonemes } from "./stub.js";

const phonemesBodySchema = z.object({
  text: z.string().min(1),
  locale: z.string().min(2).default("en"),
});

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", engine: "espeak-stub-1" }));

  app.post("/phonemes", async (request, reply) => {
    const parsed = phonemesBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    return stubPhonemes(parsed.data.text, parsed.data.locale);
  });

  return app;
}
