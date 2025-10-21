/**
 * 首页专注搜索类
 * 替换B站首页为专注学习界面，提供简洁的搜索和合集管理
 * 增强功能：同时优化搜索页面体验
 */
(function() {
  'use strict';
  
  // 安全的日志函数
const safeLog = (module, message, level = 'info', data = '') => {
  if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
    Logger.log(module, message, level, data);
  } else {
    console.log(`[${module}] ${message}`, data);
  }
};

safeLog('页面优化', 'focused-homepage.js 开始加载 - ' + new Date().toISOString());
  window.FOCUSED_HOMEPAGE_LOADED = true; // 设置一个全局标记
  
  safeLog('页面优化', 'focused-homepage.js 已加载');
  
  // 立即执行的自调用函数，在document_start阶段立即拦截
  const immediateInitializer = function() {
    // 只在首页执行
    if (!isHomepage()) return;
    
    console.log('[专注模式] 即时拦截B站首页加载');
    
    // 检查关键依赖
    const checkDependencies = () => {
      if (typeof window.StorageUtils === 'undefined' || typeof window.UIUtils === 'undefined') {
        console.log('[专注模式] 等待依赖加载...');
        setTimeout(checkDependencies, 50);
        return;
      }
      
      // 依赖已加载，继续初始化
      console.log('[专注模式] 依赖已加载，继续初始化');
      
      // 在最早期阻止页面渲染原始内容
      blockOriginalContent();
      
      // 阻止所有非必要的资源加载
      setupResourceBlocker();
      
      // 设置DOM变更监控，防止B站重新渲染
      setupMutationGuard();
      
      // 优化: 添加强制渲染专注模式界面
      forceRenderFocusedInterface();
    };
    
    // 开始检查依赖
    checkDependencies();
  }();
  
  // 检查当前URL是否是B站首页
  function isHomepage() {
    const url = window.location.href;
    return url === 'https://www.bilibili.com/' || 
           url === 'https://www.bilibili.com/index.html' ||
           url === 'https://bilibili.com/' ||
           url === 'https://bilibili.com/index.html' ||
           url.match(/^https?:\/\/(www\.)?bilibili\.com\/?(\?.*)?$/);
  }
  
  // 立即阻止原始内容渲染
  function blockOriginalContent() {
    // 创建并立即插入阻止样式
    const style = document.createElement('style');
    style.id = 'focused-homepage-blocker';
    style.textContent = `
      /* 隐藏所有非关键元素 */
      html > body > *:not(#focused-placeholder):not(.focused-homepage-container):not(.dialog-overlay):not(style):not(script) {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        height: 0 !important;
        max-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        outline: none !important;
        overflow: hidden !important;
      }
      
      /* 强制使用纯白背景，防止闪烁 */
      html, body {
        background-color: #f6f7f8 !important;
        min-height: 100vh !important;
        overflow-x: hidden !important;
      }
      
      /* 确保我们的内容会显示 */
      .focused-homepage-container {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        min-height: 100vh !important;
      }
      
      /* 提高CSS优先级，防止被B站样式覆盖 */
      #biliMainHeader, #internationalHeader, .bili-header, .international-header, 
      .bili-header__bar, .channel-nav {
        display: none !important;
        height: 0 !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `;
    
    // 添加viewport meta标签，解决移动设备上的显示问题
    ensureViewportMeta();
    
    // 在document_start阶段，document可能还未完全解析
    // 通过以下方法确保样式尽早应用，甚至在<head>生成前
    if (document.head) {
      document.head.appendChild(style);
    } else {
      // 如果head尚未创建，直接添加到documentElement
      document.documentElement.appendChild(style);
      
      // 添加监听，确保移动到head当head可用时
      const headObserver = new MutationObserver(() => {
        if (document.head && document.documentElement.contains(style)) {
          document.head.appendChild(style);
          headObserver.disconnect();
        }
      });
      
      headObserver.observe(document.documentElement, { childList: true });
    }
    
    // 创建占位符
    if (document.body) {
      setupFocusedPlaceholder();
    } else {
      // 等待body创建再设置占位符
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          setupFocusedPlaceholder();
          bodyObserver.disconnect();
        }
      });
      
      bodyObserver.observe(document.documentElement, { childList: true });
    }
  }
  
  // 确保viewport meta标签存在
  function ensureViewportMeta() {
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0';
      
      if (document.head) {
        document.head.appendChild(viewport);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.head.appendChild(viewport);
        });
      }
    }
  }
  
  // 设置占位符，防止闪屏和提早准备容器
  function setupFocusedPlaceholder() {
    if (document.querySelector('#focused-placeholder')) return;
    
    const placeholder = document.createElement('div');
    placeholder.id = 'focused-placeholder';
    placeholder.setAttribute('title', '专注模式加载中');  // 添加title属性，提高可访问性
    placeholder.setAttribute('role', 'status');           // 添加ARIA角色，提高可访问性
    placeholder.setAttribute('aria-live', 'polite');      // 添加ARIA属性，提高可访问性
    placeholder.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: #f6f7f8;
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 添加加载指示
    placeholder.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 18px; color: #00a1d6; margin-bottom: 10px;">专注学习模式启动中...</div>
        <div style="width: 40px; height: 40px; border: 3px solid #e5e9ef; border-top-color: #00a1d6; border-radius: 50%; margin: 0 auto; animation: focused-spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes focused-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(placeholder);
    
    // 清除所有已有内容
    clearExistingContent();
  }
  
  // 阻止资源加载
  function setupResourceBlocker() {
    // 覆盖fetch API
    if (window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = function(resource, init) {
        const url = resource instanceof Request ? resource.url : resource;
        
        // 阻止的资源类型
        if (typeof url === 'string') {
          // B站首页相关API请求和非必要资源
          const blockPatterns = [
            // 首页内容相关
            /\/x\/web-interface\/index/i,
            /\/x\/web-interface\/popular/i,
            /\/x\/web-interface\/ranking/i,
            /\/x\/web-interface\/banner/i,
            /\/x\/web-show\//i,
            // 推荐和广告
            /\/x\/web-interface\/wbi\/index\/top\/feed\/rcmd/i,
            /\/x\/web-interface\/adweb/i,
            /\/bfs\/static\/.+\.js/i,
            // 其他大型资源
            /\.chunk\.js$/i,
            /\/js\/vendor\./i
          ];
          
          // 允许的关键资源
          const allowedPatterns = [
            // 登录相关
            /passport\.bilibili\.com/i,
            /\/x\/web-interface\/nav/i,
            // 搜索相关
            /\/x\/web-interface\/search/i,
            /\/x\/web-interface\/wbi\/search/i,
            // 基础样式资源
            /\.(css|woff|woff2|ttf|svg)$/i
          ];
          
          // 检查是否为允许的资源
          const isAllowed = allowedPatterns.some(pattern => pattern.test(url));
          
          // 检查是否为需要阻止的资源
          const shouldBlock = blockPatterns.some(pattern => pattern.test(url));
          
          if (shouldBlock && !isAllowed) {
            console.log('[专注模式] 拦截资源请求:', url);
            // 返回空数据
            return Promise.resolve(new Response(JSON.stringify({code: 0, data: {}}), {
              status: 200,
              headers: {'Content-Type': 'application/json'}
            }));
          }
        }
        
        // 允许其他请求通过
        return originalFetch.apply(this, arguments);
      };
    }
    
    // 覆盖XMLHttpRequest
    if (window.XMLHttpRequest) {
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._focusedUrl = url;
        return originalOpen.apply(this, arguments);
      };
      
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function(body) {
        if (this._focusedUrl && typeof this._focusedUrl === 'string') {
          // 使用与fetch相同的逻辑
          const blockPatterns = [
            /\/x\/web-interface\/index/i,
            /\/x\/web-interface\/popular/i,
            /\/x\/web-interface\/ranking/i,
            /\/x\/web-interface\/banner/i,
            /\/x\/web-show\//i,
            /\/x\/web-interface\/wbi\/index\/top\/feed\/rcmd/i,
            /\/x\/web-interface\/adweb/i
          ];
          
          const shouldBlock = blockPatterns.some(pattern => pattern.test(this._focusedUrl));
          
          if (shouldBlock) {
            console.log('[专注模式] 拦截XHR请求:', this._focusedUrl);
            
            // 模拟回应
            Object.defineProperty(this, 'readyState', {value: 4, writable: true});
            Object.defineProperty(this, 'status', {value: 200, writable: true});
            Object.defineProperty(this, 'responseText', {value: JSON.stringify({code: 0, data: {}}), writable: true});
            
            // 触发onload事件
            setTimeout(() => {
              const readyStateEvent = new Event('readystatechange');
              this.dispatchEvent(readyStateEvent);
              
              const loadEvent = new Event('load');
              this.dispatchEvent(loadEvent);
              
              if (typeof this.onreadystatechange === 'function') {
                this.onreadystatechange(readyStateEvent);
              }
              
              if (typeof this.onload === 'function') {
                this.onload(loadEvent);
              }
            }, 0);
            
            return;
          }
        }
        
        return originalSend.apply(this, arguments);
      };
    }
    
    // 如果浏览器支持，拦截脚本加载
    if (window.HTMLScriptElement && HTMLScriptElement.prototype) {
      // 保存原始setter
      const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')?.set;
      
      if (originalSrcSetter) {
        // 重新定义src属性
        Object.defineProperty(HTMLScriptElement.prototype, 'src', {
          set: function(url) {
            // 检查是否为B站首页相关脚本
            if (typeof url === 'string' && (
                url.includes('home_') || 
                url.includes('index_') || 
                url.includes('main_') || 
                url.includes('vendor_') ||
                url.includes('runtime_')
              ) && !url.includes('search_')) {
              
              console.log('[专注模式] 拦截脚本:', url);
              // 替换为空白脚本
              return originalSrcSetter.call(this, 'data:text/javascript,console.log("[专注模式] 已拦截脚本")');
            }
            
            // 对其他脚本正常处理
            return originalSrcSetter.call(this, url);
          },
          configurable: true
        });
      }
    }
  }
  
  // 设置DOM变更保护，防止B站重新渲染首页
  function setupMutationGuard() {
    if (!window.MutationObserver) return;
    
    // 🎯 安全检查：只在首页执行
    if (!isHomepage()) {
      console.log('[专注模式] 非首页，跳过MutationGuard设置');
      return;
    }
    
    const guard = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // 检查新添加的节点是否包含B站首页内容
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            
            // 如果是B站首页相关元素，立即移除
            const element = node;
            if (
              (element.id && (element.id === 'app' || element.id === 'i_cecream')) ||
              (element.classList && (
                element.classList.contains('bili-feed') ||
                element.classList.contains('bili-layout') ||
                element.classList.contains('bili-video-card') ||
                element.classList.contains('feed-card') ||
                element.classList.contains('bili-banner')
              ))
            ) {
              if (element.parentNode) {
                console.log('[专注模式] 阻止B站动态渲染元素:', element.id || element.className);
                element.parentNode.removeChild(element);
              }
            }
          }
        }
      }
    });
    
    // 立即开始观察
    if (document.body) {
      guard.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        guard.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
  
  // 彻底清除现有内容
  function clearExistingContent() {
    if (!document.body) return;
    
    // 保留我们的元素
    const ourElements = [];
    
    // 保留debug面板和我们自己的样式/脚本
    ['#focused-placeholder', '.focused-homepage-container', '.bili-focus-debug-panel', '#focused-homepage-blocker'].forEach(selector => {
      const el = document.querySelector(selector);
      if (el) ourElements.push(el);
    });
    
    // 保留所有样式和脚本标签
    document.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => {
      ourElements.push(el);
    });
    
    // 清空body中的所有内容
    const nodesToRemove = [];
    for (let i = 0; i < document.body.children.length; i++) {
      const child = document.body.children[i];
      if (!ourElements.includes(child)) {
        nodesToRemove.push(child);
      }
    }
    
    // 移除非我们的元素
    nodesToRemove.forEach(node => {
      try {
        document.body.removeChild(node);
      } catch (e) {
        console.warn('[专注模式] 移除节点失败:', e);
      }
    });
  }
  
  // FocusedHomepage类处理专注界面创建和管理
  class FocusedHomepage {
    /**
     * 静态初始化方法 - 在页面加载最早阶段执行
     * 检查是否是首页并立即拦截
     */
    static initialize() {
      // 检查是否是首页
      if (FocusedHomepage.isHomepage()) {
        safeLog('页面优化', '检测到B站首页，准备拦截');
        
        // 立即添加样式隐藏原始内容，最大程度避免闪烁
        FocusedHomepage.addEarlyStyles();
        
        // 阻止非必要资源加载
        FocusedHomepage.interceptNetworkRequests();
        
        // 清空现有页面内容，防止原始首页渲染
        FocusedHomepage.clearExistingContent();
        
        // 创建实例
        if (!window.focusedHomepage) {
          window.focusedHomepage = new FocusedHomepage();
        }
        
        return true;
      }
      
      // 检查是否是搜索页面
      if (FocusedHomepage.isSearchPage()) {
        safeLog('页面优化', '检测到B站搜索页面，准备优化');
        
        // 创建实例并初始化搜索页面优化
        if (!window.focusedHomepage) {
          window.focusedHomepage = new FocusedHomepage();
          window.focusedHomepage.initializeSearchOptimizer();
        }
        
        return true;
      }
      
      // 为所有页面添加URL变化监听，确保在从其他页面返回首页或搜索页时能够触发拦截
      FocusedHomepage.setupNavigationMonitor();
      
      return false;
    }
    
    /**
     * 检查当前URL是否是B站首页
     * @returns {boolean} 是否是首页
     */
    static isHomepage() {
      const url = window.location.href;
      return url === 'https://www.bilibili.com/' || 
             url === 'https://www.bilibili.com/index.html' ||
             url === 'https://bilibili.com/' ||
             url === 'https://bilibili.com/index.html' ||
             url.match(/^https?:\/\/(www\.)?bilibili\.com\/?(\?.*)?$/);
    }
    
    /**
     * 检查当前URL是否是B站搜索页面
     * @returns {boolean} 是否是搜索页面
     */
    static isSearchPage() {
      return window.location.href.includes('search.bilibili.com');
    }
    
    /**
     * 拦截网络请求，阻止加载非必要资源
     * 减少性能消耗，加快专注界面加载速度
     */
    static interceptNetworkRequests() {
      // 仅在document_start阶段执行此操作
      if (document.readyState !== 'loading') return;
      
      try {
        // 使用Fetch API拦截
        const originalFetch = window.fetch;
        window.fetch = function(resource, init) {
          // 如果是首页请求且不是必要资源，则阻止
          if (typeof resource === 'string') {
            // 允许加载的关键资源
            const allowedPatterns = [
              // 必要的功能性API
              /\/x\/web-interface\/nav/,
              /\/x\/web-interface\/wbi\/search/,
              // 登录相关API
              /passport\.bilibili\.com/,
              // 我们自己的资源或样式资源
              /\.(css|woff|woff2|ttf)$/i
            ];
            
            // 检查是否是允许的资源
            const isAllowed = allowedPatterns.some(pattern => pattern.test(resource));
            
            // 阻止不必要的首页资源
            if (!isAllowed && (
              resource.includes('/x/web-interface/index') || 
              resource.includes('/x/web-show/res/loc') ||
              resource.includes('/x/web-interface/ranking') ||
              resource.includes('/x/web-interface/popular') ||
              resource.includes('/x/web-interface/banner')
            )) {
              console.log('[专注模式] 拦截请求:', resource);
              // 返回空数据的Promise，模拟请求成功但不加载实际内容
              return Promise.resolve(new Response(JSON.stringify({code: 0, data: {}}), {
                status: 200,
                headers: {'Content-Type': 'application/json'}
              }));
            }
          }
          
          // 允许其他请求通过
          return originalFetch.apply(this, arguments);
        };
        
        // 拦截XHR请求
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
          // 标记当前XHR对象，以便在send时识别
          this._focusModeUrl = url;
          return originalXhrOpen.apply(this, arguments);
        };
        
        const originalXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body) {
          if (this._focusModeUrl && typeof this._focusModeUrl === 'string') {
            // 与fetch相同的过滤逻辑
            if (
              this._focusModeUrl.includes('/x/web-interface/index') || 
              this._focusModeUrl.includes('/x/web-show/res/loc') ||
              this._focusModeUrl.includes('/x/web-interface/ranking') ||
              this._focusModeUrl.includes('/x/web-interface/popular') ||
              this._focusModeUrl.includes('/x/web-interface/banner')
            ) {
              console.log('[专注模式] 拦截XHR请求:', this._focusModeUrl);
              
              // 模拟成功响应但不发送实际请求
              Object.defineProperty(this, 'readyState', {value: 4});
              Object.defineProperty(this, 'status', {value: 200});
              Object.defineProperty(this, 'responseText', {value: JSON.stringify({code: 0, data: {}})});
              setTimeout(() => {
                this.dispatchEvent(new Event('readystatechange'));
                this.dispatchEvent(new Event('load'));
              }, 0);
              return;
            }
          }
          
          return originalXhrSend.apply(this, arguments);
        };
        
        console.log('[专注模式] 网络请求拦截已设置');
      } catch (e) {
        console.error('[专注模式] 设置网络请求拦截失败:', e);
      }
    }
    
    /**
     * 清空现有页面内容
     * 阻止B站首页渲染，为我们的专注界面腾出空间
     */
    static clearExistingContent() {
      // 在document_start阶段，尽早阻止页面加载
      if (document.readyState === 'loading') {
        // 在DOM加载前创建MutationObserver来监听并立即移除B站首页内容
        document.addEventListener('DOMContentLoaded', () => {
          // 清空body内容，保留只有必要的元素
          const nodesToKeep = [];
          
          // 保留已有的style标签和script标签
          Array.from(document.head.querySelectorAll('style,script,link[rel="stylesheet"]')).forEach(node => {
            nodesToKeep.push(node);
          });
          
          // 立即移除页面内容
          while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
          }
          
          console.log('[专注模式] 已清空原始页面内容');
        }, { once: true });
      } else {
        // 如果DOM已加载，直接清空
        const mainContainers = [
          '#app', 
          '#i_cecream', 
          '.bili-feed', 
          '.bili-layout', 
          '.international-home', 
          '.bili-wrapper',
          '.bili-header'
        ];
        
        mainContainers.forEach(selector => {
          const container = document.querySelector(selector);
          if (container) {
            // 彻底清空内容
            container.innerHTML = '';
            container.style.display = 'none';
            console.log(`[专注模式] 已清空容器: ${selector}`);
          }
        });
      }
    }
    
    /**
     * 设置导航监控
     * 监听URL变化，在返回首页时触发专注模式
     */
    static setupNavigationMonitor() {
      // 已经设置过监听则不重复
      if (window.__navigationMonitorSet) return;
      window.__navigationMonitorSet = true;
      
      // 使用pushState和replaceState的监听器
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      // 重写pushState
      history.pushState = function(...args) {
        const result = originalPushState.apply(this, args);
        FocusedHomepage.checkAfterNavigation();
        return result;
      };
      
      // 重写replaceState
      history.replaceState = function(...args) {
        const result = originalReplaceState.apply(this, args);
        FocusedHomepage.checkAfterNavigation();
        return result;
      };
      
      // 监听popstate事件（浏览器前进/后退按钮）
      window.addEventListener('popstate', () => {
        FocusedHomepage.checkAfterNavigation();
      });
      
      // 监听hashchange事件
      window.addEventListener('hashchange', () => {
        FocusedHomepage.checkAfterNavigation();
      });
      
      console.log('[专注模式] 导航监听已设置');
    }
    
    /**
     * 在导航后检查是否是首页
     */
    static checkAfterNavigation() {
      setTimeout(() => {
        if (FocusedHomepage.isHomepage()) {
          safeLog('页面优化', '导航到首页，激活专注模式');
          
          // 如果导航到首页，立即清空可能存在的内容
          FocusedHomepage.clearExistingContent();
          
          // 如果已有实例但页面已改变，尝试重新初始化
          if (window.focusedHomepage) {
            if (!window.focusedHomepage.initialized || document.querySelector('.focused-homepage-container') === null) {
              window.focusedHomepage.init(true);
            }
          } else {
            window.focusedHomepage = new FocusedHomepage();
          }
        }
        
        // 检查是否导航到了搜索页面
        if (FocusedHomepage.isSearchPage()) {
          safeLog('页面优化', '导航到搜索页面，准备优化');
          
          // 如果已有实例但页面已改变，尝试重新初始化
          if (window.focusedHomepage) {
            window.focusedHomepage.initializeSearchOptimizer();
          } else {
            window.focusedHomepage = new FocusedHomepage();
            window.focusedHomepage.initializeSearchOptimizer();
          }
        }
      }, 50);
    }
    
    /**
     * 添加早期样式，在页面加载最早阶段阻止B站原始内容显示
     */
    static addEarlyStyles() {
      // 避免重复添加
      if (document.getElementById('focused-early-styles')) return;
      
      // 创建样式元素
      const style = document.createElement('style');
      style.id = 'focused-early-styles';
      style.innerHTML = `
        /* 立即隐藏可能的B站原始内容 */
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          background-color: #f6f7f8 !important;
        }
        
        /* 🔧 安全的内容隐藏 - 精确选择器避免误伤播放器 */
        /* 明确指定要隐藏的B站首页元素，避免通配符误伤 */
        #app:not([class*="player"]):not([id*="player"]),
        #i_cecream:not([class*="player"]):not([id*="player"]),
        .bili-header:not([class*="player"]):not([id*="player"]),
        .bili-layout:not([class*="player"]):not([id*="player"]),
        .bili-feed:not([class*="player"]):not([id*="player"]),
        .bili-footer:not([class*="player"]):not([id*="player"]),
        .international-header:not([class*="player"]):not([id*="player"]),
        .bili-wrapper:not([class*="player"]):not([id*="player"]),
        .bili-container:not([class*="player"]):not([id*="player"]),
        .bili-video-card:not([class*="player"]):not([id*="player"]),
        .feed-card:not([class*="player"]):not([id*="player"]),
        .bili-banner:not([class*="player"]):not([id*="player"]),
        .tab-bar:not([class*="player"]):not([id*="player"]),
        .bili-grid:not([class*="player"]):not([id*="player"]),
        .nav-item:not([class*="player"]):not([id*="player"]),
        .search-wrapper:not([class*="player"]):not([id*="player"]) {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          height: 0 !important;
          width: 0 !important;
          position: absolute !important;
          left: -9999px !important;
          overflow: hidden !important;
          z-index: -9999 !important;
        }
        
        /* 🔒 绝对保护播放器相关元素 - 防止任何意外隐藏 */
        .bpx-player-container,
        .bpx-player-control-wrap,
        .bpx-player-control-entity,
        .bpx-player-video-control,
        .bpx-player-video-control-wrap,
        .bilibili-player-video-control-wrap,
        #bilibili-player,
        .player-container,
        .bilibili-player-area,
        [class*="bpx-player"],
        [id*="player"],
        [class*="player-ctrl"],
        [class*="control-wrap"] {
          display: revert !important;
          opacity: revert !important;
          visibility: revert !important;
          pointer-events: revert !important;
          height: revert !important;
          width: revert !important;
          position: revert !important;
          left: revert !important;
          overflow: revert !important;
          z-index: revert !important;
        }
        
        /* 🎯 首页特定元素强化隐藏 - 更全面的首页元素列表 */
        #app:not([class*="player"]):not([id*="player"]),
        #i_cecream:not([class*="player"]):not([id*="player"]),
        .bili-header:not([class*="player"]):not([id*="player"]),
        .bili-layout:not([class*="player"]):not([id*="player"]),
        .bili-feed:not([class*="player"]):not([id*="player"]),
        .bili-footer:not([class*="player"]):not([id*="player"]),
        .international-header:not([class*="player"]):not([id*="player"]),
        .bili-wrapper:not([class*="player"]):not([id*="player"]),
        .bili-container:not([class*="player"]):not([id*="player"]),
        #bili-header-container:not([class*="player"]):not([id*="player"]),
        .bili-video-card:not([class*="player"]):not([id*="player"]),
        .feed-card:not([class*="player"]):not([id*="player"]),
        .bili-banner:not([class*="player"]):not([id*="player"]),
        .tab-bar:not([class*="player"]):not([id*="player"]),
        .bili-grid:not([class*="player"]):not([id*="player"]),
        #internationalHeader:not([class*="player"]):not([id*="player"]),
        .bili-feed-card:not([class*="player"]):not([id*="player"]),
        .floor-single-card:not([class*="player"]):not([id*="player"]),
        .canvas-cover:not([class*="player"]):not([id*="player"]) {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          max-height: 0 !important;
          max-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        
        /* 确保我们的专注容器可见 */
        .focused-homepage-container {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          height: auto !important;
          width: auto !important;
          max-height: none !important;
          max-width: none !important;
          position: relative !important;
          overflow: visible !important;
          z-index: 1000 !important;
        }
      `;
      
      // 尝试添加到文档头部
      // 在document.head不存在时，使用插入到第一个脚本前的方式
      const target = document.head || document.getElementsByTagName('script')[0].parentNode;
      target.appendChild(style);
      
      // 创建一个<div>元素作为占位符，防止B站的脚本获取到body为空的情况
      // 这个技巧可以阻止一些初始化脚本运行
      const placeholderDiv = document.createElement('div');
      placeholderDiv.id = 'focused-placeholder';
      placeholderDiv.style.display = 'none';
      document.body.appendChild(placeholderDiv);
      
      console.log('[专注模式] ✅ 已添加安全的早期样式拦截（已保护播放器元素）');
    }

    /**
     * 构造函数
     * 初始化视频合集和界面状态
     */
    constructor() {
      // 减少构造函数中的操作，防止卡顿
      this.collections = [];
      this.initialized = false;
      this.observer = null;
      this._eventListenersAttached = false; // 跟踪事件监听器是否已添加
      this.keyboardEventHandler = null; // 添加键盘事件处理器引用
      
      // 搜索页面相关属性
      this.searchInitialized = false;
      this.searchObserver = null;
      this.searchSelectors = {
        searchContainer: ['.search-container', '#server-search-app', '.search-page'],
        resultList: ['.search-content', '.video-list', '.search-page-wrapper'],
        rightContainer: ['.right-container', '.search-right-module', '.search-sidebar'],
        leftContainer: ['.left-container', '.search-content', '.search-result-container'],
        videoCards: ['.bili-video-card', '.video-item', '.search-video-card'],
        titleElement: ['.bili-video-card__info--tit', '.title', '.video-title', 'a.title']
      };
      
      // 使用延迟初始化
      this.init = this.init.bind(this);
      
      // 检查依赖项是否已加载
      this.checkDependencies();
      
      // 配置DOM观察器，监控DOM变化
      this.setupDOMObserver();
      
      // 尽早初始化
      if (document.readyState === 'loading') {
        // 如果页面还在加载，则等待DOMContentLoaded事件
        document.addEventListener('DOMContentLoaded', () => {
          if (FocusedHomepage.isHomepage()) {
            this.init();
          } else if (FocusedHomepage.isSearchPage()) {
            this.initializeSearchOptimizer();
          }
        });
        
        // 添加早期样式，避免原首页闪烁
        FocusedHomepage.addEarlyStyles();
      } else {
        // 页面已加载，立即初始化
        if (FocusedHomepage.isHomepage()) {
          this.init();
        } else if (FocusedHomepage.isSearchPage()) {
          this.initializeSearchOptimizer();
        }
      }
    }
    
    /**
     * 检查依赖项是否已加载
     * 避免因加载顺序问题导致的功能失效
     */
    checkDependencies() {
      // 检查StorageUtils和UIUtils是否已加载
      if ((typeof StorageUtils === 'undefined' || typeof UIUtils === 'undefined') && 
          document.readyState !== 'loading') {
        console.warn('[专注模式] 关键依赖项未加载，尝试延迟加载');
        
        // 如果utils.js未加载，尝试手动加载
        const checkScript = document.querySelector('script[src*="utils.js"]');
        if (!checkScript) {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL('content/utils.js');
          script.onload = () => {
            console.log('[专注模式] 成功加载utils.js');
            // 重新检查依赖
            setTimeout(() => this.checkDependencies(), 50);
          };
          document.head.appendChild(script);
        } else {
          // utils.js已加载但依赖未定义，可能需要更多时间
          setTimeout(() => this.checkDependencies(), 50);
        }
      }
    }
    
    /**
     * 设置DOM观察器，监控文档变化
     * 防止B站动态DOM恢复原始内容
     */
    setupDOMObserver() {
      // 如果已设置观察器，则跳过
      if (this.observer) return;
      
      // 创建观察器配置
      const config = { 
        childList: true, 
        subtree: true 
      };
      
      // 回调函数
      const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // 检查是否出现了原始B站首页内容
            const addedOriginalContent = Array.from(mutation.addedNodes).some(node => {
              if (node.nodeType !== Node.ELEMENT_NODE) return false;
              
              const element = node;
              // 扩展检查条件，覆盖更多B站可能动态添加的元素
              return element.classList && (
                element.classList.contains('bili-feed') || 
                element.classList.contains('bili-layout') ||
                element.classList.contains('bili-video-card') ||
                element.classList.contains('floor-single-card') ||
                element.classList.contains('feed-card') ||
                element.classList.contains('bili-banner') ||
                element.classList.contains('bili-grid') ||
                element.classList.contains('tab-bar') ||
                element.id === 'i_cecream' ||
                element.id === 'app' ||
                element.id === 'internationalHeader'
              );
            });
            
            // 如果原始内容重新出现，立即移除它
            if (addedOriginalContent && this.initialized) {
              console.log('[专注模式] 检测到原始内容恢复，立即移除');
              // 不只是隐藏，而是彻底移除添加的节点
              for (let node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node;
                  if (element.classList && (
                    element.classList.contains('bili-feed') || 
                    element.classList.contains('bili-layout') ||
                    element.classList.contains('bili-video-card') ||
                    element.id === 'i_cecream' ||
                    element.id === 'app'
                  )) {
                    if (element.parentNode) {
                      element.parentNode.removeChild(element);
                    }
                  }
                }
              }
            }
          }
        }
      };
      
      // 创建观察器
      this.observer = new MutationObserver(callback);
      
      // 开始观察
      if (document.readyState !== 'loading') {
        this.observer.observe(document.body, config);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          this.observer.observe(document.body, config);
        });
      }
    }
    
    /**
     * 初始化方法
     * @param {boolean} force - 是否强制重新初始化
     */
    init(force = false) {
      // 避免重复初始化
      if (this.initialized && !force) {
        return;
      }
      
      // 移除设置检查逻辑，让首页正常加载
      // 首页现在会在加载完成后再显示设置引导
      
      console.log('[专注模式] 初始化专注界面');
      
      try {
        // 使用一个非阻塞的方式初始化界面
        setTimeout(() => {
          // 隐藏原始内容
      this.hideOriginalContent();
      
      // 创建专注界面
      this.createFocusedInterface();
      
      // 添加样式
      this.addStyles();
      
          // 加载收藏的集合
          this.loadCollections()
            .then(() => {
              // 渲染合集
              this.renderCollections();
              
              // 设置事件监听器
      this.setupEventListeners();
              
              this.initialized = true;
              console.log('[专注模式] 专注界面初始化完成');
            })
            .catch(err => {
              console.error('[专注模式] 加载合集失败:', err);
              
              // 即使加载失败，也标记为已初始化
              this.initialized = true;
              
              // 创建空容器
        this.renderCollections();
      });
        }, 0);
      } catch (err) {
        console.error('[专注模式] 初始化专注界面失败:', err);
      
        // 出错时尝试创建最小界面
        this.createFocusedInterface();
      }
    }

    /**
     * 隐藏B站原始首页内容
     * 通过CSS选择器隐藏原始页面元素
     */
    hideOriginalContent() {
      try {
        // 使用更广泛的选择器，确保能覆盖各种可能的首页结构
        const tempStyles = document.createElement('style');
        tempStyles.id = 'focused-content-hide-styles';
        tempStyles.textContent = `
          /* 全部隐藏策略 */
          body > *:not(.focused-homepage-container):not(.dialog-overlay):not(style):not(script) {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
          
          /* 特定元素隐藏 */
          #app, .bili-header, #i_cecream, .bili-container, #bili-header-container,
          .international-header, .bili-wrapper, .bili-layout, .bili-feed, .bili-footer,
          .feed-card, .bili-video-card, .bili-banner, .primary-menu-itnl,
          .channel-icons, .tab-bar, .bili-grid, .floor-single-card {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            max-height: 0 !important;
            max-width: 0 !important;
          }
          
          /* 页面基础样式 */
          body {
            background-color: #f6f7f8 !important;
            overflow-x: hidden !important;
          }
          
          html {
            overflow-y: auto !important; /* 恢复页面滚动 */
          }
          
          /* 确保我们的界面可见 */
          .focused-homepage-container {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        `;
        
        // 先移除可能存在的样式表，防止重复
        const oldStyle = document.getElementById('focused-content-hide-styles');
        if (oldStyle) oldStyle.remove();
        
        document.head.appendChild(tempStyles);
        
        // 立即移除B站主要容器的内容
        const mainContainers = [
          '#app', 
          '#i_cecream', 
          '.bili-feed', 
          '.bili-layout', 
          '.international-home', 
          '.bili-wrapper',
          '.bili-header'
        ];
        
        mainContainers.forEach(selector => {
          const container = document.querySelector(selector);
          if (container) {
            // 彻底清空内容
            container.innerHTML = '';
            container.style.display = 'none';
            console.log(`[专注模式] 已清空容器: ${selector}`);
          }
        });
      } catch (e) {
        console.error('[专注模式] 隐藏原内容失败:', e);
      }
    }

    /**
     * 创建专注界面
     * 构建简洁的搜索和视频合集管理界面
     */
    createFocusedInterface() {
      try {
        // 检查是否已创建
        if (document.querySelector('.focused-homepage-container')) {
          console.log('[专注模式] 界面已存在，跳过创建');
          return;
        }
        
        console.log('[专注模式] 开始创建专注界面');
        
        // 创建主容器
        const container = document.createElement('div');
        container.className = 'focused-homepage-container';
        document.body.appendChild(container);

        // 创建搜索区域
        const searchSection = document.createElement('div');
        searchSection.className = 'focused-search-section';
        container.appendChild(searchSection);

        // 添加标题
        const title = document.createElement('h1');
        title.textContent = '更适合学生党的B站专注搜索';
        title.className = 'focused-title';
        searchSection.appendChild(title);

        // 创建搜索框
        const searchBox = document.createElement('div');
        searchBox.className = 'focused-search-box';
        searchBox.innerHTML = `
          <input type="text" placeholder="输入关键词搜索学习视频" class="focused-search-input">
          <button class="focused-search-button" title="搜索视频">
            <svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
        `;
        searchSection.appendChild(searchBox);

        // 创建合集区域
        const collectionsSection = document.createElement('div');
        collectionsSection.className = 'focused-collections-section';
        container.appendChild(collectionsSection);

        // 添加合集标题和按钮区域
        const collectionHeader = document.createElement('div');
        collectionHeader.className = 'collections-header';
        collectionsSection.appendChild(collectionHeader);

        // 添加合集标题
        const collectionsTitle = document.createElement('h2');
        collectionsTitle.textContent = '常用学习视频入口';
        collectionsTitle.className = 'collections-title';
        collectionHeader.appendChild(collectionsTitle);

        // 添加合集按钮
        const addButton = document.createElement('button');
        addButton.className = 'add-collection-button';
        addButton.title = '添加新的学习视频合集';  // 添加标题属性提高可访问性
        addButton.innerHTML = `
          <svg viewBox="0 0 24 24" class="add-icon" aria-hidden="true">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <span>添加合集</span>
        `;
        
        // 为添加按钮添加直接点击事件
        addButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[专注模式] 添加合集按钮被点击');
          this.showSimpleAddDialog();
        });
        
        collectionHeader.appendChild(addButton);

        // 添加设置按钮
        const settingsButton = document.createElement('button');
        settingsButton.className = 'settings-button';
        settingsButton.title = '设置密码和提醒语';
        settingsButton.innerHTML = `
          <svg viewBox="0 0 24 24" class="settings-icon" aria-hidden="true">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
          <span>设置</span>
        `;
        
        // 为设置按钮添加点击事件
        settingsButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[专注模式] 设置按钮被点击');
          GlobalSettingsManager.handleGlobalSettings();
        });
        
        collectionHeader.appendChild(settingsButton);

        // 创建合集容器
        const collectionsContainer = document.createElement('div');
        collectionsContainer.className = 'collections-container';
        collectionsSection.appendChild(collectionsContainer);
        
        console.log('[专注模式] 专注搜索界面已创建');
      } catch (err) {
        console.error('[专注模式] 创建专注界面失败:', err);
        // 尝试恢复
        if (!document.querySelector('.focused-homepage-container')) {
          const fallbackContainer = document.createElement('div');
          fallbackContainer.className = 'focused-homepage-container';
          fallbackContainer.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
              <h1 style="color: #00a1d6;">B站专注学习助手</h1>
              <p style="color: #666;">创建界面时出错，请刷新页面重试</p>
              <button onclick="location.reload()" style="background: #00a1d6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 20px;">刷新页面</button>
            </div>
          `;
          document.body.appendChild(fallbackContainer);
        }
      }
    }

    /**
     * 添加专注界面样式
     * 使用ensureStylesOnce确保样式只添加一次
     */
    addStyles() {
      const cssText = `
        /* 基础样式 */
        body {
          margin: 0;
          padding: 0;
          background: #f1f2f3;
          text-size-adjust: 100%;
          -webkit-text-size-adjust: 100%;
          -moz-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }

        /* 容器样式 */
        .focused-homepage-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 10px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.5s ease forwards;
        }

        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 搜索区域样式 */
        .focused-search-section {
          margin-bottom: 20px;
          text-align: center;
        }

        .focused-title {
          font-size: 28px;
          font-weight: 600;
          color: #18191c;
          margin-bottom: 24px;
          text-align: center;
        }

        .focused-search-box {
          display: flex;
          max-width: 640px;
          margin: 0 auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          transition: all 0.2s ease;
          will-change: transform, box-shadow;
          border: 1px solid #e3e5e7;
        }

        .focused-search-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .focused-search-input {
          flex: 1;
          padding: 12px 16px;
          font-size: 16px;
          border: none;
          outline: none;
          transition: background-color 0.2s ease;
        }

        .focused-search-input:focus {
          background-color: #f8f9fa;
        }

        .focused-search-button {
          width: 48px;
          background: #00a1d6;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .focused-search-button:hover {
          background: #00b5e5;
        }

        .search-icon {
          width: 20px;
          height: 20px;
          fill: #fff;
        }

        /* 合集区域样式 */
        .focused-collections-section {
          margin-top: 10px;
        }

        .collections-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          position: sticky;
          top: 0;
          background-color: #f1f2f3;
          padding: 8px 0;
          z-index: 10;
          gap: 10px;
        }

        .collections-title {
          font-size: 20px;
          font-weight: 600;
          color: #18191c;
          margin: 0;
          position: relative;
          padding-left: 12px;
        }
        
        .collections-title:before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 18px;
          background-color: #00a1d6;
          border-radius: 2px;
        }

        .add-collection-button {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          background: #00a1d6 !important;
          color: #fff !important;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          will-change: transform;
          box-shadow: 0 2px 4px rgba(0, 161, 214, 0.2);
          position: relative;
          z-index: 20;
          min-width: 120px;
        }

        .add-collection-button:hover {
          background: #00b5e5 !important;
          color: #fff !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 161, 214, 0.25);
        }

        .add-collection-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 161, 214, 0.2);
        }

        .add-icon {
          width: 16px;
          height: 16px;
          fill: #fff;
          margin-right: 6px;
        }

        /* 设置按钮样式 */
        .settings-button {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          background: #666 !important;
          color: #fff !important;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          will-change: transform;
          box-shadow: 0 2px 4px rgba(102, 102, 102, 0.2);
          position: relative;
          z-index: 20;
          min-width: 100px;
        }

        .settings-button:hover {
          background: #555 !important;
          color: #fff !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(102, 102, 102, 0.25);
        }

        .settings-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(102, 102, 102, 0.2);
        }

        .settings-icon {
          width: 16px;
          height: 16px;
          fill: #fff;
          margin-right: 6px;
        }

        /* 按钮容器样式 - 让按钮在右侧并排 */
        .collections-header > .collections-title {
          flex: 1;
        }

        .collections-header > .add-collection-button,
        .collections-header > .settings-button {
          flex-shrink: 0;
        }

        /* 合集网格样式 */
        .collections-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.5s ease forwards 0.3s;
          min-height: 100px;
          padding-bottom: 40px;
        }

        /* 合集卡片样式 - B站风格 */
        .collection-card {
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          transition: all 0.2s ease;
          will-change: transform, box-shadow;
          cursor: pointer;
          width: 100%;
          width: -webkit-fill-available;
          width: -moz-available;
          width: stretch;
          border: 1px solid #e3e5e7;
          position: relative;
        }

        .collection-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-color: #d0d3d7;
        }
        
        .collection-card:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #00a1d6, #00b5e5);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        .collection-card:hover:before {
          opacity: 1;
        }

        .collection-content {
          padding: 14px;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .collection-title {
          font-size: 16px;
          font-weight: 600;
          color: #18191c;
          margin: 0 0 8px;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .collection-description {
          color: #61666d;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-decoration-skip-ink: auto;
          -webkit-text-decoration-skip: ink;
        }

        .collection-meta {
          padding: 10px 14px;
          border-top: 1px solid #f4f5f7;
          color: #9499a0;
          font-size: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .collection-meta a.dialog-button.primary {
          background: #00a1d6;
          color: #fff;
          padding: 4px 10px;
          border-radius: 4px;
          text-decoration: none;
          font-size: 12px;
          transition: all 0.2s;
        }
        
        .collection-meta a.dialog-button.primary:hover {
          background: #00b5e5;
        }
        
        .collection-meta button.collection-delete-btn {
          background: transparent;
          color: #9499a0;
          border: 1px solid #e3e5e7;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        
        .collection-meta button.collection-delete-btn:hover {
          color: #00a1d6;
          border-color: #00a1d6;
        }

        /* 对话框样式 */
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .dialog-overlay.active {
          opacity: 1;
        }

        .dialog {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          width: 450px;
          max-width: 90vw;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(20px);
          opacity: 0;
          transition: all 0.3s ease;
        }

        .dialog-overlay.active .dialog {
          transform: translateY(0);
          opacity: 1;
        }

        .dialog h3 {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 600;
          color: #18191c;
          position: relative;
          padding-left: 12px;
        }
        
        .dialog h3:before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 16px;
          background-color: #00a1d6;
          border-radius: 2px;
        }

        .dialog-form-group {
          margin-bottom: 14px;
        }

        .dialog-form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #18191c;
          font-size: 14px;
        }

        .dialog-form-group input,
        .dialog-form-group textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #e3e5e7;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .dialog-form-group input:focus,
        .dialog-form-group textarea:focus {
          border-color: #00a1d6;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0, 161, 214, 0.1);
        }

        .dialog-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 20px;
        }

        .dialog-button {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dialog-button.primary {
          background: #00a1d6;
          color: #fff;
          border: none;
        }

        .dialog-button.primary:hover {
          background: #00b5e5;
        }

        .dialog-button.secondary {
          background: #fff;
          color: #18191c;
          border: 1px solid #e3e5e7;
        }

        .dialog-button.secondary:hover {
          background: #f4f5f7;
        }
        
        /* 空状态提示样式 */
        .empty-collections {
          color: #9499a0;
          text-align: center;
          padding: 40px 0;
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e3e5e7;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        
        .empty-collections svg {
          width: 64px;
          height: 64px;
          fill: #e3e5e7;
          margin-bottom: 16px;
        }
        
        .empty-collections p {
          margin: 0;
          font-size: 14px;
        }
        
        /* 键盘快捷键提示 */
        .keyboard-shortcut-hint {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #e3e5e7;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 12px;
          color: #61666d;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          z-index: 100;
          pointer-events: none;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        
        .keyboard-shortcut-hint:hover {
          opacity: 1;
        }
        
        .keyboard-shortcut-hint kbd {
          background: #f4f5f7;
          border: 1px solid #e3e5e7;
          border-radius: 3px;
          padding: 1px 4px;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
          margin: 0 2px;
        }

        /* 媒体查询 - 响应式调整 */
        @media (max-width: 1280px) {
          .focused-homepage-container {
            padding: 10px 15px;
          }
        }
        
        @media (max-width: 768px) {
          .collections-container {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
        }
        
        @media (max-width: 480px) {
          .collections-container {
            grid-template-columns: 1fr;
          }
          
          .collections-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .add-collection-button,
          .settings-button {
            width: 100%;
            justify-content: center;
          }
          
          .collections-header {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          
          .collections-header > .collections-title {
            text-align: center;
          }
        }
      `;

      // 使用工具函数确保样式只添加一次
      if (window.ensureStylesOnce) {
        window.ensureStylesOnce('focused-homepage-styles', cssText);
      } else {
        // 回退方案
        let styleEl = document.getElementById('focused-homepage-styles');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'focused-homepage-styles';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = cssText;
      }
      
      console.log('[专注模式] 专注搜索样式已添加');
    }

    /**
     * 设置事件监听
     * 处理搜索功能和初次渲染合集
     */
    setupEventListeners() {
      // 获取搜索框和搜索按钮
      const input = document.querySelector('.focused-search-input');
      const button = document.querySelector('.focused-search-button');
      if (input && button) {
        // 监听回车键搜索
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleSearch(input.value.trim());
          }
        });
        // 监听搜索按钮点击
        button.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleSearch(input.value.trim());
        });
      }
      // 初始渲染用户的视频合集
      this.renderCollections();
    }

    /**
     * 处理搜索功能
     * 优化的搜索跳转实现
     * @param {string} keyword - 搜索关键词
     */
    handleSearch(keyword) {
      if (!keyword) return;  // 关键词为空则不处理
      
      try {
        // 显示加载状态
        this.showSearchLoading();
        
        // 获取输入框和搜索按钮，用于UI反馈
        const searchInput = document.querySelector('#nav-searchform .nav-search-input, .search-input');
        const searchBtn = document.querySelector('#nav-searchform .nav-search-btn, .search-button');
        
        if (searchBtn) {
          searchBtn.classList.add('loading');
          searchBtn.setAttribute('disabled', 'disabled');
        }
        
        // 构建搜索URL
        const searchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
        
        // 预加载搜索页面
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = searchUrl;
        document.head.appendChild(link);
        
        // 使用现代导航API (如果支持)
        if (window.navigation && typeof window.navigation.navigate === 'function') {
          window.navigation.navigate(searchUrl).catch(() => {
            // 降级方案：如果导航API失败，使用传统方法
            window.location.href = searchUrl;
          });
        } else {
          // 使用传统跳转，但添加延迟以便预加载和加载状态显示
          setTimeout(() => {
            window.location.href = searchUrl;
          }, 100);
        }
      } catch (err) {
        console.error('[专注模式] 搜索跳转失败:', err);
        // 发生错误时降级到传统跳转
        window.location.href = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
      }
    }
    
    /**
     * 显示搜索加载状态
     */
    showSearchLoading() {
      try {
        // 创建并显示加载指示器
        const loadingEl = document.createElement('div');
        loadingEl.className = 'focus-search-loading';
        loadingEl.innerHTML = '<span>搜索中...</span>';
        loadingEl.style.position = 'fixed';
        loadingEl.style.top = '60px';
        loadingEl.style.left = '50%';
        loadingEl.style.transform = 'translateX(-50%)';
        loadingEl.style.background = 'rgba(0,161,214,0.9)';
        loadingEl.style.color = '#fff';
        loadingEl.style.padding = '8px 16px';
        loadingEl.style.borderRadius = '4px';
        loadingEl.style.zIndex = '99999';
        loadingEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        document.body.appendChild(loadingEl);
      } catch (err) {
        console.error('[专注模式] 显示搜索加载状态失败:', err);
      }
    }

    /**
     * 显示添加合集对话框
     * 允许用户添加B站内容链接到首页
     */
    showAddCollectionDialog() {
      console.log('[专注模式] 开始显示添加合集对话框');
      
      try {
        // 创建/获取UIUtils实现
        const uiUtils = this.ensureUIUtils();
        
        // 如果没有可用的UIUtils，则使用备用简单对话框
        if (!uiUtils) {
          this.showSimpleAddDialog();
          return;
        }
        
        // 创建对话框选项
        const dialogOptions = {
          title: '添加B站内容收藏',
          content: `
            <div class="dialog-form-group">
              <label>名称</label>
              <input type="text" id="collection-title" placeholder="如：高数合集/某UP主页/专栏等">
            </div>
            <div class="dialog-form-group">
              <label>一键直达学习快捷通道（视频、合集、UP主页、专栏、分区等）</label>
              <input type="text" id="collection-url" placeholder="https://www.bilibili.com/xxx">
            </div>
            <div class="dialog-form-group">
              <label>描述</label>
              <textarea id="collection-desc" rows="2" placeholder="可选"></textarea>
            </div>
          `,
          buttons: [
            {
              text: '取消',
              type: 'secondary',
              id: 'cancel-add',
              onClick: (e, dialog, background) => {
                this.closeDialog(background, uiUtils);
              }
            },
            {
              text: '添加',
              type: 'primary',
              id: 'confirm-add',
              onClick: (e, dialog, background) => {
                this.handleAddCollection(dialog, background, uiUtils);
              }
            }
          ],
          width: '450px',
          className: 'add-collection-dialog'
        };
        
        // 显示对话框
        try {
          console.log('[专注模式] 调用createDialog显示对话框');
          const {dialog, background} = uiUtils.createDialog(dialogOptions);
          
          // 给表单加上回车键提交功能
          dialog.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
              const confirmButton = dialog.querySelector('#confirm-add');
              if (confirmButton) {
                confirmButton.click();
              }
            }
          });
          
          // 初始化聚焦到标题输入框
          setTimeout(() => {
            const titleInput = dialog.querySelector('#collection-title');
            if (titleInput) {
              titleInput.focus();
            }
          }, 100);
        } catch (dialogErr) {
          console.error('[专注模式] UIUtils创建对话框失败:', dialogErr);
          // 回退到简单对话框
          this.showSimpleAddDialog();
        }
      } catch (err) {
        console.error('[专注模式] 显示添加合集对话框失败:', err);
        // 最终回退 - 简单原生对话框
        this.showSimpleAddDialog();
      }
    }
    
    /**
     * 处理添加合集的操作
     * 从对话框获取数据并保存
     */
    handleAddCollection(dialog, background, uiUtils) {
      try {
        // 获取输入框的值
        const titleInput = dialog.querySelector('#collection-title');
        const urlInput = dialog.querySelector('#collection-url');
        const descInput = dialog.querySelector('#collection-desc');
        
        if (!titleInput || !urlInput) {
          throw new Error('找不到输入字段');
        }
        
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        const desc = descInput ? descInput.value.trim() : '';
        
        // 验证输入
        if (!title) {
          alert('请输入合集名称');
          return;
        }
        
        if (!url) {
          alert('请输入B站链接');
          return;
        }
        
        // 创建新合集
        const newCollection = {
          title,
          url,
          desc,
          created: new Date().getTime()
        };
        
        // 添加到数组
        if (!Array.isArray(this.collections)) {
          this.collections = [];
        }
        
        this.collections.push(newCollection);
        
        // 关闭对话框
        this.closeDialog(background, uiUtils);
        
        // 保存并重新渲染
        this.saveCollections()
          .then(() => {
            console.log('[专注模式] 保存合集成功，即将重新渲染');
            this.renderCollections();
            
            // 显示成功消息
            this.showMessage('添加成功', 'success', uiUtils);
          })
          .catch(err => {
            console.error('[专注模式] 保存合集失败:', err);
            alert('添加成功但保存失败，可能在刷新页面后丢失');
            this.renderCollections();
          });
      } catch (err) {
        console.error('[专注模式] 处理添加合集请求失败:', err);
        alert('添加合集失败，请重试');
        
        // 关闭对话框
        this.closeDialog(background, uiUtils);
      }
    }
    
    /**
     * 关闭对话框的通用方法
     */
    closeDialog(background, uiUtils) {
      try {
        if (uiUtils && typeof uiUtils.closeDialog === 'function') {
          uiUtils.closeDialog(background);
        } else if (background && background.parentNode) {
          background.parentNode.removeChild(background);
        }
      } catch (err) {
        console.error('[专注模式] 关闭对话框失败:', err);
        // 尝试直接移除
        if (background && background.parentNode) {
          background.parentNode.removeChild(background);
        }
      }
    }
    
    /**
     * 显示消息的通用方法
     */
    showMessage(message, type, uiUtils) {
      try {
        if (uiUtils && typeof uiUtils.showMessage === 'function') {
          uiUtils.showMessage(message, type);
        } else {
          // 简易提示
          alert(message);
        }
      } catch (err) {
        console.error('[专注模式] 显示消息失败:', err);
        // 备用提示
        alert(message);
      }
    }
    
    /**
     * 确保UIUtils可用
     * 返回可用的UIUtils实例或null
     */
    ensureUIUtils() {
      try {
        // 检查全局UIUtils
        if (typeof UIUtils !== 'undefined' && typeof UIUtils.createDialog === 'function') {
          console.log('[专注模式] 使用全局UIUtils');
          return UIUtils;
        }
        
        // 尝试加载备用实现
        console.log('[专注模式] 尝试加载备用UIUtils');
        const backupUtils = this.loadUIUtils();
        
        if (backupUtils && typeof backupUtils.createDialog === 'function') {
          console.log('[专注模式] 成功加载备用UIUtils');
          return backupUtils;
        }
        
        console.warn('[专注模式] 无法获取可用的UIUtils');
        return null;
      } catch (err) {
        console.error('[专注模式] 确保UIUtils可用时出错:', err);
        return null;
      }
    }
    
    /**
     * 显示简单的添加对话框
     * 当UIUtils不可用时的备用方法
     */
    showSimpleAddDialog() {
      try {
        console.log('[专注模式] 使用简单对话框');
        
        const title = prompt('请输入合集名称（如：高数合集/某UP主页/专栏等）');
        if (!title) return;
        
        const url = prompt('请输入B站链接（视频、合集、UP主页、专栏、分区等）');
        if (!url) return;
        
        const desc = prompt('请输入描述（可选）');
        
        // 创建新合集
        const newCollection = {
          title: title.trim(),
          url: url.trim(),
          desc: desc ? desc.trim() : '',
          created: new Date().getTime()
        };
        
        // 添加到数组
        if (!Array.isArray(this.collections)) {
          this.collections = [];
        }
        
        this.collections.push(newCollection);
        
        // 确保localStorage备份能成功
        try {
          localStorage.setItem('focusedCollections', JSON.stringify(this.collections));
          localStorage.setItem('focusedCollections_backup', JSON.stringify(this.collections));
          console.log('[专注模式] 本地存储备份成功');
        } catch (localErr) {
          console.warn('[专注模式] 本地存储备份失败:', localErr);
        }
        
        // 保存并重新渲染
        this.saveCollections()
          .then(() => {
            this.renderCollections();
            alert('添加成功');
          })
          .catch(err => {
            console.error('[专注模式] 保存合集失败:', err);
            // 即使保存失败也重新渲染，因为已经添加到内存中的集合
            this.renderCollections();
            alert('已添加到本页面，但保存可能未完全成功，刷新后可能需要重新添加');
          });
      } catch (err) {
        console.error('[专注模式] 显示简单对话框失败:', err);
        alert('添加合集失败，请重试');
        
        // 极端情况下的回退 - 直接通过硬编码添加一个测试合集
        try {
          const fallbackCollection = {
            title: "测试合集",
            url: "https://www.bilibili.com/",
            desc: "通过回退机制添加的测试合集",
            created: new Date().getTime()
          };
          
          if (!Array.isArray(this.collections)) {
            this.collections = [];
          }
          this.collections.push(fallbackCollection);
          
          localStorage.setItem('focusedCollections', JSON.stringify(this.collections));
          this.renderCollections();
        } catch (finalErr) {
          console.error('[专注模式] 最终回退失败:', finalErr);
        }
      }
    }

    /**
     * 加载UI工具
     * 避免覆盖已存在的UIUtils实现
     */
    loadUIUtils() {
      // 检查是否已加载原始的UIUtils
      if (typeof UIUtils !== 'undefined' && typeof UIUtils.createDialog === 'function') {
        console.log('[专注模式] 使用已加载的UIUtils');
        return UIUtils;
      }
      
      console.log('[专注模式] 创建UIUtils备用实现');
      
      // 创建UIUtils的简单实现，但避免替换已存在的全局实现
      const backupUIUtils = {
        createDialog: function(options) {
          // 创建背景
          const dialogBackground = document.createElement('div');
          dialogBackground.className = 'focused-ext-dialog-overlay dialog-overlay'; // 添加命名空间前缀
          
          // 创建对话框
          const dialog = document.createElement('div');
          dialog.className = 'focused-ext-dialog dialog'; // 添加命名空间前缀
          
          if (options.width) {
            dialog.style.width = options.width;
          }
          
          if (options.className) {
            dialog.classList.add(options.className);
          }
          
          // 设置对话框内容
          let dialogContent = `<h3>${options.title || '提示'}</h3>`;
          dialogContent += options.content || '';
          
          // 添加按钮
          dialogContent += `<div class="dialog-buttons">`;
          if (options.buttons && options.buttons.length > 0) {
            options.buttons.forEach(button => {
              dialogContent += `<button class="dialog-button ${button.type || 'secondary'}" id="${button.id || ''}">${button.text}</button>`;
            });
          } else {
            // 默认确定按钮
            dialogContent += `<button class="dialog-button primary" id="dialog-ok">确定</button>`;
          }
          dialogContent += `</div>`;
          
          dialog.innerHTML = dialogContent;
          
          // 添加到页面
          dialogBackground.appendChild(dialog);
          document.body.appendChild(dialogBackground);
          
          // 添加样式以确保对话框可见
          setTimeout(() => {
            dialogBackground.classList.add('active');
          }, 10);
          
          // 绑定按钮事件
          if (options.buttons) {
            options.buttons.forEach(button => {
              const buttonElement = button.id ? dialog.querySelector(`#${button.id}`) : 
                                              dialog.querySelector(`.dialog-button:contains('${button.text}')`);
              if (buttonElement && button.onClick) {
                buttonElement.addEventListener('click', (e) => {
                  try {
                    button.onClick(e, dialog, dialogBackground);
                  } catch (err) {
                    console.error('[专注模式] 对话框按钮事件错误:', err);
                    // 出错时默认关闭对话框
                    if (dialogBackground.parentNode) {
                      dialogBackground.parentNode.removeChild(dialogBackground);
                    }
                  }
                });
              }
            });
          } else {
            // 默认确定按钮行为
            const okButton = dialog.querySelector('#dialog-ok');
            if (okButton) {
              okButton.addEventListener('click', () => {
                this.closeDialog(dialogBackground);
              });
            }
          }
          
          return { dialog, background: dialogBackground };
        },
        
        closeDialog: function(dialogBackground) {
          if (dialogBackground && dialogBackground.parentNode) {
            // 先移除active类，添加淡出效果
            dialogBackground.classList.remove('active');
            // 等待过渡动画完成
            setTimeout(() => {
              if (dialogBackground.parentNode) {
                dialogBackground.parentNode.removeChild(dialogBackground);
              }
            }, 300);
          }
        },
        
        showMessage: function(message, type = 'success', duration = 3000) {
          // 创建消息元素
          const messageElement = document.createElement('div');
          messageElement.className = 'focused-ext-message'; // 添加命名空间前缀
          messageElement.textContent = message;
          messageElement.style.position = 'fixed';
          messageElement.style.bottom = '20px';
          messageElement.style.left = '50%';
          messageElement.style.transform = 'translateX(-50%)';
          messageElement.style.padding = '10px 20px';
          messageElement.style.borderRadius = '4px';
          messageElement.style.zIndex = '999999'; // 提高层级，避免被站点元素覆盖
          messageElement.style.transition = 'opacity 0.3s';
          messageElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
          
          // 设置消息类型样式
          switch (type) {
            case 'error':
              messageElement.style.backgroundColor = '#f44336';
              break;
            case 'info':
              messageElement.style.backgroundColor = '#2196f3';
              break;
            default:
              messageElement.style.backgroundColor = '#4caf50';
          }
          messageElement.style.color = 'white';
          
          document.body.appendChild(messageElement);
          
          // 自动移除消息
          setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
              if (messageElement.parentNode) {
                document.body.removeChild(messageElement);
              }
            }, 300);
          }, duration);
        }
      };
      
      // 只有在全局UIUtils不存在的情况下才设置全局变量
      if (typeof UIUtils === 'undefined') {
        window.UIUtils = UIUtils = backupUIUtils;
        console.log('[专注模式] 已设置全局UIUtils备用实现');
      } else {
        console.log('[专注模式] 使用局部UIUtils备用实现，不覆盖全局变量');
      }
      
      return backupUIUtils;
    }

    /**
     * 渲染合集卡片列表
     * 显示用户保存的B站内容收藏
     */
    renderCollections() {
      try {
        // 获取合集容器
        const container = document.querySelector('.collections-container');
        if (!container) {
          console.error('[专注模式] 找不到合集容器元素');
          return;
        }
        
        // 清空容器
        container.innerHTML = '';
        
        // 确保collections是数组
        if (!this.collections) {
          this.collections = [];
        }
        
        if (!Array.isArray(this.collections)) {
          console.error('[专注模式] collections不是数组类型，重置为空数组');
          this.collections = [];
        }
        
        // 如果没有合集，显示更美观的空状态提示
        if (this.collections.length === 0) {
          container.innerHTML = `
            <div class="empty-collections">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                <path d="M14.5 11c.83 0 1.5-.67 1.5-1.5S15.33 8 14.5 8 13 8.67 13 9.5s.67 1.5 1.5 1.5zm-5 2c.83 0 1.5-.67 1.5-1.5S10.33 10 9.5 10 8 10.67 8 11.5 8.67 13 9.5 13z"/>
                <path d="M14.5 13c-1.03 0-1.98.39-2.7 1.01-.29-.37-.71-.62-1.2-.71-.5-.1-1-.05-1.44.14-.46.18-.84.53-1.09.97C7.46 15.34 7 16.38 7 17.5V18h11v-.5c0-2.48-2.02-4.5-4.5-4.5z"/>
              </svg>
              <p>暂无合集，点击上方"添加合集"开始创建</p>
            </div>
          `;
          return;
        }
        
        console.log(`[专注模式] 渲染${this.collections.length}个合集`);
        
        // 遍历渲染每个合集卡片
        this.collections.forEach((col, idx) => {
          try {
            // 创建卡片元素
            const card = document.createElement('div');
            card.className = 'collection-card';
            card.title = `${col.title || '未命名合集'} - 点击打开`;  // 添加title属性，提高可访问性
            
            // 验证合集数据并设置默认值
            const title = col.title || '未命名合集';
            const desc = col.desc || '';
            const url = col.url || '#';
            const created = col.created ? new Date(col.created).toLocaleDateString() : '未知时间';
            
            // 设置卡片内容
            card.innerHTML = `
              <div class="collection-content">
                <div class="collection-title">${title}</div>
                <div class="collection-description">${desc}</div>
              </div>
              <div class="collection-meta">
                <span>${created}</span>
                <div>
                  <button class="collection-delete-btn" data-idx="${idx}" title="删除此合集">删除</button>
                  <a href="${url}" target="_blank" class="dialog-button primary" title="在新标签页中打开合集">打开</a>
                </div>
              </div>
            `;
            
            // 添加到容器
            container.appendChild(card);
          } catch (cardError) {
            console.error(`[专注模式] 渲染第${idx}个合集卡片出错:`, cardError);
          }
        });
        
        // 绑定所有删除按钮事件（使用事件委托以提高性能）
        // 避免重复添加事件监听器导致内存泄漏
        if (!this._eventListenersAttached) {
          container.addEventListener('click', this.handleCollectionEvents.bind(this));
          this._eventListenersAttached = true;
          console.log('[专注模式] 已添加集合事件监听器');
        }
      } catch (err) {
        console.error('[专注模式] 渲染合集列表时出错:', err);
        
        // 尝试恢复渲染
        const container = document.querySelector('.collections-container');
        if (container) {
          container.innerHTML = '<div style="color:#f44336;text-align:center;padding:40px 0;">渲染合集时出错，请刷新页面重试</div>';
        }
      }
    }
    
    /**
     * 处理合集相关的事件
     * 将事件处理程序提取为单独的方法，方便解绑
     */
    handleCollectionEvents(e) {
      if (e.target.classList.contains('collection-delete-btn')) {
        try {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          if (!isNaN(idx) && idx >= 0 && idx < this.collections.length) {
            // 显示确认对话框
            if (confirm('确定要删除这个合集吗？')) {
              this.collections.splice(idx, 1);  // 从数组中移除
              
              // 立即更新本地存储，确保数据同步
              try {
                localStorage.setItem('focusedCollections', JSON.stringify(this.collections));
                localStorage.setItem('focusedCollections_backup', JSON.stringify(this.collections));
              } catch (localErr) {
                console.warn('[专注模式] 本地存储更新失败:', localErr);
              }
              
              this.saveCollections();  // 异步保存
              this.renderCollections(); // 立即重新渲染
              
              // 尝试显示成功消息
              try {
                if (typeof UIUtils !== 'undefined' && typeof UIUtils.showMessage === 'function') {
                  UIUtils.showMessage('删除成功', 'info');
                }
              } catch (msgError) {
                console.warn('[专注模式] 显示删除成功消息失败:', msgError);
              }
            }
          }
        } catch (deleteError) {
          console.error('[专注模式] 删除合集时出错:', deleteError);
          alert('删除合集时出错，请重试');
          
          // 尝试恢复
          this.renderCollections();
        }
      } else if (e.target.tagName === 'A' && e.target.classList.contains('primary')) {
        // 链接点击事件 - 记录操作并进行额外处理
        try {
          console.log('[专注模式] 用户点击了合集链接');
          // 不需要阻止默认行为，让链接正常打开
        } catch (linkError) {
          console.error('[专注模式] 处理链接点击事件出错:', linkError);
        }
      } else if (e.target.closest('.collection-card')) {
        // 点击卡片其他区域 - 也可以触发打开操作
        try {
          const card = e.target.closest('.collection-card');
          const linkElement = card.querySelector('a.primary');
          if (linkElement && linkElement.href) {
            console.log('[专注模式] 用户点击了合集卡片，即将打开:', linkElement.href);
            window.open(linkElement.href, '_blank');
          }
        } catch (cardError) {
          console.error('[专注模式] 处理卡片点击事件出错:', cardError);
        }
      }
    }
    
    /**
     * 从本地存储加载合集
     * @returns {Promise} 加载完成的Promise
     */
    async loadCollections() {
      console.log('[专注模式] 开始加载合集数据');
      let collections = null;
      let loadedFrom = '';
      
      try {
        // 记录当前尝试的来源，便于调试
        let currentSource = '';
        
        // 1. 首先检查localStorage备份，这样即使后续所有加载方式都失败，也能保证有数据
        try {
          currentSource = 'localStorage备份';
          const backupData = localStorage.getItem('focusedCollections_backup');
          if (backupData) {
            collections = JSON.parse(backupData);
            console.log(`[专注模式] 从${currentSource}成功加载合集:`, collections.length);
            loadedFrom = currentSource;
          }
        } catch (backupError) {
          console.warn(`[专注模式] 从${currentSource}加载失败:`, backupError);
          // 继续尝试其他来源
        }
        
        // 2. 尝试从主localStorage加载
        if (!collections) {
          try {
            currentSource = 'localStorage主存储';
            const localData = localStorage.getItem('focusedCollections');
            if (localData) {
              collections = JSON.parse(localData);
              console.log(`[专注模式] 从${currentSource}成功加载合集:`, collections.length);
              loadedFrom = currentSource;
            }
          } catch (localError) {
            console.warn(`[专注模式] 从${currentSource}加载失败:`, localError);
            // 继续尝试其他来源
          }
        }
        
        // 3. 尝试使用StorageUtils
        if ((!collections || collections.length === 0) && 
            typeof StorageUtils !== 'undefined' && typeof StorageUtils.load === 'function') {
          try {
            currentSource = 'StorageUtils';
            console.log('[专注模式] 尝试通过StorageUtils加载');
            const data = await StorageUtils.load('focusedCollections', []);
            
            if (data && Array.isArray(data) && data.length > 0) {
              collections = data;
              console.log(`[专注模式] 从${currentSource}成功加载合集:`, collections.length);
              loadedFrom = currentSource;
            }
          } catch (storageError) {
            console.warn(`[专注模式] 从${currentSource}加载失败:`, storageError);
            // 继续尝试其他来源
          }
        }
        
        // 4. 尝试直接使用chrome.storage
        if ((!collections || collections.length === 0) && 
            typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          try {
            currentSource = 'chrome.storage';
            console.log('[专注模式] 尝试通过chrome.storage直接加载');
            
            const data = await new Promise((resolve, reject) => {
              try {
                chrome.storage.local.get(['focusedCollections'], (result) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(result.focusedCollections);
                  }
                });
              } catch (e) {
                // 捕获可能的同步错误
                reject(e);
              }
            });
            
            if (data && Array.isArray(data) && data.length > 0) {
              collections = data;
              console.log(`[专注模式] 从${currentSource}成功加载合集:`, collections.length);
              loadedFrom = currentSource;
            }
          } catch (chromeError) {
            console.warn(`[专注模式] 从${currentSource}加载失败:`, chromeError);
            // 所有方法都尝试过了
          }
        }
        
        // 验证加载的数据
        if (collections && !Array.isArray(collections)) {
          console.warn('[专注模式] 加载的合集数据不是数组，重置为空数组');
          collections = [];
        }
        
        // 如果所有加载方法都失败，使用空数组
        if (!collections) {
          console.warn('[专注模式] 所有加载方法都失败，使用空数组');
          collections = [];
        }
        
        this.collections = collections;
        
        console.log(`[专注模式] 最终加载完成，来源: ${loadedFrom || '无有效来源'}，合集数: ${collections.length}`);
        
        // 如果从localStorage或备份加载成功，但没有从Chrome存储加载，尝试同步回Chrome存储
        if (collections.length > 0 && loadedFrom.includes('localStorage') && 
            typeof StorageUtils !== 'undefined' && typeof StorageUtils.save === 'function') {
          try {
            console.log('[专注模式] 尝试同步数据回Chrome存储');
            await StorageUtils.save('focusedCollections', collections);
            console.log('[专注模式] 同步到Chrome存储成功');
          } catch (syncError) {
            console.warn('[专注模式] 同步到Chrome存储失败:', syncError);
            // 同步失败不影响主流程
          }
        }
        
        return collections;
      } catch (error) {
        console.error('[专注模式] 加载合集数据失败:', error);
        // 最终回退到空数组
        this.collections = [];
        return [];
      }
    }

    /**
     * 保存合集到本地存储
     * 优先使用Chrome存储API，回退到localStorage
     */
    async saveCollections() {
      console.log('[专注模式] 开始保存合集', this.collections?.length || 0, '个');
      
      // 验证合集数据
      if (!Array.isArray(this.collections)) {
        console.warn('[专注模式] 保存前发现collections不是数组，已重置为空数组');
        this.collections = [];
      }
      
      // 创建备份 - 不管其他保存方式是否成功，都确保本地备份可用
      try {
        console.log('[专注模式] 创建本地备份');
        localStorage.setItem('focusedCollections_backup', JSON.stringify(this.collections));
        localStorage.setItem('focusedCollections', JSON.stringify(this.collections));
        console.log('[专注模式] 本地备份创建成功');
      } catch (backupError) {
        console.warn('[专注模式] 创建合集备份失败:', backupError);
      }
      
      // 尝试所有可能的保存方式，确保至少一种方式成功
      let saveSuccess = false;
      
      // 1. 尝试使用StorageUtils
      if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.save === 'function') {
        try {
          console.log('[专注模式] 尝试通过StorageUtils保存');
          await StorageUtils.save('focusedCollections', this.collections);
          console.log('[专注模式] 通过StorageUtils保存成功');
          saveSuccess = true;
        } catch (storageError) {
          console.warn('[专注模式] StorageUtils保存失败:', storageError);
          // 记录错误，继续尝试其他方法
          console.error('详细错误:', storageError.message, storageError.stack);
        }
      } else {
        console.warn('[专注模式] StorageUtils不可用');
      }
      
      // 2. 如果StorageUtils失败，尝试直接使用chrome.storage
      if (!saveSuccess && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          console.log('[专注模式] 尝试通过chrome.storage直接保存');
          await new Promise((resolve, reject) => {
            const data = {};
            data['focusedCollections'] = this.collections;
            
            try {
              chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            } catch (e) {
              // 捕获任何同步错误
              reject(e);
            }
          });
          console.log('[专注模式] 通过chrome.storage直接保存成功');
          saveSuccess = true;
        } catch (chromeError) {
          console.warn('[专注模式] chrome.storage保存失败:', chromeError);
          // 记录错误，继续尝试其他方法
          console.error('详细错误:', chromeError.message, chromeError.stack);
        }
      }
      
      // 本地存储已经在前面备份过，这里直接返回成功
      // 因为我们不想在此函数中抛出错误，这会导致添加合集流程中断
      return true;
    }
    
    /**
     * 清理资源，移除所有监听器和DOM元素
     */
    destroy() {
      // 移除DOM元素
      const container = document.querySelector('.focused-homepage-container');
      if (container) {
        container.remove();
      }
      
      // 移除DOM观察器
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      // 移除搜索优化相关资源
      if (this.searchObserver) {
        this.searchObserver.disconnect();
        this.searchObserver = null;
      }
      
      // 清理键盘事件监听器
      if (this.keyboardEventHandler) {
        document.removeEventListener('keydown', this.keyboardEventHandler);
        this.keyboardEventHandler = null;
      }
      
      // 重置状态
      this.initialized = false;
          this._eventListenersAttached = false;
      this.searchInitialized = false;
      
      console.log('[专注模式] 已清理资源');
    }

    /**
     * 初始化搜索页面优化
     */
    async initializeSearchOptimizer() {
      if (this.searchInitialized) return true;
      
      try {
        console.log('[专注模式] 初始化搜索优化');
        
        // 使用内置的搜索页面优化
        this.setupBasicSearchOptimization();
        this.searchInitialized = true;
        return true;
      } catch (err) {
        console.error('[专注模式] 初始化搜索优化失败:', err);
        return false;
      }
    }

    /**
     * 设置基础搜索优化实现作为备用
     */
    setupBasicSearchOptimization() {
      console.log('[专注模式] 设置基础搜索优化');
      
      // 搜索结果页面简化
      const searchStyles = `
        .search-content .video-list .bili-video-card:not([data-v-category*="教育"]):not([data-v-category*="科技"]):not([data-v-category*="知识"]) {
          opacity: 0.6;
        }
        .search-content .channel-items, 
        .search-content .safe-btn,
        .search-content .right-container .ad-report,
        #server-search-app .right-container .ad-report,
        .search-page .right-container .ad-report,
        [class*="ad-report"],
        [class*="bili-advert"] {
          display: none !important;
        }
      `;
      
      ensureStylesOnce('basic-search-optimization', searchStyles);
      
      // 处理搜索行为
      document.addEventListener('click', e => {
        // 查找搜索按钮
        if (e.target.matches('.search-button') || 
            e.target.closest('.search-button') || 
            e.target.matches('button[type="submit"]')) {
          
          const searchInput = document.querySelector('.search-input input') || 
                              document.querySelector('input[type="search"]');
          
          if (searchInput && searchInput.value) {
            e.preventDefault();
            const searchTerm = searchInput.value.trim();
            const searchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(searchTerm)}`;
            
            safeNavigate(searchUrl, false); // 使用传统导航方法
          }
        }
      });

      // 添加教育内容标记
      this.addSearchPageStyles();
      
      // 优化搜索页面
      this.optimizeSearchPage();
      
      // 设置搜索页面观察器
      this.setupSearchObserver();
    }
    
    /**
     * 添加搜索页面优化样式
     */
    addSearchPageStyles() {
      ensureStylesOnce('search-page-styles', `
        /* 搜索页面优化样式 */
        .search-container .suggest-wrap,
        #server-search-app .suggest-wrap,
        .search-page .suggest-wrap {
          display: none !important;
        }
        
        /* 隐藏右侧广告和推广内容 */
        .search-container .right-container .ad-report,
        #server-search-app .right-container .ad-report,
        .search-page .right-container .ad-report,
        [class*="ad-report"],
        [class*="bili-advert"] {
          display: none !important;
        }
        
        /* 隐藏视频卡片上的多余信息 */
        .search-container .bili-video-card .bili-video-card__info--bottom,
        #server-search-app .bili-video-card .bili-video-card__info--bottom,
        .video-list .video-item .info .upname,
        [class*="video-list"] [class*="duration"] {
          opacity: 0.6;
        }
        
        /* 突出显示视频标题 */
        .search-container .bili-video-card .bili-video-card__info--tit,
        #server-search-app .bili-video-card .bili-video-card__info--tit,
        .video-list .video-item .title,
        [class*="video-title"],
        a.title {
          font-weight: bold;
        }
        
        /* 专注模式下更清晰的布局 */
        .search-container .search-page-wrapper,
        #server-search-app .search-page-wrapper,
        .search-page .search-result-container {
          max-width: 1000px;
          margin: 0 auto;
        }
        
        /* 教育内容标记 */
        .education-content-tag {
          background-color: #00aeec;
          color: #fff;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
          margin-left: 5px;
          display: inline-block;
        }
      `);
      
      safeLog('搜索优化', '样式已添加');
    }
    
    /**
     * 设置搜索页面DOM观察器
     */
    setupSearchObserver() {
      try {
        // 查找搜索容器元素，限制观察范围
        const searchContainer = document.querySelector(this.searchSelectors.searchContainer.join(','));
        const resultList = document.querySelector(this.searchSelectors.resultList.join(','));
        
        // 如果找不到容器，则观察body，但限制变更类型
        const target = resultList || searchContainer || document.body;
        
        // 使用DOMObserver类创建观察器
        this.searchObserver = DOMObserver.observe(
          target, 
          () => this.optimizeSearchPage(),
          null,
          true // 使用节流
        );
        
        safeLog('搜索优化', '观察器已设置');
      } catch (err) {
        safeLog('搜索优化', '设置观察器失败', 'error', err);
      }
    }
    
    /**
     * 优化搜索页面
     * - 隐藏干扰内容
     * - 突出显示有用信息
     */
    optimizeSearchPage() {
      try {
        // 处理搜索页面广告
        this.hideAds();
        
        // 优化搜索结果布局
        this.optimizeSearchLayout();
        
        // 突出显示教育类内容
        this.highlightEducationalContent();
        
        safeLog('搜索优化', '页面已优化');
      } catch (err) {
        safeLog('搜索优化', '优化页面失败', 'error', err);
      }
    }
    
    /**
     * 隐藏广告和干扰内容
     */
    hideAds() {
      // 广告选择器
      const adSelectors = [
        '.ad-report', 
        '.bilibili-player-promote',
        '.suggest-item[data-type="ad"]', 
        '.video-list-item.special-card',
        '[class*="ad-report"]',
        '[class*="bili-advert"]',
        '[data-loc-id*="ad"]'
      ];
      
      // 使用健壮选择器查找广告元素
      const ads = robustSelector(adSelectors);
        
      // 隐藏查找到的广告元素
      if (ads && ads.length) {
        ads.forEach(ad => {
          if (ad && ad.style) {
            ad.style.display = 'none';
          }
        });
        safeLog('搜索优化', `隐藏了 ${ads.length} 个广告元素`);
      }
    }
    
    /**
     * 优化搜索结果布局
     */
    optimizeSearchLayout() {
      // 使用更健壮的选择器组合，适应B站新界面
      const navSelectors = [
        '.search-nav-wrap',
        '.search-page__head',
        '.search-navigator',
        '.bili-header__channel'  // 添加新的导航栏选择器
      ];
      
      // 使用robustSelector工具函数查找元素
      const navElement = robustSelector(navSelectors);
      
      if (navElement) {
        // 添加标识类名，便于后续处理
        navElement.classList.add('focus-optimized-nav');
        
        // 简化导航栏，移除不必要元素
        const nonEssentialSelectors = [
          '.trending', '.live-tab', '.bangumi-tab',
          '.pgc-tab', '.upuser-tab', '.article-tab'
        ];
        
        nonEssentialSelectors.forEach(selector => {
          const elements = navElement.querySelectorAll(selector);
          elements.forEach(el => {
            el.style.display = 'none';
          });
        });
      }
    }
    
    /**
     * 突出显示教育类内容
     */
    highlightEducationalContent() {
      // 查找包含"教育"、"学习"、"课程"等关键词的内容
      const educationalKeywords = ['教育', '学习', '课程', '培训', '讲座', '教程', '知识'];
      
      // 获取所有视频卡片
      const videoCards = robustSelector(this.searchSelectors.videoCards);
      
      if (!videoCards || !videoCards.length) {
        safeLog('搜索优化', '未找到视频卡片元素');
        return;
      }
      
      videoCards.forEach(card => {
        // 安全地检查元素
        if (!card || !card.style) return;
        
        // 获取标题元素
        const title = card.querySelector(this.searchSelectors.titleElement.join(','));
        if (!title || !title.textContent) return;
        
        // 检查标题是否包含教育关键词
        const isEducational = educationalKeywords.some(keyword => 
          title.textContent.includes(keyword)
        );
        
        if (isEducational) {
          // 添加特殊样式突出显示
          card.style.border = '2px solid #00aeec';
          card.style.boxShadow = '0 0 8px rgba(0, 174, 236, 0.2)';
          
          // 如果卡片上已有"学习内容"标签，不重复添加
          if (card.querySelector('.education-content-tag')) return;
          
          // 尝试找合适的容器添加标签
          const tagContainer = card.querySelector('.bili-video-card__info--owner, .info, .upname') 
                            || card.querySelector('.video-item .title')?.parentElement
                            || title.parentElement;
                            
          if (tagContainer) {
            const educationTag = document.createElement('span');
            educationTag.className = 'education-content-tag';
            educationTag.textContent = '学习内容';
            tagContainer.appendChild(educationTag);
          }
        }
      });
    }
    
    
    /**
     * 处理全局设置 - 已重构为使用统一的GlobalSettingsManager
     * @deprecated 使用 GlobalSettingsManager.handleGlobalSettings() 替代
     */
    async handleGlobalSettings() {
      console.warn('[专注模式] handleGlobalSettings已废弃，请使用GlobalSettingsManager.handleGlobalSettings()');
      return GlobalSettingsManager.handleGlobalSettings();
    }
    
    /**
     * @deprecated 这些方法已移至 GlobalSettingsManager，请使用统一的设置管理器
     */
    
    // ✅ showPasswordDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ showRemindersDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ showConfirmDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ showMessage 已移至 GlobalSettingsManager (美化版本)
    
    
    /**
     * 重置搜索界面
     * 清除搜索框，重新加载合集
     */
    async resetSearchInterface() {
      try {
        console.log('[专注模式] 正在重置搜索界面');
        
        // 直接调用统一的设置管理方法，避免代码重复
        // 如果用户只想重置搜索界面，显示选项对话框
        const confirmed = confirm('是否要打开设置菜单？\n确定 - 打开完整设置菜单\n取消 - 仅重置搜索界面');
        if (confirmed) {
          // 调用统一的设置管理方法
          await GlobalSettingsManager.handleGlobalSettings();
        } else {
          // 直接重置搜索界面
          this.clearSearchAndReloadCollections();
        }
      } catch (err) {
        console.error('[专注模式] 重置搜索界面失败:', err);
        // 出错时直接使用简单重置
        this.clearSearchAndReloadCollections();
      }
    }
    
    /**
     * 清空搜索框并重新加载合集
     * 作为resetSearchInterface的辅助方法
     */
    clearSearchAndReloadCollections() {
      // 查找搜索输入框
      const searchInput = document.querySelector('.focused-search-input');
      if (searchInput) {
        searchInput.value = ''; // 清空搜索框
      }
    
      // 重新加载合集数据
      this.loadCollections().then(() => {
        // 重新渲染合集
        this.renderCollections();
        
        // 显示成功消息
        const uiUtils = this.ensureUIUtils();
        if (uiUtils) {
          this.showMessage('搜索界面已重置', 'success', uiUtils);
        } else {
          // 如果无法获取UIUtils，使用简单提示
          alert('搜索界面已重置');
        }
      });
    }

  }

  // 创建类实例 - 只在静态初始化失败时使用此方法
  document.addEventListener('DOMContentLoaded', () => {
    // 如果还没有实例且在首页，尝试创建实例
    if (!window.focusedHomepage && isHomepage()) {
      window.focusedHomepage = new FocusedHomepage();
    }
  });

  // 在页面卸载前清理资源
  window.addEventListener('beforeunload', () => {
    if (window.focusedHomepage) {
      window.focusedHomepage.destroy();
    }
  });

  // 导出全局变量
  window.FocusedHomepage = FocusedHomepage;

  console.log('[专注模式] focused-homepage.js 加载完成 - ' + new Date().toISOString());
  console.log('[专注模式] FocusedHomepage类是否可用:', typeof FocusedHomepage === 'function');

  // 新增: 强制渲染专注模式界面
  function forceRenderFocusedInterface() {
    // 如果FocusedHomepage类已加载，立即创建实例并初始化
    if (typeof window.FocusedHomepage === 'function') {
      if (!window.focusedHomepage) {
        window.focusedHomepage = new window.FocusedHomepage();
        console.log('[专注模式] 提前创建FocusedHomepage实例');
      }
      
      // 强制初始化
      if (window.focusedHomepage.init) {
        window.focusedHomepage.init(true);
        console.log('[专注模式] 提前强制初始化专注界面');
      }
    } else {
      // 如果类未加载，设置一个定时器等待类加载
      console.log('[专注模式] 等待FocusedHomepage类加载...');
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkClass = () => {
        attempts++;
        if (typeof window.FocusedHomepage === 'function') {
          if (!window.focusedHomepage) {
            window.focusedHomepage = new window.FocusedHomepage();
          }
          
          if (window.focusedHomepage.init) {
            window.focusedHomepage.init(true);
            console.log('[专注模式] 延迟初始化专注界面成功');
          }
        } else if (attempts < maxAttempts) {
          setTimeout(checkClass, 100);
        }
      };
      
      checkClass();
    }
  }
})(); 