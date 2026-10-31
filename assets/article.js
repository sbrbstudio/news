let toastTimer;
let categories = [];

function setCurrentDate() {
  document.querySelector("#article-today").textContent =
    new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
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
  if (!source.startsWith("---")) return {};
  const end = source.indexOf("\n---", 3);
  if (end === -1) return {};

  const data = {};
  let currentList = null;

  for (const rawLine of source.slice(3, end).trim().split(/\r?\n/)) {
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
    } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
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
  if (!manifestResponse.ok) throw new Error("无法载入文章目录");
  const articlePaths = await manifestResponse.json();

  const loaded = await Promise.all(
    articlePaths.map(async (path) => {
      const response = await fetch(`./${path}`);
      if (!response.ok) throw new Error(`无法载入 ${path}`);
      const source = await response.text();
      const metadata = parseFrontMatter(source);
      return {
        ...metadata,
        body: getBody(source),
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
  if (!response.ok) throw new Error("无法载入分类配置");
  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = /^(https?:\/\/|\.\/|#)/.test(url) ? url : "#";
    return `<a href="${escapeHtml(safeUrl)}">${label}</a>`;
  });
  return html;
}

function renderImageBlock(line) {
  const match = line.match(
    /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/,
  );
  if (!match) return null;

  const [, alt, url, title] = match;
  const safeUrl = /^(https?:\/\/|\.\.?\/)/.test(url) ? url : "#";
  const caption = title || alt;
  return `
    <figure class="article-inline-image">
      <img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
    </figure>
  `;
}

function renderVideoBlock(line) {
  const match = line.match(
    /^@\[video\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/,
  );
  if (!match) return null;

  const [, url, title] = match;
  const safeUrl = /^(https?:\/\/|\.\.?\/)/.test(url) ? url : "#";
  const extension = safeUrl.split("?")[0].split(".").pop().toLowerCase();
  const mimeType =
    extension === "webm"
      ? "video/webm"
      : extension === "ogv"
        ? "video/ogg"
        : "video/mp4";

  return `
    <figure class="article-video">
      <video controls preload="metadata" playsinline>
        <source src="${escapeHtml(safeUrl)}" type="${mimeType}" />
        当前浏览器不支持播放这段视频。
      </video>
      ${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ""}
    </figure>
  `;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines) {
  const separatorIndex = lines.findIndex((line, index) => {
    if (index === 0 || !line.includes("|")) return false;
    const cells = splitTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  });
  if (separatorIndex < 1) return null;

  const headerIndex = separatorIndex - 1;
  if (!lines[headerIndex].includes("|")) return null;

  let tableEnd = separatorIndex + 1;
  while (tableEnd < lines.length && lines[tableEnd].includes("|")) {
    tableEnd += 1;
  }

  const beforeLines = lines.slice(0, headerIndex);
  const afterLines = lines.slice(tableEnd);
  const headerCells = splitTableRow(lines[headerIndex]);
  const bodyRows = lines.slice(separatorIndex + 1, tableEnd).map(splitTableRow);
  const columnCount = headerCells.length;
  const normalizeRow = (row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] || "");

  const tableHtml = `
    <div class="article-table-wrap">
      <table>
        <thead>
          <tr>${normalizeRow(headerCells)
            .map((cell) => `<th>${renderInline(cell)}</th>`)
            .join("")}</tr>
        </thead>
        <tbody>
          ${bodyRows
            .map(
              (row) =>
                `<tr>${normalizeRow(row)
                  .map((cell) => `<td>${renderInline(cell)}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const beforeHtml = beforeLines.length
    ? `<p>${renderInline(beforeLines.join(" "))}</p>`
    : "";
  const afterHtml = afterLines.length
    ? `<p>${renderInline(afterLines.join(" "))}</p>`
    : "";

  return `${beforeHtml}${tableHtml}${afterHtml}`;
}

function renderMarkdown(markdown) {
  const blocks = markdown.trim().split(/\r?\n\r?\n/);
  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const first = lines[0].trim();
      const image = renderImageBlock(first);
      if (image) return image;

      const video = renderVideoBlock(first);
      if (video) return video;

      const table = renderTable(lines);
      if (table) return table;

      if (first.startsWith("### ")) {
        return `<h3>${renderInline(first.slice(4))}</h3>`;
      }
      if (first.startsWith("## ")) {
        return `<h2>${renderInline(first.slice(3))}</h2>`;
      }
      if (first.startsWith("> ")) {
        const quote = lines
          .map((line) => line.replace(/^>\s?/, ""))
          .join(" ");
        return `<blockquote><p>${renderInline(quote)}</p></blockquote>`;
      }
      if (lines.every((line) => line.startsWith("- "))) {
        return `<ul>${lines
          .map((line) => `<li>${renderInline(line.slice(2))}</li>`)
          .join("")}</ul>`;
      }
      if (lines.every((line) => /^\d+\.\s/.test(line))) {
        return `<ol>${lines
          .map((line) => `<li>${renderInline(line.replace(/^\d+\.\s/, ""))}</li>`)
          .join("")}</ol>`;
      }
      if (first === "---") {
        return "";
      }
      return `<p>${renderInline(lines.join(" "))}</p>`;
    })
    .join("");
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

function readingTime(article) {
  const chineseCharacters = (article.body.match(/[\u3400-\u9fff]/g) || []).length;
  return `${Math.max(2, Math.ceil(chineseCharacters / 420))} 分钟`;
}

function articleUrl(article) {
  return `./article.html?slug=${encodeURIComponent(article.slug)}`;
}

function renderRelatedCard(article, variant = "related") {
  if (variant === "more") {
    return `
      <article class="more-card">
        <a href="${articleUrl(article)}">
          <img src="${escapeHtml(article.cover)}" alt="${escapeHtml(article.cover_alt)}" />
          <span>${escapeHtml(article.category_label)}</span>
          <h3>${escapeHtml(article.title)}</h3>
        </a>
      </article>
    `;
  }

  return `
    <a class="related-story" href="${articleUrl(article)}">
      <span>${escapeHtml(article.category_label)}</span>
      <strong>${escapeHtml(article.title)}</strong>
    </a>
  `;
}

function renderArticle(article, allArticles) {
  const categoryLabel =
    categories.find((category) => category.id === article.category)?.label ||
    article.category_label ||
    "未分类";
  document.title = `${article.title} | SBRBSTUDIO`;
  document.querySelector("#article-category").textContent = categoryLabel;
  document.querySelector("#article-region").textContent = (article.area || "")
    .split("/")
    .filter(Boolean)
    .join(" › ");
  document.querySelector("#article-title").textContent = article.title;
  document.querySelector("#article-summary").textContent = article.summary;
  document.querySelector("#article-author").textContent = article.author;
  document.querySelector("#article-date").textContent = formatLongDate(
    article.published_at,
  );
  document.querySelector("#article-reading-time").textContent =
    readingTime(article);

  const categoryLink = document.querySelector("#article-category-link");
  categoryLink.textContent = categoryLabel;
  categoryLink.href = `./index.html?category=${article.category}`;

  const cover = document.querySelector("#article-cover");
  cover.src = article.cover;
  cover.alt = article.cover_alt;
  document.querySelector("#article-caption").textContent = article.caption;
  document.querySelector("#article-body").innerHTML = renderMarkdown(
    article.body,
  );

  document.querySelector("#article-highlights").innerHTML = (article.highlights || [])
    .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
    .join("");

  const articleTags = [
    categoryLabel,
    ...(article.area || "").split("/").filter(Boolean),
    ...(article.tags || []),
  ];
  document.querySelector("#article-tags").innerHTML = [...new Set(articleTags)]
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  const related = allArticles
    .filter(
      (candidate) =>
        candidate.slug !== article.slug &&
        candidate.category === article.category,
    )
    .concat(
      allArticles.filter(
        (candidate) =>
          candidate.slug !== article.slug &&
          candidate.category !== article.category,
      ),
    )
    .slice(0, 3);

  document.querySelector("#related-stories").innerHTML = related
    .slice(0, 2)
    .map((candidate) => renderRelatedCard(candidate))
    .join("");

  document.querySelector("#more-grid").innerHTML = allArticles
    .filter((candidate) => candidate.slug !== article.slug)
    .slice(0, 3)
    .map((candidate) => renderRelatedCard(candidate, "more"))
    .join("");

  document.querySelector("#article-loading").hidden = true;
  document.querySelector("#article-view").hidden = false;
}

function bindShareButton(article) {
  const button = document.querySelector("#share-button");
  button.addEventListener("click", async () => {
    const shareData = {
      title: article.title,
      text: article.summary,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast("报道链接已复制。");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        showToast("浏览器未允许分享，请复制地址栏链接。");
      }
    }
  });
}

async function initArticle() {
  setCurrentDate();
  window.setInterval(setCurrentDate, 60_000);
  try {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) throw new Error("缺少文章编号");

    const [articles, loadedCategories] = await Promise.all([
      loadArticles(),
      loadCategories(),
    ]);
    categories = loadedCategories;
    const article = articles.find((candidate) => candidate.slug === slug);
    if (!article) throw new Error("没有找到这篇报道");

    renderArticle(article, articles);
    bindShareButton(article);
  } catch (error) {
    document.querySelector("#article-loading").innerHTML = `
      <div class="empty-state">
        <p>${escapeHtml(error.message)}</p>
        <a href="./index.html">返回新闻首页</a>
      </div>
    `;
  }
}

initArticle();
