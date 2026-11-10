const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "alliance-manager");
const bundle = fs.readFileSync(path.join(root, "assets", "index-D2o9hV1e.js"), "utf8");
const personaSource = fs.readFileSync(path.join(root, "persona-switch.js"), "utf8");
const start = bundle.indexOf("y === `growth` &&");
const end = bundle.indexOf(", y === `risk`", start);
assert.ok(start >= 0 && end > start, "Growth tile renderer must exist");
const renderer = bundle.slice(start, end);
const scenarioNames = ["Grow - Scale Ready", "Acquire - Low Chat", "Acquire - No M365"];

function renderGrowth(savedGoal) {
  const prompts = [];
  const jsx = (type, props) => ({ type, ...props });
  const grid = vm.runInNewContext(renderer, {
    y: "growth",
    savedGoal,
    P: { jsx, jsxs: jsx },
    N: () => {},
    openCustomerChat: (prompt) => prompts.push(prompt),
  });
  return { cards: grid.children, prompts };
}

for (const savedGoal of [null, "Grow paid Copilot seats"]) {
  test(`new growth tiles render with working details actions (${savedGoal || "no goal"})`, () => {
    const { cards, prompts } = renderGrowth(savedGoal);
    assert.equal(cards.length, 9);
    const newCards = cards.slice(-3);
    assert.deepEqual(
      Array.from(newCards, (card) => card.children[1].children[1].children),
      scenarioNames,
    );
    for (const [index, card] of newCards.entries()) {
      assert.equal(card.children[3].children, "N/A");
      const summary = card.children[5].children;
      assert.match(summary, /^Customers /);
      assert.match(summary, /Copilot/);
      card.children[6].onClick();
      assert.equal(prompts[index], `Provide more details on ${scenarioNames[index]}.`);
    }
  });
}

test("Copilot goal filtering retains all three new scenarios", () => {
  const start = personaSource.indexOf("    const alignRecommendationsToGoals = ");
  const end = personaSource.indexOf("    const showActiveGoal = ", start);
  assert.ok(start >= 0 && end > start, "Goal alignment handler must exist");
  const titles = [...scenarioNames, "Copilot Monetization", "Copilot Chat Activation", "Promotions"];
  const cards = titles.map((title) => ({
    hidden: false,
    querySelector: () => ({ textContent: title }),
  }));
  const grid = {
    children: cards,
    querySelector: () => ({ remove() {} }),
  };
  const mainContent = {
    querySelectorAll: (selector) => selector === "button"
      ? [{
        textContent: "Growth potential",
        parentElement: { parentElement: { querySelector: () => grid } },
      }]
      : [],
  };
  const align = vm.runInNewContext(
    `${personaSource.slice(start, end)}; alignRecommendationsToGoals;`,
    { mainContent },
  );
  align(["Grow paid Copilot seats"]);
  assert.deepEqual(cards.map((card) => card.hidden), [false, false, false, false, false, true]);
  align(["Grow Modern Work revenue"]);
  assert.ok(cards.every((card) => !card.hidden));
});
