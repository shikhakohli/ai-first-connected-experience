const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const server = http.createServer((request, response) => {
  let file = path.join(root, decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
  response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
    );
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const base = process.env.PROTOTYPE_BASE_URL || `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/goals.html?goal=cspNpsaCopilotSmec`);
    const seats = page.locator('.selected-goal-editor[data-goal-key="business:0"]');
    const input = seats.locator("input");
    const publish = page.locator("#cascadeGoals");
    assert.equal(await input.inputValue(), "6610");
    assert.equal(await input.getAttribute("min"), "6610");
    assert.ok(await seats.getByRole("button", { name: /^Decrease / }).isDisabled());
    await seats.getByRole("button", { name: /^Increase / }).click();
    assert.equal(await input.inputValue(), "6710");
    assert.equal(await input.getAttribute("min"), "6710");
    console.log("PASS: decrease control disabled; increases advance the minimum");

    await input.fill("6000");
    await input.press("Tab");
    assert.ok(await publish.isDisabled());
    assert.match(await seats.getByRole("status").innerText(), /at least 6,710/);
    assert.equal(await page.evaluate(() => window.cascadeGoalTargets.get("business:0")), 6710);
    await seats.getByRole("button", { name: /^Increase / }).click();
    assert.equal(await input.inputValue(), "6810");
    console.log("PASS: typed reductions cannot change the target or be published");

    await input.fill("");
    await input.pressSequentially("8000");
    await input.press("Tab");
    assert.equal(await input.inputValue(), "8000");
    assert.equal(await input.getAttribute("min"), "8000");
    await input.press("ArrowDown");
    assert.equal(await input.inputValue(), "8000");
    await input.fill("7999");
    assert.ok(await publish.isDisabled());
    await input.fill("8000.5");
    assert.ok(await publish.isDisabled());
    await input.fill("9000");
    await input.press("Tab");
    assert.ok(await publish.isEnabled());
    console.log("PASS: normal typing works; keyboard reductions and fractional targets are blocked");

    await page.locator('[data-area="cloud"]').click();
    const cloudMetric = page.locator('label.goal-metric-card:has(input[data-goal-key="cloud:0"])');
    await cloudMetric.click();
    const cloud = page.locator('.selected-goal-editor[data-goal-key="cloud:0"]');
    await cloud.getByRole("button", { name: /^Increase / }).click();
    assert.equal(await cloud.locator("input").inputValue(), "3280000");
    await publish.click();
    await page.locator("#cascadeConfirmation").waitFor({ state: "visible" });
    const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("fabrikam-published-goals")));
    assert.equal(plan.goalTargets.find((target) => target.key === "business:0").value, 9000);
    assert.equal(plan.goalTargets.find((target) => target.key === "cloud:0").value, 3280000);
    assert.equal(plan.goalTargets.find((target) => target.key === "business:0").sourceValue, "6,610");
    console.log("PASS: raised seat and revenue targets are cascaded without changing source measures");

    await page.goto(`${base}/goals.html?edit=1`);
    assert.equal(await input.inputValue(), "9000");
    assert.equal(await cloud.locator("input").inputValue(), "3280000");
    assert.equal(await cloud.locator("input").getAttribute("min"), "3280000");
    await input.fill("8999");
    assert.ok(await publish.isDisabled());
    await input.fill("9000");
    await input.press("Tab");
    await page.locator('[data-area="cloud"]').click();
    await cloudMetric.click();
    await cloudMetric.click();
    assert.equal(await cloud.locator("input").inputValue(), "3280000");
    console.log("PASS: editing and reselecting goals cannot lower previously raised targets");

    await input.evaluate((field) => { field.value = "1"; });
    await publish.evaluate((button) => button.click());
    assert.ok(await publish.isDisabled());
    assert.equal(await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fabrikam-published-goals"))
        .goalTargets.find((target) => target.key === "business:0").value), 9000);
    console.log("PASS: publication revalidates values even without input events");
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
