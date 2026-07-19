export async function isRpcReachable(rpcUrl: string, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: controller.signal
    });
    if (!response.ok) return false;
    const body = await response.json() as { result?: string };
    return typeof body.result === "string";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
