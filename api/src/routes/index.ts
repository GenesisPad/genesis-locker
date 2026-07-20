import { Router } from "express";
import { z } from "zod";
import { getAssetStatus, getChains, getGlobalStats, getPoolLockStatus, getWalletLocks, listLiquidityLocks, listLockedPositions, listLocks, search } from "../services/locks.js";

export const router = Router();

const addressParam = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const chainParam = z.coerce.number().int();

router.get("/chains", (_req, res) => {
  getChains().then((chains) => res.json(chains));
});

router.get("/stats", async (_req, res) => {
  res.json(await getGlobalStats());
});

router.get("/stats/tvl", async (_req, res) => {
  const stats = await getGlobalStats();
  res.json({ totalTvl: stats.totalTvl, lpTvl: stats.totalLpTvl, tokenTvl: stats.totalTokenTvl, byChain: stats.byChain });
});

router.get("/stats/fees", async (_req, res) => {
  const stats = await getGlobalStats();
  res.json({ totalFeesCollected: stats.totalFeesCollected, byChain: stats.byChain });
});

router.get("/locks/:chainId/:lockId", async (req, res) => {
  const chainId = chainParam.parse(req.params.chainId);
  const lockId = BigInt(req.params.lockId);
  const status = await getAssetStatus(chainId, undefined, lockId);
  res.json(status);
});

router.get("/locks/:chainId/:contractAddress/:lockId", async (req, res) => {
  const chainId = chainParam.parse(req.params.chainId);
  const contractAddress = addressParam.parse(req.params.contractAddress);
  const lockId = BigInt(req.params.lockId);
  const status = await getAssetStatus(chainId, undefined, lockId, contractAddress);
  res.json(status);
});

router.get("/locks", async (req, res) => {
  const assetType = String(req.query.assetType || "");
  const lockType = String(req.query.lockType || "");
  res.json(await listLocks({
    limit: Number(req.query.limit || 50),
    assetType: assetType === "token" || assetType === "lp" || assetType === "v3_position" ? assetType : undefined,
    lockType: lockType === "timed" || lockType === "vesting" || lockType === "permanent" ? lockType : undefined,
    unlockingSoon: req.query.unlockingSoon === "true"
  }));
});

router.get("/positions", async (req, res) => {
  res.json(await listLockedPositions(Number(req.query.limit || 100)));
});

router.get("/liquidity-locks", async (req, res) => {
  const chainId = req.query.chainId === undefined ? undefined : chainParam.parse(req.query.chainId);
  res.json(await listLiquidityLocks({ chainId, limit: Number(req.query.limit || 100) }));
});

router.get("/pools/:chainId/:poolAddress/locks", async (req, res) => {
  res.json(await getPoolLockStatus(chainParam.parse(req.params.chainId), addressParam.parse(req.params.poolAddress)));
});

router.get("/my-locks/:chainId/:walletAddress", async (req, res) => {
  res.json(await getWalletLocks(chainParam.parse(req.params.chainId), addressParam.parse(req.params.walletAddress)));
});

router.get("/tokens/:chainId/:tokenAddress/locks", async (req, res) => {
  res.json(await getAssetStatus(chainParam.parse(req.params.chainId), addressParam.parse(req.params.tokenAddress)));
});

router.get("/lp/:chainId/:lpAddress/status", async (req, res) => {
  res.json(await getAssetStatus(chainParam.parse(req.params.chainId), addressParam.parse(req.params.lpAddress)));
});

router.get("/wallets/:chainId/:walletAddress/locks", async (req, res) => {
  res.json(await getWalletLocks(chainParam.parse(req.params.chainId), addressParam.parse(req.params.walletAddress)));
});

router.get("/check/:chainId/:assetAddress", async (req, res) => {
  res.json(await getAssetStatus(chainParam.parse(req.params.chainId), addressParam.parse(req.params.assetAddress)));
});

router.get("/search", async (req, res) => {
  res.json(await search(String(req.query.q || "")));
});

router.get("/search/token/:chainId/:tokenAddress", async (req, res) => {
  res.json(await getAssetStatus(chainParam.parse(req.params.chainId), addressParam.parse(req.params.tokenAddress)));
});

router.get("/search/pair/:chainId/:pairAddress", async (req, res) => {
  res.json(await getAssetStatus(chainParam.parse(req.params.chainId), addressParam.parse(req.params.pairAddress)));
});

router.get("/search/wallet/:chainId/:walletAddress", async (req, res) => {
  res.json(await getWalletLocks(chainParam.parse(req.params.chainId), addressParam.parse(req.params.walletAddress)));
});
