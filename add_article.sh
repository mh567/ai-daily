#!/bin/bash
# AI Daily 文章发布脚本
# 用法: ./add_article.sh <article_file.md>

if [ $# -eq 0 ]; then
    echo "用法: $0 <article_file.md>"
    echo "示例: $0 my_article.md"
    exit 1
fi

ARTICLE_FILE="$1"

# 检查文件是否存在
if [ ! -f "$ARTICLE_FILE" ]; then
    echo "错误: 文件 $ARTICLE_FILE 不存在"
    exit 1
fi

# 检查文件是否是 markdown 文件
if [[ ! "$ARTICLE_FILE" =~ \.md$ ]]; then
    echo "错误: 文件必须是 .md 格式"
    exit 1
fi

# 复制文章到 articles 目录
cp "$ARTICLE_FILE" articles/

# 重新生成 articles.json
python3 generate_articles_json.py

# 提交更改
git add articles/ articles.json
git commit -m "添加文章: $(basename "$ARTICLE_FILE" .md)"

# 推送到 GitHub
git push origin main

echo "✅ 文章已发布！"
echo "📝 文章: $ARTICLE_FILE"
echo "📊 文章总数: $(ls articles/*.md | wc -l | tr -d ' ')"