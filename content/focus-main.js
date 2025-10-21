// focus-main.js - 专注模式主入口文件
// 这是整个B站专注版插件的入口点，负责协调和初始化所有功能模块
// 需要了解的基础语法知识
// 1. JavaScript基础概念:
// 立即执行函数(IIFE): (function() { ... })() - 创建一个立即运行的匿名函数，避免变量污染全局空间
// 'use strict': 启用严格模式，提供更严格的错误检查
// async/await: 处理异步操作的现代语法，让异步代码更易读
// async function: 声明一个异步函数，允许使用await关键字
// await: 等待Promise完成，只能在async函数内使用
// 2. 变量和函数:
// 变量声明: const(常量)和let(变量)
// 箭头函数: () => {} - 简洁的函数写法，自动继承上下文的this
// 函数默认参数: function log(message, data = '')
// 3. DOM操作:
// 选择器: document.querySelector() - 查找匹配CSS选择器的第一个元素
// 事件监听: element.addEventListener('event', handler)
// DOM修改: 创建、修改、删除HTML元素和属性
// 4. Promise和异步编程:
// Promise: 处理异步操作的对象，有pending(进行中)、fulfilled(成功)、rejected(失败)三种状态
// new Promise((resolve, reject) => {}): 创建Promise对象
// setTimeout(): 延迟执行函数
// 5. 对象和类:
// 对象字面量: {key: value}
// 对象属性访问: object.property或object['property']
// 类实例化: new ClassName()
// 6. 浏览器API:
// console方法: console.log(), console.warn(), console.error()
// MutationObserver: 监视DOM变化的API
// 全屏API: document.fullscreenElement, requestFullscreen()
// 7. 正则表达式:
// /pattern/flags: 定义正则表达式，flags包括g(全局搜索)、i(不区分大小写)、m(多行模式)
// 字符类: [abc] - 匹配方括号内的任意一个字符
// 量词: {min,max} - 匹配指定次数
// 边界: ^ - 匹配字符串开头，$ - 匹配字符串结尾
// 8. 模块化:
// import/export: 模块化导入导出，支持按需加载
// 9. 错误处理:
// try/catch/finally: 捕获和处理错误，确保脚本不会因错误而崩溃
// 10. 性能优化:
// 节流/防抖: 限制函数执行频率，减少资源消耗

// 🔍 版本检测日志 - 立即执行
console.log('🚀 [focus-main.js] 文件开始加载 - v1.1.5 (使用hover处理菜单) - ' + new Date().toLocaleTimeString());

(function() {
  // 使用立即执行函数表达式(IIFE)包裹代码，避免变量污染全局作用域
  'use strict';
  // 启用严格模式，避免常见错误，如使用未声明变量

  async function main() {
    // main是异步主函数，整个插件从这里开始执行
    // async关键字允许在函数内使用await等待异步操作完成
    
    // 版本检查 - 确认代码已更新
    console.log('[专注模式] 🎉 主代码已加载 - 版本: 2024.1.15-FIXED');
    console.log('[专注模式] 📍 当前页面:', window.location.href);
    
    // 调试信息配置
    const DEBUG = true;  // 控制是否输出调试日志
    function log(message, data) {
      // 输出普通日志的辅助函数，仅在DEBUG为true时生效
      if (DEBUG) {
        console.log(`[专注模式] ${message}`, data || '');
        // 使用模板字符串添加前缀，方便在控制台识别
        // data || '' 表示如果data不存在则使用空字符串
      }
    }
    function warn(message, data) {
      // 输出警告日志的辅助函数，无论DEBUG如何都会执行
      console.warn(`[专注模式警告] ${message}`, data || '');
    }
    
    // 设置全局错误处理器
    if (typeof setupGlobalErrorHandlers === 'function') {
      // 检查函数是否存在且类型为function
      log('设置全局错误处理器');
      setupGlobalErrorHandlers();
    } else {
      log('全局错误处理函数不可用，跳过设置');
    }
    
    // 安全执行函数 - 包装try-catch以防止函数执行错误导致整个脚本崩溃
    function safeExecute(func, funcName, ...args) {
      try {
        // 尝试执行函数，传入所有参数
        return func(...args);
        // ...args是剩余参数语法，收集所有额外参数为数组
      } catch (err) {
        // 捕获并记录任何执行错误
        warn(`执行${funcName}失败:`, err);
        return null;
      }
    }
    
    // 确保依赖加载完成 - 检查所有必要的模块是否已加载
    async function ensureDependenciesLoaded() {
      return new Promise((resolve) => {
        // 创建新Promise对象，用于异步操作
        let attempts = 0;
        const maxAttempts = 20; // 最多尝试20次，每次500ms，共10秒
        
        const checkDependencies = () => {
          attempts++;
          
          // 检查核心工具类依赖
          const isUtilsReady = typeof ensureStylesOnce === 'function' && 
                              typeof StorageUtils === 'function' && 
                              typeof UIUtils === 'function' && 
                              typeof robustSelector === 'function' &&
                              typeof PageEnhancer === 'function';
                              
          // 检查核心功能类依赖                    
          const isFocusReady = typeof FocusMode === 'function' &&
                              typeof FocusSettingsManager === 'function' &&
                              typeof FirstTimeSetup === 'function' &&
                              typeof ExitHandler === 'function';
          
          // 定期记录依赖状态
          if (attempts % 5 === 0 || attempts === maxAttempts) {
            log(`依赖检查状态 (${attempts}/${maxAttempts}):`, {
              utils: isUtilsReady, 
              focus: isFocusReady
            });
          }
          
          // 判断依赖状态并决定下一步操作
          if (isUtilsReady && isFocusReady) {
            // 核心依赖已加载完成
            log('所有核心依赖已加载');
            resolve({
              success: true,
              utils: isUtilsReady,
              focus: isFocusReady
            });
          } else if (attempts >= maxAttempts) {
            // 达到最大尝试次数，放弃等待
            warn('依赖加载超时，尝试继续初始化');
            resolve({
              success: false,
              utils: isUtilsReady,
              focus: isFocusReady,
              search: isSearchReady
            });
          } else {
            // 继续等待，500ms后再次检查
            log(`等待依赖加载... (${attempts}/${maxAttempts})`);
            setTimeout(checkDependencies, 500);
            // setTimeout用于延迟执行函数
          }
        };
        
        // 开始检查依赖
        checkDependencies();
      });
    }
    
    // 检查并处理首次使用设置向导
    async function checkFirstTimeSetup() {
      try {
        // 确保设置管理器已加载
        if (typeof FocusSettingsManager !== 'function') {
          warn('设置管理器未加载，无法检查首次设置');
          return false;
        }
        
        // 直接从 Storage 读取最新设置，避免使用可能过期的实例缓存
        const settings = await FocusSettingsManager.loadSettings();
        
        // 显示首次使用向导
        if (settings.isFirstTime && typeof FirstTimeSetup === 'function') {
          log('检测到首次使用，显示设置向导');
          console.log('[专注模式] 🚀 首次设置触发！当前页面:', window.location.href);
          try {
            const firstTimeSetup = await SetupFactory.createFirstTimeSetup();
            
            // 如果在视频页面，暂时禁用自动全屏以避免冲突
            const isVideo = isVideoPage(window.location.href);
            if (isVideo && window.focusMode) {
              // 暂时禁用自动全屏监控
              window.focusMode._temporarilyDisableAutoFullscreen = true;
              log('暂时禁用自动全屏以避免与首次设置冲突');
            }
            
            await firstTimeSetup.showSetup();
            
            // ⚠️ 已禁用首次设置后自动全屏 - 避免触发B站防御机制
            // 设置完成后，等待用户手动点击进入全屏
            /* 已禁用：setTimeout中调用会失去用户交互上下文，触发B站防御
            if (isVideo && window.focusMode) {
              setTimeout(() => {
                window.focusMode._temporarilyDisableAutoFullscreen = false;
                log('首次设置完成，重新启用自动全屏');
                if (window.focusMode.settings && window.focusMode.settings.autoActivate) {
                  window.focusMode.autoActivateFullscreen();
                }
              }, 500);
            }
            */
            if (isVideo && window.focusMode) {
              window.focusMode._temporarilyDisableAutoFullscreen = false;
              log('首次设置完成，等待用户点击按钮进入全屏');
            }
            
            return true;
          } catch (setupErr) {
            warn('显示首次设置向导失败:', setupErr);
            // 即使失败也要重新启用自动全屏
            if (window.focusMode) {
              window.focusMode._temporarilyDisableAutoFullscreen = false;
            }
            return false;
          }
        }
        
        return false;
      } catch (err) {
        warn('检查首次设置失败:', err);
        return false;
      }
    }
    
    /**
     * 检查并确保首次设置完成（首页专用强制版本）
     * 这个函数确保用户必须完成密码和提示语设置才能继续
     */
    async function checkAndEnsureFirstTimeSetup() {
      try {
        log('开始检查首页首次设置状态');
        
        // 确保设置管理器已加载
        if (typeof FocusSettingsManager !== 'function') {
          warn('设置管理器未加载，无法检查首次设置');
          return false;
        }
        
        // 直接从 Storage 读取最新设置，避免使用可能过期的实例缓存
        const settings = await FocusSettingsManager.loadSettings();
        
        // 获取设置管理器实例用于后续操作
        const settingsManager = await SettingsService.getInstance();
        
        // 检查是否需要首次设置
        const needsSetup = settings.isFirstTime || !settings.password || settings.password.length === 0;
        
        if (needsSetup) {
          log('检测到需要完成首次设置，开始引导用户');
          console.log('[专注模式] 🚧 首页强制首次设置流程启动');
          
          // 显示强制设置界面
          await showMandatoryFirstTimeSetup(settingsManager, settings);
          
          // 设置完成后重新检查 - 直接从 Storage 读取最新设置
          const updatedSettings = await FocusSettingsManager.loadSettings();
          const setupComplete = !updatedSettings.isFirstTime && 
                               updatedSettings.password && 
                               updatedSettings.password.length > 0;
          
          if (setupComplete) {
            log('首次设置已完成，允许继续使用');
            return true;
          } else {
            log('首次设置未完成，阻止继续使用');
            return false;
          }
        } else {
          log('用户已完成首次设置，允许正常使用');
          return true;
        }
        
      } catch (err) {
        warn('检查强制首次设置失败:', err);
        // 出错时为了安全，假设需要设置
        return false;
      }
    }
    
    /**
     * 显示强制首次设置界面
     */
    async function showMandatoryFirstTimeSetup(settingsManager, currentSettings) {
      return new Promise(async (resolve) => {
        try {
          log('显示首页强制设置界面');
          
          // 确保FirstTimeSetup类可用
          if (typeof FirstTimeSetup !== 'function') {
            warn('FirstTimeSetup类未加载');
            resolve();
            return;
          }
          
          // 创建覆盖整个页面的设置界面
          const setupOverlay = document.createElement('div');
          setupOverlay.id = 'mandatory-setup-overlay';
          setupOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          `;
          
          setupOverlay.innerHTML = `
            <div style="
              background: white;
              border-radius: 20px;
              padding: 40px;
              max-width: 500px;
              width: 90%;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              animation: slideIn 0.5s ease-out;
            ">
              <div style="font-size: 48px; margin-bottom: 20px;">🎯</div>
              <h1 style="color: #333; margin-bottom: 20px; font-size: 24px;">欢迎使用B站专注学习助手</h1>
              <p style="color: #666; margin-bottom: 30px; line-height: 1.6;">
                为了帮助您更好地专注学习，请先完成以下必要设置：<br>
                <strong style="color: #00a1d6;">• 设置退出密码</strong> - 防止学习时分心退出<br>
                <strong style="color: #00a1d6;">• 配置提醒语句</strong> - 激励您坚持学习
              </p>
              <div style="
                padding: 15px;
                background: #f0f9ff;
                border-radius: 10px;
                margin-bottom: 30px;
                border-left: 4px solid #00a1d6;
              ">
                <p style="color: #0369a1; margin: 0; font-size: 14px;">
                  💡 这些设置只需要配置一次，完成后您就可以享受无干扰的学习体验了！
                </p>
              </div>
              <button id="start-setup-btn" style="
                background: linear-gradient(45deg, #00a1d6, #0369a1);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 25px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 5px 15px rgba(0,161,214,0.3);
              " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                🚀 开始设置
              </button>
            </div>
            <style>
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateY(30px) scale(0.9);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            </style>
          `;
          
          document.body.appendChild(setupOverlay);
          
          // 设置全局标记，阻止其他界面初始化
          window._focusModeSetupInProgress = true;
          console.log('[专注模式] 设置界面已创建，设置全局阻止标记');
          
          // 开始设置按钮事件
          const startBtn = setupOverlay.querySelector('#start-setup-btn');
          startBtn.addEventListener('click', async () => {
            try {
              log('用户点击开始设置按钮');
              
              // 检查 FirstTimeSetup 类是否可用
              if (typeof FirstTimeSetup !== 'function') {
                warn('FirstTimeSetup 类未找到，无法继续设置');
                startBtn.textContent = '设置组件未加载，请刷新页面重试';
                startBtn.style.background = '#ff6b6b';
                return;
              }
              
              log('FirstTimeSetup 类已找到，开始设置流程');
              
              // 更新按钮状态
              startBtn.textContent = '设置中...';
              startBtn.disabled = true;
              
              // 隐藏引导界面
              setupOverlay.style.display = 'none';
              
              // 启动首次设置流程
              log('创建 FirstTimeSetup 实例');
              const firstTimeSetup = await SetupFactory.createFirstTimeSetup();
              
              log('调用 showSetup 方法');
              await firstTimeSetup.showSetup();
              
              log('FirstTimeSetup.showSetup 执行完成');
              
              // 设置完成，移除覆盖层
              if (document.body.contains(setupOverlay)) {
                document.body.removeChild(setupOverlay);
                log('设置界面已移除');
              }
              
              log('强制首次设置流程完成');
              
              // 清除全局阻止标记
              window._focusModeSetupInProgress = false;
              console.log('[专注模式] 设置完成，清除全局阻止标记');
              
              resolve();
              
            } catch (setupErr) {
              warn('强制首次设置失败:', setupErr);
              console.error('设置错误详情:', setupErr);
              
              // 恢复设置界面显示
              setupOverlay.style.display = 'flex';
              
              // 设置失败时显示错误提示，但不移除覆盖层
              startBtn.textContent = '设置失败，请重试';
              startBtn.style.background = '#ff6b6b';
              startBtn.disabled = false;
              
              setTimeout(() => {
                startBtn.textContent = '🚀 开始设置';
                startBtn.style.background = 'linear-gradient(45deg, #00a1d6, #0369a1)';
              }, 3000);
              
              // 确保在错误情况下也清除标记
              window._focusModeSetupInProgress = false;
            }
          });
          
          // 防止用户通过ESC等方式绕过设置
          const preventEscape = (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              log('阻止用户ESC退出强制设置');
            }
          };
          
          document.addEventListener('keydown', preventEscape);
          
          // 当设置完成后移除ESC监听
          const originalResolve = resolve;
          resolve = (...args) => {
            document.removeEventListener('keydown', preventEscape);
            // 确保清除全局标记
            window._focusModeSetupInProgress = false;
            originalResolve(...args);
          };
          
        } catch (err) {
          warn('显示强制设置界面失败:', err);
          resolve();
        }
      });
    }
    
    /**
     * 在首页基础上检查并显示首次设置引导
     */
    async function checkAndShowFirstTimeSetupOnHomepage() {
      try {
        log('开始在首页检查首次设置状态');
        
        // 确保设置管理器已加载
        if (typeof FocusSettingsManager !== 'function') {
          warn('设置管理器未加载，跳过首次设置检查');
          return;
        }
        
        // 直接从 Storage 读取最新设置，避免使用可能过期的实例缓存
        const settings = await FocusSettingsManager.loadSettings();
        
        // 获取设置管理器实例用于后续操作
        const settingsManager = await SettingsService.getInstance();
        
        // 检查是否需要首次设置
        const needsSetup = settings.isFirstTime || !settings.password || settings.password.length === 0;
        
        if (needsSetup) {
          log('检测到需要完成首次设置，在首页显示引导');
          console.log('[专注模式] 🎯 在首页基础上显示首次设置引导');
          
          // 在首页基础上显示设置引导
          await showHomepageFirstTimeSetup(settingsManager, settings);
        } else {
          log('用户已完成首次设置，无需引导');
        }
        
      } catch (err) {
        warn('在首页检查首次设置失败:', err);
      }
    }
    
    /**
     * 在首页基础上显示首次设置引导
     */
    async function showHomepageFirstTimeSetup(settingsManager, currentSettings) {
      return new Promise(async (resolve) => {
        try {
          log('在首页显示首次设置引导界面');
          
          // 确保FirstTimeSetup类可用
          if (typeof FirstTimeSetup !== 'function') {
            warn('FirstTimeSetup类未加载');
            resolve();
            return;
          }
          
          // 方法1：尝试嵌入到首页搜索界面内
          const homepageContainer = document.querySelector('.focused-homepage-container');
          const searchContainer = document.querySelector('.search-container, .focus-search-container');
          
          if (homepageContainer || searchContainer) {
            log('找到首页容器，尝试嵌入设置提示');
            createEmbeddedSetupBanner(settingsManager, resolve, homepageContainer || searchContainer);
          } else {
            // 方法2：如果没有找到合适的容器，使用高优先级浮动界面
            log('未找到首页容器，使用高优先级浮动界面');
            createHighPrioritySetupGuide(settingsManager, resolve);
          }
          
        } catch (err) {
          warn('显示首页设置引导失败:', err);
          resolve();
        }
      });
    }
    
    /**
     * 创建嵌入式设置横幅（推荐方案）
     */
    function createEmbeddedSetupBanner(settingsManager, resolve, targetContainer) {
      const setupBanner = document.createElement('div');
      setupBanner.id = 'embedded-setup-banner';
      setupBanner.style.cssText = `
        width: 100%;
        max-width: 600px;
        margin: 20px auto;
        background: linear-gradient(135deg,rgb(149, 164, 232) 0%,rgba(173, 91, 217, 0.68) 100%);
        border-radius: 12px;
        padding: 20px;
        color: white;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        animation: fadeInUp 0.6s ease-out;
        border: 1px solid rgba(255,255,255,0.2);
        position: relative;
        z-index: 10;
      `;
      
      setupBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
          <div style="flex-shrink: 0;">
          
          </div>
          <div style="flex-grow: 1;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: white;">🎯 首次使用专注学习模式</h3>
            <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.4; opacity: 0.9;">
              为了获得最佳的学习体验，建议您先设置 <strong style="color:rgb(255, 244, 141);">🗝️ 退出密码</strong> 和 <strong style="color:rgb(175, 255, 177);">🔥 退出学习前的自我提示语</strong>
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button id="embedded-start-setup" style="
                background: rgba(255,255,255,0.95);
                color: #333;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                white-space: nowrap;
              " onmouseover="this.style.background='white'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(255,255,255,0.95)'; this.style.transform='translateY(0)'">
                 立即设置
              </button>
              
            
            </div>
          </div>
        </div>
        <style>
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeOutDown {
            from {
              opacity: 1;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              transform: translateY(-20px);
            }
          }
        </style>
      `;
      
      // 插入到目标容器的顶部
      if (targetContainer.firstChild) {
        targetContainer.insertBefore(setupBanner, targetContainer.firstChild);
      } else {
        targetContainer.appendChild(setupBanner);
      }
      
      // 设置按钮事件处理
      setupEmbeddedBannerEvents(setupBanner, settingsManager, resolve);
    }
    
    
    /**
     * 设置嵌入式横幅的事件处理
     */
    function setupEmbeddedBannerEvents(setupBanner, settingsManager, resolve) {
      const startBtn = setupBanner.querySelector('#embedded-start-setup');
      
      // 检查按钮是否存在
      if (!startBtn) {
        console.error('[专注模式] 未找到开始设置按钮');
        resolve();
        return;
      }
      
      startBtn.addEventListener('click', async () => {
          try {
            log('用户从嵌入式横幅开始设置');
            
            // 详细的依赖检查
            console.log('[专注模式] 开始依赖检查...');
            console.log('  FirstTimeSetup 类:', typeof FirstTimeSetup);
            console.log('  UIUtils:', typeof UIUtils);
            console.log('  settingsManager:', settingsManager);
            
            if (typeof FirstTimeSetup !== 'function') {
              throw new Error('FirstTimeSetup 类未找到');
            }
            
            if (typeof UIUtils === 'undefined') {
              throw new Error('UIUtils 未找到');
            }
            
            console.log('[专注模式] 所有依赖检查通过，使用FirstTimeSetup设置流程...');
            
            // 暂时隐藏横幅，避免界面冲突
            setupBanner.style.display = 'none';
            
            // 使用FirstTimeSetup类提供完整的设置流程
            console.log('[专注模式] 使用FirstTimeSetup完整设置流程...');
            const firstTimeSetup = await SetupFactory.createFirstTimeSetup();
            await firstTimeSetup.showSetup();
            
            // 设置完成后清理横幅
            if (setupBanner.parentNode) {
              setupBanner.parentNode.removeChild(setupBanner);
            }
            resolve();
            
          } catch (setupErr) {
            warn('嵌入式设置失败:', setupErr);
            console.error('[专注模式] 详细错误信息:', setupErr);
            
            // 恢复横幅显示
            setupBanner.style.display = 'block';
            startBtn.textContent = '设置失败，请重试';
            startBtn.style.background = 'rgba(244, 67, 54, 0.9)';
            setTimeout(() => {
              startBtn.textContent = '🚀 立即设置';
              startBtn.style.background = 'rgba(255,255,255,0.95)';
            }, 3000);
          }
      });
      
      // 15秒后自动淡出
      setTimeout(() => {
        if (setupBanner.parentNode) {
          setupBanner.style.animation = 'fadeOutDown 0.5s ease-in forwards';
          setTimeout(() => {
            if (setupBanner.parentNode) {
              setupBanner.parentNode.removeChild(setupBanner);
              log('嵌入式设置横幅自动隐藏');
            }
            resolve();
          }, 500);
        }
      }, 30000);
    }
    
    /**
     * 设置高优先级引导的事件处理
     */
    function setupHighPriorityGuideEvents(setupGuide, settingsManager, resolve) {
      const startBtn = setupGuide.querySelector('#priority-start-setup');
      const skipBtn = setupGuide.querySelector('#priority-skip-setup');
      
      startBtn.addEventListener('click', async () => {
        try {
          log('用户从高优先级引导开始设置');
          setupGuide.style.display = 'none';
          
          const firstTimeSetup = await SetupFactory.createFirstTimeSetup();
          await firstTimeSetup.showSetup();
          
          if (document.body.contains(setupGuide)) {
            document.body.removeChild(setupGuide);
          }
          resolve();
          
        } catch (setupErr) {
          warn('高优先级设置失败:', setupErr);
          setupGuide.style.display = 'block';
          startBtn.textContent = '设置失败，请重试';
          startBtn.style.background = 'rgba(244, 67, 54, 0.9)';
          setTimeout(() => {
            startBtn.textContent = '🚀 开始设置';
            startBtn.style.background = 'rgba(255,255,255,0.95)';
          }, 3000);
        }
      });
      
      skipBtn.addEventListener('click', () => {
        log('用户选择稍后设置');
        document.body.removeChild(setupGuide);
        resolve();
      });
      
      // 12秒后自动关闭
      setTimeout(() => {
        if (document.body.contains(setupGuide)) {
          document.body.removeChild(setupGuide);
          log('高优先级设置引导自动隐藏');
          resolve();
        }
      }, 12000);
    }
    

    
    /**
     * 检查其他页面的首次设置状态并显示提示
     */
    async function checkAndShowSetupNoticeForOtherPages() {
      try {
        log('检查其他页面的首次设置状态');
        
        // 确保设置管理器已加载
        if (typeof FocusSettingsManager !== 'function') {
          warn('设置管理器未加载，跳过首次设置检查');
          return;
        }
        
        // 直接从 Storage 读取最新设置，避免使用可能过期的实例缓存
        const settings = await FocusSettingsManager.loadSettings();
        
        // 检查是否需要首次设置
        const needsSetup = settings.isFirstTime || !settings.password || settings.password.length === 0;
        
        if (needsSetup) {
          log('检测到需要完成首次设置，显示友好提示');
          showSetupRedirectNotice();
        } else {
          log('用户已完成首次设置，继续正常使用');
        }
        
      } catch (err) {
        warn('检查其他页面首次设置失败:', err);
      }
    }
    
    /**
     * 显示设置重定向提示（非首页访问时使用）
     */
    function showSetupRedirectNotice() {
      const noticeOverlay = document.createElement('div');
      noticeOverlay.id = 'setup-redirect-notice';
      noticeOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      `;
      
      noticeOverlay.innerHTML = `
        <div style="
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          text-align: center;
          animation: bounceIn 0.6s ease-out;
        ">
          <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
          <h2 style="color: #333; margin-bottom: 20px; font-size: 22px;">需要完成初始设置</h2>
          <p style="color: #666; margin-bottom: 30px; line-height: 1.6;">
            您需要先完成专注学习模式的初始设置才能使用相关功能。<br>
            <strong style="color: #e74c3c;">请前往B站首页完成密码和提醒语设置。</strong>
          </p>
          <div style="
            padding: 15px;
            background: #fff3cd;
            border-radius: 10px;
            margin-bottom: 30px;
            border-left: 4px solid #ffc107;
          ">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              💡 设置完成后，您可以正常使用所有专注学习功能
            </p>
          </div>
          <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="goto-homepage-btn" style="
              background: linear-gradient(45deg, #00a1d6, #0369a1);
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 25px;
              font-size: 14px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              🏠 前往首页设置
            </button>
            <button id="close-notice-btn" style="
              background: #6c757d;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 25px;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.3s ease;
            " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
              稍后设置
            </button>
          </div>
        </div>
        <style>
          @keyframes bounceIn {
            0% {
              opacity: 0;
              transform: scale(0.3) translateY(-50px);
            }
            50% {
              opacity: 1;
              transform: scale(1.1) translateY(-20px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        </style>
      `;
      
      document.body.appendChild(noticeOverlay);
      
      // 前往首页按钮
      const goToHomepageBtn = noticeOverlay.querySelector('#goto-homepage-btn');
      goToHomepageBtn.addEventListener('click', () => {
        window.location.href = 'https://www.bilibili.com/';
      });
      
      // 稍后设置按钮
      const closeBtn = noticeOverlay.querySelector('#close-notice-btn');
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(noticeOverlay);
        log('用户选择稍后设置，继续当前页面');
      });
      
      // 5秒后自动移除提示（给用户选择的机会）
      setTimeout(() => {
        if (document.getElementById('setup-redirect-notice')) {
          document.body.removeChild(noticeOverlay);
          log('设置提示已自动关闭');
        }
      }, 8000);
    }
   
    // 检查URL是否是B站首页
    function isHomepage(url) {
      // 多种匹配方式，确保不会遗漏任何首页格式
      return url === 'https://www.bilibili.com/' || 
             url === 'https://www.bilibili.com/index.html' ||
             url === 'https://bilibili.com/' ||
             url === 'https://bilibili.com/index.html' ||
             url.match(/^https?:\/\/(www\.)?bilibili\.com\/?(\?.*)?$/);
             // 正则表达式匹配更灵活的URL格式
    }
    
    // 检查URL是否是视频页面
    function isVideoPage(url) {
      return url.includes('/video/') ||  // 普通视频 
             url.includes('/bangumi/play/') ||  // 番剧
             url.includes('/cheese/play/');  // 课程
    }
    
    // ✅ showGlobalSettingsDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ handleGlobalPasswordReset, handleGlobalRemindersEdit, handleGlobalResetAll 已移至 GlobalSettingsManager
    
    // ✅ showGlobalConfirmDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ showGlobalPasswordDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ showGlobalRemindersDialog 已移至 GlobalSettingsManager (美化版本)
    
    // ✅ showGlobalMessage 已移至 GlobalSettingsManager (美化版本)
    
    // 页面UI增强处理
    function enhancePageUI() {
      // ⚠️ 已永久禁用PageEnhancer - 修改DOM会触发B站防御机制
      // 
      // 经过深入调试发现：
      // PageEnhancer.processNavBar() 和 PageEnhancer.hideSearchHotList()
      // 会修改页面DOM，B站检测到后会触发防御机制，
      // 给所有控制菜单项添加隐藏内联样式（display:none等），
      // 导致控制栏菜单完全不可见。
      // 
      // 解决方案：完全禁用PageEnhancer的DOM修改功能
      // 用户可以通过CSS隐藏这些元素，而不需要JS修改DOM
      
      log('⚠️ PageEnhancer已禁用，避免触发B站防御机制');
      return true;
      
      /* 已永久禁用
      try {
        if (typeof PageEnhancer !== 'function') {
          warn('PageEnhancer未加载，无法进行页面UI增强');
          return false;
        }
        
        log('开始应用页面UI增强...');
        
        try {
          log('尝试处理导航栏...');
          const navResult = PageEnhancer.processNavBar();
          if (navResult) {
            log('导航栏处理成功');
          } else {
            log('导航栏处理结果: 无法完全处理');
          }
        } catch (navErr) {
          warn('处理导航栏时出错:', navErr);
        }
        
        try {
          log('尝试隐藏搜索热榜...');
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
      */
    }
    
    // 初始化视频专注模式 - 在视频页面应用核心专注功能
    async function initializeVideoFocus() {
      try {
        console.log('[专注模式] 开始初始化视频专注模式');
        
        // 创建并初始化专注模式实例
        if (!window.focusMode) {
          window.focusMode = new FocusMode();
          console.log('[专注模式] 创建FocusMode实例');
        }
        
        // 初始化专注模式
        await window.focusMode.initialize();
        console.log('[专注模式] 视频专注模式初始化完成');
        
        // 添加返回全屏按钮
        if (typeof window.focusMode.addBackToFullscreenButton === 'function') {
          window.focusMode.addBackToFullscreenButton();
        }
        
        // ⚠️ 已禁用立即全屏 - 避免触发B站防御机制
        // 只在用户点击引导按钮时才进入全屏
        /* 已禁用：立即调用会失去用户交互上下文，触发B站防御
        console.log('[专注模式] 立即尝试全屏，不等待视频加载');
        window.focusMode.autoActivateFullscreen();
        */
        console.log('[专注模式] 等待用户点击引导按钮进入全屏');
        
        // 设置全屏状态监视器
        let fullscreenMonitorActive = false;
        
        // 全屏监视器设置函数 - 定期检查全屏状态
        const setupFullscreenMonitor = () => {
          if (fullscreenMonitorActive) return;
          
          fullscreenMonitorActive = true;
          console.log('[专注模式] 启动全屏状态监视器');
          
          // 智能全屏监视器 - 优化用户体验，减少干扰
          const monitorInterval = setInterval(() => {
            // 确保focusMode实例存在
            if (!window.focusMode) {
              clearInterval(monitorInterval);
              fullscreenMonitorActive = false;
              return;
            }
            
            // 检查是否临时禁用了自动全屏（首次设置期间）
            if (window.focusMode._temporarilyDisableAutoFullscreen) {
              console.log('[专注模式] 🛑 自动全屏已临时禁用，跳过监控 - 版本: 2024.1.15');
              return;
            }
            
            // 检查是否需要恢复全屏
            if (window.focusMode.settings && 
                window.focusMode.settings.autoActivate && 
                !window.focusMode.checkFullscreenState() && 
                window.focusMode.isActive) {
              
              // 检查是否在退出流程中
              const isExitInProgress = window.focusMode.fullscreenState && (
                window.focusMode.fullscreenState.exitApproved || 
                window.focusMode.fullscreenState.exitInProgress
              );
              
              // 检查退出处理器状态（包括密码输入对话框）
              const isExitHandlerActive = window.focusMode.components && 
                                        window.focusMode.components.exitHandler && (
                                          window.focusMode.components.exitHandler.exitRequested || 
                                          window.focusMode.components.exitHandler.reminderDialogActive ||
                                          window.focusMode.components.exitHandler.exitTransitionActive
                                        );
              
              // 检查是否有任何用户交互对话框存在
              const hasInteractiveDialog = document.querySelector(
                '.focus-exit-dialog, .top-level-exit-overlay, .partial-exit-overlay, .exit-transition-overlay, ' +
                '.focus-first-time-dialog, .focus-global-settings-dialog, .focus-global-confirm-dialog, ' +
                '.focus-global-password-dialog, .focus-global-reminders-dialog, .focus-global-message-dialog, ' +
                '.dialog-overlay, .bili-modal, .van-dialog'
              );
              
              // 检查用户是否正在输入（更精确的检测）
              const activeElement = document.activeElement;
              const isUserTyping = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.contentEditable === 'true' ||
                activeElement.isContentEditable
              );
              
              // 检查是否有模态框或下拉菜单打开
              const hasModalOrMenu = document.querySelector(
                '[role="dialog"], [role="menu"], .modal, .popup, .dropdown-open, ' +
                '.bili-popover, .v-popover-content'
              );
              
              // 检查按钮交互状态（新增）
              const hasDisabledButtons = document.querySelector(
                '.focus-exit-dialog button:disabled, .top-level-exit-overlay button:disabled, ' +
                '.partial-exit-overlay button:disabled'
              );
              
              // 检查是否有动画或过渡正在进行（新增）
              const hasActiveTransitions = document.querySelector(
                '.exit-transition-overlay.visible, [class*="-dialog"].fade-out, [class*="-overlay"].fade-out'
              );
              
              // ⚠️ 已禁用自动恢复全屏 - 避免触发B站防御机制
              // 只在用户手动操作时才进入全屏
              /* 已禁用：监视器中调用会失去用户交互上下文，触发B站防御
              const shouldSkipRestore = isExitInProgress || isExitHandlerActive || hasInteractiveDialog || 
                                       isUserTyping || hasModalOrMenu || hasDisabledButtons || hasActiveTransitions;
              
              if (!shouldSkipRestore) {
                console.log('[专注模式] 监视器检测到已退出全屏，尝试恢复');
                window.focusMode.autoActivateFullscreen();
              } else {
                const reason = isExitInProgress ? '退出流程中' :
                              isExitHandlerActive ? '退出处理器活动' :
                              hasInteractiveDialog ? '交互对话框存在' :
                              isUserTyping ? '用户正在输入' :
                              hasModalOrMenu ? '模态框/菜单打开' :
                              hasDisabledButtons ? '按钮交互进行中' :
                              hasActiveTransitions ? '对话框过渡动画中' : '未知原因';
                console.log(`[专注模式] 暂停自动恢复全屏：${reason}`);
              }
              */
              console.log('[专注模式] 监视器已禁用自动恢复全屏功能');
            }
          }, 8000); // 降低到8秒检查一次，减少性能影响
          
          // 20分钟后停止监视器
          setTimeout(() => {
            clearInterval(monitorInterval);
            fullscreenMonitorActive = false;
            console.log('[专注模式] 全屏状态监视器已停止');
          }, 20 * 60 * 1000); // 20分钟
        };
        
        // 更健壮的视频元素查找
        const findVideoElements = () => {
          // 尝试多种选择器找到视频元素
          const selectors = [
            'video', 
            '.bpx-player-video-wrap video', 
            '.bilibili-player-video video',
            '#bilibili-player video',
            '.player-container video'
          ];
          
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
              return Array.from(elements);
            }
          }
          
          return [];
        };
        
        // ⚠️ 已禁用视频事件监听自动全屏 - 避免触发B站防御机制
        // 只在用户手动点击引导按钮时才进入全屏
        /* 已禁用：视频事件中调用会失去用户交互上下文，触发B站防御
        const waitForVideo = () => {
          const videoElements = findVideoElements();
          
          if (videoElements.length > 0) {
            console.log(`[专注模式] 找到${videoElements.length}个视频元素，设置加载监听器`);
            
            videoElements.forEach(videoElement => {
              const eventHandlers = new Map();
              
              if (videoElement.readyState >= 2) {
                console.log('[专注模式] 视频已预加载，尝试自动全屏');
                window.focusMode.autoActivateFullscreen();
                setupFullscreenMonitor();
              }
              
              const videoEvents = ['canplay', 'loadeddata', 'play', 'playing'];
              
              videoEvents.forEach(eventName => {
                if (videoElement[`_focus_${eventName}_handler`]) {
                  videoElement.removeEventListener(eventName, videoElement[`_focus_${eventName}_handler`]);
                }
                
                const handler = () => {
                  console.log(`[专注模式] 视频事件 "${eventName}" 触发，尝试自动全屏`);
                  if (window.focusMode) {
                    window.focusMode.autoActivateFullscreen();
                    setupFullscreenMonitor();
                  }
                  
                  videoElement.removeEventListener(eventName, handler);
                  delete videoElement[`_focus_${eventName}_handler`];
                };
                
                videoElement[`_focus_${eventName}_handler`] = handler;
                videoElement.addEventListener(eventName, handler, { once: true });
              });
              
              if (videoElement._focus_timeupdate_handler) {
                videoElement.removeEventListener('timeupdate', videoElement._focus_timeupdate_handler);
              }
              
              const timeUpdateHandler = () => {
                if (videoElement.currentTime > 2) {
                  console.log('[专注模式] 视频已播放2秒，确保全屏状态');
                  if (window.focusMode && 
                      window.focusMode.settings && 
                      window.focusMode.settings.autoActivate && 
                      !window.focusMode.checkFullscreenState()) {
                    window.focusMode.autoActivateFullscreen();
                    setupFullscreenMonitor();
                  }
                  
                  videoElement.removeEventListener('timeupdate', timeUpdateHandler);
                  delete videoElement._focus_timeupdate_handler;
                }
              };
              
              videoElement._focus_timeupdate_handler = timeUpdateHandler;
              videoElement.addEventListener('timeupdate', timeUpdateHandler);
            });
            
            return true;
          } else {
            console.log('[专注模式] 视频元素尚未加载，等待后再次检查');
            setTimeout(waitForVideo, 500);
            return false;
          }
        };
        
        waitForVideo();
        */
        console.log('[专注模式] 已禁用视频事件自动全屏，等待用户点击引导按钮');
        
        // 监听DOM变化，检测视频播放器的动态添加
        const observeDOM = () => {
          if (window.focusMode._domObserver) {
            // 如果已存在观察器，先清除
            window.focusMode._domObserver.disconnect();
          }
          
          // 创建DOM变化观察器
          const observer = new MutationObserver(mutations => {
            let shouldCheckVideo = false;
            
            mutations.forEach(mutation => {
              // 检查新添加的节点
              if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                  const node = mutation.addedNodes[i];
                  if (node.nodeType === 1) { // 元素节点
                    if (node.tagName === 'VIDEO' || 
                        (node.querySelector && node.querySelector('video'))) {
                      shouldCheckVideo = true;
                      break;
                    }
                  }
                }
              }
              
              // 检查属性变化
              if (mutation.type === 'attributes' && 
                  mutation.target.tagName === 'VIDEO') {
                shouldCheckVideo = true;
              }
            });
            
            if (shouldCheckVideo) {
              // ⚠️ 已禁用DOM变化自动全屏 - 避免触发B站防御机制
              /* 已禁用：DOM观察器中调用会失去用户交互上下文
              console.log('[专注模式] 检测到视频相关DOM变化，尝试自动全屏');
              if (window.focusMode && 
                  window.focusMode.settings && 
                  window.focusMode.settings.autoActivate) {
                window.focusMode.autoActivateFullscreen();
                setupFullscreenMonitor();
                waitForVideo();
              }
              */
              console.log('[专注模式] 检测到视频DOM变化，等待用户点击进入全屏');
            }
          });
          
          // 开始观察文档body的所有变化
          observer.observe(document.body, {
            childList: true, // 监听子节点变化
            subtree: true,   // 监听所有后代节点
            attributes: true, // 监听属性变化
            attributeFilter: ['src', 'style', 'class'] // 只监听这些属性
          });
          
          // 保存观察器引用以便日后清理
          window.focusMode._domObserver = observer;
          
          console.log('[专注模式] DOM变化观察器已启动');
        };
        
        // 启动DOM观察器
        observeDOM();
        
        return true;
      } catch (err) {
        console.error('[专注模式] 初始化视频专注模式失败:', err);
        return false;
      }
    }
    
    // 检查FocusedHomepage类是否可用
    function checkFocusedHomepageAvailability() {
      return typeof window.FocusedHomepage === 'function';
    }

    // 初始化首页专注模式
    async function initializeFocusedHomepage() {
      try {
        // 检查类是否已加载
        if (checkFocusedHomepageAvailability()) {
          log('FocusedHomepage类已加载');
          // 创建实例(如果不存在)
          if (!window.focusedHomepage) {
            window.focusedHomepage = new window.FocusedHomepage();
            log('创建FocusedHomepage实例');
          }
          
          // 初始化首页专注模式
          if (typeof window.focusedHomepage.init === 'function') {
            window.focusedHomepage.init(true);
            window.__focused_homepage_initialized = true;
            log('FocusedHomepage成功初始化');
            return true;
          } else {
            warn('FocusedHomepage缺少init方法');
            return false;
          }
        } else {
          // 尝试手动加载脚本
          log('尝试手动加载FocusedHomepage脚本');
          await loadFocusedHomepageScript();
          
          // 检查加载结果
          if (checkFocusedHomepageAvailability()) {
            log('手动加载FocusedHomepage成功');
            if (!window.focusedHomepage) {
              window.focusedHomepage = new window.FocusedHomepage();
            }
            
            if (typeof window.focusedHomepage.init === 'function') {
              window.focusedHomepage.init(true);
              window.__focused_homepage_initialized = true;
              return true;
            } else {
              warn('加载的FocusedHomepage缺少init方法');
              return false;
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
    
    // 根据页面类型初始化不同功能
    async function initBasedOnPageType() {
      const url = window.location.href;
      
      // 应用通用UI增强
      enhancePageUI();
      
      // 视频页面处理
      if (isVideoPage(url)) {
        log('检测到视频页面，初始化专注模式');
        
        // 首次使用检查和设置
        const isFirstTime = await checkFirstTimeSetup();
        if (isFirstTime) {
          log('已完成首次设置向导');
        }
        
        await initializeVideoFocus();
        return;
      }
      
      // 首页处理 - 先让首页正常加载，再检查设置
      if (isHomepage(url)) {
        log('检测到首页，开始初始化专注首页');
        
        // 先正常加载首页
        await initializeFocusedHomepage();
        
        // 首页加载完成后，再检查是否需要首次设置
        setTimeout(async () => {
          await checkAndShowFirstTimeSetupOnHomepage();
        }, 1500); // 给首页1.5秒的加载时间
        
        return;
      }
      
      // 其他页面检查首次设置
      log('检测到其他页面，检查首次设置');
      await checkAndShowSetupNoticeForOtherPages();
      
      log('当前页面基础处理完成');
    }
    
    // 开始加载主要功能
    log('专注模式开始加载 - ' + new Date().toISOString());
    
    // 等待依赖加载
    const dependencyStatus = await ensureDependenciesLoaded();
    
    if (dependencyStatus.success) {
      log('依赖已加载，初始化功能');
    await initBasedOnPageType();
    } else {
      warn('部分依赖加载失败，使用备用方案初始化');
      // 尝试加载基本功能
      if (isVideoPage(window.location.href)) {
        await initializeVideoFocus();
      }
    }
  }
  
  // 根据文档加载状态执行主函数
  if (document.readyState === 'loading') {
    // 如果文档仍在加载中，等待DOMContentLoaded事件
    document.addEventListener('DOMContentLoaded', main);
  } else {
    // 如果文档已加载完成，直接执行main函数
    main();
  }

  // 动态加载FocusedHomepage脚本
  function loadFocusedHomepageScript() {
    return new Promise((resolve, reject) => {
      try {
        // 创建script元素
        const script = document.createElement('script');
        
        // 尝试使用Chrome扩展API获取URL
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          script.src = chrome.runtime.getURL('content/focused-homepage.js');
        } else {
          // 备用相对路径
          script.src = 'content/focused-homepage.js';
          console.warn('[专注模式] 使用备用路径加载FocusedHomepage');
        }
        
        // 添加超时处理
        let timeoutId = setTimeout(() => {
          console.warn('[专注模式] 加载FocusedHomepage脚本超时');
          script.onload = script.onerror = null;
          reject(new Error('加载脚本超时'));
        }, 5000);
        
        // 成功加载处理
        script.onload = () => {
          clearTimeout(timeoutId);
          console.log('[专注模式] 手动加载FocusedHomepage脚本成功');
          resolve(true);
        };
        
        // 加载错误处理
        script.onerror = (err) => {
          clearTimeout(timeoutId);
          console.warn('[专注模式] 手动加载FocusedHomepage脚本失败', err);
          reject(err);
        };
        
        // 将script添加到文档头部
        document.head.appendChild(script);
      } catch (err) {
        reject(err);
      }
    });
  }
})(); 