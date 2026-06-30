let content;
let kitchenPin = "";

const form = document.querySelector("#kitchen-form");
const statusNode = document.querySelector("#status-line");

start();

async function start() {
  content = await loadContent();
  content.kitchen = content.kitchen || { pin: "cuisine2026", active: true, title: "", date: "", text: "", cta: "Voir le menu" };
  if (!checkPin()) return;
  fillForm();
  bind();
}

async function loadContent() {
  const stored = localStorage.getItem("presles-content");
  if (stored) return JSON.parse(stored);
  let response = await fetch("/.netlify/functions/content", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) response = await fetch("content.json", { cache: "no-store" });
  return response.json();
}

function checkPin() {
  if (sessionStorage.getItem("presles-cuisine-ok") === "true") return true;
  document.querySelector(".kitchen-admin").innerHTML = `
    <section class="admin-intro">
      <p class="kicker">Cuisine</p>
      <h1>Code d'accès</h1>
      <p class="summary">Indiquez le code cuisine pour publier un menu.</p>
    </section>
    <form class="kitchen-form" id="pin-form">
      <label>Code<input id="pin-input" type="password" autocomplete="current-password"></label>
      <button class="action-button primary" type="submit">Entrer</button>
      <p class="status-line" id="pin-status"></p>
    </form>
  `;
  document.querySelector("#pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = document.querySelector("#pin-input").value;
    if (await verifyPin("kitchen", pin, content.kitchen.pin)) {
      kitchenPin = pin;
      sessionStorage.setItem("presles-cuisine-pin", pin);
      sessionStorage.setItem("presles-cuisine-ok", "true");
      window.location.reload();
      return;
    }
    document.querySelector("#pin-status").textContent = "Le code indiqué n'est pas correct.";
  });
  return false;
}

function fillForm() {
  document.querySelector("#kitchen-active").checked = Boolean(content.kitchen.active);
  document.querySelector("#kitchen-title").value = content.kitchen.title || "";
  document.querySelector("#kitchen-date").value = content.kitchen.date || "";
  document.querySelector("#kitchen-cta").value = content.kitchen.cta || "";
  document.querySelector("#kitchen-text").value = content.kitchen.text || "";
}

function bind() {
  kitchenPin = sessionStorage.getItem("presles-cuisine-pin") || kitchenPin;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    readForm();
    setStatus("Publication en cours...");
    const result = await publishContent("kitchen", kitchenPin, content);
    if (result.ok) {
      localStorage.removeItem("presles-content");
      setStatus("Menu publié en ligne.");
      return;
    }
    localStorage.setItem("presles-content", JSON.stringify(content, null, 2));
    setStatus(result.message || "Publication impossible. Une copie locale a été gardée sur cet ordinateur.");
  });

  document.querySelector("#download-json").addEventListener("click", () => {
    readForm();
    downloadJson(content, "content.json");
    setStatus("Export prêt.");
  });
}

async function verifyPin(scope, pin, fallbackPin) {
  const response = await fetch("/.netlify/functions/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, pin })
  }).catch(() => null);
  if (response?.ok) {
    const data = await response.json();
    return Boolean(data.ok);
  }
  return pin === fallbackPin;
}

async function publishContent(scope, pin, value) {
  const response = await fetch("/.netlify/functions/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, pin, content: value })
  }).catch(() => null);
  if (!response) return { ok: false, message: "Connexion au serveur impossible." };
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok: true } : { ok: false, message: data.message };
}

function readForm() {
  content.kitchen.active = document.querySelector("#kitchen-active").checked;
  content.kitchen.title = document.querySelector("#kitchen-title").value;
  content.kitchen.date = document.querySelector("#kitchen-date").value;
  content.kitchen.cta = document.querySelector("#kitchen-cta").value;
  content.kitchen.text = document.querySelector("#kitchen-text").value;
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setStatus(message) {
  statusNode.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    statusNode.textContent = "";
  }, 4000);
}
