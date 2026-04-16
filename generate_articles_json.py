#!/usr/bin/env python3
"""
扫描 articles 目录，生成 articles.json
用法：python3 generate_articles_json.py
"""

import os
import json
import re
from datetime import datetime

ARTICLES_DIR = os.path.join(os.path.dirname(__file__), 'articles')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'articles.json')

def parse_frontmatter(content):
    """解析 YAML frontmatter"""
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if not match:
        return {}
    
    frontmatter = {}
    for line in match.group(1).split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip().strip('"\'')
            frontmatter[key] = value
    
    return frontmatter

def get_articles():
    """扫描 articles 目录，提取文章信息"""
    articles = []
    
    if not os.path.exists(ARTICLES_DIR):
        return articles
    
    for filename in os.listdir(ARTICLES_DIR):
        if not filename.endswith('.md'):
            continue
        
        filepath = os.path.join(ARTICLES_DIR, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            meta = parse_frontmatter(content)
            
            # 从文件名提取 slug（去掉日期前缀和 .md 后缀）
            slug = filename.replace('.md', '')
            
            articles.append({
                'slug': slug,
                'path': f'articles/{filename}',
                'title': meta.get('title', slug),
                'date': meta.get('date', ''),
                'category': meta.get('category', ''),
                'excerpt': meta.get('excerpt', ''),
                'author': meta.get('author', '')
            })
        except Exception as e:
            print(f'Error reading {filename}: {e}')
    
    # 按日期降序排序
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    return articles

def main():
    articles = get_articles()
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f'Generated {OUTPUT_FILE} with {len(articles)} articles')
    for article in articles:
        print(f"  - {article['date']} | {article['title']}")

if __name__ == '__main__':
    main()
