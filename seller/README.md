# seller

A Hono server with one paid endpoint, `POST /ask`, that costs $0.01 in USAT on Celo mainnet. It uses x402 with the Celo facilitator at `api.x402.celo.org`.

```bash
bun install
cp .env.example .env   # fill in X402_API_KEY, SELLER_PAY_TO, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
bun start              # http://localhost:4021
```

- Request: `{"prompt": "..."}`. Response: `{"answer": "..."}`.
- Unpaid requests get a `402` with a `PAYMENT-REQUIRED` header.
- If the handler errors (status 400 or higher), no settlement happens, so the buyer is not charged.
