// 管理功能模块
class AdminPanel {
  constructor(auth) {
    this.auth = auth;
    this.isVisible = false;
    this.init();
  }

  init() {
    if (this.auth.isAdmin) {
      this.loadSavedConfig();
      this.createAdminButton();
    }
  }

  // 加载保存的配置
  loadSavedConfig() {
    const savedConfig = localStorage.getItem('fl510_docs_config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        // 合并保存的配置到当前配置
        if (parsedConfig.allowedUsers) {
          window.AUTH_CONFIG.allowedUsers = parsedConfig.allowedUsers;
        }
        if (parsedConfig.adminUsers) {
          window.AUTH_CONFIG.adminUsers = parsedConfig.adminUsers;
        }
        console.log('Loaded saved config:', parsedConfig);
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    }
  }

  // 创建管理员按钮
  createAdminButton() {
    // 检查是否已经存在管理员按钮
    const existingBtn = document.getElementById('admin-toggle-btn');
    if (existingBtn) {
      return; // 按钮已存在，不需要重复创建
    }

    // 查找用户信息区域
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      const actionsContainer = userInfo.querySelector('.user-actions');
      if (actionsContainer) {
        // 如果存在actions容器，直接添加按钮
        const adminBtn = document.createElement('button');
        adminBtn.id = 'admin-toggle-btn';
        adminBtn.innerHTML = '⚙️ 管理';
        adminBtn.className = 'admin-toggle-btn';
        adminBtn.title = '管理面板';
        adminBtn.onclick = () => this.toggleAdminPanel();
        
        // 插入到退出按钮之前
        const logoutBtn = actionsContainer.querySelector('.logout-btn');
        if (logoutBtn) {
          actionsContainer.insertBefore(adminBtn, logoutBtn);
        } else {
          actionsContainer.appendChild(adminBtn);
        }
      }
    }
  }

  // 切换管理面板
  toggleAdminPanel() {
    if (this.isVisible) {
      this.hideAdminPanel();
    } else {
      this.showAdminPanel();
    }
  }

  // 显示管理面板
  showAdminPanel() {
    this.loadSavedConfig(); // 确保显示前加载最新配置
    this.createAdminModal();
    this.isVisible = true;
  }

  // 隐藏管理面板
  hideAdminPanel() {
    const modal = document.getElementById('admin-modal');
    if (modal) {
      modal.remove();
    }
    this.isVisible = false;
  }

  // 创建管理模态框
  createAdminModal() {
    // 移除已存在的模态框
    const existingModal = document.getElementById('admin-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'admin-modal';
    modal.innerHTML = `
      <div class="admin-modal-overlay">
        <div class="admin-modal-content">
          <div class="admin-modal-header">
            <h3>🔧 管理面板</h3>
            <button class="close-btn" onclick="window.adminPanel.hideAdminPanel()">×</button>
          </div>
          <div class="admin-modal-body">
            <div class="admin-tabs">
              <button class="tab-btn active" data-tab="users">用户管理</button>
              <button class="tab-btn" data-tab="content">内容管理</button>
              <button class="tab-btn" data-tab="settings">系统设置</button>
              <button class="tab-btn" data-tab="sync">配置同步</button>
            </div>
            <div class="admin-content">
              <div id="users-tab" class="tab-content active">
                ${this.createUsersTab()}
              </div>
              <div id="content-tab" class="tab-content">
                ${this.createContentTab()}
              </div>
              <div id="settings-tab" class="tab-content">
                ${this.createSettingsTab()}
              </div>
              <div id="sync-tab" class="tab-content">
                ${this.createSyncTab()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.addAdminStyles();
    this.setupAdminEvents();
  }

  // 创建用户管理标签页
  createUsersTab() {
    return `
      <div class="admin-section">
        <h4>👥 用户权限管理</h4>
        <div class="user-list">
          <div class="user-item">
            <span class="user-name">当前用户: ${this.auth.user.login}</span>
            <span class="user-role">管理员</span>
          </div>
        </div>
        <div class="add-user-section">
          <h5>添加授权用户</h5>
          <div class="input-group">
            <input type="text" id="new-username" placeholder="GitHub用户名">
            <button onclick="window.adminPanel.addUser()">添加</button>
          </div>
          <p class="help-text">💡 输入GitHub用户名，系统会自动验证用户是否存在</p>
        </div>
        <div class="authorized-users">
          <h5>授权用户列表 (${window.AUTH_CONFIG.allowedUsers.length} 个用户)</h5>
          <div id="authorized-users-list">
            ${this.getAuthorizedUsersList()}
          </div>
        </div>
      </div>
    `;
  }

  // 创建内容管理标签页
  createContentTab() {
    return `
      <div class="admin-section">
        <h4>📄 内容管理</h4>
        <div class="content-actions">
          <button onclick="window.adminPanel.refreshContent()" class="action-btn">
            🔄 刷新内容
          </button>
          <button onclick="window.adminPanel.exportContent()" class="action-btn">
            📤 导出内容
          </button>
          <button onclick="window.adminPanel.importContent()" class="action-btn">
            📥 导入内容
          </button>
        </div>
        <div class="content-stats">
          <h5>内容统计</h5>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">总页面数</span>
              <span class="stat-value" id="total-pages">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">服务数量</span>
              <span class="stat-value" id="total-services">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最后更新</span>
              <span class="stat-value" id="last-update">-</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 创建系统设置标签页
  createSettingsTab() {
    return `
      <div class="admin-section">
        <h4>⚙️ 系统设置</h4>
        <div class="settings-group">
          <h5>认证设置</h5>
          <div class="setting-item">
            <label>
              <input type="checkbox" id="require-auth" checked>
              要求登录访问
            </label>
          </div>
          <div class="setting-item">
            <label>
              <input type="checkbox" id="allow-guest">
              允许访客访问
            </label>
          </div>
        </div>
        <div class="settings-group">
          <h5>显示设置</h5>
          <div class="setting-item">
            <label>
              主题模式:
              <select id="theme-mode">
                <option value="auto">自动</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
          </div>
        </div>
        <div class="settings-actions">
          <button onclick="window.adminPanel.saveSettings()" class="save-btn">
            💾 保存设置
          </button>
          <button onclick="window.adminPanel.resetSettings()" class="reset-btn">
            🔄 重置设置
          </button>
        </div>
      </div>
    `;
  }

  // 获取授权用户列表
  getAuthorizedUsersList() {
    const users = window.AUTH_CONFIG.allowedUsers || [];
    console.log('Getting authorized users list:', users);
    
    if (users.length === 0) {
      return '<div class="user-item"><span class="user-name">暂无授权用户</span></div>';
    }
    
    return users.map(user => `
      <div class="user-item">
        <span class="user-name">${user}</span>
        <button onclick="window.adminPanel.removeUser('${user}')" class="remove-btn">移除</button>
      </div>
    `).join('');
  }

  // 添加用户
  addUser() {
    const username = document.getElementById('new-username').value.trim();
    if (!username) {
      alert('请输入用户名');
      return;
    }

    // 检查用户是否已存在
    if (window.AUTH_CONFIG.allowedUsers.includes(username)) {
      alert('用户已在授权列表中');
      return;
    }

    // 验证GitHub用户名是否存在
    this.validateGitHubUser(username).then(isValid => {
      if (isValid) {
        // 添加用户到配置
        window.AUTH_CONFIG.allowedUsers.push(username);
        this.updateConfig();
        this.refreshUsersList();
        document.getElementById('new-username').value = '';
        alert(`用户 ${username} 已成功添加`);
      } else {
        alert(`GitHub用户名 ${username} 不存在，请检查输入`);
      }
    }).catch(error => {
      console.error('User validation error:', error);
      alert('验证用户时出错，请重试');
    });
  }

  // 验证GitHub用户是否存在
  async validateGitHubUser(username) {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      return response.ok;
    } catch (error) {
      console.error('GitHub API error:', error);
      return false;
    }
  }

  // 移除用户
  removeUser(username) {
    if (username === this.auth.user.login) {
      alert('不能移除自己的权限');
      return;
    }

    if (confirm(`确定要移除用户 ${username} 的访问权限吗？`)) {
      const index = window.AUTH_CONFIG.allowedUsers.indexOf(username);
      if (index > -1) {
        window.AUTH_CONFIG.allowedUsers.splice(index, 1);
        this.updateConfig();
        this.refreshUsersList();
        alert('用户已移除');
      }
    }
  }

  // 刷新用户列表
  refreshUsersList() {
    const list = document.getElementById('authorized-users-list');
    if (list) {
      const newContent = this.getAuthorizedUsersList();
      console.log('Refreshing users list with content:', newContent);
      list.innerHTML = newContent;
    } else {
      console.error('Authorized users list element not found');
    }
  }

  // 更新配置
  updateConfig() {
    // 保存配置到本地存储
    localStorage.setItem('fl510_docs_config', JSON.stringify(window.AUTH_CONFIG));
    
    // 通知认证系统配置已更新
    if (window.githubAuth) {
      // 重新加载配置
      window.githubAuth.config = window.AUTH_CONFIG;
      console.log('Configuration updated:', window.AUTH_CONFIG);
    }
    
    // 触发自定义事件通知其他组件
    window.dispatchEvent(new CustomEvent('configUpdated', {
      detail: { config: window.AUTH_CONFIG }
    }));
    
    // 如果启用了配置同步，同步到云端
    if (window.configSync && window.configSync.githubToken) {
      window.configSync.syncConfig();
    }
  }

  // 刷新内容
  refreshContent() {
    location.reload();
  }

  // 导出内容
  exportContent() {
    const data = {
      config: window.AUTH_CONFIG,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fl510-docs-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // 导入内容
  importContent() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.config) {
              Object.assign(window.AUTH_CONFIG, data.config);
              this.updateConfig();
              alert('配置已导入');
              location.reload();
            }
          } catch (error) {
            alert('配置文件格式错误');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  // 保存设置
  saveSettings() {
    const settings = {
      requireAuth: document.getElementById('require-auth').checked,
      allowGuest: document.getElementById('allow-guest').checked,
      themeMode: document.getElementById('theme-mode').value
    };
    localStorage.setItem('fl510_docs_settings', JSON.stringify(settings));
    alert('设置已保存');
  }

  // 重置设置
  resetSettings() {
    if (confirm('确定要重置所有设置吗？')) {
      localStorage.removeItem('fl510_docs_settings');
      localStorage.removeItem('fl510_docs_config');
      alert('设置已重置');
      location.reload();
    }
  }

  // 设置管理事件
  setupAdminEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // 点击模态框外部关闭
    document.getElementById('admin-modal').addEventListener('click', (e) => {
      if (e.target.id === 'admin-modal') {
        this.hideAdminPanel();
      }
    });
  }

  // 切换标签页
  switchTab(tabName) {
    // 移除所有活动状态
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 激活选中的标签页
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  // 添加管理面板样式
  addAdminStyles() {
    if (document.getElementById('admin-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'admin-styles';
    styles.textContent = `
      /* 管理员按钮样式 */
      .admin-toggle-btn {
        background: #6f42c1;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .admin-toggle-btn:hover {
        background: #5a32a3;
      }

      /* 管理模态框样式 */
      #admin-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10001;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .admin-modal-overlay {
        background: white;
        border-radius: 12px;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }

      .admin-modal-header {
        background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
        color: white;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .admin-modal-header h3 {
        margin: 0;
        font-size: 20px;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .admin-modal-body {
        padding: 0;
        max-height: 60vh;
        overflow-y: auto;
      }

      .admin-tabs {
        display: flex;
        border-bottom: 1px solid #e1e4e8;
      }

      .tab-btn {
        flex: 1;
        background: none;
        border: none;
        padding: 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #586069;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }

      .tab-btn.active {
        color: #6f42c1;
        border-bottom-color: #6f42c1;
        background: #f8f9fa;
      }

      .tab-btn:hover {
        background: #f8f9fa;
      }

      .admin-content {
        padding: 24px;
      }

      .tab-content {
        display: none;
      }

      .tab-content.active {
        display: block;
      }

      .admin-section {
        margin-bottom: 32px;
      }

      .admin-section h4 {
        margin: 0 0 16px 0;
        color: #24292e;
        font-size: 18px;
      }

      .admin-section h5 {
        margin: 16px 0 8px 0;
        color: #586069;
        font-size: 14px;
        font-weight: 600;
      }

      .user-list, .authorized-users {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
      }

      .user-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #e1e4e8;
      }

      .user-item:last-child {
        border-bottom: none;
      }

      .user-name {
        font-weight: 500;
        color: #24292e;
      }

      .user-role {
        background: #28a745;
        color: white;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 12px;
      }

      .remove-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .input-group {
        display: flex;
        gap: 8px;
        margin: 12px 0;
      }

      .input-group input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #d1d5da;
        border-radius: 6px;
        font-size: 14px;
      }

      .input-group button {
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .input-group button:hover {
        background: #218838;
      }

      .help-text {
        font-size: 12px;
        color: #586069;
        margin: 8px 0 0 0;
        font-style: italic;
      }

      .content-actions {
        display: flex;
        gap: 12px;
        margin: 16px 0;
        flex-wrap: wrap;
      }

      .action-btn {
        background: #0366d6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .action-btn:hover {
        background: #0256cc;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin: 16px 0;
      }

      .stat-item {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        text-align: center;
      }

      .stat-label {
        display: block;
        font-size: 12px;
        color: #586069;
        margin-bottom: 4px;
      }

      .stat-value {
        display: block;
        font-size: 20px;
        font-weight: 600;
        color: #24292e;
      }

      .settings-group {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        margin: 16px 0;
      }

      .setting-item {
        margin: 12px 0;
      }

      .setting-item label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .setting-item input[type="checkbox"] {
        margin: 0;
      }

      .setting-item select {
        padding: 4px 8px;
        border: 1px solid #d1d5da;
        border-radius: 4px;
        margin-left: 8px;
      }

      .settings-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }

      .save-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }

      .reset-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }

      /* 响应式设计 */
      @media (max-width: 768px) {
        .admin-modal-overlay {
          width: 95%;
          max-height: 90vh;
        }
        
        .admin-tabs {
          flex-direction: column;
        }
        
        .content-actions {
          flex-direction: column;
        }
        
        .stats-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(styles);
  }
}

// 在认证成功后初始化管理面板
document.addEventListener('DOMContentLoaded', () => {
  // 等待认证系统初始化
  setTimeout(() => {
    if (window.githubAuth && window.githubAuth.isAuthenticated && window.githubAuth.isAdmin) {
      window.adminPanel = new AdminPanel(window.githubAuth);
    }
  }, 1000);
});

// 监听用户信息创建完成事件
window.addEventListener('userInfoCreated', () => {
  // 如果用户是管理员，确保管理面板已初始化
  if (window.githubAuth && window.githubAuth.isAdmin) {
    // 如果管理面板不存在，创建它
    if (!window.adminPanel) {
      console.log('Creating admin panel for admin user');
      window.adminPanel = new AdminPanel(window.githubAuth);
    }
    
    // 创建管理员按钮
    if (window.adminPanel) {
      window.adminPanel.createAdminButton();
    }
  }
});

// 添加配置同步标签页方法
AdminPanel.prototype.createSyncTab = function() {
  const isSyncEnabled = window.configSync && window.configSync.githubToken;
  
  return `
    <div class="admin-section">
      <h4>🔗 跨浏览器配置同步</h4>
      <div class="sync-status">
        <p><strong>当前状态：</strong> ${isSyncEnabled ? '✅ 已启用同步' : '❌ 未启用同步'}</p>
      </div>
      
      ${!isSyncEnabled ? `
        <div class="sync-setup">
          <h5>设置GitHub同步</h5>
          <p>为了在不同浏览器间同步用户配置，需要设置GitHub Personal Access Token：</p>
          <ol>
            <li>访问 <a href="https://github.com/settings/tokens" target="_blank">GitHub Token设置</a></li>
            <li>点击 "Generate new token" → "Generate new token (classic)"</li>
            <li>选择 "gist" 权限</li>
            <li>复制生成的token</li>
            <li>在下方输入框中粘贴token</li>
          </ol>
          <div class="token-input">
            <input type="password" id="github-token-input" placeholder="输入GitHub Personal Access Token">
            <button onclick="window.configSync.setupSync()">启用同步</button>
          </div>
        </div>
      ` : `
        <div class="sync-actions">
          <h5>同步操作</h5>
          <div class="sync-buttons">
            <button onclick="window.configSync.syncConfig()" class="sync-btn">🔄 立即同步</button>
            <button onclick="window.configSync.loadConfig()" class="sync-btn">📥 从云端加载</button>
            <button onclick="window.configSync.disableSync()" class="sync-btn danger">❌ 禁用同步</button>
          </div>
        </div>
      `}
      
      <div class="sync-info">
        <h5>同步说明</h5>
        <ul>
          <li>✅ 配置会自动保存到您的GitHub Gist中</li>
          <li>✅ 在任何浏览器登录后都能访问相同的用户配置</li>
          <li>✅ 配置是私有的，只有您能访问</li>
          <li>⚠️ 需要GitHub账号和Personal Access Token</li>
        </ul>
      </div>
    </div>
  `;
};