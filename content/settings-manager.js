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
    isFirstTime: true
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
      return settings;
    } catch (err) {
      console.error('[专注模式] 加载设置失败:', err);
      // 尝试从localStorage加载备份
      try {
        const backup = localStorage.getItem(`${FocusSettingsManager.STORAGE_KEY}_backup`);
        if (backup) {
          return JSON.parse(backup);
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
   * 获取提醒语
   */
  async getReminders() {
    if (!this.initialized) {
      await this.initialize();
    }
    return [...this.settings.reminders];
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof FocusSettingsManager !== 'undefined' && !window.FocusSettingsManager) window.FocusSettingsManager = FocusSettingsManager; 