// Minimal ABI for the /admin panel: owner-only setters plus the read functions
// used to display current contract configuration. Kept as a viem const array so
// wagmi can infer argument/return types.
export const lockerAdminAbi = [
  // ── Reads ──────────────────────────────────────────────────────────────
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creationFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxCreationFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'founderFeeRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'communityFeeRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'founderFeeShareBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'maxFounderFeeShareBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'totalLocks', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalActiveLocks', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalPermanentLocks', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalFeesCollected', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'MIN_LOCK_DURATION', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  // ── Owner-only writes ──────────────────────────────────────────────────
  { type: 'function', name: 'setCreationFee', stateMutability: 'nonpayable', inputs: [{ name: 'newFee', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setFeeRecipients', stateMutability: 'nonpayable', inputs: [{ name: 'newFounderFeeRecipient', type: 'address' }, { name: 'newCommunityFeeRecipient', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setFounderFeeShareBps', stateMutability: 'nonpayable', inputs: [{ name: 'newFounderFeeShareBps', type: 'uint16' }], outputs: [] },
  { type: 'function', name: 'transferOwnership', stateMutability: 'nonpayable', inputs: [{ name: 'newOwner', type: 'address' }], outputs: [] },
  { type: 'function', name: 'renounceOwnership', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  // ── Permissionless recovery (funds route to owner) ─────────────────────
  { type: 'function', name: 'withdrawStuckETH', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'withdrawStuckToken', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
] as const
