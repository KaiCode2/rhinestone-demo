import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address } from 'viem/account-abstraction'
import { http, cookieStorage, createConfig, createStorage } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

export function getConfig() {
  return createConfig({
    chains: [mainnet, sepolia],
    connectors: [
      injected(),
      coinbaseWallet(),
      walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
    },
  })
}

export const pimlicoSepoliaUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`

export const capabilities = {
  paymasterService: {
    [sepolia.id]: {
        url: pimlicoSepoliaUrl,
    }
  }
}

export const pimlicoClient = createPimlicoClient({
	transport: http(pimlicoSepoliaUrl),
	entryPoint: {
		address: entryPoint07Address,
		version: "0.7",
	},
})

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
