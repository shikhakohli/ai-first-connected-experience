const cascadeButton = document.getElementById("cascadeGoals");
const cascadeConfirmation = document.getElementById("cascadeConfirmation");
const selectedGoalCount = document.getElementById("selectedGoalCount");
const selectedGoalList = document.getElementById("selectedGoalList");
const cascadeAudience = document.getElementById("cascadeAudience");
const cascadeConfirmationText = document.getElementById("cascadeConfirmationText");
const cascadeRoleSummary = document.getElementById("cascadeRoleSummary");
if (new URLSearchParams(window.location.search).get("edit") === "1") {
  try {
    const existingRoles = JSON.parse(
      localStorage.getItem("fabrikam-published-goals") || "null",
    )?.roles;
    if (Array.isArray(existingRoles)) {
      cascadeAudience.querySelectorAll("input").forEach((input) => {
        input.checked = existingRoles.includes(input.value);
      });
    }
  } catch {
    localStorage.removeItem("fabrikam-published-goals");
  }
}

function getSelectedGoals() {
  return [...document.querySelectorAll(".goal-metric-checkbox:checked")].map((checkbox) => ({
    key: checkbox.dataset.goalKey,
    name: checkbox.dataset.goalName,
  }));
}

function getAllSelectedGoals() {
  const selected = [];
  Object.entries(goalMetrics).forEach(([area, solutionArea]) => {
    solutionArea.metrics.forEach((metric, index) => {
      const key = `${area}:${index}`;
      if (window.selectedGoalKeys.has(key)) {
        selected.push({ key, name: metric.name, metric });
      }
    });
  });
  return selected;
}

function updateSelectedGoals() {
  const goals = getAllSelectedGoals();
  const roles = [...cascadeAudience.querySelectorAll("input:checked")].map((input) => input.value);
  selectedGoalCount.textContent = goals.length
    ? `${goals.length} organization goal${goals.length === 1 ? "" : "s"} selected`
    : "No goals selected";
  selectedGoalList.innerHTML = goals.length
    ? goals.map(({ key, name, metric }) => {
      const target = window.cascadeGoalTargets.get(key);
      const step = window.getGoalTargetStep(target);
      const unit = name.includes("NPSA") || name.includes("Seat Adds") ? " seats" : "";
      return `
        <div class="selected-goal-editor" data-goal-key="${key}">
          <div class="selected-goal-editor-copy">
            <strong>${name}</strong>
            <span>Source measure: ${metric.value}. Only the cascaded target changes.</span>
          </div>
          <div class="cascade-target-editor">
            <span>Cascaded target</span>
            <div>
              <button type="button" data-target-delta="-${step}" aria-label="Decrease ${name} target">−</button>
              <input
                type="number"
                min="0"
                step="${step}"
                value="${target}"
                aria-label="Cascaded target for ${name}"
              />
              <button type="button" data-target-delta="${step}" aria-label="Increase ${name} target">+</button>
            </div>
            <strong>${window.formatGoalMetricTarget(metric, target)}${unit}</strong>
          </div>
        </div>
      `;
    }).join("")
    : '<span class="empty-selection">Select a tile to add it to the plan</span>';
  selectedGoalList.querySelectorAll(".selected-goal-editor").forEach((editor) => {
    const input = editor.querySelector("input");
    const formattedTarget = editor.querySelector(".cascade-target-editor > strong");
    const { key, name, metric } = goals.find((goal) => goal.key === editor.dataset.goalKey);
    const unit = name.includes("NPSA") || name.includes("Seat Adds") ? " seats" : "";
    const updateTarget = (value) => {
      const target = Math.max(0, Math.round(Number(value) || 0));
      window.cascadeGoalTargets.set(key, target);
      input.value = target;
      formattedTarget.textContent = `${window.formatGoalMetricTarget(metric, target)}${unit}`;
    };
    input.addEventListener("input", () => updateTarget(input.value));
    editor.querySelectorAll("[data-target-delta]").forEach((button) => {
      button.addEventListener("click", () => {
        updateTarget(Number(input.value) + Number(button.dataset.targetDelta));
      });
    });
  });
  cascadeButton.disabled = goals.length === 0 || roles.length === 0;
  cascadeButton.textContent = goals.length === 0
    ? "Select at least one goal"
    : roles.length === 0
      ? "Select at least one role"
    : `Publish and cascade ${goals.length} goal${goals.length === 1 ? "" : "s"}`;
}

cascadeButton.addEventListener("click", () => {
  const selectedRoles = [...cascadeAudience.querySelectorAll("input:checked")].map((input) => input.value);
  if (!window.selectedGoalKeys.size || !selectedRoles.length) return;
  const selectedGoals = getAllSelectedGoals();
  const cascadedTargets = selectedGoals.map(({ key, name, metric }) => {
    const value = window.cascadeGoalTargets.get(key);
    return {
      key,
      name,
      value,
      formattedValue: window.formatGoalMetricTarget(metric, value),
      sourceValue: metric.value,
    };
  });
  cascadeButton.disabled = true;
  cascadeButton.textContent = "Cascading goals...";

  window.setTimeout(() => {
    localStorage.setItem("fabrikam-published-goals", JSON.stringify({
      goals: selectedGoals.map(({ name }) => name),
      goalTargets: cascadedTargets,
      roles: selectedRoles,
      publishedBy: "Eric",
      publishedAt: new Date().toISOString(),
    }));
    cascadeButton.textContent = "Goals published and cascaded";
    cascadeButton.classList.add("complete");
    cascadeConfirmationText.textContent =
      `The goals have been shared with ${selectedRoles.length} selected role${selectedRoles.length === 1 ? "" : "s"}. Each recipient can now translate the company ambition into a focused market or role target.`;
    cascadeRoleSummary.textContent = selectedRoles.join(" · ");
    cascadeConfirmation.hidden = false;
    cascadeConfirmation.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 650);
});

document.addEventListener("goal-selection-change", updateSelectedGoals);
cascadeAudience.addEventListener("change", updateSelectedGoals);
updateSelectedGoals();

if (new URLSearchParams(window.location.search).get("focus") === "cascade") {
  window.setTimeout(() => {
    document.querySelector(".cascade-plan")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 150);
}

document.querySelector(".goals-composer").addEventListener("submit", (event) => {
  event.preventDefault();
});
