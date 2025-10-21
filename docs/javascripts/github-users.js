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

  // 获取当前全局/本地配置
  getCurrentConfig() {
    try {
      const globalCfg = (window.AUTH_CONFIG && (window.AUTH_CONFIG.allowedUsers || window.AUTH_CONFIG.adminUsers)) ? window.AUTH_CONFIG : null;
      const localCfgStr = localStorage.getItem('fl510_docs_config');
      const localCfg = localCfgStr ? JSON.parse(localCfgStr) : null;
      return globalCfg || localCfg || null;
    } catch (_) {
      return null;
    }
  }

  // 比较配置新旧（基于 lastUpdated）
  isNewerConfig(incoming, current) {
    try {
      if (!incoming) return false;
      if (!current) return true;
      const inTime = incoming.lastUpdated ? Date.parse(incoming.lastUpdated) : 0;
      const curTime = current.lastUpdated ? Date.parse(current.lastUpdated) : 0;
      return inTime >= curTime;
    } catch (_) {
      return true;
    }
  }

  // 合并配置（取用户并集，时间取较新）
  mergeConfigs(a, b) {
    const res = { allowedUsers: [], adminUsers: [], lastUpdated: new Date().toISOString() };
    const aAllowed = (a && a.allowedUsers) ? a.allowedUsers : [];
    const bAllowed = (b && b.allowedUsers) ? b.allowedUsers : [];
    const aAdmins = (a && a.adminUsers) ? a.adminUsers : [];
    const bAdmins = (b && b.adminUsers) ? b.adminUsers : [];
    res.allowedUsers = Array.from(new Set([...aAllowed, ...bAllowed]));
    res.adminUsers = Array.from(new Set([...aAdmins, ...bAdmins]));
    const times = [a && a.lastUpdated, b && b.lastUpdated].filter(Boolean).map(t => Date.parse(t));
    if (times.length) res.lastUpdated = new Date(Math.max(...times)).toISOString();
    return res;
  }

  // 只有当传入配置更新更“新”时才应用
  maybeApplyConfig(incoming) {
    const current = this.getCurrentConfig();
    if (!current || this.isNewerConfig(incoming, current)) {
      this.applyConfig(incoming);
      return true;
    }
    return false;
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
          const incoming = JSON.parse(e.newValue);
          const current = this.getCurrentConfig();
          // 仅当对方更新更新（lastUpdated 更大）才替换本地，防止旧端覆盖
          if (this.isNewerConfig(incoming, current)) {
            this.applyConfigReplace(incoming, { silent: true });
          }
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
          const incoming = event.data.config;
          const current = this.getCurrentConfig();
          if (this.isNewerConfig(incoming, current)) {
            // 使用替换模式，确保删除不会被并集合并回去
            this.applyConfigReplace(incoming, { silent: true });
          }
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
      
      // 首先尝试从GitHub仓库获取配置（最可靠的方法）
      const repoConfig = await this.getConfigFromGitHub();
      if (repoConfig) {
        // 主动“同步用户”以仓库为准：直接替换本地配置
        console.log('Using GitHub repo config:', repoConfig);
        this.applyConfigReplace(repoConfig);
        localStorage.setItem('fl510_docs_config', JSON.stringify(repoConfig));
        // 通知系统配置已更新，触发鉴权重评估
        try {
          window.dispatchEvent(new CustomEvent('configUpdated', { detail: { config: repoConfig } }));
          // 如果当前已登录但已不在白名单，则强制登出
          if (window.githubAuth && window.githubAuth.isAuthenticated && window.githubAuth.user) {
            const login = window.githubAuth.user.login;
            const allowed = Array.isArray(repoConfig.allowedUsers) && repoConfig.allowedUsers.includes(login);
            if (!allowed && typeof window.githubAuth.logout === 'function') {
              window.githubAuth.logout();
            }
          }
        } catch (_) {}
        return true;
      }
      
      // 如果仓库没有配置，尝试从GitHub Gist获取配置
      const gistConfig = await this.getConfigFromGist();
      if (gistConfig) {
        console.log('Using Gist config:', gistConfig);
        this.applyConfig(gistConfig);
        // 同时保存到本地存储，确保下次加载更快
        localStorage.setItem('fl510_docs_config', JSON.stringify(gistConfig));
        return true;
      }
      
      // 如果Gist没有配置，尝试从GitHub仓库获取共享的Gist ID
      const sharedGistId = await this.getSharedGistId();
      if (sharedGistId && sharedGistId !== 'placeholder') {
        console.log('Found shared Gist ID:', sharedGistId);
        localStorage.setItem('fl510_gist_id', sharedGistId);
        // 再次尝试从Gist获取配置
        const gistConfig2 = await this.getConfigFromGist();
        if (gistConfig2) {
          console.log('Using shared Gist config:', gistConfig2);
          this.applyConfig(gistConfig2);
          localStorage.setItem('fl510_docs_config', JSON.stringify(gistConfig2));
          return true;
        }
      }
      
      // 如果都没有，检查本地配置
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

      // 获取Token
      const token = localStorage.getItem('github_sync_token');
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      // 如果有Token，添加到请求头
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      // 尝试访问Gist
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: headers
      });
      if (response.ok) {
        const gist = await response.json();
        const configFile = gist.files['fl510-users-config.json'];
        if (configFile) {
          const content = configFile.content;
          console.log('Successfully retrieved config from Gist:', content);
          return JSON.parse(content);
        }
      } else {
        console.log('Gist not accessible, trying alternative method...');
        // 如果Gist不可访问，尝试从GitHub仓库获取配置
        return await this.getConfigFromGitHub();
      }
      return null;
    } catch (error) {
      console.error('Failed to get config from Gist:', error);
      // 失败时尝试从GitHub仓库获取
      return await this.getConfigFromGitHub();
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
        
        // 保存共享的Gist ID到GitHub仓库
        await this.saveSharedGistId(gist.id);
        
        return true;
      } else {
        const errorText = await response.text();
        console.error('Failed to save to Gist:', response.status, response.statusText, errorText);
        return false;
      }
    } catch (error) {
      console.error('Failed to save config to Gist:', error);
      return false;
    }
  }

  // 获取共享的Gist ID
  async getSharedGistId() {
    try {
      // 获取Token
      const token = localStorage.getItem('github_sync_token');
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      // 如果有Token，添加到请求头
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      // 从GitHub仓库获取共享的Gist ID
      const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/gist-id.txt`, {
        headers: headers
      });
      
      if (response.ok) {
        const data = await response.json();
        const gistId = atob(data.content).trim();
        console.log('Retrieved shared Gist ID:', gistId);
        
        // 检查是否是有效的Gist ID（不是占位符）
        if (gistId && gistId !== 'placeholder' && gistId.length > 10) {
          return gistId;
        } else {
          console.log('Invalid or placeholder Gist ID:', gistId);
          return null;
        }
      } else if (response.status === 404) {
        console.log('No shared Gist ID found');
        return null;
      } else {
        throw new Error(`GitHub API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to get shared Gist ID:', error);
      return null;
    }
  }

  // 保存共享的Gist ID到GitHub仓库
  async saveSharedGistId(gistId) {
    try {
      const githubToken = localStorage.getItem('github_sync_token');
      if (!githubToken) {
        console.log('No GitHub token, cannot save shared Gist ID');
        return false;
      }

      const content = btoa(gistId); // 编码为base64
      let response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/gist-id.txt`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Update shared Gist ID',
          content: content,
          sha: await this.getFileSha('gist-id.txt')
        })
      });

      if (response.ok) {
        console.log('Shared Gist ID saved successfully');
        return true;
      } else {
        if (response.status === 409) {
          // 冲突：刷新最新SHA后重试一次
          const latestSha = await this.getFileSha('gist-id.txt');
          const retryBody = {
            message: 'Update shared Gist ID',
            content: content,
            sha: latestSha
          };
          response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/gist-id.txt`, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(retryBody)
          });
          if (response.ok) {
            console.log('Shared Gist ID saved successfully (after SHA refresh)');
            return true;
          }
        }
        console.error('Failed to save shared Gist ID:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Failed to save shared Gist ID:', error);
      return false;
    }
  }

  // 获取文件的SHA（用于更新文件）
  async getFileSha(filename) {
    try {
      const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${filename}`);
      if (response.ok) {
        const data = await response.json();
        return data.sha;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // 保存配置到GitHub仓库
  async saveConfigToGitHub(config) {
    try {
      const githubToken = localStorage.getItem('github_sync_token');
      if (!githubToken) {
        console.error('❌ No GitHub token found, cannot save to repository');
        console.log('💡 Please set a GitHub token using the "🔑 设置Token" button');
        return false;
      }
      
      console.log('🔑 GitHub token found, proceeding with save...');

      const content = btoa(JSON.stringify(config, null, 2)); // 编码为base64
      const sha = await this.getFileSha(this.configFile);
      
      const requestBody = {
        message: 'Update user configuration',
        content: content
      };
      
      // 如果文件已存在，需要提供SHA
      if (sha) {
        requestBody.sha = sha;
      }
      
      let response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.configFile}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('Config saved to GitHub repository successfully');
        return true;
      } else {
        if (response.status === 409) {
          // 冲突：刷新最新SHA后重试一次
          const latestSha = await this.getFileSha(this.configFile);
          if (latestSha) {
            requestBody.sha = latestSha;
            response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.configFile}`, {
              method: 'PUT',
              headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
            if (response.ok) {
              console.log('Config saved to GitHub repository successfully (after SHA refresh)');
              return true;
            }
          }
        }
        const errorText = await response.text();
        console.error('❌ Failed to save config to GitHub repository:', response.status, response.statusText, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Exception while saving config to GitHub repository:', error);
      return false;
    }
  }

  // 从GitHub获取配置（保留原方法作为备用）
  async getConfigFromGitHub() {
    try {
      // 获取Token
      const token = localStorage.getItem('github_sync_token');
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      // 如果有Token，添加到请求头
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      // 使用GitHub API获取文件内容
      const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.configFile}`, {
        headers: headers
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = atob(data.content); // 解码base64内容
        console.log('Successfully retrieved config from GitHub repo:', content);
        return JSON.parse(content);
      } else if (response.status === 404) {
        // 文件不存在，返回null
        console.log('Config file not found in GitHub repo');
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
  applyConfig(config, options = {}) {
    // 与当前配置做并集合并，避免被旧端缩减覆盖
    const current = this.getCurrentConfig();
    const merged = this.mergeConfigs(current, config);

    if (merged.allowedUsers) {
      if (window.AUTH_CONFIG) {
        window.AUTH_CONFIG.allowedUsers = merged.allowedUsers;
      }
      if (window.githubAuth && window.githubAuth.config) {
        window.githubAuth.config.allowedUsers = merged.allowedUsers;
      }
    }
    
    if (merged.adminUsers) {
      if (window.AUTH_CONFIG) {
        window.AUTH_CONFIG.adminUsers = merged.adminUsers;
      }
      if (window.githubAuth && window.githubAuth.config) {
        window.githubAuth.config.adminUsers = merged.adminUsers;
      }
    }

    // 保存到本地存储（触发其他标签 storage 事件），静默模式下不触发广播回环
    if (!options.silent) {
      localStorage.setItem('fl510_docs_config', JSON.stringify(merged));
    } else {
      try {
        // 仍更新本地，但不期望触发回环（某些浏览器对同值写入不触发事件）
        const prev = localStorage.getItem('fl510_docs_config');
        const next = JSON.stringify(merged);
        if (prev !== next) localStorage.setItem('fl510_docs_config', next);
      } catch (_) {}
    }
    
    console.log('Config applied:', merged);
  }

  // 直接替换当前配置（用于已确认来源更新更新的情况，比如从仓库拉取或主动端广播）
  applyConfigReplace(config, options = {}) {
    if (config.allowedUsers) {
      if (window.AUTH_CONFIG) window.AUTH_CONFIG.allowedUsers = config.allowedUsers;
      if (window.githubAuth && window.githubAuth.config) window.githubAuth.config.allowedUsers = config.allowedUsers;
    }
    if (config.adminUsers) {
      if (window.AUTH_CONFIG) window.AUTH_CONFIG.adminUsers = config.adminUsers;
      if (window.githubAuth && window.githubAuth.config) window.githubAuth.config.adminUsers = config.adminUsers;
    }
    const next = JSON.stringify(config);
    if (!options.silent) {
      localStorage.setItem('fl510_docs_config', next);
    } else {
      const prev = localStorage.getItem('fl510_docs_config');
      if (prev !== next) localStorage.setItem('fl510_docs_config', next);
    }
    console.log('Config replaced:', config);
  }

  // 若可用，尝试向服务器汇聚最新配置（仓库/Gist）
  async tryConvergeToServer(config) {
    try {
      const token = localStorage.getItem('github_sync_token');
      if (!token) return;
      // 读取当前仓库配置做对比，避免无谓写入
      const repoCfg = await this.getConfigFromGitHub();
      const needPush = !repoCfg || !this.isNewerConfig(repoCfg, config) || (JSON.stringify(repoCfg.allowedUsers||[]) !== JSON.stringify(config.allowedUsers||[]));
      if (needPush) {
        await this.saveConfigToGitHub(config);
        await this.saveConfigToGist(config);
      }
    } catch (_) {}
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
        // 创建临时配置用于测试保存
        const tempConfig = { ...currentConfig };
        tempConfig.allowedUsers.push(username);
        tempConfig.lastUpdated = new Date().toISOString();
        
        // 先尝试保存到GitHub仓库（主要存储）
        console.log('Attempting to save config to GitHub repository...');
        const repoSuccess = await this.saveConfigToGitHub(tempConfig);
        
        if (repoSuccess) {
          console.log('✅ Config saved to GitHub repository');
          
          // 只有GitHub保存成功后才更新本地配置
          currentConfig.allowedUsers.push(username);
          currentConfig.lastUpdated = tempConfig.lastUpdated;
          
          // 更新本地配置（使用替换模式，确保添加生效）
          this.applyConfigReplace(currentConfig);
          
          // 保存到本地存储
          localStorage.setItem('fl510_docs_config', JSON.stringify(currentConfig));
          
          // 保存到GitHub Gist（备用存储）
          await this.saveConfigToGist(currentConfig);
          
          console.log(`User ${username} added to config:`, currentConfig);
          // 通知用户管理面板刷新
          this.notifyUserListUpdate();
          return true;
        } else {
          console.error('❌ Failed to save config to GitHub repository');
          // 显示Token错误通知
          this.showTokenErrorNotification('添加用户失败', '无法将用户添加保存到GitHub仓库，请检查Token设置');
          return false;
        }
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
          // 创建临时配置用于测试保存
          const tempConfig = { ...currentConfig };
          tempConfig.allowedUsers.splice(index, 1);
          tempConfig.lastUpdated = new Date().toISOString();
          
          // 先尝试保存到GitHub仓库（主要存储）
          console.log('Attempting to save config to GitHub repository...');
          const repoSuccess = await this.saveConfigToGitHub(tempConfig);
          
          if (repoSuccess) {
            console.log('✅ Config updated in GitHub repository');
            
            // 只有GitHub保存成功后才更新本地配置
            currentConfig.allowedUsers.splice(index, 1);
            currentConfig.lastUpdated = tempConfig.lastUpdated;
            
            // 更新本地配置（使用替换模式，确保删除生效）
            this.applyConfigReplace(currentConfig);
            
            // 保存到本地存储
            localStorage.setItem('fl510_docs_config', JSON.stringify(currentConfig));
            
            // 保存到GitHub Gist（备用存储）
            await this.saveConfigToGist(currentConfig);
            
            console.log(`User ${username} removed from config:`, currentConfig);
            // 通知用户管理面板刷新
            this.notifyUserListUpdate();
            return true;
          } else {
            console.error('❌ Failed to save config to GitHub repository');
            // 显示Token错误通知
            this.showTokenErrorNotification('删除用户失败', '无法将用户删除保存到GitHub仓库，请检查Token设置');
            return false;
          }
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
      alert(`✅ 用户 ${username} 已成功添加并已同步到GitHub`);
      if (usernameInput) {
        usernameInput.value = '';
      }
      this.updateUsersList();
    } else {
      // GitHub保存失败，不显示成功消息
      console.log(`❌ 用户添加失败：GitHub保存失败`);
    }
  }

  // 同步用户
  async syncUsers() {
    try {
      console.log('🔄 Starting user sync...');
      const success = await this.syncUsersFromGitHub();
      if (success) {
        console.log('✅ User sync completed successfully');
        alert('用户同步成功');
        this.updateUsersList();
      } else {
        console.error('❌ User sync failed');
        this.showTokenErrorNotification('同步失败', '无法从GitHub同步用户列表，请检查Token设置或网络连接');
      }
    } catch (error) {
      console.error('❌ Exception during user sync:', error);
      this.showTokenErrorNotification('同步失败', '同步用户时发生错误，请检查Token设置');
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

  // 通知用户管理面板刷新
  notifyUserListUpdate() {
    // 触发自定义事件，通知其他组件更新
    try {
      window.dispatchEvent(new CustomEvent('userListUpdated'));
    } catch (error) {
      console.warn('Failed to dispatch userListUpdated event:', error);
    }
  }

  // 显示Token错误通知
  showTokenErrorNotification(title, message) {
    // 创建通知弹窗
    const notification = document.createElement('div');
    notification.className = 'token-error-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-header">
          <span class="notification-icon">⚠️</span>
          <h4>${title}</h4>
          <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notification-body">
          <p>${message}</p>
          <div class="notification-actions">
            <button class="btn-primary" onclick="window.open('#admin-panel', '_self')">
              🔑 设置Token
            </button>
            <button class="btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
              稍后处理
            </button>
          </div>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .token-error-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fff;
        border: 1px solid #e74c3c;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .notification-content {
        padding: 0;
      }

      .notification-header {
        background: #e74c3c;
        color: white;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 8px 8px 0 0;
      }

      .notification-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .notification-icon {
        font-size: 18px;
        margin-right: 8px;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .notification-body {
        padding: 16px;
      }

      .notification-body p {
        margin: 0 0 16px 0;
        color: #333;
        line-height: 1.4;
      }

      .notification-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .btn-primary, .btn-secondary {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #e74c3c;
        color: white;
      }

      .btn-primary:hover {
        background: #c0392b;
      }

      .btn-secondary {
        background: #f8f9fa;
        color: #666;
        border: 1px solid #dee2e6;
      }

      .btn-secondary:hover {
        background: #e9ecef;
      }
    `;
    document.head.appendChild(style);

    // 添加到页面
    document.body.appendChild(notification);

    // 5秒后自动消失
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // 移除用户
  async removeUser(username) {
    if (confirm(`确定要移除用户 ${username} 吗？`)) {
      const success = await this.removeUserFromGitHub(username);
      if (success) {
        alert(`✅ 用户 ${username} 已成功移除并已同步到GitHub`);
        this.updateUsersList();
      } else {
        // GitHub保存失败，不显示成功消息
        console.log(`❌ 用户移除失败：GitHub保存失败`);
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
