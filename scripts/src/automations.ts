import {
  RHINESTONE_ATTESTER_ADDRESS,
  MOCK_ATTESTER_ADDRESS,
  getScheduledTransferData,
  getScheduledTransfersExecutor,
  getExecuteScheduledTransferAction,
  OWNABLE_VALIDATOR_ADDRESS,
  getOwnableValidator,
  encode1271Signature,
  getAccount,
  encode1271Hash,
} from "@rhinestone/module-sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  Address,
  Chain,
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
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

import { config } from "dotenv";

config();

const pimlicoSepoliaUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;
const rpcURL = (process.env.RPC_URL as string) ?? "https://sepolia.drpc.org";
const privateKey = process.env.PRIVATE_KEY as string;
const automationsApiKey = process.env.AUTOMATIONS_API_KEY as string;

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
} else if (process.env.PIMLICO_API_KEY === undefined) {
  throw new Error("PIMLICO_API_KEY is required");
}

const publicClient = createPublicClient({
  transport: http(rpcURL),
  chain: sepolia,
});

const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoSepoliaUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

const paymasterClient = createPaymasterClient({
  transport: http(pimlicoSepoliaUrl),
});

async function main() {
  const owner = privateKeyToAccount(privateKey as `0x${string}`);
  const ownableValidator = getOwnableValidator({
    owners: ["0x2DC2fb2f4F11DeE1d6a2054ffCBf102D09b62bE2", owner.address],
    threshold: 1,
  });

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
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

  const smartAccountClient = createSmartAccountClient({
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

  const executeInterval = 60; // in seconds
  const numberOfExecutions = 2;
  const startDate = Date.now(); // UNIX timestamp

  const scheduledTransfer = {
    startDate: startDate,
    repeatEvery: executeInterval,
    numberOfRepeats: numberOfExecutions,
    token: {
      token_address: "0x8034e69FAFEd6588cc36ff3400AFE5c049a3B92E" as Address, // Mock USDC
      decimals: 6,
    },
    amount: 1,
    recipient: "0xC324574686c14fbE998fECdf8aA3314a6A3045e5" as Address,
  };

  const executionData = getScheduledTransferData({
    scheduledTransfer,
  });

  const scheduledTransfers = getScheduledTransfersExecutor({
    executeInterval,
    numberOfExecutions,
    startDate,
    executionData,
  });

  const isInstalled =
    await smartAccountClient.isModuleInstalled(scheduledTransfers);
  if (!isInstalled) {
    console.log("Installing Scheduled Transfers Module");
    const opHash = await smartAccountClient.installModule(scheduledTransfers);
    console.log("Operation Hash:", opHash);

    await pimlicoClient.waitForUserOperationReceipt({
      hash: opHash,
    });
    console.log("Scheduled Transfers Module Installed");
  } else {
    console.log("Scheduled Transfers Module already installed");
  }

  await smartAccountClient.sendTransaction({
    to: scheduledTransfer.token.token_address,
    data: encodeFunctionData({
      abi: parseAbi(["function mint(address to, uint256 amount) external"]),
      functionName: "mint",
      args: [safeAccount.address, BigInt(10)],
    }),
  });

  const automationClient = createAutomationClient({
    account: safeAccount.address,
    accountType: "SAFE",
    apiKey: automationsApiKey,
    accountInitCode: "0x",
    network: 11155111,
    validator: OWNABLE_VALIDATOR_ADDRESS,
  });

  const activeAutomations = await automationClient.getActiveAutomations();
  console.log("Active Automations:", activeAutomations);

  const executeScheduledTranferAction = getExecuteScheduledTransferAction({
    jobId: activeAutomations.length, // since this is our first automation on the module
  });

  const actions = [
    {
      type: "static" as const,
      target: executeScheduledTranferAction.target,
      value: Number(executeScheduledTranferAction.value),
      callData: executeScheduledTranferAction.callData,
    },
  ];

  const triggerData = {
    cronExpression: "* * * * *",
    startDate: startDate,
  };

  const automation = await automationClient.createAutomation({
    type: "time-based",
    data: {
      trigger: {
        triggerData,
      },
      actions,
      maxNumberOfExecutions: numberOfExecutions,
    },
  });

  const account = getAccount({
    address: safeAccount.address,
    type: "safe",
  });

  const formattedHash = encode1271Hash({
    account,
    validator: OWNABLE_VALIDATOR_ADDRESS,
    chainId: sepolia.id,
    hash: automation.hash,
  });

  const signature = await owner.signMessage({
    message: { raw: formattedHash },
  });

  const formattedSignature = encode1271Signature({
    account,
    validator: OWNABLE_VALIDATOR_ADDRESS,
    signature,
  });

  await automationClient.signAutomation({
    automationId: automation.id,
    signature: formattedSignature,
  });

  await new Promise((resolve) => setTimeout(resolve, 10000));

  const automationLogs = await automationClient.getAutomationLogs(
    automation.id
  );
  console.log("Automation Logs:", automationLogs);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
