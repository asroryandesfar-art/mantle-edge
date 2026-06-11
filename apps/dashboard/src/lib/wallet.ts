"use client"

import { useCallback, useEffect, useState } from "react"
import { MANTLE_MAINNET, MANTLE_TESTNET } from "@mantle-edge/shared"

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

function getEthereum(): EthereumProvider | undefined {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum
}

/** The Mantle network the dashboard expects the connected wallet to be on. */
export const TARGET_CHAIN =
  Number(process.env.NEXT_PUBLIC_MANTLE_CHAIN_ID ?? MANTLE_MAINNET.chainId) === MANTLE_TESTNET.chainId
    ? MANTLE_TESTNET
    : MANTLE_MAINNET

const TARGET_CHAIN_HEX = `0x${TARGET_CHAIN.chainId.toString(16)}`

/** Truncates a 0x-prefixed address to `0x1234...abcd`. */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Tracks the connected wallet account and chain (if any), and exposes
 * `connect` (requests account access) and `switchNetwork` (prompts the
 * wallet to switch to / add the configured Mantle network).
 */
export function useWallet() {
  const [hasProvider, setHasProvider] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  useEffect(() => {
    const ethereum = getEthereum()
    if (!ethereum) return
    setHasProvider(true)

    ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      const list = accounts as string[]
      if (list.length > 0) setAddress(list[0])
    })
    ethereum.request({ method: "eth_chainId" }).then((id) => setChainId(id as string))

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      setAddress(accounts[0] ?? null)
    }
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(args[0] as string)
    }

    ethereum.on?.("accountsChanged", handleAccountsChanged)
    ethereum.on?.("chainChanged", handleChainChanged)
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged)
      ethereum.removeListener?.("chainChanged", handleChainChanged)
    }
  }, [])

  const connect = useCallback(async () => {
    const ethereum = getEthereum()
    if (!ethereum) {
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer")
      return
    }

    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[]
      setAddress(accounts[0] ?? null)
    } catch (error) {
      console.error("Wallet connection failed", error)
    }
  }, [])

  const switchNetwork = useCallback(async () => {
    const ethereum = getEthereum()
    if (!ethereum) return

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
      })
    } catch (error) {
      // 4902: chain not added to the wallet yet.
      if ((error as { code?: number }).code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: TARGET_CHAIN_HEX,
              chainName: TARGET_CHAIN.name,
              rpcUrls: [TARGET_CHAIN.rpcUrl],
              blockExplorerUrls: [TARGET_CHAIN.explorerUrl],
              nativeCurrency: TARGET_CHAIN.nativeCurrency,
            },
          ],
        })
      } else {
        console.error("Network switch failed", error)
      }
    }
  }, [])

  const wrongNetwork = address !== null && chainId !== null && chainId !== TARGET_CHAIN_HEX

  return { hasProvider, address, chainId, wrongNetwork, connect, switchNetwork }
}
