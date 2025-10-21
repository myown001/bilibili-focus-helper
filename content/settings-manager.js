/**
 * 专注模式设置管理器
 * 负责处理专注模式的所有设置，包括密码、提醒语等
 */
class FocusSettingsManager {
  // 使用独立的存储键，避免与现有设置冲突
  static STORAGE_KEY = 'focusModeSettings';
  
  // 默认设置
  static DEFAULT_SETTINGS = {
    password: '',
    reminderCount: 3,
    reminders: [],
    isFirstTime: true,
    // 添加自动全屏相关设置
    autoActivate: true,
    forceFullscreen: true,
    filterDanmaku: true,
    allowExitFullscreen: false,
    hideComments: false,
    hideRecommendations: false,
    hideSidebar: false,
    hideHeader: false,
    darkMode: false,
    reminderInterval: 20
  };
  
  constructor() {
    this.settings = null;
    this.initialized = false;
  }
  
  /**
   * 初始化设置管理器
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.settings = await FocusSettingsManager.loadSettings();
      this.initialized = true;
      console.log('[专注模式] 设置管理器初始化成功');
    } catch (err) {
      console.error('[专注模式] 设置管理器初始化失败:', err);
      // 使用默认设置
      this.settings = { ...FocusSettingsManager.DEFAULT_SETTINGS };
    }
  }
  
  /**
   * 加载设置
   */
  static async loadSettings() {
    try {
      const settings = await StorageUtils.load(FocusSettingsManager.STORAGE_KEY, FocusSettingsManager.DEFAULT_SETTINGS);
      console.log('[专注模式] 成功加载设置');
      
      // 确保返回的设置包含所有默认值
      return {
        ...FocusSettingsManager.DEFAULT_SETTINGS,
        ...settings,
        // 强制检查isFirstTime字段，如果不存在则使用默认值
        isFirstTime: settings?.isFirstTime !== undefined ? settings.isFirstTime : FocusSettingsManager.DEFAULT_SETTINGS.isFirstTime
      };
    } catch (err) {
      console.error('[专注模式] 加载设置失败:', err);
      // 尝试从localStorage加载备份
      try {
        const backup = localStorage.getItem(`${FocusSettingsManager.STORAGE_KEY}_backup`);
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          // 确保备份数据也包含所有默认值
          return {
            ...FocusSettingsManager.DEFAULT_SETTINGS,
            ...parsedBackup,
            // 强制检查isFirstTime字段
            isFirstTime: parsedBackup?.isFirstTime !== undefined ? parsedBackup.isFirstTime : FocusSettingsManager.DEFAULT_SETTINGS.isFirstTime
          };
        }
      } catch (localErr) {
        console.warn('[专注模式] 从localStorage加载备份失败:', localErr);
      }
      return { ...FocusSettingsManager.DEFAULT_SETTINGS };
    }
  }
  
  /**
   * 保存设置
   */
  static async saveSettings(settings) {
    try {
      // 先保存到localStorage作为备份
      localStorage.setItem(`${FocusSettingsManager.STORAGE_KEY}_backup`, JSON.stringify(settings));
      
      // 保存到Chrome存储
      await StorageUtils.save(FocusSettingsManager.STORAGE_KEY, settings);
      console.log('[专注模式] 成功保存设置');
      return true;
    } catch (err) {
      console.error('[专注模式] 保存设置失败:', err);
      return false;
    }
  }
  
  /**
   * 获取当前设置
   */
  async getSettings() {
    if (!this.initialized) {
      await this.initialize();
    }
    return { ...this.settings };
  }
  
  /**
   * 更新设置
   */
  async updateSettings(newSettings) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    this.settings = { ...this.settings, ...newSettings };
    return await FocusSettingsManager.saveSettings(this.settings);
  }
  
  /**
   * 重置设置
   */
  async resetSettings() {
    this.settings = { ...FocusSettingsManager.DEFAULT_SETTINGS };
    return await FocusSettingsManager.saveSettings(this.settings);
  }
  
  /**
   * 验证密码
   */
  async validatePassword(password) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.settings.password === password;
  }
  
  /**
   * 更新密码
   * @param {string} newPassword - 新密码
   */
  async updatePassword(newPassword) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      this.settings.password = newPassword;
      const result = await FocusSettingsManager.saveSettings(this.settings);
      
      if (result) {
        console.log('[专注模式] 密码已更新');
      } else {
        console.error('[专注模式] 更新密码失败');
      }
      
      return result;
    } catch (err) {
      console.error('[专注模式] 更新密码时出错:', err);
      return false;
    }
  }
  
  /**
   * 获取提醒语
   */
  async getReminders() {
    if (!this.initialized) {
      await this.initialize();
    }
    return [...this.settings.reminders];
  }
  
  /**
   * 更新提醒语
   * @param {string[]} reminders - 新的提醒语数组
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateReminders(reminders) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // 确保提醒语是数组
      if (!Array.isArray(reminders)) {
        reminders = [reminders];
      }
      
      // 过滤空字符串
      reminders = reminders.filter(r => r && r.trim() !== '');
      
      // 如果没有有效的提醒语，使用默认提醒语
      if (reminders.length === 0) {
        reminders = ['请专注学习，不要分心', '坚持才能成功', '学习需要专注'];
      }
      
      // 更新设置
      this.settings.reminders = reminders;
      this.settings.reminderCount = reminders.length;
      
      // 保存设置
      const result = await FocusSettingsManager.saveSettings(this.settings);
      
      if (result) {
        console.log('[专注模式] 提醒语已更新:', reminders);
      } else {
        console.error('[专注模式] 更新提醒语失败');
      }
      
      return result;
    } catch (err) {
      console.error('[专注模式] 更新提醒语时出错:', err);
      return false;
    }
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof FocusSettingsManager !== 'undefined' && !window.FocusSettingsManager) {
  window.FocusSettingsManager = FocusSettingsManager;
} 