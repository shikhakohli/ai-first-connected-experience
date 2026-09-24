const screens = [
  {
    src: "./experiences/pem/web/screen-1.png",
    alt: "Partner Economics Modeler Frontier Accelerate screen",
  },
  {
    src: "./experiences/pem/web/screen-2.png",
    alt: "Partner Economics Modeler Cloud Solution Provider Azure screen",
  },
  {
    src: "./experiences/pem/web/screen-3.png",
    alt: "Partner Economics Modeler Cloud Solution Provider Modern Work and Security screen",
  },
  {
    src: "./experiences/pem/web/screen-4.png",
    alt: "Partner Economics Modeler Modern Work and Security detailed metrics screen",
  },
];

let currentScreen = 0;
const image = document.getElementById("pemImage");
const count = document.getElementById("screenCount");
const previous = document.getElementById("previousScreen");
const next = document.getElementById("nextScreen");
const tabs = [...document.querySelectorAll(".pem-toolbar button")];
const dots = [...document.querySelectorAll(".pem-dots i")];

function showScreen(index) {
  currentScreen = Math.max(0, Math.min(index, screens.length - 1));
  const screen = screens[currentScreen];
  image.src = screen.src;
  image.alt = screen.alt;
  count.textContent = `Screen ${currentScreen + 1} of ${screens.length}`;
  previous.disabled = currentScreen === 0;
  next.disabled = currentScreen === screens.length - 1;
  next.textContent = currentScreen === screens.length - 1 ? "End of model →" : "Next screen →";

  tabs.forEach((tab, index) => {
    tab.setAttribute("aria-selected", String(index === currentScreen));
  });
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentScreen);
  });

  document.querySelector(".pem-screen").scrollTo({ top: 0, behavior: "instant" });
  const url = new URL(window.location.href);
  url.searchParams.set("screen", String(currentScreen + 1));
  window.history.replaceState({}, "", url);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showScreen(Number(tab.dataset.screen) - 1));
});

previous.addEventListener("click", () => showScreen(currentScreen - 1));
next.addEventListener("click", () => {
  if (currentScreen < screens.length - 1) showScreen(currentScreen + 1);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showScreen(currentScreen - 1);
  if (event.key === "ArrowRight") showScreen(currentScreen + 1);
});

const initialScreen = Number(new URLSearchParams(window.location.search).get("screen")) || 1;
showScreen(initialScreen - 1);
