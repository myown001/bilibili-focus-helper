/**
 * 专注模式主类
 * 负责在B站视频页面创建无干扰的学习环境
 */
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
      
      // 性能优化：使用单个变量跟踪初始化状态
      this._initialized = {
        basics: false,
        lazy: false
      };
      
      this.originalStyles = {};
      this.hiddenElements = [];
      this.collectionSidebar = null;
      
      // 确保方法正确定义
      // 注：只有在原型方法未被正确继承时才定义
      this.defineMethodSafely();
      
      // 明确绑定所有需要this引用的方法
      this.bindMethods();
      
      // 快速初始化基础功能
      this.initializeBasics();
      
      // 延迟初始化次要功能
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => this.lazyInitialize(), 200);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => this.lazyInitialize(), 200);
        });
      }
      
      // 监听全屏变化事件
      document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
      document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
      document.addEventListener('mozfullscreenchange', this.fullscreenChangeHandler);
      document.addEventListener('MSFullscreenChange', this.fullscreenChangeHandler);
      
      console.log('[专注模式] FocusMode实例已创建');
      
      this.settingsManager = new FocusSettingsManager();
      this.firstTimeSetup = new FirstTimeSetup(this.settingsManager);
      this.exitHandler = new ExitHandler(this.settingsManager);
      this.isInitialized = false;
    } catch (err) {
      console.error('[专注模式] 构造函数错误:', err);
      // 使用静态方法恢复
      FocusMode.recoverFromConstructorError(this, err);
    }
  }
  
  /**
   * 定义可能缺失的方法，确保在绑定前方法存在
   */
  defineMethodSafely() {
    // 检查原型方法或定义备用
    if (!FocusMode.prototype.toggle) {
      FocusMode.prototype.toggle = function() { 
        console.log('[专注模式] 切换专注模式'); 
        if (this.enterFullscreenMode) {
          this.enterFullscreenMode();
        } else {
          console.warn('[专注模式] enterFullscreenMode方法不存在');
        }
      };
    }
    
    if (!FocusMode.prototype.hideDistractions) {
      FocusMode.prototype.hideDistractions = function() { 
        console.log('[专注模式] 隐藏干扰元素'); 
        if (this.enterFullscreenMode) {
          this.enterFullscreenMode();
        } else {
          console.warn('[专注模式] enterFullscreenMode方法不存在');
        }
      };
    }
    
    if (!FocusMode.prototype.fullscreenChangeHandler) {
      FocusMode.prototype.fullscreenChangeHandler = function() {
        try {
          if (this.settings.forceFullscreen && this.isActive && 
              !document.fullscreenElement && !document.webkitFullscreenElement && 
              !document.mozFullScreenElement && !document.msFullscreenElement) {
            // 如果退出了全屏但设置为强制全屏，则重新进入全屏
            setTimeout(() => {
              if (this.enterFullscreenMode) {
                this.enterFullscreenMode();
              }
            }, 100);
          }
        } catch (err) {
          console.error('[专注模式] 全屏变化处理错误:', err);
        }
      };
    }
    
    if (!FocusMode.prototype.enterFullscreenMode) {
      FocusMode.prototype.enterFullscreenMode = function() {
        // 只尝试标准全屏API，不降级
        const videoContainers = [
          document.querySelector('#bilibili-player'),
          document.querySelector('.bpx-player-container'),
          document.querySelector('.player-container'),
          document.querySelector('.bilibili-player-video-container')
        ];
        const videoContainer = videoContainers.find(container => container !== null);

        if (!videoContainer) {
          console.warn('[专注模式] 未找到视频容器，无法进入全屏模式');
          return;
        }

        // 兼容不同浏览器的全屏API
        if (videoContainer.requestFullscreen) {
          videoContainer.requestFullscreen();
        } else if (videoContainer.webkitRequestFullscreen) {
          videoContainer.webkitRequestFullscreen();
        } else if (videoContainer.mozRequestFullScreen) {
          videoContainer.mozRequestFullScreen();
        } else if (videoContainer.msRequestFullscreen) {
          videoContainer.msRequestFullscreen();
        } else {
          console.warn('[专注模式] 当前浏览器不支持全屏API');
        }
      };
    }
  }
  
  /**
   * 绑定所有需要this引用的方法
   */
  bindMethods() {
    try {
      // 收集类中所有方法名
      const methodNames = Object.getOwnPropertyNames(FocusMode.prototype)
        .filter(prop => typeof FocusMode.prototype[prop] === 'function' && prop !== 'constructor');
      
      // 安全地绑定所有方法
      for (const methodName of methodNames) {
        if (this[methodName]) {
          this[methodName] = this[methodName].bind(this);
        } else {
          console.warn(`[专注模式] 方法 ${methodName} 在实例上不存在，跳过绑定`);
        }
      }
      
      // 确保关键方法已绑定
      this.toggle = this.toggle.bind(this);
      this.hideDistractions = this.hideDistractions.bind(this);
      this.fullscreenChangeHandler = this.fullscreenChangeHandler.bind(this);
      this.enterFullscreenMode = this.enterFullscreenMode.bind(this);
      
      console.log('[专注模式] 方法绑定完成');
    } catch (err) {
      console.error('[专注模式] 绑定方法错误:', err);
    }
  }
  
  /**
   * 静态恢复方法 - 在构造函数失败时使用
   */
  static recoverFromConstructorError(instance, error) {
    console.log('[专注模式] 尝试从构造函数错误恢复:', error.message);
    
    // 基本属性初始化
    if (!instance.isActive) instance.isActive = false;
    if (!instance.settings) {
      instance.settings = {
        autoActivate: true,
        forceFullscreen: true,
        filterDanmaku: true,
        allowExitFullscreen: false
      };
    }
    
    // 尝试补充缺失的方法
    if (!instance.enterFullscreenMode) {
      instance.enterFullscreenMode = function() {
        const videoContainer = document.querySelector('#bilibili-player') || 
                               document.querySelector('.bpx-player-container');
        if (videoContainer) {
          videoContainer.requestFullscreen().catch(e => console.warn('全屏失败', e));
        }
      }.bind(instance);
    }
    
    console.log('[专注模式] 恢复完成');
  }
  
  initializeBasics() {
    try {
    if (this._initialized.basics) return;
    this._initialized.basics = true;
    
    // 快速添加基本样式
    this.addBasicStyles();
    
    // 如果在视频页面，立即激活
    if (this.isVideoPage() && this.settings.autoActivate) {
      this.isActive = true;
        this.enterFullscreenMode();
      }
    } catch (err) {
      console.error('[专注模式] 初始化基础功能错误:', err);
    }
  }
  
  // 添加基本样式 - 轻量级版本，仅包含核心样式
  addBasicStyles() {
    try {
    const styleId = 'focus-mode-basic-styles';
    let styleEl = document.getElementById(styleId);
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
          /* 确保视频播放器始终可见 */
        .bpx-player-container, #bilibili-player, .player-container, .bilibili-player-video-container,
        .bpx-player-video-area, .bpx-player-primary-area, .bpx-player-video-wrap, .bpx-player-video,
        .bilibili-player-area, .bilibili-player-video-wrap, .bilibili-player-video {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
            z-index: 10000 !important;
        }
        
        /* 特别确保视频元素可见 */
        .bpx-player-container video, #bilibili-player video, .player-container video, .bilibili-player-video-container video,
          .bpx-player-video video, .bilibili-player-video video, video {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 10000 !important;
        }
        
          /* 全屏状态优化 */
          :-webkit-full-screen #bilibili-player,
          :-moz-full-screen #bilibili-player,
          :fullscreen #bilibili-player {
            width: 100vw !important;
            height: 100vh !important;
            background: #000 !important;
          }
          
          /* 弹幕过滤按钮 */
          .danmaku-filter-button {
          position: fixed;
          top: 15px;
            right: 15px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 15px;
          cursor: pointer;
          font-size: 13px;
            z-index: 999999;
          transition: background 0.2s;
        }
        
          .danmaku-filter-button:hover {
          background: rgba(36, 148, 204, 0.8);
        }
        
          /* 过滤弹幕面板 */
          .danmaku-filter-panel {
          position: fixed;
            top: 60px;
          right: 15px;
            background: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 4px;
            padding: 15px;
            width: 300px;
          z-index: 999999;
            display: none;
          }
          
          .danmaku-filter-panel.active {
            display: block;
          }
          
          .danmaku-filter-panel h3 {
            margin-top: 0;
            margin-bottom: 10px;
          font-size: 16px;
          }
          
          .danmaku-filter-option {
            margin-bottom: 8px;
          }
          
          .danmaku-filter-option label {
            display: flex;
            align-items: center;
            cursor: pointer;
          }
          
          .danmaku-filter-option input[type="checkbox"] {
            margin-right: 8px;
        }
      `;
      document.head.appendChild(styleEl);
      }
    } catch (err) {
      console.error('[专注模式] 添加基础样式错误:', err);
    }
  }
  
  async lazyInitialize() {
    try {
    if (this._initialized.lazy) return;
    this._initialized.lazy = true;
    
      // 加载设置
      await this.loadSettings();
      
      // 初始化学习计时器 (减少初始化开销)
      if (window.studyRecorder) {
        this.studyRecorder = window.studyRecorder;
      }
      
      // 添加完整样式
      this.addStyles();
      
      // 设置视频专注功能
      if (this.isVideoPage()) {
        this.setupVideoFocus();
        this.setupKeyboardShortcuts();
        
        // 添加弹幕过滤按钮
        this.addDanmakuFilterButton();
        
        // 如果已经激活，确保全屏模式
        if (this.isActive) {
          this.enterFullscreenMode();
        }
      }
      
      // 设置定期检查
      this.setupPeriodicChecks();
    } catch (err) {
      console.error('[专注模式] 延迟初始化失败:', err);
    }
  }
  
  // 添加弹幕过滤按钮
  addDanmakuFilterButton() {
    try {
      if (document.querySelector('.danmaku-filter-button')) return;
      
      // 创建弹幕过滤按钮
      const filterButton = document.createElement('button');
      filterButton.className = 'danmaku-filter-button';
      filterButton.textContent = '弹幕过滤';
      filterButton.addEventListener('click', () => this.toggleDanmakuFilterPanel());
      
      // 创建弹幕过滤面板
      const filterPanel = document.createElement('div');
      filterPanel.className = 'danmaku-filter-panel';
      filterPanel.innerHTML = `
        <h3>弹幕过滤选项</h3>
        <div class="danmaku-filter-option">
          <label>
            <input type="checkbox" id="filter-all-danmaku" ${this.settings.filterDanmaku ? 'checked' : ''}>
            <span>关闭所有弹幕</span>
          </label>
        </div>
        <div class="danmaku-filter-option">
          <label>
            <input type="checkbox" id="filter-color-danmaku">
            <span>过滤彩色弹幕</span>
          </label>
        </div>
        <div class="danmaku-filter-option">
          <label>
            <input type="checkbox" id="filter-long-danmaku">
            <span>过滤长文本弹幕</span>
          </label>
        </div>
        <div class="danmaku-filter-option">
          <label>
            <input type="checkbox" id="reduce-danmaku-opacity">
            <span>降低弹幕透明度</span>
          </label>
        </div>
      `;
      
      // 添加到页面
      document.body.appendChild(filterButton);
      document.body.appendChild(filterPanel);
      
      // 添加过滤选项事件监听
      document.getElementById('filter-all-danmaku').addEventListener('change', (e) => {
        this.settings.filterDanmaku = e.target.checked;
        this.applyDanmakuFilter();
        this.saveSettings();
      });
      
      if (document.getElementById('filter-color-danmaku')) {
        document.getElementById('filter-color-danmaku').addEventListener('change', (e) => {
          this.settings.filterColorDanmaku = e.target.checked;
          this.applyDanmakuFilter();
          this.saveSettings();
        });
      }
      
      if (document.getElementById('filter-long-danmaku')) {
        document.getElementById('filter-long-danmaku').addEventListener('change', (e) => {
          this.settings.filterLongDanmaku = e.target.checked;
          this.applyDanmakuFilter();
          this.saveSettings();
        });
      }
      
      if (document.getElementById('reduce-danmaku-opacity')) {
        document.getElementById('reduce-danmaku-opacity').addEventListener('change', (e) => {
          this.settings.reduceDanmakuOpacity = e.target.checked;
          this.applyDanmakuFilter();
          this.saveSettings();
        });
      }
      
      // 应用当前过滤设置
      this.applyDanmakuFilter();
    } catch (err) {
      console.error('[专注模式] 添加弹幕过滤按钮错误:', err);
    }
  }
  
  /**
   * 加载用户设置
   * 优先使用Chrome存储API，回退到localStorage
   */
  async loadSettings() {
    try {
      // 检查StorageUtils是否可用
      if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.load === 'function') {
      const result = await StorageUtils.load('focusSettings', {
        autoActivate: true,
          forceFullscreen: true,
          filterDanmaku: false,
          allowExitFullscreen: false,
          hideComments: false,
          hideRecommendations: false,
          hideSidebar: false,
          hideHeader: false,
        darkMode: false,
        reminderInterval: 20,
        reminders: ['请专注学习，不要分心']
      });
      
      this.settings = { ...this.settings, ...result };
      } else {
        // 回退到localStorage
        try {
          const savedSettings = localStorage.getItem('focusSettings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            this.settings = { ...this.settings, ...parsedSettings };
          }
        } catch (localErr) {
          console.warn('[专注模式] localStorage加载设置失败:', localErr);
        }
      }
    } catch (e) {
      console.error('[专注模式] 加载设置失败:', e);
    }
  }
  
  /**
   * 保存用户设置
   * 优先使用Chrome存储API，回退到localStorage
   */
  async saveSettings() {
    try {
      // 检查StorageUtils是否可用
      if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.save === 'function') {
      await StorageUtils.save('focusSettings', this.settings);
      } else {
        // 回退到localStorage
        try {
          localStorage.setItem('focusSettings', JSON.stringify(this.settings));
        } catch (localErr) {
          console.warn('[专注模式] localStorage保存设置失败:', localErr);
        }
      }
    } catch (e) {
      console.error('[专注模式] 保存设置失败:', e);
    }
  }
  
  /**
   * 添加专注模式所需的CSS样式
   * 只保留必要的样式定义，减少性能消耗
   */
  addStyles() {
    try {
      // 检查ensureStylesOnce是否可用
      if (typeof ensureStylesOnce === 'function') {
    ensureStylesOnce('focus-mode-extra-styles', `
          /* 确保视频控制栏可见 */
          .bpx-player-control-wrap,
          .bilibili-player-video-control-wrap,
          .bpx-player-sending-bar,
          .bilibili-player-video-sendbar,
          .bpx-player-ctrl-btn,
          .bilibili-player-video-btn,
          .bpx-player-ctrl-volume,
          .bilibili-player-video-volume,
          .bpx-player-ctrl-quality,
          .bilibili-player-video-quality,
          .bpx-player-video-progress,
          .bilibili-player-video-progress {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 1000001 !important;
          }
          
          /* 全屏状态下的页面样式 */
          html.page-fullscreen-html {
            overflow: hidden !important;
          }
          
          body.page-fullscreen {
            overflow: hidden !important;
          }
          
          /* 全屏时保持视频元素的显示 */
          body.page-fullscreen #bilibili-player, 
          body.page-fullscreen .bpx-player-container, 
          body.page-fullscreen .player-container, 
          body.page-fullscreen .bilibili-player-video-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            background: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `);
      } else {
        // 回退到直接添加样式
        let styleEl = document.getElementById('focus-mode-extra-styles');
        
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'focus-mode-extra-styles';
          styleEl.textContent = `
            /* 确保视频控制栏可见 */
            .bpx-player-control-wrap,
            .bilibili-player-video-control-wrap,
            .bpx-player-sending-bar,
            .bilibili-player-video-sendbar,
            .bpx-player-ctrl-btn,
            .bilibili-player-video-btn,
            .bpx-player-ctrl-volume,
            .bilibili-player-video-volume,
            .bpx-player-ctrl-quality,
            .bilibili-player-video-quality,
            .bpx-player-video-progress,
            .bilibili-player-video-progress {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              z-index: 1000001 !important;
            }
            
            /* 全屏状态下的页面样式 */
            html.page-fullscreen-html {
              overflow: hidden !important;
            }
            
            body.page-fullscreen {
              overflow: hidden !important;
            }
            
            /* 全屏时保持视频元素的显示 */
            body.page-fullscreen #bilibili-player, 
            body.page-fullscreen .bpx-player-container, 
            body.page-fullscreen .player-container, 
            body.page-fullscreen .bilibili-player-video-container {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              z-index: 999999 !important;
              background: #000 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          `;
          document.head.appendChild(styleEl);
        }
      }
    } catch (err) {
      console.error('[专注模式] 添加样式错误:', err);
    }
  }
  
  /**
   * 应用弹幕过滤
   */
  applyDanmakuFilter() {
    try {
      const styleId = 'danmaku-filter-styles';
      let styleEl = document.getElementById(styleId);
      
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      
      // 根据设置生成CSS
      let css = '';
      
      // 过滤所有弹幕
      if (this.settings.filterDanmaku) {
        css += `
          .bpx-player-dm-root, 
          .bpx-player-dm-wrap,
          .bpx-player-dm-container,
          .bpx-player-danmaku,
          .bilibili-player-video-danmaku,
          .bilibili-player-video-danmaku-switch,
          .bpx-player-dm-btn-setting,
          .dm-wrap,
          .bpx-player-dm-area,
          .bpx-player-video-danmaku-wrap {
            display: none !important;
          }
        `;
      } 
      // 其他过滤选项
      else {
        // 降低弹幕透明度
        if (this.settings.reduceDanmakuOpacity) {
          css += `
            .bpx-player-dm-root, 
            .bpx-player-dm-wrap,
            .bpx-player-dm-container,
            .bpx-player-danmaku,
            .bilibili-player-video-danmaku,
            .bilibili-player-video-danmaku-switch,
            .bpx-player-dm-btn-setting,
            .dm-wrap,
            .bpx-player-dm-area {
              opacity: 0.3 !important;
            }
          `;
        }
        
        // 过滤彩色弹幕
        if (this.settings.filterColorDanmaku) {
          css += `
            .danmaku-item[style*="color"]:not([style*="color: #ffffff"]):not([style*="color: white"]):not([style*="color: rgb(255, 255, 255)"]),
            .danmaku-item[style*="background"] {
              display: none !important;
            }
          `;
        }
        
        // 过滤长文本弹幕
        if (this.settings.filterLongDanmaku) {
          css += `
            .danmaku-item {
              max-width: 100px !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              white-space: nowrap !important;
            }
          `;
        }
      }
      
      styleEl.textContent = css;
    } catch (err) {
      console.error('[专注模式] 应用弹幕过滤错误:', err);
    }
  }
  
  // 切换弹幕过滤面板
  toggleDanmakuFilterPanel() {
    try {
      const panel = document.querySelector('.danmaku-filter-panel');
      if (panel) {
        panel.classList.toggle('active');
      }
    } catch (err) {
      console.error('[专注模式] 切换弹幕过滤面板错误:', err);
    }
  }
  
  // 检查是否是视频页面
  isVideoPage() {
    try {
      return window.location.pathname.includes('/video/') || 
            window.location.pathname.includes('/bangumi/play/') ||
            window.location.pathname.includes('/cheese/play/');
    } catch (err) {
      console.error('[专注模式] 检查视频页面错误:', err);
      return false;
    }
  }
  
  // 设置键盘快捷键
  setupKeyboardShortcuts() {
    try {
      document.addEventListener('keydown', (e) => {
        // 避免在输入框中触发快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Alt+D 切换弹幕过滤
        if (e.altKey && (e.key === 'd' || e.key === 'D')) {
          e.preventDefault();
          if (this.settings) {
            this.settings.filterDanmaku = !this.settings.filterDanmaku;
            this.applyDanmakuFilter();
            this.saveSettings();
            
            // 更新UI
            const checkbox = document.getElementById('filter-all-danmaku');
            if (checkbox) checkbox.checked = this.settings.filterDanmaku;
          }
        }
        
        // Esc键尝试退出全屏（但会被fullscreenChangeHandler再次拦截）
        if (e.key === 'Escape' && this.settings && !this.settings.allowExitFullscreen) {
          e.preventDefault();
          e.stopPropagation();
        }
        
        // 处理播放速度快捷键
        this.handlePlaybackSpeedKeys(e);
      });
    } catch (err) {
      console.error('[专注模式] 设置键盘快捷键错误:', err);
    }
  }
  
  // 设置定期检查
  setupPeriodicChecks() {
    try {
      // 创建throttle函数的简单实现
      const throttle = (fn, delay) => {
        let lastCall = 0;
        return function(...args) {
          const now = new Date().getTime();
          if (now - lastCall < delay) {
            return;
          }
          lastCall = now;
          return fn(...args);
        };
      };
      
      // 使用节流函数优化定期检查，避免频繁执行
      const performChecks = throttle(() => {
        // 检查是否在视频页面
        if (this.isActive && this.studyRecorder) {
          // 检查学习时间
          this.updateStudyTimeDisplay();
        }
      }, 10000); // 10秒检查一次
      
      setInterval(performChecks, 10000);
    } catch (err) {
      console.error('[专注模式] 设置定期检查错误:', err);
    }
  }
  
  // 更新学习时间显示
  updateStudyTimeDisplay() {
    try {
      if (!this.studyRecorder) return;
      
      // 查找或创建时间显示器
      let timerDisplay = document.querySelector('.study-timer-display');
      if (!timerDisplay) {
        timerDisplay = document.createElement('div');
        timerDisplay.className = 'study-timer-display';
        document.body.appendChild(timerDisplay);
      }
      
      // 获取当前学习时长
      const duration = this.studyRecorder.getEffectiveDuration ? 
                      this.studyRecorder.getEffectiveDuration() : 0;
      
      // 格式化显示
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      timerDisplay.textContent = `学习时间: ${minutes}分${seconds}秒`;
    } catch (err) {
      console.error('[专注模式] 更新学习时间显示错误:', err);
    }
  }
  
  /**
   * 设置视频专注模式
   * 增强B站视频播放器，创建沉浸式学习环境
   */
  setupVideoFocus() {
    try {
      // 使用多个选择器匹配不同版本B站播放器
      const playerSelectors = [
        '.bilibili-player-video-wrap',
        '.bpx-player-video-area',
        '.bilibili-player-area',
        '.player-area',
        '.bpx-player-primary-area',
        '#bilibili-player',
        '.bpx-player-container',
        '.player-container'
      ];
      
      let playerWrap = null;
      
      // 尝试所有可能的选择器
      for (const selector of playerSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          playerWrap = element;
          console.log('[专注模式] 找到播放器容器:', selector);
          break;
        }
      }
      
      if (!playerWrap) {
        console.warn('[专注模式] 未找到视频播放器容器，尝试延迟重试');
        // 延迟重试，应对动态加载的播放器
        setTimeout(() => this.setupVideoFocus(), 1000);
        return false;
      }
      
      // 保存原始样式，以便后续恢复
      this.originalStyles.playerWrap = {
        position: playerWrap.style.position,
        top: playerWrap.style.top,
        left: playerWrap.style.left,
        width: playerWrap.style.width,
        height: playerWrap.style.height,
        zIndex: playerWrap.style.zIndex
      };
      
      // 立即进入全屏模式
      setTimeout(() => {
        if (typeof this.enterFullscreenMode === 'function') {
          this.enterFullscreenMode();
        }
      }, 500);
      
      return true;
    } catch (error) {
      console.error('[专注模式] 设置视频专注模式失败:', error);
      return false;
    }
  }
  
  /**
   * 显示播放速度指示器
   * 在屏幕上临时显示当前播放速度
   * @param {number} speed - 当前播放速度
   */
  showSpeedIndicator(speed) {
    try {
    let indicator = document.querySelector('.focus-mode-speed-indicator');
    
    // 如果指示器不存在，创建一个新的
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'focus-mode-speed-indicator';
      document.body.appendChild(indicator);
    }
    
    // 更新速度显示
    indicator.textContent = `播放速度: ${speed}x`;
    indicator.style.opacity = '1';
    
    // 1.5秒后淡出
    clearTimeout(this.speedIndicatorTimeout);
    this.speedIndicatorTimeout = setTimeout(() => {
      indicator.style.opacity = '0';
    }, 1500);
    } catch (err) {
      console.error('[专注模式] 显示播放速度指示器错误:', err);
    }
  }
  
  /**
   * 初始化专注模式
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // 初始化设置管理器
      await this.settingsManager.initialize();
      
      // 获取设置
      const settings = await this.settingsManager.getSettings();
      
      // 如果是首次使用，显示设置向导
      if (settings.isFirstTime) {
        await this.firstTimeSetup.showSetup();
      }
      
      // 添加全屏变化监听
      this.addFullscreenChangeListener();
      
      // 添加键盘快捷键
      this.addKeyboardShortcuts();
      
      this.isInitialized = true;
    } catch (err) {
      console.error('[专注模式] 初始化失败:', err);
    }
  }
  
  /**
   * 添加全屏变化监听
   */
  addFullscreenChangeListener() {
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
  }
  
  /**
   * 处理全屏变化
   */
  async handleFullscreenChange() {
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
    
    if (!isFullscreen) {
      // 退出全屏时，检查是否需要验证
      const settings = await this.settingsManager.getSettings();
      if (settings.password) {
        // 阻止默认的退出行为
        event.preventDefault();
        // 恢复全屏
        this.exitHandler.restoreFullscreen();
        // 显示退出验证
        this.exitHandler.handleExit();
      }
    }
  }
  
  /**
   * 添加键盘快捷键
   */
  addKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Ctrl+Alt+R: 重置设置
      if (e.ctrlKey && e.altKey && e.key === 'r') {
        e.preventDefault();
        const { dialog, background } = UIUtils.createDialog({
          title: '重置设置',
          content: `
            <div class="dialog-message">
              确定要重置所有设置吗？此操作不可恢复。
            </div>
          `,
          buttons: [
            {
              text: '取消',
              type: 'secondary',
              onClick: (e, dialog, background) => {
                UIUtils.closeDialog(background);
              }
            },
            {
              text: '确定',
              type: 'primary',
              onClick: async (e, dialog, background) => {
                await this.settingsManager.resetSettings();
                UIUtils.closeDialog(background);
                // 重新显示设置向导
                await this.firstTimeSetup.showSetup();
              }
            }
          ],
          className: 'focus-exit-dialog'
        });
      }
    });
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof FocusMode !== 'undefined' && !window.FocusMode) window.FocusMode = FocusMode; 