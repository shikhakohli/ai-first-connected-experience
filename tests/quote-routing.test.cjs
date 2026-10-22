const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "alliance-manager", "persona-switch.js"),
  "utf8",
);
const start = source.indexOf('    detail.addEventListener("click", (event) => {');
const end = source.indexOf("    document.body.appendChild(detail);", start);
assert.ok(start >= 0 && end > start, "Recommendation click handler must exist");
const handlerSource = source.slice(start, end);

function clickQuoteButton({ text, action, inCustomerCard }) {
  const openedQuotes = [];
  const reviewedCards = [];
  const card = {};
  let clickHandler;
  vm.runInNewContext(handlerSource, {
    detail: {
      addEventListener: (event, handler) => {
        assert.equal(event, "click");
        clickHandler = handler;
      },
    },
    openGcpsProposalWorkspace: (...args) => openedQuotes.push(args),
    addDealEditor: (customerCard) => reviewedCards.push(customerCard),
  });
  const button = {
    textContent: text,
    dataset: { action },
    closest: (selector) => {
      assert.equal(selector, ".demo-customer-recommendation");
      return inCustomerCard ? card : null;
    },
  };
  clickHandler({ target: { closest: () => button } });
  return { openedQuotes, reviewedCards, card };
}

test("customer-specific quote is not replaced with a generic Microsoft-price quote", () => {
  const result = clickQuoteButton({
    text: "Prepare reseller quote",
    action: "proposal",
    inCustomerCard: true,
  });
  assert.deepEqual(result.openedQuotes, []);
});

test("customer quote action opens deal review without opening a generic quote", () => {
  const result = clickQuoteButton({
    text: "Prepare reseller quote",
    action: "prepare-offer",
    inCustomerCard: true,
  });
  assert.deepEqual(result.openedQuotes, []);
  assert.deepEqual(result.reviewedCards, [result.card]);
});

for (const text of ["Prepare reseller quote", "Create reseller customer proposal"]) {
  test(`${text} keeps the generic reseller-opportunity flow`, () => {
    const result = clickQuoteButton({ text, inCustomerCard: false });
    assert.equal(result.openedQuotes.length, 1);
    assert.equal(result.openedQuotes[0].length, 0);
    assert.deepEqual(result.reviewedCards, []);
  });
}
