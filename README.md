# 斯坦福 AI 课程地图

把斯坦福 10 门 AI 核心课程整理成一张可视化地图，内容包括课程周期表、依赖图谱、课程档案（附公开视频和 GitHub 仓库链接）、对比矩阵和学习路线。

在线访问：https://meetrust.github.io/stanford-ai-courses/

## 项目结构

```
index.html                     单文件页面（HTML + CSS + JS；图表全部为原生 HTML/CSS + 内联 SVG，只有 Google Fonts 走 CDN）
tools/audit.js                 交付前的自动审计脚本（Playwright）
.github/workflows/deploy-pages.yml   推送到 main 后自动部署到 GitHub Pages
```

页面没有构建步骤，`index.html` 就是最终产物。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

## 部署

推送到 `main` 分支后，GitHub Actions 会把 `index.html` 打包并发布到 GitHub Pages；也可以在 Actions 页面手动运行 “Deploy to GitHub Pages”。

## 审计

```bash
npm i -D playwright
node tools/audit.js http://localhost:8000/ 1440   # 桌面宽度
node tools/audit.js http://localhost:8000/ 390    # 手机宽度
```

脚本会检查中英文排版、字符图标、元素尺寸、截断、横向溢出、课程数据在各区块之间的一致性、锚点与外链。

## 设计

页面遵循 Tight Surface 设计规范（暗夜底色、单一琥珀强调色、信息优先），与[《大模型可视化学习指南》](https://meetrust.github.io/llm-visual-guide/)属于同一设计系列。

课程链接核对于 2026-11-03。
