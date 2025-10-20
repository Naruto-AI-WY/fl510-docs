// GitHub OAuth认证核心功能
class GitHubAuth {
  constructor() {
    this.config = window.AUTH_CONFIG;
    this.user = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.init();
  }

  init() {
    this.checkAuthStatus();
    this.setupAuthCheck();
    this.handleAuthCallback();
  }

  // 检查当前认证状态
  checkAuthStatus() {
    const authData = localStorage.getItem(this.config.authStorageKey);
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          this.user = parsed.user;
          this.isAuthenticated = true;
          this.isAdmin = this.config.adminUsers.includes(this.user.login);
          this.showAuthenticatedUI();
          return;
        }
      } catch (e) {
        console.error('Auth data parse error:', e);
      }
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
    this.showContent();
    this.createUserInfo();
    this.hideLoginModal();
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
              使用GitHub登录
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
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&scope=user:email&state=${Date.now()}`;
    window.location.href = authUrl;
  }

  // 处理OAuth回调
  handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      this.exchangeCodeForToken(code);
    }
  }

  // 交换授权码获取用户信息
  async exchangeCodeForToken(code) {
    try {
      // 这里需要后端服务来处理OAuth流程
      // 为了演示，我们使用GitHub API直接获取用户信息
      const response = await fetch(`https://api.github.com/user`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (response.ok) {
        const user = await response.json();
        this.handleSuccessfulAuth(user);
      } else {
        throw new Error('Failed to get user info');
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.showAuthError('认证失败，请重试');
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

    // 清理URL参数
    window.history.replaceState({}, document.title, window.location.pathname);

    this.showAuthenticatedUI();
  }

  // 检查用户是否被允许访问
  isUserAllowed(user) {
    // 检查用户是否在允许列表中
    if (this.config.allowedUsers.includes(user.login)) {
      return true;
    }

    // 检查用户是否属于允许的组织（需要额外的API调用）
    // 这里简化处理，只检查用户名列表
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

    // 将用户信息添加到页面顶部
    const container = document.querySelector('.container');
    if (container) {
      container.insertBefore(userInfo, container.firstChild);
    }

    // 绑定退出按钮事件
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.logout();
    });
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
    const container = document.querySelector('.container');
    if (container) {
      container.style.display = 'none';
    }
  }

  // 显示内容
  showContent() {
    const container = document.querySelector('.container');
    if (container) {
      container.style.display = '';
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
      }
    `;

    document.head.appendChild(styles);
  }
}

// 初始化认证系统
document.addEventListener('DOMContentLoaded', () => {
  window.githubAuth = new GitHubAuth();
});
