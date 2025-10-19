# FL-510 软件文档部署指南

## 部署到GitHub Pages

### 步骤1：在GitHub上创建仓库

1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `fl510-docs` (或您喜欢的名称)
   - **Description**: `FL-510 软件分层文档`
   - **Visibility**: 选择 `Public` (公开访问)
   - **不要**勾选 "Add a README file" (我们已经有了)
4. 点击 "Create repository"

### 步骤2：推送代码到GitHub

在终端中运行以下命令（替换 `YOUR_USERNAME` 为您的GitHub用户名）：

```bash
# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/fl510-docs.git

# 推送代码到GitHub
git push -u origin main
```

### 步骤3：启用GitHub Pages

1. 在GitHub仓库页面，点击 "Settings" 标签
2. 在左侧菜单中找到 "Pages"
3. 在 "Source" 部分，选择 "GitHub Actions"
4. 保存设置

### 步骤4：自动部署

推送代码后，GitHub Actions会自动：
1. 安装MkDocs和Material主题
2. 构建文档网站
3. 部署到GitHub Pages

### 步骤5：访问网站

部署完成后，您的网站将在以下地址可用：
`https://YOUR_USERNAME.github.io/fl510-docs/`

## 本地开发

### 安装依赖

```bash
pip install mkdocs-material
```

### 本地预览

```bash
mkdocs serve
```

访问 http://localhost:8000 查看本地预览

### 构建静态文件

```bash
mkdocs build
```

## 更新文档

1. 修改文档文件
2. 提交更改：
   ```bash
   git add .
   git commit -m "Update documentation"
   git push
   ```
3. GitHub Actions会自动重新部署网站

## 故障排除

### 如果部署失败
1. 检查GitHub Actions日志
2. 确保所有依赖都正确安装
3. 检查mkdocs.yml配置是否正确

### 如果数学公式不显示
1. 确保MathJax配置正确
2. 检查浏览器控制台是否有JavaScript错误
