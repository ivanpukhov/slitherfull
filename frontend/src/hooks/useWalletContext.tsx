import { createContext, useContext, type ReactNode } from 'react'
import type { UseWalletController } from './useWallet'

const WalletContext = createContext<UseWalletController | null>(null)

interface WalletProviderProps {
  value: UseWalletController
  children: ReactNode
}

export function WalletProvider({ value, children }: WalletProviderProps) {
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWalletContext() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider')
  }
  return context
}
