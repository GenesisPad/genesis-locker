import { Contract, BrowserProvider, Interface, formatEther, parseUnits } from 'ethers'

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

declare global {
  interface Window {
    ethereum?: any
  }
}

export async function getBrowserProvider() {
  if (!window.ethereum) throw new Error('No injected wallet found')
  return new BrowserProvider(window.ethereum)
}

export async function connectWallet() {
  const provider = await getBrowserProvider()
  const accounts = await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const network = await provider.getNetwork()
  return { provider, signer, address: accounts[0] as string, chainId: Number(network.chainId) }
}

export async function switchChain(chainId: number) {
  if (!window.ethereum) throw new Error('No injected wallet found')
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${chainId.toString(16)}` }]
  })
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

export async function manageLockTransaction(contractAddress: string, action: 'withdraw' | 'permanentLock' | 'extendLock' | 'increaseLockAmount' | 'transferLockOwnership', lockId: string, value?: string | number) {
  const { signer } = await connectWallet()
  const locker = new Contract(contractAddress, GENESIS_LOCKER_ABI, signer)
  if (action === 'withdraw') return locker.withdraw(lockId)
  if (action === 'permanentLock') return locker.permanentLock(lockId)
  if (action === 'extendLock') return locker.extendLock(lockId, value)
  if (action === 'transferLockOwnership') return locker.transferLockOwnership(lockId, value)
  return locker.increaseLockAmount(lockId, value)
}

export { formatEther }
