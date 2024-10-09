import { test, expect } from "@playwright/test";

test("Create account, session key, and send ETH", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ZKsync SSO Demo")).toBeVisible();

  // Click the Connect button
  await page.getByRole("button", { name: "Connect" }).click();
  await page.getByRole("button", { name: "ZKsync Account" }).click();

  // Ensure popup is displayed
  await page.waitForTimeout(2000);
  const popup = (await (await page.context()).pages())[1];
  await expect(popup.getByText("Create account")).toBeVisible();

  // Setup webauthn a Chrome Devtools Protocol session
  const client = await popup.context().newCDPSession(popup);
  await client.send("WebAuthn.enable");
  const result = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const authenticatorId = result.authenticatorId;
  console.log(`WebAuthn Authenticator ID: ${authenticatorId}`);

  // Enter username for new account
  // TODO: Check if error displays when name is taken
  await expect(popup.getByText("Create account")).toBeVisible();
  await popup.getByRole("button", { name: "Create account" }).click();
  const randomUsername = `zksync.me.${Math.floor(Math.random() * 100000)}`;
  console.log(`Username: ${randomUsername}`);
  await popup.getByPlaceholder("Username").fill(randomUsername);
  // TODO: Replace timeout that waits for name check to complete
  await popup.waitForTimeout(300);
  await popup.getByRole("button", { name: "Create account" }).click();
  // TODO: Replace timeout that waits for Account Creation transaction to complete
  await popup.waitForTimeout(3000);

  // Add session
  expect(popup.getByText("Authorize ZKsync SSO Demo")).toBeVisible();
  expect(popup.getByText("Act on your behalf")).toBeVisible();
  expect(popup.getByText("Expires tomorrow")).toBeVisible();
  await popup.getByRole("button", { name: "Connect" }).click();

  // Check address/balance is shown
  // TODO: Replace timeout that waits for Session transaction to complete
  await page.waitForTimeout(2000);
  expect(page.getByText("Disconnect")).toBeVisible();
  const address = (await page.getByText("Connected Address:").innerText())
    .replace("Connected Address: ", "");
  console.log(`Public Address: ${address}`);
  const startBalance = +(await page.getByText("Balance:").innerText())
    .replace("Balance: ", "")
    .replace(" ETH", "");

  // Send some eth
  await page.getByRole("button", { name: "Send 0.1 ETH" }).click();
  // TODO: Replace timeout that waits for transaction to complete
  await page.waitForTimeout(2000);
  const endBalance = +(await page.getByText("Balance:").innerText())
    .replace("Balance: ", "")
    .replace(" ETH", "");
  expect(startBalance, "Balance after transfer should be ~0.1 ETH less")
    .toBeGreaterThanOrEqual(endBalance + 0.1);
});
