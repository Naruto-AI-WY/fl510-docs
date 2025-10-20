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

  // 从GitHub同步用户
  async syncUsersFromGitHub() {
    try {
      console.log('Syncing users from GitHub...');
      
      // 尝试从GitHub获取配置
      const config = await this.getConfigFromGitHub();
      if (config) {
        this.applyConfig(config);
        console.log('Users synced from GitHub:', config);
        return true;
      }
      
      // 如果GitHub上没有配置，使用默认配置
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

  // 从GitHub获取配置
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
      const currentConfig = await this.getConfigFromGitHub() || this.getDefaultConfig();
      
      if (!currentConfig.allowedUsers) {
        currentConfig.allowedUsers = [];
      }
      
      if (!currentConfig.allowedUsers.includes(username)) {
        currentConfig.allowedUsers.push(username);
        currentConfig.lastUpdated = new Date().toISOString();
        
        // 更新本地配置
        this.applyConfig(currentConfig);
        
        console.log(`User ${username} added to config`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to add user to GitHub config:', error);
      return false;
    }
  }

  // 从GitHub配置中移除用户
  async removeUserFromGitHub(username) {
    try {
      const currentConfig = await this.getConfigFromGitHub() || this.getDefaultConfig();
      
      if (currentConfig.allowedUsers) {
        const index = currentConfig.allowedUsers.indexOf(username);
        if (index > -1) {
          currentConfig.allowedUsers.splice(index, 1);
          currentConfig.lastUpdated = new Date().toISOString();
          
          // 更新本地配置
          this.applyConfig(currentConfig);
          
          console.log(`User ${username} removed from config`);
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
      const config = await this.getConfigFromGitHub() || this.getLocalConfig() || this.getDefaultConfig();
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
