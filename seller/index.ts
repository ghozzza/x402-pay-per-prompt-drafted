import { Hono } from "hono";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress } from "viem";

const REQUIRED = ["X402_API_KEY", "SELLER_PAY_TO", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = 4021;
const MAX_TOKENS = 300;
const LLM_TIMEOUT_MS = 30_000;

// Celo mainnet + USAT (6 decimals). extra.name is the EIP-712 domain name, not the symbol.
const NETWORK = "eip155:42220";
const USAT = getAddress("0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771");
const PRICE = "10000"; // $0.01 in USAT base units

const facilitator = new HTTPFacilitatorClient({
  url: "https://api.x402.celo.org",
  createAuthHeaders: async () => {
    const h = { "X-API-Key": process.env.X402_API_KEY! };
    return { verify: h, settle: h, supported: h };
  },
});

const server = new x402ResourceServer(facilitator);
server.register("eip155:*", new ExactEvmScheme());

const routes = {
  "POST /ask": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: getAddress(process.env.SELLER_PAY_TO!),
        price: {
          amount: PRICE,
          asset: USAT,
          extra: { name: "Tether America USD", version: "1" },
        },
      },
    ],
    description: "Ask the LLM one prompt",
  },
} satisfies RoutesConfig;

const app = new Hono();
app.use(paymentMiddleware(routes, server));

app.post("/ask", async (c) => {
  const body = await c.req.json().catch(() => null);
  const prompt = body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return c.json({ error: "Body must be {\"prompt\": \"...\"}" }, 400);
  }

  const baseUrl = process.env.LLM_BASE_URL!.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_TOKENS,
        stream: false,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
  } catch {
    console.error("LLM request failed: network error or timeout");
    return c.json({ error: "Upstream unavailable" }, 502);
  }

  // Upstream bodies can echo the model name, so log only the status.
  if (!res.ok) {
    console.error(`LLM request failed: HTTP ${res.status}`);
    return c.json({ error: "Upstream error" }, 502);
  }

  const data: any = await res.json().catch(() => null);
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string") {
    console.error("LLM response had no answer");
    return c.json({ error: "Upstream error" }, 502);
  }

  return c.json({ answer });
});

export default { port: PORT, fetch: app.fetch };
console.log(`Seller listening on http://localhost:${PORT}`);
