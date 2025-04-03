// optimized-content.js - 优化后的内容脚本

// 使用立即执行函数表达式(IIFE)创建模块化结构
(function() {
  'use strict';
  
  // ===== 配置管理模块 =====
  const Config = {
    // 默认配置
    defaults: {
      password: '',
      reminders: [],
      autoFullscreen: true,
      hideRecommendations: true,
      hideComments: true,
      focusMode: 'strict' // 'strict', 'moderate', 'light'
    },
    
    // 快捷键配置
    shortcuts: {
      RESET_PASSWORD: { key: 'r', ctrl: true, alt: true },
      TOGGLE_FOCUS: { key: 'f', ctrl: true, alt: true },
      EXIT_FULLSCREEN: { key: 'Escape' }
    },
    
    // B站页面URL匹配
    urls: {
      homePages: [
        'https://www.bilibili.com/',
        'https://bilibili.com/',
        'https://www.bilibili.com/index.html'
      ],
      videoPages: [
        '/video/',
        '/bangumi/play/',
        '/cheese/play/'
      ]
    },
    
    // 获取配置
    get: async function(keys) {
      return new Promise(resolve => {
        chrome.storage.local.get(keys, result => {
          // 合并默认值
          const config = {};
          keys.forEach(key => {
            config[key] = result[key] !== undefined ? result[key] : this.defaults[key];
          });
          resolve(config);
        });
      });
    },
    
    // 保存配置
    save: async function(data) {
      return new Promise(resolve => {
        chrome.storage.local.set(data, resolve);
      });
    }
  };
  
  // ===== 状态管理模块 =====
  const State = {
    password: '',
    reminders: [],
    isFullscreen: false,
    isValidating: false,
    isProcessing: false,
    isCancelled: false,
    isExiting: false,
    passwordVerified: false,
    isManualFullscreen: false,
    startTime: null,
    videoStartTime: null,
    currentVideoId: null,
    currentVideoTitle: null,
    isStudySessionActive: false,
    studyRecorder: null,
    
    // 初始化状态
    init: async function() {
      const config = await Config.get(['password', 'reminders']);
      this.password = config.password;
      this.reminders = config.reminders;
    },
    
    // 设置全屏状态
    setFullscreen: function(value) {
      this.isFullscreen = value;
      document.body.classList.toggle('fullscreen-mode', value);
    },
    
    // 开始学习会话
    startStudySession: function() {
      if (!this.isStudySessionActive) {
        this.videoStartTime = new Date();
        this.isStudySessionActive = true;
        console.log('学习会话开始:', this.videoStartTime);
      }
    },
    
    // 结束学习会话并记录
    endStudySession: function() {
      if (this.isStudySessionActive && this.videoStartTime && this.currentVideoId) {
        const endTime = new Date();
        const duration = Math.round((endTime - this.videoStartTime) / 1000); // 秒
        
        // 只记录超过10秒的学习会话
        if (duration > 10) {
          const studyRecord = {
            videoId: this.currentVideoId,
            title: this.currentVideoTitle || '未知视频',
            duration: duration,
            startTime: this.videoStartTime.toISOString(),
            endTime: endTime.toISOString(),
            date: new Date().toISOString(),
            url: window.location.href
          };
          
          // 发送到background.js存储
          chrome.runtime.sendMessage({
            type: 'saveStudyRecord',
            data: studyRecord
          });
          
          console.log('学习会话结束，持续时间:', duration, '秒');
        }
        
        // 重置状态
        this.videoStartTime = null;
        this.isStudySessionActive = false;
      }
    },
    
    // 更新当前视频信息
    updateVideoInfo: function(videoId, videoTitle) {
      // 如果视频ID变化，结束上一个会话并开始新会话
      if (this.currentVideoId && this.currentVideoId !== videoId) {
        this.endStudySession();
      }
      
      this.currentVideoId = videoId;
      this.currentVideoTitle = videoTitle;
      
      // 开始新会话
      if (!this.isStudySessionActive) {
        this.startStudySession();
      }
    }
  };
  
  // ===== 工具函数模块 =====
  const Utils = {
    // 防抖函数
    debounce: function(func, wait) {
      let timeout;
      return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    },
    
    // 节流函数
    throttle: function(func, limit) {
      let inThrottle;
      return function(...args) {
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
    
    // 等待元素加载完成的函数，增加超时处理和更可靠的元素检测
    waitForElement: function(selector, callback, timeout = 10000) {
      return new Promise((resolve) => {
        let startTime = Date.now();
        let intervalId = null;
        let timeoutId = null;
        
        function check() {
          const element = document.querySelector(selector);
          if (element) {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            callback(element);
            resolve(element);
            return true;
          }
          
          if (Date.now() - startTime > timeout) {
            clearInterval(intervalId);
            console.log(`等待元素 ${selector} 超时`);
            callback(null); // 超时时传递null给回调函数
            resolve(null);
            return false;
          }
          
          return false;
        }
        
        // 立即检查一次
        if (check()) return;
        
        // 设置定期检查
        intervalId = setInterval(check, 200);
        
        // 设置超时处理
        timeoutId = setTimeout(() => {
          clearInterval(intervalId);
          console.log(`等待元素 ${selector} 超时`);
          callback(null);
          resolve(null);
        }, timeout);
      });
    },
    
    // 随机选择一条提醒语
    getRandomReminder: function() {
      if (!State.reminders || State.reminders.length === 0) {
        return '请专注学习，不要分心！';
      }
      const index = Math.floor(Math.random() * State.reminders.length);
      return State.reminders[index];
    },
    
    // 显示提醒消息
    showReminder: function(message, duration = 3000) {
      // 移除可能存在的旧提醒
      const existingReminder = document.querySelector('.focus-reminder');
      if (existingReminder) {
        existingReminder.remove();
      }
      
      // 创建新提醒
      const reminder = document.createElement('div');
      reminder.className = 'focus-reminder';
      reminder.textContent = message;
      document.body.appendChild(reminder);
      
      // 设置自动消失
      setTimeout(() => {
        reminder.classList.add('fade-out');
        setTimeout(() => reminder.remove(), 500);
      }, duration);
    },
    
    // 提取视频ID
    extractVideoId: function() {
      const url = window.location.href;
      let videoId = '';
      
      // 匹配B站视频ID (BV开头的ID)
      const bvMatch = url.match(/\/video\/([A-Za-z0-9]+)/);
      if (bvMatch && bvMatch[1]) {
        videoId = bvMatch[1];
      }
      
      // 匹配番剧ID
      const bangumiMatch = url.match(/\/bangumi\/play\/([A-Za-z0-9]+)/);
      if (bangumiMatch && bangumiMatch[1]) {
        videoId = 'bangumi_' + bangumiMatch[1];
      }
      
      // 匹配课程ID
      const cheeseMatch = url.match(/\/cheese\/play\/([A-Za-z0-9]+)/);
      if (cheeseMatch && cheeseMatch[1]) {
        videoId = 'cheese_' + cheeseMatch[1];
      }
      
      return videoId || 'unknown_' + Date.now();
    },
    
    // 提取视频标题
    extractVideoTitle: function() {
      // 尝试从页面元素中获取标题
      const titleElement = document.querySelector('.video-title, .media-title, h1');
      if (titleElement) {
        return titleElement.textContent.trim();
      }
      
      // 如果找不到标题元素，使用文档标题
      const docTitle = document.title;
      // 移除B站后缀
      return docTitle.replace(/_哔哩哔哩_bilibili$/, '').trim() || '未知视频';
    },
    
    // 全局错误处理
    setupErrorHandling: function() {
      window.addEventListener('error', (event) => {
        console.error('捕获到错误:', event.error);
        // 可以在这里添加错误上报逻辑
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        console.error('未处理的Promise拒绝:', event.reason);
        // 可以在这里添加错误上报逻辑
      });
    }
  };
  
  // ===== 页面类型判断模块 =====
  const PageDetector = {
    // 判断是否是视频页面
    isVideoPage: function(url = window.location.href) {
      url = url.toLowerCase();
      // 更精确地匹配视频页面URL
      return Config.urls.videoPages.some(pattern => url.includes(pattern));
    },
    
    // 判断是否是首页
    isHomePage: function(url = window.location.href) {
      const urlToCheck = url.split('?')[0].toLowerCase();
      // 严格匹配首页URL
      return Config.urls.homePages.some(pattern => {
        return urlToCheck === pattern || urlToCheck === pattern.replace('www.', '');
      });
    }
  };
  
  // ===== 全屏模式模块 =====
  const FullscreenManager = {
    // 进入全屏模式
    enter: function() {
      if (State.isFullscreen) return;
      
      try {
        // 添加全屏样式
        document.body.classList.add('fullscreen-mode');
        
        // 尝试请求浏览器全屏
        const videoContainer = document.querySelector('#bilibili-player, .bpx-player-container');
        if (videoContainer && videoContainer.requestFullscreen) {
          videoContainer.requestFullscreen().catch(err => {
            console.warn('无法进入浏览器全屏模式:', err);
            // 回退到CSS全屏
            this.enterCssFullscreen();
          });
        } else {
          // 回退到CSS全屏
          this.enterCssFullscreen();
        }
        
        State.setFullscreen(true);
        console.log('已进入全屏模式');
      } catch (error) {
        console.error('进入全屏模式失败:', error);
        // 回退到CSS全屏
        this.enterCssFullscreen();
      }
    },
    
    // 使用CSS实现全屏效果
    enterCssFullscreen: function() {
      document.body.classList.add('css-fullscreen');
      document.documentElement.classList.add('focus-mode');
      
      // 隐藏非视频元素
      const videoContainer = document.querySelector('#bilibili-player, .bpx-player-container');
      if (videoContainer) {
        videoContainer.classList.add('forced-fullscreen');
      }
      
      State.setFullscreen(true);
    },
    
    // 退出全屏模式
    exit: function() {
      if (!State.isFullscreen) return;
      
      try {
        // 移除全屏样式
        document.body.classList.remove('fullscreen-mode', 'css-fullscreen');
        document.documentElement.classList.remove('focus-mode');
        
        // 如果处于浏览器全屏状态，退出
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => {
            console.warn('退出浏览器全屏模式失败:', err);
          });
        }
        
        // 移除强制全屏类
        const videoContainer = document.querySelector('#bilibili-player, .bpx-player-container');
        if (videoContainer) {
          videoContainer.classList.remove('forced-fullscreen');
        }
        
        State.setFullscreen(false);
        console.log('已退出全屏模式');
      } catch (error) {
        console.error('退出全屏模式失败:', error);
      }
    },
    
    // 切换全屏状态
    toggle: function() {
      if (State.isFullscreen) {
        this.exit();
      } else {
        this.enter();
      }
    }
  };
  
  // ===== 密码验证模块 =====
  const PasswordValidator = {
    // 开始验证流程
    startValidation: function(actionMessage = '要退出全屏模式吗？') {
      if (State.isValidating || State.isProcessing) return;
      
      State.isValidating = true;
      State.isProcessing = true;
      
      // 创建验证对话框
      this.createValidationDialog(actionMessage);
    },
    
    // 创建验证对话框
    createValidationDialog: function(actionMessage) {
      // 移除可能存在的旧对话框
      const existingDialog = document.querySelector('.password-dialog');
      if (existingDialog) {
        existingDialog.remove();
      }
      
      // 创建对话框容器
      const dialog = document.createElement('div');
      dialog.className = 'password-dialog';
      
      // 创建对话框内容
      dialog.innerHTML = `
        <div class="dialog-content">
          <h3>${actionMessage}</h3>
          <div class="reminder">${Utils.getRandomReminder()}</div>
          <input type="password" id="password-input" placeholder="请输入退出密码" />
          <div class="dialog-buttons">
            <button id="cancel-btn">取消</button>
            <button id="confirm-btn">确认</button>
          </div>
        </div>
      `;
      
      // 添加到页面
      document.body.appendChild(dialog);
      
      // 聚焦密码输入框
      const passwordInput = document.getElementById('password-input');
      passwordInput.focus();
      
      // 绑定事件
      document.getElementById('cancel-btn').addEventListener('click', this.handleCancel.bind(this));
      document.getElementById('confirm-btn').addEventListener('click', this.handleConfirm.bind(this));
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleConfirm();
        } else if (e.key === 'Escape') {
          this.handleCancel();
        }
      });
    },
    
    // 处理取消按钮点击
    handleCancel: function() {
      const dialog = document.querySelector('.password-dialog');
      if (dialog) {
        dialog.remove();
      }
      
      State.isValidating = false;
      State.isProcessing = false;
      State.isCancelled = true;
      
      // 确保全屏状态
      setTimeout(() => {
        FullscreenManager.enter();
        State.isCancelled = false;
      }, 100);
    },
    
    // 处理确认按钮点击
    handleConfirm: function() {
      const passwordInput = document.getElementById('password-input');
      const enteredPassword = passwordInput.value;
      
      if (enteredPassword === State.password) {
        // 密码正确
        const dialog = document.querySelector('.password-dialog');
        if (dialog) {
          dialog.remove();
        }
        
        State.passwordVerified = true;
        State.isExiting = true;
        
        // 退出全屏
        FullscreenManager.exit();
        
        // 重置状态
        setTimeout(() => {
          State.isValidating = false;
          State.isProcessing = false;
          State.passwordVerified = false;
          State.isExiting = false;
        }, 500);
      } else {
        // 密码错误
        passwordInput.value = '';
        passwordInput.classList.add('error');
        
        // 显示错误消息
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = '密码错误，请重试';
        
        const dialogContent = document.querySelector('.dialog-content');
        dialogContent.appendChild(errorMsg);
        
        // 移除错误样式
        setTimeout(() => {
          passwordInput.classList.remove('error');
          errorMsg.remove();
        }, 2000);
      }
    },
    
    // 重置密码和提醒语
    resetPassword: async function() {
      // 验证当前密码
      const currentPassword = prompt('请输入当前密码以进行验证:');
      if (currentPassword !== State.password) {
        alert('密码验证失败！');
        return;
      }
      
      // 设置新密码
      const newPassword = prompt('请设置新的退出全屏密码:');
      if (!newPassword) return;
      
      // 设置新的提醒语
      const reminderCount = parseInt(prompt('想要设置几句提醒话语？（建议3-5句）:')) || 3;
      const newReminders = [];
      
      for (let i = 0; i < reminderCount; i++) {
        const newReminder = prompt(`请输入第 ${i + 1} 句提醒话语:`);
        if (newReminder) {
          newReminders.push(newReminder);
        }
      }
      
      if (newReminders.length > 0) {
        // 更新状态
        State.password = newPassword;
        State.reminders = newReminders;
        
        // 保存到存储
        await Config.save({
          password: newPassword,
          reminders: newReminders
        });
        
        alert('密码和提醒语已更新！');
      }
    }
  };
  
  // ===== 事件处理模块 =====
  const EventHandler = {
    // 初始化事件处理
    init: function() {
      // 使用事件委托处理点击事件
      document.addEventListener('click', this.handleDocumentClick.bind(this));
      
      // 使用事件委托处理键盘事件
      document.addEventListener('keydown', this.handleKeyPress.bind(this));
      
      // 监听全屏变化
      document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
      
      // 监听可见性变化
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      
      // 监听右键菜单
      document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
      
      // 监听窗口失焦
      window.addEventListener('blur', this.handleWindowBlur.bind(this));
    },
    
    // 处理文档点击事件（事件委托）
    handleDocumentClick: function(e) {
      // 如果不是在视频页面，不处理
      if (!PageDetector.isVideoPage()) return;
      
      // 查找最近的链接元素
      let target = e.target;
      while (target && target !== document.body) {
        if (target.tagName === 'A' || target.hasAttribute('href') || 
            target.classList.contains('nav-link') || 
            target.classList.contains('v-popover-wrap') || 
            target.hasAttribute('data-v-navbar')) {
          
          this.handleLinkClick(e, target);
          return;
        }
        target = target.parentElement;
      }
    },
    
    // 处理链接点击
    handleLinkClick: function(e, target) {
      // 获取实际链接
      let href = target.href || target.getAttribute('href');
      
      // 处理导航栏特殊元素
      if (!href && (target.classList.contains('nav-link') || 
                   target.classList.contains('v-popover-wrap') ||
                   target.hasAttribute('data-v-navbar'))) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!State.isProcessing) {
          PasswordValidator.startValidation('要跳转到其他页面吗？');
        }
        return false;
      }
      
      if (!href) return true;

      // 检查链接类型
      const isBilibiliLink = href.includes('bilibili.com') || 
                            href.startsWith('/') || 
                            href.startsWith('#');
      
      // 如果不是在视频页面
      if (!PageDetector.isVideoPage()) {
        // 只处理首页跳转
        if (PageDetector.isHomePage(href)) {
          e.preventDefault();
          setupHomePage();
          return false;
        }
        return true;  // 允许其他所有跳转
      }

      // 在视频页面中的处理
      if (isBilibiliLink) {
        // 检查是否是视频链接
        const isVideoLink = href.includes('/video/') || 
                          href.includes('/bangumi/play/') ||
                          href.includes('/cheese/play/');

        if (isVideoLink) {
          // 视频间切换只需简单确认
          e.preventDefault();
          if (confirm('确定要跳转到其他视频吗？')) {
            window.location.href = href;
          }
          return false;
        }

        // 首页跳转
        if (PageDetector.isHomePage(href)) {
          e.preventDefault();
          setupHomePage();
          return false;
        }
        
        // 其他B站内部页面需要验证
        e.preventDefault();
        e.stopPropagation();
        if (!State.isProcessing) {
          PasswordValidator.startValidation('要跳转到其他页面吗？');
        }
        return false;
      }

      // 外部链接需要完整验证
      e.preventDefault();
      e.stopPropagation();
      if (!State.isProcessing) {
        PasswordValidator.startValidation('要跳转到外部网站吗？');
      }
      return false;
    },
    
    // 处理键盘事件
    handleKeyPress: Utils.throttle(function(e) {
      // 如果不是在视频页面，不处理
      if (!PageDetector.isVideoPage()) return;
      
      // 检查是否是重置密码快捷键
      if (e.ctrlKey && e.altKey && e.key === Config.shortcuts.RESET_PASSWORD.key) {
        e.preventDefault();
        PasswordValidator.resetPassword();
        return;
      }
      
      // 检查是否是切换全屏快捷键
      if (e.ctrlKey && e.altKey && e.key === Config.shortcuts.TOGGLE_FOCUS.key) {
        e.preventDefault();
        FullscreenManager.toggle();
        return;
      }
      
      // 检查是否是退出全屏快捷键
      if (e.key === Config.shortcuts.EXIT_FULLSCREEN.key && State.isFullscreen) {
        // 如果已经在验证中，不要重复触发
        if (State.isValidating) return;
        
        e.preventDefault();
        PasswordValidator.startValidation();
      }
    }, 300),
    
    // 处理全屏变化事件
    handleFullscreenChange: function() {
      if (!document.fullscreenElement) {
        // 如果是正常退出流程，不做处理
        if (State.passwordVerified || State.isExiting) {
          return;
        }
        
        // 如果已经在验证中，不要重复触发
        if (State.isValidating) {
          return;
        }
        
        // 开始验证流程
        PasswordValidator.startValidation();
      }
    },
    
    // 处理可见性变化事件
    handleVisibilityChange: function() {
      // 无论是隐藏还是显示，都立即恢复焦点和全屏
      if (!State.isExiting && !State.passwordVerified && PageDetector.isVideoPage()) {
        window.focus();
        setTimeout(() => {
          FullscreenManager.enter();
        }, 100);
      }
    },
    
    // 处理右键菜单事件
    handleContextMenu: function(e) {
      // 如果不是在视频页面或已经验证密码，不处理
      if (!PageDetector.isVideoPage() || State.passwordVerified) return;
      
      e.preventDefault();
      return false;
    },
    
    // 处理窗口失焦事件
    handleWindowBlur: function() {
      if (!State.isExiting && !State.passwordVerified && PageDetector.isVideoPage()) {
        window.focus();
        setTimeout(() => {
          FullscreenManager.enter();
        }, 100);
      }
    }
  };
  
  // ===== 首页优化模块 =====
  function setupHomePage() {
    // 如果不是首页，不处理
    if (!PageDetector.isHomePage()) return;
    
    console.log('应用首页优化');
    
    // 添加简洁搜索样式
    const style = document.createElement('style');
    style.setAttribute('data-plugin-style', 'home-page');
    style.textContent = `
      /* 隐藏不必要的元素 */
      .bili-header__banner, .bili-video-card__info--bottom,
      .bili-live-card__info--tit, .bili-live-card__info--uname,
      .floor-single-card, .adblock-tips, .ad-report,
      .bili-video-card__info--owner, .bili-video-card__info--date,
      .bili-bangumi-card__info--date, .bili-bangumi-card__info--owner {
        display: none !important;
      }
      
      /* 简