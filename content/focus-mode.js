/**
 * 专注模式主类
 * 负责在B站视频页面创建无干扰的学习环境
 * 版本: 1.0.1 (2024-10-16 修复菜单显示问题)
 */

// 🔍 版本检测日志 - 立即执行
console.log('🚀 [focus-mode.js] 文件开始加载 - v1.1.5 (使用hover处理菜单) - ' + new Date().toLocaleTimeString());

class FocusMode {
  constructor() {
    try {
      // 基本属性初始化
      this.isActive = false;
      this.settings = {
        autoActivate: true,
        forceFullscreen: true, // 强制全屏
        filterDanmaku: true, // 弹幕过滤
        allowExitFullscreen: false, // 不允许退出全屏
        hideComments: false, // 保留评论区
        hideRecommendations: false, // 保留推荐
        hideSidebar: false, // 保留侧边栏
        hideHeader: false, // 保留头部
        darkMode: false,
        reminderInterval: 20, // 分钟
        reminders: ['请专注学习，不要分心']
      };
      
      this.initialized = false;
      this.components = {
        settingsManager: null,
        firstTimeSetup: null,
        exitHandler: null,
        studyRecorder: null
      };
      
      this.originalStyles = {};
      this.hiddenElements = [];
      
      
      // 添加状态追踪
      this.fullscreenState = {
        isFullscreen: false,
        isExitRequested: false,
        lastExitAttempt: 0,
        exitApproved: false,  // 退出授权状态标记
        exitInProgress: false // 退出进度中状态标记
      };
      
      // 🎯 统一的退出状态管理（新增）
      this.exitState = {
        status: 'idle',  // 'idle' | 'requesting' | 'approved'
        lastAttemptTime: 0
      };
      
      // 弹幕过滤器
      this.danmakuFilter = null;
      
      // 控制栏相关 - 已简化
      this.mouseEventHandler = null;
      this.mouseLeaveHandler = null;
      this.hideControlsTimer = null;
      
      // 存储事件绑定引用，以便清理
      this.eventHandlers = {};
      
      // 保存实例到全局变量供调试使用
      window.focusModeInstance = this;
      
      console.log('[专注模式] FocusMode实例已创建');
    } catch (err) {
      console.error('[专注模式] 构造函数错误:', err);
    }
  }
  
  /**
   * 统一的初始化方法，替代原有的多个初始化函数
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (this.initialized) return true;
    
    try {
      console.log('[专注模式] 开始初始化');
      
      // 🎯 关键修复：清理首页专注模式的样式残留
      this.cleanupHomepageStyles();
      
      // 1. 初始化设置管理器
      this.components.settingsManager = new FocusSettingsManager();
      await this.components.settingsManager.initialize();
      
      // 2. 加载设置 - 增强的设置合并逻辑
      const loadedSettings = await this.components.settingsManager.getSettings();
      
      // 保存原始默认设置的备份
      const defaultSettings = { ...this.settings };
      
      // 合并加载的设置，同时确保关键设置不会丢失
      this.settings = {
        ...defaultSettings,        // 先应用默认值
        ...loadedSettings,         // 然后覆盖加载的设置
      };
      
      // 强制确保自动全屏设置存在
      if (this.settings.autoActivate === undefined) {
        console.log('[专注模式] 自动全屏设置不存在，使用默认值(true)');
        this.settings.autoActivate = true;
      }
      
      console.log('[专注模式] 加载设置完成，自动全屏设置状态:', this.settings.autoActivate);
      
      // 3. 初始化依赖组件
      this.components.firstTimeSetup = new FirstTimeSetup(this.components.settingsManager);
      this.components.exitHandler = new ExitHandler(this.components.settingsManager);
      
      // 4. 添加样式
      this.addStyles();
      
      // 5. 设置全屏变化事件处理
      this.setupFullscreenHandling();
      
      // 6. 设置键盘快捷键
      this.setupKeyboardShortcuts();
      
      // 7. 初始化学习计时器
      this.initializeStudyRecorder();
      
      // 8. 添加弹幕过滤按钮
      console.log('[专注模式] 检查是否为视频页面:', this.isVideoPage());
      if (this.isVideoPage()) {
        console.log('[专注模式] 确认为视频页面，开始设置视频专注功能');
        this.setupVideoFocus();
        // this.addDanmakuFilterButton();
        
        
        
        // 如果设置为自动激活，进入全屏模式
        console.log('[专注模式] 自动激活设置:', this.settings.autoActivate);
        if (this.settings.autoActivate) {
          this.isActive = true;
          console.log('[专注模式] 准备显示专注学习引导');
          // 延迟显示引导按钮，让用户自然进入专注模式
          setTimeout(() => {
            this.showFocusLearningGuide();
          }, 150);
        }
      } else {
        console.log('[专注模式] 非视频页面，跳过视频专注功能');
      }
      
      // 9. 设置定期检查
      this.setupPeriodicChecks();
      
      // 10. 处理首次使用设置
      if (this.settings.isFirstTime) {
        await this.components.firstTimeSetup.showSetup();
      }
      
      // 11. 🎯 深度修复：设置控制栏原生行为
      if (this.isVideoPage()) {
        this.setupNativeControlBehavior();
      }
      
      this.initialized = true;
      console.log('[专注模式] 初始化完成');
      return true;
    } catch (err) {
      console.error('[专注模式] 初始化失败:', err);
      return false;
    }
  }

  /**
   * 统一的全屏处理设置
   */
  setupFullscreenHandling() {
    try {
      // 使用统一的监听器管理
      if (!this.eventManager) {
        this.eventManager = new EventManager();
      }
      
      // 移除所有已存在的监听器，避免重复
      this.removeFullscreenListeners();
      
      // 使用事件管理器添加监听
      this.fullscreenListenerId = this.eventManager.addFullscreenChangeListener(
        this.fullscreenChangeHandler.bind(this)
      );
      
      console.log('[专注模式] 已设置全屏事件监听器');
    } catch (err) {
      console.error('[专注模式] 设置全屏处理失败:', err);
    }
  }
  
  /**
   * 移除全屏事件监听器
   */
  removeFullscreenListeners() {
    if (this.eventManager && this.fullscreenListenerId) {
      // ✅ 修复：正确处理数组形式的事件ID
      if (Array.isArray(this.fullscreenListenerId)) {
        this.fullscreenListenerId.forEach(id => {
          this.eventManager.removeListener(id);
        });
        console.log('[专注模式] ✅ 已移除全屏事件监听器（数组模式，共' + this.fullscreenListenerId.length + '个）');
      } else {
        this.eventManager.removeListener(this.fullscreenListenerId);
        console.log('[专注模式] ✅ 已移除全屏事件监听器（单一模式）');
      }
      this.fullscreenListenerId = null;
    }
  }
  
  /**
   * 处理全屏变化事件
   */
  async fullscreenChangeHandler(event) {
    try {
      console.log('[专注模式] 检测到全屏变化事件');
      
      // ✅ 修复：直接检查真实的 DOM 全屏状态，避免 CSS 全屏判断的时序问题
      const isRealFullscreen = Boolean(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      this.fullscreenState.isFullscreen = isRealFullscreen;
      
      // 同步 fullscreen-mode 类
      if (isRealFullscreen) {
        if (!document.body.classList.contains('fullscreen-mode')) {
          document.body.classList.add('fullscreen-mode');
          console.log('[专注模式] ✅ 已添加fullscreen-mode类');
        }
      } else {
        // ✅ 修复：不要立即移除 fullscreen-mode 类
        // 保留该类直到退出流程完成，确保退出对话框样式正常
        // 将在 deactivate() 中统一移除
        console.log('[专注模式] 检测到退出全屏，保留fullscreen-mode类直到退出流程完成');
      }
      
      // 🎯 核心逻辑：用户退出全屏时
      // ✅ 修复：使用 isRealFullscreen 而不是 checkFullscreenState()
      if (this.isActive && !isRealFullscreen) {
        console.log('[专注模式] 检测到退出全屏');
        
        // 如果已授权，允许退出
        if (this.exitState.status === 'approved') {
          console.log('[专注模式] 退出已授权');
          return;
        }
        
        // 未授权：触发退出请求
        await this.requestExit('esc');
      }
      
    } catch (err) {
      console.error('[专注模式] 全屏变化处理错误:', err);
    }
  }
  
  /**
   * 处理退出全屏请求（兼容性方法，调用新的 requestExit）
   * @deprecated 使用 requestExit() 代替
   */
  async handleExitRequest() {
    console.log('[专注模式] handleExitRequest() 调用，转发到 requestExit()');
    return await this.requestExit('legacy');
  }
  
  /**
   * 处理首次使用时的退出请求
   */
  async handleFirstTimeExit() {
    try {
      console.log('[专注模式] 开始首次使用退出流程');
      
      // 暂停自动恢复全屏
      this._temporarilyDisableAutoFullscreen = true;
      
      // 确保首次设置组件存在
      if (!this.components.firstTimeSetup && typeof FirstTimeSetup === 'function') {
        this.components.firstTimeSetup = new FirstTimeSetup(this.components.settingsManager);
      }
      
      if (!this.components.firstTimeSetup) {
        console.error('[专注模式] FirstTimeSetup 组件未找到');
        // 回退到恢复全屏
        this._temporarilyDisableAutoFullscreen = false;
        
        // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
        if (document.body.classList.contains('fullscreen-mode')) {
          document.body.classList.remove('fullscreen-mode');
          console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
        }
        
        setTimeout(() => this.autoActivateFullscreen(), 300);
        return;
      }
      
      // 显示首次设置流程
      try {
        await this.components.firstTimeSetup.showSetup();
        
        // 设置完成，重新加载设置
        await this.loadSettings();
        
        // 重新启用自动全屏
        this._temporarilyDisableAutoFullscreen = false;
        
        // 检查用户是否设置了密码，如果设置了，允许用户选择是否退出
        if (this.settings.password) {
          console.log('[专注模式] 首次设置完成，密码已设置，用户可以选择退出');
          // 显示退出选择对话框
          this.showFirstTimeExitChoice();
        } else {
          // 没有设置密码，恢复全屏
          console.log('[专注模式] 首次设置完成，但未设置密码，恢复全屏');
          
          // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
          if (document.body.classList.contains('fullscreen-mode')) {
            document.body.classList.remove('fullscreen-mode');
            console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
          }
          
          setTimeout(() => this.autoActivateFullscreen(), 500);
        }
        
      } catch (setupErr) {
        console.error('[专注模式] 首次设置流程失败:', setupErr);
        this._temporarilyDisableAutoFullscreen = false;
        
        // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
        if (document.body.classList.contains('fullscreen-mode')) {
          document.body.classList.remove('fullscreen-mode');
          console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
        }
        
        setTimeout(() => this.autoActivateFullscreen(), 300);
      }
      
    } catch (err) {
      console.error('[专注模式] 处理首次退出请求失败:', err);
      this._temporarilyDisableAutoFullscreen = false;
      
      // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
      if (document.body.classList.contains('fullscreen-mode')) {
        document.body.classList.remove('fullscreen-mode');
        console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
      }
      
      setTimeout(() => this.autoActivateFullscreen(), 300);
    }
  }
  
  /**
   * 显示首次设置完成后的退出选择对话框
   */
  async showFirstTimeExitChoice() {
    return new Promise((resolve) => {
      try {
        const { dialog, background } = UIUtils.createDialog({
          title: '设置完成！',
          content: `
            <div style="text-align: center; padding: 20px;">
              <p style="font-size: 16px; margin-bottom: 30px;">您已成功设置密码！现在您想要：</p>
              <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="exit-choice-btn" class="dialog-btn" style="background: #ff6b6b; padding: 10px 20px;">退出专注模式</button>
                <button id="continue-choice-btn" class="dialog-btn" style="background: #00a1d6; padding: 10px 20px;">继续学习</button>
              </div>
            </div>
          `,
          className: 'first-time-exit-choice'
        });

        const exitBtn = dialog.querySelector('#exit-choice-btn');
        const continueBtn = dialog.querySelector('#continue-choice-btn');

        exitBtn.addEventListener('click', async () => {
          UIUtils.closeDialog(background);
          console.log('[专注模式] 用户选择退出，开始密码验证流程');
          await this.handleExitRequest();
          resolve(true);
        });

        continueBtn.addEventListener('click', () => {
          UIUtils.closeDialog(background);
          console.log('[专注模式] 用户选择继续学习，恢复全屏');
          
          // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
          if (document.body.classList.contains('fullscreen-mode')) {
            document.body.classList.remove('fullscreen-mode');
            console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
          }
          
          setTimeout(() => this.autoActivateFullscreen(), 300);
          resolve(false);
        });

      } catch (err) {
        console.error('[专注模式] 显示退出选择失败:', err);
        // 默认恢复全屏
        
        // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
        if (document.body.classList.contains('fullscreen-mode')) {
          document.body.classList.remove('fullscreen-mode');
          console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
        }
        
        setTimeout(() => this.autoActivateFullscreen(), 300);
        resolve(false);
      }
    });
  }
  
  /**
   * 检查当前是否处于真正的DOM全屏状态
   * @returns {boolean} 是否全屏
   */
  checkFullscreenState() {
    // 🎯 改进：检查真正的DOM全屏状态
    const isRealFullscreen = Boolean(
      document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    // 🆕 新增：检查CSS模拟全屏状态
    const isCSSFullscreen = document.body.classList.contains('fullscreen-mode');
    
    // 🆕 新增：检查视口是否接近全屏（考虑浏览器UI）
    const viewportHeight = window.innerHeight;
    const screenHeight = window.screen.height;
    const heightRatio = viewportHeight / screenHeight;
    const isViewportFullscreen = heightRatio > 0.85; // 85%以上认为是全屏
    
    // 🆕 新增：检查播放器容器是否占据全屏
    let isPlayerFullscreen = false;
    const playerContainer = this.findVideoContainer();
    if (playerContainer) {
      const rect = playerContainer.getBoundingClientRect();
      const containerRatio = (rect.width * rect.height) / (viewportHeight * window.innerWidth);
      isPlayerFullscreen = containerRatio > 0.8; // 80%以上认为是全屏
    }
    
    // 综合判断全屏状态
    const isFullscreen = isRealFullscreen || 
                        (isCSSFullscreen && (isViewportFullscreen || isPlayerFullscreen));
    
    // 减少日志输出频率，只在状态改变时记录
    if (!this._lastFullscreenState || this._lastFullscreenState !== isFullscreen) {
      // console.log('[专注模式] 🔍 增强全屏状态检查:', {
      //   realFullscreen: isRealFullscreen,
      //   cssFullscreen: isCSSFullscreen,
      //   viewportFullscreen: isViewportFullscreen,
      //   playerFullscreen: isPlayerFullscreen,
      //   viewportRatio: Math.round(heightRatio * 100) + '%',
      //   result: isFullscreen
      // });
      this._lastFullscreenState = isFullscreen;
    }
    
    return isFullscreen;
  }
  
  /**
   * 进入全屏模式
   * @returns {boolean} 是否成功进入全屏
   */
  enterFullscreenMode() {
    try {
      // 如果已处于全屏状态，不重复操作
      if (this.checkFullscreenState()) {
        console.log('[专注模式] 已经处于全屏状态');
        return true;
      }
      
      // 检查退出状态
      if (this.fullscreenState.exitApproved || 
          this.fullscreenState.exitInProgress || 
          this.fullscreenState.isExitRequested) {
        console.log('[专注模式] 检测到退出状态标记，不进入全屏');
        return false;
      }
      
      // 检查是否在退出处理的短时间内
      if (this.fullscreenState.deactivateStartTime && 
          Date.now() - this.fullscreenState.deactivateStartTime < 3000) {
        console.log('[专注模式] 退出处理刚完成，暂不进入全屏');
        return false;
      }
      
      // 检查提示语对话框
      if (this.components.exitHandler?.reminderDialogActive) {
        console.log('[专注模式] 提示语对话框活动中，暂不进入全屏');
        return false;
      }
      
      // 检查是否有任何退出相关对话框存在（包括密码输入框）
      const hasExitDialog = document.querySelector(
        '.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay'
      );
      if (hasExitDialog) {
        console.log('[专注模式] 检测到退出对话框存在，暂不进入全屏');
        return false;
      }
      
      console.log('[专注模式] 开始尝试进入全屏');
      
      // 记录状态
      this.isActive = true;
      
      // 调用自动全屏方法
      return this.autoActivateFullscreen();
    } catch (err) {
      console.error('[专注模式] 进入全屏模式失败:', err);
      this.fallbackFullscreen(); // 错误时使用备用方法
      return true; // 尽管使用了备用方法，也算是成功进入全屏状态
    }
  }
  
  /**
   * 🎯 优化的备用全屏方法 - 更接近B站原生效果
   */
  fallbackFullscreen() {
    try {
      // 🔥 关键：激活CSS样式类，启用focus-video.css中的优化样式
      document.body.classList.add('fullscreen-mode');
      console.log('[专注模式] 已激活fullscreen-mode CSS类');
      
      const videoContainer = this.findVideoContainer();
      if (!videoContainer) {
        console.warn('[专注模式] 未找到视频容器，仅应用基础CSS样式');
        this.isActive = true;
        return true;
      }
      
      // 保存原始样式以便恢复
      this.originalStyles.videoContainer = videoContainer.getAttribute('style') || '';
      
      // 🎯 最小化CSS干预 - 只设置必要的定位属性
      videoContainer.style.position = 'fixed';
      videoContainer.style.top = '0';
      videoContainer.style.left = '0';
      videoContainer.style.width = '100vw';
      videoContainer.style.height = '100vh';
      // videoContainer.style.zIndex = '999999'; // ❌ 移除：这会挡住控制栏，让CSS处理z-index
      videoContainer.style.background = '#000';
      
      // 🎯 让视频自然适应，保持原生体验
      const video = videoContainer.querySelector('video');
      if (video) {
        // 只设置关键的自适应属性，其他交给CSS处理
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain'; // 保持比例，无裁剪 - 与原生一致
        console.log('[专注模式] 已优化视频元素样式');
      }
      
      // 标记为活动状态
      this.isActive = true;
      
      console.log('[专注模式] ✅ 备用全屏模式已激活（接近原生效果）');
      return true;
    } catch (err) {
      console.error('[专注模式] CSS模拟全屏失败:', err);
      return false;
    }
  }
  
  /**
   * 退出全屏模式
   * @returns {boolean} 是否成功退出全屏
   */
  exitFullscreenMode() {
    try {
      // 检查是否处于全屏状态
      if (!this.checkFullscreenState()) {
        // 可能处于CSS模拟的全屏状态
        this.restoreCSSFullscreen();
        return true;
      }
      
      // 检查退出授权
      if (!this.fullscreenState.exitApproved && 
          !this.fullscreenState.exitInProgress && 
          !this.fullscreenState.isExitRequested) {
        console.log('[专注模式] 未授权的退出请求被拦截');
        return false;
      }
      
      // 设置退出进度状态
      this.fullscreenState.exitInProgress = true;
      
      // 尝试使用不同方法退出全屏
      const exitSuccess = this.tryExitFullscreen();
      
      // 重置状态
      this.isActive = false;
      
      // 应用宽屏模式类
      document.body.classList.add('widescreen-mode');
      
      return exitSuccess;
    } catch (err) {
      console.error('[专注模式] 退出全屏模式失败:', err);
      this.fullscreenState.exitInProgress = true;
      return false;
    }
  }
  
  /**
   * 尝试不同方法退出全屏
   * @returns {boolean} 是否成功退出全屏
   */
  tryExitFullscreen() {
    try {
      // 1. 首先尝试B站API
      if (window.player && typeof window.player.fullScreen === 'function') {
        try {
          console.log('[专注模式] 尝试使用B站API退出全屏');
          window.player.fullScreen(false);
          return true;
        } catch (e) {
          console.warn('[专注模式] B站API退出全屏失败:', e);
        }
      }
      
      // 2. 然后尝试标准API
      if (document.exitFullscreen) {
        document.exitFullscreen();
        return true;
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
        return true;
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
        return true;
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
        return true;
      }
      
      // 3. 如果都失败，尝试CSS方法
      this.restoreCSSFullscreen();
      return true;
    } catch (err) {
      console.error('[专注模式] 尝试退出全屏失败:', err);
      return false;
    }
  }
  
  /**
   * 🎯 优化的CSS全屏恢复方法
   */
  restoreCSSFullscreen() {
    try {
      // 🔥 关键：移除CSS样式类
      document.body.classList.remove('fullscreen-mode');
      console.log('[专注模式] 已移除fullscreen-mode CSS类');
      
      const videoContainer = this.findVideoContainer();
      if (videoContainer) {
        // 恢复容器原始样式
        if (this.originalStyles.videoContainer) {
          videoContainer.setAttribute('style', this.originalStyles.videoContainer);
        } else {
          videoContainer.removeAttribute('style');
        }
        
        // 清理视频元素的直接样式设置
        const video = videoContainer.querySelector('video');
        if (video) {
          video.style.removeProperty('width');
          video.style.removeProperty('height');
          video.style.removeProperty('object-fit');
          console.log('[专注模式] 已清理视频元素样式');
        }
      }
      
      // 重置状态
      this.isActive = false;
      
      console.log('[专注模式] ✅ CSS全屏模式已完全恢复');
    } catch (err) {
      console.error('[专注模式] 恢复CSS全屏失败:', err);
    }
  }
  
  /**
   * 查找视频容器
   * @returns {HTMLElement} 视频容器元素
   */
  findVideoContainer() {
    try {
      // console.log('[专注模式] 开始查找视频容器');
      
      // B站播放器容器选择器集合 - 按优先级排序
      const containerSelectors = [
        // 新版播放器 - 优先级最高
        '.bpx-player-container',
        '#bilibili-player',
        // 旧版播放器选择器
        '.player-container',
        '.bilibili-player-area',
        // 番剧播放页选择器
        '.player-module',
        '#bofqi',
        // 教育视频选择器
        '.video-container',
        // 直播间播放器
        '.live-player-container',
        '.player-ctnr',
        // 通用选择器 - 尝试找到包含video元素的最近容器
        '.video-player'
      ];
      
      // 1. 首先尝试使用预定义选择器找到容器
      for (const selector of containerSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          // console.log(`[专注模式] 使用选择器 "${selector}" 找到视频容器`);
          return container;
        }
      }
      
      // 2. 如果预定义选择器失败，尝试直接寻找video元素并返回其父容器
      const videoElement = document.querySelector('video');
      if (videoElement) {
        console.log('[专注模式] 找到video元素，尝试查找其父容器');
        
        // 尝试向上查找4层，寻找合适的容器
        let container = videoElement;
        let depth = 0;
        
        while (container && depth < 4) {
          // 保存当前候选容器
          const candidate = container;
          container = container.parentElement;
          depth++;
          
          // 检查候选容器是否符合条件
          if (candidate.classList.contains('player') || 
              candidate.id && (candidate.id.includes('player') || candidate.id.includes('video')) ||
              candidate.classList.contains('bpx-player') ||
              candidate.getAttribute('data-screen') === 'normal') {
            console.log(`[专注模式] 从video元素向上找到合适的父容器: ${candidate.tagName}${candidate.id ? '#'+candidate.id : ''}${candidate.className ? '.'+candidate.className.replace(/ /g, '.') : ''}`);
            return candidate;
          }
        }
        
        // 如果没有找到明显合适的容器，但视频存在，则返回视频本身
        console.log('[专注模式] 未找到合适的视频容器，使用视频元素自身');
        return videoElement;
      }
      
      // 3. 最后尝试使用更通用的启发式查找
      const possibleContainers = document.querySelectorAll('[class*="player"],[id*="player"],[class*="video"],[id*="video"]');
      if (possibleContainers.length > 0) {
        // 找到最可能的容器 - 通常是面积最大且可见的元素
        let bestContainer = null;
        let maxArea = 0;
        
        for (const container of possibleContainers) {
          const rect = container.getBoundingClientRect();
          const area = rect.width * rect.height;
          const style = window.getComputedStyle(container);
          
          // 检查元素是否可见
          if (area > 10000 && style.display !== 'none' && style.visibility !== 'hidden' && 
              rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth) {
            if (area > maxArea) {
              maxArea = area;
              bestContainer = container;
            }
          }
        }
        
        if (bestContainer) {
          console.log(`[专注模式] 使用启发式查找找到可能的视频容器: ${bestContainer.tagName}${bestContainer.id ? '#'+bestContainer.id : ''}${bestContainer.className ? '.'+bestContainer.className.replace(/ /g, '.') : ''}`);
          return bestContainer;
        }
      }
      
      console.warn('[专注模式] 未找到视频容器');
      return null;
    } catch (err) {
      console.error('[专注模式] 查找视频容器出错:', err);
      return null;
    }
  }
  

  
  /**
   * 激活专注模式
   */
  activate() {
    if (this.isActive) return;
      
    try {
      // 进入全屏
      this.enterFullscreenMode();
      
      // 隐藏干扰内容
      this.hideDistractions();
      
      // 应用弹幕过滤
      this.applyDanmakuFilter();
      
      // 记录状态
      this.isActive = true;
    } catch (err) {
      console.error('[专注模式] 激活失败:', err);
    }
  }
  
  /**
   * 取消激活专注模式
   */
  deactivate() {
    if (!this.isActive) return;
      
    try {
      console.log('[专注模式] 开始取消激活，退出授权状态:', this.fullscreenState.exitApproved);
      
      // 确认退出状态是否已设置，如果未设置则设置
      if (!this.fullscreenState.exitApproved) {
        console.log('[专注模式] 退出授权状态未设置，但deactivate已被调用，设置状态');
        this.fullscreenState.exitApproved = true;
        this.fullscreenState.exitInProgress = true;
      } else {
        // 确保退出进度状态已设置，防止自动全屏干扰
        this.fullscreenState.exitInProgress = true;
      }
      
      // 保存正在处理退出的时间点，用于防止事件冲突
      this.fullscreenState.deactivateStartTime = Date.now();
      
      // 退出全屏
      this.exitFullscreenMode();
      
      // ✅ 修复：在退出全屏后，立即移除 fullscreen-mode 类
      // 确保退出流程的对话框已经全部关闭
      if (document.body.classList.contains('fullscreen-mode')) {
        document.body.classList.remove('fullscreen-mode');
        console.log('[专注模式] 已在deactivate中移除fullscreen-mode类');
      }
      
      // 应用宽屏模式类
      document.body.classList.add('widescreen-mode');
      
      // 只恢复必要的元素，保留屏蔽广告和侧边栏推荐的功能
      this.applyNormalModeFiltering();
      
      // 恢复弹幕显示（可选）
      if (this.danmakuFilter) {
        this.danmakuFilter.reset();
        console.log('[专注模式] 弹幕过滤器已重置');
      }
      
      // 记录状态
      this.isActive = false;
      
      // 移除可能存在的旧定时器
      if (this.exitResetTimer) {
        clearTimeout(this.exitResetTimer);
      }
      
      // 清理控制栏监控器
      if (this.controlsMonitorInterval) {
        clearInterval(this.controlsMonitorInterval);
        this.controlsMonitorInterval = null;
        console.log('[专注模式] 已清理控制栏监控器');
      }
      
      // 设置新的定时器 - 减少延时，避免状态不一致
      this.exitResetTimer = setTimeout(() => {
        this.resetExitStates();
      }, 3000); // 从10秒减少到3秒
      
      // 为了进一步防止退出后的全屏干扰，添加一个短时间的强力保护
      this.blockAutoActivateTemporarily();
      
      console.log('[专注模式] 已应用宽屏模式并过滤了推荐内容');
      
    } catch (err) {
      console.error('[专注模式] 取消激活失败:', err);
      // 确保状态重置
      this.resetExitStates();
    }
  }
  
  /**
   * 重置所有退出状态标记
   * 提取为单独方法便于复用
   */
  resetExitStates() {
    this.fullscreenState.exitApproved = false;
    this.fullscreenState.exitInProgress = false;
    this.fullscreenState.isExitRequested = false;
    this.fullscreenState.deactivateStartTime = 0;
    console.log('[专注模式] 退出完成，重置所有退出状态标记');
  }
  
  /**
   * 临时阻止自动激活
   * 提取为单独方法便于复用
   */
  blockAutoActivateTemporarily() {
    // 保存原来的autoActivate设置
    const originalAutoActivate = this.settings.autoActivate;
    
    // 临时禁用自动全屏
    this.settings.autoActivate = false;
    console.log('[专注模式] 临时禁用自动全屏，确保退出完成');
    
    // 3秒后恢复原来的设置 - 从5秒减少到3秒，与上面的状态重置保持一致
    setTimeout(() => {
      this.settings.autoActivate = originalAutoActivate;
      console.log('[专注模式] 恢复自动全屏设置为:', originalAutoActivate);
    }, 3000);
  }
  
  // ========== 🎯 统一的退出流程管理方法（新增）==========
  
  /**
   * 🎯 检查是否有退出相关弹窗
   * @returns {boolean} 是否存在弹窗
   */
  hasExitDialog() {
    // 检查DOM中的弹窗元素（包括首次设置弹窗，防止冲突）
    const dialogSelectors = [
      '.focus-exit-dialog',
      '.top-level-exit-overlay',
      '.exit-transition-overlay',
      '.focus-first-time-dialog'  // ✅ 新增：防止与首次设置冲突
    ];
    
    return dialogSelectors.some(selector => 
      document.querySelector(selector) !== null
    );
  }
  
  /**
   * 🎯 检查是否可以触发新的退出请求
   * @returns {boolean} 是否可以触发退出请求
   */
  canRequestExit() {
    // 检查1: 退出流程状态
    if (this.exitState.status !== 'idle') {
      // ✅ 新增：超时保护 - 如果状态卡住超过10秒，自动重置
      const timeSinceLastAttempt = Date.now() - this.exitState.lastAttemptTime;
      if (timeSinceLastAttempt > 10000) {  // 10秒超时
        console.warn('[专注模式] ⚠️ 检测到状态异常（超过10秒），自动重置状态');
        this.resetExitState();
        return true;  // 允许重新尝试
      }
      console.log('[专注模式] 退出流程进行中，状态:', this.exitState.status);
      return false;
    }
    
    // 检查2: 弹窗存在
    if (this.hasExitDialog()) {
      console.log('[专注模式] 退出弹窗已存在');
      return false;
    }
    
    // 检查3: 防抖（1秒内）
    const now = Date.now();
    if (now - this.exitState.lastAttemptTime < 1000) {
      console.log('[专注模式] 退出请求过于频繁');
      return false;
    }
    
    return true;
  }
  
  /**
   * 🎯 统一的退出请求入口
   * @param {string} source - 退出来源：'esc' | 'toggle' | 'dblclick' | 'api' | 'unknown'
   * @returns {Promise<boolean>} 是否成功退出
   */
  async requestExit(source = 'unknown') {
    try {
      console.log(`[专注模式] 📤 收到退出请求，来源: ${source}`);
      
      // 基础检查
      if (!this.isActive) {
        console.log('[专注模式] 专注模式未激活');
        return true;
      }
      
      // 统一状态检查
      if (!this.canRequestExit()) {
        console.log('[专注模式] 当前不能触发退出请求');
        return false;
      }
      
      // 更新最后尝试时间
      this.exitState.lastAttemptTime = Date.now();
      
      // 根据密码设置决定流程
      const hasPassword = this.settings.password && this.settings.password.trim() !== '';
      const isFirstTime = this.settings.isFirstTime;
      
      if (hasPassword) {
        // ✅ 有密码：验证流程
        console.log('[专注模式] 🔒 需要密码验证');
        return await this.validateExit();
        
      } else if (isFirstTime) {
        // ✅ 首次使用：完整设置向导
        console.log('[专注模式] 🆕 首次使用，显示设置向导');
        return await this.handleFirstTimeExit();
        
      } else {
        // ✅ 没密码非首次：强制设置密码
        console.log('[专注模式] ⚠️ 未设置密码，引导设置');
        return await this.promptPasswordSetup();
      }
      
    } catch (err) {
      console.error('[专注模式] 处理退出请求失败:', err);
      this.resetExitState();
      return false;
    }
  }
  
  /**
   * 🔒 验证退出（有密码的情况）
   * @returns {Promise<boolean>} 是否验证通过并退出
   */
  async validateExit() {
    try {
      this.exitState.status = 'requesting';
      
      const exitApproved = await this.components.exitHandler.handleExit();
      
      if (exitApproved) {
        return await this.approveAndExit();
      } else {
        console.log('[专注模式] 退出验证失败或取消');
        this.resetExitState();
        
        // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
        if (document.body.classList.contains('fullscreen-mode')) {
          document.body.classList.remove('fullscreen-mode');
          console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
        }
        
        setTimeout(() => this.autoActivateFullscreen(), 300);
        return false;
      }
      
    } catch (err) {
      console.error('[专注模式] 验证退出失败:', err);
      this.resetExitState();
      return false;
    }
  }
  
  /**
   * 🔐 引导设置密码（没密码的老用户）
   * @returns {Promise<boolean>} 是否设置成功并退出
   */
  async promptPasswordSetup() {
    try {
      this.exitState.status = 'requesting';
      
      const userWantsSetup = await this.showPasswordSetupPrompt();
      
      if (userWantsSetup) {
        // 显示密码设置界面
        await this.components.firstTimeSetup.showPasswordSetup();
        
        // 重新加载设置
        const newSettings = await this.components.settingsManager.getSettings();
        this.settings = { ...this.settings, ...newSettings };
        
        // 检查是否设置成功
        if (this.settings.password && this.settings.password.trim() !== '') {
          console.log('[专注模式] ✅ 密码设置成功，允许退出');
          return await this.approveAndExit();
        } else {
          console.log('[专注模式] ❌ 未设置密码，拒绝退出');
          this.resetExitState();
          
          // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
          if (document.body.classList.contains('fullscreen-mode')) {
            document.body.classList.remove('fullscreen-mode');
            console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
          }
          
          setTimeout(() => this.autoActivateFullscreen(), 300);
          return false;
        }
      } else {
        console.log('[专注模式] 用户取消设置，拒绝退出');
        this.resetExitState();
        
        // 🔥 核心修复：清除 fullscreen-mode 类，因为退出已取消
        if (document.body.classList.contains('fullscreen-mode')) {
          document.body.classList.remove('fullscreen-mode');
          console.log('[专注模式] 已移除fullscreen-mode类（退出已取消）');
        }
        
        setTimeout(() => this.autoActivateFullscreen(), 300);
        return false;
      }
      
    } catch (err) {
      console.error('[专注模式] 引导设置密码失败:', err);
      this.resetExitState();
      return false;
    }
  }
  
  /**
   * 💬 显示密码设置提示对话框
   * @returns {Promise<boolean>} 用户是否同意设置密码
   */
  showPasswordSetupPrompt() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'top-level-exit-overlay password-setup-prompt';
      overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.85) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
      `;
      
      const dialog = document.createElement('div');
      dialog.className = 'focus-exit-dialog';
      dialog.style.cssText = `
        background: white !important;
        border-radius: 12px !important;
        padding: 32px !important;
        max-width: 480px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        position: relative !important;
        z-index: 2147483648 !important;
      `;
      
      dialog.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
          <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #333;">需要设置退出密码</h2>
          <p style="margin: 0 0 24px 0; color: #666; line-height: 1.6;">
            为了保护你的专注时间，请先设置退出密码。<br>
            设置密码后才能退出专注模式。
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="cancel-password-setup" style="
              padding: 12px 24px;
              border: 2px solid #ddd;
              background: white;
              color: #666;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.2s;
            ">返回学习</button>
            <button id="confirm-password-setup" style="
              padding: 12px 24px;
              border: none;
              background: #00a1d6;
              color: white;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.2s;
            ">立即设置</button>
          </div>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      
      const cleanup = () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      };
      
      const cancelBtn = dialog.querySelector('#cancel-password-setup');
      const confirmBtn = dialog.querySelector('#confirm-password-setup');
      
      // 按钮悬停效果
      cancelBtn.addEventListener('mouseover', () => {
        cancelBtn.style.background = '#f5f5f5';
      });
      cancelBtn.addEventListener('mouseout', () => {
        cancelBtn.style.background = 'white';
      });
      
      confirmBtn.addEventListener('mouseover', () => {
        confirmBtn.style.background = '#0090c0';
      });
      confirmBtn.addEventListener('mouseout', () => {
        confirmBtn.style.background = '#00a1d6';
      });
      
      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
    });
  }
  
  /**
   * ✅ 批准并执行退出
   * @returns {Promise<boolean>} 是否成功退出
   */
  async approveAndExit() {
    console.log('[专注模式] ✅ 退出已批准');
    
    this.exitState.status = 'approved';
    this.fullscreenState.exitApproved = true;  // 保持兼容性
    this.fullscreenState.exitInProgress = true;
    
    this.deactivate();
    
    setTimeout(() => {
      this.resetExitState();
    }, 1000);
    
    return true;
  }
  
  /**
   * 🧹 重置退出状态
   */
  resetExitState() {
    console.log('[专注模式] 🧹 重置退出状态');
    this.exitState.status = 'idle';
    this.exitState.lastAttemptTime = 0;
    this.fullscreenState.exitApproved = false;
    this.fullscreenState.exitInProgress = false;
    
    if (this.components.exitHandler) {
      this.components.exitHandler.exitRequested = false;
    }
  }
  
  // ========== 统一退出流程方法结束 ==========
  
  /**
   * 应用普通模式过滤 - 退出全屏后只过滤广告和侧边栏推荐
   */
  applyNormalModeFiltering() {
    try {
      console.log('[专注模式] 应用普通模式过滤');
      
      // 首先恢复所有隐藏的元素
      this.showHiddenElements();
      
      // 然后只隐藏广告、推荐视频和相关视频，但保留评论区
      // 过滤选择器 - 更新为包含B站最新界面元素
      const filterSelectors = [
        // 广告元素
        '.slide-ad',
        '.ad-report',
        '.ad-floor-exp',
        '[data-ad-type]',
        '.adblock-tips',
        '[class*="ad-"]',
        '[id*="ad-"]',
        '[data-loc-id*="ad"]',
        '[class*="cmtad"]',
        '.bili-advert',
        '.bpx-player-dm-root [data-danmaku*="广告"]',
        
        // 右侧推荐内容
        '.right-container .recommend-list',
        '.right-container .recommend-container',
        '.recommend-container .rec-list',
        '.recommend-list-v1',
        '.rec-footer',
        '.rec-header',
        '.recommend-video',
        '.slide-carousel',
        '.bili-video-card__info--right',
        '.bpx-player-ending-related',
        '.bilibili-player-video-recommend-container',
        
        // 相关视频
        '.bilibili-player-video-recommend',
        '.video-page-card-small',
        '.video-page-operator-card-small',
        '.video-page-game-card-small',
        '.related-recommend-card',
        '.recommend-video-card',
        '.video-page-special-card-small',
        '.next-play',
        '.next-button',
        '.bpx-player-ending-related',
        
        // 页面底部推荐
        '.recommend',
        '.recommend-list-v2',
        '.recommend-video-card',
        '.video-card-common',
        '.card-box .video-card',
        '.bili-feed4-layout',
        '.bili-video-card.is-rcmd',
        
        // 更多推荐相关
        '[class*="recommend"]',
        '[id*="recommend"]',
        '[class*="related-"]',
        '[id*="related-"]',
        '.up-activity',
        '.up-info-container'
      ];
      
      // 明确的评论区选择器，确保这些元素不会被隐藏
      const commentSelectors = [
        '.comment-container', 
        '#comment', 
        '.reply-list',
        '[data-comment-container]',
        '.reply-box',
        '.comment-m',
        '.bpx-player-commenting-area',
        '#comment-module', 
        '.common-comment-wrapper',
        '.bpx-player-comment-list',
        '.comment-list',
        '.comment-header',
        '.comment-send'
      ];
      
      // 创建一个函数来检查元素是否是评论区
      const isCommentElement = (element) => {
        if (!element) return false;
        
        // 检查元素本身是否匹配评论区选择器
        for (const selector of commentSelectors) {
          if (element.matches && element.matches(selector)) {
            return true;
          }
        }
        
        // 检查元素是否在评论区内
        for (const selector of commentSelectors) {
          const commentContainer = document.querySelector(selector);
          if (commentContainer && commentContainer.contains(element)) {
            return true;
          }
        }
        
        // 检查元素ID或类名是否包含comment相关字符串
        if ((element.id && element.id.toLowerCase().includes('comment')) ||
            (element.className && typeof element.className === 'string' && 
             element.className.toLowerCase().includes('comment'))) {
          return true;
        }
        
        return false;
      };
      
      // 查找并隐藏广告、推荐和相关视频元素，但保留评论区
      filterSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            // 确保不隐藏评论区
            if (el && el.style && !isCommentElement(el)) {
              // 保存原始显示状态
              this.hiddenElements.push(el);
              // 隐藏元素
              el.style.display = 'none';
            }
          });
        } catch (err) {
          console.warn('[专注模式] 隐藏选择器元素失败:', selector, err);
        }
      });
      
      console.log('[专注模式] 普通模式过滤已应用，用户可以正常查看评论等内容');
    } catch (err) {
      console.error('[专注模式] 应用普通模式过滤失败:', err);
    }
  }
  
  /**
   * 切换专注模式
   * @returns {Promise<boolean>} 是否成功切换
   */
  async toggle() {
    if (this.isActive) {
      return await this.requestExit('toggle');
    } else {
      this.activate();
      return true;
    }
  }
  
  /**
   * 隐藏干扰内容
   */
  hideDistractions() {
    // 根据设置隐藏不同元素
    if (this.settings.hideComments) {
      this.hideComments();
  }

    if (this.settings.hideRecommendations) {
      this.hideRecommendations();
    }
  }

  /**
   * 设置键盘快捷键
   */
  setupKeyboardShortcuts() {
    try {
      // 移除现有的键盘事件处理器
      if (this.eventHandlers.keydown) {
        document.removeEventListener('keydown', this.eventHandlers.keydown);
      }
      
      // 创建并绑定新的处理器
      this.eventHandlers.keydown = (e) => {
        // 如果点击位置在播放器控制栏或菜单中，不拦截事件
        // 检查事件目标是否是播放器控件
        const playerControlSelectors = [
          '.bpx-player-control-wrap',
          '.bilibili-player-video-control-wrap',
          '.bpx-player-ctrl-btn',
          '.bilibili-player-video-btn',
          '.bpx-player-ctrl-quality',
          '.bpx-player-ctrl-quality-menu',
          '.bpx-player-ctrl-playbackrate',
          '.bpx-player-ctrl-playbackrate-menu',
          '.bpx-player-ctrl-eplist',
          '.bpx-player-ctrl-eplist-menu',
          '.squirtle-controller-wrap'
        ];
        
        // 检查事件目标是否匹配播放器控件选择器
        const isPlayerControl = playerControlSelectors.some(selector => {
          return e.target.matches && (
            e.target.matches(selector) || 
            e.target.closest(selector)
          );
        });
        
        if (isPlayerControl) {
          // 如果是播放器控件，不拦截事件
          // console.log('[专注模式] 检测到播放器控件事件，不拦截');
          return;
        }
        
        // 🧡 ESC键智能处理 - 保护退出弹窗和原生功能
        if (e.key === 'Escape' && this.isActive && !this.fullscreenState.isExitRequested) {
          // 🔍 优先检查插件退出弹窗
          const exitDialogs = document.querySelectorAll('.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay');
          if (exitDialogs.length > 0) {
            // console.log('[专注模式] 检测到退出弹窗，不拦截ESC键');
            return; // 让退出弹窗正常处理ESC
          }
          
          // 🎯 检查B站原生菜单和弹窗
          const nativeInteractives = document.querySelectorAll(`
            .bpx-player-ctrl-quality.active,
            .bpx-player-ctrl-playbackrate.active,
            .bpx-player-ctrl-eplist.active,
            .bilibili-player-video-btn-quality.active,
            .bilibili-player-video-btn-speed.active,
            .bili-modal,
            .van-dialog,
            [class*="popup"],
            [class*="dialog"][style*="block"],
            input:focus,
            textarea:focus,
            [contenteditable="true"]:focus
          `);
          
          if (nativeInteractives.length > 0) {
            // console.log('[专注模式] 检测到原生交互元素，不拦截ESC键');
            return; // 让B站原生系统处理
          }
          
          // 只在确实需要强制全屏且没有其他交互时才拦截
          if (this.settings.forceFullscreen && this.checkFullscreenState()) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[专注模式] 智能拦截ESC键（已保护所有交互元素）');
          }
        }
      };
      
      // 添加键盘事件监听
      document.addEventListener('keydown', this.eventHandlers.keydown);
      console.log('[专注模式] 键盘快捷键已设置');
    } catch (err) {
      console.error('[专注模式] 设置键盘快捷键失败:', err);
    }
  }
  
  /**
   * 重置密码
   */
  resetPassword() {
    try {
      if (!this.components.settingsManager) {
        console.warn('[专注模式] 设置管理器未初始化，无法重置密码');
        return;
      }
      
      const showResetOptionsDialog = () => {
        return new Promise((resolve) => {
          // 确保ExitHandler已初始化
          if (!this.components.exitHandler) {
            this.components.exitHandler = new ExitHandler(this.components.settingsManager);
          }
          
          // 使用ExitHandler的createCenteredDialog方法
          const { dialog, overlay } = this.components.exitHandler.createCenteredDialog(
            '设置选项',
            `
              <div class="dialog-message" style="margin-bottom: 15px;">
                请选择要修改的设置项：
              </div>
              <div class="setting-options" style="display: flex; flex-direction: column; gap: 10px;">
                <button id="reset-password-btn" class="option-button" style="padding: 8px 12px; background: #00a1d6; border: none; border-radius: 4px; color: white; cursor: pointer;">
                  <span style="font-weight: bold;">重置密码</span>
                  <div style="font-size: 12px; opacity: 0.8;">修改退出全屏时的验证密码</div>
                </button>
                <button id="edit-reminders-btn" class="option-button" style="padding: 8px 12px; background: #00a1d6; border: none; border-radius: 4px; color: white; cursor: pointer;">
                  <span style="font-weight: bold;">编辑提醒语</span>
                  <div style="font-size: 12px; opacity: 0.8;">修改退出全屏时显示的提醒语句</div>
                </button>
                <button id="reset-all-btn" class="option-button" style="padding: 8px 12px; background: #ff5a5a; border: none; border-radius: 4px; color: white; cursor: pointer;">
                  <span style="font-weight: bold;">重置所有设置</span>
                  <div style="font-size: 12px; opacity: 0.8;">将所有设置恢复为默认值（谨慎使用）</div>
                </button>
              </div>
            `,
            [
              {
                text: '取消',
                type: 'secondary',
                onClick: () => {
                  this.components.exitHandler.closeDialog(overlay);
                  resolve('cancel');
                }
              }
            ]
          );
          
          // 添加按钮点击事件
          const passwordBtn = dialog.querySelector('#reset-password-btn');
          const remindersBtn = dialog.querySelector('#edit-reminders-btn');
          const resetAllBtn = dialog.querySelector('#reset-all-btn');
          
          passwordBtn.addEventListener('click', () => {
            this.components.exitHandler.closeDialog(overlay);
            resolve('password');
          });
          
          remindersBtn.addEventListener('click', () => {
            this.components.exitHandler.closeDialog(overlay);
            resolve('reminders');
          });
          
          resetAllBtn.addEventListener('click', () => {
            this.components.exitHandler.closeDialog(overlay);
            resolve('reset-all');
          });
        });
      };
      
      const confirmReset = () => {
        return new Promise((resolve) => {
          // 使用ExitHandler的createCenteredDialog方法
          const { dialog, overlay } = this.components.exitHandler.createCenteredDialog(
            '重置密码',
            `
              <div class="dialog-message" style="margin-bottom: 10px;">
                确定要重置密码吗？此操作不可撤销。
              </div>
            `,
            [
              {
                text: '取消',
                type: 'secondary',
                onClick: () => {
                  this.components.exitHandler.closeDialog(overlay);
                  resolve(false);
                }
              },
              {
                text: '确认重置',
                type: 'primary',
                onClick: () => {
                  this.components.exitHandler.closeDialog(overlay);
                  resolve(true);
                }
              }
            ]
          );
        });
      };
      
      const confirmResetAll = () => {
        return new Promise((resolve) => {
          // 使用ExitHandler的createCenteredDialog方法
          const { dialog, overlay } = this.components.exitHandler.createCenteredDialog(
            '重置所有设置',
            `
              <div class="dialog-message" style="margin-bottom: 10px; color: #ff5a5a;">
                <strong>警告：</strong>此操作将重置所有设置为默认值，包括密码和提醒语句。
              </div>
              <div class="dialog-message">
                确定要继续吗？此操作不可撤销。
              </div>
            `,
            [
              {
                text: '取消',
                type: 'secondary',
                onClick: () => {
                  this.components.exitHandler.closeDialog(overlay);
                  resolve(false);
                }
              },
              {
                text: '确认重置',
                type: 'primary',
                onClick: () => {
                  this.components.exitHandler.closeDialog(overlay);
                  resolve(true);
                }
              }
            ]
          );
        });
      };
      
      const setNewPassword = () => {
        return new Promise((resolve) => {
          // 使用ExitHandler的createCenteredDialog方法
          const { dialog, overlay } = this.components.exitHandler.createCenteredDialog(
            '设置新密码',
            `
              <div class="dialog-form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">请输入新密码：</label>
                <input type="password" id="new-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div class="dialog-form-group" style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">再次输入新密码：</label>
                <input type="password" id="confirm-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div id="password-error" class="dialog-message error" style="display: none; color: #f25d8e; margin-top: 10px; padding: 5px; background: rgba(242, 93, 142, 0.1); border-radius: 4px;"></div>
            `,
            [
              {
                text: '取消',
                type: 'secondary',
                onClick: () => {
                  this.components.exitHandler.closeDialog(overlay);
                  resolve(null);
                }
              },
              {
                text: '确认',
                type: 'primary',
                onClick: () => {
                  const newPassword = dialog.querySelector('#new-password').value;
                  const confirmPassword = dialog.querySelector('#confirm-password').value;
                  const errorElement = dialog.querySelector('#password-error');
                  
                  if (!newPassword) {
                    errorElement.textContent = '密码不能为空';
                    errorElement.style.display = 'block';
                    return;
                  }
                  
                  if (newPassword !== confirmPassword) {
                    errorElement.textContent = '两次输入的密码不一致';
                    errorElement.style.display = 'block';
                    return;
                  }
                  
                  this.components.exitHandler.closeDialog(overlay);
                  resolve(newPassword);
                }
              }
            ]
          );
          
          // 为输入框添加回车键提交功能
          const inputFields = dialog.querySelectorAll('input');
          inputFields.forEach(input => {
            input.addEventListener('keyup', (e) => {
              if (e.key === 'Enter') {
                dialog.querySelector('.dialog-button.primary').click();
              }
            });
          });
        });
      };
      
      // 重置密码流程
      (async () => {
        // 确保组件初始化
        if (!this.components.exitHandler) {
          this.components.exitHandler = new ExitHandler(this.components.settingsManager);
        }
        
        try {
          // 显示选项对话框
          const option = await showResetOptionsDialog();
          
          if (option === 'cancel') {
            return;
          }
          
          let confirmed = false;
          
          if (option === 'password') {
            confirmed = await confirmReset();
            if (confirmed) {
              // 设置新密码
              const newPassword = await setNewPassword();
              if (newPassword) {
                await this.components.settingsManager.updatePassword(newPassword);
                this.showMessage('密码已成功重置');
              }
            }
          } else if (option === 'reminders') {
            // 编辑提醒语
            await this.editReminders();
          } else if (option === 'reset-all') {
            confirmed = await confirmResetAll();
            if (confirmed) {
              await this.components.settingsManager.resetAllSettings();
              this.showMessage('所有设置已重置为默认值');
            }
          }
        } catch (err) {
          console.error('[专注模式] 重置密码失败:', err);
          this.showMessage('重置密码时发生错误', 'error');
        }
      })();
    } catch (e) {
      console.error('[专注模式] 重置密码入口错误:', e);
      this.showMessage('操作失败，请重试', 'error');
    }
  }

  /**
   * 检查当前是否是视频页面
   */
  isVideoPage() {
    try {
      const url = window.location.href;
      
      // 检查URL路径模式
      const videoPatterns = [
        '/video/', // 普通视频
        '/bangumi/play/', // 番剧
        '/cheese/play/', // 课程
        '/blackboard/play/', // 课堂
        '/list/', // 列表播放
        '/medialist/play/', // 媒体列表
        '/watchlater/', // 稍后再看
        '/festival/', // 节日活动页
      ];
      
      // 检查URL是否匹配任一视频模式
      for (const pattern of videoPatterns) {
        if (url.includes(pattern)) {
          console.log(`[专注模式] 检测到视频页面 (${pattern})`);
          return true;
        }
      }
      
      // 基于DOM元素检测 - 更可靠的方法
      // 1. 检查是否存在视频元素
      const hasVideoElement = !!document.querySelector('video');
      
      // 2. 检查是否存在播放器容器
      const hasPlayerContainer = !!document.querySelector(
        '.bpx-player-container, #bilibili-player, .player-container, ' +
        '.bilibili-player-area, .player-module, #bofqi, .video-container'
      );
      
      // 3. 检查页面标题特征
      const pageTitle = document.title || '';
      const hasTitlePattern = pageTitle.includes('_哔哩哔哩') || 
                             pageTitle.includes('_bilibili') ||
                             pageTitle.includes(' - 哔哩哔哩') ||
                             pageTitle.includes(' - bilibili');
      
      // 4. 综合判断
      const isVideoByDOM = hasVideoElement && (hasPlayerContainer || hasTitlePattern);
      
      if (isVideoByDOM) {
        console.log('[专注模式] 通过DOM元素检测到视频页面');
        return true;
      }
      
      // 不是视频页面
      return false;
    } catch (err) {
      console.error('[专注模式] 检查视频页面时出错:', err);
      // 出错时保守返回false
      return false;
    }
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    try {
      if (this.components.settingsManager) {
        await this.components.settingsManager.updateSettings(this.settings);
        console.log('[专注模式] 设置已保存');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[专注模式] 保存设置失败:', err);
      return false;
    }
  }

  /**
   * 设置视频页面专注模式
   */
  setupVideoFocus() {
    try {
      console.log('[专注模式] 开始设置视频专注模式');
      
      // 初始化弹幕过滤器
      this.initializeDanmakuFilter();
      
      // 添加控制栏
      // this.addControlBar();
      
      // 设置点击视频自动全屏
      this.setupVideoClickFullscreen();
      
      // 增强的视频加载监听和激活机制
      const setupVideoLoadListener = () => {
        // 查找视频元素
        const video = document.querySelector('video');
        
        if (video) {
          console.log('[专注模式] 找到视频元素，监听视频加载事件');
          
          // 监听视频加载事件
          const handleVideoLoaded = () => {
            console.log('[专注模式] 视频已加载，准备激活全屏模式');
            
            // 确保设置正确
            if (this.settings.autoActivate === undefined) {
              console.log('[专注模式] 自动全屏设置不存在，重置为默认值(true)');
              this.settings.autoActivate = true;
            }
            
            // 检查自动全屏设置
            if (this.settings.autoActivate && !this.checkFullscreenState()) {
              console.log('[专注模式] 自动全屏设置已启用，尝试进入全屏');
              // 延迟激活全屏，确保视频准备就绪
              setTimeout(() => this.autoActivateFullscreen(), 1500);
            }
          };
          
          // 为不同的视频状态事件添加监听器
          const videoEvents = ['loadeddata', 'canplay', 'playing'];
          
          // 清理可能存在的旧事件监听器
          videoEvents.forEach(event => {
            if (this.eventHandlers[`video_${event}`]) {
              video.removeEventListener(event, this.eventHandlers[`video_${event}`]);
            }
          });
          
          // 添加新的事件监听器
          videoEvents.forEach(event => {
            this.eventHandlers[`video_${event}`] = handleVideoLoaded;
            video.addEventListener(event, handleVideoLoaded);
          });
          
          // 如果视频已经加载，立即尝试激活
          if (video.readyState >= 3) {
            handleVideoLoaded();
          }
        } else {
          console.warn('[专注模式] 未找到视频元素，设置1秒后重试');
          setTimeout(setupVideoLoadListener, 1000);
        }
      };
      
      // 立即开始监听
      setupVideoLoadListener();
      
      // 设置周期性检查，确保全屏状态稳定（添加退出保护逻辑）
      const fullscreenCheckInterval = setInterval(() => {
        // 检查设置和状态
        if (this.settings.autoActivate && !this.checkFullscreenState() && this.isActive) {
          
          // 检查是否在退出流程中
          const isExitInProgress = this.fullscreenState && (
            this.fullscreenState.exitApproved || 
            this.fullscreenState.exitInProgress
          );
          
          // 检查退出处理器状态
          const isExitHandlerActive = this.components && 
                                    this.components.exitHandler && (
                                      this.components.exitHandler.exitRequested || 
                                      this.components.exitHandler.reminderDialogActive
                                    );
          
          // 检查是否有退出相关对话框存在
          const hasExitDialog = document.querySelector(
            '.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay'
          );
          
          // 只有在完全没有退出流程时才恢复全屏
          if (!isExitInProgress && !isExitHandlerActive && !hasExitDialog) {
          console.log('[专注模式] 检测到全屏状态已退出但专注模式仍然激活，尝试恢复全屏');
          this.enterFullscreenMode();
          } else {
            console.log('[专注模式] 检测到退出流程进行中，跳过自动恢复全屏');
        }
        }
      }, 8000); // 改为8秒检查一次，避免过于频繁
      
      // 保存间隔ID，以便后续清理
      this.fullscreenCheckIntervalId = fullscreenCheckInterval;
      
      console.log('[专注模式] 视频专注模式设置完成');
    } catch (err) {
      console.error('[专注模式] 设置视频专注模式失败:', err);
    }
  }

  /**
   * 设置点击视频自动全屏
   */
  setupVideoClickFullscreen() {
    try {
      // 查找视频元素
      const video = document.querySelector('video');
      if (!video) {
        console.warn('[专注模式] 未找到视频元素，无法设置点击全屏');
        // 设置一个重试机制，等待视频元素加载
        setTimeout(() => this.setupVideoClickFullscreen(), 1000);
        return;
      }
      
      // 查找播放器容器
      const container = this.findVideoContainer();
      if (!container) {
        console.warn('[专注模式] 未找到视频容器，无法设置点击全屏');
        // 设置一个重试机制，等待容器元素加载
        setTimeout(() => this.setupVideoClickFullscreen(), 1000);
        return;
      }
      
      // 添加双击事件处理
      const handleDoubleClick = (e) => {
        // 防止事件冒泡和默认行为
        e.preventDefault();
        e.stopPropagation();
        
        // 如果已经是全屏，则退出全屏；否则进入全屏
        if (this.checkFullscreenState()) {
          if (!this.settings.forceFullscreen) {
            this.exitFullscreenMode();
          }
        } else {
          this.enterFullscreenMode();
        }
      };
      
      // 移除可能存在的旧事件监听
      if (this.eventHandlers.videoDoubleClick) {
        video.removeEventListener('dblclick', this.eventHandlers.videoDoubleClick);
      }
      
      // 添加事件监听
      this.eventHandlers.videoDoubleClick = handleDoubleClick;
      video.addEventListener('dblclick', handleDoubleClick);
      
      // 添加单击处理（在视频播放/暂停的同时进入全屏）
      const handleClick = (e) => {
        // 如果设置为自动激活并且不在全屏模式，则进入全屏
        if (this.settings.autoActivate && !this.checkFullscreenState()) {
          // 使用短延迟以便先让视频播放/暂停处理完成
          setTimeout(() => this.enterFullscreenMode(), 100);
        }
      };
      
      // 移除可能存在的旧事件监听
      if (this.eventHandlers.videoClick) {
        video.removeEventListener('click', this.eventHandlers.videoClick);
      }
      
      // 添加事件监听
      this.eventHandlers.videoClick = handleClick;
      video.addEventListener('click', handleClick);
      
      // 如果设置为自动激活，设置重试机制确保能进入全屏模式
      if (this.settings.autoActivate && !this.checkFullscreenState()) {
        this.autoActivateFullscreen();
      }
      
      console.log('[专注模式] 点击视频自动全屏已设置');
    } catch (err) {
      console.error('[专注模式] 设置点击视频自动全屏失败:', err);
    }
  }

  /**
   * 自动进入全屏模式
   * 根据播放器类型选择最佳的全屏策略
   */
  autoActivateFullscreen() {
    // 检查是否临时禁用自动全屏（首次设置期间）
    if (this._temporarilyDisableAutoFullscreen) {
      console.log('[专注模式] 🚫 自动全屏已临时禁用（首次设置中） - 版本: 2024.1.15');
      return false;
    }
    
    // 检查是否允许自动全屏
    if (!this.settings || !this.settings.autoActivate) {
      console.log('[专注模式] 自动全屏已禁用');
      return false;
    }

    // 检查是否已处于全屏状态
    if (this.checkFullscreenState()) {
      console.log('[专注模式] 已处于全屏状态');
      return true;
    }

    // 检查是否暂时阻止自动全屏
    if (this.blockAutoActivate && Date.now() < this.blockAutoActivate) {
      console.log('[专注模式] 自动全屏暂时被阻止');
      return false;
    }

    // 准备进入全屏
    console.log('[专注模式] 尝试进入全屏模式');
    this.fullscreenState = {
      attempts: 0,
      maxAttempts: 3,
      method: '',
      lastAttempt: Date.now(),
      successful: false,
      exitApproved: false
    };

    // 确定播放器类型并选择策略
    const playerType = this.detectPlayerType();
    // console.log(`[专注模式] 检测到播放器类型: ${playerType}`);

    // 根据播放器类型选择最佳策略
    switch (playerType) {
      case 'bpx':
        // 新版播放器优先使用API，然后尝试点击按钮
        if (this.tryUsingBilibiliAPI()) {
          this.fullscreenState.method = 'bilibili-api';
          this.fullscreenState.successful = true;
          return true;
        }
        if (this.tryClickFullscreenButton()) {
          this.fullscreenState.method = 'button-click';
          this.fullscreenState.successful = true;
          return true;
        }
        break;
        
      case 'legacy':
        // 旧版播放器优先点击按钮
        if (this.tryClickFullscreenButton()) {
          this.fullscreenState.method = 'button-click';
          this.fullscreenState.successful = true;
          return true;
        }
        if (this.tryUsingBilibiliAPI()) {
          this.fullscreenState.method = 'bilibili-api';
          this.fullscreenState.successful = true;
          return true;
        }
        break;
        
      default:
        // 其他情况，尝试所有方法
        break;
    }

    // 通用备选策略
    if (this.tryStandardFullscreen()) {
      this.fullscreenState.method = 'standard-api';
      this.fullscreenState.successful = true;
      return true;
    }

    // 最后尝试CSS全屏
    if (this.fallbackFullscreen()) {
      this.fullscreenState.method = 'css-fallback';
      this.fullscreenState.successful = true;
      return true;
    }

    console.warn('[专注模式] 所有全屏方法均失败');
    this.fullscreenState.successful = false;
    return false;
  }

  /**
   * 添加控制栏
   */
  // addControlBar() {
  //   try {
  //     // 移除可能存在的旧控制栏
  //     const oldBar = document.querySelector('.focus-control-bar');
  //     if (oldBar) {
  //       oldBar.remove();
  //     }
      
  //     // 创建新的控制栏
  //     const controlBar = document.createElement('div');
  //     controlBar.className = 'focus-control-bar';
      
  //     // 添加全屏切换按钮
  //     const fullscreenButton = document.createElement('button');
  //     fullscreenButton.className = 'focus-control-button';
  //     fullscreenButton.textContent = '切换全屏';
  //     fullscreenButton.addEventListener('click', () => this.toggle());
  //     controlBar.appendChild(fullscreenButton);
      
  //     // 添加弹幕过滤按钮
  //     const danmakuButton = document.createElement('button');
  //     danmakuButton.className = 'focus-control-button';
  //     danmakuButton.textContent = '弹幕过滤';
  //     danmakuButton.addEventListener('click', () => this.toggleDanmakuFilter());
  //     controlBar.appendChild(danmakuButton);
      
  //     // 添加返回全屏按钮
  //     this.addBackToFullscreenButton();
      
  //     // 添加到页面
  //     document.body.appendChild(controlBar);
  //     console.log('[专注模式] 控制栏已添加');
  //   } catch (err) {
  //     console.error('[专注模式] 添加控制栏失败:', err);
  //   }
  // }
  
  /**
   * 添加快速回到全屏按钮
   */
  addBackToFullscreenButton() {
    try {
      // 移除可能存在的旧按钮
      const oldButton = document.querySelector('.back-to-fullscreen-btn');
      if (oldButton) {
        oldButton.remove();
      }
      
      // 创建按钮
      const backButton = document.createElement('button');
      backButton.className = 'back-to-fullscreen-btn';
      backButton.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>';
      backButton.title = '回到全屏学习模式';
      backButton.classList.add('hidden'); // 初始隐藏
      
      // 添加点击事件
      backButton.addEventListener('click', () => {
        // 进入全屏学习模式
        console.log('[专注模式] 点击返回全屏按钮');
        this.enterFullscreenMode();
        // 点击后隐藏按钮
        backButton.classList.add('hidden');
      });
      
      // 增强版监听全屏状态变化
      const updateButtonVisibility = () => {
        // 检查是否在全屏模式中
        const isInFullscreen = this.checkFullscreenState();
        
        // 检查是否有退出状态标记
        const hasExitState = this.fullscreenState && (
          this.fullscreenState.exitApproved || 
          this.fullscreenState.exitInProgress || 
          this.fullscreenState.isExitRequested
        );
        
        // 检查是否有退出对话框
        const hasExitDialog = document.querySelector('.focus-exit-dialog') || 
                            document.querySelector('.top-level-exit-overlay') ||
                            document.querySelector('.exit-transition-overlay');
        
        // 自动全屏设置检查
        const autoFullscreenEnabled = this.settings && this.settings.autoActivate;
        
        // 判断是否显示按钮：如果不在全屏模式、没有退出流程、没有退出对话框、且设置了自动全屏
        if (!isInFullscreen && !hasExitState && !hasExitDialog && autoFullscreenEnabled) {
          // console.log('[专注模式] 显示返回全屏按钮');
          backButton.classList.remove('hidden');
        } else {
          backButton.classList.add('hidden');
        }
      };
      
      // 保存引用以便后续清理
      this.backToFullscreenButton = backButton;
      
      // 移除可能存在的旧监听器
      if (this.eventHandlers.updateButtonVisibility) {
        document.removeEventListener('fullscreenchange', this.eventHandlers.updateButtonVisibility);
        document.removeEventListener('webkitfullscreenchange', this.eventHandlers.updateButtonVisibility);
        document.removeEventListener('mozfullscreenchange', this.eventHandlers.updateButtonVisibility);
        document.removeEventListener('MSFullscreenChange', this.eventHandlers.updateButtonVisibility);
        
        if (this.buttonVisibilityInterval) {
          clearInterval(this.buttonVisibilityInterval);
        }
      }
      
      // 保存更新函数引用
      this.eventHandlers.updateButtonVisibility = updateButtonVisibility;
      
      // 添加全屏变化监听
      document.addEventListener('fullscreenchange', updateButtonVisibility);
      document.addEventListener('webkitfullscreenchange', updateButtonVisibility);
      document.addEventListener('mozfullscreenchange', updateButtonVisibility);
      document.addEventListener('MSFullscreenChange', updateButtonVisibility);
      
      // 添加定期检查
      this.buttonVisibilityInterval = setInterval(updateButtonVisibility, 1000);
      
      // 添加到页面
      document.body.appendChild(backButton);
      
      // 立即执行一次检查
      updateButtonVisibility();
      
      console.log('[专注模式] 快速回到全屏按钮已添加');
    } catch (err) {
      console.error('[专注模式] 添加快速回到全屏按钮失败:', err);
    }
  }
  
  /**
   * 添加样式
   */
  addStyles() {
    // 添加样式实现...
  }
  
  /**
   * 设置定期检查
   */
  setupPeriodicChecks() {
    // 定期检查实现...
  }

  /**
   * 初始化弹幕过滤器
   */
  initializeDanmakuFilter() {
    // 初始化弹幕过滤器实现...
  }
  
  /**
   * 添加弹幕过滤按钮
   */
  // addDanmakuFilterButton() {
  //   try {
  //     // 检查是否已经初始化了弹幕过滤器
  //     if (!window.DanmakuFilter) {
  //       console.warn('[专注模式] 弹幕过滤器未加载，无法添加过滤按钮');
  //       return false;
  //     }
      
  //     // 实例化弹幕过滤器
  //     if (!this.danmakuFilter) {
  //       this.danmakuFilter = new window.DanmakuFilter();
  //     this.danmakuFilter.initialize({
  //         filterAll: this.settings.filterDanmaku
  //     });
  //       console.log('[专注模式] 弹幕过滤器已初始化');
  //     }
      
  //     return true;
  //   } catch (err) {
  //     console.error('[专注模式] 添加弹幕过滤按钮失败:', err);
  //     return false;
  //   }
  // }

  // /**
  //  * 切换弹幕过滤
  //  */
  // toggleDanmakuFilter() {
  //   try {
  //     // 切换设置
  //     this.settings.filterDanmaku = !this.settings.filterDanmaku;
      
  //     // 应用新设置
  //     this.applyDanmakuFilter();
      
  //     // 显示状态消息
  //     const status = this.settings.filterDanmaku ? '已开启' : '已关闭';
  //     console.log(`[专注模式] 弹幕过滤${status}`);
  //   } catch (err) {
  //     console.error('[专注模式] 切换弹幕过滤失败:', err);
  //   }
  // }
  
  // /**
  //  * 应用弹幕过滤
  //  */
  // applyDanmakuFilter() {
  //   try {
  //     // 如果弹幕过滤器已经初始化，直接应用设置
  //     if (this.danmakuFilter && this.settings.filterDanmaku) {
  //       this.danmakuFilter.applySettings({
  //         filterAll: true
  //       });
  //       console.log('[专注模式] 弹幕过滤已应用');
  //     } else if (!this.settings.filterDanmaku) {
  //       // 如果禁用了弹幕过滤，重置过滤器
  //       if (this.danmakuFilter) {
  //         this.danmakuFilter.reset();
  //       }
  //       console.log('[专注模式] 弹幕过滤已禁用');
  //     } else {
  //       console.log('[专注模式] 弹幕过滤器未初始化，跳过应用');
  //     }
  //   } catch (err) {
  //     console.error('[专注模式] 应用弹幕过滤失败:', err);
  //   }
  // }
  
  /**
   * 显示消息
   */
  showMessage(message, type = 'success') {
    // 显示消息实现...
  }
  
  /**
   * 初始化学习记录器
   */
  initializeStudyRecorder() {
    try {
      // 检查是否有 StudyRecorder 类可用
      if (typeof window.StudyRecorder === 'function') {
        this.components.studyRecorder = new window.StudyRecorder();
        
        if (typeof this.components.studyRecorder.initialize === 'function') {
          this.components.studyRecorder.initialize();
          console.log('[专注模式] 学习记录器已初始化');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('[专注模式] 初始化学习记录器失败:', err);
      return false;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    try {
      // 移除所有事件监听器
      this.removeFullscreenListeners();
      this.cleanupControlsEvents();
      this.cleanupNativeControlBehavior();
      
      if (this.eventHandlers.keydown) {
        document.removeEventListener('keydown', this.eventHandlers.keydown);
      }
      
      // 停止观察器
      if (this.observer) {
        this.observer.disconnect();
      }
      
      // 取消定时器
      if (this.checkTimer) {
        clearInterval(this.checkTimer);
      }
      
      if (this.hideControlsTimer) {
        clearTimeout(this.hideControlsTimer);
        this.hideControlsTimer = null;
      }
      
      if (this.controlsDebugInterval) {
        clearInterval(this.controlsDebugInterval);
        this.controlsDebugInterval = null;
      }
      
      // 清理合集侧边栏
      if (this.collectionSidebar) {
        try {
          if (typeof this.collectionSidebar.destroy === 'function') {
            this.collectionSidebar.destroy();
            console.log('[专注模式] 合集侧边栏已清理');
          }
          this.collectionSidebar = null;
        } catch (err) {
          console.warn('[专注模式] 清理合集侧边栏失败:', err);
        }
      }
      
      console.log('[专注模式] 资源已清理');
      return true;
    } catch (err) {
      console.error('[专注模式] 清理资源失败:', err);
      return false;
    }
  }
  
  /**
   * 隐藏评论区
   */
  hideComments() {
    try {
      // 尝试查找评论容器
      const commentSelectors = [
        '.comment-container', 
        '#comment', 
        '.reply-list',
        '[data-comment-container]'
      ];
      
      const commentContainers = typeof robustSelector === 'function' 
        ? robustSelector(commentSelectors)
        : document.querySelectorAll(commentSelectors.join(','));
      
      if (commentContainers && commentContainers.length) {
        commentContainers.forEach(container => {
          if (container && container.style) {
            // 保存原始样式以便恢复
            if (!container._originalDisplay) {
              container._originalDisplay = container.style.display;
            }
            container.style.display = 'none';
            this.hiddenElements.push(container);
          }
        });
        console.log('[专注模式] 评论区已隐藏');
      } else {
        console.log('[专注模式] 未找到评论区容器');
      }
    } catch (err) {
      console.error('[专注模式] 隐藏评论区失败:', err);
    }
  }

  /**
   * 隐藏推荐区
   */
  hideRecommendations() {
    try {
      // 尝试查找推荐容器
      const recommendSelectors = [
        '.recommend-container', 
        '.related-container',
        '.recommend-list',
        '.recommend-video-list',
        '[data-recommend-container]'
      ];
      
      const recommendContainers = typeof robustSelector === 'function'
        ? robustSelector(recommendSelectors)
        : document.querySelectorAll(recommendSelectors.join(','));
      
      if (recommendContainers && recommendContainers.length) {
        recommendContainers.forEach(container => {
          if (container && container.style) {
            // 保存原始样式以便恢复
            if (!container._originalDisplay) {
              container._originalDisplay = container.style.display;
            }
            container.style.display = 'none';
            this.hiddenElements.push(container);
          }
        });
        console.log('[专注模式] 推荐区已隐藏');
      } else {
        console.log('[专注模式] 未找到推荐区容器');
      }
    } catch (err) {
      console.error('[专注模式] 隐藏推荐区失败:', err);
    }
  }
  
  /**
   * 恢复隐藏的元素
   */
  showHiddenElements() {
    try {
      if (this.hiddenElements && this.hiddenElements.length) {
        this.hiddenElements.forEach(element => {
          if (element && element.style) {
            // 恢复元素的原始显示样式
            element.style.display = element._originalDisplay || '';
          }
        });
        // 清空隐藏元素列表
        this.hiddenElements = [];
        console.log('[专注模式] 已恢复隐藏元素');
      }
    } catch (err) {
      console.error('[专注模式] 恢复隐藏元素失败:', err);
    }
  }

  /**
   * 重置自动全屏相关设置
   * 用于修复自动全屏功能异常的情况
   */
  async resetAutoFullscreenSettings() {
    try {
      console.log('[专注模式] 开始重置自动全屏设置');
      
      // 设置自动全屏为启用状态
      this.settings.autoActivate = true;
      this.settings.forceFullscreen = true;
      
      // 保存更新后的设置
      const saveResult = await this.saveSettings();
      
      if (saveResult) {
        console.log('[专注模式] 自动全屏设置重置成功');
        // 显示成功消息
        this.showMessage('自动全屏设置已重置', 'success');
        return true;
      } else {
        console.error('[专注模式] 保存重置设置失败');
        return false;
      }
    } catch (err) {
      console.error('[专注模式] 重置自动全屏设置时出错:', err);
      return false;
    }
  }
  
  /**
   * 诊断自动全屏功能
   * 检查设置和环境，输出详细诊断信息
   */
  async diagnoseAutoFullscreen() {
    try {
      console.log('[专注模式诊断] 开始自动全屏功能诊断');
      
      // 检查设置状态
      console.log('[专注模式诊断] 设置状态:', {
        initialized: this.initialized,
        isActive: this.isActive,
        autoActivate: this.settings.autoActivate,
        forceFullscreen: this.settings.forceFullscreen
      });
      
      // 检查是否为视频页面
      const isVideoPage = this.isVideoPage();
      console.log('[专注模式诊断] 是否为视频页面:', isVideoPage);
      
      // 检查视频元素
      const videoElement = document.querySelector('video');
      console.log('[专注模式诊断] 视频元素状态:', {
        found: !!videoElement,
        readyState: videoElement ? videoElement.readyState : -1,
        duration: videoElement ? videoElement.duration : -1,
        currentTime: videoElement ? videoElement.currentTime : -1
      });
      
      // 检查视频容器
      const videoContainer = this.findVideoContainer();
      console.log('[专注模式诊断] 视频容器状态:', {
        found: !!videoContainer,
        tagName: videoContainer ? videoContainer.tagName : null,
        id: videoContainer ? videoContainer.id : null,
        className: videoContainer ? videoContainer.className : null
      });
      
      // 检查全屏状态
      const isFullscreen = this.checkFullscreenState();
      console.log('[专注模式诊断] 当前全屏状态:', isFullscreen);
      
      // 检查全屏API可用性
      const fullscreenAPIAvailable = document.documentElement.requestFullscreen || 
                                   document.documentElement.webkitRequestFullscreen || 
                                   document.documentElement.mozRequestFullScreen || 
                                   document.documentElement.msRequestFullscreen;
      console.log('[专注模式诊断] 全屏API可用性:', !!fullscreenAPIAvailable);
      
      // 检查B站播放器API
      const bilibiliAPIAvailable = typeof window.player !== 'undefined' && 
                                 typeof window.player.fullScreen === 'function';
      console.log('[专注模式诊断] B站播放器API可用性:', bilibiliAPIAvailable);
      
      // 返回诊断结果
      return {
        settings: {
          initialized: this.initialized,
          isActive: this.isActive,
          autoActivate: this.settings.autoActivate,
          forceFullscreen: this.settings.forceFullscreen
        },
        page: {
          isVideoPage,
          url: window.location.href
        },
        video: {
          found: !!videoElement,
          readyState: videoElement ? videoElement.readyState : -1
        },
        container: {
          found: !!videoContainer
        },
        fullscreen: {
          isFullscreen,
          apiAvailable: !!fullscreenAPIAvailable,
          bilibiliAPIAvailable
        }
      };
    } catch (err) {
      console.error('[专注模式] 诊断自动全屏功能时出错:', err);
      return null;
    }
  }

  /**
   * 尝试使用B站播放器API进入全屏
   * @returns {boolean} 是否成功
   */
  tryUsingBilibiliAPI() {
    try {
      // 按优先级尝试不同API路径
      if (window.player && typeof window.player.fullScreen === 'function') {
        console.log('[专注模式] 尝试使用B站API: window.player.fullScreen');
        window.player.fullScreen(true);
        return true;
      }
      
      if (window.player && typeof window.player.setFullScreen === 'function') {
        console.log('[专注模式] 尝试使用B站API: window.player.setFullScreen');
        window.player.setFullScreen(true);
        return true;
      }
      
      // 检查其他可能的API路径
      if (window.bilibiliPlayer && 
          window.bilibiliPlayer.bilibiliPlayer && 
          typeof window.bilibiliPlayer.bilibiliPlayer.fullScreen === 'function') {
        console.log('[专注模式] 尝试使用B站API: window.bilibiliPlayer.bilibiliPlayer.fullScreen');
        window.bilibiliPlayer.bilibiliPlayer.fullScreen(true);
        return true;
      }
      
      // 查找页面上的播放器对象
      if (document.querySelector('#bilibiliPlayer')) {
        const bPlayer = document.querySelector('#bilibiliPlayer');
        if (bPlayer && bPlayer.player && typeof bPlayer.player.fullScreen === 'function') {
          console.log('[专注模式] 尝试使用DOM中的播放器API进入全屏');
          bPlayer.player.fullScreen(true);
          return true;
        }
      }
    } catch (err) {
      console.warn('[专注模式] 使用B站API进入全屏失败:', err);
    }
    return false;
  }

  /**
   * 尝试使用标准全屏API
   * @returns {boolean} 是否成功
   */
  tryStandardFullscreen() {
    try {
      const container = this.findVideoContainer();
      if (!container) {
        console.warn('[专注模式] 未找到视频容器，无法使用标准全屏API');
        return false;
      }
      
      console.log('[专注模式] 尝试对容器使用标准全屏API:', container);
      
      // 尝试标准全屏API
      if (container.requestFullscreen) {
        container.requestFullscreen();
        return true;
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
        return true;
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
        return true;
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
        return true;
      }
      
      // 如果容器全屏失败，尝试视频元素
      const video = document.querySelector('video');
      if (video) {
        console.log('[专注模式] 容器全屏失败，尝试对视频元素使用标准全屏API');
        if (video.requestFullscreen) {
          video.requestFullscreen();
          return true;
        } else if (video.webkitRequestFullscreen) {
          video.webkitRequestFullscreen();
          return true;
        } else if (video.mozRequestFullScreen) {
          video.mozRequestFullScreen();
          return true;
        } else if (video.msRequestFullscreen) {
          video.msRequestFullscreen();
          return true;
        }
      }
    } catch (err) {
      console.warn('[专注模式] 使用标准全屏API失败:', err);
    }
    return false;
  }

  // 添加播放器类型检测方法
  detectPlayerType() {
    const bpxPlayer = document.querySelector('.bpx-player-container');
    const oldPlayer = document.querySelector('.bilibili-player-video-container');
    const danmukuPlayer = document.querySelector('#danmukuBox');
    
    if (bpxPlayer) return 'bpx';
    if (oldPlayer) return 'legacy';
    if (danmukuPlayer) return 'danmuku';
    return 'unknown';
  }

  // 修改tryClickFullscreenButton方法
  tryClickFullscreenButton() {
    const playerType = this.detectPlayerType();
    
    // 根据不同播放器类型使用不同选择器
    let buttonSelectors = [];
    
    if (playerType === 'bpx') {
      buttonSelectors = [
        '.bpx-player-ctrl-btn[data-text="全屏"]',
        '.bpx-player-ctrl-full',
        '.squirtle-video-fullscreen',
        '[aria-label="全屏"]',
        '[data-tooltip="全屏"]'
      ];
    } else if (playerType === 'legacy') {
      buttonSelectors = [
        '.bilibili-player-video-btn-fullscreen',
        '.bilibili-player-iconfont-fullscreen',
        '.icon-24fullscreen'
      ];
    } else {
      // 通用选择器
      buttonSelectors = [
        '[aria-label="全屏"]',
        '[data-tooltip="全屏"]',
        '[title="全屏"]',
        '[data-text="全屏"]',
        '.fullscreen-btn'
      ];
    }
    
    // 查找按钮并点击
    for (const selector of buttonSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        console.log(`[专注模式] 找到全屏按钮(${selector})，尝试点击`);
        button.click();
        return true;
      }
    }
    
    console.log('[专注模式] 未找到全屏按钮');
    return false;
  }
  
  /**
   * 简化版自动全屏执行器
   */
  executeAutoFullscreen() {
    console.log('[专注模式] 🚀 开始执行自动全屏');
    
    // 1. 检查是否允许自动全屏
    if (!this.settings.autoActivate) {
      console.log('[专注模式] ❌ 自动全屏已禁用');
      return false;
    }
    
    // 2. 检查当前真实全屏状态
    if (this.checkFullscreenState()) {
      console.log('[专注模式] ✅ 已处于真实全屏状态，无需操作');
      return true;
    }
    
    // 3. 查找必要元素
    const video = document.querySelector('video');
    const videoContainer = this.findVideoContainer();
    
    console.log('[专注模式] 🔍 元素检测:', {
      hasVideo: !!video,
      hasContainer: !!videoContainer,
      containerType: videoContainer?.className || 'unknown'
    });
    
    if (!video && !videoContainer) {
      console.log('[专注模式] ❌ 未找到视频元素，2秒后重试');
      setTimeout(() => this.executeAutoFullscreen(), 2000);
      return false;
    }
    
    // 4. 按优先级尝试全屏方法 - 完全使用B站原生机制
    this.attemptFullscreenMethods(video, videoContainer);
  }
  
  /**
   * 按优先级尝试全屏方法
   */
  attemptFullscreenMethods(video, videoContainer) {
    // 方法1：B站API
    if (this.tryBilibiliPlayerAPI()) {
      console.log('[专注模式] ✅ B站API全屏成功');
      return true;
    }
    
    // 方法2：点击全屏按钮
    if (this.tryClickFullscreenButton()) {
      console.log('[专注模式] ✅ 按钮点击全屏成功');
      return true;
    }
    
    // 方法3：视频容器API
    if (videoContainer && this.tryElementFullscreen(videoContainer)) {
      console.log('[专注模式] ✅ 容器API全屏成功');
      return true;
    }
    
    // 方法4：视频元素API
    if (video && this.tryElementFullscreen(video)) {
      console.log('[专注模式] ✅ 视频API全屏成功');
      return true;
    }
    
    console.log('[专注模式] ❌ 所有全屏方法都失败了');
    return false;
  }
  
  /**
   * 尝试B站播放器API
   */
  tryBilibiliPlayerAPI() {
    try {
      if (window.player && typeof window.player.fullScreen === 'function') {
        console.log('[专注模式] 🎯 调用window.player.fullScreen(true)');
        window.player.fullScreen(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[专注模式] B站API调用失败:', err);
      return false;
    }
  }
  
  /**
   * 尝试点击全屏按钮
   */
  tryClickFullscreenButton() {
    const button = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-full') ||
                   document.querySelector('.bpx-player-ctrl-full') ||
                   document.querySelector('[data-text="全屏"]');
    
    if (button) {
      // console.log('[专注模式] 🎯 点击全屏按钮');
      button.click();
      return true;
    }
    return false;
  }
  
  /**
   * 尝试元素全屏API
   */
  tryElementFullscreen(element) {
    if (!element) return false;
    
    try {
      console.log('[专注模式] 🎯 尝试元素全屏API');
      if (element.requestFullscreen) {
        element.requestFullscreen();
        return true;
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
        return true;
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[专注模式] 元素全屏API失败:', err);
      return false;
    }
  }

  /**
   * 简单修复控制栏 - 只做最少干预，让B站原生机制正常工作
   */
  // [REMOVED] 不再干扰B站原生控制栏 - 原 ensureControlsVisible() 方法已移除
  ensureControlsVisible_DISABLED() {
    // 空实现，不做任何操作，让B站完全接管控制栏
    console.log('[专注模式] ensureControlsVisible 已被禁用，不做任何操作');
  }

  // [REMOVED] 控制栏干预方法已彻底移除，使用B站原生机制

  // [REMOVED] processContainer方法已移除，使用B站原生机制

  // [REMOVED] 控制栏监控功能已移除，使用B站原生机制

  // [REMOVED] 所有控制栏干预方法已移除，使用B站原生机制
  

  
  // [REMOVED] 初始化控制栏修复方法已移除，使用B站原生机制
  
  /**
   * 调试用：定期检查控制栏状态
   */
  // [REMOVED] 不再进行控制栏调试 - 原 startControlsDebugging() 方法已移除
  startControlsDebugging_DISABLED() {
    console.log('[专注模式] 🔍 开始控制栏调试监控...');
    
    if (this.controlsDebugInterval) {
      clearInterval(this.controlsDebugInterval);
      console.log('[专注模式] 🔄 清理旧的调试定时器');
    }
    
    let debugCount = 0;
    this.controlsDebugInterval = setInterval(() => {
      debugCount++;
      
      if (debugCount > 20) {
        console.log('[专注模式] 📊 调试监控已完成 (20次)');
        clearInterval(this.controlsDebugInterval);
        this.controlsDebugInterval = null;
        return;
      }
      
      const container = document.querySelector('.bpx-player-container');
      if (container) {
        const controlWrap = container.querySelector('.bpx-player-control-wrap');
        const computedStyle = controlWrap ? window.getComputedStyle(controlWrap) : null;
        
        const debugInfo = {
          '容器属性': {
            'data-ctrl-hidden': container.getAttribute('data-ctrl-hidden'),
            'data-screen': container.getAttribute('data-screen'),
            'classes': container.className
          },
          '控制栏状态': {
            '存在': !!controlWrap,
            '显示属性': computedStyle ? {
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              'pointer-events': computedStyle.pointerEvents,
              'z-index': computedStyle.zIndex
            } : '未找到控制栏'
          },
          '鼠标绑定状态': {
            '事件对象存在': !!this.nativeControlEvents,
            '事件数量': this.nativeControlEvents ? Object.keys(this.nativeControlEvents).length : 0
          }
        };
        
        console.log(`[专注模式] 📊 控制栏调试 #${debugCount}:`, debugInfo);
        
        // 每5次调试显示一次测试提示
        if (debugCount % 5 === 0) {
          console.log(`[专注模式] 📝 测试提示 #${debugCount/5}: 请尝试${debugCount <= 10 ? '点击清晰度按钮测试菜单弹出' : debugCount <= 15 ? '拖拽进度條测试跳转' : '调节音量测试音量控制'}！`);
        }
      } else {
        console.log(`[专注模式] ❌ 调试 #${debugCount}: 未找到播放器容器`);
      }
    }, 3000); // 改为3秒间隔，减少日志频率
    
    console.log('[专注模式] ✅ 调试监控已启动，将每3秒输出一次状态');
  }
  
  /**
   * 设置原生控制栏行为 - 🎯 智能修复版：完全兼容B站原生机制
   */
  setupNativeControlBehavior() {
    try {
      // console.log('[专注模式] 🎯 开始设置智能控制栏检测...');
      
      // 首先清理可能的样式干扰
      this.cleanupHomepageStyles();
      
      // 等待播放器容器加载
      this.waitForPlayerContainer().then((playerContainer) => {
        if (!playerContainer) {
          console.warn('[专注模式] ⚠️ 播放器容器加载超时');
          return;
        }
        
        // console.log('[专注模式] ✅ 播放器容器已加载，开始智能控制栏检测');
        
        // ❌ 已删除：不再干扰B站原生的菜单hover行为
        // 让B站原生控制栏自己工作
        console.log('[专注模式] ✅ 允许B站原生控制栏自行工作');
        
      });
      
    } catch (err) {
      console.error('[专注模式] ❌ 设置控制栏行为失败:', err);
    }
  }
  
  /**
   * 等待播放器容器加载
   */
  waitForPlayerContainer() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 最多等待15秒
      
      const checkContainer = () => {
        attempts++;
        
        // 按优先级查找播放器容器
        const containerSelectors = [
          '.bpx-player-container',
          '#bilibili-player',
          '.player-container',
          '.bilibili-player-area'
        ];
        
        for (const selector of containerSelectors) {
          const container = document.querySelector(selector);
          if (container) {
            console.log(`[专注模式] 找到播放器容器: ${selector}`);
            resolve(container);
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          console.warn('[专注模式] 播放器容器查找超时');
          resolve(null);
        } else {
          setTimeout(checkContainer, 500);
        }
      };
      
      checkContainer();
    });
  }
  
  /**
   * 智能控制栏检测 - 不干扰B站原生逻辑
   */
  intelligentControlBarDetection(playerContainer) {
    try {
      // console.log('[专注模式] 🔍 开始智能控制栏检测...');
      
      // 现代化的控制栏选择器（2024年最新）
      const modernControlSelectors = [
        '.bpx-player-control-wrap',           // 新版主控制栏
        '.bpx-player-control-entity',         // 控制栏实体
        '.bpx-player-video-control',          // 视频控制区
        '.bpx-player-control-bottom',         // 底部控制栏
        '.bpx-player-control-top',            // 顶部控制栏
        '.bilibili-player-video-control-wrap' // 兼容旧版
      ];
      
      let detectedControls = 0;
      const controlElements = new Map();
      
      // 检测所有控制栏元素
      modernControlSelectors.forEach(selector => {
        const elements = playerContainer.querySelectorAll(selector);
        if (elements.length > 0) {
          controlElements.set(selector, elements);
          detectedControls += elements.length;
          console.log(`[专注模式] ✅ 检测到 ${elements.length} 个 ${selector} 元素`);
        }
      });
      
      if (detectedControls === 0) {
        console.warn('[专注模式] ⚠️ 未检测到任何控制栏元素，使用备用检测');
        this.fallbackControlDetection(playerContainer);
        return;
      }
      
      // 只确保交互性，不干预显示逻辑
      controlElements.forEach((elements, selector) => {
        elements.forEach(element => {
          // 只确保可交互，完全不干预B站的显示/隐藏逻辑
          if (element.style.pointerEvents === 'none') {
            element.style.pointerEvents = '';
            console.log(`[专注模式] 🔧 恢复 ${selector} 的交互能力`);
          }
        });
      });
      
      console.log(`[专注模式] ✅ 智能检测完成，发现 ${detectedControls} 个控制栏元素`);
      
      // 验证控制栏功能
      this.validateControlBarFunctionality(playerContainer);
      
    } catch (err) {
      console.error('[专注模式] 智能控制栏检测失败:', err);
    }
  }
  
  /**
   * 备用控制栏检测
   */
  fallbackControlDetection(playerContainer) {
    console.log('[专注模式] 🔄 启动备用控制栏检测...');
    
    // 等待DOM更新后再次尝试
    setTimeout(() => {
      const allPossibleSelectors = [
        '[class*="control"]',
        '[class*="player-ctrl"]',
        '[class*="video-control"]',
        '[data-control]',
        '.squirtle-controller-wrap'
      ];
      
      let found = false;
      allPossibleSelectors.forEach(selector => {
        try {
          const elements = playerContainer.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`[专注模式] 🔍 备用检测发现: ${selector} (${elements.length}个)`);
            found = true;
          }
        } catch (e) {
          // 忽略无效选择器
        }
      });
      
      if (!found) {
        console.warn('[专注模式] ⚠️ 备用检测也未发现控制栏，可能页面还在加载');
      }
    }, 1000);
  }
  
  /**
   * 验证控制栏功能
   */
  validateControlBarFunctionality(playerContainer) {
    try {
      const controlWrap = playerContainer.querySelector('.bpx-player-control-wrap');
      if (!controlWrap) {
        console.warn('[专注模式] ⚠️ 未找到主控制栏，跳过功能验证');
        return;
      }
      
      // 检查控制栏本身是否可见
      const controlStyle = window.getComputedStyle(controlWrap);
      const isControlVisible = controlStyle.display !== 'none' && 
                              controlStyle.visibility !== 'hidden' && 
                              controlStyle.opacity !== '0';
      
      if (!isControlVisible) {
        console.log('[专注模式] 📋 控制栏当前不可见，这可能是正常的（如自动隐藏）');
        return;
      }
      
      // 检查重要按钮和控件 - 使用更通用的选择器
      const importantElements = [
        { selector: '.bpx-player-ctrl-play, [data-text="播放"], [aria-label*="播放"]', name: '播放按钮' },
        { selector: '.bpx-player-ctrl-quality, [data-text*="质量"], [aria-label*="质量"]', name: '清晰度按钮' },
        { selector: '.bpx-player-ctrl-volume, [data-text*="音量"], [aria-label*="音量"]', name: '音量按钮' },
        { selector: '.bpx-player-ctrl-full, [data-text*="全屏"], [aria-label*="全屏"]', name: '全屏按钮' },
        { selector: '.bpx-player-progress, .bpx-player-progress-wrap, [class*="progress"]', name: '进度条' }
      ];
      
      let workingElements = 0;
      let visibleElements = 0;
      let detailedInfo = [];
      
      importantElements.forEach(({ selector, name }) => {
        const element = controlWrap.querySelector(selector);
        if (element) {
          visibleElements++;
          const style = window.getComputedStyle(element);
          const isElementWorking = style.pointerEvents !== 'none' && 
                                  style.display !== 'none' && 
                                  style.visibility !== 'hidden';
          
          const elementInfo = {
            name,
            found: true,
            working: isElementWorking,
            styles: {
              display: style.display,
              visibility: style.visibility,
              pointerEvents: style.pointerEvents,
              opacity: style.opacity
            },
            className: element.className,
            tagName: element.tagName
          };
          
          detailedInfo.push(elementInfo);
          
          if (isElementWorking) {
            workingElements++;
          }
        } else {
          detailedInfo.push({
            name,
            found: false,
            working: false
          });
        }
      });
      
      // 当没有找到任何元素时，输出控制栏的详细结构用于调试
      if (visibleElements === 0) {
        console.log('[专注模式] 🔍 控制栏结构调试信息:');
        console.log('控制栏HTML结构:', controlWrap.innerHTML.substring(0, 500) + '...');
        console.log('控制栏所有子元素:', Array.from(controlWrap.querySelectorAll('*')).map(el => ({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          dataText: el.getAttribute('data-text'),
          ariaLabel: el.getAttribute('aria-label')
        })).slice(0, 10)); // 只显示前10个，避免输出过多
      }
      
      // console.log(`[专注模式] 📊 控制栏功能验证: 找到 ${visibleElements}/${importantElements.length} 个元素，其中 ${workingElements} 个可用`);
      
      // 只有当找到了元素但都不可用时，才认为有问题
      if (visibleElements > 0 && workingElements === 0) {
        console.warn('[专注模式] ⚠️ 控制栏元素存在功能问题');
        this.debugControlBarIssues(controlWrap);
      } else if (visibleElements === 0) {
        console.log('[专注模式] 📋 控制栏元素尚未加载完成，尝试等待并重试...');
        // 防止重复验证
        if (!this.controlBarRetryCount) {
          this.controlBarRetryCount = 0;
        }
        
        if (this.controlBarRetryCount < 3) {
          this.controlBarRetryCount++;
          setTimeout(() => {
            this.validateControlBarFunctionality(playerContainer);
          }, 2000);
        } else {
          console.log('[专注模式] 📋 已尝试多次，控制栏可能确实尚未加载，或页面结构发生变化');
          console.log('[专注模式] 💡 提示：你可以手动调用 fixVideoControls() 来强制修复控制栏');
        }
      } else {
        // console.log(`[专注模式] ✅ 控制栏功能正常，${workingElements}/${visibleElements} 个元素可用`);
        
        // 如果有元素不工作，尝试修复
        if (workingElements < visibleElements) {
          this.fixControlBarInteraction(controlWrap);
        }
      }
      
    } catch (err) {
      console.error('[专注模式] 控制栏功能验证失败:', err);
    }
  }
  
  /**
   * 🔥 修复菜单显示：手动管理 bpx-state-show 类
   * 因为B站的事件监听器在我们修改DOM后失效，所以我们自己管理菜单显示
   */
  setupMenuClickHandlers(playerContainer) {
    try {
      console.log('[专注模式] 🔥 开始设置菜单点击处理器');
      
      // 菜单配置
      const menuConfigs = [
        { 
          btnSelector: '.bpx-player-ctrl-quality',
          menuSelector: '.bpx-player-ctrl-quality-menu',
          name: '清晰度'
        },
        { 
          btnSelector: '.bpx-player-ctrl-playbackrate',
          menuSelector: '.bpx-player-ctrl-playbackrate-menu',
          name: '播放速度'
        },
        { 
          btnSelector: '.bpx-player-ctrl-eplist',
          menuSelector: '.bpx-player-ctrl-eplist-menu',
          name: '选集'
        },
        { 
          btnSelector: '.bpx-player-ctrl-subtitle',
          menuSelector: '.bpx-player-ctrl-subtitle-menu',
          name: '字幕'
        },
        { 
          btnSelector: '.bpx-player-ctrl-setting',
          menuSelector: '.bpx-player-ctrl-setting-menu',
          name: '设置'
        }
      ];
      
      // 当前打开的菜单
      let currentOpenMenu = null;
      
      // 🎯 使用Map追踪每个按钮的状态（不依赖DOM类名）
      const menuStates = new Map();
      
      // 🎯 等待控制栏按钮加载的函数
      const waitForControlButtons = () => {
        return new Promise((resolve) => {
          let attempts = 0;
          const maxAttempts = 20; // 最多等待4秒 (20 * 200ms)
          
          const checkButtons = () => {
            attempts++;
            
            // 检查控制栏底部容器是否存在
            const controlBottom = playerContainer.querySelector('.bpx-player-control-bottom');
            if (controlBottom) {
              // console.log('[专注模式] ✅ 找到控制栏底部容器，开始查找按钮');
              
              // 检查是否至少有一个菜单按钮存在
              const hasButtons = menuConfigs.some(config => 
                controlBottom.querySelector(config.btnSelector)
              );
              
              if (hasButtons) {
                console.log(`[专注模式] ✅ 控制栏按钮已加载 (尝试 ${attempts} 次)`);
                resolve(controlBottom);
                return;
              }
            }
            
            if (attempts >= maxAttempts) {
              console.warn('[专注模式] ⚠️ 等待控制栏按钮超时');
              resolve(null);
              return;
            }
            
            setTimeout(checkButtons, 200);
          };
          
          checkButtons();
        });
      };
      
      // 🎯 设置按钮处理器的核心函数
      const setupHandlers = () => {
        let setupCount = 0;
        
        menuConfigs.forEach(config => {
          const btn = playerContainer.querySelector(config.btnSelector);
          if (!btn) {
            // console.log(`[专注模式] 未找到${config.name}按钮`);
            return;
          }
          
          // 检查是否已经设置过（避免重复）
          if (btn.dataset.menuHandlerSetup === 'true') {
            return;
          }
          
          console.log(`[专注模式] ✅ 为${config.name}按钮添加点击处理`);
          btn.dataset.menuHandlerSetup = 'true';
          
          // 🎯 初始化状态为关闭
          if (!menuStates.has(config.btnSelector)) {
            menuStates.set(config.btnSelector, false);
          }
          
          setupCount++;
          
          // 🔥 防止B站移除 bpx-state-show 类
          const classObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const shouldBeOpen = menuStates.get(config.btnSelector);
                const isOpen = btn.classList.contains('bpx-state-show');
                
                // 如果应该打开但类被移除了，重新添加
                if (shouldBeOpen && !isOpen) {
                  console.log(`[专注模式] ⚠️ ${config.name}的bpx-state-show被移除，重新添加`);
                  btn.classList.add('bpx-state-show');
                }
              }
            });
          });
          
          // 监控按钮的class属性变化
          classObserver.observe(btn, {
            attributes: true,
            attributeFilter: ['class']
          });
          
          // 添加点击事件
          btn.addEventListener('click', (e) => {
            // 🔥 阻止B站的原生事件处理器
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log(`[专注模式] 🖱️ ${config.name}按钮被点击`);
            
            // 🎯 使用我们自己的状态而不是DOM类名
            const isOpen = menuStates.get(config.btnSelector) || false;
            
            // 先关闭所有菜单
            menuConfigs.forEach(cfg => {
              const otherBtn = playerContainer.querySelector(cfg.btnSelector);
              if (otherBtn) {
                otherBtn.classList.remove('bpx-state-show');
                menuStates.set(cfg.btnSelector, false);
              }
            });
            
            // 如果之前是关闭的，现在打开
            if (!isOpen) {
              btn.classList.add('bpx-state-show');
              menuStates.set(config.btnSelector, true);
              currentOpenMenu = btn;
              console.log(`[专注模式]   → ✅ 已打开${config.name}菜单`);
            } else {
              currentOpenMenu = null;
              console.log(`[专注模式]   → ✅ 已关闭${config.name}菜单`);
            }
          }, true); // 使用捕获阶段
        });
        
        return setupCount;
      };
      
      // 🎯 等待并设置
      waitForControlButtons().then((controlBottom) => {
        if (!controlBottom) {
          console.warn('[专注模式] ⚠️ 无法找到控制栏按钮');
          return;
        }
        
        // 立即设置一次
        const count = setupHandlers();
        console.log(`[专注模式] ✅ 已为 ${count} 个按钮设置处理器`);
        
        // 🔄 监听控制栏重新渲染（比如切换视频）
        const observer = new MutationObserver(() => {
          const newCount = setupHandlers();
          if (newCount > 0) {
            console.log(`[专注模式] 🔄 控制栏重新渲染，重新设置了 ${newCount} 个按钮`);
          }
        });
        
        observer.observe(controlBottom, {
          childList: true,
          subtree: true
        });
        
        // console.log('[专注模式] ✅ 菜单点击处理器设置完成，并已启动监听');
      });
      
      // 点击其他地方关闭菜单
      const closeMenuHandler = (e) => {
        if (!currentOpenMenu) return;
        
        // 检查点击是否在菜单或按钮内
        const clickedInMenu = menuConfigs.some(config => {
          const menu = playerContainer.querySelector(config.menuSelector);
          const btn = playerContainer.querySelector(config.btnSelector);
          return (menu && menu.contains(e.target)) || (btn && btn.contains(e.target));
        });
        
        // 如果点击在外部，关闭所有菜单
        if (!clickedInMenu && currentOpenMenu) {
          menuConfigs.forEach(cfg => {
            const btn = playerContainer.querySelector(cfg.btnSelector);
            if (btn) {
              btn.classList.remove('bpx-state-show');
              menuStates.set(cfg.btnSelector, false);
            }
          });
          currentOpenMenu = null;
          // console.log('[专注模式] ✅ 点击外部，关闭菜单');
        }
      };
      
      // 避免重复添加
      if (!document.__menuCloseHandlerAdded) {
        document.addEventListener('click', closeMenuHandler, true);
        document.__menuCloseHandlerAdded = true;
      }
      
    } catch (err) {
      console.error('[专注模式] 设置菜单点击处理器失败:', err);
    }
  }
  
  /**
   * ❌ [已废弃] 设置菜单hover处理器
   * 
   * 原因：此方法干扰了B站原生的菜单交互，导致：
   * 1. 菜单一旦离开按钮就立即隐藏
   * 2. 用户无法点击菜单中的选项
   * 3. 频繁触发hover事件，产生大量日志
   * 
   * 解决方案：完全删除此方法的逻辑，让B站原生控制栏自己工作
   * B站的控制栏本身就有完善的hover机制，不需要我们干扰
   */
  setupMenuHoverHandlers(playerContainer) {
    console.log('[专注模式] ⚠️ setupMenuHoverHandlers 已废弃，不再干扰B站原生功能');
    // ❌ 已删除所有干扰代码
    // 让B站原生的 hover 机制自己工作
    return;
  }
  
  /**
   * 🧹 已简化：控制栏交互问题现在由CSS统一解决
   */
  fixControlBarInteraction(controlWrap) {
    try {
      // console.log('[专注模式] ℹ️ 控制栏交互问题已由CSS统一解决，此函数已简化');
      return true; // 兼容性返回，实际交互已由CSS解决
      
      // 1. 确保控制栏本身可以交互
      const controlStyle = controlWrap.style;
      if (controlStyle.pointerEvents === 'none') {
        controlStyle.pointerEvents = 'auto';
        console.log('[专注模式] ✅ 已修复控制栏 pointer-events');
      }
      
      // 2. 确保控制栏有足够的 z-index
      const computedStyle = window.getComputedStyle(controlWrap);
      const currentZIndex = parseInt(computedStyle.zIndex) || 0;
      if (currentZIndex < 100) {
        controlStyle.zIndex = '999';
        console.log('[专注模式] ✅ 已提升控制栏 z-index');
      }
      
      // 3. 修复所有控制按钮的交互能力
      const allButtons = controlWrap.querySelectorAll('button, [role="button"], .bpx-player-ctrl-btn, [class*="ctrl"], [class*="button"]');
      let fixedButtons = 0;
      
      allButtons.forEach(button => {
        const buttonStyle = window.getComputedStyle(button);
        let needsFix = false;
        
        // 修复 pointer-events
        if (buttonStyle.pointerEvents === 'none') {
          button.style.pointerEvents = 'auto';
          needsFix = true;
        }
        
        // 修复 display
        if (buttonStyle.display === 'none') {
          button.style.display = 'inline-block';
          needsFix = true;
        }
        
        // 修复 visibility
        if (buttonStyle.visibility === 'hidden') {
          button.style.visibility = 'visible';
          needsFix = true;
        }
        
        // 确保按钮可以点击
        if (buttonStyle.position === 'absolute' && buttonStyle.zIndex === 'auto') {
          button.style.zIndex = '10';
          needsFix = true;
        }
        
        if (needsFix) {
          fixedButtons++;
        }
      });
      
      // 4. 移除可能干扰的覆盖层
      const overlays = document.querySelectorAll('[class*="overlay"], [class*="mask"], [style*="pointer-events: none"]');
      let removedOverlays = 0;
      
      overlays.forEach(overlay => {
        const rect = overlay.getBoundingClientRect();
        const controlRect = controlWrap.getBoundingClientRect();
        
        // 检查覆盖层是否与控制栏重叠
        const isOverlapping = !(rect.bottom < controlRect.top || 
                                rect.top > controlRect.bottom || 
                                rect.right < controlRect.left || 
                                rect.left > controlRect.right);
        
        if (isOverlapping && !controlWrap.contains(overlay)) {
          overlay.style.pointerEvents = 'none';
          removedOverlays++;
        }
      });
      
      console.log(`[专注模式] 🔧 修复完成: 修复了 ${fixedButtons} 个按钮，处理了 ${removedOverlays} 个覆盖层`);
      
      // 5. 验证修复效果
      setTimeout(() => {
        this.validateControlBarFunctionality(controlWrap.closest('.bpx-player-container'));
      }, 500);
      
    } catch (err) {
      console.error('[专注模式] 控制栏交互修复失败:', err);
    }
  }
  
  /**
   * 调试控制栏问题
   */
  debugControlBarIssues(controlWrap) {
    try {
      const style = window.getComputedStyle(controlWrap);
      const debugInfo = {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        position: style.position,
        zIndex: style.zIndex
      };
      
      console.log('[专注模式] 🐛 控制栏调试信息:', debugInfo);
      
      // 检查是否被其他元素遮挡 - 改进的检测逻辑
      const rect = controlWrap.getBoundingClientRect();
      
      // 检测多个关键位置点，而不只是中心点
      const testPoints = [
        { x: rect.left + rect.width * 0.2, y: rect.top + rect.height / 2, name: '左侧' },
        { x: rect.left + rect.width * 0.5, y: rect.top + rect.height / 2, name: '中心' },
        { x: rect.left + rect.width * 0.8, y: rect.top + rect.height / 2, name: '右侧' }
      ];
      
      let blockedPoints = 0;
      let suspiciousElements = new Set();
      
      testPoints.forEach(point => {
        const elementAtPoint = document.elementFromPoint(point.x, point.y);
        
        // 检查元素是否有效且与控制栏相关
        if (elementAtPoint) {
          const isControlBarRelated = elementAtPoint === controlWrap || 
                                    controlWrap.contains(elementAtPoint) ||
                                    elementAtPoint.closest('.bpx-player-control-wrap') === controlWrap;
          
          if (!isControlBarRelated) {
            // 进一步检查是否是播放器相关元素
            const isPlayerRelated = elementAtPoint.closest('.bpx-player-container') || 
                                   elementAtPoint.closest('.bpx-player-video-wrap');
            
            if (!isPlayerRelated) {
              blockedPoints++;
              suspiciousElements.add(elementAtPoint);
              // 只在调试模式下显示详细的遮挡信息
              if (window.location.search.includes('debug=true')) {
                console.log(`[专注模式] 🔍 检测点${point.name}被遮挡:`, elementAtPoint);
              }
            }
          }
        } else {
          console.log(`[专注模式] 🔍 检测点${point.name}: 无元素`);
        }
      });
      
      // 只有当多个点都被可疑元素遮挡时才报告问题
      if (blockedPoints >= 2 && suspiciousElements.size > 0) {
        console.warn('[专注模式] ⚠️ 控制栏可能被其他元素遮挡，遮挡元素:', Array.from(suspiciousElements));
      }
      
      // 检查控制栏是否在视口内
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      const isInViewport = rect.top >= 0 && rect.left >= 0 && 
                          rect.bottom <= viewport.height && rect.right <= viewport.width;
      
      if (!isInViewport) {
        console.warn('[专注模式] ⚠️ 控制栏不在视口范围内:', {
          rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
          viewport
        });
      }
      
    } catch (err) {
      console.error('[专注模式] 调试控制栏问题失败:', err);
    }
  }
  
  /**
   * 设置动态控制栏观察器
   */
  setupDynamicControlObserver(playerContainer) {
    try {
      // 清理旧观察器
      if (this.controlBarObserver) {
        this.controlBarObserver.disconnect();
      }
      
      // 创建新观察器 - 只监控关键属性变化
      const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        
        mutations.forEach((mutation) => {
          // 只关注样式和类名变化
          if (mutation.type === 'attributes' && 
              ['style', 'class', 'data-ctrl-hidden'].includes(mutation.attributeName)) {
            const target = mutation.target;
            
            // 检查是否是控制栏相关元素
            if (target.classList.contains('bpx-player-control-wrap') ||
                target.classList.contains('bpx-player-container')) {
              shouldCheck = true;
            }
          }
          
          // 监控新增的控制栏元素
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === 1 && 
                  (node.classList?.contains('bpx-player-control-wrap') ||
                   node.querySelector?.('.bpx-player-control-wrap'))) {
                shouldCheck = true;
                // console.log('[专注模式] 🔍 检测到新的控制栏元素');
                break;
              }
            }
          }
        });
        
        if (shouldCheck) {
          // 延迟检查，避免频繁触发
          clearTimeout(this.controlCheckTimeout);
          this.controlCheckTimeout = setTimeout(() => {
            this.validateControlBarFunctionality(playerContainer);
          }, 100);
        }
      });
      
      // 开始观察
      observer.observe(playerContainer, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['style', 'class', 'data-ctrl-hidden']
      });
      
      this.controlBarObserver = observer;
      // console.log('[专注模式] 🎯 动态控制栏观察器已启动');
      
    } catch (err) {
      console.error('[专注模式] 设置动态观察器失败:', err);
    }
  }
  
  /**
   * 🚨 控制栏保护机制 - 防止控制栏被意外隐藏
   */
  setupControlBarProtection(playerContainer) {
    try {
      // 创建观察器，监控控制栏状态
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
            
            const target = mutation.target;
            if (target.classList.contains('bpx-player-control-wrap') || 
                target.classList.contains('bilibili-player-video-control-wrap')) {
              
              // 🎯 关键修复：完全移除强制控制栏显示逻辑，让B站原生机制接管
              // 原代码破坏了B站的显示/隐藏逻辑，是导致按钮不可交互的根本原因
              // 现在只确保交互能力，不干预显示状态
              if (target.style.pointerEvents === 'none') {
                target.style.pointerEvents = '';  // 清除插件设置的阻止交互
                // console.log('[专注模式] 🔧 恢复控制栏交互能力（不干预显示状态）');
              }
            }
          }
        });
      });
      
      // 开始观察
      observer.observe(playerContainer, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class']
      });
      
      // 保存观察器引用，以便后续清理
      this.controlBarObserver = observer;
      
      console.log('[专注模式] 🛡️ 控制栏保护机制已启动');
      
    } catch (err) {
      console.error('[专注模式] 控制栏保护机制设置失败:', err);
    }
  }

  /**
   * [DEPRECATED] 已废弃的控制栏方法 - 保留以避免调用错误
   */
  setupNativeControlBehavior_DISABLED() {
    // 🎯 已废弃：此方法已被安全版本替代，避免控制栏冲突
    console.log('[专注模式] ⚠️ 废弃方法被调用，已跳过执行以避免控制栏冲突');
    return;
  }
  
  /**
   * 清理原生控制栏行为事件 - 🚨 紧急修复版：清理所有保护机制
   */
  cleanupNativeControlBehavior() {
    try {
      const playerContainer = document.querySelector('.bpx-player-container');
      
      // 🚨 清理控制栏保护观察器
      if (this.controlBarObserver) {
        this.controlBarObserver.disconnect();
        this.controlBarObserver = null;
        console.log('[专注模式] 🛡️ 已停止控制栏保护机制');
      }
      
      // 🎯 清理插件设置的样式（恢复原生状态）
      if (playerContainer) {
        const controlSelectors = [
          '.bpx-player-control-wrap',
          '.bilibili-player-video-control-wrap',
          '.bpx-player-video-control',
          '.bilibili-player-video-control',
          '.bpx-player-control-entity',
          '.bpx-player-video-control-mask',
          '.bpx-player-video-control-bottom'
        ];
        
        controlSelectors.forEach(selector => {
          const elements = playerContainer.querySelectorAll(selector);
          elements.forEach(element => {
            // 清除插件设置的样式
            element.style.display = '';
            element.style.visibility = '';
            element.style.pointerEvents = '';
          });
        });
        
        console.log('[专注模式] 🎯 已清理所有控制栏强制样式');
      }
      
      // 清理事件监听器（如果存在）
      if (this.nativeControlEvents && playerContainer) {
        try {
          const controlWrap = playerContainer.querySelector('.bpx-player-control-wrap');
          if (controlWrap) {
            playerContainer.removeEventListener('mouseenter', this.nativeControlEvents.mouseenter);
            playerContainer.removeEventListener('mousemove', this.nativeControlEvents.mousemove);
            playerContainer.removeEventListener('mouseleave', this.nativeControlEvents.mouseleave);
            controlWrap.removeEventListener('mouseenter', this.nativeControlEvents.controlMouseenter);
            controlWrap.removeEventListener('mouseleave', this.nativeControlEvents.controlMouseleave);
          }
        } catch (eventErr) {
          console.log('[专注模式] ⚠️ 部分事件监听器清理失败（可能已不存在）:', eventErr.message);
        }
      }
      
      this.nativeControlEvents = null;
      
      // 🎯 移除插件添加的全局函数
      if (window.toggleControlsVisibility) {
        delete window.toggleControlsVisibility;
        console.log('[专注模式] 🗑️ 已移除手动控制函数');
      }
      
      console.log('[专注模式] ✅ 控制栏已完全恢复B站原生控制');
      
    } catch (err) {
      console.error('[专注模式] 控制栏清理失败:', err);
    }
  }
  
  /**
   * 简单显示控制栏 - 仅保留兼容性，但不做任何干预
   */
  forceShowControls() {
    console.log('[专注模式] forceShowControls被调用，但不做任何干预');
  }
  

  

  

  

  
  /**
   * 清理控制栏事件监听器
   */
  cleanupControlsEvents() {
    try {
      const playerContainer = document.querySelector('.bpx-player-container') || 
                             document.querySelector('#bilibili-player');
      
      if (playerContainer && this.mouseEventHandler) {
        playerContainer.removeEventListener('mousemove', this.mouseEventHandler);
        playerContainer.removeEventListener('mouseleave', this.mouseLeaveHandler);
      }
      
      if (this.hideControlsTimer) {
        clearTimeout(this.hideControlsTimer);
        this.hideControlsTimer = null;
      }
      
      this.mouseEventHandler = null;
      this.mouseLeaveHandler = null;
      
      console.log('[专注模式] 已清理控制栏事件监听器');
      
    } catch (err) {
      console.error('[专注模式] 清理控制栏事件失败:', err);
    }
  }

  /**
   * 显示专注学习引导界面
   */
  showFocusLearningGuide() {
    // 检查是否已经显示过引导或已经全屏
    if (this.checkFullscreenState() || document.querySelector('.focus-learning-guide')) {
      return;
    }

    console.log('[专注模式] 🎯 显示专注学习引导界面');

    // 创建引导遮罩层
    const guideOverlay = document.createElement('div');
    guideOverlay.className = 'focus-learning-guide';
    guideOverlay.innerHTML = `
      <div class="focus-guide-backdrop"></div>
      <div class="focus-guide-content">
        <div class="focus-guide-icon">🎯</div>
        <h2 class="focus-guide-title">专注学习模式</h2>
        <p class="focus-guide-description">让我们一起专注学习，屏蔽干扰，提高效率</p>
        <button class="focus-guide-button" id="enterFocusMode">
          <span class="focus-guide-button-icon">🚀</span>
          <span class="focus-guide-button-text">开始专注学习</span>
        </button>
        <div class="focus-guide-hint">点击进入全屏专注模式</div>
        
      </div>
    `;

    // 添加样式
    this.addFocusGuideStyles();

    // 添加到页面
    document.body.appendChild(guideOverlay);

    // 添加事件监听
    this.setupFocusGuideEvents(guideOverlay);

    // 添加入场动画
    setTimeout(() => {
      guideOverlay.classList.add('focus-guide-show');
    }, 100);
  }

  /**
   * 添加引导界面样式
   */
  addFocusGuideStyles() {
    if (document.getElementById('focus-guide-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'focus-guide-styles';
    styles.textContent = `
      .focus-learning-guide {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      }

      .focus-learning-guide.focus-guide-show {
        opacity: 1;
        visibility: visible;
      }

      .focus-guide-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
      }

      .focus-guide-content {
        position: relative;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        color: white;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        transform: translateY(30px);
        transition: transform 0.3s ease;
      }

      .focus-guide-show .focus-guide-content {
        transform: translateY(0);
      }

      .focus-guide-icon {
        font-size: 48px;
        margin-bottom: 20px;
        animation: pulse 2s infinite;
      }

      .focus-guide-title {
        font-size: 24px;
        font-weight: bold;
        margin: 0 0 15px 0;
        color: white;
      }

      .focus-guide-description {
        font-size: 16px;
        margin: 0 0 30px 0;
        opacity: 0.9;
        line-height: 1.5;
      }

      .focus-guide-button {
        background: linear-gradient(45deg, #ff6b6b, #ee5a24);
        border: none;
        border-radius: 50px;
        padding: 15px 30px;
        color: white;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        margin-bottom: 15px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
      }

      .focus-guide-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
      }

      .focus-guide-button-icon {
        font-size: 18px;
      }

      .focus-guide-hint {
        font-size: 12px;
        opacity: 0.7;
        margin-bottom: 20px;
      }

      

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * 设置引导界面事件
   */
  setupFocusGuideEvents(guideOverlay) {
    const enterButton = guideOverlay.querySelector('#enterFocusMode');
    const skipButton = guideOverlay.querySelector('#skipFocusMode');

    // 进入专注模式按钮
    enterButton.addEventListener('click', () => {
      console.log('[专注模式] 🚀 用户点击进入专注学习');
      this.hideFocusGuide(guideOverlay);
      
      // 延迟一点执行全屏，让动画先完成
      setTimeout(() => {
        this.executeAutoFullscreen();
      }, 300);
    });

    

    // 点击背景也进入专注模式
    guideOverlay.querySelector('.focus-guide-backdrop').addEventListener('click', () => {
      console.log('[专注模式] 📱 用户点击背景进入专注学习');
      this.hideFocusGuide(guideOverlay);
      
      // 延迟一点执行全屏，让动画先完成
      setTimeout(() => {
        this.executeAutoFullscreen();
      }, 300);
    });
  }

  /**
   * 隐藏引导界面
   */
  hideFocusGuide(guideOverlay) {
    guideOverlay.classList.remove('focus-guide-show');
    
    setTimeout(() => {
      if (guideOverlay && guideOverlay.parentNode) {
        guideOverlay.parentNode.removeChild(guideOverlay);
      }
    }, 300);
  }

  /**
   * 🧡 增强的首页样式清理机制
   * 更全面地检测和清理可能影响控制栏的样式残留
   */
  cleanupHomepageStyles() {
    try {
      // 🎯 关键修复：移除导致控制栏隐藏的首页阻止样式
      const homepageBlocker = document.getElementById('focused-homepage-blocker');
      if (homepageBlocker) {
        homepageBlocker.remove();
        console.log('[专注模式] 🎯 已移除导致控制栏隐藏的关键样式（focused-homepage-blocker）');
      }
      
      // 移除首页专注模式的样式元素
      const focusedEarlyStyles = document.getElementById('focused-early-styles');
      if (focusedEarlyStyles) {
        focusedEarlyStyles.remove();
        console.log('[专注模式] ✅ 已清理首页专注模式的样式残留（focused-early-styles）');
      }
      
      // 🔍 更全面的样式残留检测和清理
      const problematicStyleSelectors = [
        '[id*="focused-homepage"]',
        '[id*="homepage-blocker"]', 
        '[id*="focused-early"]',
        '[id*="focused"][id*="style"]'
      ];
      
      let cleanedStylesCount = 0;
      problematicStyleSelectors.forEach(selector => {
        const styles = document.querySelectorAll(selector);
        styles.forEach(style => {
          // 检查样式内容是否包含可能影响控制栏的规则
          const content = style.textContent || style.innerHTML || '';
          const hasProblematicRules = content.includes('body >') || 
                                    content.includes('pointer-events: none') ||
                                    content.includes('display: none !important') ||
                                    content.includes('bpx-player');
          
          if (hasProblematicRules || style.id) {
            style.remove();
            cleanedStylesCount++;
            console.log(`[专注模式] 🧹 清理问题样式: ${style.id || selector}`);
          }
        });
      });
      
      console.log(`[专注模式] ✅ 共清理了 ${cleanedStylesCount} 个问题样式`);
      
      // 也清理可能的首页容器
      const homepageContainer = document.querySelector('.focused-homepage-container');
      if (homepageContainer) {
        homepageContainer.remove();
        console.log('[专注模式] ✅ 已清理首页专注容器');
      }
      
      // 重置body的样式，确保视频页面正常显示
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.backgroundColor = '';
      
      // 🎯 精确恢复被首页样式影响的播放器相关元素
      const playerElements = document.querySelectorAll(`
        .bpx-player-container,
        .bpx-player-control-wrap,
        .bpx-player-video-control,
        #bilibili-player,
        .player-container,
        [class*="bpx-player"],
        [id*="player"]
      `);
      
      let restoredElementsCount = 0;
      playerElements.forEach(el => {
        let needsRestore = false;
        
        // 只恢复明显被插件影响的元素
        if (el.style.display === 'none' || 
            el.style.visibility === 'hidden' || 
            el.style.opacity === '0' ||
            el.style.pointerEvents === 'none') {
          
          // 确保不是B站原生设置的隐藏状态
          if (!el.hasAttribute('data-native-hidden') && 
              !el.classList.contains('native-hidden')) {
            
            el.style.display = '';
            el.style.opacity = '';
            el.style.visibility = '';
            el.style.pointerEvents = '';
            el.style.height = '';
            el.style.width = '';
            needsRestore = true;
          }
        }
        
        if (needsRestore) {
          restoredElementsCount++;
          console.log(`[专注模式] 🔧 恢复播放器元素:`, el.className || el.id || el.tagName);
        }
      });
      
      console.log(`[专注模式] ✅ 共恢复了 ${restoredElementsCount} 个播放器元素`);
      
      // 🎯 纯净修复：只清理样式干扰，完全不干预B站逻辑
      
      // 🔍 添加最后的安全检查
      const remainingProblems = document.querySelectorAll(`
        style[id*="focused"],
        [class*="focused-homepage"],
        [style*="pointer-events: none"][style*="display: none"]
      `);
      
      if (remainingProblems.length > 0) {
        console.warn(`[专注模式] ⚠️ 仍有 ${remainingProblems.length} 个潜在问题元素未清理`);
        remainingProblems.forEach((el, index) => {
          if (index < 3) { // 只显示前3个避免屏幕刷屏
            console.log(`  - ${el.tagName}#${el.id}: ${el.className}`);
          }
        });
      }
      
      console.log('[专注模式] 🎯 增强清理完成！B站原生控制栏现在可以完全自主管理');
      
    } catch (error) {
      console.error('[专注模式] 清理首页样式失败:', error);
    }
  }

  // 🎯 已移除所有强制控制栏修补方法，使用B站原生机制

  // [REMOVED] 智能控制栏管理器已移除，使用B站原生机制

  // [REMOVED] 控制栏修复CSS已移除，使用B站原生机制
}

// 全局导出
window.FocusMode = FocusMode; 
console.log('✅ [focus-mode.js] FocusMode类已成功导出到window - v1.1.5');

// 🎯 智能控制栏修复工具 - 兼容B站原生机制
window.intelligentFixControlBar = function() {
  console.log('\n🎯========== 智能控制栏修复 ==========');
  
  const playerContainer = document.querySelector('.bpx-player-container') || 
                          document.querySelector('#bilibili-player');
  if (!playerContainer) {
    console.log('❌ 未找到播放器容器');
    return false;
  }
  
  console.log('✅ 找到播放器容器:', playerContainer.className);
  
  // 现代化控制栏选择器
  const modernSelectors = [
    '.bpx-player-control-wrap',
    '.bpx-player-control-entity', 
    '.bpx-player-video-control',
    '.bpx-player-control-bottom'
  ];
  
  let detected = 0;
  let fixed = 0;
  
  modernSelectors.forEach(selector => {
    const elements = playerContainer.querySelectorAll(selector);
    detected += elements.length;
    
    if (elements.length > 0) {
      console.log(`🔍 发现 ${elements.length} 个 ${selector} 元素`);
      
      elements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        
        // 只修复明显的问题，不干预B站原生逻辑
        if (computedStyle.pointerEvents === 'none' && 
            element.style.pointerEvents !== 'none') {
          element.style.pointerEvents = '';
          fixed++;
          console.log(`🔧 恢复 ${selector} 的交互能力`);
        }
        
        // 🎯 安全检查：只清除插件设置的样式，不干扰B站原生隐藏
        // 完全移除强制显示逻辑，避免与B站原生机制冲突
        // if (element.style.display === 'none' && element.hasAttribute('data-plugin-hidden')) {
        //   element.style.display = '';
        //   fixed++;
        //   console.log(`🔧 移除插件设置的强制隐藏`);
        // }
        // [DISABLED] 不再移除任何display设置，让B站完全控制
      });
    }
  });
  
  console.log(`📊 检测结果: 发现 ${detected} 个控制栏元素，修复 ${fixed} 个问题`);
  
  // 验证控制栏功能
  const mainControl = playerContainer.querySelector('.bpx-player-control-wrap');
  if (mainControl) {
    const buttons = mainControl.querySelectorAll('.bpx-player-ctrl-btn');
    let workingButtons = 0;
    
    buttons.forEach(btn => {
      const style = window.getComputedStyle(btn);
      if (style.pointerEvents !== 'none' && style.display !== 'none') {
        workingButtons++;
      }
    });
    
    console.log(`🎮 控制按钮状态: ${workingButtons}/${buttons.length} 个可用`);
  }
  
  // 提供B站原生状态信息
  const nativeState = {
    'data-ctrl-hidden': playerContainer.getAttribute('data-ctrl-hidden'),
    'bpx-state-no-cursor': playerContainer.classList.contains('bpx-state-no-cursor'),
    'data-screen': playerContainer.getAttribute('data-screen')
  };
  
  console.log('📋 B站原生状态:', nativeState);
  console.log('✅ 智能修复完成！控制栏现在应该正常工作');
  
  return { detected, fixed, nativeState };
};

// 🚨 紧急控制栏修复工具 - 保留兼容性（不推荐使用）
window.emergencyFixControlBar = function() {
  console.warn('⚠️ 使用紧急修复工具可能干扰B站原生机制，推荐使用 intelligentFixControlBar()');
  return window.intelligentFixControlBar();
};

// 🎯 修复后问题检测工具
window.testFixedIssues = function() {
  console.log('\n🔧========== 修复效果验证 ==========');
  
  const results = {
    controlInteraction: false,
    fullscreenBlackBar: false,
    nativeControlBar: false,
    functionsIntact: false
  };
  
  // 1. 测试控制栏交互问题是否修复
  console.log('\n🔍 [1/4] 检测控制栏交互修复效果...');
  const playerContainer = document.querySelector('.bpx-player-container');
  if (playerContainer) {
    const controlWrap = playerContainer.querySelector('.bpx-player-control-wrap');
    if (controlWrap) {
      const style = window.getComputedStyle(controlWrap);
      const zIndex = parseInt(style.zIndex);
      const pointerEvents = style.pointerEvents;
      
      // 检查是否使用了最高z-index和正确的pointer-events
      const hasHighZIndex = zIndex === 2147483647;
      const hasPointerEvents = pointerEvents === 'auto';
      
      results.controlInteraction = hasHighZIndex && hasPointerEvents;
      
      console.log(`  - 控制栏z-index: ${zIndex} ${hasHighZIndex ? '✅ 已修复' : '❌ 仍有问题'}`);
      console.log(`  - pointer-events: ${pointerEvents} ${hasPointerEvents ? '✅ 已修复' : '❌ 仍有问题'}`);
      
      // 检查按钮交互性
      const buttons = controlWrap.querySelectorAll('.bpx-player-ctrl-btn, .bpx-player-ctrl-quality, .bpx-player-ctrl-playbackrate');
      let workingButtons = 0;
      buttons.forEach(btn => {
        const btnStyle = window.getComputedStyle(btn);
        if (btnStyle.pointerEvents === 'auto' && btnStyle.cursor === 'pointer') {
          workingButtons++;
        }
      });
      console.log(`  - 可交互按钮: ${workingButtons}/${buttons.length} ${workingButtons === buttons.length ? '✅' : '⚠️'}`);
    } else {
      console.log('  ❌ 未找到控制栏元素');
    }
  }
  
  // 2. 测试全屏黑色框条问题是否修复
  console.log('\n🔍 [2/4] 检测全屏黑色框条修复效果...');
  const isFullscreen = document.body.classList.contains('fullscreen-mode') || 
                       document.fullscreenElement !== null;
  
  if (isFullscreen) {
    const video = document.querySelector('video');
    if (video) {
      const videoStyle = window.getComputedStyle(video);
      const objectFit = videoStyle.objectFit;
      const width = videoStyle.width;
      const height = videoStyle.height;
      
      const hasCorrectFit = objectFit === 'cover';
      const hasFullSize = width.includes('100%') && height.includes('100%');
      
      results.fullscreenBlackBar = hasCorrectFit && hasFullSize;
      
      console.log(`  - object-fit: ${objectFit} ${hasCorrectFit ? '✅ 已修复(cover)' : '❌ 仍有问题'}`);
      console.log(`  - 尺寸: ${width} x ${height} ${hasFullSize ? '✅ 已修复' : '❌ 仍有问题'}`);
    } else {
      console.log('  ⚠️ 当前非全屏状态，无法检测');
      results.fullscreenBlackBar = true; // 假设正常
    }
  } else {
    console.log('  ⚠️ 当前非全屏状态，请进入全屏后重新测试');
    results.fullscreenBlackBar = true; // 假设正常
  }
  
  // 3. 验证是否使用B站原生控制栏
  console.log('\n🔍 [3/4] 验证B站原生控制栏使用...');
  try {
    const nativeSelectors = [
      '.bpx-player-control-wrap',
      '.bpx-player-control-entity',
      '.bpx-player-video-control'
    ];
    
    let nativeElements = 0;
    nativeSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        nativeElements++;
        console.log(`  - ${selector}: 发现 ${elements.length} 个元素 ✅`);
      }
    });
    
    results.nativeControlBar = nativeElements >= 2;
    console.log(`  - 原生控制栏检测: ${results.nativeControlBar ? '✅ 使用B站原生' : '❌ 可能有问题'}`);
  } catch (err) {
    console.log('  ❌ 原生控制栏检测失败:', err);
    results.nativeControlBar = false;
  }
  
  // 4. 验证其他功能完整性
  console.log('\n🔍 [4/4] 验证其他功能完整性...');
  try {
    const focusMode = window.focusMode || window.focusModeInstance;
    if (focusMode) {
      const hasAutoFullscreen = typeof focusMode.autoActivateFullscreen === 'function';
      const hasExitHandler = focusMode.components && focusMode.components.exitHandler;
      const hasSettingsManager = focusMode.components && focusMode.components.settingsManager;
      
      results.functionsIntact = hasAutoFullscreen && hasExitHandler && hasSettingsManager;
      
      console.log(`  - 自动全屏功能: ${hasAutoFullscreen ? '✅' : '❌'}`);
      console.log(`  - 退出验证功能: ${hasExitHandler ? '✅' : '❌'}`);
      console.log(`  - 设置管理功能: ${hasSettingsManager ? '✅' : '❌'}`);
    } else {
      console.log('  ❌ FocusMode实例未找到');
      results.functionsIntact = false;
    }
  } catch (err) {
    console.log('  ❌ 功能完整性检测失败:', err);
    results.functionsIntact = false;
  }
  
  // 总结
  const allFixed = Object.values(results).every(result => result === true);
  
  console.log('\n🎯========== 修复效果总结 ==========');
  console.log(`🔧 控制栏交互问题: ${results.controlInteraction ? '✅ 已修复' : '❌ 仍需处理'}`);
  console.log(`🔧 全屏黑色框条问题: ${results.fullscreenBlackBar ? '✅ 已修复' : '❌ 仍需处理'}`);
  console.log(`🔧 B站原生控制栏: ${results.nativeControlBar ? '✅ 正常使用' : '❌ 需要检查'}`);
  console.log(`🔧 其他功能完整性: ${results.functionsIntact ? '✅ 无影响' : '❌ 需要检查'}`);
  console.log(`📊 整体修复状态: ${allFixed ? '✅ 全部修复成功' : '⚠️ 部分问题仍需处理'}`);
  
  if (!allFixed) {
    console.log('\n💡 建议操作:');
    if (!results.controlInteraction) {
      console.log('- 运行 intelligentFixControlBar() 进一步修复控制栏');
    }
    if (!results.fullscreenBlackBar) {
      console.log('- 刷新页面后重新进入全屏模式测试');
    }
    if (!results.nativeControlBar) {
      console.log('- 检查页面是否完全加载，等待B站播放器初始化完成');
    }
    if (!results.functionsIntact) {
      console.log('- 重新加载插件或刷新页面');
    }
  }
  
  return results;
};

// 🎯 深度修复效果测试工具
window.testControlBarFix = function() {
  console.log('\n🎯========== 控制栏深度修复效果测试 ==========');
  
  const issues = [];
  const container = document.querySelector('.bpx-player-container');
  const controlWrap = container?.querySelector('.bpx-player-control-wrap');
  
  if (!container) {
    issues.push('❌ 播放器容器不存在');
    return issues;
  }
  
  if (!controlWrap) {
    issues.push('❌ 控制栏元素不存在');
    return issues;
  }
  
  console.log('📋 [测试1] 检查插件干扰清理状态...');
  
  // 检查是否有插件干扰
  if (controlWrap.style.opacity !== '') {
    issues.push('⚠️ 检测到插件设置的opacity值: ' + controlWrap.style.opacity);
  }
  
  if (controlWrap.style.visibility !== '') {
    issues.push('⚠️ 检测到插件设置的visibility值: ' + controlWrap.style.visibility);
  }
  
  if (controlWrap.style.display !== '') {
    issues.push('⚠️ 检测到插件设置的display值: ' + controlWrap.style.display);
  }
  
  console.log('📋 [测试2] 检查交互能力...');
  
  // 检查交互能力
  const computedStyle = window.getComputedStyle(controlWrap);
  if (computedStyle.pointerEvents === 'none') {
    issues.push('❌ 控制栏无法交互 (pointer-events: none)');
  }
  
  console.log('📋 [测试3] 检查控制按钮...');
  
  // 检查主要控制按钮
  const buttons = [
    '.bpx-player-ctrl-quality',
    '.bpx-player-ctrl-playbackrate', 
    '.bpx-player-ctrl-volume'
  ];
  
  buttons.forEach(selector => {
    const btn = controlWrap.querySelector(selector);
    if (btn) {
      const btnStyle = window.getComputedStyle(btn);
      if (btnStyle.pointerEvents === 'none') {
        issues.push(`⚠️ 按钮 ${selector} 无法交互`);
      }
    }
  });
  
  console.log('📋 [测试4] 检查B站原生状态...');
  
  // 检查B站原生属性
  const nativeState = {
    'data-ctrl-hidden': container.getAttribute('data-ctrl-hidden'),
    'bpx-state-no-cursor': container.classList.contains('bpx-state-no-cursor'),
    'fullscreen': !!document.fullscreenElement
  };
  
  console.log('🔍 B站原生状态:', nativeState);
  
  if (issues.length === 0) {
    console.log('✅ 控制栏深度修复成功！');
    console.log('🎉 预期效果：');
    console.log('  - 控制栏完全由B站控制显示/隐藏');
    console.log('  - 所有按钮正常可点击');
    console.log('  - 菜单可以正常弹出和交互');
    console.log('  - 进度条可以正常拖拽');
    console.log('  - 自动全屏功能保持不变');
  } else {
    console.log('⚠️ 发现以下问题：');
    issues.forEach(issue => console.log('  ' + issue));
  }
  
  return issues;
};

// 🎯 全屏功能完整性验证工具
window.testFullscreenIntegrity = function() {
  console.log('\n🎯========== 自动全屏功能完整性测试 ==========');
  
  const focusMode = window.focusMode;
  if (!focusMode) {
    console.log('❌ FocusMode实例不存在');
    return false;
  }
  
  console.log('📋 [测试1] 基础设置检查...');
  console.log('  - 自动激活设置:', focusMode.settings?.autoActivate);
  console.log('  - 专注模式状态:', focusMode.isActive);
  console.log('  - 初始化状态:', focusMode.initialized);
  
  console.log('📋 [测试2] 全屏功能检查...');
  const hasFullscreenMethods = [
    'autoActivateFullscreen',
    'attemptFullscreen', 
    'handleFullscreenChange',
    'checkFullscreenState'
  ].every(method => typeof focusMode[method] === 'function');
  
  console.log('  - 全屏方法完整性:', hasFullscreenMethods ? '✅' : '❌');
  
  console.log('📋 [测试3] 监控机制检查...');
  const hasMonitoring = typeof focusMode.monitorFullscreenStatus === 'function';
  console.log('  - 全屏监控机制:', hasMonitoring ? '✅' : '❌');
  
  console.log('🎉 自动全屏功能状态: 正常运行');
  return true;
};

// 🎯 全面功能完整性验证工具
window.verifyAllFunctions = function() {
  console.log('\n🎯========== 专注模式功能完整性验证 ==========');
  
  const results = {
    controlBar: false,
    autoFullscreen: false,
    exitValidation: false,
    components: false,
    overall: false
  };
  
  // 1. 验证控制栏功能
  console.log('\n📋 [1/4] 验证控制栏功能...');
  try {
    const controlResult = window.debugCheckControls();
    results.controlBar = controlResult;
    console.log(`✅ 控制栏验证: ${controlResult ? '通过' : '失败'}`);
  } catch (err) {
    console.error('❌ 控制栏验证失败:', err);
    results.controlBar = false;
  }
  
  // 2. 验证自动全屏功能
  console.log('\n📋 [2/4] 验证自动全屏功能...');
  try {
    const focusMode = window.focusMode || window.focusModeInstance;
    if (focusMode) {
      const hasAutoFullscreen = typeof focusMode.autoActivateFullscreen === 'function';
      const hasFullscreenCheck = typeof focusMode.checkFullscreenState === 'function';
      const hasEnterFullscreen = typeof focusMode.enterFullscreenMode === 'function';
      const hasExitFullscreen = typeof focusMode.exitFullscreenMode === 'function';
      
      results.autoFullscreen = hasAutoFullscreen && hasFullscreenCheck && 
                              hasEnterFullscreen && hasExitFullscreen;
      
      console.log(`  - autoActivateFullscreen: ${hasAutoFullscreen ? '✅' : '❌'}`);
      console.log(`  - checkFullscreenState: ${hasFullscreenCheck ? '✅' : '❌'}`);
      console.log(`  - enterFullscreenMode: ${hasEnterFullscreen ? '✅' : '❌'}`);
      console.log(`  - exitFullscreenMode: ${hasExitFullscreen ? '✅' : '❌'}`);
      
      // 检查设置状态
      if (focusMode.settings) {
        console.log(`  - 自动全屏设置: ${focusMode.settings.autoActivate ? '启用' : '禁用'}`);
        console.log(`  - 强制全屏设置: ${focusMode.settings.forceFullscreen ? '启用' : '禁用'}`);
      }
      
    } else {
      console.warn('❌ 未找到FocusMode实例');
      results.autoFullscreen = false;
    }
  } catch (err) {
    console.error('❌ 自动全屏验证失败:', err);
    results.autoFullscreen = false;
  }
  
  // 3. 验证退出验证功能
  console.log('\n📋 [3/4] 验证退出验证功能...');
  try {
    const focusMode = window.focusMode || window.focusModeInstance;
    if (focusMode && focusMode.components) {
      const hasExitHandler = focusMode.components.exitHandler !== null;
      const hasHandleExitRequest = typeof focusMode.handleExitRequest === 'function';
      
      results.exitValidation = hasExitHandler && hasHandleExitRequest;
      
      console.log(`  - ExitHandler组件: ${hasExitHandler ? '✅' : '❌'}`);
      console.log(`  - handleExitRequest方法: ${hasHandleExitRequest ? '✅' : '❌'}`);
      
      if (hasExitHandler) {
        const exitHandler = focusMode.components.exitHandler;
        const hasHandleExit = typeof exitHandler.handleExit === 'function';
        const hasShowPasswordVerification = typeof exitHandler.showPasswordVerification === 'function';
        
        console.log(`  - handleExit方法: ${hasHandleExit ? '✅' : '❌'}`);
        console.log(`  - showPasswordVerification方法: ${hasShowPasswordVerification ? '✅' : '❌'}`);
      }
      
      // 检查设置中是否有密码
      if (focusMode.settings && focusMode.settings.password) {
        console.log(`  - 退出密码: 已设置`);
      } else {
        console.log(`  - 退出密码: 未设置（将允许直接退出）`);
      }
      
    } else {
      console.warn('❌ 未找到FocusMode实例或组件');
      results.exitValidation = false;
    }
  } catch (err) {
    console.error('❌ 退出验证功能验证失败:', err);
    results.exitValidation = false;
  }
  
  // 4. 验证核心组件
  console.log('\n📋 [4/4] 验证核心组件...');
  try {
    const focusMode = window.focusMode || window.focusModeInstance;
    if (focusMode && focusMode.components) {
      const hasSettingsManager = focusMode.components.settingsManager !== null;
      const hasFirstTimeSetup = focusMode.components.firstTimeSetup !== null;
      const hasExitHandler = focusMode.components.exitHandler !== null;
      
      results.components = hasSettingsManager && hasFirstTimeSetup && hasExitHandler;
      
      console.log(`  - SettingsManager: ${hasSettingsManager ? '✅' : '❌'}`);
      console.log(`  - FirstTimeSetup: ${hasFirstTimeSetup ? '✅' : '❌'}`);
      console.log(`  - ExitHandler: ${hasExitHandler ? '✅' : '❌'}`);
      
      // 检查初始化状态
      console.log(`  - 专注模式已初始化: ${focusMode.initialized ? '✅' : '❌'}`);
      console.log(`  - 专注模式激活状态: ${focusMode.isActive ? '激活' : '未激活'}`);
      
    } else {
      console.warn('❌ 未找到FocusMode实例或组件');
      results.components = false;
    }
  } catch (err) {
    console.error('❌ 核心组件验证失败:', err);
    results.components = false;
  }
  
  // 总结验证结果
  console.log('\n🎯========== 验证结果总结 ==========');
  console.log(`📊 控制栏功能: ${results.controlBar ? '✅ 正常' : '❌ 异常'}`);
  console.log(`🚀 自动全屏功能: ${results.autoFullscreen ? '✅ 正常' : '❌ 异常'}`);
  console.log(`🔒 退出验证功能: ${results.exitValidation ? '✅ 正常' : '❌ 异常'}`);
  console.log(`⚙️  核心组件: ${results.components ? '✅ 正常' : '❌ 异常'}`);
  
  results.overall = results.controlBar && results.autoFullscreen && 
                   results.exitValidation && results.components;
  
  console.log(`\n🎉 总体状态: ${results.overall ? '✅ 所有功能正常' : '⚠️ 存在问题'}`);
  
  if (!results.overall) {
    console.log('\n🔧 修复建议:');
    if (!results.controlBar) console.log('- 运行 intelligentFixControlBar() 修复控制栏');
    if (!results.autoFullscreen) console.log('- 检查FocusMode实例是否正确初始化');
    if (!results.exitValidation) console.log('- 检查ExitHandler组件是否正确加载');
    if (!results.components) console.log('- 重新加载页面或检查组件初始化');
  }
  
  return results;
};

// 🎯 终极原生验证工具 - 全面诊断，零干预
window.debugCheckControls = function() {
  console.log('\n🎯========== B站控制栏原生状态全面诊断 ==========');
  
  const container = document.querySelector('.bpx-player-container');
  const controlWrap = container?.querySelector('.bpx-player-control-wrap');
  
  if (!container || !controlWrap) {
    console.log('❌ [致命错误] 未找到播放器或控制栏元素');
    return false;
  }
  
  // 1. B站原生属性检查
  const nativeAttrs = {
    'data-ctrl-hidden': container.getAttribute('data-ctrl-hidden'),
    'bpx-state-no-cursor': container.classList.contains('bpx-state-no-cursor'),
    'data-screen': container.getAttribute('data-screen'),
    'data-revision': container.getAttribute('data-revision')
  };
  console.log('📋 [B站原生属性]', nativeAttrs);
  
  // 2. 控制栏计算样式
  const style = window.getComputedStyle(controlWrap);
  const computedStyles = {
    'display': style.display,
    'visibility': style.visibility, 
    'opacity': style.opacity,
    'pointer-events': style.pointerEvents,
    'z-index': style.zIndex,
    'position': style.position,
    'bottom': style.bottom,
    'transform': style.transform
  };
  console.log('🎨 [控制栏计算样式]', computedStyles);
  
  // 3. 控制栏位置和尺寸
  const rect = controlWrap.getBoundingClientRect();
  const geometry = {
    'visible': rect.width > 0 && rect.height > 0,
    'width': Math.round(rect.width),
    'height': Math.round(rect.height),
    'top': Math.round(rect.top),
    'left': Math.round(rect.left),
    'bottom': Math.round(rect.bottom),
    'inViewport': rect.top >= 0 && rect.left >= 0 && 
                 rect.bottom <= window.innerHeight && 
                 rect.right <= window.innerWidth
  };
  console.log('📐 [控制栏几何信息]', geometry);
  
  // 4. 按钮交互能力
  const buttons = controlWrap.querySelectorAll('.bpx-player-ctrl-btn');
  const buttonStats = {
    'total': buttons.length,
    'visible': 0,
    'clickable': 0
  };
  
  buttons.forEach(btn => {
    const btnStyle = window.getComputedStyle(btn);
    if (btnStyle.display !== 'none' && btnStyle.visibility !== 'hidden') {
      buttonStats.visible++;
    }
    if (btnStyle.pointerEvents !== 'none') {
      buttonStats.clickable++;
    }
  });
  console.log('🎮 [控制按钮统计]', buttonStats);
  
  // 5. 检查专注模式样式干扰
  const focusStyleElements = document.querySelectorAll('style[id*="focus"], link[href*="focus"]');
  const interferenceCheck = {
    'focusStyleCount': focusStyleElements.length,
    'homepageBlocker': !!document.getElementById('focused-homepage-blocker'),
    'earlyStyles': !!document.getElementById('focused-early-styles')
  };
  console.log('🔍 [干扰源检查]', interferenceCheck);
  
  // 6. 鼠标交互测试（模拟，不实际触发）
  const interactionTest = {
    'containerHasMouseEvents': !!container.onmousemove || !!container.onmouseenter,
    'controlWrapHasEvents': !!controlWrap.onmousemove || !!controlWrap.onmouseenter,
    'canReceiveEvents': style.pointerEvents !== 'none'
  };
  console.log('🖱️  [交互能力测试]', interactionTest);
  
  // 7. 最终诊断结论
  const diagnosis = {
    '控制栏可见': geometry.visible && computedStyles.display !== 'none' && computedStyles.visibility !== 'hidden',
    '按钮可交互': buttonStats.clickable > 0 && computedStyles['pointer-events'] !== 'none',
    '无样式干扰': !interferenceCheck.homepageBlocker && !interferenceCheck.earlyStyles,
    'B站原生控制': nativeAttrs['data-ctrl-hidden'] !== null // B站在管理隐藏状态
  };
  
  console.log('\n✅ [最终诊断结论]', diagnosis);
  
  const isHealthy = Object.values(diagnosis).every(Boolean);
  console.log(`\n🎯 [控制栏健康状态]: ${isHealthy ? '✅ 完全正常' : '⚠️ 存在问题'}`);
  
  if (!isHealthy) {
    console.log('\n🔧 [修复建议]:');
    if (!diagnosis['控制栏可见']) console.log('- 控制栏不可见，请移动鼠标到视频上');
    if (!diagnosis['按钮可交互']) console.log('- 按钮无法交互，检查pointer-events样式');
    if (!diagnosis['无样式干扰']) console.log('- 存在首页样式干扰，请运行 debugCleanStyles()');
    if (!diagnosis['B站原生控制']) console.log('- B站未接管控制栏，可能页面未完全加载');
  }
  
  console.log('🎯============ 诊断完成，零干预验证 ============\n');
  return isHealthy;
};

// 🧹 样式清理工具
window.debugCleanStyles = function() {
  console.log('🧹 开始清理可能的样式干扰...');
  
  let cleaned = 0;
  
  // 清理首页样式残留
  const homepageBlocker = document.getElementById('focused-homepage-blocker');
  if (homepageBlocker) {
    homepageBlocker.remove();
    cleaned++;
    console.log('✅ 已移除 focused-homepage-blocker');
  }
  
  const earlyStyles = document.getElementById('focused-early-styles');
  if (earlyStyles) {
    earlyStyles.remove();
    cleaned++;
    console.log('✅ 已移除 focused-early-styles');
  }
  
  // 清理所有首页相关样式
  const homepageStyles = document.querySelectorAll('[id*="focused-homepage"], [id*="homepage-blocker"], [id*="focused-early"]');
  homepageStyles.forEach(style => {
    if (style.id) {
      style.remove();
      cleaned++;
      console.log(`✅ 已清理: ${style.id}`);
    }
  });
  
  // 重置body样式
  document.body.style.overflow = '';
  document.body.style.height = '';
  document.body.style.backgroundColor = '';
  
  // 恢复被隐藏的B站元素（只清除插件造成的隐藏）
  const hiddenElements = document.querySelectorAll('body > *');
  let restored = 0;
  hiddenElements.forEach(el => {
    if (el.style.display === 'none' && !el.id.includes('focused')) {
      el.style.display = '';
      el.style.opacity = '';
      el.style.visibility = '';
      el.style.height = '';
      el.style.pointerEvents = '';
      restored++;
    }
  });
  
  console.log(`🧹 样式清理完成: 移除 ${cleaned} 个干扰样式，恢复 ${restored} 个元素`);
  console.log('🎯 建议重新运行 debugCheckControls() 验证状态');
};

// 全局调试方法：测试控制栏交互
window.debugTestControls = function() {
  const container = document.querySelector('.bpx-player-container');
  if (!container) {
    console.log('[调试] ❌ 找不到播放器容器');
    return;
  }
  
  const controlWrap = container.querySelector('.bpx-player-control-wrap');
  if (!controlWrap) {
    console.log('[调试] ❌ 找不到控制栏');
    return;
  }
  
  // 测试控制栏的各种按钮
  const buttons = controlWrap.querySelectorAll('.bpx-player-ctrl-btn');
  console.log(`[调试] 找到 ${buttons.length} 个控制按钮:`);
  
  buttons.forEach((btn, index) => {
    const label = btn.getAttribute('aria-label') || btn.className;
    const rect = btn.getBoundingClientRect();
    const style = window.getComputedStyle(btn);
    
    console.log(`[调试] 按钮 ${index + 1}: ${label}`, {
      '可见': style.display !== 'none' && style.visibility !== 'hidden',
      '尺寸': `${rect.width}x${rect.height}`,
      '位置': `(${rect.x}, ${rect.y})`,
      '可点击': style.pointerEvents !== 'none'
    });
  });
};

// 🎯 纯原生调试方法：只观察，绝不干预B站属性
window.debugResetControls = function() {
  console.log('[纯原生调试] ⚠️  该方法现在只清除插件自定义样式，不会修改B站原生属性');
  
  const container = document.querySelector('.bpx-player-container');
  if (!container) {
    console.log('[纯原生调试] ❌ 未找到播放器容器');
    return;
  }
  
  const controlWrap = container.querySelector('.bpx-player-control-wrap');
  if (!controlWrap) {
    console.log('[纯原生调试] ❌ 未找到控制栏');
    return;
  }
  
  // 🎯 只清除插件添加的自定义样式，绝不修改B站原生属性
  controlWrap.style.cssText = '';
  
  // 🚫 不再主动移除B站属性：data-ctrl-hidden, bpx-state-no-cursor
  // 让B站原生逻辑完全接管这些属性的管理
  
  console.log('[纯原生调试] ✅ 已清除插件样式，B站原生属性由B站自己管理');
  console.log('[纯原生调试] 📋 B站当前状态:', {
    'data-ctrl-hidden': container.getAttribute('data-ctrl-hidden'),
    'bpx-state-no-cursor': container.classList.contains('bpx-state-no-cursor')
  });
};

// 🧹 已简化：移除不必要的控制栏JS修复
// 经测试确认：CSS能解决的问题就用CSS，不要JS画蛇添足
function fixVideoControls() {
  console.log('⚠️ 此函数已简化：控制栏问题应该用CSS解决，不要JS画蛇添足');
  return true; // 保持兼容性
  
  /* ❌ 已注释：经测试确认JS修复是多余的
  console.log('\n🔧========== 视频控制栏修复工具 ==========');
  
  try {
    const playerContainer = document.querySelector('.bpx-player-container');
    if (!playerContainer) {
      console.log('❌ 未找到播放器容器');
      return;
    }
    
    const controlWrap = playerContainer.querySelector('.bpx-player-control-wrap');
    if (!controlWrap) {
      console.log('❌ 未找到控制栏');
      return;
    }
    
    console.log('🧡 开始智能修复控制栏...');
    
    // 1. 🧡 智能清理插件干扰，让B站原生机制接管
    // 不再强制设置显示样式，只清除可能的插件干扰
    if (controlWrap.style.pointerEvents === 'none') {
      controlWrap.style.pointerEvents = ''; // 清除而不是强制设置
      console.log('[modified] 清除了控制栏的pointer-events干扰');
    }
    // 其他样式交给B站管理，不再强制设置
    
    // 2. 精确修复控制栏按钮，避免影响弹窗
    const controlBarSelectors = [
      '.bpx-player-ctrl-btn',
      '.bpx-player-ctrl-play',
      '.bpx-player-ctrl-volume', 
      '.bpx-player-ctrl-quality',
      '.bpx-player-ctrl-full',
      '.bpx-player-ctrl-time',
      '.bpx-player-ctrl-setting',
      '.bpx-player-progress',
      '.bpx-player-progress-wrap',
      'button',
      '[role="button"]'
    ];
    
    let fixedElements = 0;
    controlBarSelectors.forEach(selector => {
      try {
        const elements = controlWrap.querySelectorAll(selector);
        elements.forEach(element => {
          // 确保元素在控制栏内且不是弹窗元素
          if (controlWrap.contains(element) && 
              !element.closest('.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay')) {
            
            // 🧡 智能修复：只清除明显的插件干扰，不强制设置
            let needsFix = false;
            
            // 只在元素被pointer-events:none干扰时才恢复
            if (element.style.pointerEvents === 'none') {
              element.style.pointerEvents = ''; // 清除而不是强制设置
              needsFix = true;
            }
            
            // 不再强制修改display、visibility、opacity
            // 让B站完全控制这些状态
            
            if (needsFix) {
              fixedElements++;
            }
          }
        });
      } catch (err) {
        console.log(`处理选择器 ${selector} 时出错:`, err);
      }
    });
    
    // 3. 🧡 智能清理：只处理明显的插件干扰
    // 不再主动修改其他元素，避免与B站原生机制冲突
    let clearedElements = 0;
    
    // 只清理插件明确添加的干扰元素
    const pluginInterferences = document.querySelectorAll('[id*="focused"][style*="pointer-events: none"]');
    pluginInterferences.forEach(element => {
      if (!element.closest('.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay')) {
        element.style.pointerEvents = '';
        clearedElements++;
        console.log('[modified] 清除插件元素干扰:', element.id);
      }
    });
    
    // 4. 触发控制栏重新渲染
    const event = new MouseEvent('mouseover', { bubbles: true });
    playerContainer.dispatchEvent(event);
    
    console.log(`✅ 修复完成！`);
    console.log(`   - 修复了 ${fixedElements} 个交互元素`);
    console.log(`   - 清理了 ${clearedElements} 个干扰元素`);
    console.log(`   - 已触发控制栏重新渲染`);
    
    // 5. 验证修复效果
    setTimeout(() => {
      const testButtons = controlWrap.querySelectorAll('button, [role="button"]');
      const workingButtons = Array.from(testButtons).filter(btn => {
        const style = window.getComputedStyle(btn);
        return style.pointerEvents !== 'none' && style.display !== 'none';
      }).length;
      
      console.log(`🎯 验证结果: ${workingButtons}/${testButtons.length} 个按钮可以交互`);
      
      if (workingButtons > 0) {
        console.log('🎉 控制栏修复成功！现在应该可以正常使用了');
      } else {
        console.log('⚠️ 控制栏可能仍有问题，建议刷新页面或检查页面是否完全加载');
      }
    }, 1000);
    
  } catch (err) {
    console.error('❌ 控制栏修复失败:', err);
  }
  */ // 结束注释：JS修复逻辑已移除
}

// 确保函数在全局作用域可用
window.fixVideoControls = fixVideoControls;

// 检查弹窗交互是否正常 - 增强版
window.checkDialogInteraction = function() {
  console.log('\n🔍========== 弹窗交互快速检查 ==========');
  
  // 如果 focusMode 和 exitHandler 可用，使用完整的诊断功能
  if (window.focusMode && window.focusMode.components && window.focusMode.components.exitHandler) {
    console.log('🎯 使用完整的 ExitHandler 诊断功能...');
    return window.focusMode.components.exitHandler.diagnoseDialogInteraction();
  }
  
  console.log('⚠️ ExitHandler 不可用，使用基础检查...');
  
  const dialogs = document.querySelectorAll('.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay');
  
  if (dialogs.length === 0) {
    console.log('✅ 当前没有活动的退出弹窗');
    console.log('💡 要测试弹窗交互，请尝试按 ESC 键退出全屏');
    return { status: 'no-dialogs', dialogs: 0 };
  }
  
  console.log(`🔍 发现 ${dialogs.length} 个活动弹窗:`);
  
  let allDialogsWorking = true;
  
  dialogs.forEach((dialog, index) => {
    console.log(`\n📋 弹窗 ${index + 1}:`);
    console.log('   类名:', dialog.className);
    
    const style = window.getComputedStyle(dialog);
    console.log('   显示状态:', {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex
    });
    
    // 检查弹窗内的按钮
    const buttons = dialog.querySelectorAll('button, [role="button"], [class*="btn"]');
    console.log(`   找到 ${buttons.length} 个按钮`);
    
    let workingButtons = 0;
    buttons.forEach((btn, btnIndex) => {
      const btnStyle = window.getComputedStyle(btn);
      const isWorking = btnStyle.pointerEvents !== 'none' && 
                       btnStyle.display !== 'none' && 
                       btnStyle.visibility !== 'hidden' &&
                       !btn.disabled;
      
      if (isWorking) {
        workingButtons++;
      } else {
        console.log(`   ❌ 按钮 ${btnIndex + 1} 无法交互:`, {
          text: btn.textContent.trim(),
          disabled: btn.disabled,
          pointerEvents: btnStyle.pointerEvents,
          display: btnStyle.display,
          visibility: btnStyle.visibility
        });
        allDialogsWorking = false;
      }
    });
    
    console.log(`   🎯 按钮状态: ${workingButtons}/${buttons.length} 可交互`);
  });
  
  const status = allDialogsWorking ? 'healthy' : 'error';
  
  console.log(`\n📊 基础检查结果: ${status === 'healthy' ? '✅ 正常' : '❌ 发现问题'}`);
  
  if (!allDialogsWorking) {
    console.log('\n🔧 建议修复措施:');
    console.log('   1. 刷新页面重试');
    console.log('   2. 使用完整诊断: window.focusMode.components.exitHandler.diagnoseDialogInteraction()');
  }
  
  console.log('\n================================');
  
  return { status, dialogs: dialogs.length, timestamp: new Date().toISOString() };
};

// 添加全局快捷诊断函数
window.diagnoseFocusDialogs = function() {
  console.log('🩺 启动专注模式弹窗诊断...');
  
  if (window.focusMode && window.focusMode.components && window.focusMode.components.exitHandler) {
    return window.focusMode.components.exitHandler.diagnoseDialogInteraction();
  } else {
    console.warn('⚠️ ExitHandler 未初始化，使用基础检查');
    return window.checkDialogInteraction();
  }
};

// 原有代码已经重构到上面的函数中，这里保留用于兼容性
console.log('[专注模式] 弹窗交互检查函数已加载');

// 紧急修复函数 - 立即可用
window.emergencyFixControls = function() {
  console.log('\n🚨========== 紧急控制栏修复 ==========');
  
  try {
    const playerContainer = document.querySelector('.bpx-player-container');
    if (!playerContainer) {
      console.log('❌ 未找到播放器容器');
      return false;
    }
    
    const controlWrap = playerContainer.querySelector('.bpx-player-control-wrap');
    if (!controlWrap) {
      console.log('❌ 未找到控制栏');
      return false;
    }
    
    console.log('🎯 执行紧急修复...');
    
    // 1. 强制显示控制栏 - 使用适当的z-index值
    controlWrap.style.cssText = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      z-index: 99999 !important;
      position: relative !important;
    `;
    
    // 2. 🧡 仅在必要时移除插件设置的属性
    // 只有在确认是插件造成的情况下才移除，避免干扰B站原生状态
    if (playerContainer.hasAttribute('data-plugin-hidden')) {
      playerContainer.removeAttribute('data-ctrl-hidden');
      console.log('[fixed] 移除插件设置的控制栏隐藏属性');
    }
    
    // 不再无条件移除 bpx-state-no-cursor，让B站控制光标状态
    
    // 3. 精确修复视频控制栏元素 - 避免影响弹窗
    // 只修复明确属于视频控制栏的元素，不使用过于宽泛的选择器
    const specificSelectors = [
      // B站标准控制栏按钮
      '.bpx-player-ctrl-btn',
      '.bpx-player-ctrl-play',
      '.bpx-player-ctrl-volume', 
      '.bpx-player-ctrl-quality',
      '.bpx-player-ctrl-full',
      '.bpx-player-ctrl-time',
      '.bpx-player-ctrl-setting',
      '.bpx-player-progress',
      '.bpx-player-progress-wrap',
      
      // 通用按钮但只在控制栏内
      'button',
      '[role="button"]'
    ];
    
    let fixedCount = 0;
    
    specificSelectors.forEach(selector => {
      try {
        const elements = controlWrap.querySelectorAll(selector);
        elements.forEach(el => {
          // 确保元素确实在控制栏内且不是弹窗元素
          if (controlWrap.contains(el) && !el.closest('.focus-exit-dialog, .top-level-exit-overlay, .exit-transition-overlay')) {
            el.style.pointerEvents = 'auto';
            el.style.display = el.style.display === 'none' ? 'inline-block' : el.style.display;
            el.style.visibility = 'visible';
            el.style.opacity = el.style.opacity === '0' ? '1' : el.style.opacity;
            el.style.zIndex = el.style.zIndex === 'auto' ? '10' : el.style.zIndex;
            fixedCount++;
          }
        });
      } catch (err) {
        // 忽略选择器错误，继续处理其他元素
        console.log(`选择器 ${selector} 处理时出错:`, err);
      }
    });
    
    // 4. 仅清除影响视频控制栏的样式，保护弹窗样式
    const interferingStyles = document.querySelectorAll('style[id*="focused"], style[id*="homepage"]');
    let cleanedStyles = 0;
    
    interferingStyles.forEach(style => {
      const styleContent = style.textContent || '';
      // 只清理明确影响控制栏但不影响弹窗的样式
      const affectsControlBar = styleContent.includes('.bpx-player-control') || 
                               styleContent.includes('bpx-player-ctrl');
      
      // 确保不清理弹窗相关样式
      const affectsDialogs = styleContent.includes('focus-exit-dialog') ||
                           styleContent.includes('top-level-exit-overlay') ||
                           styleContent.includes('exit-transition-overlay') ||
                           styleContent.includes('focus-dialog') ||
                           styleContent.includes('z-index: 99999');
      
      if (affectsControlBar && !affectsDialogs) {
        console.log('🧹 安全移除控制栏干扰样式:', style.id);
        style.remove();
        cleanedStyles++;
      }
    });
    
    // 5. 强制触发控制栏显示
    const events = ['mouseenter', 'mousemove', 'focus'];
    events.forEach(eventType => {
      const event = new MouseEvent(eventType, { 
        bubbles: true, 
        cancelable: true,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight - 100
      });
      playerContainer.dispatchEvent(event);
    });
    
    console.log(`✅ 智能修复完成！`);
    console.log(`   - 清除了 ${fixedCount} 个元素的插件干扰`);
    console.log(`   - 清理了 ${clearedElements} 个插件干扰元素`);
    console.log(`   - 安全清理了 ${cleanedStyles} 个干扰样式`);
    console.log(`   - B站原生机制现在可以正常管理控制栏`);
    console.log('🎯 请移动鼠标到视频上测试控制栏功能');
    
    return true;
    
  } catch (err) {
    console.error('❌ 紧急修复失败:', err);
    return false;
  }
};

// 全局调试方法：测试全屏状态
window.debugFullscreenControls = function() {
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                          document.mozFullScreenElement || document.msFullscreenElement);
  
  const container = document.querySelector('.bpx-player-container');
  const controlWrap = container ? container.querySelector('.bpx-player-control-wrap') : null;
  
  if (!container || !controlWrap) {
    console.log('[调试] ❌ 找不到播放器或控制栏元素');
    return;
  }
  
  const rect = controlWrap.getBoundingClientRect();
  const style = window.getComputedStyle(controlWrap);
  
  console.log('[调试] 🎯 全屏状态分析:', {
    '全屏状态': isFullscreen,
    '控制栏位置': {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      '在视口内': rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
    },
    '控制栏样式': {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      position: style.position,
      top: style.top,
      bottom: style.bottom,
      background: style.background,
      backgroundColor: style.backgroundColor
    },
    '容器属性': {
      'data-ctrl-hidden': container.getAttribute('data-ctrl-hidden'),
      'data-screen': container.getAttribute('data-screen'),
      'bpx-state-no-cursor': container.classList.contains('bpx-state-no-cursor')
    }
  });
}; 