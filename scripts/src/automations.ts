import {
  getScheduledTransferData,
  getScheduledTransfersExecutor,
  getExecuteScheduledTransferAction,
  OWNABLE_VALIDATOR_ADDRESS,
  encode1271Signature,
  getAccount,
  encode1271Hash,
} from "@rhinestone/module-sdk";
import {
  Address,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { sepolia } from "viem/chains";

import { config } from "dotenv";

config();

import { getSafeAccountClient, ownerAccount, getAutomationClient, pimlicoClient } from "./clients";


async function main() {
  const smartAccountClient = await getSafeAccountClient();

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
      args: [smartAccountClient.account.address, BigInt(10)],
    }),
  });

  const automationClient = getAutomationClient(smartAccountClient.account.address);

  const activeAutomations = await automationClient.getActiveAutomations();
  console.log("Active Automations:", activeAutomations);

  const executeScheduledTranferAction = getExecuteScheduledTransferAction({
    jobId: 3 //activeAutomations.length, // since this is our first automation on the module
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
    cronExpression: "*/5 * * * *",
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
    address: smartAccountClient.account.address,
    type: "safe",
  });

  const formattedHash = encode1271Hash({
    account,
    validator: OWNABLE_VALIDATOR_ADDRESS,
    chainId: sepolia.id,
    hash: automation.hash,
  });

  const signature = await ownerAccount.signMessage({
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

  await new Promise((resolve) => setTimeout(resolve, 10_000));

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
