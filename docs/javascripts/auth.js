// GitHub OAuth认证核心功能
class GitHubAuth {
  constructor() {
    this.config = window.AUTH_CONFIG;
    this.user = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.loadSavedConfig();
    this.init();
  }

  init() {
    this.checkAuthStatus();
    this.setupAuthCheck();
    this.handleAuthCallback();
    this.setupConfigListener();
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

  // 加载保存的配置
  loadSavedConfig() {
    const savedConfig = localStorage.getItem('fl510_docs_config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        console.log('Loading saved config:', parsedConfig);
        
        // 合并保存的配置到当前配置
        if (parsedConfig.allowedUsers) {
          this.config.allowedUsers = parsedConfig.allowedUsers;
          console.log('Updated allowed users:', this.config.allowedUsers);
        }
        if (parsedConfig.adminUsers) {
          this.config.adminUsers = parsedConfig.adminUsers;
          console.log('Updated admin users:', this.config.adminUsers);
        }
        
        // 同时更新全局配置
        if (window.AUTH_CONFIG) {
          window.AUTH_CONFIG.allowedUsers = this.config.allowedUsers;
          window.AUTH_CONFIG.adminUsers = this.config.adminUsers;
        }
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    }
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
        <button id="logout-btn" class="logout-btn" title="退出登录">退出</button>
      </div>
    `;

    // 尝试多个可能的选择器来找到合适的位置插入用户信息
    let targetElement = null;
    
    // 尝试不同的选择器
    const selectors = [
      '.container',
      '.md-container',
      '.md-main__inner',
      'main',
      'body'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        targetElement = element;
        break;
      }
    }
    
    if (targetElement) {
      // 如果是body，添加到顶部
      if (targetElement.tagName === 'BODY') {
        targetElement.insertBefore(userInfo, targetElement.firstChild);
      } else {
        // 其他情况，尝试插入到第一个子元素之前
        targetElement.insertBefore(userInfo, targetElement.firstChild);
      }
    } else {
      // 如果找不到合适的容器，直接添加到body
      document.body.insertBefore(userInfo, document.body.firstChild);
    }

    // 绑定退出按钮事件
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }
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
        background: #f8f9fa;
        border-bottom: 1px solid #e1e4e8;
        padding: 12px 24px;
        margin-bottom: 16px;
        border-radius: 8px;
      }

      .user-info-container {
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 1180px;
        margin: 0 auto;
      }

      .user-avatar img {
        border-radius: 50%;
        border: 2px solid #e1e4e8;
      }

      .user-details {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .user-name {
        font-weight: 600;
        color: #24292e;
      }

      .admin-badge {
        background: #28a745;
        color: white;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 500;
      }

      .logout-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .logout-btn:hover {
        background: #c82333;
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
        .user-info-container {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        
        .user-details {
          flex-direction: column;
          align-items: flex-start;
        }

        .input-group {
          flex-direction: column;
        }

        .input-group input,
        .verify-btn {
          width: 100%;
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
