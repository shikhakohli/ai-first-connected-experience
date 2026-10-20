const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "prototype-state.js"), "utf8");
const localKeys = [
  "fabrikam-published-goals",
  "fabrikam-inherited-goal-choice",
  "fabrikam-eric-personal-goal",
  "fabrikam-journey-innovations-proposal",
  "journey-innovations-goal-choice",
  "journey-innovations-customer-proposals",
  "journey-innovations-transaction-signal",
  "apex-partners-goal-choice",
  "apex-partners-customer-proposals",
  "fabrikam-sarah-completed-transactions",
  "maicpp-enrollment-progress",
  "maicpp-journey-state",
  "maicpp-completed-actions",
  "maicpp-chat-history",
  "maicpp-chat-return",
  "maicpp-active-role",
];
const sessionKeys = [
  "show-fabrikam-inherited-goal",
  ...["eric", "sarah", "jane", "paul"].flatMap((persona) => [
    `dismissed-home-cards-${persona}`,
    `dismissed-alliance-cards-${persona}`,
  ]),
];

function runReset(type) {
  const local = new Map([...localKeys, "unrelated-state"].map((key) => [key, "saved"]));
  const session = new Map([...sessionKeys, "unrelated-state"].map((key) => [key, "saved"]));
  vm.runInNewContext(source, {
    performance: { getEntriesByType: () => type ? [{ type }] : [] },
    localStorage: { removeItem: (key) => local.delete(key) },
    sessionStorage: { removeItem: (key) => session.delete(key) },
  });
  return { local, session };
}

test("refresh resets every profile while preserving unrelated origin state", () => {
  const { local, session } = runReset("reload");
  assert.deepEqual([...local.keys()], ["unrelated-state"]);
  assert.deepEqual([...session.keys()], ["unrelated-state"]);
});

for (const type of ["navigate", "back_forward", undefined]) {
  test(`preserves progress on ${type || "missing navigation entry"}`, () => {
    const { local, session } = runReset(type);
    assert.equal(local.size, localKeys.length + 1);
    assert.equal(session.size, sessionKeys.length + 1);
  });
}

for (const entry of [
  "index.html",
  "start-113.html",
  "goals.html",
  "health-dashboard.html",
  "partner-health.html",
  "pem.html",
  path.join("alliance-manager", "index.html"),
  path.join("alliance-manager", "current-113.html"),
]) {
  test(`${entry} resets before any application scripts load`, () => {
    const html = fs.readFileSync(path.join(root, entry), "utf8");
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
    assert.match(scripts[0][1], /prototype-state\.js/);
    const sourceFile = scripts[0][1].split("?")[0].replaceAll("/", path.sep);
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(entry), sourceFile)));
  });
}
