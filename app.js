const state = {
  content: null,
  currentId: null,
  query: "",
  language: localStorage.getItem("presles-language") || "fr"
};

const app = document.querySelector("#app");

init();

async function init() {
  try {
    const content = await loadContent();
    state.content = normalizeContent(content);
    if (!state.content.languages?.some((language) => language.code === state.language)) {
      state.language = state.content.meta.defaultLanguage || "fr";
    }
    document.title = state.content.meta.title;
    document.documentElement.lang = state.language;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }

    window.addEventListener("hashchange", route);
    route();
  } catch (error) {
    renderPublicError(error);
  }
}

async function loadContent() {
  let response = await fetch("/.netlify/functions/content", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) {
    response = await fetch("content.json", { cache: "no-store" });
  }
  if (!response.ok) {
    throw new Error("Impossible de charger le contenu.");
  }
  return response.json();
}

function route() {
  const id = decodeURIComponent(window.location.hash.replace("#", ""));
  const exists = state.content.sections.some((section) => section.id === id);
  state.currentId = exists ? id : null;
  render();
}

function render() {
  if (!state.content) return;
  app.innerHTML = "";
  app.append(createTopbar());

  if (state.currentId) {
    const section = getSection(state.currentId);
    app.append(createSectionPage(section));
  } else {
    app.append(createHome());
  }
}

function renderPublicError(error) {
  app.innerHTML = "";
  const main = el("main", "detail error-state");
  main.append(el("h1", "", {}, "Le contenu ne peut pas être affiché"));
  main.append(el("p", "summary", {}, "Le site n'est pas perdu. Le contenu publié semble incomplet ou mal formé. Ouvrez l'administration pour republier un contenu correct."));
  const actions = el("section", "action-row");
  actions.append(el("a", "action-button primary", { href: "admin.html" }, "Ouvrir l'administration"));
  actions.append(el("a", "action-button", { href: "content.json" }, "Voir le fichier de secours"));
  main.append(actions);
  main.append(el("p", "technical-note", {}, error?.message || "Erreur inconnue"));
  app.append(main);
}

function createTopbar() {
  const header = el("header", "topbar");
  const homeLink = el("a", "brand", { href: "#" });
  homeLink.append(el("span", "brand-title", {}, state.content.meta.title));
  homeLink.append(el("span", "brand-subtitle", {}, state.content.meta.subtitle));
  header.append(homeLink);
  const tools = el("div", "topbar-tools");

  if (state.content.languages?.length > 1) {
    const select = el("select", "language-select", { "aria-label": "Langue" });
    state.content.languages.forEach((language) => {
      const option = el("option", "", { value: language.code }, language.label);
      option.selected = language.code === state.language;
      select.append(option);
    });
    select.addEventListener("change", () => {
      state.language = select.value;
      localStorage.setItem("presles-language", state.language);
      document.documentElement.lang = state.language;
      render();
    });
    tools.append(select);
  }

  tools.append(el("a", "team-access", { href: "admin.html" }, "Équipe"));
  header.append(tools);
  return header;
}

function createHome() {
  const fragment = document.createDocumentFragment();
  const home = translateHome();
  const ui = translateUi();

  const hero = el("main", "home");
  const media = imageBlock(state.content.home.image, home.title, "hero-media");
  const intro = el("section", "hero-copy");
  intro.append(el("p", "kicker", {}, home.subtitle));
  intro.append(el("h1", "", {}, home.title));
  intro.append(paragraphs(home.welcome, "welcome-text"));

  const contactBar = el("div", "contact-bar");
  state.content.contactBar.forEach((contact) => {
    const item = el("a", "contact-pill", { href: contact.href || "#" });
    item.append(el("span", "", {}, contact.label));
    item.append(el("strong", "", {}, contact.value));
    contactBar.append(item);
  });

  intro.append(contactBar);
  hero.append(media, intro);
  fragment.append(hero);

  if (state.content.kitchen?.active) {
    fragment.append(createKitchenNotice());
  }

  const searchWrap = el("section", "search-area");
  const search = el("input", "search-input", {
    type: "search",
    placeholder: ui.searchPlaceholder,
    value: state.query,
    "aria-label": ui.searchPlaceholder
  });
  search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  searchWrap.append(search);
  fragment.append(searchWrap);

  const nav = el("nav", "section-groups");
  const visibleIds = new Set(searchSections(state.query).map((section) => section.id));

  state.content.navigation.forEach((group) => {
    const groupName = translateGroup(group);
    const groupItems = group.items
      .map((id) => getSection(id))
      .filter(Boolean)
      .filter((section) => visibleIds.has(section.id));

    if (!groupItems.length) return;

    const groupNode = el("section", "nav-group");
    groupNode.append(el("h2", "", {}, groupName));
    const list = el("div", "nav-list");

    groupItems.forEach((section) => {
      const translated = translateSection(section);
      const card = el("a", "nav-card", { href: `#${section.id}` });
      card.append(iconBlock(section.icon, translated.title));
      const text = el("span", "nav-card-text");
      text.append(el("strong", "", {}, translated.title));
      text.append(el("span", "", {}, translated.summary || ""));
      card.append(text);
      list.append(card);
    });

    groupNode.append(list);
    nav.append(groupNode);
  });

  fragment.append(nav);
  return fragment;
}

function createSectionPage(section) {
  const translated = translateSection(section);
  const ui = translateUi();
  const main = el("main", "detail");
  const back = el("a", "back-link", { href: "#" }, ui.backToHome);
  main.append(back);

  const header = el("section", "detail-header");
  header.append(imageBlock(getSectionImage(section), translated.title, "detail-media"));
  const titleWrap = el("div", "detail-title");
  titleWrap.append(el("p", "kicker", {}, findGroupName(section.id)));
  titleWrap.append(el("h1", "", {}, translated.title));
  if (translated.summary) titleWrap.append(el("p", "summary", {}, translated.summary));
  header.append(titleWrap);
  main.append(header);

  const body = el("section", "detail-body");
  (translated.body || []).forEach((text) => body.append(el("p", "", {}, text)));
  main.append(body);

  if (section.id === "venir" && state.content.location) {
    main.append(createLocationActions());
  }

  if (section.id === "restauration" && state.content.kitchen?.active) {
    main.append(createMenuBlock());
  }

  if (section.media?.videos?.length) main.append(createVideos(section.media.videos));
  if (section.password) main.append(createPasswordBlock(section.password));
  if (translated.cards?.length) main.append(createCards(translated.cards));
  if (section.people?.length) main.append(createPeople(section.people));
  if (translated.faq?.length) main.append(createFaq(translated.faq));
  if (section.contacts?.length) main.append(createContacts(section.contacts));

  return main;
}

function createPasswordBlock(password) {
  const block = el("section", "password-block");
  block.append(el("span", "", {}, password));
  const ui = translateUi();
  const button = el("button", "copy-button", { type: "button" }, ui.copyPassword);
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(password);
    button.textContent = ui.copied;
    setTimeout(() => {
      button.textContent = ui.copyPassword;
    }, 1600);
  });
  block.append(button);
  return block;
}

function createCards(cards) {
  const wrap = el("section", "info-grid");
  cards.forEach((card) => {
    const article = el("article", "info-card");
    if (card.media?.image) article.append(imageBlock(card.media.image, card.title, "card-media"));
    article.append(el("h2", "", {}, card.title));
    const list = el("ul");
    (card.lines || []).forEach((line) => list.append(el("li", "", {}, line)));
    article.append(list);
    if (card.media?.videos?.length) article.append(createVideos(card.media.videos, "card-video-list"));
    wrap.append(article);
  });
  return wrap;
}

function createPeople(people) {
  const wrap = el("section", "people-list");
  people.forEach((person) => {
    const item = el("article", "person-card");
    item.append(el("strong", "", {}, person.name));
    item.append(el("span", "", {}, person.role || ""));
    wrap.append(item);
  });
  return wrap;
}

function createFaq(items) {
  const wrap = el("section", "faq-list");
  items.forEach((item) => {
    const details = el("details", "faq-item");
    details.append(el("summary", "", {}, item.question));
    details.append(el("p", "", {}, item.answer));
    wrap.append(details);
  });
  return wrap;
}

function createContacts(items) {
  const wrap = el("section", "contacts-list");
  items.forEach((contact) => {
    const item = el("article", "contact-card");
    item.append(el("span", "contact-label", {}, contact.label));
    item.append(el("strong", "", {}, contact.name));
    if (contact.phone) item.append(el("a", "", { href: `tel:${contact.phone.replace(/\s/g, "")}` }, contact.phone));
    if (contact.email) item.append(el("a", "", { href: `mailto:${contact.email}` }, contact.email));
    wrap.append(item);
  });
  return wrap;
}

function createVideos(videos, className = "video-list") {
  const wrap = el("section", className);
  videos.filter((video) => video.src).forEach((video) => {
    const figure = el("figure", "video-card");
    const player = el("video", "", {
      src: video.src,
      controls: "",
      preload: "metadata",
      playsinline: ""
    });
    figure.append(player);
    if (video.caption) figure.append(el("figcaption", "", {}, video.caption));
    wrap.append(figure);
  });
  return wrap;
}

function createKitchenNotice() {
  const kitchen = state.content.kitchen;
  const notice = el("a", "kitchen-notice", { href: "#restauration" });
  notice.append(el("span", "", {}, kitchen.cta || "Voir le menu"));
  notice.append(el("strong", "", {}, kitchen.title || "Menu"));
  if (kitchen.date) notice.append(el("small", "", {}, kitchen.date));
  return notice;
}

function createMenuBlock() {
  const kitchen = state.content.kitchen;
  const section = el("section", "menu-block");
  section.append(el("p", "kicker", {}, kitchen.date || ""));
  section.append(el("h2", "", {}, kitchen.title || "Menu"));
  section.append(paragraphs(kitchen.text || "", "menu-text"));
  return section;
}

function createLocationActions() {
  const ui = translateUi();
  const location = state.content.location;
  const block = el("section", "action-row");
  const maps = el("a", "action-button primary", {
    href: location.mapsUrl,
    target: "_blank",
    rel: "noopener"
  }, ui.openMaps);
  const copy = el("button", "action-button", { type: "button" }, ui.copyAddress);
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(location.address);
    copy.textContent = ui.addressCopied;
    setTimeout(() => {
      copy.textContent = ui.copyAddress;
    }, 1600);
  });
  block.append(maps, copy);
  return block;
}

function iconBlock(icon, label) {
  const span = el("span", "nav-icon", { "aria-hidden": "true" });
  span.innerHTML = iconSvg(icon || "info");
  span.setAttribute("title", label);
  return span;
}

function imageBlock(src, alt, className) {
  const figure = el("figure", className);
  if (!src) {
    figure.classList.add("missing-image");
    return figure;
  }
  const img = el("img", "", {
    src,
    alt,
    loading: "lazy"
  });
  img.addEventListener("error", () => {
    figure.classList.add("missing-image");
    img.remove();
  }, { once: true });
  figure.append(img);
  return figure;
}

function paragraphs(text, className) {
  const wrap = el("div", className);
  text.split(/\n+/).filter(Boolean).forEach((line) => {
    wrap.append(el("p", "", {}, line.trim()));
  });
  return wrap;
}

function searchSections(query) {
  const normalized = normalize(query);
  if (!normalized) return state.content.sections;
  return state.content.sections.filter((section) => {
    const haystack = normalize(JSON.stringify(section));
    return haystack.includes(normalized);
  });
}

function translateUi() {
  return {
    ...state.content.ui,
    ...(state.content.ui.translations?.[state.language] || {})
  };
}

function translateHome() {
  return {
    ...state.content.home,
    ...(state.content.home.translations?.[state.language] || {})
  };
}

function getSection(id) {
  return state.content.sections.find((section) => section.id === id);
}

function findGroupName(id) {
  const group = state.content.navigation.find((entry) => entry.items.includes(id));
  return group ? translateGroup(group) : "";
}

function translateGroup(group) {
  return group.translations?.[state.language]?.group || group.group;
}

function translateSection(section) {
  const translated = section.translations?.[state.language] || {};
  const cards = translated.cards
    ? translated.cards.map((card, index) => ({
        ...(section.cards?.[index] || {}),
        ...card,
        media: section.cards?.[index]?.media || card.media || { image: "", videos: [] }
      }))
    : section.cards;
  return {
    ...section,
    ...translated,
    cards,
    faq: translated.faq || section.faq,
    body: translated.body || section.body
  };
}

function getSectionImage(section) {
  return section.media?.image || section.image || "";
}

function normalizeContent(content) {
  if (!content || typeof content !== "object") {
    throw new Error("Le contenu chargé n'est pas un objet JSON valide.");
  }
  content.meta = content.meta || {};
  content.meta.title = content.meta.title || content.home?.title || "Château de Presles";
  content.meta.subtitle = content.meta.subtitle || content.home?.subtitle || "Résidence artistique de la MNA Taylor";
  content.meta.defaultLanguage = content.meta.defaultLanguage || content.meta.language || "fr";
  content.languages = content.languages?.length ? content.languages : [{ code: "fr", label: "Français" }];
  content.ui = {
    searchPlaceholder: "Rechercher une information",
    backToHome: "Accueil",
    copyPassword: "Copier le mot de passe",
    copied: "Mot de passe copié",
    openMaps: "Ouvrir dans Maps",
    copyAddress: "Copier l’adresse",
    addressCopied: "Adresse copiée",
    ...(content.ui || {})
  };
  content.home = content.home || { title: content.meta.title, subtitle: content.meta.subtitle, welcome: "", image: "", translations: {} };
  content.contactBar = content.contactBar || [];
  content.navigation = content.navigation || [{ group: "Informations", items: [] }];
  content.location = content.location || { address: "", mapsUrl: "" };
  content.kitchen = content.kitchen || { active: false, title: "", date: "", text: "", cta: "Voir le menu" };
  content.sections = (content.sections || []).map((section) => ({
    ...section,
    icon: section.icon || "info",
    media: section.media || { image: section.image || "", videos: [] },
    cards: (section.cards || []).map((card) => ({ ...card, media: card.media || { image: "", videos: [] } })),
    translations: section.translations || {}
  }));
  return content;
}

function iconSvg(name) {
  const common = 'viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    route: '<path d="M12 38c9 0 9-28 24-28"/><path d="M36 10v10H26"/>',
    parking: '<path d="M16 38V10h12a8 8 0 0 1 0 16H16"/><path d="M16 26h12"/>',
    keybox: '<rect x="14" y="12" width="20" height="28" rx="3"/><path d="M19 19h10"/><circle cx="24" cy="29" r="3"/>',
    map: '<path d="M10 14l10-4 10 4 8-4v24l-8 4-10-4-10 4V14z"/><path d="M20 10v24M30 14v24"/>',
    key: '<circle cx="17" cy="24" r="6"/><path d="M23 24h15M34 24v5M29 24v4"/>',
    wifi: '<path d="M10 20c8-7 20-7 28 0"/><path d="M16 27c5-4 11-4 16 0"/><path d="M22 34c1.5-1 2.5-1 4 0"/>',
    meal: '<path d="M16 10v28"/><path d="M12 10v10a4 4 0 0 0 8 0V10"/><path d="M32 10v28"/><path d="M32 10c5 4 5 12 0 16"/>',
    drink: '<path d="M15 10h18l-3 28H18L15 10z"/><path d="M17 18h14"/>',
    coffee: '<path d="M14 18h18v9a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-9z"/><path d="M32 21h2a4 4 0 0 1 0 8h-2"/><path d="M18 10v3M24 10v3M30 10v3"/>',
    recycle: '<path d="M21 10l4 7h-8l4-7z"/><path d="M32 18l-4 7-4-7h8z"/><path d="M16 28h8l-4 7-4-7z"/><path d="M18 17l-6 11M30 25l-6 10M25 17h10"/>',
    sparkle: '<path d="M24 8l3 10 10 3-10 3-3 10-3-10-10-3 10-3 3-10z"/><path d="M37 32l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4z"/>',
    fitness: '<path d="M8 24h32"/><path d="M12 18v12M36 18v12M18 15v18M30 15v18"/>',
    pool: '<path d="M10 30c4-3 8-3 12 0s8 3 12 0 4-3 4-3"/><path d="M10 38c4-3 8-3 12 0s8 3 12 0 4-3 4-3"/><path d="M18 22V10h10v12"/>',
    water: '<path d="M24 8s10 11 10 20a10 10 0 0 1-20 0C14 19 24 8 24 8z"/>',
    bike: '<circle cx="15" cy="32" r="6"/><circle cx="34" cy="32" r="6"/><path d="M15 32l8-12h6l5 12M23 20l5 12H15M27 14h6"/>',
    hand: '<path d="M14 27V15a3 3 0 0 1 6 0v10"/><path d="M20 25V12a3 3 0 0 1 6 0v13"/><path d="M26 25V15a3 3 0 0 1 6 0v14"/><path d="M32 29v-7a3 3 0 0 1 6 0v10c0 7-5 10-12 10h-3c-5 0-9-4-9-9v-6"/>',
    flame: '<path d="M25 42c7-3 11-8 11-15 0-8-7-12-9-20-6 5-3 12-10 17-4 3-5 10 0 15 2 2 5 3 8 3z"/><path d="M24 35c3-1 5-4 5-7 0-4-3-6-4-10-4 4-8 9-5 14 1 2 2 3 4 3z"/>',
    basket: '<path d="M12 22h24l-3 16H15l-3-16z"/><path d="M18 22l6-12 6 12"/><path d="M18 29h12"/>',
    team: '<circle cx="18" cy="18" r="5"/><circle cx="32" cy="20" r="4"/><path d="M8 38c2-7 17-7 20 0"/><path d="M27 36c3-4 10-4 13 0"/>',
    question: '<circle cx="24" cy="24" r="17"/><path d="M19 19a5 5 0 0 1 10 1c0 5-5 4-5 9"/><path d="M24 35h.01"/>',
    phone: '<path d="M16 10l6 6-4 5c3 6 7 9 13 13l5-4 6 6-3 5c-1 2-3 2-5 1-14-5-23-14-28-28-1-2 0-4 1-5l5-3z"/>',
    info: '<circle cx="24" cy="24" r="17"/><path d="M24 22v11M24 15h.01"/>'
  };
  return `<svg ${common} aria-hidden="true">${icons[name] || icons.info}</svg>`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function el(tag, className = "", attrs = {}, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) node.setAttribute(key, value);
  });
  if (text) node.textContent = text;
  return node;
}
