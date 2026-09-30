function applyHealthDashboardOverrides(frameDocument) {
  const replacements = new Map([
    ["Contoso Cloud Solutions", "Fabrikam Cloud Solutions"],
    ["Contoso US", "Fabrikam US"],
  ]);
  const legacyAgentPattern =
    /\b(?:PC|Partner(?: Center)?) AI Assist(?:ant)?\b|\bPartner Center AI\b|\bAI Assistant\b/gi;
  const updateValue = (value) => {
    let updated = value;
    replacements.forEach((replacement, original) => {
      updated = updated.replaceAll(original, replacement);
    });
    return updated.replace(legacyAgentPattern, "Partner Agent");
  };

  const normalize = (root) => {
    if (root.nodeType === 3) {
      const updated = updateValue(root.nodeValue);
      if (updated !== root.nodeValue) root.nodeValue = updated;
      return;
    }

    const walker = frameDocument.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );
    let textNode;
    while ((textNode = walker.nextNode())) {
      const updated = updateValue(textNode.nodeValue);
      if (updated !== textNode.nodeValue) textNode.nodeValue = updated;
    }

    const elements = root.matches ? [root, ...root.querySelectorAll("*")] : [];
    elements.forEach((element) => {
      ["aria-label", "placeholder", "title"].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const value = element.getAttribute(attribute);
        const updated = updateValue(value);
        if (updated !== value) element.setAttribute(attribute, updated);
      });
    });
  };

  normalize(frameDocument.body);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" || mutation.type === "characterData") {
        normalize(mutation.target);
        return;
      }
      mutation.addedNodes.forEach(normalize);
    });
  }).observe(frameDocument.body, {
    attributes: true,
    attributeFilter: ["aria-label", "placeholder", "title"],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const healthDashboard = document.querySelector(".dashboard-frame");
const initializeHealthDashboardOverrides = () => {
  if (healthDashboard?.contentDocument?.body) {
    applyHealthDashboardOverrides(healthDashboard.contentDocument);
  }
};

healthDashboard?.addEventListener("load", initializeHealthDashboardOverrides);
initializeHealthDashboardOverrides();
