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

async function verifyAcceptance(browser, base, scenario) {
  const context = await browser.newContext({
    viewport: scenario === "screenshot" ? { width: 2000, height: 1040 } : { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/goals.html?goal=cspNpsaCopilotSmec`);
    const seatTarget = '.selected-goal-editor[data-goal-key="business:0"] input';
    const expectedTarget = scenario === "screenshot" ? 6710 : 7000;
    if (scenario === "screenshot") {
      await page.locator('.selected-goal-editor[data-goal-key="business:0"] [data-target-delta="100"]').click();
    } else {
      await page.locator(seatTarget).fill(String(expectedTarget));
    }
    if (scenario === "republished") {
      await page.locator('[data-area="cloud"]').click();
      await page.locator('label.goal-metric-card:has(input[data-goal-key="cloud:0"])').click();
    }
    await page.locator("#cascadeGoals").click();
    await page.locator("#cascadeConfirmation").waitFor({ state: "visible" });
    if (scenario === "republished") {
      await page.goto(`${base}/goals.html?edit=1`);
      assert.equal(await page.locator(seatTarget).inputValue(), "7000");
      assert.equal(await page.locator('.selected-goal-editor[data-goal-key="cloud:0"] input').inputValue(), "3180000");
      await page.locator("#cascadeGoals").click();
      await page.locator("#cascadeConfirmation").waitFor({ state: "visible" });
    }
    if (scenario === "legacy") {
      await page.evaluate(() => {
        const plan = JSON.parse(localStorage.getItem("fabrikam-published-goals"));
        plan.goalTargets.unshift({
          key: "cloud:0", name: "Partner Influenced ACR", formattedValue: "$0", sourceValue: "$3.18M",
        });
        plan.goals.unshift("Partner Influenced ACR");
        localStorage.setItem("fabrikam-published-goals", JSON.stringify(plan));
      });
    }
    await page.locator(".return-plan").click();
    await page.locator("#personaButton").click();
    await page.locator("#switchToSarah").click();
    await page.getByRole("button", { name: "Review goal", exact: true }).click();
    await page.getByRole("button", { name: "Accept Fabrikam goal", exact: true }).waitFor();
    if (scenario === "legacy") {
      assert.match(await page.locator(".demo-portfolio-target-editor").innerText(), /restored from source measure/);
    }
    const valid = await page.locator(".demo-portfolio-target-editor input").evaluateAll(
      (inputs) => inputs.every((input) => input.checkValidity()),
    );
    assert.ok(valid, "All cascaded targets must be populated before acceptance");
    const acceptButton = page.getByRole("button", { name: "Accept Fabrikam goal", exact: true });
    if (scenario === "storage-error") {
      await page.evaluate(() => {
        window.originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "fabrikam-inherited-goal-choice") {
            throw new DOMException("Storage quota exceeded", "QuotaExceededError");
          }
          return window.originalSetItem.call(this, key, value);
        };
      });
      await acceptButton.click();
      assert.match(await page.getByRole("alert").innerText(), /Could not save your goal/);
      assert.equal(await page.evaluate(() => localStorage.getItem("fabrikam-inherited-goal-choice")), null);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.originalSetItem;
        delete window.originalSetItem;
      });
    }
    let navigations = 0;
    page.on("framenavigated", () => navigations++);
    const beforeAccept = page.url();
    if (scenario === "keyboard") {
      await page.locator(".demo-portfolio-target-editor input").press("Enter");
    } else {
      await acceptButton.click();
    }
    await page.getByRole("button", { name: "Edit goal targets", exact: true }).waitFor();
    assert.match(
      await page.locator(".demo-active-progress-list").innerText(),
      new RegExp(`${expectedTarget.toLocaleString("en-US")} seat target`),
    );
    assert.equal(page.url(), beforeAccept, "Acceptance must apply on the current page");
    assert.equal(navigations, 0, "Acceptance must not reload the page");
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.equal(await page.locator(".demo-inherited-goal-panel").getAttribute("aria-busy"), null);
    const accepted = await page.evaluate(() => JSON.parse(localStorage.getItem("fabrikam-inherited-goal-choice")));
    assert.equal(accepted.choice, "accepted");
    assert.equal(accepted.goalTargets.find((target) => target.key === "business:0").value, expectedTarget);
    if (scenario === "republished" || scenario === "legacy") {
      assert.equal(accepted.goalTargets.find((target) => target.key === "cloud:0").value, 3180000);
    }
    if (scenario === "screenshot" && process.env.PROTOTYPE_SCREENSHOT) {
      await page.screenshot({ path: process.env.PROTOTYPE_SCREENSHOT, fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: Sarah accepts ${scenario} cascaded goals`);
  } catch (error) {
    console.error("Page URL:", page.url());
    console.error("Browser errors:", errors);
    console.error("Goal panel:", await page.locator(".demo-inherited-goal-panel").allTextContents());
    console.error("Published and accepted state:", await page.evaluate(() => ({
      published: localStorage.getItem("fabrikam-published-goals"),
      accepted: localStorage.getItem("fabrikam-inherited-goal-choice"),
    })));
    throw error;
  } finally {
    await context.close();
  }
}

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
    );
    const base = process.env.PROTOTYPE_BASE_URL || `http://127.0.0.1:${server.address().port}`;
    for (const scenario of ["screenshot", "new", "republished", "legacy", "keyboard", "storage-error"]) {
      await verifyAcceptance(browser, base, scenario);
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
