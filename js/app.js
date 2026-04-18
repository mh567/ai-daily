/* ==========================================================================
   AI Daily — App Logic
   Articles loading, theme toggle, markdown rendering
   ========================================================================== */

(function () {
  'use strict';

  // ----- Article manifest (loaded from articles.json) -----
  let ARTICLES = [];

  async function loadArticleManifest() {
    try {
      const res = await fetch('articles.json');
      if (!res.ok) throw new Error('Failed to load articles.json');
      const manifest = await res.json();
      ARTICLES = manifest.map(a => a.path);
      return manifest;
    } catch (err) {
      console.error('Failed to load article manifest:', err);
      // Fallback: empty array
      return [];
    }
  }

  // ----- Escape HTML -----
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ----- Frontmatter parser -----
  function parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const meta = {};
    match[1].split('\n').forEach((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      meta[key] = val;
    });
    return { meta, body: match[2] };
  }

  // ----- URL protocol whitelist -----
  function isSafeUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim().replace(/\s/g, '');
    if (trimmed === '' || trimmed === '#') return true;
    try {
      const parsed = new URL(trimmed, 'https://example.com');
      return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
    } catch {
      // Relative URLs (no scheme) are safe
      return !trimmed.includes(':');
    }
  }

  // ----- Sanitize HTML -----
  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    // Remove dangerous elements
    template.content.querySelectorAll('script, iframe, object, embed, form, style').forEach(el => el.remove());

    // Sanitize attributes and URLs
    template.content.querySelectorAll('*').forEach(el => {
      // Remove event handlers and javascript: URLs
      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        // Remove on* event handlers
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          return;
        }
        // Whitelist href/src URLs
        if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return template.innerHTML;
  }

  // ----- Minimal Markdown → HTML -----
  function mdToHtml(md) {
    let html = md;
    // Escape HTML in source first
    html = escapeHtml(html);

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Blockquote
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
    // Bold & italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Horizontal rule — surround with blank lines so paragraph splitting isolates it
    html = html.replace(/(^|\n)---(\n|$)/g, '\n\n<hr>\n\n');
    // Tables — pipe-style
    html = html.replace(/^(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)+)/gm, (match, header, sep, body) => {
      const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(row => {
        const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    });
    // Unordered list items
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    // Ordered list items
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li value="$1">$2</li>');
    // Wrap <li> groups — ordered first, then remaining unordered
    html = html.replace(/((?:<li value="\d+">.*<\/li>\n?)+)/g, '<ol>$1</ol>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    // Links — validate URL protocol
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      return isSafeUrl(url) ? `<a href="${url}">${text}</a>` : `<span>${text}</span>`;
    });
    // Paragraphs — wrap remaining text lines
    html = html
      .split('\n\n')
      .map((block) => {
        block = block.trim();
        if (!block) return '';
        if (/^<[a-z]/.test(block)) return block;
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');
    // End mark — detect sign-off: "— 完 —" followed by sign-off text
    // Supports: "AI Daily · 每日清晨，如约至", "每日黄昏，如约而至", etc.
    html = html.replace(
      /<p>(— 完 —)<\/p>\s*<p>(.*?每日[^<]{2,20})<\/p>\s*$/,
      '<div class="end-mark">$1</div><div class="end-mark-sub">$2</div>'
    );
    // Broader fallback: any "— 完 —" followed by short text
    html = html.replace(
      /<p>(— 完 —)<\/p>\s*<p>([^<]{2,40})<\/p>\s*$/,
      '<div class="end-mark">$1</div><div class="end-mark-sub">$2</div>'
    );
    return sanitizeHtml(html);
  }

  // ----- Slug from filename -----
  function slugFromFile(path) {
    const file = path.split('/').pop();
    return file.replace(/\.md$/, '');
  }

  // ----- Load all articles -----
  async function loadArticles() {
    const results = await Promise.all(
      ARTICLES.map(async (path) => {
        try {
          const res = await fetch(path);
          if (!res.ok) return null;
          const raw = await res.text();
          const parsed = parseFrontmatter(raw);
          if (!parsed) return null;
          return { ...parsed.meta, slug: slugFromFile(path), body: parsed.body };
        } catch {
          return null;
        }
      })
    );
    return results.filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // ----- Render article cards (DOM API — no innerHTML with user data) -----
  function renderCards(articles, container) {
    if (!container) return;
    container.textContent = '';
    container.setAttribute('aria-busy', 'false');

    if (articles.length === 0) {
      const wrap = document.createElement('div');
      wrap.className = 'empty-state';
      wrap.innerHTML = '<div class="empty-state__icon">\uD83D\uDCE5</div>';
      const title = document.createElement('div');
      title.className = 'empty-state__title';
      title.textContent = '暂无文章';
      const desc = document.createElement('div');
      desc.className = 'empty-state__desc';
      desc.textContent = '该分类下暂时没有内容';
      wrap.appendChild(title);
      wrap.appendChild(desc);
      container.appendChild(wrap);
      return;
    }

    articles.forEach((a, i) => {
      const card = document.createElement('a');
      card.className = 'article-card';
      card.href = 'article.html?slug=' + encodeURIComponent(a.slug);
      card.setAttribute('aria-label', '阅读文章：' + escapeHtml(a.title || ''));

      const left = document.createElement('div');
      left.className = 'article-card__left';

      const meta = document.createElement('div');
      meta.className = 'article-card__meta';

      const date = document.createElement('span');
      date.className = 'article-card__date';
      date.textContent = a.date || '';

      meta.appendChild(date);

      // Edition badge (早报/晚报)
      if (a.edition === 'morning' || a.edition === 'evening') {
        const edition = document.createElement('span');
        edition.className = 'article-card__edition article-card__edition--' + a.edition;
        edition.textContent = a.edition === 'morning' ? '早报' : '晚报';
        meta.appendChild(edition);
      }

      const titleEl = document.createElement('div');
      titleEl.className = 'article-card__title';
      titleEl.textContent = a.title || '';

      const excerpt = document.createElement('div');
      excerpt.className = 'article-card__excerpt';
      excerpt.textContent = a.excerpt || '';

      const readMore = document.createElement('div');
      readMore.className = 'article-card__read-more';
      readMore.textContent = '阅读全文';

      left.appendChild(meta);
      left.appendChild(titleEl);
      left.appendChild(excerpt);
      left.appendChild(readMore);

      card.appendChild(left);
      container.appendChild(card);
    });
  }

  // ----- Theme toggle -----
  function initTheme() {
    // Theme is pre-set by inline <head> script; only bind events and update icon here
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeIcon(theme);

    // Bind toggle button
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('ai-daily-theme')) {
        const theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeIcon(theme);
      }
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ai-daily-theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.innerHTML =
      theme === 'dark'
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // ----- Mobile nav -----
  function initMobileNav() {
    const toggle = document.querySelector('.nav__mobile-toggle');
    const links = document.querySelector('.nav__links');
    if (!toggle || !links) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.classList.toggle('active');
      links.classList.toggle('open');
    });
    links.querySelectorAll('.nav__link, .theme-toggle').forEach((el) => {
      el.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.classList.remove('active');
        links.classList.remove('open');
      });
    });
  }

  // ----- Pull to refresh (PWA) -----
  function initPullToRefresh(onRefresh) {
    let startY = 0;
    let pulling = false;
    let refreshing = false;
    const threshold = 60;

    const indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/></svg>';
    document.body.prepend(indicator);

    function show(dy) {
      indicator.style.transform = 'translateY(' + Math.min(dy * 0.4, 50) + 'px)';
      indicator.style.opacity = Math.min(dy / threshold, 1);
    }

    function hide() {
      indicator.style.transform = 'translateY(-50px)';
      indicator.style.opacity = 0;
      indicator.classList.remove('ptr-spinning');
      refreshing = false;
    }

    document.addEventListener('touchstart', function(e) {
      if (refreshing) return;
      if (window.scrollY <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (!pulling || refreshing) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 10 && window.scrollY <= 0) {
        show(dy);
      }
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      if (!pulling || refreshing) return;
      pulling = false;
      var dy = e.changedTouches[0].clientY - startY;
      if (dy > threshold) {
        refreshing = true;
        indicator.classList.add('ptr-spinning');
        indicator.style.transform = 'translateY(40px)';
        indicator.style.opacity = 1;
        Promise.resolve(onRefresh()).then(function() {
          setTimeout(hide, 200);
        });
      } else {
        hide();
      }
    }, { passive: true });
  }

  // ----- Home page init -----
  async function initHome() {
    const cardsContainer = document.querySelector('.articles-list');
    if (!cardsContainer) return;

    initTheme();
    initMobileNav();

    // Load article manifest first
    await loadArticleManifest();

    let allArticles = [];
    try {
      allArticles = await loadArticles();
    } catch (err) {
      console.error('Failed to load articles:', err);
    }

    renderCards(allArticles, cardsContainer);

    // Pull to refresh
    initPullToRefresh(async () => {
      const fresh = await loadArticles();
      renderCards(fresh, cardsContainer);
    });
  }

  // ----- Article detail page init -----
  async function initArticle() {
    const contentEl = document.querySelector('.article-content');
    const headerEl = document.querySelector('.article-page__header');
    if (!contentEl) return;

    initTheme();
    initMobileNav();

    // Load article manifest first
    await loadArticleManifest();

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (!slug) {
      contentEl.innerHTML = '<p>文章未找到。</p>';
      return;
    }

    let articles = [];
    try {
      articles = await loadArticles();
    } catch (err) {
      console.error('Failed to load articles:', err);
      contentEl.innerHTML = '<p>加载文章失败，请稍后重试。</p>';
      return;
    }
    const article = articles.find((a) => a.slug === slug);
    if (!article) {
      contentEl.innerHTML = '<p>文章未找到。</p>';
      return;
    }

    document.title = `${article.title} — AI Daily`;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && article.excerpt) descMeta.setAttribute('content', article.excerpt);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${article.title} — AI Daily`);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && article.excerpt) ogDesc.setAttribute('content', article.excerpt);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);

    if (headerEl) {
      headerEl.querySelector('.article-page__title').textContent = article.title || '';
      const metaEl = headerEl.querySelector('.article-page__meta');
      metaEl.textContent = '';
      const parts = [];
      if (article.author) parts.push(article.author);
      if (article.date) parts.push(article.date);
      parts.forEach((text, i) => {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.className = 'article-page__meta-separator';
          metaEl.appendChild(sep);
        }
        const span = document.createElement('span');
        span.textContent = text;
        metaEl.appendChild(span);
      });
    }

    contentEl.innerHTML = mdToHtml(article.body);

    // Prev / Next day navigation
    const idx = articles.findIndex((a) => a.slug === slug);
    const newer = idx > 0 ? articles[idx - 1] : null; // next day (newer)
    const older = idx < articles.length - 1 ? articles[idx + 1] : null; // prev day (older)

    if (newer || older) {
      const nav = document.createElement('nav');
      nav.className = 'article-nav';

      if (older) {
        const a = document.createElement('a');
        a.href = 'article.html?slug=' + encodeURIComponent(older.slug);
        a.className = 'article-nav__link article-nav__link--prev';
        a.innerHTML = '<span class="article-nav__arrow">&larr;</span><span class="article-nav__label">上一篇</span>';
        nav.appendChild(a);
      } else {
        const span = document.createElement('span');
        span.className = 'article-nav__link article-nav__link--disabled';
        nav.appendChild(span);
      }

      if (newer) {
        const a = document.createElement('a');
        a.href = 'article.html?slug=' + encodeURIComponent(newer.slug);
        a.className = 'article-nav__link article-nav__link--next';
        a.innerHTML = '<span class="article-nav__label">下一篇</span><span class="article-nav__arrow">&rarr;</span>';
        nav.appendChild(a);
      } else {
        const span = document.createElement('span');
        span.className = 'article-nav__link article-nav__link--disabled';
        nav.appendChild(span);
      }

      contentEl.appendChild(nav);
    }
  }

  // ----- About page init -----
  function initAbout() {
    initTheme();
    initMobileNav();
  }

  // ----- Boot -----
  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.articles-list')) {
      initHome();
    } else if (document.querySelector('.article-page')) {
      initArticle();
    } else if (document.querySelector('.about-page')) {
      initAbout();
    }
  });
})();
