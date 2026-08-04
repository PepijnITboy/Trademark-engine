import Anthropic from "@anthropic-ai/sdk";
import type {
  AttorneyAnalysisClient,
  AttorneyCompletionRequest,
} from "./types.js";

/** Top-10 risk payloads need more than 4k completion tokens. */
export const ATTORNEY_MAX_OUTPUT_TOKENS = 16_384;

function formatAnthropicError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Anthropic authentication failed: API key is invalid. Check ANTHROPIC_API_KEY in .env and restart the API.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error (${error.status}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Anthropic request failed";
}

export function createAnthropicAttorneyClient(options: {
  readonly apiKey: string;
  readonly maxOutputTokens?: number;
}): AttorneyAnalysisClient {
  const anthropic = new Anthropic({ apiKey: options.apiKey.trim() });
  const maxTokens = options.maxOutputTokens ?? ATTORNEY_MAX_OUTPUT_TOKENS;

  return {
    async complete(request: AttorneyCompletionRequest): Promise<string> {
      try {
        const response = await anthropic.messages.create({
          model: request.model,
          max_tokens: maxTokens,
          temperature: request.temperature,
          system: request.system,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });

        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("\n")
          .trim();

        if (!text) {
          throw new Error("Anthropic returned empty text content");
        }
        if (response.stop_reason === "max_tokens") {
          throw new Error(
            `Anthropic response truncated at max_tokens=${maxTokens}; raise ATTORNEY completion budget`,
          );
        }
        return text;
      } catch (error) {
        throw new Error(formatAnthropicError(error));
      }
    },
  };
}
