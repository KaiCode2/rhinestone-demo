'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { type State, WagmiProvider } from 'wagmi'

import { getConfig, capabilities } from '@/wagmi'
import { PermissionlessProvider } from "@permissionless/wagmi"


export function Providers(props: {
  children: ReactNode
  initialState?: State
}) {
  const [config] = useState(() => getConfig())
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config} initialState={props.initialState}>
      <QueryClientProvider client={queryClient}>
        <PermissionlessProvider
          capabilities={capabilities}
        >
          {props.children}
        </PermissionlessProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
