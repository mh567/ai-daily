(function () {
  "use strict";

  const overrides = {};
  const state = { manifest: [], current: null, sectionObserver: null };
  const els = {
    dateSelect: document.querySelector("#dateSelect"),
    displayDate: document.querySelector("#displayDate"),
    issueLabel: document.querySelector("#issueLabel"),
    loading: document.querySelector("#loadingState"),
    error: document.querySelector("#errorState"),
    errorMessage: document.querySelector("#errorMessage"),
    newspaper: document.querySelector("#newspaper"),
    lead: document.querySelector("#leadSection"),
    sectionNav: document.querySelector("#sectionNavigation"),
    sections: document.querySelector("#newsSections"),
    briefs: document.querySelector("#briefs"),
    olderEdition: document.querySelector("#olderEdition"),
    olderEditionDate: document.querySelector("#olderEditionDate"),
    newerEdition: document.querySelector("#newerEdition"),
    newerEditionDate: document.querySelector("#newerEditionDate"),
    archiveCount: document.querySelector("#archiveCount"),
    retry: document.querySelector("#retryButton")
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function headlineHtml(value) {
    return inlineMarkdown(value).replace(/\b([A-Za-z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)+)\b/g, '<span class="tech-term">$1</span>');
  }

  function sectionMarker(activeIndex) {
    return `<span class="section-marker" aria-hidden="true">${[0, 1, 2, 3].map(index => `<span${index === activeIndex ? ' class="is-active"' : ""}></span>`).join("")}</span>`;
  }

  function selectFeaturedStories(sections, limit = 4) {
    const selected = [];
    const perSection = new Map();
    const sectionLimit = sections.length > 1 ? 2 : limit;
    const addStory = (section, sectionIndex, storyIndex) => {
      const story = section.stories[storyIndex];
      if (!story || selected.length >= limit) return;
      const count = perSection.get(sectionIndex) || 0;
      if (count >= sectionLimit) return;
      selected.push({
        story,
        sectionTitle: section.title,
        target: `#story-${sectionIndex + 1}-${storyIndex + 1}`
      });
      perSection.set(sectionIndex, count + 1);
    };

    sections.forEach((section, sectionIndex) => addStory(section, sectionIndex, 0));
    const longestSection = Math.max(0, ...sections.map(section => section.stories.length));
    for (let storyIndex = 1; storyIndex < longestSection && selected.length < limit; storyIndex += 1) {
      sections.forEach((section, sectionIndex) => addStory(section, sectionIndex, storyIndex));
    }
    return selected;
  }

  function parseFrontmatter(text) {
    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    const meta = {};
    if (match) {
      match[1].split("\n").forEach(line => {
        const item = line.match(/^([\w_]+):\s*["']?(.*?)["']?\s*$/);
        if (item) meta[item[1]] = item[2];
      });
    }
    return { meta, body: match ? text.slice(match[0].length) : text };
  }

  function sourceFrom(lines) {
    const sourceLine = lines.find(line => /^>\s*来源[：:]/.test(line));
    if (!sourceLine) return { label: "公开信源", url: "" };
    const link = sourceLine.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    return link ? { label: link[1], url: link[2] } : { label: sourceLine.replace(/^>\s*来源[：:]\s*/, ""), url: "" };
  }

  function cleanParagraphs(lines) {
    return lines
      .filter(line => line.trim() && line.trim() !== "---" && !line.startsWith(">") && !/^\*完\*$/.test(line.trim()))
      .map(line => line.replace(/^\s*[-*]\s+/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\s*\|\s*/g, " · ")
      .trim();
  }

  function parseV2(body) {
    const sections = [];
    let section = null;
    let story = null;
    const flushStory = () => {
      if (!story || !section) return;
      story.body = cleanParagraphs(story.lines);
      story.source = sourceFrom(story.lines);
      section.stories.push(story);
      story = null;
    };
    body.split("\n").forEach(line => {
      if (/^##\s+/.test(line)) {
        flushStory();
        section = { title: line.replace(/^##\s+/, "").trim(), stories: [] };
        sections.push(section);
      } else if (/^###\s+/.test(line)) {
        flushStory();
        if (!section) {
          section = { title: "今日新闻", stories: [] };
          sections.push(section);
        }
        story = { title: line.replace(/^###\s+/, "").trim(), lines: [] };
      } else if (story) {
        story.lines.push(line);
      }
    });
    flushStory();
    return sections.filter(item => item.stories.length);
  }

  function parseV1(body) {
    const sections = [{ title: "今日新闻", stories: [] }];
    let story = null;
    const flush = () => {
      if (!story) return;
      story.body = cleanParagraphs(story.lines).replace(/⭐+/g, "").trim();
      story.source = sourceFrom(story.lines);
      if (story.body && !/编辑|观察|未来雷达|来源与修订/.test(story.title)) sections[0].stories.push(story);
    };
    body.split("\n").forEach(line => {
      if (/^##\s+/.test(line)) {
        flush();
        const raw = line.replace(/^##\s+/, "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
        const parts = raw.split(/[：:]/);
        story = { title: parts.length > 1 ? parts.slice(1).join("：").trim() : raw, lines: [] };
      } else if (story) story.lines.push(line);
    });
    flush();
    return sections.filter(item => item.stories.length);
  }

  function parseArticle(text, manifestItem) {
    const parsed = parseFrontmatter(text);
    const isV2 = parsed.meta.schema_version === "2" || /^## 今日头版/m.test(parsed.body);
    const sections = isV2 ? parseV2(parsed.body) : parseV1(parsed.body);
    return { meta: { ...manifestItem, ...parsed.meta }, sections, isV2 };
  }

  function sourceHtml(source) {
    if (!source) return "";
    const label = inlineMarkdown(source.label);
    return source.url
      ? `<p class="source-line">信源 · <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${label}</a></p>`
      : `<p class="source-line">信源 · ${label}</p>`;
  }

  function editionUrl(item) {
    return item === state.manifest[0] ? "index.html" : `index.html?date=${encodeURIComponent(item.date)}`;
  }

  function setEditionJump(link, dateLabel, item, emptyLabel) {
    if (item) {
      link.href = editionUrl(item);
      link.removeAttribute("aria-disabled");
      link.classList.remove("is-disabled");
      dateLabel.textContent = item.date;
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.classList.add("is-disabled");
      dateLabel.textContent = emptyLabel;
    }
  }

  function storyHtml(story, index, sectionIndex) {
    return `<article class="story" id="story-${sectionIndex + 1}-${index + 1}">
      <p class="story-index">${String(index + 1).padStart(2, "0")}</p>
      <h3>${inlineMarkdown(story.title)}</h3>
      <p class="story-body">${inlineMarkdown(story.body)}</p>
      ${sourceHtml(story.source)}
    </article>`;
  }

  function render(article) {
    if (!article.sections.length) throw new Error("本期日报没有可显示的新闻段落");
    const headlineSection = article.sections.find(item => item.title.includes("头版")) || article.sections[0];
    const headline = headlineSection.stories[0];
    const briefs = article.sections.find(item => item.title.includes("简讯"));
    let regular = article.sections.filter(item => item !== headlineSection && item !== briefs);
    if (!regular.length && headlineSection.stories.length > 1) {
      regular = [{ title: "今日新闻", stories: headlineSection.stories.slice(1) }];
    }
    const sideStories = selectFeaturedStories(regular);

    const titleLength = headline.title.replace(/\s+/g, "").length;
    const titleClass = titleLength > 58 ? "extra-long-title" : titleLength > 42 ? "long-title" : "";
    els.lead.innerHTML = `<div class="lead-story">
        <p class="eyebrow">今日头版 · HEADLINE</p>
        <h1 id="leadTitle" class="${titleClass}">${headlineHtml(headline.title)}</h1>
        <p class="dek">${inlineMarkdown(headline.body)}</p>
        ${sourceHtml(headline.source)}
      </div>
      <aside class="lead-aside" aria-label="今日要闻">
        <h2>今日要闻</h2>
        ${sideStories.map(item => `<div class="aside-item"><span class="aside-mark" aria-hidden="true"></span><div class="aside-copy"><span class="aside-section">${escapeHtml(item.sectionTitle)}</span><a href="${item.target}">${inlineMarkdown(item.story.title)}</a></div></div>`).join("")}
      </aside>`;

    els.sectionNav.innerHTML = regular.map((section, i) => `<a href="#section-${i + 1}">${escapeHtml(section.title)}</a>`).join("") + (briefs ? '<a href="#briefs">今日简讯</a>' : "");
    els.sections.innerHTML = regular.map((section, sectionIndex) => `<section class="news-section" id="section-${sectionIndex + 1}">
      <header class="section-heading">
        <div class="section-title-block">${sectionMarker(sectionIndex)}<h2>${escapeHtml(section.title)}</h2></div>
        <p>本版 ${section.stories.length} 条</p>
      </header>
      <div class="stories-grid stories-count-${Math.min(section.stories.length, 4)}">${section.stories.map((story, storyIndex) => storyHtml(story, storyIndex, sectionIndex)).join("")}</div>
    </section>`).join("");

    if (briefs) {
      els.briefs.hidden = false;
      els.briefs.innerHTML = `<header class="section-heading"><div class="section-title-block">${sectionMarker(Math.min(regular.length, 3))}<h2>今日简讯</h2></div><p>本版 ${briefs.stories.length} 条</p></header>
        <div class="brief-grid">${briefs.stories.map((story, i) => `<article class="brief"><span class="brief-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${inlineMarkdown(story.title)}</h3><p>${inlineMarkdown(story.body)}</p>${sourceHtml(story.source)}</div></article>`).join("")}</div>`;
    } else {
      els.briefs.hidden = true;
      els.briefs.innerHTML = "";
    }

    const date = new Date(`${article.meta.date}T12:00:00`);
    const formatted = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(date);
    els.displayDate.textContent = formatted;
    const index = state.manifest.findIndex(item => item.date === article.meta.date);
    els.issueLabel.textContent = `第 ${String(state.manifest.length - Math.max(index, 0)).padStart(3, "0")} 期`;
    setEditionJump(els.olderEdition, els.olderEditionDate, state.manifest[index + 1], "已至创刊号");
    setEditionJump(els.newerEdition, els.newerEditionDate, state.manifest[index - 1], "当前最新");
    els.archiveCount.textContent = `共 ${state.manifest.length} 期`;
    document.title = `${headline.title} · AI 日报`;
    els.loading.hidden = true;
    els.error.hidden = true;
    els.newspaper.hidden = false;
    els.newspaper.classList.remove("edition-enter");
    void els.newspaper.offsetWidth;
    els.newspaper.classList.add("edition-enter");
    setupSectionNavigation();
  }

  function setupSectionNavigation() {
    if (state.sectionObserver) state.sectionObserver.disconnect();
    const links = [...els.sectionNav.querySelectorAll("a")];
    const sections = links.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;
    state.sectionObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => {
        if (link.getAttribute("href") === `#${visible.target.id}`) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-18% 0px -68%", threshold: [0, .1, .35] });
    sections.forEach(section => state.sectionObserver.observe(section));
  }

  async function loadEdition(item) {
    state.current = item;
    els.loading.hidden = false;
    els.error.hidden = true;
    els.newspaper.hidden = true;
    const paths = [overrides[item.date], item.path].filter(Boolean);
    let lastError;
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        render(parseArticle(await response.text(), item));
        return;
      } catch (error) { lastError = error; }
    }
    els.loading.hidden = true;
    els.error.hidden = false;
    els.errorMessage.textContent = `读取 ${item.date} 日报失败：${lastError ? lastError.message : "未知错误"}`;
  }

  async function init() {
    try {
      const response = await fetch("articles.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.manifest = await response.json();
      if (!state.manifest.length) throw new Error("日报索引为空");
      const requestedDate = new URLSearchParams(location.search).get("date");
      const requestedItem = state.manifest.find(item => item.date === requestedDate);
      const initialItem = requestedItem || state.manifest[0];
      const visibleItems = state.manifest.slice(0, 16);
      if (requestedItem && !visibleItems.some(item => item.date === requestedItem.date)) visibleItems.push(requestedItem);
      els.dateSelect.innerHTML = visibleItems.map(item => `<option value="${escapeHtml(item.date)}">${escapeHtml(item.date)}</option>`).join("");
      els.dateSelect.disabled = false;
      els.dateSelect.value = initialItem.date;
      await loadEdition(initialItem);
    } catch (error) {
      els.loading.hidden = true;
      els.error.hidden = false;
      els.errorMessage.textContent = `日报索引读取失败：${error.message}`;
    }
  }

  els.dateSelect.addEventListener("change", event => {
    const item = state.manifest.find(entry => entry.date === event.target.value);
    if (item) {
      const url = new URL(location.href);
      if (item === state.manifest[0]) url.searchParams.delete("date");
      else url.searchParams.set("date", item.date);
      history.replaceState(null, "", `${url.pathname}${url.search}`);
      window.scrollTo({ top: 0, behavior: "auto" });
      loadEdition(item);
    }
  });
  els.retry.addEventListener("click", () => state.current ? loadEdition(state.current) : init());
  init();
}());
