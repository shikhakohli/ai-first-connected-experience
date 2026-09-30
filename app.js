const personaButton = document.getElementById("personaButton");
const personaMenu = document.getElementById("personaMenu");
const goalModal = document.getElementById("goalModal");
const goalCard = document.getElementById("goalCard");
const toast = document.getElementById("toast");
const selectedPersona = new URLSearchParams(window.location.search).get("persona")?.toLowerCase();
const journeyProposalKey = "fabrikam-journey-innovations-proposal";
if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
  [
    "fabrikam-published-goals",
    "fabrikam-inherited-goal-choice",
    "fabrikam-eric-personal-goal",
    "journey-innovations-goal-choice",
    "apex-partners-goal-choice",
    "fabrikam-journey-innovations-proposal",
    "journey-innovations-customer-proposals",
    "apex-partners-customer-proposals",
    "journey-innovations-transaction-signal",
  ].forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("show-fabrikam-inherited-goal");
}
window.selectedGoalKeys = window.selectedGoalKeys || new Set();

function showEricCascadedGoal() {
  const banner = document.getElementById("ericCascadedGoal");
  if (!banner) return;
  let plan;
  try {
    plan = JSON.parse(localStorage.getItem("fabrikam-published-goals") || "null");
  } catch {
    localStorage.removeItem("fabrikam-published-goals");
    return;
  }
  if (!plan?.goals?.length) return;

  document.getElementById("ericCascadedGoalName").textContent =
    plan.goals.length === 1
      ? plan.goals[0]
      : `${plan.goals[0]} and ${plan.goals.length - 1} more`;
  document.getElementById("ericCascadedGoalRoles").textContent =
    `Cascaded to ${plan.roles?.length ? plan.roles.join(" · ") : "Fabrikam role owners"}`;
  banner.hidden = false;
}

showEricCascadedGoal();

function applyHomePersona() {
  if (!personaButton || selectedPersona !== "jane") return;
  let proposal = null;
  try {
    proposal = JSON.parse(localStorage.getItem(journeyProposalKey) || "null");
  } catch {
    localStorage.removeItem(journeyProposalKey);
  }

  document.title = "Partner Center | Journey Innovations";
  personaButton.textContent = "K";
  personaButton.classList.add("jane-avatar");
  document.getElementById("currentPersonaName").textContent = "Karin";
  document.getElementById("currentPersonaRole").textContent =
    "Growth lead · Journey Innovations";
  document.getElementById("switchToEric").hidden = false;
  document.getElementById("switchToJane").hidden = true;

  document.getElementById("welcomeTitle").textContent = "Hi, Karin";
  document.getElementById("welcomeSubtitle").textContent =
    "Start with the opportunities that can accelerate Journey Innovations' growth.";
  document.getElementById("organizationLogo").textContent = "JI";
  document.getElementById("organizationName").textContent = "Journey Innovations";
  document.getElementById("organizationRole").textContent = "Reseller organization";
  document.getElementById("customerNavLink").href =
    "./alliance-manager/current-113.html?persona=jane&view=customer";

  document.getElementById("priorityTitle").textContent =
    "Turn new partner opportunities into growth";
  document.getElementById("priorityDescription").textContent =
    "Review proposals from your partner network and decide where Journey Innovations should engage next.";
  document.querySelector("#priorityBriefing .step").textContent = "1 new";

  document.getElementById("growCount").textContent = "3";
  document.getElementById("growDescription").textContent =
    "Review partner proposals and pursue new opportunities";
  document.querySelectorAll(".eric-grow-card").forEach((card) => {
    card.hidden = true;
  });
  const proposalCard = document.getElementById("janeProposalCard");
  proposalCard.hidden = false;
  if (proposal) {
    proposalCard.querySelector(".card-meta").textContent =
      `${proposal.status || "NEW"} · FROM ${proposal.sender || "FABRIKAM"}`;
    proposalCard.querySelector("h3").textContent =
      `${proposal.sender || "Fabrikam"} created a proposal for you`;
    proposalCard.querySelector(".card-detail").lastChild.textContent =
      ` ${proposal.opportunity || "New customer growth opportunity"}`;
  }
  document.querySelectorAll(".jane-grow-card").forEach((card) => {
    card.hidden = false;
  });
  document.getElementById("ericCascadedGoal").hidden = true;
}

applyHomePersona();

function addHomeDismissControls() {
  const persona = selectedPersona || "eric";
  const storageKey = `dismissed-home-cards-${persona}`;
  let dismissedCards = new Set();
  try {
    dismissedCards = new Set(JSON.parse(sessionStorage.getItem(storageKey) || "[]"));
  } catch {
    sessionStorage.removeItem(storageKey);
  }

  document.querySelectorAll(".panel").forEach((panel) => {
    const sectionName = panel.querySelector(".panel-heading h2")?.textContent.trim();
    if (!["Grow", "Manage"].includes(sectionName)) return;

    const cards = [...panel.children].filter((child) =>
      child.matches("article.action-card, article.goal-card, article.manage-item"));
    const updateCount = () => {
      const count = panel.querySelector(".panel-heading .count");
      if (count) count.textContent = String(cards.filter((card) => !card.hidden).length);
    };

    cards.forEach((card, index) => {
      const title = card.querySelector("h3")?.textContent.trim() || `${sectionName}-${index}`;
      const cardKey = `${sectionName}:${title}`;
      if (dismissedCards.has(cardKey)) card.hidden = true;
      if (card.querySelector(".card-dismiss")) return;

      const dismiss = document.createElement("button");
      dismiss.className = "card-dismiss";
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
}

addHomeDismissControls();

document.getElementById("customerNavLink")?.addEventListener("click", (event) => {
  if (selectedPersona !== "jane") return;
  event.preventDefault();
  window.location.assign(
    "./alliance-manager/current-113.html?persona=jane&view=customer",
  );
});

const ericGoalBanner = document.getElementById("ericCascadedGoal");
const ericGoalEditor = document.getElementById("ericGoalEditor");
const ericGoalInput = document.getElementById("ericGoalInput");
document.getElementById("editEricGoal")?.addEventListener("click", () => {
  window.location.href = "./goals.html?edit=1";
});
document.getElementById("cancelEricGoal")?.addEventListener("click", () => {
  ericGoalEditor.hidden = true;
});
document.getElementById("saveEricGoal")?.addEventListener("click", () => {
  const goal = ericGoalInput.value.trim();
  if (!goal) return;
  const plan = JSON.parse(localStorage.getItem("fabrikam-published-goals") || "{}");
  plan.goals = [goal];
  localStorage.setItem("fabrikam-published-goals", JSON.stringify(plan));
  document.getElementById("ericCascadedGoalName").textContent = goal;
  ericGoalEditor.hidden = true;
});
document.getElementById("removeEricGoal")?.addEventListener("click", () => {
  localStorage.removeItem("fabrikam-published-goals");
  ericGoalBanner.hidden = true;
});

const goalMetrics = {
  cloud: {
    label: "Cloud & AI Platforms",
    metrics: [
      { name: "Partner Influenced ACR", value: "$3.18M", attainment: 108 },
      { name: "Partner Influenced ACR - Frontier Transformation", value: "$1.96M", attainment: 83 },
      { name: "CSP ACR", value: "$4.73M", attainment: 103 },
      { name: "Azure Gross Customer Adds", value: "766", attainment: 85 },
    ],
  },
  business: {
    label: "AI Business Solutions",
    metrics: [
      { name: "CSP Net Paid Seat Adds (NPSA) Copilot, SME&C", value: "6,610", attainment: 108 },
      { name: "CSP AI Business Processes Billed Revenue", value: "$1.49M", attainment: 100 },
      { name: "CSP AI Workforce Billed Revenue", value: "$1.26M", attainment: 101 },
      { name: "CSP BizPremium NPSA (SME&C)", value: "2,340", attainment: 103 },
      { name: "CSP D365 NPSA (SME&C)", value: "2,080", attainment: 105 },
      { name: "Partner Influenced Copilot NPSA", value: "3,340", attainment: 101 },
      { name: "Partner Influenced BizApps Billed Revenue", value: "$1.15M", attainment: 101 },
      { name: "MBS CoSell", value: "$925.0K", attainment: 86 },
    ],
  },
  security: {
    label: "Security",
    metrics: [
      { name: "CSP Security Billed Revenue", value: "$1.31M", attainment: 102 },
      { name: "CSP Security Suite B-SKU NPSA", value: "1,710", attainment: 102 },
      { name: "Partner Influenced E5 Security Usage", value: "23,000", attainment: 101 },
      { name: "Partner Influenced Security ACR", value: "$1.67M", attainment: 93 },
    ],
  },
};

window.cascadeGoalTargets = window.cascadeGoalTargets || new Map();

function parseGoalMetricValue(value) {
  const compactValue = String(value).replace(/[$,\s]/g, "");
  const multiplier = compactValue.endsWith("M")
    ? 1_000_000
    : compactValue.endsWith("K")
      ? 1_000
      : 1;
  const numericValue = Number.parseFloat(compactValue.replace(/[MK]$/, ""));
  return Number.isFinite(numericValue) ? Math.round(numericValue * multiplier) : 0;
}

function formatGoalMetricTarget(metric, value) {
  const roundedValue = Math.max(0, Math.round(Number(value) || 0));
  if (metric.value.startsWith("$")) {
    if (roundedValue >= 1_000_000) return `$${(roundedValue / 1_000_000).toFixed(2)}M`;
    if (roundedValue >= 1_000) return `$${(roundedValue / 1_000).toFixed(1)}K`;
    return `$${roundedValue.toLocaleString()}`;
  }
  return roundedValue.toLocaleString();
}

function getGoalMetricDefinition(goalKey) {
  const [area, rawIndex] = goalKey.split(":");
  return goalMetrics[area]?.metrics?.[Number(rawIndex)] || null;
}

function getGoalTargetStep(value) {
  if (value >= 1_000_000) return 100_000;
  if (value >= 100_000) return 10_000;
  if (value >= 1_000) return 100;
  if (value >= 100) return 10;
  return 1;
}

window.getGoalMetricDefinition = getGoalMetricDefinition;
window.formatGoalMetricTarget = formatGoalMetricTarget;
window.getGoalTargetStep = getGoalTargetStep;

const requestedGoal = new URLSearchParams(window.location.search).get("goal");
if (document.body.classList.contains("goals-page") && requestedGoal === "cspNpsaCopilotSmec") {
  window.selectedGoalKeys.add("business:0");
}
if (
  document.body.classList.contains("goals-page")
  && new URLSearchParams(window.location.search).get("edit") === "1"
) {
  try {
    const publishedGoals = JSON.parse(
      localStorage.getItem("fabrikam-published-goals") || "null",
    )?.goals || [];
    Object.entries(goalMetrics).forEach(([area, solutionArea]) => {
      solutionArea.metrics.forEach((metric, index) => {
        if (publishedGoals.includes(metric.name)) {
          window.selectedGoalKeys.add(`${area}:${index}`);
        }
      });
    });
  } catch {
    localStorage.removeItem("fabrikam-published-goals");
  }
}

function showGoalMetrics(area) {
  const selection = goalMetrics[area];
  const grid = document.getElementById("goalMetricGrid");
  if (!grid || !selection) return;

  grid.innerHTML = selection.metrics
    .map((metric, index) => {
      const goalKey = `${area}:${index}`;
      const isGoalPicker = document.body.classList.contains("goals-page");
      if (window.selectedGoalKeys.has(goalKey) && !window.cascadeGoalTargets.has(goalKey)) {
        window.cascadeGoalTargets.set(goalKey, parseGoalMetricValue(metric.value));
      }
      const cardContent = `
        <div>
          <h4>${metric.name}</h4>
          <span class="goal-metric-status ${metric.attainment < 100 ? "watch" : ""}">
            ${metric.attainment}% projected
          </span>
        </div>
        <div class="goal-metric-value">
          <strong>${metric.value}</strong>
          <span>Attainment ${metric.attainment}%</span>
        </div>
        <div class="goal-metric-bar"><i style="width:${Math.min(metric.attainment, 100)}%"></i></div>
      `;

      if (!isGoalPicker) {
        return `<article class="goal-metric-card">${cardContent}</article>`;
      }

      return `
        <label class="goal-metric-card selectable ${window.selectedGoalKeys.has(goalKey) ? "selected" : ""}">
          <input
            class="goal-metric-checkbox"
            type="checkbox"
            data-goal-key="${goalKey}"
            data-goal-name="${metric.name}"
            ${window.selectedGoalKeys.has(goalKey) ? "checked" : ""}
          />
          <span class="goal-checkmark" aria-hidden="true">✓</span>
          ${cardContent}
        </label>
      `;
    })
    .join("");

  document.getElementById("goalMetricSummary").textContent = document.body.classList.contains("goals-page")
    ? `${window.selectedGoalKeys.size} selected · ${selection.metrics.length} available in ${selection.label}`
    : `${selection.metrics.length} metrics · ${selection.label}`;
  document.querySelectorAll("#goalMetricTabs button").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.area === area));
  });

  grid.querySelectorAll(".goal-metric-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        window.selectedGoalKeys.add(checkbox.dataset.goalKey);
        if (!window.cascadeGoalTargets.has(checkbox.dataset.goalKey)) {
          const selectedMetric = getGoalMetricDefinition(checkbox.dataset.goalKey);
          window.cascadeGoalTargets.set(
            checkbox.dataset.goalKey,
            parseGoalMetricValue(selectedMetric?.value || "0"),
          );
        }
      } else {
        window.selectedGoalKeys.delete(checkbox.dataset.goalKey);
      }
      checkbox.closest(".goal-metric-card").classList.toggle("selected", checkbox.checked);
      document.getElementById("goalMetricSummary").textContent =
        `${window.selectedGoalKeys.size} selected · ${selection.metrics.length} available in ${selection.label}`;
      document.dispatchEvent(new CustomEvent("goal-selection-change"));
    });
  });
}

document.querySelectorAll("#goalMetricTabs button").forEach((tab) => {
  tab.addEventListener("click", () => showGoalMetrics(tab.dataset.area));
});
showGoalMetrics("business");

const today = document.getElementById("today");
if (today) {
  today.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date()).toUpperCase();
}

personaButton.addEventListener("click", () => {
  const isOpen = !personaMenu.hidden;
  personaMenu.hidden = isOpen;
  personaButton.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".persona")) {
    personaMenu.hidden = true;
    personaButton.setAttribute("aria-expanded", "false");
  }
});

document.getElementById("switchToSarah").addEventListener("click", () => {
  window.location.href =
    `./alliance-manager/current-113.html?persona=sarah&view=home&fresh=${Date.now()}`;
});
document.getElementById("switchToEric")?.addEventListener("click", () => {
  window.location.href = "./";
});
document.getElementById("switchToJane")?.addEventListener("click", () => {
  window.location.href = "./?persona=jane";
});
document.getElementById("switchToPaul")?.addEventListener("click", () => {
  window.location.href =
    `./alliance-manager/current-113.html?persona=paul&view=home&fresh=${Date.now()}`;
});
document.getElementById("reviewProposal")?.addEventListener("click", () => {
  window.location.href =
    "./alliance-manager/current-113.html?persona=jane&view=customer&journey=received";
});
document.querySelectorAll(".jane-scenario-action").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("aiToastMessage").textContent =
      `Opening ${button.dataset.scenario} recommendations for Journey Innovations.`;
    document.getElementById("aiToast").hidden = false;
    window.setTimeout(() => {
      document.getElementById("aiToast").hidden = true;
    }, 4000);
  });
});

document.getElementById("setGoals")?.addEventListener("click", () => {
  window.location.href = "./goals.html";
});

function closeGoalModal() {
  if (goalModal) goalModal.hidden = true;
}

document.getElementById("closeGoals")?.addEventListener("click", closeGoalModal);
document.getElementById("cancelGoals")?.addEventListener("click", closeGoalModal);
goalModal?.addEventListener("click", (event) => {
  if (event.target === goalModal) closeGoalModal();
});

document.getElementById("publishGoals")?.addEventListener("click", () => {
  closeGoalModal();
  goalCard.classList.add("published");
  goalCard.querySelector(".goal-icon").textContent = "✓";
  goalCard.querySelector(".card-meta").textContent = "ORGANIZATION GOALS PUBLISHED";
  goalCard.querySelector("h3").textContent = "Fabrikam's FY27 ambition is shared";
  goalCard.querySelector("p").textContent =
    "Modern Work & Security +25% and Azure +35% are now available for every team to translate into aligned targets.";
  goalCard.querySelector("button").textContent = "View shared plan";
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 4500);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    personaMenu.hidden = true;
    closeGoalModal();
  }
});

const promptLibraryButton = document.getElementById("promptLibraryButton");
const promptLibraryMenu = document.getElementById("promptLibraryMenu");
const ericAiForm = document.getElementById("ericAiForm");
const ericAiInput = document.getElementById("ericAiInput");
const ericAiSend = document.getElementById("ericAiSend");

promptLibraryButton?.addEventListener("click", () => {
  promptLibraryMenu.hidden = !promptLibraryMenu.hidden;
  promptLibraryButton.setAttribute("aria-expanded", String(!promptLibraryMenu.hidden));
});

promptLibraryMenu?.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    ericAiInput.value = button.textContent.trim();
    ericAiSend.disabled = false;
    promptLibraryMenu.hidden = true;
    ericAiInput.focus();
  });
});

ericAiInput?.addEventListener("input", () => {
  ericAiSend.disabled = !ericAiInput.value.trim();
});

ericAiForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = ericAiInput.value.trim();
  if (!prompt) return;

  document.getElementById("aiToastMessage").textContent = `Working on: ${prompt}`;
  document.getElementById("aiToast").hidden = false;
  ericAiInput.value = "";
  ericAiSend.disabled = true;
  window.setTimeout(() => {
    document.getElementById("aiToast").hidden = true;
  }, 4000);
});
