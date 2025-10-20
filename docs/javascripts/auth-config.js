// GitHub OAuth认证配置
window.AUTH_CONFIG = {
  // GitHub OAuth App配置（需要在GitHub上创建）
  clientId: 'Ov23liRKjdSsXU8roqUl', // 需要替换为实际的Client ID
  redirectUri: 'https://naruto-ai-wy.github.io/fl510-docs/',
  
  // 允许访问的用户列表（GitHub用户名）
  allowedUsers: [
    'Naruto-AI-WY', // 您的GitHub用户名
    // 可以添加更多用户名
  ],
  
  // 允许访问的组织（可选）
  allowedOrganizations: [
    // 'your-organization-name',
  ],
  
  // 管理员用户列表
  adminUsers: [
    'Naruto-AI-WY', // 您的GitHub用户名
  ],
  
  // 认证状态存储键
  authStorageKey: 'fl510_docs_auth',
  
  // 认证检查间隔（毫秒）
  authCheckInterval: 300000, // 5分钟
};
