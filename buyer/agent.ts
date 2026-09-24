import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress, isHex, type Hex } from "viem";

const key = process.env.BUYER_PRIVATE_KEY;
if (!key || !isHex(key) || key.length !== 66) {
  console.error("BUYER_PRIVATE_KEY must be set to a 0x-prefixed 32-byte hex key");
  process.exit(1);
}

const URL = "http://localhost:4021/ask";
const QUESTION = process.argv.slice(2).join(" ") || "In one sentence, what is the x402 protocol?";

// Celo mainnet + USAT, matching the seller. Refuse any other asset or a price above $0.01.
const NETWORK = "eip155:42220";
const USAT = getAddress("0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771");
const MAX_AMOUNT = "10000"; // $0.01 in USAT base units

const account = privateKeyToAccount(key as Hex);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
  policies: [
    (_version, reqs) =>
      reqs.filter(
        (r) =>
          r.network === NETWORK &&
          getAddress(r.asset) === USAT &&
          BigInt(r.amount) <= BigInt(MAX_AMOUNT),
      ),
  ],
});

console.log(`Buyer ${account.address}`);
console.log(`Q: ${QUESTION}`);

const res = await fetchWithPayment(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: QUESTION }),
});

const body: any = await res.json().catch(() => null);
if (!res.ok) {
  console.error(`Request failed: HTTP ${res.status}`, body ?? "");
  process.exit(1);
}

console.log(`A: ${body?.answer}`);

const header = res.headers.get("PAYMENT-RESPONSE");
if (!header) {
  console.error("No PAYMENT-RESPONSE header in the response");
  process.exit(1);
}
const settlement = decodePaymentResponseHeader(header);
console.log(`Settlement tx: ${settlement.transaction}`);
console.log(`https://celoscan.io/tx/${settlement.transaction}`);
