(() => {
  if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
    [
      "fabrikam-published-goals",
      "fabrikam-inherited-goal-choice",
      "fabrikam-eric-personal-goal",
      "journey-innovations-goal-choice",
      "apex-partners-goal-choice",
      "apex-partners-customer-proposals",
      "journey-innovations-transaction-signal",
      "fabrikam-sarah-completed-transactions",
    ].forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("show-fabrikam-inherited-goal");
  }

  const selectedPersona = new URLSearchParams(window.location.search).get("persona");
  const requestedJourney = new URLSearchParams(window.location.search).get("journey");
  const isEric = selectedPersona === "eric";
  const isJane = selectedPersona === "jane";
  const isPaul = selectedPersona === "paul";
  const publishedGoalKey = "fabrikam-published-goals";
  const inheritedGoalChoiceKey = "fabrikam-inherited-goal-choice";
  const janeGoalChoiceKey = "journey-innovations-goal-choice";
  const paulGoalChoiceKey = "apex-partners-goal-choice";
  const portfolioGoalChoiceKey = isJane
    ? janeGoalChoiceKey
    : isPaul
      ? paulGoalChoiceKey
      : inheritedGoalChoiceKey;
  const ericPersonalGoalKey = "fabrikam-eric-personal-goal";
  const journeyProposalKey = "fabrikam-journey-innovations-proposal";
  const journeyCustomerProposalsKey = "journey-innovations-customer-proposals";
  const paulCustomerProposalsKey = "apex-partners-customer-proposals";
  const customerProposalsKey = isPaul
    ? paulCustomerProposalsKey
    : journeyCustomerProposalsKey;
  const journeyTransactionSignalKey = "journey-innovations-transaction-signal";
  const sarahCompletedTransactionsKey = "fabrikam-sarah-completed-transactions";
  const buildVersion = "154";
  let janeDistributorFilter = "All distributors";
  let openCurrentProposalWorkspace = null;

  const normalizePartnerAgentLanguage = (root) => {
    const legacyAgentPattern =
      /\bPartner Center Agent\b|\b(?:PC|Partner(?: Center)?) AI Assist(?:ant)?\b|\bPartner Center AI\b|\bAI Assistant\b/gi;
    const updateValue = (value) =>
      value?.replace(legacyAgentPattern, "Partner Agent");

    if (root.nodeType === Node.TEXT_NODE) {
      const updated = updateValue(root.nodeValue);
      if (updated !== root.nodeValue) root.nodeValue = updated;
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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

  normalizePartnerAgentLanguage(document.documentElement);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" || mutation.type === "characterData") {
        normalizePartnerAgentLanguage(mutation.target);
        return;
      }
      mutation.addedNodes.forEach(normalizePartnerAgentLanguage);
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["aria-label", "placeholder", "title"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  const getPublishedPlan = () => {
    const value = localStorage.getItem(publishedGoalKey);
    if (!value) return null;

    try {
      const plan = JSON.parse(value);
      if (!Array.isArray(plan.goals) || !Array.isArray(plan.roles)) return null;
      return plan;
    } catch {
      localStorage.removeItem(publishedGoalKey);
      return null;
    }
  };

  const getJourneyProposal = () => {
    try {
      return JSON.parse(localStorage.getItem(journeyProposalKey) || "null");
    } catch {
      localStorage.removeItem(journeyProposalKey);
      return null;
    }
  };

  const getCustomerProposals = () => {
    try {
      return JSON.parse(localStorage.getItem(customerProposalsKey) || "{}");
    } catch {
      localStorage.removeItem(customerProposalsKey);
      return {};
    }
  };

  const getCustomerProposal = (customer) =>
    getCustomerProposals()[customer] || null;

  const saveCustomerProposal = (customer, proposal) => {
    const proposals = getCustomerProposals();
    proposals[customer] = proposal;
    localStorage.setItem(customerProposalsKey, JSON.stringify(proposals));
  };

  const getSarahCompletedTransactions = () => {
    try {
      const transactions = JSON.parse(
        localStorage.getItem(sarahCompletedTransactionsKey) || "[]",
      );
      return Array.isArray(transactions) ? transactions : [];
    } catch {
      localStorage.removeItem(sarahCompletedTransactionsKey);
      return [];
    }
  };

  const recordSarahCompletedTransaction = (transaction) => {
    const transactions = getSarahCompletedTransactions();
    const existingIndex = transactions.findIndex(
      (existing) => existing.id === transaction.id,
    );
    if (existingIndex >= 0) {
      transactions[existingIndex] = transaction;
    } else {
      transactions.push(transaction);
    }
    localStorage.setItem(sarahCompletedTransactionsKey, JSON.stringify(transactions));
    return existingIndex < 0;
  };

  const parseCompactCurrency = (value) => {
    const normalized = String(value || "").trim().toUpperCase();
    const amount = Number(normalized.replaceAll(/[^0-9.-]/g, "")) || 0;
    if (normalized.endsWith("M")) return amount * 1_000_000;
    if (normalized.endsWith("K")) return amount * 1_000;
    return amount;
  };

  const renderShareSlider = (attributes) => `
    <div class="demo-range-control">
      <input type="range" min="0" max="100" step="1" value="50" ${attributes} />
      <div class="demo-range-scale" aria-hidden="true">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  `;

  const getCustomerTransactionId = (customer) =>
    `customer:${String(customer || "").trim().toLowerCase()}`;

  const createGoalSummary = (goals) => {
    if (goals.length <= 2) return goals.join(" and ");
    return `${goals.slice(0, 2).join(", ")} and ${goals.length - 2} more`;
  };
  const menu = document.createElement("div");
  menu.className = "demo-persona-menu";
  menu.hidden = true;
  const currentPersonaName = isEric ? "Eric" : isJane ? "Karin" : isPaul ? "Chris" : "Sarah";
  const currentPersonaRole = isEric
    ? "Global alliance manager · Fabrikam"
    : isJane
      ? "Growth lead · Journey Innovations"
      : isPaul
        ? "Incentive manager · Apex Partners · CSP Direct Partner"
        : "Alliance manager · United States";
  const personaOptions = [
    !isEric && `
      <button class="demo-persona-option" type="button" data-persona="eric">
        <span class="demo-persona-avatar">E</span>
        <span><strong>Eric</strong><small>Global alliance manager · Fabrikam</small></span>
      </button>
    `,
    !isJane && `
      <button class="demo-persona-option" type="button" data-persona="jane">
        <span class="demo-persona-avatar demo-jane-avatar">K</span>
        <span><strong>Karin</strong><small>Growth lead · Journey Innovations</small></span>
      </button>
    `,
    !isPaul && `
      <button class="demo-persona-option" type="button" data-persona="paul">
        <span class="demo-persona-avatar">C</span>
        <span><strong>Chris</strong><small>Incentive manager · Apex Partners</small></span>
      </button>
    `,
    selectedPersona !== "sarah" && `
      <button class="demo-persona-option" type="button" data-persona="sarah">
        <span class="demo-persona-avatar">S</span>
        <span><strong>Sarah</strong><small>Alliance manager · United States</small></span>
      </button>
    `,
  ].filter(Boolean).join("");
  menu.innerHTML = `
    <div class="demo-persona-current">
      <strong>${currentPersonaName}</strong>
      <span>${currentPersonaRole}</span>
    </div>
    ${personaOptions}
  `;
  document.body.appendChild(menu);

  const alignLeftNavigation = () => {
    const homeLabel = [...document.querySelectorAll("aside button p")].find(
      (label) => label.textContent.trim() === "Home",
    );
    const navigation = homeLabel?.closest("aside");
    if (!navigation) return false;

    const agentHeading = [...navigation.querySelectorAll("*")].find(
      (element) => !element.children.length && element.textContent.trim() === "Agents",
    );
    if (agentHeading) agentHeading.textContent = "Partner Agent Skills";
    if (navigation.dataset.ericNavAligned) return true;

    navigation.dataset.ericNavAligned = "true";
    navigation.classList.add("demo-eric-nav");
    navigation.querySelectorAll("button").forEach((button) => {
      if (button.querySelector("p")?.className.includes("text-[#0f6cbd]")) {
        button.classList.add("demo-nav-active");
      }
    });
    return true;
  };

  if (!alignLeftNavigation()) {
    const navigationObserver = new MutationObserver(() => {
      if (alignLeftNavigation()) navigationObserver.disconnect();
    });
    navigationObserver.observe(document.getElementById("root"), { childList: true, subtree: true });
  }

  const attachToAccountButton = () => {
    const accountButton = document.querySelector('button[aria-label="User account"]');
    if (!accountButton || accountButton.dataset.personaSwitchAttached) return false;

    accountButton.dataset.personaSwitchAttached = "true";
    if (isJane) {
      accountButton.textContent = "K";
      accountButton.classList.add("demo-jane-account");
    } else if (!isEric) {
      accountButton.textContent = isPaul ? "C" : "SC";
      accountButton.classList.add("demo-sarah-account");
    }
    accountButton.setAttribute("aria-haspopup", "menu");
    accountButton.setAttribute("aria-expanded", "false");
    accountButton.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      accountButton.setAttribute("aria-expanded", String(!menu.hidden));
    });
    return true;
  };

  if (!attachToAccountButton()) {
    const observer = new MutationObserver(() => {
      if (attachToAccountButton()) observer.disconnect();
    });
    observer.observe(document.getElementById("root"), { childList: true, subtree: true });
  }

  menu.querySelectorAll(".demo-persona-option").forEach((option) => {
    option.addEventListener("click", () => {
      const persona = option.dataset.persona;
      if (persona === "jane") {
        window.location.href = "../index.html?persona=jane&v=25";
        return;
      }
      if (persona === "paul") {
        window.location.href = "../index.html?persona=paul&v=82";
        return;
      }
      window.location.href = persona === "sarah"
        ? `./current-113.html?persona=sarah&view=home&fresh=${Date.now()}`
        : "../index.html";
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".demo-persona-menu")) {
      menu.hidden = true;
      const accountButton = document.querySelector('button[aria-label="User account"]');
      accountButton?.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") menu.hidden = true;
  });

  const openCustomerWithInheritedGoal = () => {
    sessionStorage.setItem("show-fabrikam-inherited-goal", "true");
    const customerButton = [...document.querySelectorAll("aside button")].find(
      (button) => button.querySelector("p")?.textContent.trim() === "Customer",
    );
    customerButton?.click();
  };

  const addPublishedGoalToSarahHome = () => {
    if (isEric || isJane || isPaul) return false;
    const plan = getPublishedPlan();
    if (!plan?.goals.length || !plan.roles.includes("Alliance managers")) return false;
    let goalDecision = null;
    try {
      goalDecision = JSON.parse(localStorage.getItem(inheritedGoalChoiceKey) || "null");
    } catch {
      localStorage.removeItem(inheritedGoalChoiceKey);
    }

    const growHeading = [...document.querySelectorAll("h2")].find(
      (heading) => heading.textContent.trim() === "Grow",
    );
    const growSection = growHeading?.parentElement?.parentElement;
    const cardList = growSection?.querySelector(".space-y-3");
    if (!growSection || !cardList) return false;
    if (goalDecision?.choice === "accepted") {
      cardList.querySelector(".demo-published-goal-card")?.remove();
      return false;
    }
    if (cardList.querySelector(".demo-published-goal-card")) return false;

    const card = document.createElement("div");
    card.className = "demo-published-goal-card";
    card.innerHTML = `
      <div class="demo-goal-icon">🎯</div>
      <div class="demo-goal-content">
        <div class="demo-goal-eyebrow">NEW ORGANIZATION GOAL · FROM ERIC, GLOBAL ALLIANCE MANAGER</div>
        <strong>Fabrikam’s FY27 goals are ready for your market</strong>
        <p>${createGoalSummary(plan.goals)}</p>
        <div class="demo-goal-actions">
          <span>Review and align your customer portfolio</span>
          <button type="button">Review goal</button>
        </div>
      </div>
    `;
    card.querySelector("button").addEventListener("click", openCustomerWithInheritedGoal);
    cardList.prepend(card);

    const count = growHeading.parentElement.querySelector("span:last-child");
    if (count && /^\d+$/.test(count.textContent.trim())) {
      count.textContent = String(Number(count.textContent.trim()) + 1);
    }
    return true;
  };

  const openSarahTransactionSignal = (signal) => {
    document.querySelector(".demo-journey-recommendation")?.remove();
    const detail = document.createElement("section");
    detail.className = "demo-journey-recommendation demo-transaction-signal-chat";
    detail.innerHTML = `
      <header class="demo-journey-chat-header">
        <div><span>✣</span><div><strong>Partner Agent</strong><small>Fabrikam · Transaction handoff</small></div></div>
        <button class="demo-journey-close" type="button" aria-label="Close transaction details">×</button>
      </header>
      <div class="demo-journey-thread">
        <div class="demo-user-prompt">Show me the transaction signal from Journey Innovations.</div>
        <div class="demo-assistant-label">✣ Partner Agent</div>
        <article class="demo-sarah-transaction-message">
          <span class="demo-jane-proposal-badge">READY FOR TRANSACT · FROM KARIN</span>
          <h1>Journey Innovations says customer ${signal.customer} is ready for transact</h1>
          <p>Karin reviewed the Monetize Copilot recommendation and signaled Fabrikam to complete the transaction.</p>
          <dl>
            <div><dt>Customer</dt><dd>${signal.customer}</dd></div>
            <div><dt>Distributor</dt><dd>${signal.distributor}</dd></div>
            <div><dt>Product</dt><dd>${signal.product}</dd></div>
            <div><dt>Seat count</dt><dd>${signal.seats}</dd></div>
            <div><dt>Price per seat</dt><dd>${signal.unitPrice}</dd></div>
            <div><dt>Full opportunity size</dt><dd>${signal.opportunitySize}</dd></div>
            <div><dt>Billing frequency</dt><dd>${signal.billingFrequency}</dd></div>
            <div><dt>Term duration</dt><dd>${signal.termDuration}</dd></div>
            <div><dt>Subscription end date</dt><dd>${signal.subscriptionEndDate}</dd></div>
          </dl>
          <button class="demo-sarah-transact" type="button">Transact</button>
          <p class="demo-sarah-transaction-status" hidden></p>
        </article>
      </div>
    `;
    const closeTransactionSignal = () => detail.remove();
    detail.querySelector(".demo-journey-close").addEventListener("click", closeTransactionSignal);
    detail.querySelector(".demo-sarah-transact").addEventListener("click", (event) => {
      const dealSize = parseCompactCurrency(signal.opportunitySize);
      const seats = Number(String(signal.seats || "").replaceAll(/[^0-9.-]/g, "")) || 0;
      const incentiveEarned = dealSize * 0.195;
      const completedSignal = {
        ...signal,
        status: "Completed",
        completedAt: new Date().toISOString(),
        incentiveEarned,
      };
      localStorage.setItem(journeyTransactionSignalKey, JSON.stringify(completedSignal));
      recordSarahCompletedTransaction({
        id: getCustomerTransactionId(signal.customer),
        customer: signal.customer,
        seats,
        dealSize,
        incentiveEarned,
        completedAt: completedSignal.completedAt,
      });
      document.querySelector(".demo-transaction-signal-card")?.remove();
      event.currentTarget.textContent = "Transaction completed";
      event.currentTarget.disabled = true;
      const status = detail.querySelector(".demo-sarah-transaction-status");
      status.textContent = `Transaction completed for ${signal.customer}.`;
      status.hidden = false;
    });
    document.body.appendChild(detail);
    document.querySelectorAll("aside button").forEach((button) => {
      if (!button.closest(".demo-journey-recommendation")) {
        button.addEventListener("click", closeTransactionSignal, { once: true });
      }
    });
  };

  const addJourneyTransactionSignalToSarahHome = () => {
    if (isEric || isJane || isPaul) return false;
    let signal = null;
    try {
      signal = JSON.parse(localStorage.getItem(journeyTransactionSignalKey) || "null");
    } catch {
      localStorage.removeItem(journeyTransactionSignalKey);
      return false;
    }
    if (!signal?.customer) return false;
    if (signal.status === "Completed") {
      document.querySelector(".demo-transaction-signal-card")?.remove();
      return false;
    }

    const growHeading = [...document.querySelectorAll("h2")].find(
      (heading) => heading.textContent.trim() === "Grow",
    );
    const growSection = growHeading?.parentElement?.parentElement;
    const cardList = growSection?.querySelector(".space-y-3");
    if (!cardList) return false;

    let card = cardList.querySelector(".demo-transaction-signal-card");
    const signalVersion = `${signal.signaledAt || ""}:${signal.completedAt || ""}:${signal.status}`;
    if (card?.dataset.signalVersion === signalVersion) return true;
    if (!card) {
      card = document.createElement("div");
      card.className = "demo-transaction-signal-card";
      cardList.prepend(card);
    }
    card.dataset.signalVersion = signalVersion;
    card.innerHTML = `
      <div class="demo-goal-icon">↗</div>
      <div class="demo-goal-content">
        <div class="demo-goal-eyebrow">READY FOR TRANSACT · FROM KARIN</div>
        <strong>Journey Innovations says customer ${signal.customer} is ready for transact</strong>
        <p>${signal.seats} ${signal.product} seats at ${signal.unitPrice} per seat · ${signal.opportunitySize} opportunity</p>
        <div class="demo-goal-actions">
          <span>${signal.billingFrequency} · ${signal.termDuration}</span>
          <button type="button">Review transaction details</button>
        </div>
      </div>
    `;
    card.querySelector("button")?.addEventListener("click", () => {
      openSarahTransactionSignal(signal);
    });
    return true;
  };

  const addSarahCspIncentiveToManage = () => {
    if (isEric || isJane || isPaul) return false;
    let pendingTransaction = null;
    try {
      pendingTransaction = JSON.parse(
        localStorage.getItem(journeyTransactionSignalKey) || "null",
      );
    } catch {
      localStorage.removeItem(journeyTransactionSignalKey);
    }
    if (pendingTransaction?.status && pendingTransaction.status !== "Completed") {
      document.querySelector(".demo-csp-incentive-card")?.remove();
      return false;
    }
    const transactions = getSarahCompletedTransactions();
    if (!transactions.length) {
      document.querySelector(".demo-csp-incentive-card")?.remove();
      return false;
    }

    const manageHeading = [...document.querySelectorAll("h2")].find(
      (heading) => heading.textContent.trim() === "Manage",
    );
    const cardList = manageHeading?.parentElement?.parentElement?.querySelector(".space-y-3");
    if (!cardList) return false;

    const completedSeats = transactions.reduce(
      (sum, transaction) => sum + Number(transaction.seats || 0),
      0,
    );
    const incentivesEarned = transactions.reduce(
      (sum, transaction) => sum + Number(transaction.incentiveEarned || 0),
      0,
    );
    const latest = transactions.at(-1);
    const cardVersion = `${transactions.length}:${completedSeats}:${incentivesEarned}`;
    let card = cardList.querySelector(".demo-csp-incentive-card");
    if (card?.dataset.cardVersion === cardVersion) return true;
    if (!card) {
      card = document.createElement("div");
      card.className = "demo-csp-incentive-card";
      cardList.prepend(card);
    }
    card.dataset.cardVersion = cardVersion;
    card.innerHTML = `
      <div class="demo-goal-icon">$</div>
      <div class="demo-goal-content">
        <div class="demo-goal-eyebrow">NEW CSP INCENTIVES EARNED</div>
        <strong>${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(incentivesEarned)} in CSP incentives earned</strong>
        <p>${completedSeats.toLocaleString("en-US")} Microsoft 365 Copilot seats transacted${transactions.length === 1 && latest?.customer ? ` for ${latest.customer}` : ` across ${transactions.length} completed deals`}. Your Copilot NPSA progress has been updated.</p>
        <div class="demo-goal-actions">
          <span>Completed transaction</span>
          <button type="button">View customer progress</button>
        </div>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      window.location.href =
        `./current-113.html?persona=sarah&view=customer&fresh=${Date.now()}`;
    });
    return true;
  };

  const addInheritedGoalDecision = () => {
    const plan = getPublishedPlan();
    const hasFabrikamGoal = !isJane && !isPaul && Boolean(plan?.goals.length);
    let previousGoalDecision = null;
    try {
      previousGoalDecision = JSON.parse(localStorage.getItem(portfolioGoalChoiceKey) || "null");
    } catch {
      localStorage.removeItem(portfolioGoalChoiceKey);
    }
    const previousChoice = isEric ? null : previousGoalDecision?.choice;
    const customerTitle = [...document.querySelectorAll("*")].find(
      (element) => element.children.length === 0 && element.textContent.trim() === "Customer overview",
    );
    const mainContent = customerTitle?.closest("main");
    if (!mainContent || mainContent.querySelector(".demo-inherited-goal-panel")) return false;

    const setGoalText = [...mainContent.querySelectorAll("*")].find(
      (element) => element.children.length === 0 && element.textContent.trim() === "Set your customer portfolio goal",
    );
    const existingGoalCard = setGoalText?.closest(".rounded-xl, .rounded-lg") || setGoalText?.parentElement?.parentElement;
    if (!existingGoalCard) return false;
    existingGoalCard.hidden = true;

    const panel = document.createElement("section");
    panel.className = "demo-inherited-goal-panel";
    panel.innerHTML = `
      <div class="demo-inherited-goal-heading">
        <span class="demo-goal-icon">🎯</span>
        <div>
          <span>${hasFabrikamGoal ? "FABRIKAM ORGANIZATION GOAL" : "CUSTOM GOAL"}</span>
          <strong>Apply goals to your portfolio</strong>
          <p>${hasFabrikamGoal
            ? "Choose how these goals should guide your United States customer portfolio."
            : `Set a goal for your ${isPaul ? "Apex Partners" : "United States"} customer portfolio so Partner Agent can align insights and recommendations.`}</p>
        </div>
      </div>
      <div class="demo-inherited-goals"></div>
      <div class="demo-goal-choice-actions">
        ${isEric && !hasFabrikamGoal ? '<button type="button" data-choice="set-organization">Set organization goals</button>' : ""}
        ${hasFabrikamGoal ? '<button type="button" data-choice="accept">Accept Fabrikam goal</button>' : ""}
        <button type="button" data-choice="own">Set my own custom goal</button>
      </div>
      <div class="demo-own-goal-editor" hidden>
        <div>
          <strong>Set your custom goal</strong>
          <p>Tell Partner Agent what success looks like — insights and recommendations will align to your goal.</p>
        </div>
        <div class="demo-own-goal-input">
          <textarea rows="2" placeholder="e.g. Grow Copilot paid seats by 30% and reduce renewal risk to under €50K by Q3 2026…"></textarea>
          <button type="button" disabled>Set Goal</button>
        </div>
        <div class="demo-own-goal-options">
          <button type="button">Grow Modern Work revenue by 15%</button>
          <button type="button">Convert free Copilot users to paid</button>
          <button type="button">Reduce renewal risk and improve health</button>
          <button type="button">Onboard 5 new customers and grow Azure by 20%</button>
        </div>
      </div>
      <button class="demo-reopen-goal" type="button">Review goal options</button>
    `;
    const goalList = panel.querySelector(".demo-inherited-goals");
    (isJane || isPaul ? [] : plan?.goals || []).forEach((goal) => {
      const item = document.createElement("span");
      item.textContent = goal;
      goalList.appendChild(item);
    });

    const alignRecommendationsToGoals = (activeGoals) => {
      const growthTab = [...mainContent.querySelectorAll("button")].find(
        (button) => button.textContent.trim().includes("Growth potential"),
      );
      const recommendationGrid = growthTab?.parentElement?.parentElement
        ?.querySelector(".grid.grid-cols-1");
      if (!recommendationGrid) return;

      const copilotGoal = activeGoals.some((activeGoal) => /copilot/i.test(activeGoal));
      const relevantTitles = new Set(["Copilot Monetization", "Copilot Chat Activation"]);
      const woodgroveCard = [...mainContent.querySelectorAll(".bg-white")].find(
        (card) => card.textContent.includes("Woodgrove")
          && card.textContent.includes("View recommendation details"),
      );
      const woodgroveSummary = woodgroveCard
        ? [...woodgroveCard.querySelectorAll("p")].find(
          (paragraph) => paragraph.textContent.includes("upcoming renewals")
            || paragraph.dataset.defaultSummary,
        )
        : null;
      if (woodgroveSummary) {
        woodgroveSummary.dataset.defaultSummary ||= woodgroveSummary.textContent.trim();
        woodgroveSummary.textContent = copilotGoal
          ? "Woodgrove has upcoming Microsoft 365 renewals and low Copilot utilization, creating an opportunity to introduce Copilot and protect recurring revenue."
          : woodgroveSummary.dataset.defaultSummary;
      }
      [...recommendationGrid.children].forEach((card) => {
        const title = card.querySelector(".text-\\[15px\\]")?.textContent.trim();
        card.hidden = copilotGoal && !relevantTitles.has(title);
      });

      const existingAcquisition = recommendationGrid.querySelector("[data-copilot-acquisition]");
      if (!copilotGoal) {
        existingAcquisition?.remove();
        return;
      }
      if (existingAcquisition) return;

      const monetizationCard = [...recommendationGrid.children].find(
        (card) => card.textContent.includes("Copilot Monetization"),
      );
      if (!monetizationCard) return;
      const acquisitionCard = monetizationCard.cloneNode(true);
      acquisitionCard.dataset.copilotAcquisition = "true";
      const heading = acquisitionCard.querySelector(".flex.items-center.gap-2.mb-4");
      if (heading?.firstElementChild) heading.firstElementChild.textContent = "✨";
      const title = acquisitionCard.querySelector(".text-\\[15px\\]");
      if (title) title.textContent = "Copilot Acquisition";
      const value = [...acquisitionCard.querySelectorAll("*")].find(
        (element) => element.children.length === 0
          && element.textContent.trim() === "€9,568,690.68",
      );
      if (value) value.textContent = "€6,284,400.00";
      const summary = [...acquisitionCard.querySelectorAll("p")].find(
        (element) => element.textContent.includes("actively using free chat"),
      );
      if (summary) {
        summary.textContent = "Customers are strong candidates for introduction to Copilot.";
      }
      recommendationGrid.appendChild(acquisitionCard);
    };

    const showActiveGoal = (goal, choice) => {
      const activeGoals = choice === "accepted" && plan?.goals?.length
        ? plan.goals
        : isEric && choice === "own" && plan?.goals?.length
          ? [...plan.goals, goal]
          : [goal];
      const progressLevels = [87, 74, 92, 68, 81];
      const copilotNpsaTarget = choice === "accepted"
        ? plan?.goalTargets?.find(
          (target) => /copilot/i.test(target.name)
            && /(NPSA|Net Paid Seat Adds)/i.test(target.name),
        )
        : null;
      const parseSeatValue = (value) =>
        Number(String(value ?? "").replaceAll(/[^0-9.-]/g, "")) || 0;
      const targetNpsaSeats = parseSeatValue(copilotNpsaTarget?.value);
      const completedNpsaSeats = getSarahCompletedTransactions().reduce(
        (sum, transaction) => sum + Number(transaction.seats || 0),
        0,
      );
      const currentNpsaSeats = targetNpsaSeats
        ? targetNpsaSeats * 0.54 + completedNpsaSeats
        : 0;
      const npsaProgress = targetNpsaSeats
        ? Math.round((currentNpsaSeats / targetNpsaSeats) * 100)
        : 0;
      const formatSeats = (value) => Math.round(value).toLocaleString("en-US");
      const progressMarkup = copilotNpsaTarget
        ? `
          <div class="demo-active-progress">
            <div><span>Copilot net paid seats (NPSA)</span><strong>${npsaProgress}% to goal</strong></div>
            <div class="demo-active-progress-track"><i style="width:${Math.min(npsaProgress, 100)}%"></i></div>
            <div><strong>${formatSeats(currentNpsaSeats)} net paid seats${completedNpsaSeats ? ` · +${formatSeats(completedNpsaSeats)} from completed deals` : ""}</strong><strong>🎯 ${formatSeats(targetNpsaSeats)} seat target</strong></div>
          </div>
        `
        : !copilotNpsaTarget
          ? activeGoals.map((activeGoal, index) => {
          const progress = progressLevels[index % progressLevels.length];
          const currentValue = (1.2 + index * 0.18).toFixed(2);
          const targetValue = (Number(currentValue) / (progress / 100)).toFixed(2);
          return `
            <div class="demo-active-progress">
              <div><span>${activeGoal}</span><strong>${progress}% to goal</strong></div>
              <div class="demo-active-progress-track"><i style="width:${progress}%"></i></div>
              <div><strong>€${currentValue}M</strong><strong>🎯 €${targetValue}M target</strong></div>
            </div>
          `;
          }).join("")
          : "";
      const goalSignals = copilotNpsaTarget
        ? ""
        : `
          <p class="demo-goal-signal blue">📈 Revenue at +9% growth, €18K ARR added this week. Key blocker: Woodgrove Bank EA→CSP migration not started — closes 43% of gap.</p>
          <p class="demo-goal-signal green">✦ On track for €1.29M (+7.5%) — complete 2 EA→CSP migrations and convert 85 free Copilot users to close the gap.</p>
        `;
      const progressTitle = [...mainContent.querySelectorAll("*")].find(
        (element) => !panel.contains(element)
          && element.children.length === 0
          && element.textContent.trim().includes("Progress towards set goal"),
      );
      const separateProgressCard = progressTitle?.closest(".order-3");
      if (separateProgressCard) separateProgressCard.hidden = true;
      existingGoalCard.hidden = true;

      panel.className = "demo-inherited-goal-panel demo-active-goal";
      panel.innerHTML = `
        <div class="demo-active-goal-head">
          <div>
            <span>🎯</span>
            <div>
              <strong>Progress towards set goal${activeGoals.length === 1 ? "" : "s"}</strong>
              <p>${activeGoals.length === 1 ? activeGoals[0] : `${activeGoals.length} goals applied to this portfolio`}</p>
            </div>
          </div>
          <div><span class="demo-goal-aligned">🎯 Goal-aligned</span><button type="button" data-goal-action="collapse">▼ Hide</button></div>
        </div>
        <div class="demo-goal-scope-summary">
          ${hasFabrikamGoal ? `<span><strong>Organization goal:</strong> ${createGoalSummary(plan.goals)}</span>` : ""}
          ${choice === "own" ? `<span><strong>Custom goal:</strong> ${goal}</span>` : ""}
        </div>
        <div class="demo-active-progress-list">
          ${progressMarkup}
        </div>
        <div class="demo-active-goal-details">
          ${goalSignals}
          <p class="demo-goal-recommendation-note">🎯 Your <strong>recommendation categories below</strong> are highlighted for this goal — expand any category to explore AI-guided actions.</p>
          <div class="demo-goal-management">
            ${isEric && hasFabrikamGoal ? '<button type="button" data-goal-action="edit-organization">Edit organization goals</button>' : ""}
            ${isEric && hasFabrikamGoal ? '<button type="button" data-goal-action="remove-organization">Remove organization goals</button>' : ""}
            ${isEric && !hasFabrikamGoal ? '<button type="button" data-goal-action="set-organization">Set organization goals</button>' : ""}
            ${!isEric && hasFabrikamGoal && choice !== "accepted" ? '<button type="button" data-goal-action="apply-organization">Apply organization goal</button>' : ""}
            <button type="button" data-goal-action="edit-personal">${choice === "own" ? "Edit custom goal" : "Set custom goal"}</button>
            ${choice === "own" ? '<button type="button" data-goal-action="remove-personal">Remove custom goal</button>' : ""}
            ${!isEric ? '<button type="button" data-goal-action="remove-goal">Remove goal</button>' : ""}
          </div>
          <div class="demo-active-personal-editor" hidden>
            <div class="demo-active-custom-input">
              <input aria-label="Custom goal" value="${choice === "own" ? goal : ""}" placeholder="Describe your custom goal" />
              <button type="button" data-goal-action="save-personal">Save custom goal</button>
              <button type="button" data-goal-action="cancel-personal">Cancel</button>
            </div>
            <div class="demo-active-custom-prompts" aria-label="Suggested custom goals">
              <button type="button">Grow Modern Work revenue by 15%</button>
              <button type="button">Convert free Copilot users to paid</button>
              <button type="button">Reduce renewal risk and improve health</button>
              <button type="button">Onboard 5 new customers and grow Azure by 20%</button>
            </div>
          </div>
          <div class="demo-active-goal-actions">
            <span>Secondary goal:</span>
            <button type="button">＋ Add a secondary goal</button>
          </div>
          <button class="demo-action-plan" type="button">📋 View detailed action plan →</button>
        </div>
      `;
      alignRecommendationsToGoals(activeGoals);
      const collapseButton = panel.querySelector('[data-goal-action="collapse"]');
      collapseButton.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("goal-collapsed");
        collapseButton.textContent = collapsed ? "▶ Show details" : "▼ Hide";
      });
      panel.querySelector('[data-goal-action="edit-organization"]')?.addEventListener("click", () => {
        window.location.href = "../goals.html?edit=1";
      });
      panel.querySelector('[data-goal-action="set-organization"]')?.addEventListener("click", () => {
        window.location.href = "../goals.html";
      });
      panel.querySelector('[data-goal-action="remove-organization"]')?.addEventListener("click", () => {
        localStorage.removeItem(publishedGoalKey);
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("goalReset", String(Date.now()));
        window.location.href = nextUrl.toString();
      });
      panel.querySelector('[data-goal-action="apply-organization"]')?.addEventListener("click", () => {
        localStorage.setItem(portfolioGoalChoiceKey, JSON.stringify({
          choice: "accepted",
          goals: plan.goals,
        }));
        window.location.href =
          `./current-113.html?persona=sarah&view=customer&goalAccepted=${Date.now()}`;
      });
      panel.querySelector('[data-goal-action="remove-goal"]')?.addEventListener("click", () => {
        localStorage.removeItem(portfolioGoalChoiceKey);
        sessionStorage.setItem("show-fabrikam-inherited-goal", "true");
        window.location.href =
          `./current-113.html?persona=${isJane ? "jane" : isPaul ? "paul" : "sarah"}&view=customer&goalReset=${Date.now()}`;
      });
      panel.querySelector('[data-goal-action="remove-personal"]')?.addEventListener("click", () => {
        if (isEric) {
          localStorage.removeItem(ericPersonalGoalKey);
          applyGoalToPage(createGoalSummary(plan.goals), "accepted");
          return;
        }
        localStorage.removeItem(portfolioGoalChoiceKey);
        sessionStorage.setItem("show-fabrikam-inherited-goal", "true");
        window.location.href =
          `./current-113.html?persona=${isJane ? "jane" : isPaul ? "paul" : "sarah"}&view=customer&goalReset=${Date.now()}`;
      });
      const personalEditor = panel.querySelector(".demo-active-personal-editor");
      panel.querySelector('[data-goal-action="edit-personal"]').addEventListener("click", () => {
        personalEditor.hidden = false;
        personalEditor.querySelector("input").focus();
      });
      panel.querySelector('[data-goal-action="cancel-personal"]').addEventListener("click", () => {
        personalEditor.hidden = true;
      });
      panel.querySelector('[data-goal-action="save-personal"]').addEventListener("click", () => {
        const personalGoal = personalEditor.querySelector("input").value.trim();
        if (!personalGoal) return;
        if (isEric) {
          localStorage.setItem(ericPersonalGoalKey, personalGoal);
        } else {
          localStorage.setItem(portfolioGoalChoiceKey, JSON.stringify({
            choice: "own",
            goal: personalGoal,
          }));
        }
        applyGoalToPage(personalGoal, "own");
      });
      panel.querySelectorAll(".demo-active-custom-prompts button").forEach((prompt) => {
        prompt.addEventListener("click", () => {
          personalEditor.querySelector("input").value = prompt.textContent.trim();
          personalEditor.querySelector("input").focus();
        });
      });
    };

    const applyGoalToPage = (goal, choice) => {
      const updateGoalEditor = (attempt = 0) => {
        const textarea = existingGoalCard.querySelector("textarea");
        const setGoalButton = [...existingGoalCard.querySelectorAll("button")].find(
          (button) => button.textContent.trim() === "Set Goal",
        );
        if (!textarea || !setGoalButton) {
          const editGoalButton = [...existingGoalCard.querySelectorAll("button")].find(
            (button) => button.textContent.includes("Edit goal"),
          );
          if (editGoalButton && attempt < 2) {
            editGoalButton.click();
            window.setTimeout(() => updateGoalEditor(attempt + 1), 0);
          }
          return;
        }

        const valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(textarea, goal);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));

        window.setTimeout(() => {
          setGoalButton.click();
          window.setTimeout(() => {
            [...mainContent.querySelectorAll("*")].forEach((element) => {
              if (element.children.length) return;
              const text = element.textContent.trim();
              if (text === "Modern Work Revenue") element.textContent = goal;
              if (text.startsWith("Grow Modern Work revenue by 15% ·")) {
                element.textContent = goal;
              }
            });
            showActiveGoal(goal, choice);
          }, 50);
        }, 0);
      };
      updateGoalEditor();
    };

    panel.querySelector('[data-choice="accept"]')?.addEventListener("click", () => {
      localStorage.setItem(portfolioGoalChoiceKey, JSON.stringify({
        choice: "accepted",
        goals: plan.goals,
      }));
      window.location.href =
        `./current-113.html?persona=sarah&view=customer&goalAccepted=${Date.now()}`;
    });
    panel.querySelector('[data-choice="set-organization"]')?.addEventListener("click", () => {
      window.location.href = "../goals.html";
    });

    panel.querySelector('[data-choice="own"]').addEventListener("click", () => {
      panel.classList.add("editing");
      panel.querySelector(".demo-goal-choice-actions").hidden = true;
      panel.querySelector(".demo-own-goal-editor").hidden = false;
      panel.querySelector(".demo-own-goal-editor textarea").focus();
    });

    panel.querySelector(".demo-reopen-goal").addEventListener("click", () => {
      panel.classList.remove("collapsed");
      existingGoalCard.hidden = true;
    });

    const ownGoalEditor = panel.querySelector(".demo-own-goal-editor");
    const ownGoalInput = ownGoalEditor.querySelector("textarea");
    const ownGoalSubmit = ownGoalEditor.querySelector(".demo-own-goal-input button");
    ownGoalInput.addEventListener("input", () => {
      ownGoalSubmit.disabled = !ownGoalInput.value.trim();
    });
    ownGoalEditor.querySelectorAll(".demo-own-goal-options button").forEach((option) => {
      option.addEventListener("click", () => {
        ownGoalInput.value = option.textContent.trim();
        ownGoalInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    ownGoalSubmit.addEventListener("click", () => {
      const goal = ownGoalInput.value.trim();
      if (!goal) return;
      if (isEric) {
        localStorage.setItem(ericPersonalGoalKey, goal);
      } else {
        localStorage.setItem(portfolioGoalChoiceKey, JSON.stringify({ choice: "own", goal }));
      }
      applyGoalToPage(goal, "own");
    });

    existingGoalCard.before(panel);
    const ericCustomGoal = isEric ? localStorage.getItem(ericPersonalGoalKey) : null;
    if (isEric && (plan?.goals.length || ericCustomGoal)) {
      const personalGoal = localStorage.getItem(ericPersonalGoalKey);
      applyGoalToPage(personalGoal || createGoalSummary(plan.goals), personalGoal ? "own" : "accepted");
    } else if (previousChoice === "own") {
      panel.classList.add("collapsed", "accepted");
      if (previousGoalDecision.goal) applyGoalToPage(previousGoalDecision.goal, "own");
    } else if (previousChoice === "accepted") {
      const acceptedGoals = plan?.goals || previousGoalDecision.goals || [];
      if (acceptedGoals.length) applyGoalToPage(createGoalSummary(acceptedGoals), "accepted");
    }
    return true;
  };

  const addDismissControlsToHomeCards = () => {
    const storageKey = `dismissed-alliance-cards-${selectedPersona || "sarah"}`;
    let dismissedCards = new Set();
    try {
      dismissedCards = new Set(JSON.parse(sessionStorage.getItem(storageKey) || "[]"));
    } catch {
      sessionStorage.removeItem(storageKey);
    }

    [...document.querySelectorAll("h2")].forEach((heading) => {
      const sectionName = heading.textContent.trim();
      if (!["Grow", "Manage"].includes(sectionName)) return;
      const section = heading.parentElement?.parentElement;
      const list = section?.querySelector(".space-y-3");
      if (!list) return;

      const cards = [...list.children];
      const updateCount = () => {
        const count = heading.parentElement?.querySelector("span:last-child");
        if (count && /^\d+$/.test(count.textContent.trim())) {
          const nextCount = String(cards.filter((card) => !card.hidden).length);
          if (count.textContent.trim() !== nextCount) count.textContent = nextCount;
        }
      };

      cards.forEach((card, index) => {
        const title = card.querySelector("p")?.textContent.trim()
          || card.querySelector("strong")?.textContent.trim()
          || `${sectionName}-${index}`;
        const cardKey = `${sectionName}:${title}`;
        card.classList.add("demo-home-dismissible");
        if (dismissedCards.has(cardKey)) card.hidden = true;
        if (card.querySelector(":scope > .demo-card-dismiss")) return;

        const dismiss = document.createElement("button");
        dismiss.className = "demo-card-dismiss";
        dismiss.type = "button";
        dismiss.setAttribute("aria-label", `Dismiss ${title}`);
        dismiss.textContent = "×";
        dismiss.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          dismissedCards.add(cardKey);
          sessionStorage.setItem(storageKey, JSON.stringify([...dismissedCards]));
          card.hidden = true;
          updateCount();
        });
        card.appendChild(dismiss);
      });
      updateCount();
    });
  };

  const downstreamGoalObserver = new MutationObserver(() => {
    addPublishedGoalToSarahHome();
    addJourneyTransactionSignalToSarahHome();
    addSarahCspIncentiveToManage();
    addInheritedGoalDecision();
    addDismissControlsToHomeCards();
  });
  downstreamGoalObserver.observe(document.getElementById("root"), { childList: true, subtree: true });
  addPublishedGoalToSarahHome();
  addJourneyTransactionSignalToSarahHome();
  addSarahCspIncentiveToManage();
  addInheritedGoalDecision();
  addDismissControlsToHomeCards();

  const alignPersonaName = () => {
    const root = document.getElementById("root");
    if (!root) return;
    const personaName = isEric ? "Eric" : isJane ? "Karin" : isPaul ? "Chris" : "Sarah";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode.nodeValue.includes("Ananya")) {
        textNode.nodeValue = textNode.nodeValue.replaceAll("Ananya", personaName);
      }
      if (isPaul && textNode.nodeValue.includes("Sarah")) {
        textNode.nodeValue = textNode.nodeValue.replaceAll("Sarah", "Chris");
      }
      textNode = walker.nextNode();
    }
  };
  const personaNameObserver = new MutationObserver(alignPersonaName);
  personaNameObserver.observe(document.getElementById("root"), { childList: true, subtree: true });
  alignPersonaName();

  const openRequestedView = () => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    const requestedLabels = {
      customer: "Customer",
      benefits: "Benefits and designations",
    };
    const requestedLabel = requestedLabels[requestedView];
    if (!requestedLabel || document.body.dataset.requestedViewOpened === requestedView) return false;
    const requestedButton = [...document.querySelectorAll("aside button")].find(
      (button) => button.querySelector("p")?.textContent.trim() === requestedLabel,
    );
    if (!requestedButton) return false;
    document.body.dataset.requestedViewOpened = requestedView;
    requestedButton.click();
    let activationAttempts = 0;
    const ensureRequestedViewIsActive = () => {
      const active = requestedButton.querySelector("p")
        ?.className.includes("text-[#0f6cbd]");
      if (active || activationAttempts >= 5) return;
      activationAttempts += 1;
      requestedButton.click();
      window.setTimeout(ensureRequestedViewIsActive, 200);
    };
    window.setTimeout(ensureRequestedViewIsActive, 200);
    return true;
  };
  if (!openRequestedView()) {
    const requestedViewObserver = new MutationObserver(() => {
      if (openRequestedView()) requestedViewObserver.disconnect();
    });
    requestedViewObserver.observe(document.getElementById("root"), { childList: true, subtree: true });
  }

  const showCustomerOnlyPivot = () => {
    if (!isJane && !isPaul) return false;
    const customerButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Customers",
    );
    const resellerButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Resellers",
    );
    if (!customerButton || !resellerButton) return false;
    resellerButton.hidden = true;
    if (!customerButton.style.textDecoration.includes("underline")) {
      customerButton.click();
    }
    return true;
  };
  const janeCustomerObserver = new MutationObserver(showCustomerOnlyPivot);
  janeCustomerObserver.observe(document.getElementById("root"), {
    childList: true,
    subtree: true,
  });
  showCustomerOnlyPivot();

  const addJaneDistributorFilter = () => {
    if (!isJane) return false;
    const relationshipSelect = [...document.querySelectorAll("select")].find(
      (select) => [...select.options].some(
        (option) => option.textContent.trim() === "All relationship types",
      ),
    );
    if (!relationshipSelect || document.querySelector("[data-jane-distributor-filter]")) {
      return false;
    }

    const distributorSelect = document.createElement("select");
    distributorSelect.dataset.janeDistributorFilter = "true";
    distributorSelect.setAttribute("aria-label", "Distributor");
    distributorSelect.className = relationshipSelect.className;
    distributorSelect.innerHTML = [
      "All distributors",
      "Fabrikam",
      "Northwind Distribution",
    ].map((distributor) => `<option value="${distributor}">${distributor}</option>`).join("");
    distributorSelect.value = janeDistributorFilter;
    relationshipSelect.before(distributorSelect);

    const filterRow = relationshipSelect.parentElement?.parentElement;
    const updateFilterSummary = () => {
      document.querySelector(".demo-distributor-filter-summary")?.remove();
      if (janeDistributorFilter === "All distributors" || !filterRow) return;
      const summary = document.createElement("div");
      summary.className = "demo-distributor-filter-summary";
      summary.innerHTML = `
        <span><strong>Distributor:</strong> ${janeDistributorFilter}</span>
        <button type="button">Clear filter</button>
      `;
      summary.querySelector("button").addEventListener("click", () => {
        janeDistributorFilter = "All distributors";
        distributorSelect.value = janeDistributorFilter;
        updateFilterSummary();
      });
      filterRow.after(summary);
    };
    distributorSelect.addEventListener("change", () => {
      janeDistributorFilter = distributorSelect.value;
      updateFilterSummary();
    });
    updateFilterSummary();
    return true;
  };
  const janeDistributorObserver = new MutationObserver(addJaneDistributorFilter);
  janeDistributorObserver.observe(document.getElementById("root"), {
    childList: true,
    subtree: true,
  });
  addJaneDistributorFilter();

  const restrictJaneAddMenu = () => {
    if (!isJane) return;
    const restrictedActions = new Set([
      "Add new CSP customer",
      "Add new partner relationship",
      "Add new UPOR relationship",
      "Add new CPOR relationship",
      "Add new MCI relationship",
    ]);
    document.querySelectorAll("button").forEach((button) => {
      if (restrictedActions.has(button.textContent.trim())) {
        button.remove();
      }
    });
  };
  const janeAddMenuObserver = new MutationObserver(restrictJaneAddMenu);
  janeAddMenuObserver.observe(document.getElementById("root"), {
    childList: true,
    subtree: true,
  });
  restrictJaneAddMenu();

  if (isEric || isJane || isPaul) {
    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        const label = button?.querySelector("p")?.textContent.trim();
        if (label !== "Home") return;

        event.preventDefault();
        event.stopPropagation();
        window.location.href = isJane
          ? "../index.html?persona=jane&v=26"
          : isPaul
            ? "../index.html?persona=paul"
            : "../index.html";
      },
      true,
    );
  }

  const openDesignationJourney = () => {
    if (!isPaul || requestedJourney !== "designation") return false;
    if (document.querySelector(".demo-designation-chat")) return true;
    if (!document.getElementById("root")?.children.length) return false;

    const experience = document.createElement("section");
    experience.className = "demo-designation-chat";
    experience.innerHTML = `
      <header class="demo-designation-header">
        <div>
          <span class="demo-designation-agent-icon">✣</span>
          <div><strong>Partner Agent</strong><small>Apex Partners · Benefits and designations</small></div>
        </div>
        <button type="button" aria-label="Close designation recommendations">×</button>
      </header>
      <div class="demo-designation-thread">
        <div class="demo-user-prompt">Why is Apex Partners missing CSP incentives, and what should I do next?</div>
        <div class="demo-assistant-label">✣ Partner Agent</div>
        <article class="demo-designation-summary">
          <span class="demo-designation-eyebrow">CSP INCENTIVE ELIGIBILITY</span>
          <h1>Apex Partners is missing the Data &amp; AI Solutions Partner designation</h1>
          <p>Your current designation score is <strong>68 out of 100</strong>. The qualification threshold is <strong>70 points</strong>, so Apex Partners needs <strong>2 more points</strong> to qualify and unlock the related CSP incentive opportunity.</p>
          <div class="demo-designation-score">
            <div><span>Current score</span><strong>68</strong></div>
            <div class="demo-score-track"><i></i><b>70-point threshold</b></div>
            <div><span>Points needed</span><strong>2</strong></div>
          </div>
        </article>
        <div class="demo-assistant-label">✣ Partner Agent</div>
        <article class="demo-designation-recommendations">
          <div class="demo-designation-intro">
            <div><span class="demo-designation-eyebrow">RECOMMENDED PATHS</span><h2>Two ways to close the designation gap</h2></div>
            <span>Prioritized by time to qualification</span>
          </div>
          <section class="demo-designation-path recommended">
            <div class="demo-path-number">1</div>
            <div>
              <div class="demo-path-heading">
                <div><span>Performance</span><h3>Increase qualifying net customer adds</h3></div>
                <strong>Up to 10 points per customer</strong>
              </div>
              <p>These customers are closest to the qualifying Azure consumed revenue threshold. Helping any one of them cross the threshold would move Apex Partners above 70 points.</p>
              <div class="demo-designation-customers">
                <article><div><strong>Northwind Traders</strong><span>Tenant 8F32-41C8</span></div><dl><div><dt>Current ACR</dt><dd>$468</dd></div><div><dt>Target</dt><dd>$500</dd></div><div><dt>Gap</dt><dd>$32</dd></div></dl><small>Recommended: Azure optimization workshop</small></article>
                <article><div><strong>Alpine Ski House</strong><span>Tenant 7A21-90D4</span></div><dl><div><dt>Current ACR</dt><dd>$482</dd></div><div><dt>Target</dt><dd>$500</dd></div><div><dt>Gap</dt><dd>$18</dd></div></dl><small>Recommended: Expand production workload</small></article>
                <article><div><strong>Fourth Coffee</strong><span>Tenant 1C64-73B9</span></div><dl><div><dt>Current ACR</dt><dd>$441</dd></div><div><dt>Target</dt><dd>$500</dd></div><div><dt>Gap</dt><dd>$59</dd></div></dl><small>Recommended: Migrate analytics workload</small></article>
              </div>
            </div>
          </section>
          <section class="demo-designation-path">
            <div class="demo-path-number">2</div>
            <div>
              <div class="demo-path-heading">
                <div><span>Skilling</span><h3>Add an intermediate certification</h3></div>
                <strong>4 points per certified individual</strong>
              </div>
              <p>Apex Partners currently has <strong>7 certified individuals</strong> and <strong>28 of 40 skilling points</strong>. One additional qualifying certification would add 4 points and take the organization to 72 overall points.</p>
              <div class="demo-certification-plan">
                <div><span>Recommended candidates</span><strong>3 employees with prerequisite training complete</strong></div>
                <div><span>Eligible certifications</span><strong>Azure Data Engineer Associate · Azure AI Engineer Associate · Fabric Analytics Engineer Associate</strong></div>
                <div><span>Projected result</span><strong>72 points · Designation qualified</strong></div>
              </div>
            </div>
          </section>
          <div class="demo-designation-next">
            <span>✣</span>
            <div><strong>Partner Agent recommendation</strong><p>Prioritize Alpine Ski House for the fastest customer-add path, while enrolling one employee in an intermediate certification to create a second route to qualification.</p></div>
          </div>
        </article>
      </div>
    `;
    experience.querySelector("header button").addEventListener("click", () => {
      window.location.href = "../index.html?persona=paul";
    });
    document.body.appendChild(experience);
    return true;
  };

  if (!openDesignationJourney()) {
    const designationObserver = new MutationObserver(() => {
      if (openDesignationJourney()) designationObserver.disconnect();
    });
    designationObserver.observe(document.getElementById("root"), {
      childList: true,
      subtree: true,
    });
  }

  const enhanceCustomerOverview = () => {
    document.querySelectorAll("h2").forEach((heading) => {
      if (heading.textContent.trim() === "Top recommendations for you today across your resellers") {
        heading.textContent = "Top reseller with recommendations for you today";
        if (!isEric && !isJane && !isPaul) {
          const recommendationGrid = heading.parentElement?.parentElement?.nextElementSibling;
          const secondResellerCard = recommendationGrid?.children?.[1];
          if (secondResellerCard) {
            const walker = document.createTreeWalker(secondResellerCard, NodeFilter.SHOW_TEXT);
            let textNode = walker.nextNode();
            while (textNode) {
              textNode.nodeValue = textNode.nodeValue.replaceAll("Fabrikam", "Beta Partners");
              textNode = walker.nextNode();
            }
          }
        }
      }
      if (
        isPaul
        && heading.textContent.trim() === "Top recommendations for you today across your customers"
      ) {
        const recommendationGrid = heading.parentElement?.parentElement?.nextElementSibling;
        const firstCustomerCard = recommendationGrid?.children?.[0];
        if (firstCustomerCard) {
          const replacements = new Map([
            ["EA to CSP migrations", "Copilot Monetization"],
            ["Contoso Customer 588", "Contoso Customer 116"],
            ["Microsoft 365 E5", "Microsoft 365 Copilot"],
            [
              "This EA customer is eligible to move to CSP — migrating now can simplify renewals, increase flexibility, and strengthen your long-term relationship.",
              "High free Copilot Chat usage and strong Microsoft 365 engagement make this customer a priority for conversion to paid Copilot seats.",
            ],
          ]);
          const walker = document.createTreeWalker(firstCustomerCard, NodeFilter.SHOW_TEXT);
          let textNode = walker.nextNode();
          while (textNode) {
            const replacement = replacements.get(textNode.nodeValue.trim());
            if (replacement) textNode.nodeValue = replacement;
            textNode = walker.nextNode();
          }
          [...firstCustomerCard.querySelectorAll("*")].forEach((element) => {
            if (element.children.length) return;
            const text = element.textContent.trim();
            if (text === "€3,178,094.75") {
              element.textContent = "€171,553.80";
            }
          });
          const icon = firstCustomerCard.querySelector(".flex.items-center.gap-2.mb-4")
            ?.firstElementChild;
          if (icon?.textContent !== "🤖") icon.textContent = "🤖";
        }
      }
      if (
        !isEric
        && !isJane
        && !isPaul
        && heading.textContent.trim() === "Top recommendations for you today across your customers"
      ) {
        const recommendationGrid = heading.parentElement?.parentElement?.nextElementSibling;
        const secondCustomerCard = recommendationGrid?.children?.[1];
        const customerName = [...(secondCustomerCard?.querySelectorAll("*") || [])].find(
          (element) => element.children.length === 0
            && element.textContent.trim() === "Contoso Customer 592",
        );
        if (customerName) customerName.textContent = "Delta Solutions";
      }
    });
  };

  const customerOverviewObserver = new MutationObserver(enhanceCustomerOverview);
  customerOverviewObserver.observe(document.getElementById("root"), { childList: true, subtree: true });
  enhanceCustomerOverview();

  const openJourneyRecommendation = (
    initialView = "",
    recipientContext = false,
    recipientConversation = null,
  ) => {
    if (document.querySelector(".demo-journey-recommendation")) return;
    const receivedJourneyProposal = recipientContext ? getJourneyProposal() : null;
    const plan = getPublishedPlan();
    let goalDecision = null;
    try {
      goalDecision = JSON.parse(localStorage.getItem(portfolioGoalChoiceKey) || "null");
    } catch {
      goalDecision = null;
    }
    const appliedGoals = isEric
      ? [...(plan?.goals || []), localStorage.getItem(ericPersonalGoalKey)].filter(Boolean)
      : goalDecision?.choice === "accepted"
        ? plan?.goals || goalDecision.goals || []
        : goalDecision?.choice === "own"
          ? [goalDecision.goal]
          : [];
    const copilotGoal = appliedGoals.some((goal) => /copilot/i.test(goal));
    const additionalOpportunityRows = copilotGoal
      ? `
          <article><button type="button"><span>›</span><strong>Copilot Chat Activation</strong></button><p>4 of 163 customers</p></article>
          <article><button type="button"><span>›</span><strong>Copilot Acquisition</strong><b>$2,400,000</b></button><p>33% of Copilot revenue potential · 11 of 163 customers</p></article>
        `
      : `
          <article><button type="button"><span>›</span><strong>Upgrade M365 E3 to E5</strong><b>$2,953,200</b></button><p>23% of Maximum revenue potential · 9 of 163 customers</p></article>
          <article><button type="button"><span>›</span><strong>Migrate EA to CSP</strong><b>$2,182,800</b></button><p>17% of Maximum revenue potential · 7 of 163 customers</p></article>
          <article><button type="button"><span>›</span><strong>Seat expansion</strong><b>$1,669,200</b></button><p>13% of Maximum revenue potential · 5 of 163 customers</p></article>
          <article><button type="button"><span>›</span><strong>Copilot Chat Activation</strong></button><p>4 of 163 customers</p></article>
          <article><button type="button"><span>›</span><strong>Activate portfolio promotions</strong><b>$1,155,600</b></button><p>9% of Maximum revenue potential · 3 of 163 customers</p></article>
        `;
    const copilotCustomers = [
      ["Contoso Customer 116", "935", "EUR 171,553.80", "Outlook-heavy", "Eligible promotion"],
      ["Contoso Customer 119", "897", "EUR 164,581.56", "Teams-heavy", "Eligible promotion"],
      ["Contoso Customer 121", "817", "EUR 149,903.16", "Outlook-heavy", "High free Copilot MAU"],
      ["Contoso Customer 122", "783", "EUR 143,664.84", "Teams-heavy", "Eligible promotion"],
      ["Contoso Customer 117", "768", "EUR 140,912.64", "Outlook-heavy", "High utilization"],
      ["Contoso Customer 123", "766", "EUR 140,545.68", "Teams-heavy", "High free Copilot MAU"],
      ["Contoso Customer 120", "720", "EUR 132,105.60", "Outlook-heavy", "Eligible promotion"],
      ["Contoso Customer 118", "626", "EUR 114,858.48", "Teams-heavy", "High utilization"],
      ["Contoso Customer 124", "481", "EUR 88,253.88", "Outlook-heavy", "High free Copilot MAU"],
      ["Contoso Customer 126", "296", "EUR 54,310.08", "Teams-heavy", "Eligible promotion"],
    ];
    const receivedCustomer = receivedJourneyProposal?.customer;
    const receivedCustomerDefaults = copilotCustomers.find(
      ([customer]) => customer === receivedCustomer,
    ) || [receivedCustomer, "1", "$0.00", "Copilot-ready", "Proposal received from Fabrikam"];
    const recommendationCustomers = isPaul
      ? copilotCustomers.slice(0, 1)
      : recipientContext && receivedCustomer
        ? [[
            receivedCustomer,
            receivedJourneyProposal.seatCount || receivedJourneyProposal.seats || receivedCustomerDefaults[1],
            receivedJourneyProposal.opportunitySize
              || String(receivedJourneyProposal.opportunity || "").replace(/^Monetize Copilot · /, "")
              || receivedCustomerDefaults[2],
            receivedCustomerDefaults[3],
            "Proposal received from Fabrikam",
          ]]
        : copilotCustomers;
    const detail = document.createElement("section");
    detail.className = "demo-journey-recommendation";
    detail.innerHTML = `
      <header class="demo-journey-chat-header">
        <div><span>✣</span><div><strong>Partner Agent</strong><small>${isPaul ? "Apex Partners · Customer growth" : "Journey Innovations · Growth potential"}</small></div></div>
        <button class="demo-journey-close" type="button" aria-label="Close recommendation details">×</button>
      </header>
      <div class="demo-journey-thread">
      <div class="demo-user-prompt">Show me ${isPaul ? "the top customer recommendations for Apex Partners" : "the recommendation details for Journey Innovations"}${copilotGoal ? " aligned to my Copilot goal" : ""}.</div>
      <div class="demo-assistant-label">✣ Partner Agent</div>
      <div class="demo-journey-card">
        <button class="demo-journey-back" type="button">← Back to recommendations</button>
        <h1>Journey Innovations</h1>
        <p class="demo-journey-subtitle">Growth potential</p>
        <h2>Reseller details</h2>
        <div class="demo-reseller-facts">
          <span>Type: <strong>Direct Reseller</strong></span>
          <span>MPN: <strong>0000008</strong></span>
          <span>Annual recurring revenue: <strong>$2.7M</strong></span>
          <span>Total customers: <strong>163</strong></span>
          <span>Partner Capability Score: <strong>72/100</strong></span>
        </div>
        <div class="demo-potential-heading">
          <h2>${copilotGoal ? "Copilot revenue potential" : "Maximum revenue potential"}</h2>
          <strong>${copilotGoal ? "$7,279,200" : "$12,840,000"}</strong>
        </div>
        <p class="demo-opportunity-caption">${copilotGoal ? "Copilot opportunities aligned to your selected goal" : "Opportunities that make up this total"}</p>
        <div class="demo-opportunity-list">
          <article class="expanded">
            <button type="button" aria-expanded="true"><span>⌄</span><strong>Monetize Copilot</strong><b>$3,466,800</b></button>
            <p>27% of Maximum revenue potential · 14 of 163 customers</p>
            <div class="demo-opportunity-detail">
              <p>Free Copilot chat MAU up 34% QoQ — paid attach at 12% vs 28% peer benchmark</p>
              <p>87 Copilot licenses purchased with only 23% monthly active usage</p>
              <div>
                <button type="button">${isJane ? "Create reseller customer proposal" : "Prepare reseller quote"}</button>
                <button class="demo-see-customers" type="button">See customer details</button>
                <button type="button">Decline</button>
              </div>
            </div>
          </article>
          ${additionalOpportunityRows}
        </div>
        <button class="demo-download-recommendations" type="button">Download all recommendations</button>
      </div>
      <div class="demo-copilot-customer-view" hidden>
        <div class="demo-user-prompt">Show me the customers behind the Monetize Copilot recommendation.</div>
        <div class="demo-ai-label">✣ <strong>Partner Agent</strong> <span>AI-generated content may be incorrect</span></div>
        <div class="demo-copilot-summary">
          <h1>Copilot Monetization Recommendation Details</h1>
          <p>I found <strong>${recommendationCustomers.length} Copilot Monetization recommendation${recommendationCustomers.length === 1 ? "" : "s"}</strong> for ${isPaul ? "Apex Partners" : "Journey Innovations"}.</p>
          <h2>Key insights</h2>
          <ul>
            <li>The recommendations are concentrated in Contoso customer accounts managed by ${isPaul ? "Apex Partners" : "Journey Innovations"}.</li>
            <li>All opportunities are for <strong>Microsoft 365 Copilot</strong> with P1Y terms and monthly billing.</li>
            <li>Several recommendations include an <strong>eligible promotion</strong>.</li>
            <li>Customers using free Copilot chat features show strong conversion potential to paid licenses.</li>
            <li>The largest opportunity is <strong>Contoso Customer 116 at EUR 171,553.80</strong>.</li>
          </ul>
          <h2>Recommended actions</h2>
          <ul>
            <li>${isPaul
              ? "Prioritize <strong>Contoso Customer 116</strong> and convert its active free Copilot users to paid seats."
              : "Prioritize the highest-value accounts, starting with <strong>Contoso Customer 116, 119, and 121</strong>."}</li>
            <li>Focus outreach on customers with high free Copilot MAU and strong utilization.</li>
            <li>Use promotion-eligible offers and tailor the conversation by workload.</li>
          </ul>
          <h2>Recommendations for ${isPaul ? "Apex Partners" : "Journey Innovations"} customers</h2>
          <div class="demo-customer-recommendations">
            ${recommendationCustomers.map(([customer, quantity, value, workload, signal]) => {
              const sentProposal = isJane && recipientContext
                ? null
                : isJane || isPaul
                  ? getCustomerProposal(customer)
                  : null;
              return `
              <article class="demo-customer-recommendation">
                <div class="demo-customer-recommendation-head">
                  <div><span>${isPaul ? "APEX PARTNERS CUSTOMER" : "JOURNEY INNOVATIONS CUSTOMER"}</span><h3>${customer}</h3></div>
                  <strong>${value}</strong>
                </div>
                <div class="demo-customer-recommendation-facts">
                  <span>SKU <strong>Microsoft 365 Copilot</strong></span>
                  <span>Recommended quantity <strong>${quantity}</strong></span>
                  <span>Billing <strong>Monthly · P1Y</strong></span>
                  <span>${recipientContext && receivedCustomer ? "Distributor offer" : "List price"} <strong>${recipientContext && receivedCustomer ? receivedJourneyProposal.unitPrice : "21.84"}</strong></span>
                </div>
                <div class="demo-customer-signals"><span>${workload}</span><span>${signal}</span></div>
                <p>Prioritize this account based on Copilot readiness, current engagement, and revenue potential.</p>
                <div class="demo-customer-actions">
                  <button type="button">Review deal details</button>
                  <button type="button" data-action="prepare-offer">${isJane ? "Prepare customer proposal" : "Prepare reseller quote"}</button>
                  ${sentProposal ? `<button type="button" data-action="sent-proposal">${isJane ? "See sent proposal" : "See sent quote"}</button>` : ""}
                </div>
              </article>
            `;
            }).join("")}
          </div>
        </div>
      </div>
      </div>
    `;
    const closeJourneyDetail = () => detail.remove();
    const journeyCard = detail.querySelector(".demo-journey-card");
    const customerView = detail.querySelector(".demo-copilot-customer-view");
    if (recipientContext) {
      detail.querySelector(".demo-journey-chat-header small").textContent =
        "Journey Innovations · Proposal received";
      detail.querySelector(".demo-journey-thread > .demo-user-prompt")?.remove();
      detail.querySelector(".demo-journey-thread > .demo-assistant-label")?.remove();
      journeyCard.remove();
      if (recipientConversation) {
        const history = document.createElement("div");
        history.className = "demo-jane-received-history";
        history.append(...recipientConversation.childNodes);
        detail.querySelector(".demo-journey-thread").prepend(history);
      }
    }
    detail.querySelector(".demo-journey-back")?.addEventListener("click", closeJourneyDetail);
    detail.querySelector(".demo-journey-close").addEventListener("click", closeJourneyDetail);
    detail.querySelector(".demo-see-customers")?.addEventListener("click", () => {
      customerView.hidden = false;
      detail.querySelector(".demo-see-customers").disabled = true;
      detail.querySelector(".demo-see-customers").textContent = "Customer details shown below";
      customerView.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const openGcpsProposalWorkspace = ({
      recipientView = false,
      customer = "",
      opportunitySize = "",
      seatCount = "",
      unitPrice = "",
      product = "Microsoft 365 Copilot",
      sentProposalView = false,
    } = {}) => {
      const isCustomerProposal = Boolean(customer);
      const proposalCustomer = customer || "Journey Innovations";
      const proposalOpportunity = opportunitySize || "$3,466,800";
      const proposalSeats = seatCount || "To be completed by reseller";
      const proposalUnitPrice = unitPrice || "$27.73";
      const numericSeats = Number(String(seatCount).replaceAll(",", "")) || 35;
      const numericPrice = Number.parseFloat(String(unitPrice).replace(/[^0-9.]/g, "")) || 27.73;
      const pricePrefix = /EUR|€/i.test(unitPrice) ? "EUR " : "$";
      const outboundArtifact = isJane ? "customer proposal" : "reseller quote";
      const outboundArtifactTitle = isJane ? "Customer proposal" : "Reseller quote";
      detail.querySelector(".demo-proposal-workspace")?.remove();
      detail.classList.add("proposal-open");
      const existingConversation = detail.querySelector(".demo-journey-thread")?.cloneNode(true);
      existingConversation?.querySelector(".demo-copilot-customer-view")?.remove();
      existingConversation?.querySelector(".demo-download-recommendations")?.remove();
      existingConversation?.querySelector(".demo-journey-back")?.remove();
      existingConversation?.querySelectorAll("button").forEach((button) => {
        button.disabled = !button.dataset.janeProposalAction;
      });
      const workspace = document.createElement("section");
      workspace.className = "demo-proposal-workspace demo-gcps-proposal";
      workspace.innerHTML = `
        <nav class="demo-gcps-mini-rail" aria-label="Partner Center navigation">
          <button type="button" aria-label="Menu">☰</button>
          <button type="button" aria-label="Home">⌂</button>
          <button class="active" type="button" aria-label="Partner Agent">♧</button>
          <button type="button" aria-label="Documents">▱</button>
          <button type="button" aria-label="Add">＋</button>
        </nav>
        <header>
          <div><span>✧</span><strong>Partner Agent</strong></div>
          <div class="demo-gcps-window-actions"><button type="button" aria-label="Refresh ${outboundArtifact}">↻</button><button type="button" aria-label="Expand ${outboundArtifact}">↗</button><button type="button" aria-label="Close ${outboundArtifact}">×</button></div>
        </header>
        <div class="demo-gcps-proposal-body">
          <aside class="demo-gcps-config">
            <div class="demo-gcps-chat-thread">
              <div class="demo-gcps-prior-conversation"></div>
              <div class="demo-gcps-user-message">
                <span>${sentProposalView
                  ? `See sent ${outboundArtifact} for ${proposalCustomer}`
                  : recipientView
                  ? "View quote"
                  : isCustomerProposal
                    ? `Prepare a Monetize Copilot ${outboundArtifact} for ${proposalCustomer}`
                    : `Prepare Monetize Copilot ${outboundArtifact}`}</span><strong>${isJane ? "J" : isPaul ? "P" : "SC"}</strong>
              </div>
              <div class="demo-gcps-assistant-response">
                <span class="demo-gcps-sparkle">✧</span>
                <div class="demo-gcps-config-card">
                  <h3>${sentProposalView
                    ? `Sent ${outboundArtifact} for ${proposalCustomer}`
                    : recipientView
                    ? isCustomerProposal
                    ? `Distributor quote from Fabrikam for ${proposalCustomer}`
                    : "Quote from Fabrikam"
                    : isCustomerProposal
                    ? `Draft ${outboundArtifact} for ${proposalCustomer}`
                    : `Draft ${outboundArtifact} for Journey Innovations`}</h3>
                  <p>${isCustomerProposal
                    ? recipientView
                    ? `Fabrikam prepared a customer-specific quote for ${proposalCustomer} covering ${proposalSeats} ${product} seats at ${proposalUnitPrice} per seat. The full opportunity value is ${proposalOpportunity}. You can use these terms to prepare the customer proposal.`
                    : `I prepared a customer-specific ${outboundArtifact} for ${proposalCustomer} covering ${proposalSeats} ${product} seats at ${proposalUnitPrice} per seat. The full opportunity value is ${proposalOpportunity}.`
                    : `This is a skeleton ${outboundArtifact} to customize. Unit prices start from Microsoft default price lists; seat counts are omitted on purpose.`}</p>
                  <ol>
                    <li>Seats and pricing <span>(Page 1)</span></li>
                    <li>MCI activities <span>(Page 3)</span></li>
                    <li>Partner pricing tab <span>(Page 1)</span></li>
                  </ol>
                  <div class="demo-gcps-details">
                    <h4>Details</h4>
                    <dl>
                      <div><dt>Opportunity</dt><dd>Monetize Copilot opportunity worth ${proposalOpportunity}</dd></div>
                      <div><dt>${isCustomerProposal ? "Customer" : "Handoff"}</dt><dd>${isCustomerProposal ? proposalCustomer : "For Journey Innovations to pass to their customers"}</dd></div>
                      <div><dt>Package</dt><dd>${isCustomerProposal ? recipientView ? "Customer-specific distributor quote" : outboundArtifactTitle : `${outboundArtifactTitle} skeleton`}</dd></div>
                      <div><dt>${isCustomerProposal ? "Seat count" : "Customer coverage"}</dt><dd>${isCustomerProposal ? proposalSeats : "14 eligible customers (details attached)"}</dd></div>
                      <div><dt>Product alignment</dt><dd>${isCustomerProposal ? product : "Microsoft 365 Business Premium with Copilot"}</dd></div>
                      <div><dt>${isCustomerProposal ? "Unit pricing" : `${outboundArtifactTitle} defaults`}</dt><dd id="gcpsProposalDefaults">${isCustomerProposal ? `${proposalUnitPrice}/seat · ${proposalOpportunity} total opportunity` : "$27.73/seat (MS list) · Seats to be completed by reseller"}</dd></div>
                    </dl>
                    <p class="demo-gcps-notice">Figures use Microsoft's default price lists. ${isPaul ? "Review pricing, eligibility, incentives, taxes, and terms before sending to the customer." : "The reseller should update pricing, eligibility, incentives, taxes, and terms before sending to their customers."}</p>
                  </div>
                  <div id="gcpsProposalEditor" class="demo-gcps-editor" hidden></div>
                </div>
              </div>
              <div class="demo-gcps-actions">
                <button type="button" data-gcps-action="customers">See customer details</button>
              </div>
              <div id="gcpsProposalStatus" class="demo-gcps-status" hidden></div>
            </div>
            <div class="demo-gcps-composer"><span>Ask AI to refine any section...</span><div><b>＋</b><span>♩　▮▮</span></div></div>
          </aside>
          <div class="demo-gcps-divider-handle" aria-hidden="true">↔</div>
          <main class="demo-gcps-document">
            <div class="demo-gcps-document-head">
              <div><span class="demo-gcps-file-icon">▱</span><strong>Monetize Copilot for ${proposalCustomer}</strong><a>(all documents)</a></div>
              <button class="demo-gcps-document-close" type="button" aria-label="Close document">×</button>
            </div>
            <nav class="demo-gcps-tabs" aria-label="${outboundArtifactTitle} documents">
              <button type="button" data-document="customer" aria-selected="true">${outboundArtifactTitle}</button>
              <button type="button" data-document="partner" aria-selected="false">Partner pricing</button>
              <button type="button" data-document="materials" aria-selected="false">Supporting materials</button>
            </nav>
            <div id="gcpsDocumentCanvas" class="demo-gcps-canvas"></div>
            <footer class="demo-gcps-pagination">
              <div class="demo-gcps-page-controls"><button type="button" data-page="previous" aria-label="Previous page">‹</button><span>1 of 5 pages</span><button type="button" data-page="next" aria-label="Next page">›</button></div>
              <div class="demo-gcps-footer-actions">
                <button class="demo-gcps-download" type="button" data-gcps-action="download">Download documents</button>
                ${isJane || isPaul
                  ? '<button class="demo-gcps-send" type="button" data-gcps-action="send-customer">Send to customer</button>'
                  : '<button class="demo-gcps-send" type="button" data-gcps-action="send-reseller">Send to reseller</button>'}
              </div>
            </footer>
          </main>
        </div>
      `;
      const priorConversation = workspace.querySelector(".demo-gcps-prior-conversation");
      if (existingConversation) {
        existingConversation.querySelectorAll(".demo-jane-received-history").forEach((history) => {
          history.replaceWith(...history.childNodes);
        });
        priorConversation.append(...existingConversation.childNodes);
      } else if (recipientView) {
        priorConversation.innerHTML = `
          <div class="demo-user-prompt">Show me the quote Fabrikam sent to Journey Innovations.</div>
          <div class="demo-assistant-label">✣ Partner Agent</div>
          <div class="demo-jane-received-summary">
            <h2>Quote received from Fabrikam</h2>
            <p><strong>Sarah from Fabrikam</strong> sent ${isCustomerProposal
              ? `a customer-specific quote for <strong>${proposalCustomer}</strong> with <strong>${proposalSeats} seats</strong> at <strong>${proposalUnitPrice} per seat</strong>.`
              : "a quote based on a recommendation to convert free Copilot seats to paid licenses for <strong>14 customers</strong>."}</p>
            <p>${isCustomerProposal
              ? "Review the distributor offer and decide how much reseller incentive benefit to pass to the customer."
              : "This is a reseller skeleton for Journey Innovations to review and customize before sharing it with customers."}</p>
          </div>
        `;
      }

      const customerPages = [1, 2, 3, 4, 5].map((pageNumber) => `
        <img
          class="demo-gcps-slide-page"
          src="./assets/proposal-reference/slide-${String(pageNumber).padStart(2, "0")}.png"
          alt="Monetize Copilot proposal page ${pageNumber}"
        />
      `);
      const partnerPage = `
        <p>PARTNER PRICING</p><h1>Partner economics</h1>
        <div class="demo-proposal-lead">This tab is partner-only and should not be included in the customer proposal.</div>
        <table><thead><tr><th>Commercial input</th><th>Illustrative value</th><th>Guidance</th></tr></thead><tbody>
          <tr><td>Seats</td><td id="gcpsPartnerSeats">${numericSeats.toLocaleString()}</td><td>Adjust to the validated customer scope</td></tr>
          <tr><td>Customer price</td><td id="gcpsPartnerPrice">${proposalUnitPrice}/user/month</td><td>Confirm current catalog and distributor pricing</td></tr>
          <tr><td>Target growth margin</td><td>20%</td><td>Partner-only planning assumption</td></tr>
          <tr><td>Strategic accelerator</td><td>$132.00</td><td>Validate eligibility</td></tr>
          <tr><td>Growth accelerator</td><td>$296.25</td><td>Validate eligibility</td></tr>
        </tbody></table>
        <div class="demo-proposal-notice">Do not share partner margin or incentive details with the customer.</div>
      `;
      const materialsPage = `
        <p>SUPPORTING MATERIALS</p><h1>Bill of materials</h1>
        <div class="demo-proposal-lead">25 resources and supplemental downloads are available for this proposal. They are not added to customer proposal pages.</div>
        <div class="demo-gcps-materials">
          <section><strong>Customer-ready proposal pack</strong><span>Customer Proposal E-mail</span><span>Microsoft 365 Business Premium with Copilot</span><span>Business Case Builder</span><span>Copilot and Chat envisioning tool</span><span>GTM Kit and customer pitch deck</span></section>
          <section><strong>Technical readiness</strong><span>Copilot technical overview presentation</span><span>Copilot technical readiness guide</span><span>Agent governance</span><span>Copilot Success Kit for SMB</span><span>Microsoft 365 Adoption guide</span></section>
          <section><strong>Campaign execution</strong><span>Copilot Prompt Packs</span><span>Interactive scenario library</span><span>Measuring impact with Copilot Analytics</span><span>Partner Marketing Center</span><span>CSP Renewals</span></section>
        </div>
      `;

      let activeDocument = "customer";
      let currentPage = 0;
      let seats = numericSeats;
      let price = numericPrice;
      let selectedMciActivities = [];
      const canvas = workspace.querySelector("#gcpsDocumentCanvas");
      const pagination = workspace.querySelector(".demo-gcps-pagination");
      const pageLabel = pagination.querySelector(".demo-gcps-page-controls span");
      const previousPage = pagination.querySelector('[data-page="previous"]');
      const nextPage = pagination.querySelector('[data-page="next"]');
      const editor = workspace.querySelector("#gcpsProposalEditor");
      const status = workspace.querySelector("#gcpsProposalStatus");

      const renderDocument = () => {
        canvas.innerHTML = activeDocument === "customer"
          ? `<article>${customerPages[currentPage]}</article>`
          : `<article>${activeDocument === "partner" ? partnerPage : materialsPage}</article>`;
        canvas.querySelector("#gcpsDocSeats")?.replaceChildren(String(seats));
        canvas.querySelector("#gcpsDocPrice")?.replaceChildren(`${pricePrefix}${price.toFixed(2)}`);
        canvas.querySelector("#gcpsDocAnnual")?.replaceChildren(
          `${pricePrefix}${(seats * price * 12).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        );
        canvas.querySelector("#gcpsPartnerSeats")?.replaceChildren(String(seats));
        canvas.querySelector("#gcpsPartnerPrice")?.replaceChildren(
          `${pricePrefix}${price.toFixed(2)}/user/month`,
        );
        const mciPage = canvas.querySelector("#gcpsMciPage");
        if (mciPage && selectedMciActivities.length) {
          mciPage.innerHTML = `<strong>Selected MCI activities</strong><ul>${selectedMciActivities.map((activity) => `<li>${activity}</li>`).join("")}</ul>`;
        }
        pagination.hidden = activeDocument !== "customer";
        if (activeDocument === "customer") {
          pageLabel.textContent = `${currentPage + 1} of ${customerPages.length} pages`;
          previousPage.disabled = currentPage === 0;
          nextPage.disabled = currentPage === customerPages.length - 1;
        }
      };
      const setDocument = (documentName) => {
        workspace.classList.remove("document-closed");
        activeDocument = documentName;
        currentPage = 0;
        workspace.querySelectorAll("[data-document]").forEach((button) => {
          button.setAttribute("aria-selected", String(button.dataset.document === documentName));
        });
        renderDocument();
      };
      const showStatus = (message) => {
        status.textContent = message;
        status.hidden = false;
      };
      const showJanePostSendActions = (message) => {
        status.innerHTML = `
          <span>${message}</span>
          <button type="button" data-gcps-action="signal-distributor">
            Signal distributor for transact
          </button>
        `;
        status.hidden = false;
        status.querySelector('[data-gcps-action="signal-distributor"]').addEventListener("click", () => {
          const subscriptionEndDate = new Date();
          subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          const signalCustomer = isCustomerProposal
            ? proposalCustomer
            : copilotCustomers[0][0];
          localStorage.setItem(journeyTransactionSignalKey, JSON.stringify({
            sender: "Journey Innovations",
            senderUser: "Karin",
            recipient: "Fabrikam",
            recipientUser: "Sarah",
            distributor: "Fabrikam",
            customer: signalCustomer,
            product,
            seats: seats.toLocaleString(),
            unitPrice: `${pricePrefix}${price.toFixed(2)}`,
            opportunitySize: proposalOpportunity,
            billingFrequency: "Monthly",
            termDuration: "P1Y annual term",
            subscriptionEndDate: subscriptionEndDate.toISOString().slice(0, 10),
            status: "Ready for transact",
            signaledAt: new Date().toISOString(),
          }));
          status.innerHTML = `
            <strong>Signal sent to Fabrikam.</strong>
            <span>Sarah can now review the customer details and complete the transaction.</span>
          `;
        });
      };

      workspace.querySelectorAll("[data-document]").forEach((button) => {
        button.addEventListener("click", () => setDocument(button.dataset.document));
      });
      workspace.querySelectorAll('[data-jane-proposal-action="skeleton"]').forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          setDocument("customer");
          workspace.querySelector(".demo-gcps-document").scrollIntoView({ behavior: "smooth" });
        });
      });
      workspace.querySelectorAll('[data-jane-proposal-action="customers"]').forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          workspace.querySelector('[data-gcps-action="customers"]').click();
        });
      });
      previousPage.addEventListener("click", () => {
        currentPage = Math.max(0, currentPage - 1);
        renderDocument();
      });
      nextPage.addEventListener("click", () => {
        currentPage = Math.min(customerPages.length - 1, currentPage + 1);
        renderDocument();
      });
      workspace.querySelector('[data-gcps-action="edit"]')?.addEventListener("click", () => {
        workspace.classList.remove("document-closed");
        editor.hidden = false;
        editor.innerHTML = `
          <h4>Edit proposal</h4>
          <label>Recommended seats<input type="number" min="1" value="${seats}" data-field="seats" /></label>
          <label>Price per user/month<input type="number" min="0" step="0.01" value="${price.toFixed(2)}" data-field="price" /></label>
          <div><button type="button" data-editor-action="save">Apply</button><button type="button" data-editor-action="cancel">Cancel</button></div>
        `;
        editor.querySelector('[data-editor-action="save"]').addEventListener("click", () => {
          seats = Math.max(1, Number(editor.querySelector('[data-field="seats"]').value) || 35);
          price = Math.max(0, Number(editor.querySelector('[data-field="price"]').value) || 27.73);
          workspace.querySelector("#gcpsProposalDefaults").textContent =
            `${seats.toLocaleString()} seats at ${pricePrefix}${price.toFixed(2)}/seat`;
          editor.hidden = true;
          renderDocument();
          showStatus("Seats and pricing updated in the proposal draft.");
        });
        editor.querySelector('[data-editor-action="cancel"]').addEventListener("click", () => {
          editor.hidden = true;
        });
      });
      workspace.querySelector('[data-gcps-action="customers"]').addEventListener("click", (event) => {
        const chatThread = workspace.querySelector(".demo-gcps-chat-thread");
        let inlineCustomerView = workspace.querySelector(".demo-gcps-inline-customers");
        if (!inlineCustomerView) {
          inlineCustomerView = customerView.cloneNode(true);
          inlineCustomerView.hidden = false;
          inlineCustomerView.classList.add("demo-gcps-inline-customers");
          chatThread.appendChild(inlineCustomerView);
        }
        event.currentTarget.disabled = true;
        event.currentTarget.textContent = "Customer details shown below";
        inlineCustomerView.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      workspace.querySelector('[data-gcps-action="download"]').addEventListener("click", () => {
        showStatus("Customer proposal, partner pricing, and supporting materials are ready to download.");
      });
      workspace.querySelector('[data-gcps-action="send-reseller"]')?.addEventListener("click", (event) => {
        const sentAt = new Date().toISOString();
        const sentProposal = {
          sender: "Fabrikam",
          senderUser: "Sarah",
          recipient: "Journey Innovations",
          recipientUser: "Karin",
          opportunity: `Monetize Copilot · ${proposalOpportunity}`,
          opportunitySize: proposalOpportunity,
          customer: isCustomerProposal ? proposalCustomer : undefined,
          seatCount: isCustomerProposal ? seats.toLocaleString() : undefined,
          unitPrice: isCustomerProposal ? `${pricePrefix}${price.toFixed(2)}` : undefined,
          product,
          createdAt: sentAt,
          sentAt,
          status: "Sent",
        };
        localStorage.setItem(journeyProposalKey, JSON.stringify(sentProposal));
        event.currentTarget.textContent = "Sent to reseller";
        event.currentTarget.disabled = true;
        const chatThread = workspace.querySelector(".demo-gcps-chat-thread");
        chatThread.appendChild(status);
        showStatus("Proposal sent to Karin at Journey Innovations.");
        window.requestAnimationFrame(() => {
          chatThread.scrollTop = chatThread.scrollHeight;
        });
      });
      workspace.querySelector('[data-gcps-action="send-customer"]')?.addEventListener("click", (event) => {
        event.currentTarget.textContent = "Sent to customer";
        event.currentTarget.disabled = true;
        if ((isJane || isPaul) && isCustomerProposal) {
          saveCustomerProposal(proposalCustomer, {
            customer: proposalCustomer,
            opportunitySize: proposalOpportunity,
            seatCount: seats.toLocaleString(),
            unitPrice: `${pricePrefix}${price.toFixed(2)}`,
            product,
            status: "Sent to customer",
            sentAt: new Date().toISOString(),
          });
          detail.querySelectorAll(".demo-customer-recommendation").forEach((card) => {
            if (card.querySelector("h3")?.textContent.trim() !== proposalCustomer) return;
            const customerActions = card.querySelector(".demo-customer-actions");
            if (customerActions && !customerActions.querySelector('[data-action="sent-proposal"]')) {
              const sentButton = document.createElement("button");
              sentButton.type = "button";
              sentButton.dataset.action = "sent-proposal";
              sentButton.textContent = isPaul ? "See sent quote" : "See sent proposal";
              customerActions.prepend(sentButton);
            }
            const dealActions = card.querySelector(".demo-deal-actions");
            if (dealActions && !dealActions.querySelector('[data-action="sent-proposal"]')) {
              const sentButton = document.createElement("button");
              sentButton.type = "button";
              sentButton.dataset.action = "sent-proposal";
              sentButton.textContent = isPaul ? "See sent quote" : "See sent proposal";
              dealActions.prepend(sentButton);
              const proposalButton = dealActions.querySelector('[data-action="proposal"]');
              if (proposalButton) {
                proposalButton.hidden = false;
                proposalButton.textContent = isPaul ? "Send revised reseller quote" : "Send new proposal";
              }
            }
          });
        }
        if (isPaul) {
        showStatus(`Proposal sent to ${proposalCustomer}.`);
        } else {
        showJanePostSendActions(
          isCustomerProposal
            ? `Proposal sent to ${proposalCustomer}.`
            : "Customer-ready proposal sent.",
        );
        }
        window.requestAnimationFrame(() => {
          const chatThread = workspace.querySelector(".demo-gcps-chat-thread");
          chatThread.scrollTo({ top: chatThread.scrollHeight, behavior: "smooth" });
        });
      });
      const closeProposal = () => {
        detail.remove();
      };
      workspace.querySelector(`[aria-label="Close ${outboundArtifact}"]`).addEventListener("click", closeProposal);
      workspace.querySelector(".demo-gcps-document-close").addEventListener("click", () => {
        workspace.classList.add("document-closed");
        showStatus("Proposal artifacts closed. Continue refining the proposal in this chat.");
      });
      renderDocument();
      detail.appendChild(workspace);
      if (sentProposalView) {
        const sendButton = workspace.querySelector('[data-gcps-action="send-customer"]');
        sendButton.textContent = "Sent to customer";
        sendButton.disabled = true;
        if (isJane) {
          showJanePostSendActions(`This proposal was sent to ${proposalCustomer}.`);
        } else {
          showStatus(`This proposal was sent to ${proposalCustomer}.`);
        }
      }
      window.requestAnimationFrame(() => {
        const chatThread = workspace.querySelector(".demo-gcps-chat-thread");
        if (recipientView) {
          chatThread.scrollTop = chatThread.scrollHeight;
        } else {
          workspace.querySelector(".demo-gcps-user-message")
            .scrollIntoView({ block: "center" });
        }
      });
    };
    openCurrentProposalWorkspace = openGcpsProposalWorkspace;

    const openProposalWorkspace = (customer, opportunity, seats, price, growthMargin = 20) => {
      openGcpsProposalWorkspace({
        customer,
        opportunitySize: opportunity,
        seatCount: seats,
        unitPrice: price,
      });
      return;

      detail.querySelector(".demo-proposal-workspace")?.remove();
      detail.classList.add("proposal-open");
      if (!isEric && customer === "Journey Innovations") {
        localStorage.setItem(journeyProposalKey, JSON.stringify({
          sender: "Fabrikam",
          recipient: customer,
          opportunity,
          seats,
          createdAt: new Date().toISOString(),
          status: "Created",
        }));
      }
      const workspace = document.createElement("section");
      workspace.className = "demo-proposal-workspace";
      const proposalPages = [
        `
          <div class="demo-proposal-brand"><strong>Microsoft</strong><span>Partner logo</span></div>
          <p>GROWTH PROPOSAL</p><small>${customer}</small>
          <h1>Six reasons to act now</h1><h2>Monetize Copilot</h2>
          <h3>Why this opportunity matters</h3>
          <div class="demo-reasons">
            <div><b>1</b><strong>Align to the priority</strong><span>Connect Monetize Copilot to the customer priority it supports.</span></div>
            <div><b>2</b><strong>Address the current gap</strong><span>Show how [Current solution] limits the desired experience today.</span></div>
            <div><b>3</b><strong>Create a clear path</strong><span>Position [Recommended solution] as the practical next step.</span></div>
            <div><b>4</b><strong>Plan for adoption</strong><span>Set expectations for readiness, enablement, and accountable ownership.</span></div>
            <div><b>5</b><strong>Measure progress</strong><span>Agree on [Expected outcome] and the signals used to evaluate it.</span></div>
            <div><b>6</b><strong>Move on the right timeline</strong><span>Coordinate decisions and delivery around [Timing].</span></div>
          </div>
        `,
        `
          <p>OPPORTUNITY</p><h1>Opportunity context</h1>
          <div class="demo-proposal-lead">Frame the customer situation, the signals behind the opportunity, and the recommended action.</div>
          <h3>Customer context</h3>
          <p class="demo-proposal-copy">Develop a Copilot monetization proposal for this customer. Focus on paid conversion readiness, expected ROI in the first 90 days, adoption milestones, and a clear path to send the proposal directly to the end customer.</p>
          <h3>Signals to validate</h3>
          <div class="demo-proposal-key-values">
            <span>Business priority<strong>[Customer priority]</strong></span>
            <span>Current challenge<strong>[Current challenge]</strong></span>
            <span>Decision timing<strong>[Timing]</strong></span>
            <span>Success measure<strong>[Expected outcome]</strong></span>
          </div>
          <h3>Recommended action</h3>
          <p class="demo-proposal-copy">Review this package, customize customer-facing materials if handoff is editable, and send the proposal directly to the customer before renewal.</p>
        `,
        `
          <p>RECOMMENDATION</p><h1>Current approach and recommended solution</h1>
          <div class="demo-proposal-lead">Use this comparison to make the proposed change and its intended impact easy to review.</div>
          <h3>Current-versus-recommended comparison</h3>
          <table><thead><tr><th>Area</th><th>Current approach</th><th>Recommended approach</th><th>Intended impact</th></tr></thead>
          <tbody>
            <tr><td>Solution</td><td>[Current solution]</td><td>Microsoft 365 Copilot</td><td>Paid Copilot converts existing free chat habits into governed, measurable productivity gains across Teams and Outlook.</td></tr>
            <tr><td>User scope</td><td>[Current seat count]</td><td>${seats}</td><td>[Adoption outcome]</td></tr>
            <tr><td>Delivery</td><td>[Current delivery approach]</td><td>[Recommended delivery approach]</td><td>[Delivery outcome]</td></tr>
            <tr><td>Timing</td><td>[Current timing]</td><td>[Timing]</td><td>[Timing outcome]</td></tr>
          </tbody></table>
        `,
        `
          <p>VALUE AND DELIVERY</p><h1>Outcomes and action plan</h1>
          <div class="demo-proposal-lead">Connect the intended customer outcomes to a phased, partner-led delivery plan.</div>
          <h3>Target outcomes</h3>
          <div class="demo-proposal-key-values three">
            <span>Business outcome<strong>[Expected outcome]</strong></span>
            <span>User outcome<strong>[User outcome]</strong></span>
            <span>Operational outcome<strong>[Operational outcome]</strong></span>
          </div>
          <h3>Phased action plan</h3>
          <div class="demo-proposal-phases">
            <div><b>Phase 1 · 30 days</b><strong>Discovery &amp; pilot conversion</strong><span>Confirm seat target</span><span>Identify power users from free chat MAU</span><span>Deliver ROI one-pager</span></div>
            <div><b>Phase 2 · 60 days</b><strong>Rollout &amp; activation</strong><span>Enable paid seats</span><span>Run activation workshop</span><span>Track MAU vs purchased licenses</span></div>
            <div><b>Phase 3 · 90 days</b><strong>Renewal checkpoint</strong><span>Review attach vs peer benchmark</span><span>Expand to additional workloads</span><span>Lock renewal BOM</span></div>
          </div>
        `,
        `
          <p>COMMERCIAL VIEW</p><h1>Investment snapshot</h1>
          <div class="demo-proposal-lead">Replace every placeholder with validated commercial information before sharing this ${outboundArtifact}.</div>
          <h3>Illustrative investment comparison</h3>
          <table><thead><tr><th>Investment item</th><th>Current</th><th>Proposed</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Seats</td><td>—</td><td>${seats}</td><td>12-month annual term</td></tr>
            <tr><td>Price per user / month</td><td>—</td><td>${price}</td><td>Paid yearly</td></tr>
            <tr><td>Annual contract value</td><td>—</td><td>${opportunity}</td><td>Customer-facing total</td></tr>
            <tr><td>Target growth margin (partner only)</td><td>—</td><td>${growthMargin}%</td><td>Remove before sending</td></tr>
            <tr><td>Strategic accelerator (partner only)</td><td>—</td><td>$132.00</td><td>Remove before sending</td></tr>
            <tr><td>Growth accelerator (partner only)</td><td>—</td><td>$296.25</td><td>Remove before sending</td></tr>
            <tr><td>Total incentive and margin (partner only)</td><td>—</td><td>$1,748.25</td><td>Remove before sending</td></tr>
          </tbody></table>
          <div class="demo-proposal-notice">Remove partner-only rows before sending. Move margin and incentive detail to a separate partner-only download.</div>
        `,
        `
          <p>PARTNER DELIVERY</p><h1>Partner execution playbook</h1>
          <div class="demo-proposal-lead">Use this playbook to turn the recommendation into a coordinated customer engagement.</div>
          <h3>Execution steps</h3>
          <div class="demo-execution-steps">
            <div><b>1</b><strong>Review ${outboundArtifact} pack</strong><span>Complete within 3 days · distributor</span></div>
            <div><b>2</b><strong>Schedule ${customer} ROI discussion</strong><span>Complete within 10 days · distributor</span></div>
            <div><b>3</b><strong>Send ${outboundArtifact} + FAQ + ROI deck</strong><span>Complete within 14 days · distributor</span></div>
            <div><b>4</b><strong>Checkpoint on attach progress</strong><span>Complete within 30 days · joint</span></div>
          </div>
          <h3>Before customer review</h3>
          <ul class="demo-proposal-checklist"><li>Replace all bracketed placeholders.</li><li>Validate solution, seat, pricing, and timing details.</li><li>Confirm partner ownership and customer next step.</li></ul>
        `,
        `
          <p>PARTNER STORY</p><h1>Your partner narrative</h1>
          <div class="demo-proposal-lead">Customize this page with a concise, evidence-based explanation of why the partner is positioned to deliver.</div>
          <h3>Value proposition</h3>
          <p class="demo-proposal-copy">Develop a Copilot monetization ${outboundArtifact} for this customer. Focus on paid conversion readiness, expected ROI in the first 90 days, adoption milestones, and a clear path to send the ${outboundArtifact} to the intended recipient.</p>
          <h3>Delivery approach</h3><p class="demo-proposal-placeholder">[Partner methodology]</p>
          <h3>Relevant experience</h3><p class="demo-proposal-placeholder">[Partner proof points]</p>
          <h3>Recommended customer next step</h3><p class="demo-proposal-placeholder">[Partner recommended next step]</p>
        `,
        `
          <div class="demo-proposal-brand"><strong>Microsoft</strong><span>Partner logo</span></div>
          <p>NEXT STEP</p><h1>Ready to move forward?</h1>
          <div class="demo-proposal-lead">Confirm the opportunity, validate the proposal inputs, and agree on the next customer conversation.</div>
          <h3>Proposed next step</h3>
          <p class="demo-proposal-copy">Review this package, customize customer-facing materials if handoff is editable, and send the proposal directly to the customer before renewal.</p>
          <h3>Important notice</h3>
          <div class="demo-proposal-notice">This template is provided for partner review and customization. Replace all placeholders and validate solution, pricing, eligibility, timing, claims, and outcomes before sharing with a customer. Microsoft makes no commitment based on this draft.</div>
        `,
      ];
      workspace.innerHTML = `
        <div class="demo-proposal-resizer" role="separator" aria-label="Resize chat and proposal panels" aria-orientation="vertical" tabindex="0"><span>⋮</span></div>
        <header>
          <div><span>✣</span><strong>Partner Agent</strong></div>
          <button type="button" aria-label="Close proposal">×</button>
        </header>
        <div class="demo-proposal-body">
          <main>
            <div class="demo-proposal-document-head">
              <div><strong>Monetize Copilot for ${customer}</strong><span>(all documents)</span></div>
            </div>
            <div class="demo-proposal-canvas">
              <article></article>
            </div>
            <footer>
              <div class="demo-proposal-pagination">
                <button type="button" data-page-action="previous" aria-label="Previous page">‹</button>
                <span>1 of 8 pages</span>
                <button type="button" data-page-action="next" aria-label="Next page">›</button>
              </div>
              <div>
                <div class="demo-proposal-more-wrap">
                  <button type="button" class="secondary" data-proposal-action="more" aria-expanded="false">More actions</button>
                  <div class="demo-proposal-more-menu" role="menu" hidden>
                    <button type="button" role="menuitem" data-proposal-action="email">Send via email</button>
                    <button type="button" role="menuitem" data-proposal-action="json">Download proposal data (JSON)</button>
                    <button type="button" role="menuitem" data-proposal-action="csv">Download proposal data (CSV)</button>
                  </div>
                </div>
                <button type="button">Download PDF</button>
                <span class="demo-proposal-action-status" hidden></span>
              </div>
            </footer>
          </main>
        </div>
      `;
      let currentPage = 0;
      const pageArticle = workspace.querySelector(".demo-proposal-canvas article");
      const pageCount = workspace.querySelector(".demo-proposal-pagination span");
      const previousPage = workspace.querySelector('[data-page-action="previous"]');
      const nextPage = workspace.querySelector('[data-page-action="next"]');
      const renderPage = () => {
        pageArticle.innerHTML = proposalPages[currentPage];
        pageCount.textContent = `${currentPage + 1} of ${proposalPages.length} pages`;
        previousPage.disabled = currentPage === 0;
        nextPage.disabled = currentPage === proposalPages.length - 1;
        workspace.querySelector(".demo-proposal-canvas").scrollTop = 0;
      };
      previousPage.addEventListener("click", () => {
        currentPage -= 1;
        renderPage();
      });
      nextPage.addEventListener("click", () => {
        currentPage += 1;
        renderPage();
      });
      renderPage();
      const resizeHandle = workspace.querySelector(".demo-proposal-resizer");
      const resizePanels = (clientX) => {
        const detailBounds = detail.getBoundingClientRect();
        const chatPercent = Math.min(
          55,
          Math.max(25, ((clientX - detailBounds.left) / detailBounds.width) * 100),
        );
        detail.style.setProperty("--proposal-width", `${100 - chatPercent}%`);
        resizeHandle.setAttribute("aria-valuenow", String(Math.round(chatPercent)));
      };
      resizeHandle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        resizeHandle.setPointerCapture(event.pointerId);
        detail.classList.add("proposal-resizing");
      });
      resizeHandle.addEventListener("pointermove", (event) => {
        if (!resizeHandle.hasPointerCapture(event.pointerId)) return;
        resizePanels(event.clientX);
      });
      resizeHandle.addEventListener("pointerup", (event) => {
        if (resizeHandle.hasPointerCapture(event.pointerId)) {
          resizeHandle.releasePointerCapture(event.pointerId);
        }
        detail.classList.remove("proposal-resizing");
      });
      resizeHandle.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const currentProposalWidth = Number.parseFloat(
          detail.style.getPropertyValue("--proposal-width"),
        ) || 65;
        const nextChatWidth = 100 - currentProposalWidth + (event.key === "ArrowRight" ? 5 : -5);
        const detailBounds = detail.getBoundingClientRect();
        resizePanels(detailBounds.left + detailBounds.width * nextChatWidth / 100);
      });

      const moreButton = workspace.querySelector('[data-proposal-action="more"]');
      const moreMenu = workspace.querySelector(".demo-proposal-more-menu");
      const actionStatus = workspace.querySelector(".demo-proposal-action-status");
      const closeMoreMenu = () => {
        moreMenu.hidden = true;
        moreButton.setAttribute("aria-expanded", "false");
      };
      moreButton.addEventListener("click", () => {
        moreMenu.hidden = !moreMenu.hidden;
        moreButton.setAttribute("aria-expanded", String(!moreMenu.hidden));
      });
      const downloadProposalData = (format) => {
        const proposalData = {
          customer,
          opportunity: "Monetize Copilot",
          opportunitySize: opportunity,
          product: "Microsoft 365 Copilot",
          seats,
          price,
        };
        const content = format === "json"
          ? JSON.stringify(proposalData, null, 2)
          : `Customer,Opportunity,Opportunity size,Product,Seats,Price\n"${customer}","Monetize Copilot","${opportunity}","Microsoft 365 Copilot","${seats}","${price}"`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([content], {
          type: format === "json" ? "application/json" : "text/csv",
        }));
        link.download = `copilot-proposal-${customer.replaceAll(" ", "-").toLowerCase()}.${format}`;
        link.click();
        URL.revokeObjectURL(link.href);
      };
      moreMenu.addEventListener("click", (event) => {
        const action = event.target.closest("[data-proposal-action]")?.dataset.proposalAction;
        if (action === "email") {
          actionStatus.textContent = `Email draft prepared for ${customer}.`;
          actionStatus.hidden = false;
        }
        if (action === "json" || action === "csv") downloadProposalData(action);
        closeMoreMenu();
      });
      workspace.querySelector('header button').addEventListener("click", () => {
        workspace.remove();
        detail.classList.remove("proposal-open");
      });
      detail.appendChild(workspace);
    };

    const addDealEditor = (card) => {
      const existingEditor = card.querySelector(".demo-deal-editor");
      if (existingEditor) {
        existingEditor.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const customer = card.querySelector("h3").textContent.trim();
      const sentProposal = isJane && recipientContext
        ? null
        : isJane || isPaul
          ? getCustomerProposal(customer)
          : null;
      const facts = [...card.querySelectorAll(".demo-customer-recommendation-facts span")];
      const quantityText = facts.find((fact) => fact.textContent.includes("Recommended quantity"))
        ?.querySelector("strong")?.textContent || "0";
      const whitespace = Number(quantityText.replaceAll(",", ""));
      const usesBenefitSharing = !isEric && !isJane;
      const receivedProposal = isJane ? getJourneyProposal() : null;
      const receivedCustomerProposal = receivedProposal?.customer === customer
        ? receivedProposal
        : null;
      const resellerSeatCount = Number(
        String(
          receivedCustomerProposal?.seatCount
            || receivedCustomerProposal?.seats
            || whitespace,
        ).replaceAll(",", ""),
      ) || 1;
      const distributorSeatPrice = parseCompactCurrency(
        receivedCustomerProposal?.unitPrice || "17.48",
      );
      const suggestedEndDate = new Date();
      suggestedEndDate.setFullYear(suggestedEndDate.getFullYear() + 1);
      const editor = document.createElement("div");
      editor.className = "demo-deal-editor";
      editor.innerHTML = `
        <div class="demo-user-prompt">Review deal details for ${customer}</div>
        <div class="demo-ai-label">✣ <strong>Partner Agent</strong> <span>Inline deal model</span></div>
        <div class="demo-deal-heading">
          <h4>Review and refine the Copilot opportunity</h4>
          <button type="button" data-action="collapse-deal">Collapse deal details</button>
        </div>
        <p>Edit the commercial assumptions below. Final cost and incentives update automatically.</p>
        ${usesBenefitSharing ? `
          <div class="demo-deal-fields demo-benefit-price-fields">
            <label>ERP price per seat ($)<input data-field="erp-price" type="number" min="0" step="0.01" value="21.84" readonly /></label>
            <label>Microsoft partner price per seat ($)<input data-field="partner-price" type="number" min="0" step="0.01" value="17.48" /></label>
            <label>Seat count<input data-field="whitespace" type="number" min="1" step="1" value="${whitespace}" /></label>
          </div>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Promotion</h5>
              <span>Percentage and total dollar benefit</span>
            </div>
            <div class="demo-benefit-rate-table">
              <div><span>Promotion</span><strong>15%</strong><output data-benefit="promotion"></output></div>
            </div>
          </section>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Margin</h5>
              <span>Eligible FY27 margin components</span>
            </div>
            <div class="demo-benefit-rate-table">
              <div><span>New-to-Offer Eligible Margin · FY27</span><strong>3%</strong><output data-margin="new-offer"></output></div>
              <div><span>Seat Expansion Eligible Margin · FY27</span><strong>4%</strong><output data-margin="seat-expansion"></output></div>
              <div><span>Strategic SKU Mix Eligible Margin · FY27</span><strong>3%</strong><output data-margin="strategic-sku"></output></div>
            </div>
          </section>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Incentives</h5>
              <span>Program percentages are fixed and not editable</span>
            </div>
            <label class="demo-cocp-field">Is COCP applicable?
              <input data-field="cocp" type="hidden" value="No" />
              <strong class="demo-readonly-value">No</strong>
            </label>
            <div class="demo-benefit-rate-table">
              <div><span>Core · FY27</span><strong data-incentive-rate-label="core">2%</strong><output data-incentive="core"></output></div>
              <div class="demo-strategic-tier-row">
                <span>Global Strategic Product Accelerator · FY27</span>
                <strong>Tier 2 · 7.5%</strong>
                <output data-incentive="strategic"></output>
              </div>
              <div><span>Growth Accelerator · FY27</span><strong>10%</strong><output data-incentive="growth"></output></div>
            </div>
          </section>
          <section class="demo-deal-section demo-benefit-sharing-section">
            <div class="demo-deal-section-title">
              <h5>Benefit sharing</h5>
              <span>Choose how much to keep versus pass through to the ${isPaul ? "customer" : "reseller"}</span>
            </div>
            <div class="demo-benefit-sharing">
              ${[
                ["promotion", "Promotion total"],
                ["margin", "Margin total"],
                ["incentives", "Incentives total"],
                ["total", "Total benefits"],
              ].map(([key, label]) => `
                <div class="${key === "total" ? "total" : ""}" data-benefit-share-row="${key}">
                  <div><strong>${label}</strong><output data-benefit-total="${key}"></output></div>
                  ${renderShareSlider(`data-benefit-share="${key}" aria-label="${label} percentage kept by partner"`)}
                  <small><span data-benefit-kept="${key}"></span><span data-benefit-passed="${key}"></span></small>
                </div>
              `).join("")}
            </div>
            <div class="demo-benefit-final-values">
              <div><span>Offered price per seat</span><strong data-benefit-result="offered-price"></strong></div>
              <div><span>Final deal size</span><strong data-benefit-result="deal-size"></strong></div>
            </div>
          </section>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Benefits eligible</h5>
              <span>Included with this opportunity</span>
            </div>
            <div class="demo-benefit-list">
              <span>✓ Copilot adoption workshop</span>
              <span>✓ Customer success accelerators</span>
              <span>✓ Deployment and enablement guidance</span>
            </div>
          </section>
        ` : isJane ? `
          <div class="demo-deal-fields demo-benefit-price-fields">
            <label>Distributor<input data-field="distributor" value="Fabrikam" readonly /></label>
            <label>Seat price offered by distributor ($)<input data-field="distributor-price" type="number" min="0" step="0.01" value="${distributorSeatPrice.toFixed(2)}" readonly /></label>
            <label>Seat count<input data-field="whitespace" type="number" min="1" step="1" value="${resellerSeatCount}" readonly /></label>
          </div>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Reseller incentives</h5>
              <span>Program percentages are fixed and not editable</span>
            </div>
            <div class="demo-benefit-rate-table">
              <div><span>Core · FY27</span><strong>2%</strong><output data-reseller-incentive="core"></output></div>
              <div><span>Global Strategic Product Accelerator · Tier 2 · FY27</span><strong>7.5%</strong><output data-reseller-incentive="strategic"></output></div>
              <div><span>Growth Accelerator · FY27</span><strong>10%</strong><output data-reseller-incentive="growth"></output></div>
              <div class="total"><span>Total incentives</span><strong>19.5%</strong><output data-reseller-incentive="total"></output></div>
            </div>
          </section>
          <section class="demo-deal-section demo-benefit-sharing-section">
            <div class="demo-deal-section-title">
              <h5>Customer incentive benefit</h5>
              <span>Choose how much incentive Journey Innovations keeps versus passes to the customer</span>
            </div>
            <div class="demo-benefit-sharing">
              <div class="total" data-reseller-share-row>
                <div><strong>Total incentives</strong><output data-reseller-incentive-total></output></div>
                ${renderShareSlider('data-reseller-incentive-share aria-label="Incentive percentage kept by Journey Innovations"')}
                <small><span data-reseller-incentive-kept></span><span data-reseller-incentive-passed></span></small>
              </div>
            </div>
            <div class="demo-benefit-final-values">
              <div><span>Price offered to customer</span><strong data-reseller-result="customer-price"></strong></div>
              <div><span>Final customer deal size</span><strong data-reseller-result="deal-size"></strong></div>
            </div>
          </section>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Benefits eligible</h5>
              <span>Included with this opportunity</span>
            </div>
            <div class="demo-benefit-list">
              <span>✓ Copilot adoption workshop</span>
              <span>✓ Customer success accelerators</span>
              <span>✓ Deployment and enablement guidance</span>
            </div>
          </section>
        ` : `
          <div class="demo-deal-fields">
            <label class="demo-sku-field">SKU details
              <div class="demo-sku-search">
                <span>⌕</span>
                <input data-field="sku" role="combobox" aria-label="Search SKU details" aria-expanded="false" aria-controls="demo-sku-options" value="Microsoft 365 Copilot" autocomplete="off" />
                <button type="button" aria-label="Clear SKU search">×</button>
              </div>
              <div class="demo-sku-options" id="demo-sku-options" role="listbox" hidden></div>
            </label>
            ${isJane ? '<label>Distributor name<input data-field="distributor" value="Fabrikam" readonly /></label>' : ""}
            <label>List price<input data-field="list" type="number" min="0" step="0.01" value="21.84" /></label>
            <label>Promotion percent<input data-field="promotion" type="number" min="0" max="100" step="0.1" value="15" /></label>
            ${isJane ? '<label>Billing frequency<select data-field="billing"><option selected>Monthly</option><option>Annual</option></select></label>' : ""}
            ${isJane ? `<label>Subscription end date<input data-field="end-date" type="date" value="${suggestedEndDate.toISOString().slice(0, 10)}" /></label>` : ""}
            ${isJane ? '<label>Term duration<select data-field="term"><option selected>P1Y annual term</option><option>P3Y three-year term</option></select></label>' : ""}
            ${isJane ? "" : '<label>Growth margin (%)<input data-field="margin" type="number" min="0" max="100" step="1" value="20" /></label>'}
            <label>Discounted final price<input data-field="discounted" type="number" min="0" step="0.01" readonly /></label>
            ${isJane ? "" : '<label>Partner Earned Credit (15%)<output data-field="pec"></output></label>'}
            ${isJane ? "" : '<label>Is COCP applicable?<select data-field="cocp"><option>No</option><option>Yes</option></select></label>'}
            <label>Seat count<input data-field="whitespace" type="number" min="0" step="1" value="${whitespace}" /></label>
            <label class="demo-final-cost">Final cost <small>Seat count × discounted final price</small><output data-field="opportunity"></output></label>
          </div>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Incentives</h5>
              <span>Calculated on final cost after promotion and growth margin</span>
            </div>
            <div class="demo-incentive-table">
              <div><span>Core incentive${isJane ? " (reseller)" : ""}</span><label><input data-incentive-rate="core" type="number" min="0" max="100" step="0.1" value="2.5" /><b>%</b></label><output data-incentive="core"></output></div>
              <div><span>Global strategic tier 2${isJane ? " (reseller)" : ""}</span><label><input data-incentive-rate="strategic" type="number" min="0" max="100" step="0.1" value="7" /><b>%</b></label><output data-incentive="strategic"></output></div>
              <div><span>Growth accelerator${isJane ? " (reseller)" : ""}</span><label><input data-incentive-rate="growth" type="number" min="0" max="100" step="0.1" value="10" /><b>%</b></label><output data-incentive="growth"></output></div>
            </div>
          </section>
          <section class="demo-deal-section">
            <div class="demo-deal-section-title">
              <h5>Benefits eligible</h5>
              <span>Included with this opportunity</span>
            </div>
            <div class="demo-benefit-list">
              <span>✓ Copilot adoption workshop</span>
              <span>✓ Customer success accelerators</span>
              <span>✓ Deployment and enablement guidance</span>
            </div>
          </section>
        `}
        <div class="demo-deal-actions">
          ${sentProposal ? `<button type="button" data-action="sent-proposal">${isJane ? "See sent proposal" : "See sent quote"}</button>` : ""}
          <button type="button" data-action="proposal">${isJane ? sentProposal ? "Send revised customer proposal" : "Send customer proposal" : sentProposal ? "Send revised reseller quote" : "Send reseller quote"}</button>
          <button type="button" data-action="transact">${isJane ? "Signal distributor for transact" : "Transact"}</button>
        </div>
        <div class="demo-transaction-status" hidden></div>
      `;
      card.appendChild(editor);
      editor.querySelector('[data-action="collapse-deal"]').addEventListener("click", () => {
        editor.remove();
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      if (isJane) {
        const usd = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        });
        const shareSlider = editor.querySelector("[data-reseller-incentive-share]");
        const updateResellerCalculator = () => {
          const seats = Math.max(
            1,
            Number(editor.querySelector('[data-field="whitespace"]').value || 0),
          );
          const distributorPrice = Math.max(
            0,
            Number(editor.querySelector('[data-field="distributor-price"]').value || 0),
          );
          const distributorDealSize = distributorPrice * seats;
          const incentiveAmounts = {
            core: distributorDealSize * 0.02,
            strategic: distributorDealSize * 0.075,
            growth: distributorDealSize * 0.10,
          };
          const incentiveTotal = Object.values(incentiveAmounts)
            .reduce((sum, amount) => sum + amount, 0);
          const keptPercent = Number(shareSlider.value);
          const incentiveKept = incentiveTotal * (keptPercent / 100);
          const incentivePassed = incentiveTotal - incentiveKept;
          const customerPrice = Math.max(0, distributorPrice - incentivePassed / seats);
          const finalDealSize = customerPrice * seats;

          Object.entries(incentiveAmounts).forEach(([key, amount]) => {
            editor.querySelector(`[data-reseller-incentive="${key}"]`).textContent =
              usd.format(amount);
          });
          editor.querySelector('[data-reseller-incentive="total"]').textContent =
            usd.format(incentiveTotal);
          editor.querySelector("[data-reseller-incentive-total]").textContent =
            usd.format(incentiveTotal);
          editor.querySelector("[data-reseller-incentive-kept]").textContent =
            `Journey Innovations keeps ${keptPercent}% · ${usd.format(incentiveKept)}`;
          editor.querySelector("[data-reseller-incentive-passed]").textContent =
            `Passes ${100 - keptPercent}% · ${usd.format(incentivePassed)} to customer`;
          editor.querySelector('[data-reseller-result="customer-price"]').textContent =
            `${usd.format(customerPrice)} per seat`;
          editor.querySelector('[data-reseller-result="deal-size"]').textContent =
            usd.format(finalDealSize);
          editor.dataset.customerPrice = customerPrice.toFixed(2);
          editor.dataset.dealSize = finalDealSize.toFixed(2);
          editor.dataset.seats = String(seats);
        };

        shareSlider.addEventListener("input", updateResellerCalculator);
        editor.querySelector('[data-action="proposal"]').addEventListener("click", () => {
          openGcpsProposalWorkspace({
            customer,
            opportunitySize: usd.format(Number(editor.dataset.dealSize)),
            seatCount: Number(editor.dataset.seats).toLocaleString(),
            unitPrice: usd.format(Number(editor.dataset.customerPrice)),
            product: "Microsoft 365 Copilot",
          });
        });
        editor.querySelector('[data-action="transact"]').addEventListener("click", () => {
          const subscriptionEndDate = new Date();
          subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
          localStorage.setItem(journeyTransactionSignalKey, JSON.stringify({
            sender: "Journey Innovations",
            senderUser: "Karin",
            recipient: "Fabrikam",
            recipientUser: "Sarah",
            distributor: "Fabrikam",
            customer,
            product: "Microsoft 365 Copilot",
            seats: Number(editor.dataset.seats).toLocaleString(),
            unitPrice: usd.format(Number(editor.dataset.customerPrice)),
            opportunitySize: usd.format(Number(editor.dataset.dealSize)),
            billingFrequency: "Monthly",
            termDuration: "P1Y annual term",
            subscriptionEndDate: subscriptionEndDate.toISOString().slice(0, 10),
            status: "Ready for transact",
            signaledAt: new Date().toISOString(),
          }));
          editor.innerHTML = `
            <div class="demo-transaction-signal-success">
              <span>✓</span>
              <div>
                <h4>Signal sent</h4>
                <p>Fabrikam has been notified that customer ${customer} is ready for transact.</p>
              </div>
            </div>
          `;
          editor.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        updateResellerCalculator();
        editor.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (usesBenefitSharing) {
        const benefitField = (name) => editor.querySelector(`[data-field="${name}"]`);
        const usd = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        });
        const categoryKeys = ["promotion", "margin", "incentives"];
        const sharingTarget = isPaul ? "customer" : "reseller";

        const updateBenefitCalculator = () => {
          const partnerPrice = Number(benefitField("partner-price").value || 0);
          const seatField = benefitField("whitespace");
          const seats = Math.max(1, Number(seatField.value || 0));
          if (Number(seatField.value) !== seats) seatField.value = String(seats);
          const dealBase = partnerPrice * seats;
          const promotionRate = 15;
          const promotionTotal = dealBase * (promotionRate / 100);
          const marginAmounts = {
            "new-offer": dealBase * 0.03,
            "seat-expansion": dealBase * 0.04,
            "strategic-sku": dealBase * 0.03,
          };
          const marginTotal = Object.values(marginAmounts)
            .reduce((sum, value) => sum + value, 0);
          const cocpApplies = benefitField("cocp").value === "Yes";
          const coreRate = cocpApplies ? 0 : 0.02;
          const incentiveAmounts = {
            core: dealBase * coreRate,
            strategic: dealBase * 0.075,
            growth: dealBase * 0.10,
          };
          const incentivesTotal = Object.values(incentiveAmounts)
            .reduce((sum, value) => sum + value, 0);
          const totals = {
            promotion: promotionTotal,
            margin: marginTotal,
            incentives: incentivesTotal,
          };
          const totalBenefits = Object.values(totals)
            .reduce((sum, value) => sum + value, 0);

          editor.querySelector('[data-benefit="promotion"]').textContent =
            usd.format(promotionTotal);
          Object.entries(marginAmounts).forEach(([key, value]) => {
            editor.querySelector(`[data-margin="${key}"]`).textContent = usd.format(value);
          });
          Object.entries(incentiveAmounts).forEach(([key, value]) => {
            editor.querySelector(`[data-incentive="${key}"]`).textContent = usd.format(value);
          });
          editor.querySelector('[data-incentive-rate-label="core"]').textContent =
            `${coreRate * 100}%`;

          let retainedTotal = 0;
          let passedTotal = 0;
          categoryKeys.forEach((key) => {
            const amount = totals[key];
            const keptPercent = Number(
              editor.querySelector(`[data-benefit-share="${key}"]`).value,
            );
            const kept = amount * (keptPercent / 100);
            const passed = amount - kept;
            retainedTotal += kept;
            passedTotal += passed;
            editor.querySelector(`[data-benefit-total="${key}"]`).textContent =
              usd.format(amount);
            editor.querySelector(`[data-benefit-kept="${key}"]`).textContent =
              `Partner keeps ${keptPercent}% · ${usd.format(kept)}`;
            editor.querySelector(`[data-benefit-passed="${key}"]`).textContent =
              `Passes ${100 - keptPercent}% · ${usd.format(passed)} to ${sharingTarget}`;
          });

          const totalKeptPercent = totalBenefits
            ? Math.round((retainedTotal / totalBenefits) * 100)
            : Math.round(
              categoryKeys.reduce(
                (sum, key) =>
                  sum + Number(editor.querySelector(`[data-benefit-share="${key}"]`).value),
                0,
              ) / categoryKeys.length,
            );
          const totalSlider = editor.querySelector('[data-benefit-share="total"]');
          totalSlider.value = totalKeptPercent;
          editor.querySelector('[data-benefit-total="total"]').textContent =
            usd.format(totalBenefits);
          editor.querySelector('[data-benefit-kept="total"]').textContent =
            `Partner keeps ${totalKeptPercent}% · ${usd.format(retainedTotal)}`;
          editor.querySelector('[data-benefit-passed="total"]').textContent =
            `Passes ${100 - totalKeptPercent}% · ${usd.format(passedTotal)} to ${sharingTarget}`;

          const offeredPrice = Math.max(0, partnerPrice - passedTotal / seats);
          const finalDealSize = offeredPrice * seats;
          editor.querySelector('[data-benefit-result="offered-price"]').textContent =
            `${usd.format(offeredPrice)} per seat`;
          editor.querySelector('[data-benefit-result="deal-size"]').textContent =
            usd.format(finalDealSize);
          editor.dataset.offeredPrice = offeredPrice.toFixed(2);
          editor.dataset.dealSize = finalDealSize.toFixed(2);
          editor.dataset.seats = String(seats);
          editor.dataset.incentivesTotal = incentivesTotal.toFixed(2);
          const incentivesKeptPercent = Number(
            editor.querySelector('[data-benefit-share="incentives"]').value,
          );
          editor.dataset.incentiveEarnedPerSeat =
            ((incentivesTotal * (incentivesKeptPercent / 100)) / seats).toFixed(4);
        };

        editor.querySelectorAll(
          '[data-field="erp-price"], [data-field="partner-price"], [data-field="whitespace"], [data-field="cocp"]',
        ).forEach((input) => {
          input.addEventListener("input", updateBenefitCalculator);
          input.addEventListener("change", updateBenefitCalculator);
        });
        categoryKeys.forEach((key) => {
          editor.querySelector(`[data-benefit-share="${key}"]`).addEventListener(
            "input",
            updateBenefitCalculator,
          );
        });
        editor.querySelector('[data-benefit-share="total"]').addEventListener("input", (event) => {
          categoryKeys.forEach((key) => {
            editor.querySelector(`[data-benefit-share="${key}"]`).value =
              event.currentTarget.value;
          });
          updateBenefitCalculator();
        });

        editor.querySelector('[data-action="proposal"]').addEventListener("click", () => {
          openGcpsProposalWorkspace({
            customer,
            opportunitySize: usd.format(Number(editor.dataset.dealSize)),
            seatCount: Number(editor.dataset.seats).toLocaleString(),
            unitPrice: usd.format(Number(editor.dataset.offeredPrice)),
            product: "Microsoft 365 Copilot",
          });
        });
        editor.querySelector('[data-action="transact"]').addEventListener("click", () => {
          const status = editor.querySelector(".demo-transaction-status");
          const offeredPrice = Number(editor.dataset.offeredPrice);
          const seats = Number(editor.dataset.seats);
          status.innerHTML = `
            <div class="demo-user-prompt">Transact this Copilot opportunity for ${customer}</div>
            <div class="demo-ai-label">✣ <strong>Partner Agent</strong> <span>Purchase review</span></div>
            <h4>Review transaction details</h4>
            <p>Review the benefit-adjusted offer before purchasing.</p>
            <div class="demo-transaction-fields">
              <label>Customer name<input data-transaction-field="customer" value="${customer}" /></label>
              ${isPaul ? "" : '<label>Reseller name<input data-transaction-field="reseller" value="Journey Innovations" /></label>'}
              <label>SKU selected<input data-transaction-field="sku" value="Microsoft 365 Copilot" readonly /></label>
              <label>Offered price per seat (USD)<input data-transaction-field="price" type="number" min="0" step="0.01" value="${offeredPrice.toFixed(2)}" /></label>
              <label>Seats<input data-transaction-field="seats" type="number" min="1" step="1" value="${seats}" /></label>
              <label>Final deal size<output data-transaction-field="total"></output></label>
            </div>
            <div class="demo-transaction-actions">
              <button type="button" data-transaction-action="purchase">Purchase</button>
              <button type="button" data-transaction-action="cancel">Cancel</button>
            </div>
            <p class="demo-purchase-ready" hidden></p>
          `;
          status.hidden = false;
          const transactionField = (name) =>
            status.querySelector(`[data-transaction-field="${name}"]`);
          const updateTransactionTotal = () => {
            transactionField("total").textContent = usd.format(
              Number(transactionField("seats").value || 0)
                * Number(transactionField("price").value || 0),
            );
          };
          transactionField("seats").addEventListener("input", updateTransactionTotal);
          transactionField("price").addEventListener("input", updateTransactionTotal);
          status.querySelector('[data-transaction-action="purchase"]').addEventListener(
            "click",
            (event) => {
              const ready = status.querySelector(".demo-purchase-ready");
              const completedAt = new Date().toISOString();
              if (!isPaul) {
                const completedCustomer = transactionField("customer").value;
                const completedSeats = Number(transactionField("seats").value || 0);
                recordSarahCompletedTransaction({
                  id: getCustomerTransactionId(completedCustomer),
                  customer: completedCustomer,
                  seats: completedSeats,
                  dealSize: completedSeats
                    * Number(transactionField("price").value || 0),
                  incentiveEarned: completedSeats
                    * Number(editor.dataset.incentiveEarnedPerSeat || 0),
                  completedAt,
                });
              }
              ready.textContent =
                `Purchase confirmed for ${transactionField("customer").value}: `
                + `${transactionField("seats").value} Microsoft 365 Copilot seats `
                + `at ${usd.format(Number(transactionField("price").value || 0))} per seat.`;
              ready.hidden = false;
              event.currentTarget.textContent = "Purchase completed";
              event.currentTarget.disabled = true;
            },
          );
          status.querySelector('[data-transaction-action="cancel"]').addEventListener(
            "click",
            () => {
              status.hidden = true;
            },
          );
          updateTransactionTotal();
          status.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        updateBenefitCalculator();
        editor.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const field = (name) => editor.querySelector(`[data-field="${name}"]`);
      const skuOptions = [
        "Microsoft 365 Copilot",
        "Microsoft 365 Copilot - 3 year",
        "Microsoft 365 Copilot Business",
        "Microsoft 365 Copilot Business Trial",
      ];
      const skuList = editor.querySelector(".demo-sku-options");
      const renderSkuOptions = () => {
        const query = field("sku").value.trim().toLowerCase();
        const matches = !query || query.includes("copilot")
          ? skuOptions
          : skuOptions.filter((option) => option.toLowerCase().includes(query));
        skuList.innerHTML = `
          ${matches.map((option) => `
            <button type="button" role="option" data-sku="${option}">
              <strong>${option}</strong>
            </button>
          `).join("")}
        `;
        skuList.hidden = matches.length === 0;
        field("sku").setAttribute("aria-expanded", String(matches.length > 0));
      };
      field("sku").addEventListener("input", renderSkuOptions);
      field("sku").addEventListener("focus", renderSkuOptions);
      editor.querySelector(".demo-sku-search button").addEventListener("click", () => {
        field("sku").value = "";
        field("sku").focus();
        renderSkuOptions();
      });
      skuList.addEventListener("click", (event) => {
        const option = event.target.closest("[data-sku]");
        if (!option) return;
        field("sku").value = option.dataset.sku;
        updateCommercials();
        skuList.hidden = true;
        field("sku").setAttribute("aria-expanded", "false");
      });
      const currency = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
      });
      const updateCommercials = () => {
        const listPrice = Number(field("list").value || 0);
        const promotion = Number(field("promotion").value || 0);
        const growthMargin = isJane ? 0 : Number(field("margin").value || 0);
        const discountedPrice = Number(
          (listPrice * (1 - promotion / 100) * (1 - growthMargin / 100)).toFixed(2),
        );
        const finalCost = Number(field("whitespace").value || 0) * discountedPrice;
        field("discounted").value = discountedPrice.toFixed(2);
        field("opportunity").textContent = currency.format(finalCost);
        if (field("pec")) field("pec").textContent = currency.format(finalCost * 0.15);
        editor.querySelectorAll("[data-incentive-rate]").forEach((rateField) => {
          const rate = Number(rateField.value || 0) / 100;
          editor.querySelector(`[data-incentive="${rateField.dataset.incentiveRate}"]`).textContent =
            currency.format(finalCost * rate);
        });
      };
      field("list").addEventListener("input", updateCommercials);
      field("promotion").addEventListener("input", updateCommercials);
      field("margin")?.addEventListener("input", updateCommercials);
      field("whitespace").addEventListener("input", updateCommercials);
      editor.querySelectorAll("[data-incentive-rate]").forEach((rateField) => {
        rateField.addEventListener("input", updateCommercials);
      });
      editor.querySelector('[data-action="proposal"]').addEventListener("click", () => {
        openGcpsProposalWorkspace({
          customer,
          opportunitySize: field("opportunity").textContent.trim(),
          seatCount: Number(field("whitespace").value || 0).toLocaleString(),
          unitPrice: `EUR ${Number(field("discounted").value || 0).toFixed(2)}`,
          product: field("sku").value.trim() || "Microsoft 365 Copilot",
        });
      });
      const markDealChanged = () => {
        if (!isJane) return;
        if (!getCustomerProposal(customer)) return;
        const proposalButton = editor.querySelector('[data-action="proposal"]');
        proposalButton.hidden = false;
        proposalButton.textContent = "Send new proposal";
      };
      editor.querySelectorAll("input:not([readonly]), select").forEach((input) => {
        input.addEventListener("input", markDealChanged);
        input.addEventListener("change", markDealChanged);
      });
      editor.querySelector('[data-action="transact"]').addEventListener("click", (event) => {
        const status = editor.querySelector(".demo-transaction-status");
        const selectedSku = field("sku").value;
        if (isJane) {
          const signal = {
            sender: "Journey Innovations",
            senderUser: "Karin",
            recipient: "Fabrikam",
            recipientUser: "Sarah",
            distributor: field("distributor").value,
            customer,
            product: selectedSku,
            seats: Number(field("whitespace").value || 0).toLocaleString(),
            unitPrice: `EUR ${Number(field("discounted").value || 0).toFixed(2)}`,
            opportunitySize: field("opportunity").textContent.trim(),
            billingFrequency: field("billing").value,
            termDuration: field("term").value,
            subscriptionEndDate: field("end-date").value,
            status: "Ready for transact",
            signaledAt: new Date().toISOString(),
          };
          localStorage.setItem(journeyTransactionSignalKey, JSON.stringify(signal));
          editor.innerHTML = `
            <div class="demo-transaction-signal-success">
              <span>✓</span>
              <div>
                <h4>Signal sent</h4>
                <p>Fabrikam has been notified that customer ${customer} is ready for transact.</p>
              </div>
            </div>
          `;
          editor.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        const threeYearTerm = /3 year/i.test(selectedSku);
        const termYears = threeYearTerm ? 3 : 1;
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + termYears);
        const tenantName = `${customer.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")}.onmicrosoft.com`;
        status.innerHTML = `
          <div class="demo-user-prompt">Transact this Copilot opportunity for ${customer}</div>
          <div class="demo-ai-label">✣ <strong>Partner Agent</strong> <span>Purchase review</span></div>
          <h4>Review transaction details</h4>
          <p>Edit any customer, subscription, or commercial field inline before purchasing.</p>
          <div class="demo-transaction-fields">
            <label>Customer name<input data-transaction-field="customer" value="${customer}" /></label>
            <label>Tenant<input data-transaction-field="tenant" value="${tenantName}" /></label>
            ${isPaul ? "" : '<label>Reseller name<input data-transaction-field="reseller" value="Journey Innovations" /></label>'}
            <label>MPN<input data-transaction-field="mpn" value="0000008" /></label>
            <label>SKU selected<input data-transaction-field="sku" value="${selectedSku}" /></label>
            <label>Billing cycle<input data-transaction-field="billing" value="${threeYearTerm ? "Triennial" : "Monthly"}" /></label>
            <label>Promotion applied (%)<input data-transaction-field="promotion" type="number" min="0" max="100" step="1" value="${field("promotion").value}" /></label>
            <label>Price available per seat (EUR)<input data-transaction-field="price" type="number" min="0" step="0.01" value="${Number(field("discounted").value).toFixed(2)}" /></label>
            <label>Seats<input data-transaction-field="seats" type="number" min="1" step="1" value="${field("whitespace").value}" /></label>
            <label>Term<input data-transaction-field="term" value="${threeYearTerm ? "3 years" : "P1Y annual term"}" /></label>
            <label>Subscription end date<input data-transaction-field="end-date" type="date" value="${subscriptionEndDate.toISOString().slice(0, 10)}" /></label>
            <label>Total price<output data-transaction-field="total"></output></label>
          </div>
          <div class="demo-transaction-actions">
            <button type="button" data-transaction-action="purchase">Purchase</button>
            <button type="button" data-transaction-action="cancel">Cancel</button>
          </div>
          <p class="demo-purchase-ready" hidden></p>
        `;
        status.hidden = false;
        const transactionField = (name) => status.querySelector(`[data-transaction-field="${name}"]`);
        const updateTotal = () => {
          transactionField("total").textContent = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "EUR",
          }).format(
            Number(transactionField("seats").value || 0)
              * Number(transactionField("price").value || 0),
          );
        };
        transactionField("seats").addEventListener("input", updateTotal);
        transactionField("price").addEventListener("input", updateTotal);
        status.querySelector('[data-transaction-action="purchase"]').addEventListener("click", () => {
          const ready = status.querySelector(".demo-purchase-ready");
          ready.textContent =
            `Purchase confirmed for ${transactionField("customer").value}: `
            + `${transactionField("seats").value} ${transactionField("sku").value} seats `
            + `at EUR ${Number(transactionField("price").value || 0).toFixed(2)} per seat, `
            + `ending ${transactionField("end-date").value}.`;
          ready.hidden = false;
        });
        status.querySelector('[data-transaction-action="cancel"]').addEventListener("click", () => {
          status.hidden = true;
        });
        updateTotal();
        status.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      updateCommercials();
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    detail.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (["Create reseller customer proposal", "Prepare reseller quote"].includes(button.textContent.trim())) {
        openGcpsProposalWorkspace();
      }
      if (button.dataset.action === "prepare-offer") {
        const card = button.closest(".demo-customer-recommendation");
        addDealEditor(card);
      }
      if (button.dataset.janeProposalAction === "skeleton") {
        const proposal = getJourneyProposal();
        openGcpsProposalWorkspace({
          recipientView: true,
          customer: proposal?.customer || "",
          opportunitySize: proposal?.opportunitySize || "",
          seatCount: proposal?.seatCount || proposal?.seats || "",
          unitPrice: proposal?.unitPrice || "",
          product: proposal?.product || "Microsoft 365 Copilot",
        });
      }
      if (button.dataset.janeProposalAction === "customers") {
        customerView.hidden = false;
        button.disabled = true;
        button.textContent = "Customer details shown below";
        customerView.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (["See sent proposal", "See sent quote"].includes(button.textContent.trim())) {
        const customer = button.closest(".demo-customer-recommendation")
          ?.querySelector("h3")?.textContent.trim();
        const sentProposal = customer ? getCustomerProposal(customer) : null;
        if (sentProposal) {
          openGcpsProposalWorkspace({
            ...sentProposal,
            sentProposalView: true,
          });
        }
      }
      if (button.textContent.trim() === "Review deal details") {
        addDealEditor(button.closest(".demo-customer-recommendation"));
      }
    });
    document.body.appendChild(detail);
    if (initialView === "customers") {
      if (isPaul) {
        journeyCard.remove();
        customerView.hidden = false;
        customerView.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (recipientContext) {
        customerView.hidden = false;
        customerView.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        detail.querySelector(".demo-see-customers").click();
      }
    } else if (initialView === "proposal-received") {
      const proposal = getJourneyProposal();
      openGcpsProposalWorkspace({
        recipientView: true,
        customer: proposal?.customer || "",
        opportunitySize: proposal?.opportunitySize || "",
        seatCount: proposal?.seatCount || proposal?.seats || "",
        unitPrice: proposal?.unitPrice || "",
        product: proposal?.product || "Microsoft 365 Copilot",
      });
    }
    document.querySelectorAll("aside button").forEach((button) => {
      if (!button.closest(".demo-journey-recommendation")) {
        button.addEventListener("click", closeJourneyDetail, { once: true });
      }
    });
  };

  const openJaneReceivedProposal = () => {
    if (document.querySelector(".demo-journey-recommendation")) return;
    const proposal = getJourneyProposal();
    const isCustomerProposal = Boolean(proposal?.customer);
    const proposalSeats = proposal?.seatCount || proposal?.seats || "";
    const proposalPrice = proposal?.unitPrice || "";
    const detail = document.createElement("section");
    detail.className = "demo-journey-recommendation demo-jane-proposal-chat";
    detail.innerHTML = `
      <header class="demo-journey-chat-header">
        <div><span>✣</span><div><strong>Partner Agent</strong><small>Journey Innovations · Quote received</small></div></div>
        <button class="demo-journey-close" type="button" aria-label="Close quote conversation">×</button>
      </header>
      <div class="demo-journey-thread">
        <div class="demo-user-prompt">Show me the quote Fabrikam sent to Journey Innovations.</div>
        <div class="demo-assistant-label">✣ Partner Agent</div>
        <article class="demo-jane-proposal-message">
          <span class="demo-jane-proposal-badge">QUOTE FROM FABRIKAM</span>
          <h1>Sarah has sent you a Monetize Copilot quote${isCustomerProposal ? ` for ${proposal.customer}` : ""}</h1>
          <p><strong>Sarah from Fabrikam</strong> sent you ${isCustomerProposal
            ? `a customer-specific quote for <strong>${proposal.customer}</strong> with <strong>${proposalSeats} seats</strong> at <strong>${proposalPrice} per seat</strong>.`
            : "a quote regarding a recommendation to convert free Copilot seats to paid licenses for <strong>14 customers</strong>."}</p>
          <p>${isCustomerProposal
            ? "Review Fabrikam’s distributor offer, your fixed reseller incentives, and how much incentive benefit to pass to the customer."
            : "You can review the reseller quote or explore the customers included in the recommendation."}</p>
          <div class="demo-jane-proposal-actions">
            <button type="button" data-jane-proposal-action="skeleton">View quote</button>
            <button type="button" data-jane-proposal-action="customers">${isCustomerProposal ? "View customer deal details" : "View customer details"}</button>
          </div>
        </article>
      </div>
    `;
    detail.querySelector(".demo-journey-close").addEventListener("click", () => detail.remove());
    detail.querySelector('[data-jane-proposal-action="skeleton"]').addEventListener("click", () => {
      const conversation = detail.querySelector(".demo-journey-thread").cloneNode(true);
      detail.remove();
      openJourneyRecommendation("proposal-received", true, conversation);
    });
    detail.querySelector('[data-jane-proposal-action="customers"]').addEventListener("click", () => {
      const conversation = detail.querySelector(".demo-journey-thread").cloneNode(true);
      detail.remove();
      openJourneyRecommendation("customers", true, conversation);
    });
    document.body.appendChild(detail);
  };

  if (
    isJane
    && new URLSearchParams(window.location.search).get("journey") === "received"
  ) {
    openJaneReceivedProposal();
  }

  document.addEventListener(
    "click",
    (event) => {
      if (isEric || isJane) return;
      const button = event.target.closest("button");
      const buttonText = button?.textContent.replace(/^✦\s*/, "").trim();
      const legacyProposalActions = new Set(["Create proposal", "Yes, create the proposal"]);
      if (
        !legacyProposalActions.has(buttonText)
        || button.closest(".demo-journey-recommendation")
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const recommendation = button.closest(".rounded-xl") || button.closest("aside");
      const recommendationText = recommendation?.innerText || "";
      const heading = [...(recommendation?.querySelectorAll("p") || [])].find(
        (paragraph) => paragraph.textContent.includes("·"),
      )?.textContent.trim();
      const pageText = document.body.innerText;
      const customer = heading?.split("·").at(-1)?.trim()
        || pageText.match(/prepared (?:a )?.*?proposal for ([^\n.]+)/i)?.[1]?.trim()
        || pageText.match(/recommendation for ([^\n.]+)/i)?.[1]?.trim()
        || "";
      const opportunitySize = recommendationText.match(/[€$][\d,.]+[MK]?/)?.[0]
        || pageText.match(/(?:Annual Value|Revenue potential):?\s*((?:EUR\s*)?[€$]?[\d,.]+[MK]?)/i)?.[1]
        || "";
      const seatCount = pageText.match(/Quantity\s*\|?\s*([\d,]+)\s+seats/i)?.[1] || "";
      const unitPrice = pageText.match(/Per-seat Price\s*\|?\s*((?:EUR\s*)?[€$]?[\d,.]+)/i)?.[1] || "";
      const product = pageText.match(/SKU\s*\|?\s*(Microsoft [^\n|]+)/i)?.[1]?.trim()
        || "Microsoft 365 Copilot";

      document.querySelectorAll("aside.fixed").forEach((panel) => panel.remove());
      openJourneyRecommendation();
      openCurrentProposalWorkspace?.({
        customer,
        opportunitySize,
        seatCount,
        unitPrice,
        product,
      });
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const detailsButton = event.target.closest("button");
      if (detailsButton?.textContent.trim() !== "View recommendation details") return;

      const recommendationCard = detailsButton.closest(".bg-white");
      if (isPaul) {
        if (!recommendationCard?.textContent.includes("Copilot Monetization")) return;
        event.preventDefault();
        event.stopPropagation();
        openJourneyRecommendation("customers");
        return;
      }
      if (!recommendationCard?.textContent.includes("Journey Innovations")) return;
      const journeyButtons = [...document.querySelectorAll("button")].filter(
        (button) => button.textContent.trim() === "View recommendation details"
          && button.closest(".bg-white")?.textContent.includes("Journey Innovations"),
      );
      if (journeyButtons[0] !== detailsButton) return;

      event.preventDefault();
      event.stopPropagation();
      openJourneyRecommendation();
    },
    true,
  );
})();
