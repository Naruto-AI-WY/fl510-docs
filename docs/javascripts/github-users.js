// GitHub用户自动管理 - 直接从GitHub读取用户名单
class GitHubUsersManager {
  constructor() {
    this.repoOwner = 'Naruto-AI-WY';
    this.repoName = 'fl510-docs';
    this.configFile = 'user-config.json';
    this.init();
  }

  init() {
    console.log('GitHubUsersManager initialized');
    this.setupAutoSync();
    this.setupCrossTabSync();
  }

  // 设置自动同步
  setupAutoSync() {
    // 每30分钟自动同步一次
    setInterval(() => {
      this.syncUsersFromGitHub();
    }, 30 * 60 * 1000);

    // 页面加载时立即同步
    this.syncUsersFromGitHub();
  }

  // 设置跨标签页同步
  setupCrossTabSync() {
    // 监听localStorage变化（只在其他标签页触发）
    window.addEventListener('storage', (e) => {
      if (e.key === 'fl510_docs_config' && e.newValue) {
        console.log('Config updated in another tab, applying...');
        try {
          const config = JSON.parse(e.newValue);
          this.applyConfig(config);
        } catch (error) {
          console.error('Failed to parse config from storage:', error);
        }
      }
    });

    // 使用BroadcastChannel进行实时同步
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('fl510-users-sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'user-update') {
          console.log('User update received via broadcast:', event.data.config);
          this.applyConfig(event.data.config);
        }
      };
    }

    // 添加定期检查机制，确保配置同步
    setInterval(() => {
      this.checkForConfigUpdates();
    }, 2000); // 每2秒检查一次
  }

  // 检查配置更新
  checkForConfigUpdates() {
    const currentConfig = this.getLocalConfig();
    if (currentConfig && currentConfig.allowedUsers) {
      // 检查全局配置是否与本地配置一致
      if (window.AUTH_CONFIG && window.AUTH_CONFIG.allowedUsers) {
        const globalUsers = window.AUTH_CONFIG.allowedUsers;
        const localUsers = currentConfig.allowedUsers;
        
        // 如果用户数量不同，说明配置不同步
        if (globalUsers.length !== localUsers.length || 
            !globalUsers.every(user => localUsers.includes(user))) {
          console.log('Config mismatch detected, syncing...');
          this.applyConfig(currentConfig);
        }
      }
    }
  }

  // 从GitHub同步用户
  async syncUsersFromGitHub() {
    try {
      console.log('Syncing users from GitHub...');
      
      // 优先尝试从GitHub Gist获取配置
      const gistConfig = await this.getConfigFromGist();
      if (gistConfig) {
        console.log('Using Gist config:', gistConfig);
        this.applyConfig(gistConfig);
        // 同时保存到本地存储，确保下次加载更快
        localStorage.setItem('fl510_docs_config', JSON.stringify(gistConfig));
        return true;
      }
      
      // 如果Gist没有配置，检查本地配置
      const localConfig = this.getLocalConfig();
      if (localConfig && localConfig.allowedUsers && localConfig.allowedUsers.length > 0) {
        console.log('Using local config:', localConfig);
        this.applyConfig(localConfig);
        return true;
      }
      
      // 如果都没有，使用默认配置
      const defaultConfig = this.getDefaultConfig();
      this.applyConfig(defaultConfig);
      console.log('Using default config:', defaultConfig);
      return true;
      
    } catch (error) {
      console.error('Failed to sync users from GitHub:', error);
      // 失败时使用本地配置
      const localConfig = this.getLocalConfig();
      if (localConfig) {
        this.applyConfig(localConfig);
      }
      return false;
    }
  }

  // 从GitHub Gist获取配置
  async getConfigFromGist() {
    try {
      const gistId = localStorage.getItem('fl510_gist_id');
      if (!gistId) {
        console.log('No Gist ID found');
        return null;
      }

      const response = await fetch(`https://api.github.com/gists/${gistId}`);
      if (response.ok) {
        const gist = await response.json();
        const configFile = gist.files['fl510-users-config.json'];
        if (configFile) {
          const content = configFile.content;
          return JSON.parse(content);
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get config from Gist:', error);
      return null;
    }
  }

  // 保存配置到GitHub Gist
  async saveConfigToGist(config) {
    try {
      const gistId = localStorage.getItem('fl510_gist_id');
      const githubToken = localStorage.getItem('github_sync_token');
      
      if (!githubToken) {
        console.log('No GitHub token found, cannot save to Gist');
        return false;
      }

      const gistData = {
        files: {
          'fl510-users-config.json': {
            content: JSON.stringify(config, null, 2)
          }
        }
      };

      let response;
      if (gistId) {
        // 更新现有Gist
        response = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gistData)
        });
      } else {
        // 创建新Gist
        gistData.description = 'FL510 Docs User Configuration';
        gistData.public = false;
        
        response = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gistData)
        });
      }

      if (response.ok) {
        const gist = await response.json();
        localStorage.setItem('fl510_gist_id', gist.id);
        console.log('Config saved to Gist:', gist.id);
        return true;
      } else {
        console.error('Failed to save to Gist:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Failed to save config to Gist:', error);
      return false;
    }
  }

  // 从GitHub获取配置（保留原方法作为备用）
  async getConfigFromGitHub() {
    try {
      // 使用GitHub API获取文件内容
      const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.configFile}`);
      
      if (response.ok) {
        const data = await response.json();
        const content = atob(data.content); // 解码base64内容
        return JSON.parse(content);
      } else if (response.status === 404) {
        // 文件不存在，返回null
        return null;
      } else {
        throw new Error(`GitHub API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to get config from GitHub:', error);
      return null;
    }
  }

  // 获取默认配置
  getDefaultConfig() {
    return {
      allowedUsers: ['Naruto-AI-WY'],
      adminUsers: ['Naruto-AI-WY'],
      lastUpdated: new Date().toISOString()
    };
  }

  // 获取本地配置
  getLocalConfig() {
    try {
      const config = localStorage.getItem('fl510_docs_config');
      return config ? JSON.parse(config) : null;
    } catch (error) {
      console.error('Failed to get local config:', error);
      return null;
    }
  }

  // 应用配置
  applyConfig(config) {
    if (config.allowedUsers) {
      if (window.AUTH_CONFIG) {
        window.AUTH_CONFIG.allowedUsers = config.allowedUsers;
      }
      if (window.githubAuth && window.githubAuth.config) {
        window.githubAuth.config.allowedUsers = config.allowedUsers;
      }
    }
    
    if (config.adminUsers) {
      if (window.AUTH_CONFIG) {
        window.AUTH_CONFIG.adminUsers = config.adminUsers;
      }
      if (window.githubAuth && window.githubAuth.config) {
        window.githubAuth.config.adminUsers = config.adminUsers;
      }
    }

    // 保存到本地存储
    localStorage.setItem('fl510_docs_config', JSON.stringify(config));
    
    console.log('Config applied:', config);
  }

  // 添加用户到GitHub配置
  async addUserToGitHub(username) {
    try {
      // 优先使用本地配置，而不是从GitHub获取
      let currentConfig = this.getLocalConfig() || this.getDefaultConfig();
      
      if (!currentConfig.allowedUsers) {
        currentConfig.allowedUsers = [];
      }
      
      if (!currentConfig.allowedUsers.includes(username)) {
        currentConfig.allowedUsers.push(username);
        currentConfig.lastUpdated = new Date().toISOString();
        
        // 更新本地配置
        this.applyConfig(currentConfig);
        
        // 保存到本地存储
        localStorage.setItem('fl510_docs_config', JSON.stringify(currentConfig));
        
        // 保存到GitHub Gist
        await this.saveConfigToGist(currentConfig);
        
        // 通过BroadcastChannel通知其他标签页
        if (this.broadcastChannel) {
          console.log('Sending broadcast message to other tabs...');
          this.broadcastChannel.postMessage({
            type: 'user-update',
            config: currentConfig
          });
        } else {
          console.log('BroadcastChannel not available');
        }
        
        console.log(`User ${username} added to config:`, currentConfig);
        return true;
      } else {
        console.log(`User ${username} already exists in config`);
        return false;
      }
    } catch (error) {
      console.error('Failed to add user to GitHub config:', error);
      return false;
    }
  }

  // 从GitHub配置中移除用户
  async removeUserFromGitHub(username) {
    try {
      // 优先使用本地配置
      let currentConfig = this.getLocalConfig() || this.getDefaultConfig();
      
      if (currentConfig.allowedUsers) {
        const index = currentConfig.allowedUsers.indexOf(username);
        if (index > -1) {
          currentConfig.allowedUsers.splice(index, 1);
          currentConfig.lastUpdated = new Date().toISOString();
          
          // 更新本地配置
          this.applyConfig(currentConfig);
          
          // 保存到本地存储
          localStorage.setItem('fl510_docs_config', JSON.stringify(currentConfig));
          
          // 保存到GitHub Gist
          await this.saveConfigToGist(currentConfig);
          
          // 通过BroadcastChannel通知其他标签页
          if (this.broadcastChannel) {
            console.log('Sending broadcast message to other tabs...');
            this.broadcastChannel.postMessage({
              type: 'user-update',
              config: currentConfig
            });
          } else {
            console.log('BroadcastChannel not available');
          }
          
          console.log(`User ${username} removed from config:`, currentConfig);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to remove user from GitHub config:', error);
      return false;
    }
  }

  // 获取所有用户
  async getAllUsers() {
    try {
      // 优先使用本地配置
      const config = this.getLocalConfig() || this.getDefaultConfig();
      return config.allowedUsers || [];
    } catch (error) {
      console.error('Failed to get all users:', error);
      return [];
    }
  }

  // 检查用户是否存在
  async checkUserExists(username) {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      return response.ok;
    } catch (error) {
      console.error('Failed to check user existence:', error);
      return false;
    }
  }

  // 获取用户信息
  async getUserInfo(username) {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  // 生成用户管理界面
  generateUserManagementUI() {
    const container = document.createElement('div');
    container.id = 'github-users-manager';
    container.innerHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h3>👥 GitHub用户管理</h3>
        <p>系统会自动从GitHub仓库同步用户配置，无需手动输入Token。</p>
        
        <div style="margin: 10px 0;">
          <input type="text" id="new-username" placeholder="输入GitHub用户名" 
                 style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-right: 10px;">
          <button onclick="githubUsersManager.addUser()" 
                  style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            添加用户
          </button>
        </div>
        
        <div id="users-list" style="margin: 10px 0;">
          <p>正在加载用户列表...</p>
        </div>
        
        <div style="margin: 10px 0;">
          <button onclick="githubUsersManager.syncUsers()" 
                  style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
            同步用户
          </button>
          <button onclick="githubUsersManager.exportConfig()" 
                  style="background: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            导出配置
          </button>
        </div>
      </div>
    `;
    
    // 自动加载用户列表
    setTimeout(() => {
      this.updateUsersList();
    }, 500);
    
    return container;
  }

  // 添加用户
  async addUser() {
    console.log('addUser called');
    
    // 尝试多个可能的输入框ID
    let usernameInput = document.getElementById('github-new-username') || 
                       document.getElementById('new-username');
    
    // 如果还是找不到，尝试查找所有输入框
    if (!usernameInput) {
      const allInputs = document.querySelectorAll('input[type="text"]');
      console.log('All text inputs found:', allInputs);
      for (let input of allInputs) {
        if (input.placeholder && input.placeholder.includes('GitHub用户名')) {
          usernameInput = input;
          console.log('Found input by placeholder:', input);
          break;
        }
      }
    }
    
    console.log('Looking for input elements:');
    console.log('github-new-username:', document.getElementById('github-new-username'));
    console.log('new-username:', document.getElementById('new-username'));
    console.log('Found input:', usernameInput);
    
    const username = usernameInput ? usernameInput.value.trim() : '';
    
    console.log('Username value:', username);
    
    if (!username) {
      alert('请输入GitHub用户名');
      return;
    }
    
    // 检查用户是否存在
    const userExists = await this.checkUserExists(username);
    if (!userExists) {
      alert(`用户 ${username} 不存在`);
      return;
    }
    
    // 添加用户
    const success = await this.addUserToGitHub(username);
    if (success) {
      alert(`用户 ${username} 已添加`);
      if (usernameInput) {
        usernameInput.value = '';
      }
      this.updateUsersList();
    } else {
      alert(`用户 ${username} 已存在或添加失败`);
    }
  }

  // 同步用户
  async syncUsers() {
    const success = await this.syncUsersFromGitHub();
    if (success) {
      alert('用户同步成功');
      this.updateUsersList();
    } else {
      alert('用户同步失败，请检查网络连接');
    }
  }

  // 更新用户列表
  async updateUsersList() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    try {
      const users = await this.getAllUsers();
      usersList.innerHTML = `
        <h4>当前用户列表 (${users.length}人):</h4>
        <ul style="list-style: none; padding: 0;">
          ${users.map(user => `
            <li style="background: #e9ecef; padding: 8px; margin: 5px 0; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
              <span>👤 ${user}</span>
              <button onclick="githubUsersManager.removeUser('${user}')" 
                      style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                移除
              </button>
            </li>
          `).join('')}
        </ul>
      `;
    } catch (error) {
      usersList.innerHTML = '<p style="color: red;">加载用户列表失败</p>';
    }
  }

  // 移除用户
  async removeUser(username) {
    if (confirm(`确定要移除用户 ${username} 吗？`)) {
      const success = await this.removeUserFromGitHub(username);
      if (success) {
        alert(`用户 ${username} 已移除`);
        this.updateUsersList();
      } else {
        alert(`移除用户 ${username} 失败`);
      }
    }
  }

  // 导出配置
  // 设置GitHub Token
  async setupGitHubToken(token) {
    try {
      // 验证Token
      const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
      });
      
      if (response.ok) {
        localStorage.setItem('github_sync_token', token);
        console.log('GitHub token saved successfully');
        return true;
      } else {
        console.error('Invalid GitHub token');
        return false;
      }
    } catch (error) {
      console.error('Failed to validate GitHub token:', error);
      return false;
    }
  }

  exportConfig() {
    const config = this.getLocalConfig() || this.getDefaultConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fl510-users-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// 初始化GitHub用户管理器
window.githubUsersManager = new GitHubUsersManager();

// 确保全局可用
console.log('GitHubUsersManager initialized globally:', window.githubUsersManager);

// 添加测试函数到全局作用域
window.testAddUser = function() {
  console.log('testAddUser called');
  if (window.githubUsersManager) {
    console.log('Manager exists, calling addUser');
    window.githubUsersManager.addUser();
  } else {
    console.log('Manager not found');
  }
};

// 添加手动测试函数
window.manualTest = function() {
  console.log('Manual test started');
  const input = document.getElementById('github-new-username');
  console.log('Input element:', input);
  if (input) {
    console.log('Input value:', input.value);
    input.value = 'testuser';
    console.log('Set input value to testuser');
    window.testAddUser();
  } else {
    console.log('Input element not found');
  }
};

// 设置GitHub Token函数
window.setupGitHubToken = function() {
  const token = prompt('请输入GitHub Personal Access Token (需要gist权限):');
  if (token) {
    if (window.githubUsersManager) {
      window.githubUsersManager.setupGitHubToken(token).then(success => {
        if (success) {
          alert('GitHub Token设置成功！现在可以跨浏览器同步用户配置了。');
        } else {
          alert('GitHub Token无效，请检查后重试。');
        }
      });
    } else {
      alert('GitHub用户管理器未初始化');
    }
  }
};

// 调试同步状态
window.debugSyncStatus = function() {
  console.log('=== 同步状态调试 ===');
  console.log('GitHub Token:', localStorage.getItem('github_sync_token') ? '已设置' : '未设置');
  console.log('Gist ID:', localStorage.getItem('fl510_gist_id') || '未设置');
  console.log('本地配置:', localStorage.getItem('fl510_docs_config'));
  console.log('BroadcastChannel支持:', typeof BroadcastChannel !== 'undefined');
  console.log('当前AUTH_CONFIG:', window.AUTH_CONFIG);
  
  if (window.githubUsersManager) {
    window.githubUsersManager.getConfigFromGist().then(gistConfig => {
      console.log('Gist配置:', gistConfig);
    });
  }
};

// 手动触发跨标签页同步
window.manualSync = function() {
  if (window.githubUsersManager) {
    const config = window.githubUsersManager.getLocalConfig();
    if (config) {
      console.log('手动触发同步，配置:', config);
      window.githubUsersManager.applyConfig(config);
      
      // 发送广播消息
      if (window.githubUsersManager.broadcastChannel) {
        window.githubUsersManager.broadcastChannel.postMessage({
          type: 'user-update',
          config: config
        });
        console.log('广播消息已发送');
      }
    }
  }
};
