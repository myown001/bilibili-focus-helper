/**
 * 首页专注搜索类
 * 替换B站首页为专注学习界面，提供简洁的搜索和合集管理
 */
(function() {
  'use strict';
  
  // 立即执行的自调用函数，在document_start阶段立即拦截
  const immediateInitializer = function() {
    // 只在首页执行
    if (!isHomepage()) return;
    
    console.log('[专注模式] 即时拦截B站首页加载');
    
    // 在最早期阻止页面渲染原始内容
    blockOriginalContent();
    
    // 阻止所有非必要的资源加载
    setupResourceBlocker();
    
    // 设置DOM变更监控，防止B站重新渲染
    setupMutationGuard();
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
      html > body > *:not(#focused-placeholder):not(.focused-homepage-container):not(style):not(script) {
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
        console.log('[专注模式] 检测到B站首页，准备拦截');
        
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
      
      // 为所有页面添加URL变化监听，确保在从其他页面返回首页时能够触发拦截
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
          console.log('[专注模式] 导航到首页，激活专注模式');
          
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
        
        /* 使用通配符选择器强制隐藏所有B站原始内容元素 */
        body > *:not(#focused-early-styles):not(.focused-homepage-container):not(.dialog-overlay):not(style):not(script) {
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
        
        /* 特定针对B站常见容器的强化隐藏 */
        #app, #i_cecream, .bili-header, .bili-layout, .bili-feed, .bili-footer, 
        .international-header, .bili-wrapper, .bili-container, #bili-header-container,
        .bili-video-card, .feed-card, .bili-banner, .tab-bar, .bili-grid, #internationalHeader,
        .bili-feed-card, .floor-single-card, .canvas-cover {
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
      
      console.log('[专注模式] 已添加早期样式拦截');
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
      
      // 使用延迟初始化
      this.init = this.init.bind(this);
      
      // 检查依赖项是否已加载
      this.checkDependencies();
      
      // 配置DOM观察器，监控DOM变化
      this.setupDOMObserver();
      
      // 尽早初始化
      if (document.readyState === 'loading') {
        // 如果页面还在加载，则等待DOMContentLoaded事件
        document.addEventListener('DOMContentLoaded', () => this.init());
        
        // 添加早期样式，避免原首页闪烁
        FocusedHomepage.addEarlyStyles();
      } else {
        // 页面已加载，立即初始化
        this.init();
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
      // 如果已初始化且非强制，则跳过
      if (this.initialized && !force) return;
      
      console.log('[专注模式] 开始初始化首页专注模式');
      this.initialized = true;

      // 先添加完整样式
      this.addStyles();
      
      // 立即隐藏原内容
      this.hideOriginalContent();
      
      // 创建专注界面（分批执行DOM操作，提高响应速度）
      setTimeout(() => this.createFocusedInterface(), 10);
      
      // 加载并渲染收藏合集
      setTimeout(() => {
        this.loadCollections().then(() => {
          this.renderCollections();
          this.setupEventListeners();
        });
      }, 100);
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
              <h1 style="color: #00a1d6;">B站专注学习模式</h1>
              <p style="color: #666;">创建界面时出错，请刷新页面重试</p>
              <button onclick="location.reload()" style="background: #00a1d6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 20px;">刷新页面</button>
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
          background: #f6f7f8;
          text-size-adjust: 100%;
          -webkit-text-size-adjust: 100%;
          -moz-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }

        /* 容器样式 */
        .focused-homepage-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
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
          margin-bottom: 48px;
        }

        .focused-title {
          font-size: 32px;
          font-weight: 600;
          color: #18191c;
          margin-bottom: 32px;
          text-align: center;
        }

        .focused-search-box {
          display: flex;
          max-width: 600px;
          margin: 0 auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: all 0.3s ease;
          will-change: transform, box-shadow;
        }

        .focused-search-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .focused-search-input {
          flex: 1;
          padding: 16px 20px;
          font-size: 16px;
          border: none;
          outline: none;
          transition: background-color 0.3s ease;
        }

        .focused-search-input:focus {
          background-color: #f8f9fa;
        }

        .focused-search-button {
          padding: 0 24px;
          background: #00a1d6;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .focused-search-button:hover {
          background: #00b5e5;
        }

        .search-icon {
          width: 24px;
          height: 24px;
          fill: #fff;
        }

        /* 合集区域样式 */
        .focused-collections-section {
          margin-top: 48px;
        }

        .collections-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 0;
          background-color: #f6f7f8;
          padding: 10px 0;
          z-index: 10;
        }

        .collections-title {
          font-size: 24px;
          font-weight: 600;
          color: #18191c;
          margin: 0;
        }

        .add-collection-button {
          display: flex;
          align-items: center;
          padding: 12px 24px;
          background: #00a1d6 !important;
          color: #fff !important;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.3s ease;
          will-change: transform;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 20;
          min-width: 140px;
        }

        .add-collection-button:hover {
          background: #00b5e5 !important;
          color: #fff !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .add-collection-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .add-icon {
          width: 20px;
          height: 20px;
          fill: #fff;
          margin-right: 8px;
        }

        /* 合集网格样式 */
        .collections-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.5s ease forwards 0.3s;
          min-height: 100px;
        }

        /* 合集卡片样式 */
        .collection-card {
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: all 0.3s ease;
          will-change: transform, box-shadow;
          cursor: pointer;
          width: 100%;
          width: -webkit-fill-available;
          width: -moz-available;
          width: stretch;
        }

        .collection-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .collection-content {
          padding: 16px;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .collection-title {
          font-size: 18px;
          font-weight: 600;
          color: #18191c;
          margin: 0 0 8px;
          line-height: 1.4;
        }

        .collection-description {
          color: #61666d;
          font-size: 14px;
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
          padding: 12px 16px;
          border-top: 1px solid #f4f5f7;
          color: #9499a0;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
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
          padding: 24px;
          width: 500px;
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
          margin: 0 0 20px;
          font-size: 20px;
          font-weight: 600;
          color: #18191c;
        }

        .dialog-form-group {
          margin-bottom: 16px;
        }

        .dialog-form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #18191c;
        }

        .dialog-form-group input,
        .dialog-form-group textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e3e5e7;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.3s ease;
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
          margin-top: 24px;
        }

        .dialog-button {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
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
     * 处理搜索请求
     * 跳转到B站搜索页面
     * @param {string} keyword - 搜索关键词
     */
    handleSearch(keyword) {
      if (!keyword) return;  // 关键词为空则不处理
      // 跳转到B站搜索页
      window.location.href = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
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
        
        // 如果没有合集，显示提示信息
        if (this.collections.length === 0) {
          container.innerHTML = '<div style="color:#888;text-align:center;padding:40px 0;">暂无合集，点击上方"添加合集"</div>';
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
                <button class="dialog-button secondary collection-delete-btn" data-idx="${idx}" style="font-size:12px;" title="删除此合集">删除</button>
                <a href="${url}" target="_blank" class="dialog-button primary" style="font-size:12px;" title="在新标签页中打开合集">打开</a>
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
     * 销毁观察器和事件监听器
     * 在页面卸载前清理资源
     */
    destroy() {
      // 断开MutationObserver连接
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      // 移除事件监听器
      if (this._eventListenersAttached) {
        const container = document.querySelector('.collections-container');
        if (container) {
          container.removeEventListener('click', this.handleCollectionEvents.bind(this));
          this._eventListenersAttached = false;
        }
      }
      
      console.log('[专注模式] 已清理资源');
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
})(); 