"use client"

import { useCallback, useEffect, useState } from "react"

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

function getEthereum(): EthereumProvider | undefined {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum
}

/** Truncates a 0x-prefixed address to `0x1234...abcd`. */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Tracks the connected MetaMask account, if any, and exposes a `connect`
 * action that requests access via `eth_requestAccounts`.
 */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    const ethereum = getEthereum()
    if (!ethereum) return

    ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      const list = accounts as string[]
      if (list.length > 0) setAddress(list[0])
    })

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      setAddress(accounts[0] ?? null)
    }

    ethereum.on?.("accountsChanged", handleAccountsChanged)
    return () => ethereum.removeListener?.("accountsChanged", handleAccountsChanged)
  }, [])

  const connect = useCallback(async () => {
    const ethereum = getEthereum()
    if (!ethereum) return

    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[]
      setAddress(accounts[0] ?? null)
    } catch (error) {
      console.error("Wallet connection failed", error)
    }
  }, [])

  return { address, connect }
}
