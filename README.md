# x402-pay-per-prompt

An API that charges one cent per prompt, and an agent that pays for it. Payments are x402 on Celo mainnet, in USAT (Tether America USD).

- `seller/` is a Hono server with one paid route, `POST /ask`. It forwards the prompt to an OpenAI-compatible LLM and returns `{"answer": "..."}`.
- `buyer/` is an agent that calls `/ask`, gets a `402`, signs the payment, retries, and prints the answer and the settlement transaction.

The buyer needs USAT and no CELO. The facilitator submits the transaction and pays the gas.

## Run it

You need [Bun](https://bun.sh), an x402 API key from [x402.celo.org](https://x402.celo.org), a wallet to receive payments, and a wallet with a little USAT on Celo to pay from.

```bash
# terminal 1
cd seller
cp .env.example .env   # X402_API_KEY, SELLER_PAY_TO, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
bun install
bun start              # http://localhost:4021

# terminal 2
cd buyer
cp .env.example .env   # BUYER_PRIVATE_KEY
bun install
bun start "In one sentence, what is the x402 protocol?"
```

Use your own LLM API key for `LLM_*`. Keep both `.env` files private.

## See the 402 yourself

```bash
curl -si -X POST localhost:4021/ask -H 'content-type: application/json' -d '{"prompt":"hi"}' | head -1
# HTTP/1.1 402 Payment Required

curl -si -X POST localhost:4021/ask -H 'content-type: application/json' -d '{"prompt":"hi"}' \
  | grep -i '^payment-required:' | cut -d' ' -f2 | tr -d '\r' | base64 -d \
  | jq '.accepts[0] | {network, asset, amount, payTo}'
```

`amount` is in USAT base units (6 decimals), so `10000` is $0.01.

## Notes

- If the handler fails (any status of 400 or above), the payment is not settled and the buyer is not charged.
- The buyer only accepts USAT on `eip155:42220` and refuses any price above $0.01.
- Responses and logs never include the upstream model name.
