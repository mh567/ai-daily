# AI Daily

专业的 AI 资讯日报，聚焦大模型、医疗 AI、开源生态与产业变革。

## 项目结构

```
ai-daily/
├── index.html              # 首页（文章列表 + 分类筛选）
├── article.html            # 文章详情页（Markdown 渲染）
├── about.html              # 关于页面
├── css/
│   └── style.css           # 全局样式（含深色/浅色主题）
├── js/
│   └── app.js              # 前端逻辑（文章加载、筛选、主题切换）
├── articles/
│   ├── 2026-04-15-claude-4-opus.md
│   ├── 2026-04-12-ai-patient-diagnosis.md
│   └── 2026-04-10-open-source-llm.md
└── assets/                 # 静态资源（图片等）
```

## 功能

- **文章列表**：按日期倒序展示所有文章，支持分类筛选
- **文章详情**：Markdown 渲染，保留排版样式
- **深色/浅色主题**：自动跟随系统偏好，支持手动切换，状态持久化到 localStorage
- **响应式布局**：适配桌面、平板和移动端

## 添加新文章

1. 在 `articles/` 目录下创建 Markdown 文件，命名格式为 `YYYY-MM-DD-slug.md`
2. 文件头部添加 frontmatter：

```yaml
---
title: "文章标题"
date: "2026-04-15"
category: "大模型"
excerpt: "一句话摘要，用于列表页展示。"
author: "AI Daily 编辑部"
---
```

3. 在 `js/app.js` 的 `ARTICLES` 数组中添加文件路径：

```js
const ARTICLES = [
  'articles/2026-04-15-claude-4-opus.md',
  'articles/2026-04-12-your-new-article.md',  // 添加新路径
];
```

## 本地预览

由于使用了 `fetch()` 加载文章，需要通过 HTTP 服务器访问：

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

然后在浏览器中打开 `http://localhost:8000`。

## 设计风格

参考 Linear / Vercel 官网，采用简洁、专业、编辑杂志风格的设计语言：

- **字体**：Newsreader（标题衬线体）、DM Sans（正文无衬线体）、JetBrains Mono（等宽）
- **配色**：暖灰色调，朱砂色（#C4553A）作为强调色
- **动效**：入场动画、hover 过渡、主题切换平滑过渡

## 许可

内容采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可协议。
