// focus-main.js - 专注模式主入口文件

(function() {
  'use strict';

  async function main() {
    // 调试信息
    const DEBUG = true;
    function log(message, data) {
      if (DEBUG) {
        console.log(`[专注模式] ${message}`, data || '');
      }
    }
    function warn(message, data) {
      console.warn(`[专注模式警告] ${message}`, data || '');
      if (window.debugHelper && window.debugHelper.addMessage) {
        window.debugHelper.addMessage(`[测试] ${message}`, 'warning');
      }
    }
    
    // 改进：增加错误处理和模块加载功能
    function safeExecute(func, funcName, ...args) {
      try {
        return func(...args);
      } catch (err) {
        warn(`执行${funcName}失败:`, err);
        return null;
      }
    }
    
    // 改进：确保依赖加载完成
    async function ensureDependenciesLoaded() {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20; // 最多尝试20次，即10秒
        
        const checkDependencies = () => {
          attempts++;
          
          // 检查核心工具类依赖
          const isUtilsReady = typeof ensureStylesOnce === 'function' && 
                              typeof StorageUtils === 'function' && 
                              typeof UIUtils === 'function' && 
                              typeof robustSelector === 'function' &&
                              typeof PageEnhancer === 'function'; // 添加对PageEnhancer的检查
                              
          // 检查核心功能类依赖                    
          const isFocusReady = typeof FocusMode === 'function' &&
                              typeof FocusSettingsManager === 'function' &&
                              typeof FirstTimeSetup === 'function' &&
                              typeof ExitHandler === 'function';
          
          // 检查搜索优化器类
          // 注意：不再阻止初始化，搜索优化器将作为可选功能
          const isSearchReady = typeof SearchPageOptimizer === 'function';
          
          // 记录依赖状态
          if (attempts % 5 === 0 || attempts === maxAttempts) {
            log(`依赖检查状态 (${attempts}/${maxAttempts}):`, {
              utils: isUtilsReady, 
              focus: isFocusReady, 
              search: isSearchReady
            });
          }
          
          if (isUtilsReady && isFocusReady) {
            log('所有核心依赖已加载');
            if (!isSearchReady) {
              warn('SearchPageOptimizer未加载，但不阻止继续初始化');
            }
            resolve({
              success: true,
              utils: isUtilsReady,
              focus: isFocusReady,
              search: isSearchReady
            });
          } else if (attempts >= maxAttempts) {
            warn('依赖加载超时，尝试继续初始化');
            resolve({
              success: false,
              utils: isUtilsReady,
              focus: isFocusReady,
              search: isSearchReady
            });
          } else {
            log(`等待依赖加载... (${attempts}/${maxAttempts})`);
            setTimeout(checkDependencies, 500);
          }
        };
        
        checkDependencies();
      });
    }
    
    // 改进：添加全局的首次设置检查函数
    async function checkFirstTimeSetup() {
      try {
        // 确保设置管理器可用
        if (typeof FocusSettingsManager !== 'function') {
          warn('设置管理器未加载，无法检查首次设置');
          return false;
        }
        
        // 初始化设置管理器
        const settingsManager = new FocusSettingsManager();
        await settingsManager.initialize();
        
        // 检查是否是首次使用
        const settings = await settingsManager.getSettings();
        
        if (settings.isFirstTime && typeof FirstTimeSetup === 'function') {
          log('检测到首次使用，显示设置向导');
          try {
            const firstTimeSetup = new FirstTimeSetup(settingsManager);
            await firstTimeSetup.showSetup();
            return true;
          } catch (setupErr) {
            warn('显示首次设置向导失败:', setupErr);
            return false;
          }
        }
        
        return false;
      } catch (err) {
        warn('检查首次设置失败:', err);
        return false;
      }
    }
    
    function isHomepage(url) {
      return url === 'https://www.bilibili.com/' || 
             url === 'https://www.bilibili.com/index.html' ||
             url === 'https://bilibili.com/' ||
             url === 'https://bilibili.com/index.html' ||
             url.match(/^https?:\/\/(www\.)?bilibili\.com\/?(\?.*)?$/);
    }
    
    function isVideoPage(url) {
      return url.includes('/video/') || 
             url.includes('/bangumi/play/') ||
             url.includes('/cheese/play/');
    }
    
    // 改进：设置全局快捷键，但不处理全屏变化(已由FocusMode管理)
    function setupGlobalShortcuts() {
      try {
      document.addEventListener('keydown', (e) => {
        // 仅在已初始化的情况下处理弹幕快捷键
        if (e.altKey && (e.key === 'd' || e.key === 'D') && 
            window.focusMode && window.focusMode.initialized) {
          e.preventDefault();
          if (window.focusMode.settings) {
            window.focusMode.settings.filterDanmaku = !window.focusMode.settings.filterDanmaku;
            window.focusMode.applyDanmakuFilter();
            window.focusMode.saveSettings();
          }
        }
        
        // ESC键处理也由FocusMode的fullscreenChangeHandler负责
        // 此处移除重复的ESC键处理
      });
        log('全局快捷键设置成功');
      } catch (err) {
        warn('设置全局快捷键失败:', err);
      }
    }
    
    // 新增：页面UI增强处理
    function enhancePageUI() {
      try {
        // 检查PageEnhancer是否可用
        if (typeof PageEnhancer !== 'function') {
          warn('PageEnhancer未加载，无法进行页面UI增强');
          return false;
        }
        
        // 处理导航栏，只保留首页可点击
        try {
          PageEnhancer.processNavBar();
          log('导航栏处理成功');
        } catch (navErr) {
          warn('处理导航栏时出错:', navErr);
        }
        
        // 隐藏搜索框热榜
        try {
          PageEnhancer.hideSearchHotList();
          log('搜索热榜隐藏成功');
        } catch (searchErr) {
          warn('隐藏搜索热榜时出错:', searchErr);
        }
        
        log('页面UI增强功能已应用');
        return true;
      } catch (err) {
        warn('应用页面UI增强功能时出错:', err);
        return false;
      }
    }
    
    // 增强：初始化视频专注模式
    async function initializeVideoFocus() {
      try {
        console.log('[专注模式] 开始初始化视频专注模式');
        
        // 检查FocusMode类是否可用
        if (typeof FocusMode !== 'function') {
          console.warn('[专注模式] FocusMode类不可用，尝试动态加载');
          // 尝试动态加载FocusMode脚本
          const loadResult = await loadFocusModeScript();
          if (!loadResult) {
            console.error('[专注模式] 无法加载FocusMode，使用降级方案');
            // 使用降级方案，尝试手动进入全屏模式
            tryFallbackFullscreen();
            return false;
          }
        }
        
        // 创建并初始化专注模式实例
        if (!window.focusMode) {
          try {
            window.focusMode = new FocusMode();
            console.log('[专注模式] 创建FocusMode实例');
          } catch (instanceErr) {
            console.error('[专注模式] 创建FocusMode实例失败:', instanceErr);
            tryFallbackFullscreen();
            return false;
          }
        }
        
        // 使用统一的初始化方法
        try {
          await window.focusMode.initialize();
          console.log('[专注模式] 视频专注模式初始化完成');
        } catch (initErr) {
          console.error('[专注模式] 视频专注模式初始化失败:', initErr);
          // 即使初始化失败，也尝试执行全屏
          tryFullscreenWithRetry();
          return false;
        }
        
        // 无论如何先尝试全屏 - 不再等待视频加载
        console.log('[专注模式] 立即尝试全屏，不等待视频加载');
        if (typeof window.focusMode.autoActivateFullscreen === 'function') {
          window.focusMode.autoActivateFullscreen();
        } else {
          console.error('[专注模式] autoActivateFullscreen方法不存在，尝试使用enterFullscreenMode');
          if (typeof window.focusMode.enterFullscreenMode === 'function') {
            window.focusMode.enterFullscreenMode();
          } else {
            console.error('[专注模式] enterFullscreenMode方法不存在，使用降级方案');
            tryFallbackFullscreen();
          }
        }
        
        // 初始化合集侧边栏 - 确保正确调用
        try {
          console.log('[专注模式] 尝试初始化合集侧边栏');
          await initializeCollectionSidebar();
        } catch (err) {
          console.error('[专注模式] 初始化合集侧边栏失败:', err);
        }
        
        // 设置全屏状态监视器 - 确保全屏能被正确维持
        let fullscreenMonitorActive = false;
        
        const setupFullscreenMonitor = () => {
          if (fullscreenMonitorActive) return;
          
          fullscreenMonitorActive = true;
          console.log('[专注模式] 启动全屏状态监视器');
          
          // 定期检查全屏状态（每5秒）
          const monitorInterval = setInterval(() => {
            if (window.focusMode && window.focusMode.settings.autoActivate && 
                !window.focusMode.checkFullscreenState() && 
                window.focusMode.isActive) {
              console.log('[专注模式] 监视器检测到已退出全屏，尝试恢复');
              window.focusMode.autoActivateFullscreen();
            }
          }, 5000);
          
          // 30分钟后清除监视器，避免长时间消耗资源
          setTimeout(() => {
            clearInterval(monitorInterval);
            fullscreenMonitorActive = false;
            console.log('[专注模式] 全屏状态监视器已停止');
          }, 30 * 60 * 1000);
        };
        
        // 增强的视频加载监听 - 添加更多事件和DOM变化观察
        const waitForVideo = () => {
          const videoElement = document.querySelector('video');
          if (videoElement) {
            console.log('[专注模式] 找到视频元素，设置加载监听器');
            
            // 创建监听器数组，方便统一管理
            const videoEventHandlers = [];
            
            // 若视频已加载，直接触发自动全屏
            if (videoElement.readyState >= 2) {
              console.log('[专注模式] 视频已预加载，尝试自动全屏');
              window.focusMode.autoActivateFullscreen();
              setupFullscreenMonitor();
            }
            
            // 监听更多视频事件
            const videoEvents = ['canplay', 'loadeddata', 'loadedmetadata', 'play', 'playing'];
            
            videoEvents.forEach(eventName => {
              const handler = () => {
                console.log(`[专注模式] 视频事件 "${eventName}" 触发，尝试自动全屏`);
                window.focusMode.autoActivateFullscreen();
                setupFullscreenMonitor();
                
                // 首次触发后移除该事件监听
                videoElement.removeEventListener(eventName, handler);
                
                // 从数组中移除该处理器
                const index = videoEventHandlers.indexOf(handler);
                if (index > -1) videoEventHandlers.splice(index, 1);
              };
              
              videoElement.addEventListener(eventName, handler);
              videoEventHandlers.push(handler);
            });
            
            // 监听时间更新 - 确保视频播放过程中也能检查全屏状态
            const timeUpdateHandler = () => {
              // 只在视频播放一段时间后检查一次
              if (videoElement.currentTime > 3 && videoEventHandlers.length > 0) {
                console.log('[专注模式] 视频已播放3秒，确保全屏状态');
                if (window.focusMode.settings.autoActivate && !window.focusMode.checkFullscreenState()) {
                  window.focusMode.autoActivateFullscreen();
                  setupFullscreenMonitor();
                }
                
                // 移除所有剩余的事件处理器
                videoEvents.forEach((eventName, index) => {
                  if (index < videoEventHandlers.length) {
                    videoElement.removeEventListener(eventName, videoEventHandlers[index]);
                  }
                });
                videoEventHandlers.length = 0;
                
                // 移除timeupdate处理器
                videoElement.removeEventListener('timeupdate', timeUpdateHandler);
              }
            };
            
            videoElement.addEventListener('timeupdate', timeUpdateHandler);
            
            return true;
          } else {
            console.log('[专注模式] 视频元素尚未加载，等待后再次检查');
            setTimeout(waitForVideo, 1000);
            return false;
          }
        };
        
        // 开始监听视频元素
        waitForVideo();
        
        // 监听DOM变化，检测视频播放器的动态添加
        const observeDOM = () => {
          // 创建DOM观察器
          const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
              // 检查是否有新添加的节点
              if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                // 检查新添加的节点是否包含视频元素
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                  const node = mutation.addedNodes[i];
                  if (node.nodeType === 1) { // 元素节点
                    if (node.tagName === 'VIDEO') {
                      console.log('[专注模式] 检测到新的视频元素被添加，尝试自动全屏');
                      window.focusMode.autoActivateFullscreen();
                      setupFullscreenMonitor();
                      break;
                    } else if (node.querySelector('video')) {
                      console.log('[专注模式] 检测到包含视频的容器被添加，尝试自动全屏');
                      window.focusMode.autoActivateFullscreen();
                      setupFullscreenMonitor();
                      break;
                    }
                  }
                }
              }
            });
          });
          
          // 开始观察整个文档
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
          
          // 存储观察器以便清理
          window.focusMode._domObserver = observer;
          
          console.log('[专注模式] DOM变化观察器已启动');
        };
        
        // 启动DOM观察器
        observeDOM();
        
        // 添加全屏变化监听 - 改进的全屏变化检测
        const fullscreenChangeHandler = () => {
          if (!document.fullscreenElement && 
              window.focusMode && 
              window.focusMode.settings.autoActivate && 
              window.focusMode.isActive) {
            console.log('[专注模式] 检测到退出全屏，尝试重新进入');
            // 使用延迟确保能重新进入全屏
            setTimeout(() => window.focusMode.autoActivateFullscreen(), 300);
          }
        };
        
        // 添加全屏变化监听
        document.addEventListener('fullscreenchange', fullscreenChangeHandler);
        document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
        document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
        document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
        
        return true;
      } catch (err) {
        console.error('[专注模式] 初始化视频专注模式失败:', err);
        console.error('[专注模式] 错误详情:', {
          message: err.message,
          stack: err.stack,
          FocusMode可用: typeof FocusMode === 'function',
          focusMode实例: Boolean(window.focusMode),
          视频元素: Boolean(document.querySelector('video'))
        });
        
        // 无论如何都尝试使用降级方案
        tryFullscreenWithRetry();
        return false;
      }
    }
    
    // 检查是否存在FocusedHomepage类
    function checkFocusedHomepageAvailability() {
      return typeof window.FocusedHomepage === 'function';
    }

    function isSearchPage(url) {
      return url.includes('search.bilibili.com');
    }

    // 改进：尝试加载或初始化FocusedHomepage
    async function initializeFocusedHomepage(isSearchPage = false) {
      try {
      // 首先检查类是否已经存在
      if (checkFocusedHomepageAvailability()) {
        log('FocusedHomepage类已加载');
          // 添加实际初始化代码
          if (!window.focusedHomepage) {
            window.focusedHomepage = new window.FocusedHomepage();
            log('创建FocusedHomepage实例');
          }
          
          // 根据页面类型执行不同的初始化
          if (isSearchPage) {
            if (typeof window.focusedHomepage.initializeSearchOptimizer === 'function') {
              await window.focusedHomepage.initializeSearchOptimizer();
              window.__focused_search_initialized = true;
              log('FocusedHomepage搜索优化功能成功初始化');
              return true;
            } else {
              warn('FocusedHomepage缺少initializeSearchOptimizer方法');
              return false;
            }
          } else {
            if (typeof window.focusedHomepage.init === 'function') {
              window.focusedHomepage.init(true);
              window.__focused_homepage_initialized = true;
              log('FocusedHomepage成功初始化');
              return true;
            } else {
              warn('FocusedHomepage缺少init方法');
              return false;
            }
          }
      } else {
        // 类不存在，尝试手动加载脚本
          log('尝试手动加载FocusedHomepage脚本');
          await loadFocusedHomepageScript();
          
          // 再次检查类是否加载成功
          if (checkFocusedHomepageAvailability()) {
            log('手动加载FocusedHomepage成功');
            if (!window.focusedHomepage) {
              window.focusedHomepage = new window.FocusedHomepage();
            }
            
            // 根据页面类型执行不同的初始化
            if (isSearchPage) {
              if (typeof window.focusedHomepage.initializeSearchOptimizer === 'function') {
                await window.focusedHomepage.initializeSearchOptimizer();
                window.__focused_search_initialized = true;
                log('FocusedHomepage搜索优化功能成功初始化');
                return true;
              } else {
                warn('加载的FocusedHomepage缺少initializeSearchOptimizer方法');
                return false;
              }
            } else {
            if (typeof window.focusedHomepage.init === 'function') {
              window.focusedHomepage.init(true);
              window.__focused_homepage_initialized = true;
                return true;
              } else {
                warn('加载的FocusedHomepage缺少init方法');
                return false;
              }
            }
          } else {
            warn('即使手动加载后FocusedHomepage类仍不可用');
            return false;
          }
        }
      } catch (err) {
        warn('初始化FocusedHomepage失败:', err);
        return false;
      }
    }
    
    // 改进：根据页面类型初始化不同功能
    async function initBasedOnPageType() {
      const url = window.location.href;
      
      // 检查是否是首次使用，如果是则显示设置向导
      const isFirstTime = await checkFirstTimeSetup();
      if (isFirstTime) {
        log('已完成首次设置向导');
      }
      
      // 应用全局页面UI增强功能（导航栏优化、热榜隐藏）
      enhancePageUI();
      
      // 视频页面处理
      if (isVideoPage(url)) {
        log('检测到视频页面，初始化专注模式');
        await initializeVideoFocus();
        return;
      }
      
      // 搜索页面处理
      if (isSearchPage(url)) {
        log('检测到搜索页面，初始化搜索优化');
        initializeSearchOptimizer();
        return;
      }
      
      // 首页处理
      if (isHomepage(url)) {
        log('检测到首页，初始化专注首页');
          await initializeFocusedHomepage();
        return;
      }
      
      log('当前页面不需要特殊处理');
    }
    
    // 加载主要功能
    log('专注模式开始加载 - ' + new Date().toISOString());
    
    // 优先设置全局快捷键
    setupGlobalShortcuts();
    
    // 先等待依赖加载
    const dependencyStatus = await ensureDependenciesLoaded();
    
    if (dependencyStatus.success) {
      log('依赖已加载，初始化功能');
    await initBasedOnPageType();
    } else {
      warn('部分依赖加载失败，使用备用方案初始化');
      // 尝试加载最基本的功能
      if (isVideoPage(window.location.href)) {
        await initializeVideoFocus();
      }
    }
  }
  
  // 根据文档加载状态执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  function loadFocusedHomepageScript() {
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        
        // 尝试使用chrome.runtime.getURL
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          script.src = chrome.runtime.getURL('content/focused-homepage.js');
        } else {
          // 备用方式：相对路径
          script.src = 'content/focused-homepage.js';
          console.warn('[专注模式] 使用备用路径加载FocusedHomepage');
        }
        
        // 添加超时处理
        let timeoutId = setTimeout(() => {
          console.warn('[专注模式] 加载FocusedHomepage脚本超时');
          script.onload = script.onerror = null;
          reject(new Error('加载脚本超时'));
        }, 5000);
        
        script.onload = () => {
          clearTimeout(timeoutId);
          console.log('[专注模式] 手动加载FocusedHomepage脚本成功');
          resolve(true);
        };
        
        script.onerror = (err) => {
          clearTimeout(timeoutId);
          console.warn('[专注模式] 手动加载FocusedHomepage脚本失败', err);
          reject(err);
        };
        
        document.head.appendChild(script);
      } catch (err) {
        reject(err);
      }
    });
  }

  function loadFocusModeScript() {
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        
        // 尝试使用chrome.runtime.getURL
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          script.src = chrome.runtime.getURL('content/focus-mode.js');
        } else {
          // 备用方式：相对路径
          script.src = 'content/focus-mode.js';
          console.warn('[专注模式] 使用备用路径加载FocusMode');
        }
        
        // 添加超时处理
        let timeoutId = setTimeout(() => {
          console.warn('[专注模式] 加载FocusMode脚本超时');
          script.onload = script.onerror = null;
          reject(new Error('加载脚本超时'));
        }, 5000);
        
        script.onload = () => {
          clearTimeout(timeoutId);
          console.log('[专注模式] 手动加载FocusMode脚本成功');
          resolve(true);
        };
        
        script.onerror = (err) => {
          clearTimeout(timeoutId);
          console.warn('[专注模式] 手动加载FocusMode脚本失败', err);
          reject(err);
        };
        
        document.head.appendChild(script);
      } catch (err) {
        reject(err);
      }
    });
  }

  // 添加降级全屏功能
  function tryFallbackFullscreen() {
    console.log('[专注模式] 使用降级方案尝试进入全屏');
    try {
      // 查找视频元素
      const videoElement = document.querySelector('video');
      if (videoElement) {
        // 尝试使用原生全屏API
        if (videoElement.requestFullscreen) {
          videoElement.requestFullscreen();
        } else if (videoElement.webkitRequestFullscreen) {
          videoElement.webkitRequestFullscreen();
        } else if (videoElement.mozRequestFullScreen) {
          videoElement.mozRequestFullScreen();
        } else if (videoElement.msRequestFullscreen) {
          videoElement.msRequestFullscreen();
        }
        console.log('[专注模式] 已尝试使用原生API进入全屏模式');
        return true;
      } else {
        // 找不到视频元素，尝试查找播放器容器
        const playerContainer = document.querySelector('#bilibili-player') || 
                                document.querySelector('.bpx-player-container') || 
                                document.querySelector('.player-wrapper');
        
        if (playerContainer) {
          if (playerContainer.requestFullscreen) {
            playerContainer.requestFullscreen();
          } else if (playerContainer.webkitRequestFullscreen) {
            playerContainer.webkitRequestFullscreen();
          } else if (playerContainer.mozRequestFullScreen) {
            playerContainer.mozRequestFullScreen();
          } else if (playerContainer.msRequestFullscreen) {
            playerContainer.msRequestFullscreen();
          }
          console.log('[专注模式] 已尝试对播放器容器使用原生API进入全屏模式');
          return true;
        }
      }
      console.warn('[专注模式] 无法找到视频元素或播放器容器，全屏失败');
      return false;
    } catch (err) {
      console.error('[专注模式] 降级全屏方案执行失败:', err);
      return false;
    }
  }

  // 添加带重试的全屏尝试功能
  function tryFullscreenWithRetry() {
    console.log('[专注模式] 带重试的全屏尝试开始');
    let attempts = 0;
    const maxAttempts = 3;
    
    const tryFullscreen = () => {
      attempts++;
      console.log(`[专注模式] 全屏尝试 ${attempts}/${maxAttempts}`);
      
      // 首先尝试使用focusMode对象
      if (window.focusMode) {
        try {
          if (typeof window.focusMode.autoActivateFullscreen === 'function') {
            window.focusMode.autoActivateFullscreen();
            return true;
          } else if (typeof window.focusMode.enterFullscreenMode === 'function') {
            window.focusMode.enterFullscreenMode();
            return true;
          }
        } catch (err) {
          console.warn('[专注模式] 使用focusMode进入全屏失败:', err);
        }
      }
      
      // 降级方案
      return tryFallbackFullscreen();
    };
    
    // 立即尝试一次
    const success = tryFullscreen();
    
    // 如果失败，则设置延迟重试
    if (!success && attempts < maxAttempts) {
      setTimeout(() => {
        tryFullscreen();
        
        // 如果还是失败，再试最后一次
        if (attempts < maxAttempts) {
          setTimeout(tryFullscreen, 2000);
        }
      }, 1000);
    }
    
    return success;
  }
})(); 