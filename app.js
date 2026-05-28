const baseRecipes = [
  {
    id: "gruene-pasta-zitrone",
    title: "Gruene Pasta mit Zitrone",
    category: "Schnell",
    time: 22,
    ingredients: ["Pasta", "Spinat", "Zitrone", "Parmesan"],
    steps: "Pasta kochen. Spinat mit Zitronensaft und etwas Pastawasser kurz cremig mixen. Alles mit Parmesan vermengen und abschmecken.",
    note: "Frisch, cremig und gut fuer volle Wochentage."
  },
  {
    id: "ofengemuese-feta",
    title: "Ofengemuese mit Feta",
    category: "Vegetarisch",
    time: 40,
    ingredients: ["Suesskartoffel", "Paprika", "Feta", "Kichererbsen"],
    steps: "Gemuese grob schneiden und mit Oel, Salz und Gewuerzen mischen. Auf einem Blech backen, Feta am Ende darueber broeseln.",
    note: "Ein Blech, wenig Abwasch, viel Farbe."
  },
  {
    id: "tomatenreis-fuer-alle",
    title: "Tomatenreis fuer alle",
    category: "Familie",
    time: 35,
    ingredients: ["Reis", "Tomaten", "Erbsen", "Kraeuter"],
    steps: "Reis mit Tomaten und Bruehe garen. Erbsen kurz vor Ende zugeben. Mit frischen Kraeutern und etwas Oel servieren.",
    note: "Mild, saettigend und gut vorzubereiten."
  },
  {
    id: "couscous-box",
    title: "Couscous-Box",
    category: "Meal Prep",
    time: 18,
    ingredients: ["Couscous", "Gurke", "Tomate", "Joghurt"],
    steps: "Couscous quellen lassen. Gemuese wuerfeln. Joghurt mit Salz, Zitrone und Kraeutern verruehren. Alles in Boxen schichten.",
    note: "Kalt genauso stark wie warm."
  },
  {
    id: "pilzpfanne-kartoffeln",
    title: "Pilzpfanne mit Kartoffeln",
    category: "Vegetarisch",
    time: 45,
    ingredients: ["Kartoffeln", "Champignons", "Zwiebeln", "Petersilie"],
    steps: "Kartoffeln vorkochen und anbraten. Pilze und Zwiebeln separat kraeftig roesten. Zusammenfuehren und mit Petersilie abschliessen.",
    note: "Rustikal, herzhaft und unkompliziert."
  },
  {
    id: "schnelle-linsensuppe",
    title: "Schnelle Linsensuppe",
    category: "Schnell",
    time: 28,
    ingredients: ["Rote Linsen", "Karotte", "Kokosmilch", "Curry"],
    steps: "Karotte anschwitzen, Linsen und Curry zugeben. Mit Bruehe garen, Kokosmilch einruehren und cremig abschmecken.",
    note: "Waermend und in einem Topf fertig."
  }
];

const storageKey = "kuechenkompass-recipes";
const sessionKey = "kuechenkompass-current-user";
const windowStoragePrefix = "kuechenkompass:";
const dbName = "kuechenkompass";
const dbVersion = 2;
const recipeStoreName = "recipes";
const userStoreName = "users";
let recipeDbPromise;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "rezept")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "rezept";
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function splitLines(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getCurrentUserId() {
  try {
    return window.localStorage.getItem(sessionKey) || "";
  } catch {
    return "";
  }
}

function setCurrentUserId(userId) {
  try {
    if (userId) {
      window.localStorage.setItem(sessionKey, userId);
    } else {
      window.localStorage.removeItem(sessionKey);
    }
  } catch {
  }
}

async function passwordHash(password) {
  if (window.crypto && window.crypto.subtle) {
    const encoded = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `plain:${password}`;
}

function fallbackRecipes() {
  try {
    if (window.localStorage) {
      return JSON.parse(window.localStorage.getItem(storageKey)) || [];
    }
  } catch {
  }

  try {
    if (window.name.startsWith(windowStoragePrefix)) {
      return JSON.parse(window.name.slice(windowStoragePrefix.length)) || [];
    }
  } catch {
  }

  return [];
}

function saveFallbackRecipes(recipes) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(recipes));
      return;
    }
  } catch {
  }

  window.name = `${windowStoragePrefix}${JSON.stringify(recipes)}`;
}

function openRecipeDb() {
  if (recipeDbPromise) return recipeDbPromise;

  recipeDbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB ist in diesem Browser nicht verfuegbar."));
      return;
    }

    const request = window.indexedDB.open(dbName, dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction;
      if (!db.objectStoreNames.contains(recipeStoreName)) {
        const store = db.createObjectStore(recipeStoreName, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("userId", "userId");
      } else {
        const store = transaction.objectStore(recipeStoreName);
        if (!store.indexNames.contains("createdAt")) store.createIndex("createdAt", "createdAt");
        if (!store.indexNames.contains("userId")) store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains(userStoreName)) {
        const store = db.createObjectStore(userStoreName, { keyPath: "id" });
        store.createIndex("email", "email", { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return recipeDbPromise;
}

async function withRecipeStore(mode, callback) {
  const db = await openRecipeDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(recipeStoreName, mode);
    const store = transaction.objectStore(recipeStoreName);
    const result = callback(store);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function withUserStore(mode, callback) {
  const db = await openRecipeDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(userStoreName, mode);
    const store = transaction.objectStore(userStoreName);
    const result = callback(store);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function migrateFallbackRecipes() {
  const recipes = fallbackRecipes().map(normalizeSavedRecipe);
  if (!recipes.length) return;

  await withRecipeStore("readwrite", (store) => {
    recipes.forEach((recipe, index) => {
      store.put({
        ...recipe,
        createdAt: recipe.createdAt || Date.now() - index
      });
    });
  });
  saveFallbackRecipes([]);
}

async function getSavedRecipes() {
  try {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return [];

    await migrateFallbackRecipes();
    const recipes = await withRecipeStore("readonly", (store) => requestToPromise(store.getAll()));
    return recipes
      .map(normalizeSavedRecipe)
      .filter((recipe) => recipe.userId === currentUserId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return getCurrentUserId() ? fallbackRecipes().map(normalizeSavedRecipe) : [];
  }
}

async function addSavedRecipe(recipe) {
  try {
    await withRecipeStore("readwrite", (store) => store.put(recipe));
  } catch {
    const recipes = [recipe, ...fallbackRecipes()];
    saveFallbackRecipes(recipes);
  }
}

async function assignLegacyRecipesToUser(userId) {
  const recipes = fallbackRecipes().map((recipe, index) => ({
    ...normalizeSavedRecipe(recipe, index),
    userId
  }));
  if (!recipes.length) return;

  await withRecipeStore("readwrite", (store) => {
    recipes.forEach((recipe) => store.put(recipe));
  });
  saveFallbackRecipes([]);
}

function normalizeSavedRecipe(recipe, index) {
  return {
    ...recipe,
    id: recipe.id || `eigenes-${index}-${slugify(recipe.title)}`,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : splitLines(recipe.ingredients),
    time: toNumber(recipe.time, 0),
    servings: toNumber(recipe.servings, 0),
    prepTime: toNumber(recipe.prepTime, 0),
    cookTime: toNumber(recipe.cookTime, 0),
    difficulty: recipe.difficulty || "Einfach",
    image: recipe.image || "",
    userId: recipe.userId || getCurrentUserId()
  };
}

async function createUser(name, email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const existing = await withUserStore("readonly", (store) => requestToPromise(store.index("email").get(cleanEmail)));
  if (existing) throw new Error("Diese E-Mail ist bereits registriert.");

  const user = {
    id: `user-${Date.now()}-${slugify(cleanEmail)}`,
    name: name.trim(),
    email: cleanEmail,
    passwordHash: await passwordHash(password),
    createdAt: Date.now()
  };

  await withUserStore("readwrite", (store) => store.put(user));
  setCurrentUserId(user.id);
  await assignLegacyRecipesToUser(user.id);
  return user;
}

async function loginUser(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const user = await withUserStore("readonly", (store) => requestToPromise(store.index("email").get(cleanEmail)));
  if (!user || user.passwordHash !== await passwordHash(password)) {
    throw new Error("E-Mail oder Passwort stimmt nicht.");
  }

  setCurrentUserId(user.id);
  await assignLegacyRecipesToUser(user.id);
  return user;
}

async function getCurrentUser() {
  const userId = getCurrentUserId();
  if (!userId) return null;

  try {
    return await withUserStore("readonly", (store) => requestToPromise(store.get(userId)));
  } catch {
    return null;
  }
}

async function allRecipes() {
  const savedRecipes = await getSavedRecipes();
  return [...savedRecipes, ...baseRecipes];
}

function recipeUrl(recipe) {
  return `rezept.html?id=${encodeURIComponent(recipe.id)}`;
}

function recipeCard(recipe) {
  const ingredientTags = recipe.ingredients
    .slice(0, 4)
    .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
    .join("");
  const image = recipe.image
    ? `<img class="recipe-card-image" src="${recipe.image}" alt="${escapeHtml(recipe.title)}">`
    : "";

  return `
    <a class="recipe-card" href="${recipeUrl(recipe)}">
      ${image}
      <strong>${escapeHtml(recipe.title)}</strong>
      <p>${escapeHtml(recipe.note || "Ein eigenes Rezept aus deiner Sammlung.")}</p>
      <div class="tag-row">
        <span class="tag">${escapeHtml(recipe.category)}</span>
        <span class="tag">${escapeHtml(recipe.time)} Min.</span>
        ${recipe.servings ? `<span class="tag">${escapeHtml(recipe.servings)} Portionen</span>` : ""}
        ${ingredientTags}
      </div>
    </a>
  `;
}

function setupAuthNavigation() {
  const nav = document.querySelector(".main-nav");
  if (!nav) return;

  getCurrentUser().then((user) => {
    const existingAuthLink = nav.querySelector('a[href="auth.html"]');
    const authItem = document.createElement(user ? "button" : "a");
    authItem.className = user ? "nav-button" : "";
    authItem.textContent = user ? `Abmelden (${user.name})` : "Anmelden";

    if (user) {
      authItem.type = "button";
      authItem.addEventListener("click", () => {
        setCurrentUserId("");
        window.location.href = "auth.html";
      });
    } else {
      authItem.href = "auth.html";
      if (window.location.pathname.endsWith("auth.html")) {
        authItem.className = "active";
      }
    }

    if (existingAuthLink) {
      existingAuthLink.replaceWith(authItem);
    } else {
      nav.append(authItem);
    }
  });
}

async function renderDailyTips() {
  const container = document.querySelector("#dailyTips");
  if (!container) return;

  const tips = (await allRecipes()).slice(0, 3);
  container.innerHTML = tips
    .map((recipe, index) => `
      <a class="tip-card" href="${recipeUrl(recipe)}">
        <strong>${index === 0 ? "Tipp des Tages" : "Auch gut heute"}</strong>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p>${escapeHtml(recipe.note || "Aus deiner eigenen Sammlung, bereit fuer den naechsten Kochabend.")}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(recipe.category)}</span>
          <span class="tag">${escapeHtml(recipe.time)} Min.</span>
          ${recipe.servings ? `<span class="tag">${escapeHtml(recipe.servings)} Portionen</span>` : ""}
        </div>
      </a>
    `)
    .join("");
}

async function renderSearch() {
  const results = document.querySelector("#recipeResults");
  if (!results) return;

  const searchInput = document.querySelector("#searchInput");
  const categoryFilter = document.querySelector("#categoryFilter");
  const timeFilter = document.querySelector("#timeFilter");
  const count = document.querySelector("#resultCount");

  const recipes = await allRecipes();

  const applyFilters = () => {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const maxTime = Number(timeFilter.value);

    const filtered = recipes.filter((recipe) => {
      const haystack = [
        recipe.title,
        recipe.category,
        recipe.note,
        recipe.difficulty,
        recipe.steps,
        ...recipe.ingredients
      ].join(" ").toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesCategory = category === "alle" || recipe.category === category;
      const matchesTime = recipe.time <= maxTime;
      return matchesQuery && matchesCategory && matchesTime;
    });

    count.textContent = `${filtered.length} ${filtered.length === 1 ? "Rezept" : "Rezepte"}`;
    results.innerHTML = filtered.length
      ? filtered.map(recipeCard).join("")
      : `<p class="empty-state">Keine Treffer. Probiere eine andere Zutat oder lockere die Filter.</p>`;
  };

  [searchInput, categoryFilter, timeFilter].forEach((field) => field.addEventListener("input", applyFilters));
  document.querySelector("#resetFilters").addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "alle";
    timeFilter.value = "999";
    applyFilters();
  });
  applyFilters();
}

async function renderSavedRecipes() {
  const container = document.querySelector("#savedRecipes");
  if (!container) return;

  const recipes = await getSavedRecipes();
  container.innerHTML = recipes.length
    ? recipes.map((recipe) => `
      <a class="saved-card" href="${recipeUrl(recipe)}">
        <strong>${escapeHtml(recipe.title)}</strong>
        <p>${escapeHtml(recipe.category)} - ${escapeHtml(recipe.time)} Min.${recipe.servings ? ` - ${escapeHtml(recipe.servings)} Portionen` : ""}</p>
      </a>
    `).join("")
    : `<p class="empty-state">Noch keine eigenen Rezepte gespeichert.</p>`;
}

function setupRecipeForm() {
  const form = document.querySelector("#recipeForm");
  if (!form) return;
  if (!getCurrentUserId()) {
    form.outerHTML = `
      <section class="auth-required">
        <p class="eyebrow">Anmeldung erforderlich</p>
        <h2>Melde dich an, um eigene Rezepte zu speichern.</h2>
        <p>So bleiben deine Rezepte deiner Sammlung zugeordnet.</p>
        <a class="button primary" href="auth.html">Anmelden oder registrieren</a>
      </section>
    `;
    return;
  }

  const imageInput = form.elements.image;
  const preview = document.querySelector("#imagePreview");

  if (imageInput && preview) {
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files[0];
      if (!file) {
        preview.innerHTML = "<span>Noch kein Bild ausgewaehlt</span>";
        return;
      }

      if (!file.type.startsWith("image/")) {
        preview.innerHTML = "<span>Bitte waehle eine Bilddatei aus.</span>";
        imageInput.value = "";
        return;
      }

      const image = await readImageAsDataUrl(file);
      preview.innerHTML = `<img src="${image}" alt="Vorschau des ausgewaehlten Gerichts">`;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = data.get("title").trim();
    const steps = data.get("steps").trim();
    const note = data.get("note").trim();
    const image = await readImageAsDataUrl(data.get("image"));
    const recipe = {
      id: `eigenes-${Date.now()}-${slugify(title)}`,
      title,
      category: data.get("category"),
      time: toNumber(data.get("time"), 30),
      servings: toNumber(data.get("servings"), 2),
      difficulty: data.get("difficulty"),
      prepTime: toNumber(data.get("prepTime"), 0),
      cookTime: toNumber(data.get("cookTime"), 0),
      ingredients: splitLines(data.get("ingredients")),
      steps,
      note: note || steps.split(/\n|\./)[0],
      image,
      userId: getCurrentUserId(),
      createdAt: Date.now()
    };

    await addSavedRecipe(recipe);
    form.reset();
    form.elements.time.value = 30;
    form.elements.servings.value = 2;
    form.elements.prepTime.value = 10;
    form.elements.cookTime.value = 20;
    if (preview) preview.innerHTML = "<span>Noch kein Bild ausgewaehlt</span>";
    document.querySelector("#formMessage").textContent = "Gespeichert. Du findest es jetzt auch in der Suche.";
  });
}

function setupAuthForms() {
  const loginForm = document.querySelector("#loginForm");
  const signupForm = document.querySelector("#signupForm");
  const message = document.querySelector("#authMessage");
  if (!loginForm || !signupForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    try {
      await loginUser(data.get("email"), data.get("password"));
      window.location.href = "erstellen.html";
    } catch (error) {
      message.textContent = error.message;
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(signupForm);
    try {
      await createUser(data.get("name"), data.get("email"), data.get("password"));
      window.location.href = "erstellen.html";
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

async function renderRecipeDetail() {
  const container = document.querySelector("#recipeDetail");
  if (!container) return;

  const id = new URLSearchParams(window.location.search).get("id");
  const recipe = (await allRecipes()).find((item) => item.id === id);

  if (!recipe) {
    container.innerHTML = `
      <section class="detail-card">
        <p class="eyebrow">Nicht gefunden</p>
        <h1>Dieses Rezept gibt es hier noch nicht.</h1>
        <p class="detail-note">Gehe zur Suche zurueck und waehle ein anderes Rezept aus.</p>
        <a class="button primary" href="suche.html">Zur Rezeptsuche</a>
      </section>
    `;
    return;
  }

  const ingredients = recipe.ingredients
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const steps = escapeHtml(recipe.steps || recipe.note || "Noch keine Zubereitung hinterlegt.")
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean)
    .map((step) => `<li>${step}</li>`)
    .join("");
  const detailImage = recipe.image
    ? `<img class="detail-image" src="${recipe.image}" alt="${escapeHtml(recipe.title)}">`
    : "";
  const prepDetails = [
    recipe.prepTime ? `${recipe.prepTime} Min. Vorbereitung` : "",
    recipe.cookTime ? `${recipe.cookTime} Min. Kochzeit` : "",
    recipe.difficulty || ""
  ].filter(Boolean);

  document.title = `${recipe.title} | Kuechenkompass`;
  container.innerHTML = `
    <section class="detail-hero">
      <a class="back-link" href="suche.html">Zurueck zur Suche</a>
      <div class="detail-hero-layout">
        <div>
          <p class="eyebrow">${escapeHtml(recipe.category)}</p>
          <h1>${escapeHtml(recipe.title)}</h1>
          <p class="detail-note">${escapeHtml(recipe.note || "Ein eigenes Rezept aus deiner Sammlung.")}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(recipe.time)} Min.</span>
            <span class="tag">${escapeHtml(recipe.ingredients.length)} Zutaten</span>
            ${recipe.servings ? `<span class="tag">${escapeHtml(recipe.servings)} Portionen</span>` : ""}
            ${prepDetails.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
        ${detailImage}
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-card">
        <h2>Zutaten</h2>
        <ul class="ingredient-list">${ingredients}</ul>
      </article>
      <article class="detail-card">
        <h2>Zubereitung</h2>
        <ol class="step-list">${steps}</ol>
      </article>
    </section>
  `;
}

renderDailyTips();
renderSearch();
renderSavedRecipes();
setupAuthNavigation();
setupRecipeForm();
setupAuthForms();
renderRecipeDetail();
