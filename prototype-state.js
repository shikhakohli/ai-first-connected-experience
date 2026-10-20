(() => {
  if (performance.getEntriesByType("navigation")[0]?.type !== "reload") return;

  [
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
  ].forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("show-fabrikam-inherited-goal");
  ["eric", "sarah", "jane", "paul"].forEach((persona) => {
    sessionStorage.removeItem(`dismissed-home-cards-${persona}`);
    sessionStorage.removeItem(`dismissed-alliance-cards-${persona}`);
  });
})();
