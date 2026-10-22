const cascadeButton = document.getElementById("cascadeGoals");
const cascadeConfirmation = document.getElementById("cascadeConfirmation");
const selectedGoalCount = document.getElementById("selectedGoalCount");
const selectedGoalList = document.getElementById("selectedGoalList");
const cascadeAudience = document.getElementById("cascadeAudience");
const cascadeConfirmationText = document.getElementById("cascadeConfirmationText");
const cascadeRoleSummary = document.getElementById("cascadeRoleSummary");
const targetEditors = new Map();
let existingPlan = null;
try {
  existingPlan = JSON.parse(localStorage.getItem("fabrikam-published-goals") || "null");
} catch {
  localStorage.removeItem("fabrikam-published-goals");
}
if (new URLSearchParams(window.location.search).get("edit") === "1") {
  const existingRoles = existingPlan?.roles;
  if (Array.isArray(existingRoles)) {
    cascadeAudience.querySelectorAll("input").forEach((input) => {
      input.checked = existingRoles.includes(input.value);
    });
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
        const publishedTarget = existingPlan?.goalTargets?.find(
          (target) => target.key === key || target.name === metric.name,
        )?.value;
        window.cascadeGoalTargets.set(key, Math.max(
          parseGoalMetricValue(metric.value),
          Number.isFinite(publishedTarget) ? publishedTarget : 0,
          window.cascadeGoalTargets.get(key) || 0,
        ));
        selected.push({ key, name: metric.name, metric });
      }
    });
  });
  return selected;
}

function updateCascadeButton() {
  const roles = cascadeAudience.querySelectorAll("input:checked").length;
  const invalidTarget = selectedGoalList.querySelector("input:invalid");
  const goalCount = window.selectedGoalKeys.size;
  cascadeButton.disabled = goalCount === 0 || roles === 0 || Boolean(invalidTarget);
  cascadeButton.textContent = goalCount === 0
    ? "Select at least one goal"
    : roles === 0
      ? "Select at least one role"
      : invalidTarget
        ? "Targets can only increase"
        : `Publish and cascade ${goalCount} goal${goalCount === 1 ? "" : "s"}`;
}

function updateSelectedGoals() {
  const goals = getAllSelectedGoals();
  targetEditors.clear();
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
            <span>Source measure: ${metric.value}. Cascaded targets can only increase.</span>
          </div>
          <div class="cascade-target-editor">
            <span>Cascaded target</span>
            <div>
              <button type="button" disabled title="Cascaded targets cannot be reduced" aria-label="Decrease ${name} target">−</button>
              <input
                type="number"
                min="${target}"
                step="1"
                required
                value="${target}"
                aria-label="Cascaded target for ${name}"
              />
              <button type="button" data-target-delta="${step}" aria-label="Increase ${name} target">+</button>
            </div>
            <strong>${window.formatGoalMetricTarget(metric, target)}${unit}</strong>
            <span class="cascade-target-error" role="status" aria-live="polite" hidden></span>
          </div>
        </div>
      `;
    }).join("")
    : '<span class="empty-selection">Select a tile to add it to the plan</span>';
  selectedGoalList.querySelectorAll(".selected-goal-editor").forEach((editor) => {
    const input = editor.querySelector("input");
    const formattedTarget = editor.querySelector(".cascade-target-editor > strong");
    const error = editor.querySelector(".cascade-target-error");
    const { key, name, metric } = goals.find((goal) => goal.key === editor.dataset.goalKey);
    const unit = name.includes("NPSA") || name.includes("Seat Adds") ? " seats" : "";
    const validateTarget = () => {
      const minimum = window.cascadeGoalTargets.get(key);
      const target = input.valueAsNumber;
      const valid = Number.isSafeInteger(target) && target >= minimum;
      const message = `Enter a whole-number target of at least ${minimum.toLocaleString()}${unit}. Targets can only increase.`;
      input.setCustomValidity(valid ? "" : message);
      error.textContent = valid ? "" : message;
      error.hidden = valid;
      return valid;
    };
    const updateTarget = () => {
      if (!validateTarget()) {
        updateCascadeButton();
        return false;
      }
      const target = input.valueAsNumber;
      window.cascadeGoalTargets.set(key, target);
      input.min = target;
      formattedTarget.textContent = `${window.formatGoalMetricTarget(metric, target)}${unit}`;
      updateCascadeButton();
      return true;
    };
    targetEditors.set(key, updateTarget);
    input.addEventListener("input", () => {
      validateTarget();
      updateCascadeButton();
    });
    input.addEventListener("change", updateTarget);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") event.preventDefault();
    });
    editor.querySelectorAll("[data-target-delta]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = Math.max(window.cascadeGoalTargets.get(key), input.valueAsNumber || 0)
          + Number(button.dataset.targetDelta);
        updateTarget();
      });
    });
  });
  updateCascadeButton();
}

cascadeButton.addEventListener("click", () => {
  const selectedRoles = [...cascadeAudience.querySelectorAll("input:checked")].map((input) => input.value);
  if (!window.selectedGoalKeys.size || !selectedRoles.length) return;
  for (const updateTarget of targetEditors.values()) {
    if (!updateTarget()) return;
  }
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
