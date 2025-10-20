# GitHub OAuth App 配置指南

## 🔧 创建GitHub OAuth App

### 步骤1：创建OAuth App

1. **访问GitHub设置**：
   - 登录GitHub
   - 点击右上角头像 → Settings
   - 左侧菜单找到 "Developer settings"
   - 点击 "OAuth Apps"

2. **创建新的OAuth App**：
   - 点击 "New OAuth App"
   - 填写以下信息：
     - **Application name**: `FL-510 软件文档`
     - **Homepage URL**: `https://naruto-ai-wy.github.io/fl510-docs/`
     - **Authorization callback URL**: `https://naruto-ai-wy.github.io/fl510-docs/`
   - 点击 "Register application"

3. **获取Client ID**：
   - 创建成功后，您会看到 "Client ID"
   - 复制这个Client ID

### 步骤2：配置认证系统

1. **更新配置文件**：
   编辑 `docs/javascripts/auth-config.js` 文件
   
   ```javascript
   window.AUTH_CONFIG = {
     // 将 YOUR_GITHUB_CLIENT_ID 替换为实际的Client ID
     clientId: 'YOUR_ACTUAL_CLIENT_ID',
     
     // 设置正确的重定向URI
     redirectUri: 'https://naruto-ai-wy.github.io/fl510-docs/',
     
     // 配置允许访问的用户
     allowedUsers: [
       'Naruto-AI-WY', // 您的GitHub用户名
       // 添加其他需要访问的用户名
     ],
     
     // 管理员用户列表
     adminUsers: [
       'Naruto-AI-WY', // 您的GitHub用户名
     ],
   };
   ```

2. **提交更改**：
   ```bash
   git add .
   git commit -m "Add GitHub OAuth authentication"
   git push
   ```

### 步骤3：测试认证系统

1. **访问网站**：
   - 打开 https://naruto-ai-wy.github.io/fl510-docs/
   - 应该看到登录界面

2. **登录测试**：
   - 点击 "使用GitHub登录"
   - 授权应用访问您的GitHub账户
   - 登录成功后应该看到用户信息和管理按钮

## 🔐 安全配置

### 用户权限管理

1. **添加授权用户**：
   - 登录后点击 "⚙️ 管理" 按钮
   - 在 "用户管理" 标签页添加其他GitHub用户名

2. **管理员权限**：
   - 只有 `adminUsers` 列表中的用户才能看到管理按钮
   - 管理员可以添加/移除其他用户

### 访问控制

- **未登录用户**：无法访问任何内容
- **授权用户**：可以查看所有文档
- **管理员**：可以管理用户和系统设置

## 🛠️ 故障排除

### 常见问题

1. **"您没有访问权限"**：
   - 检查用户名是否在 `allowedUsers` 列表中
   - 确认GitHub用户名拼写正确

2. **OAuth错误**：
   - 检查Client ID是否正确
   - 确认回调URL与GitHub OAuth App设置一致

3. **管理面板不显示**：
   - 确认用户是否在 `adminUsers` 列表中
   - 检查浏览器控制台是否有JavaScript错误

### 调试方法

1. **检查浏览器控制台**：
   - 按F12打开开发者工具
   - 查看Console标签页的错误信息

2. **检查认证状态**：
   - 在控制台输入 `window.githubAuth` 查看认证对象
   - 检查 `localStorage.getItem('fl510_docs_auth')` 查看存储的认证信息

## 📝 注意事项

1. **Client Secret**：
   - 由于这是前端应用，不需要Client Secret
   - 但要注意保护Client ID

2. **HTTPS要求**：
   - GitHub OAuth要求使用HTTPS
   - GitHub Pages默认提供HTTPS

3. **权限范围**：
   - 当前只请求 `user:email` 权限
   - 足够获取用户基本信息

## 🔄 更新配置

如果需要修改配置：

1. 编辑 `docs/javascripts/auth-config.js`
2. 提交并推送更改
3. 等待GitHub Pages重新部署

配置更改会在下次访问时生效。
