import { getSafeAccountClient, getAutomationClient } from "./clients";
import chalk from "chalk";
import { Command, Option, Argument } from "commander";
const program = new Command();

program
  .command("list")
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
  .command("rm")
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

program.parse();
