const state = {
  category: new URLSearchParams(window.location.search).get("category") || "all",
  area: "all",
  sort: "latest",
  query: "",
};

let articles = [];
let categories = [];
let toastTimer;

function setCurrentDate() {
  const today = new Date();
  document.querySelector("#current-date").textContent =
    new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(today);
  document.querySelector("#current-weekday").textContent =
    new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(today);
}

function showToast(message) {
  const toast = document.querySelector(".toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function parseArray(value) {
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function parseFrontMatter(source) {
  if (!source.startsWith("---")) {
    return {};
  }

  const end = source.indexOf("\n---", 3);
  if (end === -1) {
    return {};
  }

  const lines = source.slice(3, end).trim().split(/\r?\n/);
  const data = {};
  let currentList = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (currentList && line.startsWith("- ")) {
      data[currentList].push(line.slice(2).trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    currentList = null;
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (!rawValue) {
      data[key] = [];
      currentList = key;
      continue;
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      data[key] = parseArray(rawValue);
    } else if (rawValue === "true" || rawValue === "false") {
      data[key] = rawValue === "true";
    } else {
      data[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }

  return data;
}

function getBody(source) {
  if (!source.startsWith("---")) return source.trim();
  const end = source.indexOf("\n---", 3);
  return end === -1 ? source.trim() : source.slice(end + 4).trim();
}

async function loadArticles() {
  const manifestResponse = await fetch("./content/articles.json");
  if (!manifestResponse.ok) {
    throw new Error("无法载入文章目录");
  }

  const articlePaths = await manifestResponse.json();
  const loaded = await Promise.all(
    articlePaths.map(async (path) => {
      const response = await fetch(`./${path}`);
      if (!response.ok) {
        throw new Error(`无法载入 ${path}`);
      }
      const source = await response.text();
      const metadata = parseFrontMatter(source);
      const body = getBody(source);
      return {
        ...metadata,
        body,
        slug: path.split("/").pop().replace(/\.md$/, ""),
      };
    }),
  );

  return loaded.sort(
    (a, b) => new Date(b.published_at) - new Date(a.published_at),
  );
}

async function loadCategories() {
  const response = await fetch("./content/categories.json");
  if (!response.ok) {
    throw new Error("无法载入 content/categories.json");
  }
  return response.json();
}

function categoryLabel(article) {
  return (
    categories.find((category) => category.id === article.category)?.label ||
    article.category_label ||
    article.category ||
    "未分类"
  );
}

function articleArea(article) {
  return article.area || article.area_path || "";
}

function areaLeaf(article) {
  return articleArea(article).split("/").filter(Boolean).pop() || "未分类";
}

function areaMatches(article, selectedArea) {
  if (selectedArea === "all") return true;
  const path = articleArea(article);
  return path === selectedArea || path.startsWith(`${selectedArea}/`);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function articleUrl(article) {
  return `./article.html?slug=${encodeURIComponent(article.slug)}`;
}

function renderLead(article) {
  return `
    <article class="lead-story">
      <div class="lead-story-copy">
        <div class="story-kicker">
          <span>${escapeHtml(categoryLabel(article))}</span>
          <span>头条报道</span>
        </div>
        <h1><a href="${articleUrl(article)}">${escapeHtml(article.title)}</a></h1>
        <p class="lead-summary">${escapeHtml(article.summary)}</p>
        <div class="story-byline">
          <strong>${escapeHtml(article.author)}</strong>
          <time datetime="${escapeHtml(article.published_at)}">${formatShortDate(article.published_at)}</time>
        </div>
      </div>
      <figure class="lead-image">
        <a href="${articleUrl(article)}" tabindex="-1">
          <img src="${escapeHtml(article.cover)}" alt="${escapeHtml(article.cover_alt)}" />
        </a>
        <figcaption>${escapeHtml(article.caption)}</figcaption>
      </figure>
    </article>
  `;
}

function renderSecondary(article) {
  return `
    <article class="secondary-story">
      <div class="secondary-story-copy">
        <div class="story-kicker">
          <span>${escapeHtml(categoryLabel(article))}</span>
          <span>${escapeHtml(areaLeaf(article))}</span>
        </div>
        <h3><a href="${articleUrl(article)}">${escapeHtml(article.title)}</a></h3>
        <time datetime="${escapeHtml(article.published_at)}">${formatShortDate(article.published_at)}</time>
      </div>
      <a href="${articleUrl(article)}" tabindex="-1">
        <img src="${escapeHtml(article.cover)}" alt="${escapeHtml(article.cover_alt)}" />
      </a>
    </article>
  `;
}

function renderLeadZone() {
  const featured = articles.filter((article) => article.featured);
  const lead = featured[0] || articles[0];
  const secondary = articles
    .filter((article) => article.slug !== lead.slug)
    .slice(0, 2);

  document.querySelector("#lead-zone").innerHTML = `
    <div class="lead-grid">
      ${renderLead(lead)}
      <aside class="lead-secondary" aria-label="更多头条">
        <div class="secondary-heading">
          <h2>今日焦点</h2>
          <span>LIVE</span>
        </div>
        ${secondary.map(renderSecondary).join("")}
      </aside>
    </div>
  `;
}

function renderCard(article, index) {
  const largeClass = index === 0 ? " is-card-lead" : "";
  return `
    <article class="story-card${largeClass}">
      <div class="card-copy">
        <span class="card-category">${escapeHtml(categoryLabel(article))}</span>
        <h3><a href="${articleUrl(article)}">${escapeHtml(article.title)}</a></h3>
        <p>${escapeHtml(article.summary)}</p>
      </div>
      <a class="card-image" href="${articleUrl(article)}" tabindex="-1">
        <img
          src="${escapeHtml(article.cover)}"
          alt="${escapeHtml(article.cover_alt)}"
        />
      </a>
      <div class="card-foot">
        <time datetime="${escapeHtml(article.published_at)}">${formatShortDate(article.published_at)}</time>
        <span class="card-region">${escapeHtml(areaLeaf(article))}</span>
      </div>
    </article>
  `;
}

function getVisibleArticles() {
  const normalizedQuery = state.query.trim().toLocaleLowerCase("zh-CN");
  const filtered = articles.filter((article) => {
    const matchesCategory =
      state.category === "all" || article.category === state.category;
    const matchesRegion =
      areaMatches(article, state.area);
    const searchable = [
      article.title,
      article.summary,
      article.author,
      categoryLabel(article),
      articleArea(article),
      ...(article.tags || []),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return (
      matchesCategory &&
      matchesRegion &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });

  return filtered.sort((a, b) => {
    if (state.sort === "oldest") {
      return new Date(a.published_at) - new Date(b.published_at);
    }
    if (state.sort === "title") {
      return a.title.localeCompare(b.title, "zh-CN");
    }
    return new Date(b.published_at) - new Date(a.published_at);
  });
}

function renderLatest() {
  const grid = document.querySelector("#latest-grid");
  const empty = document.querySelector("#empty-state");
  const count = document.querySelector("#story-count");
  const visible = getVisibleArticles();

  grid.innerHTML = visible.map(renderCard).join("");
  grid.hidden = visible.length === 0;
  empty.hidden = visible.length > 0;
  count.textContent = `${visible.length} 篇报道`;
}

function syncCategoryControls() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const isActive = button.dataset.filter === state.category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  document.querySelectorAll("[data-category-link]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.categoryLink === state.category);
  });
}

function renderTaxonomyControls() {
  document.querySelector("#category-links").innerHTML = categories
    .map(
      (category) =>
        `<a href="#latest" data-category-link="${escapeHtml(category.id)}">${escapeHtml(category.label)}</a>`,
    )
    .join("");

  const filters = document.querySelector(".filter-chips");
  filters.innerHTML = `
    <button class="filter-chip" type="button" data-filter="all">全部</button>
    ${categories
      .map(
        (category) =>
          `<button class="filter-chip" type="button" data-filter="${escapeHtml(category.id)}">${escapeHtml(category.label)}</button>`,
      )
      .join("")}
  `;
}

function setCategory(category) {
  state.category = category;
  syncCategoryControls();
  renderLatest();
}

function bindControls() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => setCategory(button.dataset.filter));
  });

  document.querySelectorAll("[data-category-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setCategory(link.dataset.categoryLink);
      document.querySelector("#latest").scrollIntoView({ behavior: "smooth" });
    });
  });

  const search = document.querySelector("#news-search");
  search.addEventListener("input", () => {
    state.query = search.value;
    renderLatest();
  });

  const areaToggle = document.querySelector("#area-filter-toggle");
  const areaDropdown = document.querySelector("#area-dropdown");
  const areaValue = document.querySelector("#area-filter-value");

  areaToggle.addEventListener("click", () => {
    const willOpen = areaDropdown.hidden;
    areaDropdown.hidden = !willOpen;
    areaToggle.setAttribute("aria-expanded", String(willOpen));
    areaDropdown.classList.toggle("is-open", willOpen);
  });

  document.querySelector("#clear-area").addEventListener("click", () => {
    state.area = "all";
    areaValue.textContent = "全部地区";
    areaDropdown.hidden = true;
    areaToggle.setAttribute("aria-expanded", "false");
    renderLatest();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".area-control")) {
      areaDropdown.hidden = true;
      areaToggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      areaDropdown.hidden = true;
      areaToggle.setAttribute("aria-expanded", "false");
      areaToggle.focus();
    }
  });

  document.querySelector("#sort-order").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderLatest();
  });

  const focusSearch = () => {
    document.querySelector("#latest").scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => search.focus(), 250);
  };

  document.querySelector(".search-jump").addEventListener("click", focusSearch);
  document.querySelector(".nav-search").addEventListener("click", focusSearch);

  document.querySelector("#clear-filters").addEventListener("click", () => {
    state.category = "all";
    state.area = "all";
    state.sort = "latest";
    state.query = "";
    search.value = "";
    document.querySelector("#area-filter-value").textContent = "全部地区";
    document.querySelector("#sort-order").value = "latest";
    syncCategoryControls();
    renderLatest();
  });

  document.querySelector("#newsletter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    event.target.reset();
    showToast("演示订阅已记录，正式上线后可接入邮件服务。");
  });
}

async function initHome() {
  setCurrentDate();
  window.setInterval(setCurrentDate, 60_000);
  try {
    [articles, categories] = await Promise.all([
      loadArticles(),
      loadCategories(),
    ]);
    const categoryIds = new Set(categories.map((category) => category.id));
    if (state.category !== "all" && !categoryIds.has(state.category)) {
      state.category = "all";
    }
    renderTaxonomyControls();
    renderLeadZone();
    syncCategoryControls();
    renderLatest();
    bindControls();
  } catch (error) {
    document.querySelector("#lead-zone").innerHTML = `
      <div class="empty-state">
        <p>${escapeHtml(error.message)}</p>
        <button type="button" onclick="window.location.reload()">重新载入</button>
      </div>
    `;
    document.querySelector("#latest-grid").innerHTML = "";
  }
}

initHome();
