// 跨浏览器配置同步系统
class ConfigSync {
  constructor() {
    this.gistId = null;
    this.githubToken = null;
    this.configCache = null;
    this.syncInterval = null;
    this.init();
  }

  init() {
    // 从URL参数或localStorage获取GitHub token
    this.loadGitHubToken();
    
    // 设置定期同步
    this.setupPeriodicSync();
    
    // 监听配置变化
    this.setupConfigListener();
  }

  // 加载GitHub token
  loadGitHubToken() {
    // 从URL参数获取token（用于首次设置）
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('github_token');
    
    if (token) {
      this.githubToken = token;
      localStorage.setItem('github_sync_token', token);
      // 清除URL参数
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('GitHub token saved for config sync');
    } else {
      // 从localStorage获取已保存的token
      this.githubToken = localStorage.getItem('github_sync_token');
    }
  }

  // 设置定期同步
  setupPeriodicSync() {
    if (this.githubToken) {
      // 每5分钟同步一次
      this.syncInterval = setInterval(() => {
        this.syncConfig();
      }, 5 * 60 * 1000);
    }
  }

  // 设置配置监听器
  setupConfigListener() {
    window.addEventListener('configUpdated', (event) => {
      if (this.githubToken) {
        // 延迟同步，避免频繁请求
        setTimeout(() => {
          this.syncConfig();
        }, 2000);
      }
    });
  }

  // 同步配置到GitHub Gist
  async syncConfig() {
    if (!this.githubToken) {
      console.log('No GitHub token available for sync');
      return Promise.resolve();
    }

    try {
      const config = window.AUTH_CONFIG;
      if (!config) return Promise.resolve();

      const configData = {
        allowedUsers: config.allowedUsers || [],
        adminUsers: config.adminUsers || [],
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      };

      // 如果已有Gist ID，更新现有Gist
      if (this.gistId) {
        await this.updateGist(configData);
      } else {
        // 创建新的Gist
        await this.createGist(configData);
      }

      console.log('Config synced to GitHub Gist');
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to sync config:', error);
      if (this.isSafari) {
        console.log('Safari sync error, attempting fallback');
        // Safari特殊处理
        return this.safariSyncFallback(configData);
      }
      return Promise.reject(error);
    }
  }

  // Safari同步备用方法
  async safariSyncFallback(configData) {
    try {
      // 使用XMLHttpRequest进行同步
      const gistData = {
        description: 'FL-510 Docs User Configuration',
        public: false,
        files: {
          'fl510-users-config.json': {
            content: JSON.stringify(configData, null, 2)
          }
        }
      };

      if (this.gistId) {
        // 更新现有Gist
        return this.safariXMLHttpRequest(`https://api.github.com/gists/${this.gistId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(gistData)
        });
      } else {
        // 创建新Gist
        const response = await this.safariXMLHttpRequest('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(gistData)
        });
        
        if (response && response.ok) {
          const gist = await response.json();
          this.gistId = gist.id;
          localStorage.setItem('fl510_gist_id', this.gistId);
        }
        
        return response;
      }
    } catch (error) {
      console.error('Safari sync fallback failed:', error);
      return Promise.reject(error);
    }
  }

  // 创建新的Gist
  async createGist(configData) {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        description: 'FL-510 Docs User Configuration',
        public: false,
        files: {
          'fl510-users-config.json': {
            content: JSON.stringify(configData, null, 2)
          }
        }
      })
    });

    if (response.ok) {
      const gist = await response.json();
      this.gistId = gist.id;
      localStorage.setItem('fl510_gist_id', this.gistId);
      console.log('Created new Gist:', this.gistId);
    } else {
      throw new Error(`Failed to create Gist: ${response.status}`);
    }
  }

  // 更新现有Gist
  async updateGist(configData) {
    const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${this.githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        files: {
          'fl510-users-config.json': {
            content: JSON.stringify(configData, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update Gist: ${response.status}`);
    }
  }

  // 从GitHub Gist加载配置
  async loadConfig() {
    if (!this.githubToken) {
      console.log('No GitHub token available for loading config');
      return Promise.resolve(null);
    }

    // 从localStorage获取Gist ID
    this.gistId = localStorage.getItem('fl510_gist_id');
    if (!this.gistId) {
      console.log('No Gist ID found');
      return Promise.resolve(null);
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const gist = await response.json();
        const configFile = gist.files['fl510-users-config.json'];
        
        if (configFile) {
          const configData = JSON.parse(configFile.content);
          console.log('Loaded config from GitHub Gist:', configData);
          return Promise.resolve(configData);
        }
      } else {
        console.error('Failed to load Gist:', response.status);
      }
    } catch (error) {
      console.error('Error loading config from Gist:', error);
    }

    return Promise.resolve(null);
  }

  // 显示配置同步设置界面
  showSyncSettings() {
    const modal = document.createElement('div');
    modal.id = 'sync-settings-modal';
    modal.innerHTML = `
      <div class="sync-modal-overlay">
        <div class="sync-modal-content">
          <div class="sync-modal-header">
            <h3>🔗 跨浏览器配置同步</h3>
            <button class="close-btn" onclick="this.closest('#sync-settings-modal').remove()">×</button>
          </div>
          <div class="sync-modal-body">
            <div class="sync-status">
              <p><strong>当前状态：</strong> ${this.githubToken ? '✅ 已启用同步' : '❌ 未启用同步'}</p>
            </div>
            
            ${!this.githubToken ? `
              <div class="sync-setup">
                <h4>设置GitHub同步</h4>
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
                <h4>同步操作</h4>
                <button onclick="window.configSync.syncConfig()">🔄 立即同步</button>
                <button onclick="window.configSync.loadConfig()">📥 从云端加载</button>
                <button onclick="window.configSync.disableSync()">❌ 禁用同步</button>
              </div>
            `}
            
            <div class="sync-info">
              <h4>同步说明</h4>
              <ul>
                <li>✅ 配置会自动保存到您的GitHub Gist中</li>
                <li>✅ 在任何浏览器登录后都能访问相同的用户配置</li>
                <li>✅ 配置是私有的，只有您能访问</li>
                <li>⚠️ 需要GitHub账号和Personal Access Token</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.addSyncStyles();
  }

  // 设置同步
  async setupSync() {
    const tokenInput = document.getElementById('github-token-input');
    const token = tokenInput.value.trim();
    
    if (!token) {
      alert('请输入GitHub Personal Access Token');
      return Promise.resolve();
    }

    this.githubToken = token;
    localStorage.setItem('github_sync_token', token);
    
    // Safari兼容的fetch请求
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        }
      };
      
      // Safari兼容的fetch调用
      const response = await this.safariCompatibleFetch('https://api.github.com/user', requestOptions);
      
      if (response && response.ok) {
        alert('GitHub同步设置成功！');
        this.setupPeriodicSync();
        const modal = document.getElementById('sync-settings-modal');
        if (modal) {
          modal.remove();
        }
        return Promise.resolve();
      } else {
        throw new Error('Invalid token or network error');
      }
    } catch (error) {
      console.error('Safari setupSync error:', error);
      alert('Safari浏览器Token验证失败，请检查网络连接和Token是否正确');
      this.githubToken = null;
      localStorage.removeItem('github_sync_token');
      return Promise.reject(error);
    }
  }

  // Safari兼容的fetch方法
  async safariCompatibleFetch(url, options) {
    if (typeof fetch !== 'undefined') {
      try {
        return await fetch(url, options);
      } catch (error) {
        console.error('Safari fetch error:', error);
        // 如果fetch失败，尝试XMLHttpRequest
        return this.safariXMLHttpRequest(url, options);
      }
    } else {
      // 使用XMLHttpRequest作为备用
      return this.safariXMLHttpRequest(url, options);
    }
  }

  // Safari XMLHttpRequest备用方法
  safariXMLHttpRequest(url, options) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url, true);
      
      // 设置请求头
      if (options.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              ok: true,
              status: xhr.status,
              json: () => {
                try {
                  return Promise.resolve(JSON.parse(xhr.responseText));
                } catch (error) {
                  console.error('Safari JSON parse error:', error);
                  return Promise.resolve(null);
                }
              }
            });
          } else {
            resolve({
              ok: false,
              status: xhr.status,
              json: () => Promise.resolve(null)
            });
          }
        }
      };
      
      xhr.onerror = function() {
        console.error('Safari XMLHttpRequest error');
        reject(new Error('Safari XMLHttpRequest failed'));
      };
      
      xhr.ontimeout = function() {
        console.error('Safari XMLHttpRequest timeout');
        reject(new Error('Safari XMLHttpRequest timeout'));
      };
      
      // 设置超时
      xhr.timeout = 10000; // 10秒超时
      
      // 发送请求体（如果有）
      if (options.body) {
        xhr.send(options.body);
      } else {
        xhr.send();
      }
    });
  }

  // 禁用同步
  disableSync() {
    this.githubToken = null;
    this.gistId = null;
    localStorage.removeItem('github_sync_token');
    localStorage.removeItem('fl510_gist_id');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    alert('已禁用跨浏览器同步');
    document.getElementById('sync-settings-modal').remove();
  }

  // 添加同步设置样式
  addSyncStyles() {
    if (document.getElementById('sync-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sync-styles';
    styles.textContent = `
      .sync-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .sync-modal-content {
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }

      .sync-modal-header {
        background: linear-gradient(135deg, #0366d6, #28a745);
        color: white;
        padding: 20px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sync-modal-header h3 {
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

      .sync-modal-body {
        padding: 24px;
      }

      .sync-status {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 20px;
      }

      .token-input {
        display: flex;
        gap: 8px;
        margin: 16px 0;
      }

      .token-input input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #d1d5da;
        border-radius: 6px;
        font-size: 14px;
      }

      .token-input button {
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }

      .sync-actions {
        display: flex;
        gap: 12px;
        margin: 16px 0;
        flex-wrap: wrap;
      }

      .sync-actions button {
        background: #0366d6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }

      .sync-actions button:last-child {
        background: #dc3545;
      }

      .sync-info {
        background: #e3f2fd;
        padding: 16px;
        border-radius: 6px;
        margin-top: 20px;
      }

      .sync-info h4 {
        margin: 0 0 12px 0;
        color: #1976d2;
      }

      .sync-info ul {
        margin: 0;
        padding-left: 20px;
      }

      .sync-info li {
        margin: 4px 0;
        color: #424242;
      }
    `;

    document.head.appendChild(styles);
  }
}

// 添加全局Promise错误处理（Safari兼容性）
window.addEventListener('unhandledrejection', function(event) {
  console.warn('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // 防止错误显示在控制台
});

// 添加全局错误处理
window.addEventListener('error', function(event) {
  console.warn('Global error caught:', event.error);
  event.preventDefault();
});

// Safari兼容性检测
function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// 创建Safari兼容的Promise
function createSafariCompatiblePromise(executor) {
  if (typeof Promise !== 'undefined') {
    return new Promise(executor);
  } else {
    // Safari旧版本兼容
    return {
      then: function(onResolve, onReject) {
        try {
          executor(onResolve, onReject);
        } catch (error) {
          if (onReject) onReject(error);
        }
        return this;
      },
      catch: function(onReject) {
        return this.then(null, onReject);
      }
    };
  }
}

// 立即创建占位符对象，防止未定义错误
window.configSync = {
  initialized: false,
  isSafari: isSafari(),
  setupSync: function() {
    console.log('ConfigSync setupSync called, initialized:', this.initialized, 'Safari:', this.isSafari);
    if (this.initialized && this._realSetupSync) {
      try {
        return this._realSetupSync();
      } catch (error) {
        console.error('Safari setupSync error:', error);
        alert('Safari浏览器配置同步出错，请尝试刷新页面');
        return null;
      }
    } else {
      if (this.isSafari) {
        alert('Safari浏览器正在初始化配置同步功能，请稍后再试');
      } else {
        alert('配置同步功能正在初始化中，请稍后再试');
      }
    }
  },
  syncConfig: function() {
    console.log('ConfigSync syncConfig called, initialized:', this.initialized, 'Safari:', this.isSafari);
    if (this.initialized && this._realSyncConfig) {
      try {
        return this._realSyncConfig();
      } catch (error) {
        console.error('Safari syncConfig error:', error);
        alert('Safari浏览器同步配置出错，请尝试刷新页面');
        return null;
      }
    } else {
      if (this.isSafari) {
        alert('Safari浏览器正在初始化配置同步功能，请稍后再试');
      } else {
        alert('配置同步功能正在初始化中，请稍后再试');
      }
    }
  },
  loadConfig: function() {
    console.log('ConfigSync loadConfig called, initialized:', this.initialized, 'Safari:', this.isSafari);
    if (this.initialized && this._realLoadConfig) {
      try {
        return this._realLoadConfig();
      } catch (error) {
        console.error('Safari loadConfig error:', error);
        return createSafariCompatiblePromise(function(resolve) {
          resolve(null);
        });
      }
    } else {
      return createSafariCompatiblePromise(function(resolve) {
        resolve(null);
      });
    }
  },
  disableSync: function() {
    console.log('ConfigSync disableSync called, initialized:', this.initialized, 'Safari:', this.isSafari);
    if (this.initialized && this._realDisableSync) {
      try {
        return this._realDisableSync();
      } catch (error) {
        console.error('Safari disableSync error:', error);
        alert('Safari浏览器禁用同步出错，请尝试刷新页面');
        return null;
      }
    } else {
      if (this.isSafari) {
        alert('Safari浏览器正在初始化配置同步功能，请稍后再试');
      } else {
        alert('配置同步功能正在初始化中，请稍后再试');
      }
    }
  }
};

// 延迟初始化配置同步系统，确保DOM完全加载
function initializeConfigSync() {
  console.log('Initializing ConfigSync...');
  
  if (window.configSync && window.configSync.initialized) {
    console.log('ConfigSync already initialized');
    return; // 已经初始化过了
  }
  
  try {
    console.log('Creating new ConfigSync instance...');
    const realConfigSync = new ConfigSync();
    
    // 保存真实方法到占位符对象
    window.configSync._realSetupSync = realConfigSync.setupSync.bind(realConfigSync);
    window.configSync._realSyncConfig = realConfigSync.syncConfig.bind(realConfigSync);
    window.configSync._realLoadConfig = realConfigSync.loadConfig.bind(realConfigSync);
    window.configSync._realDisableSync = realConfigSync.disableSync.bind(realConfigSync);
    
    // 复制其他属性
    Object.keys(realConfigSync).forEach(key => {
      if (key !== 'setupSync' && key !== 'syncConfig' && key !== 'loadConfig' && key !== 'disableSync') {
        window.configSync[key] = realConfigSync[key];
      }
    });
    
    window.configSync.initialized = true;
    
    console.log('ConfigSync initialized successfully');
  } catch (error) {
    console.error('Failed to initialize ConfigSync:', error);
    // 保持占位符对象，但标记为失败
    window.configSync.initialized = false;
    window.configSync.setupSync = () => alert('配置同步功能初始化失败，请刷新页面重试');
    window.configSync.syncConfig = () => alert('配置同步功能初始化失败，请刷新页面重试');
    window.configSync.loadConfig = () => Promise.resolve(null);
    window.configSync.disableSync = () => alert('配置同步功能初始化失败，请刷新页面重试');
  }
}

// 立即尝试初始化
initializeConfigSync();

// 在DOM加载完成后再次尝试初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeConfigSync);
}

// 添加延迟初始化，确保所有依赖都已加载
setTimeout(initializeConfigSync, 1000);

// 将初始化函数暴露到全局作用域，以便手动调用
window.initializeConfigSync = initializeConfigSync;
