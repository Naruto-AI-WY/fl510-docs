// GitHub OAuth认证核心功能
class GitHubAuth {
  constructor() {
    this.config = window.AUTH_CONFIG;
    this.user = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.loadSavedConfig().catch(error => {
      console.warn('Error loading saved config:', error);
    });
    this.init();
  }

  init() {
    this.checkAuthStatus();
    this.setupAuthCheck();
    this.handleAuthCallback();
    this.setupConfigListener();
    this.setupPageNavigationListener();
  }

  // 设置配置更新监听器
  setupConfigListener() {
    window.addEventListener('configUpdated', (event) => {
      console.log('Config updated event received:', event.detail);
      if (event.detail && event.detail.config) {
        this.config.allowedUsers = event.detail.config.allowedUsers || this.config.allowedUsers;
        this.config.adminUsers = event.detail.config.adminUsers || this.config.adminUsers;
        console.log('Updated config from event:', this.config);
      }
    });
  }

  // 设置页面跳转监听器
  setupPageNavigationListener() {
    // 监听页面变化（适用于单页应用或动态内容加载）
    const observer = new MutationObserver((mutations) => {
      let shouldRecreate = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 检查是否有新的主要内容被添加
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              if (node.classList && (
                node.classList.contains('md-main') ||
                node.classList.contains('md-content') ||
                node.classList.contains('md-container')
              )) {
                shouldRecreate = true;
              }
            }
          });
        }
      });
      
      if (shouldRecreate && this.isAuthenticated) {
        console.log('Page content changed, recreating user info');
        setTimeout(() => {
          this.createUserInfo();
          this.forceRepositionUserInfo();
        }, 100);
      }
    });

    // 开始观察body的变化
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听popstate事件（浏览器前进/后退）
    window.addEventListener('popstate', () => {
      if (this.isAuthenticated) {
        console.log('Page navigation detected, recreating user info');
        setTimeout(() => {
          this.createUserInfo();
          this.forceRepositionUserInfo();
        }, 100);
      }
    });
  }

  // 加载保存的配置
  async loadSavedConfig() {
    try {
      console.log('Loading configuration...');
      
      // 优先从服务器（GitHub Gist）加载配置
      const serverConfig = await this.loadConfigFromServer();
      if (serverConfig) {
        console.log('Loaded config from server:', serverConfig);
        this.applyConfig(serverConfig);
        return;
      }
      
      // 如果服务器加载失败，尝试从本地存储加载
      const savedConfig = localStorage.getItem('fl510_docs_config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        console.log('Loading saved config from localStorage:', parsedConfig);
        this.applyConfig(parsedConfig);
        
        // 如果本地有配置但服务器没有，尝试同步到服务器
        if (window.configSync && window.configSync.githubToken) {
          console.log('Syncing local config to server...');
          this.syncConfigToServer();
        }
      } else {
        // 如果都没有配置，检查是否需要设置云端同步
        this.checkCloudSyncSetup();
      }
    } catch (error) {
      console.error('Error loading saved config:', error);
    }
  }

  // 从服务器加载配置
  async loadConfigFromServer() {
    try {
      // 使用GitHub用户管理器加载配置
      if (window.githubUsersManager) {
        console.log('Loading config from GitHub...');
        const success = await window.githubUsersManager.syncUsersFromGitHub();
        if (success) {
          console.log('Config loaded from GitHub successfully');
          return true;
        }
      }
      
      console.log('No GitHub config found');
      return null;
    } catch (error) {
      console.error('Failed to load config from server:', error);
      return null;
    }
  }

  // 应用配置到系统
  applyConfig(config) {
    if (config.allowedUsers) {
      this.config.allowedUsers = config.allowedUsers;
      console.log('Updated allowed users:', this.config.allowedUsers);
    }
    if (config.adminUsers) {
      this.config.adminUsers = config.adminUsers;
      console.log('Updated admin users:', this.config.adminUsers);
    }
    
    // 更新全局配置
    if (window.AUTH_CONFIG) {
      window.AUTH_CONFIG.allowedUsers = this.config.allowedUsers;
      window.AUTH_CONFIG.adminUsers = this.config.adminUsers;
    }
  }

  // 同步配置到服务器
  async syncConfigToServer() {
    try {
      // 使用GitHub用户管理器同步配置
      if (window.githubUsersManager) {
        console.log('Syncing config to GitHub...');
        const success = await window.githubUsersManager.syncUsersFromGitHub();
        if (success) {
          console.log('Config synced to GitHub successfully');
        } else {
          console.log('Failed to sync config to GitHub');
        }
      } else {
        console.log('No GitHub sync available');
      }
    } catch (error) {
      console.error('Failed to sync config to server:', error);
    }
  }

  // 检查云端同步设置
  checkCloudSyncSetup() {
    // 如果用户是管理员且没有设置云端同步，显示提示
    if (this.isAdmin && (!window.configSync || !window.configSync.githubToken)) {
      setTimeout(() => {
        this.showCloudSyncPrompt();
      }, 2000); // 延迟2秒显示，避免干扰登录流程
    }
  }

  // 显示云端同步设置提示
  showCloudSyncPrompt() {
    const modal = document.createElement('div');
    modal.id = 'cloud-sync-prompt';
    modal.innerHTML = `
      <div class="cloud-sync-overlay">
        <div class="cloud-sync-modal">
          <div class="cloud-sync-header">
            <h3>🔗 配置云端同步</h3>
            <button class="close-btn" onclick="this.closest('#cloud-sync-prompt').remove()">×</button>
          </div>
          <div class="cloud-sync-body">
            <div class="sync-warning">
              <p><strong>⚠️ 重要提示：</strong></p>
              <p>您添加的用户配置目前只保存在浏览器本地，清除浏览器记录后会丢失。</p>
              <p>建议设置云端同步，这样在任何浏览器和设备上都能访问相同的用户配置。</p>
            </div>
            <div class="sync-benefits">
              <h4>云端同步的优势：</h4>
              <ul>
                <li>✅ 跨浏览器同步：Chrome、Safari、Firefox等</li>
                <li>✅ 跨设备同步：手机、平板、电脑</li>
                <li>✅ 数据安全：配置保存在您的GitHub账号中</li>
                <li>✅ 自动备份：不会因清除浏览器记录而丢失</li>
              </ul>
            </div>
            <div class="sync-actions">
              <button onclick="window.adminPanel && window.adminPanel.showAdminPanel(); this.closest('#cloud-sync-prompt').remove();" class="setup-sync-btn">
                🔧 立即设置云端同步
              </button>
              <button onclick="this.closest('#cloud-sync-prompt').remove();" class="skip-btn">
                稍后设置
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.addCloudSyncStyles();
  }

  // 添加云端同步提示样式
  addCloudSyncStyles() {
    if (document.getElementById('cloud-sync-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'cloud-sync-styles';
    styles.textContent = `
      .cloud-sync-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
      }

      .cloud-sync-modal {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }

      .cloud-sync-header {
        background: linear-gradient(135deg, #0366d6, #28a745);
        color: white;
        padding: 20px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .cloud-sync-header h3 {
        margin: 0;
        font-size: 18px;
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

      .cloud-sync-body {
        padding: 24px;
      }

      .sync-warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 20px;
      }

      .sync-warning p {
        margin: 8px 0;
        color: #856404;
      }

      .sync-benefits {
        background: #e3f2fd;
        padding: 16px;
        border-radius: 6px;
        margin-bottom: 20px;
      }

      .sync-benefits h4 {
        margin: 0 0 12px 0;
        color: #1976d2;
      }

      .sync-benefits ul {
        margin: 0;
        padding-left: 20px;
      }

      .sync-benefits li {
        margin: 4px 0;
        color: #424242;
      }

      .sync-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .setup-sync-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }

      .skip-btn {
        background: #6c757d;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
    `;

    document.head.appendChild(styles);
  }

  // 检查当前认证状态
  checkAuthStatus() {
    console.log('Checking auth status...');
    const authData = localStorage.getItem(this.config.authStorageKey);
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        console.log('Auth data found:', parsed);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          this.user = parsed.user;
          this.isAuthenticated = true;
          this.isAdmin = this.config.adminUsers.includes(this.user.login);
          console.log('User authenticated:', this.user.login, 'Admin:', this.isAdmin);
          this.showAuthenticatedUI();
          return;
        } else {
          // 认证已过期，清除数据
          console.log('Auth expired, clearing data');
          localStorage.removeItem(this.config.authStorageKey);
        }
      } catch (e) {
        console.error('Auth data parse error:', e);
        localStorage.removeItem(this.config.authStorageKey);
      }
    } else {
      console.log('No auth data found');
    }
    
    this.showLoginUI();
  }

  // 显示登录界面
  showLoginUI() {
    this.hideContent();
    this.createLoginModal();
  }

  // 显示已认证界面
  showAuthenticatedUI() {
    console.log('Showing authenticated UI');
    this.showContent();
    this.createUserInfo();
    this.hideLoginModal();
    
    // 如果是管理员，初始化管理面板
    if (this.isAdmin && !window.adminPanel) {
      console.log('Initializing admin panel');
      setTimeout(() => {
        if (window.AdminPanel) {
          window.adminPanel = new window.AdminPanel(this);
        }
      }, 500);
    }
  }

  // 创建登录模态框
  createLoginModal() {
    // 移除已存在的模态框
    const existingModal = document.getElementById('auth-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-modal-overlay">
        <div class="auth-modal-content">
          <div class="auth-modal-header">
            <h2>🔐 FL-510 软件文档</h2>
            <p>请使用GitHub账户登录以访问文档</p>
          </div>
          <div class="auth-modal-body">
            <button id="github-login-btn" class="github-login-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 22.797 24 18.3 24 13c0-6.627-5.373-12-12-12z"/>
              </svg>
              输入GitHub用户名登录
            </button>
            <div class="auth-modal-footer">
              <p class="auth-note">只有授权用户可以访问此文档</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 添加样式
    this.addAuthStyles();

    // 绑定登录按钮事件
    document.getElementById('github-login-btn').addEventListener('click', () => {
      this.startGitHubAuth();
    });
  }

  // 开始GitHub OAuth流程
  startGitHubAuth() {
    // 由于GitHub OAuth需要后端支持，我们使用简化的手动认证
    this.showManualAuthForm();
  }

  // 处理OAuth回调
  handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      this.showAuthError('认证被取消或失败');
      return;
    }

    if (code && state) {
      // 由于GitHub OAuth需要Client Secret，我们使用简化的方法
      // 直接使用GitHub API获取用户信息（需要用户手动授权）
      this.getUserInfoFromGitHub();
    }
  }

  // 从GitHub获取用户信息（简化版本）
  async getUserInfoFromGitHub() {
    try {
      // 显示加载状态
      this.showLoadingState();
      
      // 使用GitHub API获取当前用户信息
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const user = await response.json();
        this.handleSuccessfulAuth(user);
      } else {
        // 如果无法直接获取用户信息，显示手动输入界面
        this.showManualAuthForm();
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.showManualAuthForm();
    }
  }

  // 显示手动认证表单
  showManualAuthForm() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      const body = modal.querySelector('.auth-modal-body');
      body.innerHTML = `
        <div class="manual-auth-form">
          <h4>手动认证</h4>
          <p>由于GitHub OAuth限制，请手动输入您的GitHub用户名：</p>
          <div class="input-group">
            <input type="text" id="github-username" placeholder="GitHub用户名" required>
            <button onclick="window.githubAuth.verifyManualAuth()" class="verify-btn">
              验证
            </button>
          </div>
          <div class="auth-note">
            <p>💡 提示：您可以在 <a href="https://github.com/settings/profile" target="_blank">GitHub个人资料</a> 中找到您的用户名</p>
          </div>
        </div>
      `;
    }
  }

  // 验证手动输入的认证
  async verifyManualAuth() {
    const username = document.getElementById('github-username').value.trim();
    if (!username) {
      alert('请输入GitHub用户名');
      return;
    }

    try {
      // 验证用户名是否存在
      const response = await fetch(`https://api.github.com/users/${username}`);
      if (response.ok) {
        const user = await response.json();
        console.log('GitHub API response:', user);
        console.log('Allowed users:', this.config.allowedUsers);
        console.log('User login:', user.login);
        this.handleSuccessfulAuth(user);
      } else {
        console.error('GitHub API error:', response.status, response.statusText);
        this.showAuthError('用户名不存在，请检查输入');
      }
    } catch (error) {
      console.error('Verification error:', error);
      this.showAuthError('验证失败，请重试');
    }
  }

  // 显示加载状态
  showLoadingState() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      const body = modal.querySelector('.auth-modal-body');
      body.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>正在验证身份...</p>
        </div>
      `;
    }
  }

  // 处理成功认证
  handleSuccessfulAuth(user) {
    // 检查用户权限
    if (!this.isUserAllowed(user)) {
      this.showAuthError('您没有访问权限');
      return;
    }

    // 保存认证信息
    const authData = {
      user: user,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24小时过期
    };
    localStorage.setItem(this.config.authStorageKey, JSON.stringify(authData));

    this.user = user;
    this.isAuthenticated = true;
    this.isAdmin = this.config.adminUsers.includes(user.login);
    
    console.log('Authentication successful for:', user.login);
    console.log('Is admin:', this.isAdmin);
    console.log('Admin users:', this.config.adminUsers);

    // 清理URL参数
    window.history.replaceState({}, document.title, window.location.pathname);

    this.showAuthenticatedUI();
  }

  // 检查用户是否被允许访问
  isUserAllowed(user) {
    console.log('Checking if user is allowed:', user.login);
    console.log('Current allowed users:', this.config.allowedUsers);
    
    // 检查用户是否在允许列表中
    const isAllowed = this.config.allowedUsers.includes(user.login);
    console.log('User allowed:', isAllowed);
    
    if (isAllowed) {
      return true;
    }

    // 检查用户是否属于允许的组织（需要额外的API调用）
    // 这里简化处理，只检查用户名列表
    console.log('User not in allowed list');
    return false;
  }

  // 显示认证错误
  showAuthError(message) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      const body = modal.querySelector('.auth-modal-body');
      body.innerHTML = `
        <div class="auth-error">
          <p>❌ ${message}</p>
          <button onclick="location.reload()" class="retry-btn">重试</button>
        </div>
      `;
    }
  }

  // 创建用户信息显示
  createUserInfo() {
    if (!this.user) return;

    // 移除已存在的用户信息
    const existingInfo = document.getElementById('user-info');
    if (existingInfo) {
      existingInfo.remove();
    }

    const userInfo = document.createElement('div');
    userInfo.id = 'user-info';
    userInfo.innerHTML = `
      <div class="user-info-container">
        <div class="user-avatar">
          <img src="${this.user.avatar_url}" alt="${this.user.login}" width="32" height="32">
        </div>
        <div class="user-details">
          <span class="user-name">${this.user.name || this.user.login}</span>
          ${this.isAdmin ? '<span class="admin-badge">管理员</span>' : ''}
        </div>
        <div class="user-actions">
          ${this.isAdmin ? '<button id="admin-toggle-btn" class="admin-toggle-btn" title="管理面板">⚙️ 管理</button>' : ''}
          <button id="logout-btn" class="logout-btn" title="退出登录">退出</button>
        </div>
      </div>
    `;

    // 统一使用固定定位，不依赖页面结构
    // 直接添加到body，使用CSS固定定位
    document.body.appendChild(userInfo);

    // 绑定退出按钮事件
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    // 绑定管理员按钮事件
    const adminBtn = document.getElementById('admin-toggle-btn');
    if (adminBtn) {
      // 移除旧的事件监听器（如果存在）
      const newAdminBtn = adminBtn.cloneNode(true);
      adminBtn.parentNode.replaceChild(newAdminBtn, adminBtn);
      
      // 添加新的事件监听器
      newAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Admin button clicked');
        if (window.adminPanel) {
          window.adminPanel.toggleAdminPanel();
        } else {
          console.log('Admin panel not available');
        }
      });
    }

    // 强制应用所有样式，确保一致性
    if (this.applyConsistentStyles) {
      this.applyConsistentStyles();
    }

    // 触发用户信息创建完成事件
    window.dispatchEvent(new CustomEvent('userInfoCreated', {
      detail: { user: this.user, isAdmin: this.isAdmin }
    }));
  }

  // 退出登录
  logout() {
    localStorage.removeItem(this.config.authStorageKey);
    this.user = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.showLoginUI();
  }

  // 隐藏内容
  hideContent() {
    // 尝试多个可能的选择器
    const selectors = [
      '.container',
      '.md-container',
      '.md-main__inner',
      'main'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = 'none';
        break;
      }
    }
  }

  // 显示内容
  showContent() {
    // 尝试多个可能的选择器
    const selectors = [
      '.container',
      '.md-container',
      '.md-main__inner',
      'main'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = '';
        break;
      }
    }
  }

  // 隐藏登录模态框
  hideLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.remove();
    }
  }

  // 设置定期认证检查
  setupAuthCheck() {
    setInterval(() => {
      this.checkAuthStatus();
    }, this.config.authCheckInterval);
    
    // 定期检查用户信息位置和样式（减少频率避免无限循环）
    setInterval(() => {
      if (this.isAuthenticated) {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
          const rect = userInfo.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(userInfo);
          
          // 检查位置（修复逻辑错误 - 只有在位置明显错误时才重新定位）
          if (rect.top > 100 || rect.left < window.innerWidth - 300) {
            console.log('User info not in correct position, repositioning...');
            this.forceRepositionUserInfo();
          }
          
          // 检查样式是否被覆盖（修复检查条件）
          if (computedStyle.position !== 'fixed' || 
              (computedStyle.top !== '20px' && computedStyle.top !== '0px') || 
              (computedStyle.right !== '20px' && computedStyle.right !== '0px')) {
            console.log('User info styles overridden, reapplying...');
            if (this.applyConsistentStyles) {
              this.applyConsistentStyles();
            }
          }
          
          // 检查按钮样式是否被覆盖
          const adminBtn = userInfo.querySelector('.admin-toggle-btn');
          if (adminBtn) {
            const btnStyle = window.getComputedStyle(adminBtn);
            if (!btnStyle.background.includes('gradient') && !btnStyle.background.includes('rgb(111, 66, 193)')) {
              console.log('Admin button styles overridden, reapplying...');
              if (this.applyConsistentStyles) {
                this.applyConsistentStyles();
              }
            }
          }
        }
      }
    }, 15000); // 每15秒检查一次，避免无限循环
  }

  // 添加认证相关样式
  addAuthStyles() {
    if (document.getElementById('auth-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'auth-styles';
    styles.textContent = `
      /* 认证模态框样式 */
      #auth-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .auth-modal-overlay {
        background: white;
        border-radius: 12px;
        padding: 0;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }

      .auth-modal-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 12px 12px 0 0;
        text-align: center;
      }

      .auth-modal-header h2 {
        margin: 0 0 8px 0;
        font-size: 24px;
      }

      .auth-modal-header p {
        margin: 0;
        opacity: 0.9;
        font-size: 14px;
      }

      .auth-modal-body {
        padding: 32px 24px;
        text-align: center;
      }

      .github-login-btn {
        background: #24292e;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
        width: 100%;
        justify-content: center;
      }

      .github-login-btn:hover {
        background: #1a1e22;
        transform: translateY(-1px);
      }

      .auth-modal-footer {
        margin-top: 16px;
      }

      .auth-note {
        font-size: 12px;
        color: #666;
        margin: 0;
      }

      .auth-error {
        color: #d73a49;
        text-align: center;
      }

      .retry-btn {
        background: #0366d6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 12px;
      }

      /* 用户信息样式 */
      #user-info {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        z-index: 9999 !important;
        background: rgba(255, 255, 255, 0.95) !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid #e1e4e8 !important;
        border-radius: 0 0 0 12px !important;
        padding: 8px 16px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        transition: all 0.3s ease !important;
        margin: 0 !important;
        max-width: none !important;
        width: auto !important;
        height: auto !important;
        left: auto !important;
        bottom: auto !important;
        transform: none !important;
        float: none !important;
        clear: none !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-start !important;
      }

      #user-info:hover {
        background: rgba(255, 255, 255, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .user-info-container {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        flex-direction: row !important;
        position: relative !important;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        transform: none !important;
        float: none !important;
        clear: none !important;
      }

      .user-avatar img {
        border-radius: 50%;
        border: 2px solid #e1e4e8;
        transition: border-color 0.2s;
      }

      .user-avatar img:hover {
        border-color: #0366d6;
      }

      .user-details {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .user-name {
        font-weight: 600;
        color: #24292e;
        font-size: 14px;
        line-height: 1.2;
      }

      .admin-badge {
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 8px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .user-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .admin-toggle-btn {
        background: linear-gradient(135deg, #6f42c1, #e83e8c);
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .admin-toggle-btn:hover {
        background: linear-gradient(135deg, #5a32a3, #d63384);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .logout-btn {
        background: linear-gradient(135deg, #dc3545, #fd7e14);
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .logout-btn:hover {
        background: linear-gradient(135deg, #c82333, #e55a00);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      /* 手动认证表单样式 */
      .manual-auth-form {
        text-align: center;
      }

      .manual-auth-form h4 {
        margin: 0 0 16px 0;
        color: #24292e;
      }

      .manual-auth-form p {
        margin: 0 0 20px 0;
        color: #586069;
        font-size: 14px;
      }

      .input-group {
        display: flex;
        gap: 8px;
        margin: 20px 0;
      }

      .input-group input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #d1d5da;
        border-radius: 6px;
        font-size: 14px;
      }

      .verify-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
      }

      .verify-btn:hover {
        background: #218838;
      }

      .auth-note {
        margin-top: 20px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        font-size: 12px;
        color: #586069;
      }

      .auth-note a {
        color: #0366d6;
        text-decoration: none;
      }

      .auth-note a:hover {
        text-decoration: underline;
      }

      /* 加载状态样式 */
      .loading-state {
        text-align: center;
        padding: 40px 20px;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #0366d6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-state p {
        margin: 0;
        color: #586069;
        font-size: 14px;
      }

      /* 响应式设计 */
      @media (max-width: 768px) {
        #user-info {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          border-radius: 0;
          padding: 8px 12px;
        }

        .user-info-container {
          flex-direction: row;
          align-items: center;
          gap: 8px;
          justify-content: space-between;
        }
        
        .user-details {
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
        }

        .user-actions {
          flex-direction: column;
          gap: 4px;
        }

        .admin-toggle-btn,
        .logout-btn {
          font-size: 10px;
          padding: 4px 8px;
        }

        .input-group {
          flex-direction: column;
        }

        .input-group input,
        .verify-btn {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        #user-info {
          padding: 6px 8px;
        }

        .user-name {
          font-size: 12px;
        }

        .admin-badge {
          font-size: 8px;
          padding: 1px 4px;
        }

        .admin-toggle-btn,
        .logout-btn {
          font-size: 9px;
          padding: 3px 6px;
        }
      }
    `;

    document.head.appendChild(styles);
  }
}

// 初始化认证系统
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否已经存在认证实例
  if (!window.githubAuth) {
    window.githubAuth = new GitHubAuth();
  } else {
    // 如果已存在，重新检查认证状态
    window.githubAuth.checkAuthStatus();
  }
  
  // 添加页面可见性变化时的认证检查
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.githubAuth) {
      window.githubAuth.checkAuthStatus();
    }
  });
  
  // 添加页面焦点变化时的认证检查
  window.addEventListener('focus', () => {
    if (window.githubAuth) {
      window.githubAuth.checkAuthStatus();
    }
  });
});

// 监听页面完全加载后的事件
window.addEventListener('load', () => {
  if (window.githubAuth && window.githubAuth.isAuthenticated) {
    // 页面完全加载后，重新创建用户信息以确保一致性
    setTimeout(() => {
      window.githubAuth.createUserInfo();
      // 强制重新定位
      window.githubAuth.forceRepositionUserInfo();
    }, 200);
  }
});

// 应用一致的样式
GitHubAuth.prototype.applyConsistentStyles = function() {
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      // 应用所有样式，确保在所有页面上都一致
      userInfo.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        left: auto !important;
        bottom: auto !important;
        z-index: 9999 !important;
        background: rgba(255, 255, 255, 0.95) !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid #e1e4e8 !important;
        border-radius: 0 0 0 12px !important;
        padding: 8px 16px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        transition: all 0.3s ease !important;
        margin: 0 !important;
        max-width: none !important;
        width: auto !important;
        height: auto !important;
        transform: none !important;
        float: none !important;
        clear: none !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 12px !important;
      `;
      
      // 应用容器样式
      const container = userInfo.querySelector('.user-info-container');
      if (container) {
        container.style.cssText = `
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex-direction: row !important;
          position: relative !important;
          width: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          transform: none !important;
          float: none !important;
          clear: none !important;
        `;
      }
      
      // 应用用户详情样式
      const userDetails = userInfo.querySelector('.user-details');
      if (userDetails) {
        userDetails.style.cssText = `
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 4px !important;
          flex: 1 !important;
        `;
      }
      
      // 应用用户操作样式
      const userActions = userInfo.querySelector('.user-actions');
      if (userActions) {
        userActions.style.cssText = `
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
        `;
      }
      
      // 应用管理员按钮样式
      const adminBtn = userInfo.querySelector('.admin-toggle-btn');
      if (adminBtn) {
        adminBtn.style.cssText = `
          background: linear-gradient(135deg, #6f42c1, #e83e8c) !important;
          color: white !important;
          border: none !important;
          padding: 6px 10px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          transition: all 0.2s !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          text-decoration: none !important;
          outline: none !important;
        `;
      }
      
      // 应用退出按钮样式
      const logoutBtn = userInfo.querySelector('.logout-btn');
      if (logoutBtn) {
        logoutBtn.style.cssText = `
          background: linear-gradient(135deg, #dc3545, #fd7e14) !important;
          color: white !important;
          border: none !important;
          padding: 6px 10px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          transition: all 0.2s !important;
          text-decoration: none !important;
          outline: none !important;
        `;
      }
      
      console.log('Applied consistent styles to user info');
    }
  }

  // 添加强制重新定位方法
GitHubAuth.prototype.forceRepositionUserInfo = function() {
  // 直接调用样式应用方法
  if (this.applyConsistentStyles) {
    this.applyConsistentStyles();
  }
  console.log('Force repositioned user info to top-right');
};

// 添加全局认证状态检查
window.checkAuthStatus = function() {
  if (window.githubAuth) {
    return window.githubAuth.isAuthenticated;
  }
  return false;
};

// 添加全局用户信息获取
window.getCurrentUser = function() {
  if (window.githubAuth && window.githubAuth.isAuthenticated) {
    return window.githubAuth.user;
  }
  return null;
};
