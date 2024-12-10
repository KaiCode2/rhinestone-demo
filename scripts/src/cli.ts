import {
  getSafeAccountClient,
  getAutomationClient,
  ownerAccount,
} from "./clients";
import chalk from "chalk";
import { Command, Option, Argument } from "commander";
import { Abi, encodeFunctionData, Hex, parseAbi } from "viem";
import { Action, StaticAction } from "./types";
import { splitByCommaOutsideQuotes } from "./utils";
import {
  encode1271Hash,
  encode1271Signature,
  getAccount,
  OWNABLE_VALIDATOR_ADDRESS,
} from "@rhinestone/module-sdk";
import { sepolia } from "viem/chains";
const program = new Command();

program
  .command("list")
  .alias("ls")
  .description("list all automations")
  .addOption(
    new Option(
      "-a, --account <account>",
      "Smart account to get automations for"
    )
  )
  .action(async ({ account }) => {
    account ??= (await getSafeAccountClient()).account.address;
    console.log(`Listing automations for account ${chalk.cyan(account)}`);
    const automationClient = getAutomationClient(account);

    const activeAutomations = await automationClient.getActiveAutomations();
    console.table(
      activeAutomations.map((automation) => ({
        id: automation.id,
        "max executions": automation.maxNumberOfExecutions,
        "executions ran": automation.numberOfExecutionsExecuted,
        active: automation.active,
        signed: automation.signed,
        // actions: automation.actions,
      }))
    );
  });

program
  .command("get")
  .description("get an automation")
  .addArgument(new Argument("<id>", "ID of the automation to get"))
  .addOption(
    new Option(
      "-a, --account <account>",
      "Smart account to get automations for"
    )
  )
  .action(async (id, { account }) => {
    account ??= (await getSafeAccountClient()).account.address;
    const automationClient = getAutomationClient(account);
    const automation = await automationClient.getAutomation(id);
    console.log("Automation:", automation);
  });

program
  .command("delete")
  .alias("rm")
  .description("delete an automation")
  .addArgument(new Argument("<id>", "ID of the automation to delete"))
  .addOption(
    new Option(
      "-a, --account <account>",
      "Smart account to get automations for"
    )
  )
  .action(async (id, { account }) => {
    account ??= (await getSafeAccountClient()).account.address;
    const automationClient = getAutomationClient(account);
    await automationClient.deleteAutomation(id);
    console.log(`Deleted automation: ${chalk.yellow(id)}`);
  });

program
  .command("logs")
  .description("get logs for an automation")
  .addArgument(new Argument("<id>", "ID of the automation to get logs for"))
  .addOption(
    new Option(
      "-a, --account <account>",
      "Smart account to get automations for"
    )
  )
  .action(async (id, { account }) => {
    account ??= (await getSafeAccountClient()).account.address;
    const automationClient = getAutomationClient(account);
    const logs = await automationClient.getAutomationLogs(id);
    if (!logs.length || logs.length === 0) {
      console.log(
        `No logs found for automation ${chalk.yellow(id)} on account ${chalk.cyan(account)}`
      );
      return;
    }
    console.table(logs);
  });

const createAutomation = program.command("create");

function parseActions(actions: string): Action {
  const tokens = splitByCommaOutsideQuotes(actions);
  const [type, ...actionStrings] = tokens;
  const target =
    actionStrings[0] !== "mock"
      ? actionStrings[0]
      : "0x8034e69FAFEd6588cc36ff3400AFE5c049a3B92E";
  const value = Number(actionStrings[1]);
  if (type === "static") {
    let callDataArgs = actionStrings[2];
    let callData: Hex;

    if (callDataArgs.startsWith('"') && callDataArgs.endsWith('"')) {
      callDataArgs = callDataArgs.slice(1, -1); // Remove enclosing quotes
    }

    if (!callDataArgs.startsWith("0x")) {
      // callDataArgs is presumably a function signature like "transfer(uint256)"
      // The remaining actionStrings after index 2 should be the function arguments
      const functionArgs = actionStrings.slice(3);

      // Build a minimal ABI from the function signature
      // parseAbi expects a string like "function transfer(uint256)"
      const functionAbi = parseAbi([`function ${callDataArgs}` as any]) as Abi;

      // Extract the function name from the signature
      // e.g. "transfer(uint256)" -> "transfer"
      const functionName = callDataArgs.split("(")[0];

      // Encode the function call
      callData = encodeFunctionData({
        abi: functionAbi,
        functionName,
        args: functionArgs,
      });
    } else {
      callData = callDataArgs as Hex;
    }

    return {
      type,
      target,
      value,
      callData,
    } as StaticAction;
  } else if (type === "dynamic") {
    console.log("dynamic");

    throw new Error("Dynamic actions not yet supported");
  } else {
    throw new Error(`Invalid action type: ${type}`);
  }
}

createAutomation
  .command("time")
  .alias("t")
  .description("create a time-based automation")
  .addArgument(
    new Argument(
      "<cron>",
      `Cron expression for the automation. Should be wrapped in paranthesis. ie. "*/60 * * * *"`
    )
  )
  .addArgument(
    new Argument(
      "<actions...>",
      `Actions to perform. Encoded as "static|dynamic,target,value,calldata|(calldatabuilderUrl,funcSelector,params) ..."`
    ).argParser(parseActions)
  )
  .addOption(
    new Option(
      "-r, --runs <runs>",
      "Number of times the automation should run"
    ).default(1)
  )
  .addOption(
    new Option(
      "-s, --start <start>",
      "Start date or unix timestamp for the automation"
    )
  )
  .addOption(
    new Option(
      "-a, --account <account>",
      "Smart account to create automation for"
    )
  )
  .action(async (cron, actions, { runs, start, account }) => {
    // account ??= (await getSafeAccountClient()).account.address;
    const safeAccountClient = await getSafeAccountClient();
    const safeAccount = getAccount({
      address: safeAccountClient.account.address,
      type: "safe",
    });

    const maxNumberOfExecutions =
      typeof runs === "number" ? runs : parseInt(runs);
    let startDate: number;
    if (start) {
      if (isNaN(Number(start))) {
        startDate = new Date(start).getTime();
      } else {
        startDate = Number(start);
      }
    } else {
      startDate = Date.now();
    }

    const automationClient = getAutomationClient(
      safeAccountClient.account.address
    );
    const automation = await automationClient.createAutomation({
      type: "time-based",
      data: {
        trigger: {
          triggerData: {
            cronExpression: cron,
            startDate,
          },
        },
        actions,
        maxNumberOfExecutions,
      },
    });
    console.log(
      `Created automation with ID: ${chalk.yellow(automation.id)} hash: ${chalk.yellow(automation.hash)}`
    );

    const formattedHash = encode1271Hash({
      account: safeAccount,
      validator: OWNABLE_VALIDATOR_ADDRESS,
      chainId: sepolia.id,
      hash: automation.hash,
    });

    const signature = await ownerAccount.signMessage({
      message: { raw: formattedHash },
    });

    const formattedSignature = encode1271Signature({
      account: safeAccount,
      validator: OWNABLE_VALIDATOR_ADDRESS,
      signature,
    });

    const { success } = await automationClient.signAutomation({
      automationId: automation.id,
      signature: formattedSignature,
    });

    if (success) {
      console.log(
        `Automation ${chalk.yellow(automation.id)} signed successfully`
      );
    } else {
      console.error(
        `Failed to sign automation ${chalk.yellow(automation.id)}`
      );
    }
  });

program.parse();
