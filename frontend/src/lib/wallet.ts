import { Contract, BrowserProvider, JsonRpcSigner, Interface, formatEther, parseUnits } from 'ethers'
import type { WalletClient } from 'viem'
import { getAccount, getWalletClient, switchChain as wagmiSwitchChain } from 'wagmi/actions'
import { wagmiConfig } from './wagmi'

export const GENESIS_LOCKER_ABI = [
  'function creationFee() view returns (uint256)',
  'function createCliffLock(address token,address beneficiary,uint256 amount,uint256 unlockTime,bool isLpToken,string metadataURI) payable returns (uint256)',
  'function createVestingLock(address token,address beneficiary,uint256 amount,uint256 cliffTime,uint256 endTime,uint256 vestingInterval,bool isLpToken,string metadataURI) payable returns (uint256)',
  'function withdraw(uint256 lockId)',
  'function extendLock(uint256 lockId,uint256 newEndTime)',
  'function increaseLockAmount(uint256 lockId,uint256 addedAmount)',
  'function transferLockOwnership(uint256 lockId,address newOwner)',
  'function permanentLock(uint256 lockId)'
] as const

export const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function approve(address spender,uint256 amount) returns (bool)'
] as const

// Converts a wagmi/viem WalletClient into an ethers v6 Signer, bound to
// whichever connector the user actually picked via the RainbowKit modal.
// This is the standard wagmi<->ethers v6 adapter — see wagmi's own docs.
function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient
  if (!account || !chain) throw new Error('Wallet client is missing an account or chain')
  const network = { chainId: chain.id, name: chain.name }
  const provider = new BrowserProvider(transport, network)
  return new JsonRpcSigner(provider, account.address)
}

/**
 * Gets the signer for whichever wallet the user connected via the "Connect
 * Wallet" button (RainbowKit/wagmi) — never reaches for window.ethereum
 * directly. Reaching for window.ethereum independently is what caused wallet
 * mismatches when multiple extensions are installed: it can silently point
 * at a different, inactive provider than the one the user actually picked.
 */
export async function connectWallet() {
  const account = getAccount(wagmiConfig)
  if (!account.isConnected || !account.address) {
    throw new Error('Connect your wallet first using the button in the top right')
  }

  const walletClient = await getWalletClient(wagmiConfig)
  const signer = walletClientToSigner(walletClient)
  return { provider: signer.provider as BrowserProvider, signer, address: account.address, chainId: account.chainId! }
}

export async function switchChain(chainId: number) {
  await wagmiSwitchChain(wagmiConfig, { chainId })
}

export async function createLockTransaction(input: {
  contractAddress: string
  tokenAddress: string
  beneficiary: string
  amount: string
  isLpToken: boolean
  isVesting: boolean
  unlockTime?: number
  cliffTime?: number
  endTime?: number
  vestingInterval?: number
  metadataURI: string
  permanent?: boolean
}) {
  const { signer } = await connectWallet()
  const token = new Contract(input.tokenAddress, ERC20_ABI, signer)
  const decimals = Number(await token.decimals().catch(() => 18))
  const amount = parseUnits(input.amount, decimals)
  await (await token.approve(input.contractAddress, amount)).wait()

  const locker = new Contract(input.contractAddress, GENESIS_LOCKER_ABI, signer)
  const fee = await locker.creationFee()

  let tx
  if (input.isVesting) {
    if (!input.cliffTime || !input.endTime || !input.vestingInterval) throw new Error('Missing vesting schedule')
    tx = await locker.createVestingLock(input.tokenAddress, input.beneficiary, amount, input.cliffTime, input.endTime, input.vestingInterval, input.isLpToken, input.metadataURI, { value: fee })
  } else {
    if (!input.unlockTime) throw new Error('Missing unlock time')
    tx = await locker.createCliffLock(input.tokenAddress, input.beneficiary, amount, input.unlockTime, input.isLpToken, input.metadataURI, { value: fee })
  }

  if (!input.permanent) return tx
  const receipt = await tx.wait()
  const iface = new Interface(GENESIS_LOCKER_ABI)
  const created = receipt.logs
    .map((log: unknown) => {
      try { return iface.parseLog(log as Parameters<typeof iface.parseLog>[0]) } catch { return null }
    })
    .find((log: unknown) => log && (log as { name: string }).name === 'LockCreated') as { args: { lockId: bigint } } | undefined
  if (!created) throw new Error('Lock was created, but LockCreated event was not found')
  return locker.permanentLock(created.args.lockId)
}

export async function manageLockTransaction(
  contractAddress: string,
  action: 'withdraw' | 'permanentLock' | 'extendLock' | 'increaseLockAmount' | 'transferLockOwnership',
  lockId: string,
  value?: string | number,
  // Only needed for increaseLockAmount: the contract pulls tokens via
  // transferFrom, so it needs the asset address (to approve) and its
  // decimals (the input is a human amount like "100", not base units).
  tokenInfo?: { tokenAddress: string; decimals: number }
) {
  const { signer } = await connectWallet()
  const locker = new Contract(contractAddress, GENESIS_LOCKER_ABI, signer)
  if (action === 'withdraw') return locker.withdraw(lockId)
  if (action === 'permanentLock') return locker.permanentLock(lockId)
  if (action === 'extendLock') return locker.extendLock(lockId, value)
  if (action === 'transferLockOwnership') return locker.transferLockOwnership(lockId, value)

  if (!tokenInfo) throw new Error('Missing token info for increaseLockAmount')
  const amount = parseUnits(String(value ?? '0'), tokenInfo.decimals)
  const token = new Contract(tokenInfo.tokenAddress, ERC20_ABI, signer)
  await (await token.approve(contractAddress, amount)).wait()
  return locker.increaseLockAmount(lockId, amount)
}

export { formatEther }
