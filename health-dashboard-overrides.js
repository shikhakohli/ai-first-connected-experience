function applyHealthDashboardNames(frameDocument) {
  const replacements = new Map([
    ["Contoso Cloud Solutions", "Fabrikam Cloud Solutions"],
    ["Contoso US", "Fabrikam US"],
  ]);

  const update = () => {
    const walker = frameDocument.createTreeWalker(
      frameDocument.body,
      NodeFilter.SHOW_TEXT,
    );
    let textNode;
    while ((textNode = walker.nextNode())) {
      let value = textNode.nodeValue;
      replacements.forEach((replacement, original) => {
        value = value.replaceAll(original, replacement);
      });
      if (value !== textNode.nodeValue) textNode.nodeValue = value;
    }
  };

  update();
  new MutationObserver(update).observe(frameDocument.body, {
    childList: true,
    subtree: true,
  });
}

const healthDashboard = document.querySelector(".dashboard-frame");
const initializeHealthDashboardNames = () => {
  if (healthDashboard?.contentDocument?.body) {
    applyHealthDashboardNames(healthDashboard.contentDocument);
  }
};

healthDashboard?.addEventListener("load", initializeHealthDashboardNames);
initializeHealthDashboardNames();
