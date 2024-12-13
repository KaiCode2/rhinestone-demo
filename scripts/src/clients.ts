import {
  RHINESTONE_ATTESTER_ADDRESS,
  MOCK_ATTESTER_ADDRESS,
  OWNABLE_VALIDATOR_ADDRESS,
  getOwnableValidator,
} from "@rhinestone/module-sdk";
import { privateKeyToAccount } from "viem/accounts";
import {
  Address,
  createPublicClient,
  Hex,
  http,
  PrivateKeyAccount,
} from "viem";
import { sepolia } from "viem/chains";
import { createSmartAccountClient } from "permissionless";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  createPaymasterClient,
  entryPoint07Address,
} from "viem/account-abstraction";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createAutomationClient } from "@rhinestone/automations-sdk";
import {
  pimlicoSepoliaUrl,
  rpcURL,
  automationsApiKey,
  privateKey,
} from "./constants";

import { config } from "dotenv";

config();

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
} else if (process.env.PIMLICO_API_KEY === undefined) {
  throw new Error("PIMLICO_API_KEY is required");
}

export const publicClient = createPublicClient({
  transport: http(rpcURL),
  chain: sepolia,
});

export const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoSepoliaUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

export const paymasterClient = createPaymasterClient({
  transport: http(pimlicoSepoliaUrl),
});

export const ownerAccount: PrivateKeyAccount = privateKeyToAccount(
  privateKey as Hex
);

let smartAccountClient;

export const getSafeAccountClient = async () => {
  if (smartAccountClient) {
    return smartAccountClient;
  }

  const ownableValidator = getOwnableValidator({
    owners: [
      "0x2DC2fb2f4F11DeE1d6a2054ffCBf102D09b62bE2",
      ownerAccount.address,
    ],
    threshold: 1,
  });

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [ownerAccount],
    version: "1.4.1",
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
    safe4337ModuleAddress: "0x7579EE8307284F293B1927136486880611F20002",
    erc7579LaunchpadAddress: "0x7579011aB74c46090561ea277Ba79D510c6C00ff",
    attesters: [
      RHINESTONE_ATTESTER_ADDRESS, // Rhinestone Attester
      MOCK_ATTESTER_ADDRESS, // Mock Attester - do not use in production
    ],
    attestersThreshold: 1,
    validators: [
      {
        address: ownableValidator.address,
        context: ownableValidator.initData,
      },
    ],
  });

  smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: sepolia,
    bundlerTransport: http(pimlicoSepoliaUrl),
    paymaster: paymasterClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  }).extend(erc7579Actions());

  return smartAccountClient;
};

export const getAutomationClient = (address: Address) => {
  return createAutomationClient({
    account: address,
    accountType: "SAFE",
    apiKey: automationsApiKey,
    accountInitCode: "0x",
    network: sepolia.id,
    validator: OWNABLE_VALIDATOR_ADDRESS,
  });
};
