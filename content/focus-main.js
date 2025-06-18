// focus-main.js - 专注模式主入口文件

(function() {
  'use strict';

  async function main() {
    // 调试信息
    const DEBUG = true;
    let pageReadyState = {
      loaded: false,
      focusModeReady: false,
      utilsReady: false,
      maxRetries: 5,
      currentRetry: 0
    };
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
    function checkDependencies() {
      if (typeof ensureStylesOnce === 'function') {
        pageReadyState.utilsReady = true;
        log('工具函数已加载');
      } else {
        warn('工具函数未加载', 'utils.js可能未正确加载');
      }
      if (typeof FocusMode === 'function') {
        pageReadyState.focusModeReady = true;
        log('FocusMode类已加载');
      } else {
        warn('专注模式未初始化', 'FocusMode类未定义');
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
    function setupGlobalShortcuts() {
      document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'd' || e.key === 'D') && window.focusMode) {
          e.preventDefault();
          if (window.focusMode.settings) {
            window.focusMode.settings.filterDanmaku = !window.focusMode.settings.filterDanmaku;
            window.focusMode.applyDanmakuFilter();
            window.focusMode.saveSettings();
          }
        }
        if (e.key === 'Escape' && window.focusMode && window.focusMode.settings && 
            !window.focusMode.settings.allowExitFullscreen) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }
    function handleFullscreenChange() {
      if (window.focusMode && window.focusMode.settings && 
          window.focusMode.settings.forceFullscreen && window.focusMode.isActive) {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && !document.msFullscreenElement) {
          setTimeout(() => {
            if (window.focusMode.enterFullscreenMode) {
              window.focusMode.enterFullscreenMode();
            }
          }, 100);
        }
      }
    }
    async function initializeFocusMode() {
      try {
        const focusMode = new FocusMode();
        await focusMode.initialize();
        if (window.location.pathname.includes('/video/')) {
          const checkPlayer = setInterval(() => {
            const player = document.querySelector('#bilibili-player') || 
                          document.querySelector('.bpx-player-container');
            if (player) {
              clearInterval(checkPlayer);
              if (typeof focusMode.initializeVideoControls === 'function') {
                focusMode.initializeVideoControls(player);
              }
            }
          }, 1000);
        }
        window.focusMode = focusMode;
      } catch (err) {
        console.error('[专注模式] 初始化失败:', err);
      }
    }
    async function initBasedOnPageType() {
      const url = window.location.href;
      log('当前页面URL', url);
      if (isHomepage(url)) {
        log('检测到B站首页');
        if (typeof FocusedHomepage === 'function' && typeof FocusedHomepage.initialize === 'function') {
          log('使用FocusedHomepage.initialize()初始化首页专注模式');
          FocusedHomepage.initialize();
        } else {
          log('无法使用静态初始化方法，回退到传统初始化');
          if (!window.__focused_homepage_initialized) {
            window.__focused_homepage_initialized = true;
            if (!window.focusedHomepage) {
              window.focusedHomepage = new FocusedHomepage();
            } else if (window.focusedHomepage.init) {
              window.focusedHomepage.init(true);
            }
            log('首页专注模式已初始化');
          }
        }
      } else if (isVideoPage(url)) {
        log('检测到视频页面');
        await initializeFocusMode();
      } else if (url.includes('search.bilibili.com')) {
        log('检测到搜索页面');
        if (typeof SearchPageOptimizer === 'function') {
          window.searchOptimizer = new SearchPageOptimizer();
          log('搜索页面优化已初始化');
        }
      } else {
        log('当前页面不需要专注模式');
      }
    }
    checkDependencies();
    setupGlobalShortcuts();
    await initBasedOnPageType();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})(); 