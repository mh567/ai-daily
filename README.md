# AI Daily - AI 领域每日进展速递

专业的 AI 资讯日报，聚焦大模型、医疗 AI、开源生态与产业变革。

## 🌐 访问地址

- **主站**: http://ai-daily.cn (HTTP 可用，HTTPS 证书问题待修复)
- **备用**: https://mh567.github.io/ai-daily/

## 📁 项目结构

```
ai-daily/
├── articles/           # 文章目录（Markdown 格式）
├── articles.json       # 自动生成的文章索引
├── css/style.css       # 样式文件
├── js/app.js          # 前端逻辑
├── index.html         # 首页
├── article.html       # 文章详情页
├── about.html         # 关于页面
├── generate_articles_json.py  # 生成文章索引的脚本
├── add_article.sh     # 文章发布脚本
├── templates/         # 文章模板
└── .github/workflows/ # GitHub Actions 自动化
```

## 📝 添加新文章

### 方法 1: 使用发布脚本（推荐）

```bash
# 1. 创建文章（参考模板）
cp templates/daily_digest_template.md articles/2026-04-17-daily-digest.md

# 2. 编辑文章内容
vim articles/2026-04-17-daily-digest.md

# 3. 发布文章
./add_article.sh articles/2026-04-17-daily-digest.md
```

### 方法 2: 手动发布

```bash
# 1. 将文章放入 articles/ 目录
# 2. 重新生成 articles.json
python3 generate_articles_json.py

# 3. 提交并推送
git add articles/ articles.json
git commit -m "添加新文章"
git push origin main
```

## 📋 文章格式

每篇文章需要包含 YAML frontmatter：

```yaml
---
title: "文章标题"
date: "YYYY-MM-DD"
category: "分类"
excerpt: "简短摘要"
author: "作者"
---
```

支持的分类：`日报`, `大模型`, `医疗 AI`, `开源`, `产业`, `研究`

## 🔧 本地开发

```bash
# 启动本地服务器
python3 -m http.server 8000

# 访问 http://localhost:8000
```

## 🔄 自动化

项目配置了 GitHub Actions：
- 当 `articles/` 目录有新的 `.md` 文件推送时，自动重新生成 `articles.json`
- 无需手动运行脚本

## 📊 当前状态

- ✅ 文章加载正常
- ✅ 文章列表显示正常
- ✅ 文章详情页正常
- ⚠️ 自定义域名 HTTPS 证书问题（HTTP 可用）
- ✅ GitHub Actions 自动化已配置

## 🚀 部署

网站通过 GitHub Pages 自动部署：
- 推送到 `main` 分支后自动部署
- 自定义域名：`ai-daily.cn`
- 使用 `.nojekyll` 文件禁用 Jekyll 处理

## 📞 联系方式

- GitHub: [mh567/ai-daily](https://github.com/mh567/ai-daily)