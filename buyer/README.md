# buyer

An agent that asks the seller's `POST /ask` one question and pays $0.01 in USAT on Celo mainnet with `@x402/fetch`.

```bash
bun install
cp .env.example .env   # set BUYER_PRIVATE_KEY (wallet needs USAT on Celo; no CELO needed for gas)
bun start              # or: bun start "your question here"
```

It prints the answer, then the settlement tx hash from the `PAYMENT-RESPONSE` header. The client pays only in USAT on `eip155:42220` and refuses any price above $0.01.
