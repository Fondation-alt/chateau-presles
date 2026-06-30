const adminState = {
  content: null,
  currentId: null,
  language: "fr",
  pin: ""
};

const listNode = document.querySelector("#section-list");
const editorNode = document.querySelector("#editor");
const languageSelect = document.querySelector("#language-select");
const statusNode = document.querySelector("#status-line");
const mainNode = document.querySelector(".admin-shell");

startAdmin();

async function startAdmin() {
  adminState.content = normalizeAdminContent(await loadAdminContent());
  if (!checkPin("presles-admin-ok")) return;
  adminState.language = adminState.content.meta.defaultLanguage || "fr";
  adminState.currentId = adminState.content.sections[0]?.id || null;
  bindAdminActions();
  renderAdmin();
}

async function loadAdminContent() {
  let response = await fetch("/.netlify/functions/content", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) response = await fetch("content.json", { cache: "no-store" });
  if (response?.ok) return response.json();

  const stored = localStorage.getItem("presles-content");
  if (stored) return JSON.parse(stored);
  throw new Error("Contenu impossible à charger.");
}

function checkPin(storageKey) {
  if (sessionStorage.getItem(storageKey) === "true") return true;
  mainNode.innerHTML = `
    <section class="admin-intro">
      <p class="kicker">Administration</p>
      <h1>Code d'accès</h1>
      <p class="summary">Indiquez le code administrateur pour modifier le contenu.</p>
    </section>
    <form class="editor-panel" id="pin-form">
      <label>Code<input id="pin-input" type="password" autocomplete="current-password"></label>
      <button class="admin-button primary" type="submit">Entrer</button>
      <p class="status-line" id="pin-status"></p>
    </form>
  `;
  document.querySelector("#pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = document.querySelector("#pin-input").value;
    const access = await verifyPin("admin", pin);
    if (access.ok) {
      adminState.pin = pin;
      sessionStorage.setItem("presles-admin-pin", pin);
      sessionStorage.setItem(storageKey, "true");
      window.location.reload();
      return;
    }
    document.querySelector("#pin-status").textContent = access.message || "Le code indiqué n'est pas correct.";
  });
  return false;
}

function bindAdminActions() {
  adminState.pin = sessionStorage.getItem("presles-admin-pin") || adminState.pin;

  document.querySelector("#save-local").addEventListener("click", async () => {
    setStatus("Publication en cours...");
    const result = await publishContent("admin", adminState.pin, adminState.content);
    if (result.ok) {
      localStorage.removeItem("presles-content");
      setStatus("Publié en ligne. Netlify redéploie le site ; attendez 30 secondes à 2 minutes.");
      return;
    }
    localStorage.setItem("presles-content", JSON.stringify(adminState.content, null, 2));
    setStatus(result.message || "Publication impossible. Une copie locale a été gardée sur cet ordinateur.");
  });

  document.querySelector("#download-json").addEventListener("click", () => {
    downloadJson(adminState.content, "content.json");
    setStatus("Export prêt.");
  });

  document.querySelector("#import-json").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      adminState.content = normalizeAdminContent(JSON.parse(await file.text()));
    } catch {
      setStatus("Cette sauvegarde n'est pas un JSON valide.");
      return;
    }
    adminState.currentId = adminState.content.sections[0]?.id || null;
    adminState.language = adminState.content.meta.defaultLanguage || "fr";
    renderAdmin();
    setStatus("Fichier importé.");
  });

  document.querySelector("#add-language").addEventListener("click", () => {
    const code = prompt("Code de langue, par exemple en, es ou de");
    if (!code) return;
    const cleanCode = slugify(code).slice(0, 6);
    if (adminState.content.languages.some((language) => language.code === cleanCode)) {
      setStatus("Cette langue existe déjà.");
      return;
    }
    const label = prompt("Nom affiché de la langue") || cleanCode.toUpperCase();
    adminState.content.languages.push({ code: cleanCode, label });
    adminState.language = cleanCode;
    renderAdmin();
  });

  document.querySelector("#add-section").addEventListener("click", () => {
    const id = `rubrique-${Date.now()}`;
    adminState.content.sections.push({
      id,
      title: "Nouvelle rubrique",
      summary: "",
      image: "",
      icon: "info",
      media: { image: "", videos: [] },
      body: ["Texte à compléter."],
      cards: [],
      translations: {}
    });
    adminState.content.navigation[0].items.push(id);
    adminState.currentId = id;
    renderAdmin();
  });

  document.querySelector("#reset-local").addEventListener("click", async () => {
    if (!confirm("Recharger le contenu actuellement publié en ligne et oublier les changements non publiés sur cet ordinateur ?")) return;
    localStorage.removeItem("presles-content");
    let response = await fetch("/.netlify/functions/content", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) response = await fetch("content.json", { cache: "no-store" });
    adminState.content = normalizeAdminContent(await response.json());
    adminState.currentId = adminState.content.sections[0]?.id || null;
    adminState.language = adminState.content.meta.defaultLanguage || "fr";
    renderAdmin();
    setStatus("Contenu rechargé depuis le site en ligne.");
  });

  languageSelect.addEventListener("change", () => {
    adminState.language = languageSelect.value;
    renderAdmin();
  });
}

async function verifyPin(scope, pin) {
  const response = await fetch("/.netlify/functions/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, pin })
  }).catch(() => null);
  if (!response) return { ok: false, message: "Connexion au serveur impossible." };
  if (response.status === 404 && isLocalPreview()) {
    return {
      ok: false,
      message: "Vous êtes sur la version locale de l'ordinateur. Ouvrez https://chateau-presles.netlify.app/admin.html pour modifier le site en ligne."
    };
  }
  if (response?.ok) {
    const data = await response.json();
    return { ok: Boolean(data.ok), message: data.message };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: false, message: data.message || "Le code indiqué n'est pas correct." };
}

async function publishContent(scope, pin, content) {
  const size = new Blob([JSON.stringify(content)]).size;
  if (size > 4_500_000) {
    return {
      ok: false,
      message: "Le contenu est trop lourd pour être publié. Réduisez les photos ou utilisez des chemins comme images/photo.jpg."
    };
  }

  const response = await fetch("/.netlify/functions/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, pin, content })
  }).catch(() => null);
  if (!response) return { ok: false, message: "Connexion au serveur impossible." };
  const data = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true };

  if (response.status === 404 && isLocalPreview()) {
    return {
      ok: false,
      message: "Vous êtes sur la version locale de l'ordinateur. Pour publier le vrai site, ouvrez https://chateau-presles.netlify.app/admin.html."
    };
  }

  return { ok: false, message: data.message || `Publication refusée par le serveur (${response.status}).` };
}

function renderAdmin() {
  renderLanguageSelect();
  renderSectionList();
  renderEditor();
}

function renderLanguageSelect() {
  languageSelect.innerHTML = "";
  adminState.content.languages.forEach((language) => {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = language.label;
    option.selected = language.code === adminState.language;
    languageSelect.append(option);
  });
}

function renderSectionList() {
  listNode.innerHTML = "";
  listNode.append(sideButton("Accueil + entête", "home", adminState.currentId === "__home"));
  listNode.append(sideButton("Menu cuisine", "me", adminState.currentId === "__kitchen"));
  adminState.content.sections.forEach((section) => {
    const translated = getEditableSection(section);
    listNode.append(sideButton(translated.title || section.title, section.icon || "info", section.id === adminState.currentId, () => {
      adminState.currentId = section.id;
      renderAdmin();
    }));
  });
}

function sideButton(title, icon, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `section-tab${active ? " active" : ""}`;
  button.innerHTML = `<span class="section-tab-icon">${escapeHtml(icon).slice(0, 2)}</span><span>${escapeHtml(title)}</span>`;
  button.addEventListener("click", onClick || (() => {
    adminState.currentId = icon === "home" ? "__home" : "__kitchen";
    renderAdmin();
  }));
  return button;
}

function renderEditor() {
  editorNode.innerHTML = "";
  if (adminState.currentId === "__home") {
    renderHomeEditor();
    return;
  }
  if (adminState.currentId === "__kitchen") {
    renderKitchenEditor();
    return;
  }
  renderSectionEditor();
}

function renderHomeEditor() {
  const home = getEditableHome();
  const isDefaultLanguage = isDefault();
  editorNode.append(panel("Entête", [
    field("Titre", home.title || "", (value) => {
      home.title = value;
      if (isDefaultLanguage) {
        adminState.content.home.title = value;
        adminState.content.meta.title = value;
      }
    }),
    field("Sous-titre", home.subtitle || "", (value) => {
      home.subtitle = value;
      if (isDefaultLanguage) {
        adminState.content.home.subtitle = value;
        adminState.content.meta.subtitle = value;
      }
    }),
    area("Texte d'accueil", home.welcome || "", (value) => {
      home.welcome = value;
      if (isDefaultLanguage) adminState.content.home.welcome = value;
    }),
    field("Photo d'accueil", adminState.content.home.image || "", (value) => adminState.content.home.image = value),
    fileField("Importer une photo d'accueil", "image/*", async (file) => {
      adminState.content.home.image = await readFileAsDataUrl(file);
      renderEditor();
    })
  ]));

  editorNode.append(panel("Adresse et itinéraire", [
    field("Adresse copiée", adminState.content.location.address || "", (value) => adminState.content.location.address = value),
    field("Lien Google Maps / Apple Plans", adminState.content.location.mapsUrl || "", (value) => adminState.content.location.mapsUrl = value)
  ]));

  editorNode.append(panel("Contacts rapides de l'accueil", [
    contactsBarEditor()
  ]));

  editorNode.append(panel("Codes d'accès", [
    note("Les codes admin et cuisine se modifient dans Netlify, section Environment variables. Ils ne sont pas stockés dans le contenu public.")
  ]));
}

function renderKitchenEditor() {
  const kitchen = adminState.content.kitchen;
  editorNode.append(panel("Publication cuisine", [
    checkbox("Afficher la bulle menu sur le site", kitchen.active, (value) => kitchen.active = value),
    field("Titre", kitchen.title || "", (value) => kitchen.title = value),
    field("Date ou période", kitchen.date || "", (value) => kitchen.date = value),
    field("Texte du bouton", kitchen.cta || "", (value) => kitchen.cta = value),
    area("Menu du jour ou de la semaine", kitchen.text || "", (value) => kitchen.text = value),
    button("Publier uniquement le menu cuisine", "admin-button primary", async () => {
      setStatus("Publication du menu cuisine en cours...");
      const result = await publishContent("kitchen", adminState.pin, adminState.content);
      if (result.ok) {
        localStorage.removeItem("presles-content");
        setStatus("Menu cuisine publié en ligne. Netlify redéploie le site ; attendez 30 secondes à 2 minutes.");
        return;
      }
      localStorage.setItem("presles-content", JSON.stringify(adminState.content, null, 2));
      setStatus(result.message || "Publication du menu impossible. Une copie locale a été gardée sur cet ordinateur.");
    })
  ]));
}

function renderSectionEditor() {
  const section = currentSection();
  if (!section) return;
  const editable = getEditableSection(section);
  const isDefaultLanguage = isDefault();

  editorNode.append(panel("Texte", [
    field("Titre", editable.title || "", (value) => {
      editable.title = value;
      if (isDefaultLanguage) section.title = value;
      renderSectionList();
    }),
    field("Résumé court", editable.summary || "", (value) => {
      editable.summary = value;
      if (isDefaultLanguage) section.summary = value;
    }),
    area("Texte principal", (editable.body || []).join("\n\n"), (value) => {
      editable.body = lines(value);
      if (isDefaultLanguage) section.body = editable.body;
    })
  ]));

  editorNode.append(panel("Image principale de la page", [
    field("Chemin ou URL", section.media.image || "", (value) => {
      section.media.image = value;
      section.image = value;
      renderEditor();
    }),
    fileField("Importer une image", "image/*", async (file) => {
      section.media.image = await readFileAsDataUrl(file);
      section.image = section.media.image;
      renderEditor();
      setStatus("Image intégrée au contenu local.");
    }),
    mediaPreview(section.media.image, "image")
  ]));

  editorNode.append(panel("Navigation", [
    field("Pictogramme", section.icon || "info", (value) => {
      section.icon = slugify(value) || "info";
      renderSectionList();
    }),
    field("Identifiant technique", section.id, (value) => updateSectionId(section, value))
  ]));

  if (section.password !== undefined) {
    editorNode.append(panel("Information sensible", [
      field("Mot de passe", section.password, (value) => section.password = value)
    ]));
  }

  editorNode.append(panel("Cartes avec médias", [
    cardsEditor(section, editable, isDefaultLanguage)
  ]));

  if (section.contacts) editorNode.append(panel("Contacts", [contactsEditor(section.contacts)]));
  if (section.faq) editorNode.append(panel("Questions fréquentes", [faqEditor(section, editable, isDefaultLanguage)]));

  editorNode.append(panel("Zone de prudence", [
    button("Supprimer cette rubrique", "admin-button danger", () => {
      if (!confirm("Supprimer cette rubrique ?")) return;
      adminState.content.sections = adminState.content.sections.filter((item) => item.id !== section.id);
      adminState.content.navigation.forEach((group) => {
        group.items = group.items.filter((id) => id !== section.id);
      });
      adminState.currentId = adminState.content.sections[0]?.id || null;
      renderAdmin();
    })
  ]));
}

function cardsEditor(section, editable, isDefaultLanguage) {
  editable.cards = editable.cards || [];
  const wrap = document.createElement("div");
  wrap.className = "field-stack";
  editable.cards.forEach((card, index) => {
    card.media = card.media || { image: "", videos: [] };
    const item = document.createElement("div");
    item.className = "collection-item";
    item.append(field("Titre de carte", card.title || "", (value) => card.title = value));
    item.append(area("Lignes", (card.lines || []).join("\n"), (value) => card.lines = lines(value)));
    item.append(field("Photo de cette carte", card.media.image || "", (value) => {
      card.media.image = value;
      renderEditor();
    }));
    item.append(fileField("Importer une photo pour cette carte", "image/*", async (file) => {
      card.media.image = await readFileAsDataUrl(file);
      renderEditor();
    }));
    item.append(mediaPreview(card.media.image, "image"));
    item.append(cardVideosEditor(card));
    item.append(button("Supprimer la carte", "admin-button danger", () => {
      editable.cards.splice(index, 1);
      if (isDefaultLanguage) section.cards = editable.cards;
      renderEditor();
    }));
    wrap.append(item);
  });
  wrap.append(button("Ajouter une carte", "admin-button", () => {
    editable.cards.push({ title: "Nouvelle carte", lines: ["À compléter"], media: { image: "", videos: [] } });
    if (isDefaultLanguage) section.cards = editable.cards;
    renderEditor();
  }));
  return wrap;
}

function cardVideosEditor(card) {
  const wrap = document.createElement("div");
  wrap.className = "field-stack";
  card.media.videos = card.media.videos || [];
  card.media.videos.forEach((video, index) => {
    const item = document.createElement("div");
    item.className = "collection-item";
    item.append(field("Vidéo de cette carte", video.src || "", (value) => {
      video.src = value;
      renderEditor();
    }));
    item.append(field("Légende", video.caption || "", (value) => video.caption = value));
    item.append(mediaPreview(video.src, "video"));
    item.append(button("Supprimer la vidéo", "admin-button danger", () => {
      card.media.videos.splice(index, 1);
      renderEditor();
    }));
    wrap.append(item);
  });
  wrap.append(fileField("Importer une vidéo pour cette carte", "video/*", async (file) => {
    if (file.size > 2_000_000) {
      setStatus("Vidéo trop lourde pour être intégrée directement. Placez-la dans assets/ puis indiquez son chemin, par exemple assets/video.mp4.");
      return;
    }
    card.media.videos.push({ src: await readFileAsDataUrl(file), caption: file.name });
    renderEditor();
  }));
  wrap.append(button("Ajouter une vidéo par chemin", "admin-button", () => {
    card.media.videos.push({ src: "assets/video.mp4", caption: "" });
    renderEditor();
  }));
  return wrap;
}

function contactsBarEditor() {
  const wrap = document.createElement("div");
  wrap.className = "field-stack";
  adminState.content.contactBar.forEach((contact, index) => {
    const item = document.createElement("div");
    item.className = "collection-item";
    item.append(field("Libellé", contact.label || "", (value) => contact.label = value));
    item.append(field("Valeur affichée", contact.value || "", (value) => contact.value = value));
    item.append(field("Lien téléphone ou email", contact.href || "", (value) => contact.href = value));
    item.append(button("Supprimer", "admin-button danger", () => {
      adminState.content.contactBar.splice(index, 1);
      renderEditor();
    }));
    wrap.append(item);
  });
  wrap.append(button("Ajouter un contact rapide", "admin-button", () => {
    adminState.content.contactBar.push({ label: "Nouveau contact", value: "À compléter", href: "" });
    renderEditor();
  }));
  return wrap;
}

function contactsEditor(contacts) {
  const wrap = document.createElement("div");
  wrap.className = "field-stack";
  contacts.forEach((contact) => {
    const item = document.createElement("div");
    item.className = "collection-item";
    item.append(field("Libellé", contact.label || "", (value) => contact.label = value));
    item.append(field("Nom", contact.name || "", (value) => contact.name = value));
    item.append(field("Téléphone", contact.phone || "", (value) => contact.phone = value));
    item.append(field("Email", contact.email || "", (value) => contact.email = value));
    wrap.append(item);
  });
  return wrap;
}

function faqEditor(section, editable, isDefaultLanguage) {
  editable.faq = editable.faq || [];
  const wrap = document.createElement("div");
  wrap.className = "field-stack";
  editable.faq.forEach((item, index) => {
    const block = document.createElement("div");
    block.className = "collection-item";
    block.append(field("Question", item.question || "", (value) => item.question = value));
    block.append(area("Réponse", item.answer || "", (value) => item.answer = value));
    block.append(button("Supprimer la question", "admin-button danger", () => {
      editable.faq.splice(index, 1);
      if (isDefaultLanguage) section.faq = editable.faq;
      renderEditor();
    }));
    wrap.append(block);
  });
  wrap.append(button("Ajouter une question", "admin-button", () => {
    editable.faq.push({ question: "Nouvelle question", answer: "Réponse à compléter." });
    if (isDefaultLanguage) section.faq = editable.faq;
    renderEditor();
  }));
  return wrap;
}

function panel(title, children) {
  const section = document.createElement("section");
  section.className = "admin-panel";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  section.append(h2);
  const stack = document.createElement("div");
  stack.className = "field-stack";
  children.filter(Boolean).forEach((child) => stack.append(child));
  section.append(stack);
  return section;
}

function field(labelText, value, onInput) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  label.append(input);
  return label;
}

function area(labelText, value, onInput) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("textarea");
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  label.append(input);
  return label;
}

function checkbox(labelText, checked, onInput) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onInput(input.checked));
  label.append(input, document.createTextNode(labelText));
  return label;
}

function note(text) {
  const node = document.createElement("p");
  node.className = "admin-note";
  node.textContent = text;
  return node;
}

function fileField(labelText, accept, onFile) {
  const label = document.createElement("label");
  label.className = "admin-file";
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.hidden = true;
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) onFile(file);
  });
  label.append(input);
  return label;
}

function mediaPreview(src, type) {
  if (!src) {
    const note = document.createElement("p");
    note.className = "admin-note";
    note.textContent = "Aucun média renseigné.";
    return note;
  }
  const preview = document.createElement("div");
  preview.className = "media-preview";
  const media = document.createElement(type === "video" ? "video" : "img");
  media.src = src;
  if (type === "video") media.controls = true;
  preview.append(media);
  return preview;
}

function button(text, className, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  node.addEventListener("click", onClick);
  return node;
}

function getEditableHome() {
  if (isDefault()) return adminState.content.home;
  adminState.content.home.translations = adminState.content.home.translations || {};
  adminState.content.home.translations[adminState.language] = adminState.content.home.translations[adminState.language] || {
    title: "",
    subtitle: "",
    welcome: ""
  };
  return adminState.content.home.translations[adminState.language];
}

function getEditableSection(section) {
  if (isDefault()) return section;
  section.translations[adminState.language] = section.translations[adminState.language] || {
    title: "",
    summary: "",
    body: [],
    cards: [],
    faq: []
  };
  return section.translations[adminState.language];
}

function updateSectionId(section, value) {
  const nextId = slugify(value);
  if (!nextId || nextId === section.id) return;
  const previousId = section.id;
  section.id = nextId;
  adminState.content.navigation.forEach((group) => {
    group.items = group.items.map((id) => id === previousId ? nextId : id);
  });
  adminState.currentId = nextId;
  renderAdmin();
}

function currentSection() {
  return adminState.content.sections.find((section) => section.id === adminState.currentId);
}

function normalizeAdminContent(content) {
  content.meta = content.meta || {};
  content.meta.defaultLanguage = content.meta.defaultLanguage || content.meta.language || "fr";
  content.languages = content.languages?.length ? content.languages : [{ code: "fr", label: "Français" }];
  content.admin = content.admin || {};
  content.kitchen = content.kitchen || { active: true, title: "", date: "", text: "", cta: "Voir le menu" };
  content.location = content.location || { address: "", mapsUrl: "" };
  content.contactBar = content.contactBar || [];
  content.home = content.home || { title: "", subtitle: "", welcome: "", image: "", translations: {} };
  content.home.translations = content.home.translations || {};
  content.sections = (content.sections || []).map((section) => ({
    ...section,
    icon: section.icon || "info",
    media: section.media || { image: section.image || "", videos: [] },
    cards: (section.cards || []).map((card) => ({ ...card, media: card.media || { image: "", videos: [] } })),
    translations: section.translations || {}
  }));
  return content;
}

function isDefault() {
  return adminState.language === (adminState.content.meta.defaultLanguage || "fr");
}

function lines(value) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readFileAsDataUrl(file) {
  if (file.type.startsWith("image/")) {
    return resizeImage(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxSize = 1400;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image impossible à lire."));
    };
    img.src = url;
  });
}

function downloadJson(content, filename) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
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
  }, 12000);
}

function isLocalPreview() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
