let password = '';
let reminders = [];
let passwordVerified = false;
let isManualFullscreen = false;
let isValidating = false;
let isCancelled = false;
let isExiting = false;
let isProcessing = false;

// 在文件开头添加快捷键配置
const SHORTCUT_KEYS = {
    RESET_PASSWORD: 'r',  // Ctrl + Alt + R 重置密码和提醒语
};

// 添加状态管理对象
const state = {
    isFullscreen: false,
    isValidating: false,
    isProcessing: false,
    startTime: null,
    videoStartTime: null,
    currentVideoId: null,
    currentVideoTitle: null,
    isStudySessionActive: false,
    urlChangeDetected: false,
    lastUrl: location.href,
    initialized: false
};

// 存储处理
const storage = {
    get: function(keys, callback) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(keys, callback);
        } else {
            const result = {};
            keys.forEach(key => {
                result[key] = localStorage.getItem(key);
            });
            callback(result);
        }
    },
    set: function(items, callback) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set(items, callback);
        } else {
            Object.keys(items).forEach(key => {
                localStorage.setItem(key, items[key]);
            });
            if (callback) callback();
        }
    }
};

// 添加配置管理
const config = {
    defaultVolume: 0.5,
    maxRetries: 3,
    checkInterval: 1000,
    // B站首页URL匹配
    homePageUrls: [
        'https://www.bilibili.com/',
        'https://bilibili.com/',
        'https://www.bilibili.com/index.html'
    ]
};

// 等待元素加载完成的函数，增加超时处理和更可靠的元素检测
function waitForElement(selector, callback, timeout = 10000) {
    let startTime = Date.now();
    let intervalId = null;
    let timeoutId = null;
    
    function check() {
        const element = document.querySelector(selector);
        if (element) {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            callback(element);
            return true;
        }
        
        if (Date.now() - startTime > timeout) {
            clearInterval(intervalId);
            console.log(`等待元素 ${selector} 超时`);
            callback(null); // 超时时传递null给回调函数
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
    }, timeout);
}

// 修改页面类型判断函数，更精确地识别页面类型
function isVideoPage(url = window.location.href) {
    const urlToCheck = url.toLowerCase();
    // 更精确地匹配视频页面URL
    return (
        urlToCheck.includes('bilibili.com/video/') ||
        urlToCheck.includes('bilibili.com/bangumi/play/') ||
        urlToCheck.includes('bilibili.com/cheese/play/')
    );
}

function isHomePage(url = window.location.href) {
    const urlToCheck = url.split('?')[0].toLowerCase();
    // 严格匹配首页URL
    return (
        urlToCheck === 'https://www.bilibili.com' ||
        urlToCheck === 'https://www.bilibili.com/' ||
        urlToCheck === 'https://bilibili.com' ||
        urlToCheck === 'https://bilibili.com/' ||
        urlToCheck === 'https://m.bilibili.com' ||
        urlToCheck === 'https://m.bilibili.com/'
    );
}

// 修改初始化插件函数，确保不会阻止B站正常加载
function initPlugin() {
  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFeatures);
  } else {
    // 延迟执行初始化，确保B站页面已经加载
    setTimeout(initializeFeatures, 500);
  }
}

function initializeFeatures() {
  try {
    // 清理可能的残留状态
    setupPageBehavior();
    
    // 优化所有页面的滚动性能
    optimizePageScroll();
    
    // 检查页面类型并应用相应功能
    if (isVideoPage()) {
      console.log('检测到视频页面，应用专注模式');
      storage.get(['password', 'reminders'], function(result) {
        try {
          if (result.password && result.reminders) {
            password = result.password;
            reminders = result.reminders;
            // 确保按顺序执行
            setTimeout(() => {
              enterFullscreen();
              setupLinkInterception();
              setupExitListeners();
              setTimeout(restoreVideoVolume, 1000);
            }, 1000);
            
            // 设置视频学习记录
            if (typeof window.setupStudyRecording === 'function') {
              window.setupStudyRecording();
            } else {
              console.log('等待学习记录模块加载...');
              // 延迟加载学习记录模块
              setTimeout(() => {
                if (typeof window.setupStudyRecording === 'function') {
                  window.setupStudyRecording();
                } else {
                  console.error('学习记录模块加载失败');
                }
              }, 2000);
            }
          } else {
            setupInitialConfig();
          }
          setupShortcuts();
        } catch (error) {
          console.error('初始化失败:', error);
        }
      });
    } else if (isHomePage()) {
      console.log('检测到首页，应用简洁搜索界面');
      // 不要立即停止页面加载，而是等待页面加载完成后再应用修改
      setTimeout(setupHomePage, 1000);
    } else {
      console.log('其他页面，保持原有界面');
      // 确保其他页面不受影响
      document.body.classList.remove('video-page');
      const existingStyles = document.querySelectorAll('style[data-plugin-style]');
      existingStyles.forEach(style => style.remove());
    }
  } catch (error) {
    console.error('初始化插件时发生错误:', error);
  }
}

// 修改首页处理函数，确保专注搜索功能正常工作
function setupHomePage() {
  console.log('设置首页专注搜索...');
  
  try {
    // 立即停止页面加载，避免加载过多资源
    window.stop();
    
    // 清空页面内容
    document.documentElement.innerHTML = '';
    
    // 创建新的HTML结构
    document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>B站学习助手 - 专注搜索</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #f5f5f5 0%, #e0f0ff 100%);
          height: 100vh;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .search-container {
          width: 500px;
          max-width: 90%;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #00a1d6;
          margin-bottom: 20px;
        }
        .search-box {
          width: 100%;
          padding: 12px;
          font-size: 16px;
          border: 2px solid #00a1d6;
          border-radius: 8px;
          outline: none;
          box-sizing: border-box;
        }
        .search-btn {
          margin-top: 10px;
          padding: 10px 20px;
          font-size: 16px;
          background-color: #00a1d6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        .search-btn:hover {
          background-color: #0091c2;
        }
        .tip {
          position: fixed;
          bottom: 20px;
          left: 0;
          right: 0;
          text-align: center;
          color: rgba(0, 0, 0, 0.3);
          font-size: 16px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="search-container">
        <div class="logo">B站学习助手</div>
        <input type="text" class="search-box" placeholder="输入关键词搜索视频...">
        <button class="search-btn">搜索</button>
      </div>
      <div class="tip">专注学习 · 高效提升</div>
    </body>
    `;
    
    // 添加事件监听
    const searchBox = document.querySelector('.search-box');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchBox && searchBtn) {
      // 搜索按钮点击事件
      searchBtn.addEventListener('click', function() {
        const keyword = searchBox.value.trim();
        if (keyword) {
          window.location.href = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
        }
      });
      
      // 回车键搜索
      searchBox.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          const keyword = searchBox.value.trim();
          if (keyword) {
            window.location.href = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
          }
        }
      });
      
      // 自动聚焦到搜索框
      searchBox.focus();
    } else {
      console.error('未找到搜索框或搜索按钮');
    }
  } catch (error) {
    console.error('设置首页专注搜索时出错:', error);
  }
}

// 设置初始配置
function setupInitialConfig() {
    const newPassword = prompt('请设置退出全屏的密码：');
    if (!newPassword) return;

    const reminderCount = parseInt(prompt('想要设置几句提醒话语？（建议3-5句）：')) || 3;
    const newReminders = [];
    
    for (let i = 0; i < reminderCount; i++) {
        const newReminder = prompt(`请输入第 ${i + 1} 句提醒话语：`);
        if (newReminder) {
            newReminders.push(newReminder);
        }
    }
    
    if (newReminders.length > 0) {
        password = newPassword;
        reminders = newReminders;
        storage.set({
            password: newPassword,
            reminders: newReminders
        }, function() {
            enterFullscreen();
        });
    }
}

// 修改链接拦截设置函数
function setupLinkInterception() {
    // 只在视频页面添加链接拦截
    if (!isVideoPage()) {
        return;
    }

    // 拦截所有点击事件
    document.addEventListener('click', function(e) {
        let target = e.target;
        
        // 向上查找最近的链接元素
        while (target && target !== document.body) {
            if (target.tagName === 'A' || target.hasAttribute('href') || 
                target.classList.contains('nav-link') || // 导航栏链接
                target.classList.contains('v-popover-wrap') || // B站顶部导航项
                target.hasAttribute('data-v-navbar')) { // 导航栏元素
                
                handleLinkClick(e, target);
                return;
            }
            target = target.parentElement;
        }
    }, true);
}

// 修改链接点击处理函数
function handleLinkClick(e, target) {
    // 获取实际链接
    let href = target.href || target.getAttribute('href');
    
    // 处理导航栏特殊元素
    if (!href && (target.classList.contains('nav-link') || 
                 target.classList.contains('v-popover-wrap') ||
                 target.hasAttribute('data-v-navbar'))) {
        // 这些元素通常会触发页面跳转
            e.preventDefault();
        e.stopPropagation();
        
        if (!isProcessing) {
            startExitCheck();
        }
            return false;
        }
        
    if (!href) return true;

    // 检查链接类型
    const isBilibiliLink = href.includes('bilibili.com') || 
                          href.startsWith('/') || 
                          href.startsWith('#');
    
    // 如果不是在视频页面
    if (!isVideoPage()) {
        // 只处理首页跳转
        if (isHomePage(href)) {
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
        if (isHomePage(href)) {
            e.preventDefault();
            setupHomePage();
            return false;
        }
        
        // 其他B站内部页面需要验证
        e.preventDefault();
        e.stopPropagation();
        if (!isProcessing) {
            startExitCheck();
        }
        return false;
    }

    // 外部链接需要完整验证
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
        startExitCheck();
    }
    return false;
}

// 修改事件监听器设置
function setupFullscreenProtection() {
    // 只在视频页面添加保护
    if (!isVideoPage()) {
        return;
    }

    document.addEventListener('keydown', handleKeyPress, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    
    // 监听全屏按钮点击
    const fullscreenButtons = document.querySelectorAll('.bpx-player-ctrl-btn-fullscreen, .bilibili-player-video-btn-fullscreen');
    fullscreenButtons.forEach(button => {
        button.addEventListener('click', handleFullscreenButtonClick, true);
    });
    
    // 修改全屏变化监听器
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // 如果是正常退出流程，不做处理
            if (passwordVerified || isExiting) {
                return;
            }
            
            // 如果已经在验证中，不要重复触发
            if (isValidating) {
                return;
            }
            
            // 开始验证流程
            isValidating = true;
            startExitCheck();
        }
    });
    
    // 现有的监听器
    window.addEventListener('keydown', handleBrowserShortcuts, true);
    
    // 禁用所有导航相关元素
    disableNavigation();

    // 添加额外的事件拦截
    document.addEventListener('mousedown', preventEvent, true);
    document.addEventListener('click', preventEvent, true);
    document.addEventListener('contextmenu', preventEvent, true);
    
    // 禁用所有表单元素
    document.querySelectorAll('input, button, select, textarea, a').forEach(element => {
        element.disabled = true;
        element.style.pointerEvents = 'none';
    });

    // 修改页面可见性变化监听器
    document.addEventListener('visibilitychange', () => {
        // 只在视频页面应用专注模式限制
        if (isVideoPage() && !isExiting && !passwordVerified) {
            window.focus();
            setTimeout(() => {
                enterFullscreen();
            }, 100);
        }
    }, true);

    // 添加更强的标签页切换控制
    window.addEventListener('blur', (e) => {
        if (!isExiting && !passwordVerified) {
            e.preventDefault();
            e.stopPropagation();
            window.focus();
            setTimeout(() => {
                enterFullscreen();
            }, 100);
        }
    }, true);

    // 阻止可能导致切换标签页的快捷键，但允许页面滚动相关的键
    window.addEventListener('keydown', (e) => {
        const forbiddenKeys = [
            'Tab',          // Tab 键
            't', 'w',       // Ctrl+T, Ctrl+W
            'r', 'l',       // Ctrl+R, Ctrl+L
            'F5'            // F5
        ];
        
        // 允许PageUp、PageDown和箭头键用于页面滚动
        // 确保不阻止翻页键的默认行为
        if (
            (e.ctrlKey && forbiddenKeys.includes(e.key)) ||
            (e.altKey && e.key === 'Tab') ||
            (e.key === 'F5' && !isVideoPage()) ||
            (e.metaKey && forbiddenKeys.includes(e.key))  // Meta键(Windows/Command)
        ) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // 禁用浏览器默认的标签页切换行为
    document.addEventListener('visibilitychange', (e) => {
        if (!isExiting && !passwordVerified) {
            e.preventDefault();
            e.stopPropagation();
            if (document.hidden) {
                window.focus();
                setTimeout(() => {
                    enterFullscreen();
                }, 100);
            }
        }
    }, true);

    // 阻止鼠标事件可能触发的标签页切换
    document.addEventListener('mousedown', (e) => {
        if (e.button === 1) {  // 中键点击
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // 阻止拖拽标签页
    document.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
}

// 修改导航禁用函数
function disableNavigation() {
    // 禁用所有链接
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            // 检查是否是B站内部链接
            const isBilibiliLink = link.href && (
                link.href.includes('bilibili.com') || 
                link.href.startsWith('/') || 
                link.href.startsWith('#')
            );
            
            if (isBilibiliLink) {
                // 如果是视频页面，允许直接跳转
                if (link.href.includes('/video/') || 
                    link.href.includes('/bangumi/') ||
                    link.href.includes('/cheese/')) {
                    return true;
                }
                
                // 如果是首页，应用首页处理
                if (isHomePage(link.href)) {
                    e.preventDefault();
                    window.stop();
                    setupHomePage();
                    return false;
                }
                
                // 其他B站页面允许直接跳转
                return true;
            }
            
            e.preventDefault();
            e.stopPropagation();
            checkPasswordBeforeAction("要跳转到其他页面吗？");
            return false;
        }, true);
    });

    // 禁用浏览器导航栏
    history.pushState(null, null, document.URL);
    window.addEventListener('popstate', function() {
        history.pushState(null, null, document.URL);
        // 检查是否是浏览器后退到B站内部页面
        const previousUrl = document.referrer;
        if (previousUrl && previousUrl.includes('bilibili.com')) {
            return true;
        }
        checkPasswordBeforeAction("要离开B站吗？");
    });
}

// 创建全局遮罩层
function createGlobalOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'global-overlay';
    
    // 阻止点击和鼠标事件，但允许键盘事件用于页面滚动
    overlay.addEventListener('click', preventEvent, true);
    overlay.addEventListener('mousedown', preventEvent, true);
    overlay.addEventListener('mouseup', preventEvent, true);
    
    // 允许滚轮事件通过
    overlay.addEventListener('wheel', (e) => {
        e.stopPropagation();
        return true;
    }, true);
    
    // 对键盘事件使用修改后的preventEvent函数
    overlay.addEventListener('keydown', preventEvent, true);
    overlay.addEventListener('keyup', preventEvent, true);
    overlay.addEventListener('keypress', preventEvent, true);
    
    document.body.appendChild(overlay);
    return overlay;
}

// 阻止事件传播，但允许页面滚动相关的事件
function preventEvent(e) {
    // 如果不是视频页面，不阻止任何事件
    if (!isVideoPage()) {
        return true;
    }
    
    // 检查是否是搜索结果页面
    const isSearchPage = window.location.href.includes('search.bilibili.com');
    if (isSearchPage) {
        return true; // 在搜索页面允许所有事件
    }
    
    // 允许与页面滚动相关的键盘事件通过
    if (e.type === 'keydown') {
        const scrollKeys = ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Space'];
        if (scrollKeys.includes(e.key)) {
            return true;
        }
    }
    
    // 允许鼠标滚轮事件通过，优化滚动体验
    if (e.type === 'wheel' || e.type === 'mousewheel' || e.type === 'DOMMouseScroll') {
        return true;
    }
    
    // 允许触摸滚动事件通过，优化移动端体验
    if (e.type === 'touchstart' || e.type === 'touchmove' || e.type === 'touchend') {
        return true;
    }
    
    e.preventDefault();
    e.stopPropagation();
    return false;
}

// 修改退出监听器设置，添加更严格的状态控制
function setupExitListeners() {
    let isHandlingExit = false; // 添加处理中标记
    
    // 创建统一的退出检查处理函数
    const handleExitAttempt = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // 严格检查状态，确保不会重复触发
        if (isHandlingExit || isProcessing || !document.body.classList.contains('video-page')) {
            return;
        }

        // 标记正在处理退出
        isHandlingExit = true;
        
        // 使用 requestAnimationFrame 确保状态更新
        requestAnimationFrame(() => {
            startExitCheck();
            // 短暂延迟后重置状态
            setTimeout(() => {
                isHandlingExit = false;
            }, 500);
        });
    };

    // 监听所有可能的退出行为
    const exitEvents = [
        { type: 'keydown', condition: e => e.key === 'Escape' || e.key === 'Esc' },
        { type: 'keydown', condition: e => e.key === 'F11' },
        { type: 'fullscreenchange', condition: () => !document.fullscreenElement && !isExiting },
        { type: 'mousedown', condition: e => e.button === 1 }, // 中键点击
        { type: 'keydown', condition: e => e.altKey && e.key === 'Enter' } // Alt+Enter
    ];

    // 使用事件委托来减少事件监听器数量
    const handleEvent = (e) => {
        const eventType = e.type;
        const matchingEvent = exitEvents.find(event => 
            event.type === eventType && event.condition(e)
        );
        
        if (matchingEvent) {
            handleExitAttempt(e);
        }
    };

    // 只添加必要的事件监听器
    document.addEventListener('keydown', handleEvent, true);
    document.addEventListener('mousedown', handleEvent, true);
    document.addEventListener('fullscreenchange', handleEvent, true);

    // 监听播放器双击事件
    waitForElement('#bilibili-player', (player) => {
        // 监听播放器内的退出全屏按钮
        const fullscreenBtns = [
            '.bpx-player-ctrl-btn-fullscreen',
            '.bilibili-player-video-btn-fullscreen',
            '.squirtle-video-fullscreen'
        ];

        // 使用事件委托处理按钮点击
        player.addEventListener('click', (e) => {
            const isFullscreenBtn = fullscreenBtns.some(selector => 
                e.target.matches(selector) || e.target.closest(selector)
            );
            
            if (isFullscreenBtn) {
                handleExitAttempt(e);
            }
        }, true);

        // 优化双击事件处理
        let lastClickTime = 0;
        player.addEventListener('click', (e) => {
            const currentTime = new Date().getTime();
            if (currentTime - lastClickTime < 300) {
                const isInBrowserFullscreen = document.fullscreenElement !== null;
                
                if (isInBrowserFullscreen) {
                    handleExitAttempt(e);
                } else {
                    // 静默处理浏览器全屏失败
                    player.requestFullscreen().catch(() => {
                        // 使用备用全屏方案，不显示错误信息
                        useBackupFullscreen(player);
                    });
                }
            }
            lastClickTime = currentTime;
        }, true);
    });

    // 禁用右键菜单
    document.addEventListener('contextmenu', (e) => {
        if (document.body.classList.contains('video-page')) {
            e.preventDefault();
        }
    }, true);
}

// 修改退出验证流程，优化取消处理
function startExitCheck() {
    // 防止重复触发
    if (isProcessing || isValidating) {
        return;
    }
    
    isProcessing = true;
    isValidating = true;

    // 保存当前视频播放状态
    const videoPlayer = getVideoPlayer();
    const wasPlaying = videoPlayer && !videoPlayer.paused;
    if (videoPlayer) {
        videoPlayer.pause();
    }

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.7);
        z-index: 2147483647;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    document.body.appendChild(overlay);

    // 统一的取消处理函数 - 确保快速恢复
    const handleCancel = () => {
        // 立即移除遮罩层
        if (document.body.contains(overlay)) {
            overlay.remove();
        }
        
        // 立即重置所有状态
        isProcessing = false;
        isValidating = false;
        isExiting = false;
        
        // 立即恢复视频播放
        if (videoPlayer && wasPlaying) {
            const playPromise = videoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // 如果自动播放失败，立即添加一次性点击事件
                    const playHandler = () => {
                        videoPlayer.play().catch(() => {});
                    };
                    document.addEventListener('click', playHandler, { once: true });
                });
            }
        }
        
        // 立即重新进入全屏
        requestAnimationFrame(() => {
            if (!isValidating && !isExiting && !passwordVerified) {
                enterFullscreen();
            }
        });

        // 阻止后续弹窗
        return false;
    };

    // 点击遮罩层空白处立即取消
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            handleCancel();
        }
    }, { capture: true });  // 使用捕获阶段确保最先处理

    // 显示提醒语和验证
    let currentIndex = 0;
    let isDialogShowing = false;  // 添加标记防止重复弹窗

    function showNextDialog() {
        // 如果已经取消或正在显示弹窗，直接返回
        if (!document.body.contains(overlay) || isDialogShowing) {
            return;
        }

        isDialogShowing = true;

        // 如果还有提醒语要显示
        if (currentIndex < reminders.length) {
            const confirmed = window.confirm(reminders[currentIndex]);
            isDialogShowing = false;
            
            if (!confirmed) {
                handleCancel();
                return;
            }
            currentIndex++;
            setTimeout(showNextDialog, 0);
            return;
        }

        // 显示密码输入框
        const userInput = window.prompt('请输入密码：');
        isDialogShowing = false;
        
        if (!userInput) {
            handleCancel();
            return;
        }

        if (userInput !== password) {
            alert('密码错误！');
            handleCancel();
            return;
        }

        // 最终确认
        const finalConfirm = window.confirm('确认要退出全屏模式吗？\n\n点击"确定"退出\n点击"取消"继续学习');
        isDialogShowing = false;
        
        if (!finalConfirm) {
            handleCancel();
            return;
        }

        // 验证通过，正常退出
        if (document.body.contains(overlay)) {
            overlay.remove();
        }
        passwordVerified = true;
        isValidating = false;
        isExiting = true;
        isProcessing = false;
        cleanupFullscreen();
    }

    // 开始显示第一个弹窗
    showNextDialog();
}

// 修改密码检查函数
async function checkPasswordBeforeAction(message) {
    // 保存当前视频播放状态
    const videoPlayer = getVideoPlayer();
    const wasPlaying = videoPlayer && !videoPlayer.paused;
    
    // 暂停视频
    if (videoPlayer && wasPlaying) {
        videoPlayer.pause();
    }

    // 使用 prompt 进行密码验证
    const userInput = prompt(`${reminders[0]}\n\n${message}\n\n请输入密码：`);
    
    if (userInput === password) {
        passwordVerified = true;
        return true;
    }
    
    // 如果取消或密码错误，强制恢复播放并保持全屏
    if (videoPlayer) {
        // 确保视频继续播放
        if (wasPlaying) {
            const playPromise = videoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    document.addEventListener('click', () => {
                        videoPlayer.play();
                    }, { once: true });
                });
            }
        }
        // 强制进入全屏
        enterFullscreen();
    }
    
    if (userInput !== null && userInput !== password) {
        alert('密码错误，请重试！');
    }
    return false;
}

// 修改键盘事件处理
function handleKeyPress(e) {
    // 允许翻页键的默认行为
    const scrollKeys = ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Space'];
    if (scrollKeys.includes(e.key)) {
        return true;
    }
    
    // 处理 F11 键
    if (e.key === 'F11') {
        e.preventDefault();
        if (document.fullscreenElement) {
            startExitCheck();
        } else {
            enterFullscreen();
        }
        return;
    }

    // 拦截 ESC 键
    if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        startExitCheck();
        return false;
    }
    
    // 拦截其他快捷键
    if (
        (e.altKey && e.key === 'Tab') ||
        (e.ctrlKey && e.key === 'Tab') ||
        (e.altKey && e.key === 'F4') ||
        (e.ctrlKey && e.key === 'w') ||
        (e.ctrlKey && e.key === 't') ||
        (e.ctrlKey && e.key === 'n') ||
        (e.winKey || e.key === 'Meta')
    ) {
        e.preventDefault();
        e.stopPropagation();
        checkPasswordBeforeAction("要切换窗口吗？");
        return false;
    }
}

// 处理全屏按钮点击
function handleFullscreenButtonClick(e) {
    if (document.fullscreenElement) {
        e.preventDefault();
        e.stopPropagation();
        startExitCheck();
        return false;
    }
}

// 处理右键菜单
function handleContextMenu(e) {
    if (document.fullscreenElement) {
        e.preventDefault();
        return false;
    }
}

// 处理浏览器快捷键
function handleBrowserShortcuts(e) {
    // 拦截可能导致退出全屏的组合键
    if ((e.ctrlKey && e.key === 'w') || // Ctrl+W
        (e.altKey && e.key === 'F4') || // Alt+F4
        (e.key === 'F11')) {            // F11
        e.preventDefault();
        e.stopPropagation();
        startExitCheck();
        return false;
    }
}

// 退出全屏
function exitFullscreen() {
    try {
        // 使用B站原生的退出全屏按钮
        const exitFullscreenButton = document.querySelector('.bpx-player-ctrl-btn-fullscreen, .bilibili-player-video-btn-fullscreen');
        if (exitFullscreenButton) {
            exitFullscreenButton.click();
        } else {
            // 如果找不到按钮，手动清理全屏样式
            cleanupFullscreen();
        }
    } catch (error) {
        console.log('使用备用退出全屏模式');
        cleanupFullscreen();
    }
}

// 修改隐藏元素函数，确保完全隐藏所有干扰元素
function hideElements() {
    if (!isVideoPage()) return;

    // 关闭弹幕
    function disableDanmaku() {
        const danmakuSwitches = [
            '.bpx-player-dm-switch input[type="checkbox"]',
            '.bilibili-player-video-danmaku-switch input[type="checkbox"]',
            '.bilibili-player-video-danmaku-switch .bui-switch-input',
            '.bui-switch-input[name="danmaku"]'
        ];

        for (const selector of danmakuSwitches) {
            const switchElements = document.querySelectorAll(selector);
            switchElements.forEach(element => {
                if (element && element.checked) {
                    try {
                        element.click();
                    } catch (e) {
                        console.log('关闭弹幕失败:', e);
                    }
                }
            });
        }
        
        // 尝试通过API关闭弹幕
        try {
            const danmakuApi = window.__INITIAL_STATE__?.globalConfig?.getDanmaku;
            if (typeof danmakuApi === 'function') {
                danmakuApi(false);
            }
        } catch (e) {
            console.log('通过API关闭弹幕失败:', e);
        }
    }

    disableDanmaku();

    const style = document.createElement('style');
    style.setAttribute('data-plugin-style', 'true');
    style.textContent = `
        /* 只隐藏干扰元素，保留视频下方文字内容 */
        body.video-page .bili-header__bar,
        body.video-page .nav-tools,
        body.video-page .mini-header,
        body.video-page .recommend-list,
        body.video-page .fixed-nav,
        body.video-page .float-nav,
        body.video-page .danmukuBox,
        body.video-page .bpx-player-auxiliary,
        body.video-page .bpx-player-dm-wrap,
        body.video-page .bpx-player-dm-btn-wrap,
        body.video-page .recommend-container,
        body.video-page .footer,
        /* 屏蔽热榜热搜推荐广告等内容 */
        body.video-page .rank-list,
        body.video-page .rank-container,
        body.video-page .rank-wrap,
        body.video-page .rank-tab,
        body.video-page .rank-item,
        body.video-page .trending-list,
        body.video-page .hot-list,
        body.video-page .popular-list,
        body.video-page [class*="rank-"],
        body.video-page [class*="trending-"],
        body.video-page [class*="hot-"],
        body.video-page [class*="popular-"],
        body.video-page [class*="ad-"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            width: 0 !important;
            position: absolute !important;
            z-index: -9999 !important;
        }
        
        /* 保持视频播放器原有位置和大小 */
        body.video-page #bilibili-player {
            position: relative !important;
            z-index: 100 !important;
            background: transparent !important;
        }

        /* 恢复页面正常滚动和显示 */
        body.video-page {
            position: relative !important;
            overflow-x: hidden !important; /* 只禁用水平滚动 */
            overflow-y: auto !important; /* 允许垂直滚动 */
        }

        /* 控制栏默认隐藏 */
        body.video-page .bpx-player-control-wrap {
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        /* 鼠标移动时显示控制栏 */
        body.video-page #bilibili-player:hover .bpx-player-control-wrap {
            opacity: 1;
        }
    `;
    
    document.head.appendChild(style);
    document.body.classList.add('video-page');
}

// 错误处理
function handleError(error) {
    console.error('全屏错误:', error);
}

// 修改清理函数
function cleanupFullscreen() {
    // 移除视频页面标识
    document.body.classList.remove('video-page');
    
    // 确保只在验证通过且正在退出时执行清理
    if (!passwordVerified || !isExiting) {
        // 如果条件不满足，恢复全屏
        enterFullscreen();
        return;
    }

    // 清理所有可能的播放器容器样式
    const playerSelectors = ['#bilibili-player', '.bpx-player-container', '.player-container', '.bilibili-player-video-container'];
    
    playerSelectors.forEach(selector => {
        const container = document.querySelector(selector);
        if (container) {
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.width = '';
            container.style.height = '';
            container.style.zIndex = '';
            container.style.backgroundColor = '';
            container.style.background = '';
        }
    });

    // 移除添加的全屏样式表
    const fullscreenStyle = document.getElementById('bilibili-fullscreen-style');
    if (fullscreenStyle) {
        fullscreenStyle.remove();
    }
    
    // 移除所有带有data-plugin-style属性的样式表
    const pluginStyles = document.querySelectorAll('style[data-plugin-style="true"]');
    pluginStyles.forEach(style => style.remove());
    
    // 恢复视频播放器的原始尺寸
    const videoPlayers = document.querySelectorAll('video');
    videoPlayers.forEach(player => {
        player.style.width = '';
        player.style.height = '';
        player.style.objectFit = '';
    });

    // 确保移除所有全屏相关的样式
    document.body.classList.remove('fullscreen-mode');
    document.body.classList.remove('locked');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';

    // 重置状态
    setTimeout(() => {
        passwordVerified = false;
        isExiting = false;
        isValidating = false;
    }, 1000);
}

// 修改悬浮按钮函数
function addFloatingButton() {
    // 移除可能存在的旧按钮
    const oldButton = document.querySelector('.floating-restore-button');
    if (oldButton) {
        oldButton.remove();
    }

    const button = document.createElement('div');
    button.className = 'floating-restore-button';
    button.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
        <span>恢复全屏</span>
    `;
    
    // 点击事件
    button.addEventListener('click', () => {
        // 移除按钮并恢复全屏
        button.remove();
        passwordVerified = false;
        isExiting = false;
        enterFullscreen();
    });
    
    document.body.appendChild(button);
}

// 修改清理事件监听器的函数（原cleanup函数改名）
function removeEventListeners() {
    document.removeEventListener('keydown', handleKeyPress, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    window.removeEventListener('blur', handleWindowBlur, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    window.removeEventListener('keydown', handleBrowserShortcuts, true);
    
    // 移除事件拦截
    document.removeEventListener('mousedown', preventEvent, true);
    document.removeEventListener('click', preventEvent, true);
    document.removeEventListener('contextmenu', preventEvent, true);
    
    // 重新启用表单元素
    document.querySelectorAll('input, button, select, textarea, a').forEach(element => {
        element.disabled = false;
        element.style.pointerEvents = 'auto';
    });
}

// 立即执行的代码块，在脚本加载时就检查是否是首页并立即拦截
(function() {
    // 检查是否是首页
    if (isHomePage()) {
        console.log('检测到B站首页，立即拦截原始内容加载');
        // 立即应用简洁搜索界面
        setupHomePage();
    }
})();

// 页面加载完成后初始化其他功能
window.addEventListener('load', () => {
    // 如果不是首页，则正常初始化
    if (!isHomePage()) {
        setTimeout(initPlugin, 100);
    }
});

// DOMContentLoaded 时也尝试初始化其他功能
document.addEventListener('DOMContentLoaded', () => {
    // 如果不是首页，则正常初始化
    if (!isHomePage()) {
        setTimeout(initPlugin, 100);
    }
});

// 添加document.readyState检查，确保在任何状态下都能执行
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // 如果不是首页，则正常初始化
    if (!isHomePage()) {
        setTimeout(initPlugin, 100);
    }
}

// 修改音量恢复函数
function restoreVideoVolume() {
    const videoPlayer = getVideoPlayer();
    if (videoPlayer) {
        // 立即尝试取消静音
        videoPlayer.muted = false;
        
        // 如果音量为0，设置默认音量
        if (videoPlayer.volume === 0) {
            videoPlayer.volume = 0.5;
        }

        // 监听播放事件
        videoPlayer.addEventListener('play', function onPlay() {
            // 再次确保不是静音
            videoPlayer.muted = false;
            if (videoPlayer.volume === 0) {
                videoPlayer.volume = 0.5;
            }
            // 移除监听器
            videoPlayer.removeEventListener('play', onPlay);
        });

        // 监听音量变化
        videoPlayer.addEventListener('volumechange', function() {
            // 防止被设置为静音
            if (videoPlayer.muted) {
                videoPlayer.muted = false;
            }
            // 防止音量为0
            if (videoPlayer.volume === 0) {
                videoPlayer.volume = 0.5;
            }
        });
    }
}

// 添加重置密码函数
function resetPassword() {
    // 先验证当前密码
    const oldPassword = prompt('请输入当前密码以验证身份：');
    if (oldPassword !== password) {
        alert('当前密码错误，无法重置！');
        return;
    }

    const newPassword = prompt('请输入新密码：');
    if (!newPassword) {
        alert('密码不能为空！');
        return;
    }

    const confirmPassword = prompt('请再次输入新密码：');
    if (newPassword !== confirmPassword) {
        alert('两次输入的密码不一致！');
        return;
    }

    // 更新提醒语
    const reminderCount = parseInt(prompt('想要重新设置几句提醒话语？（建议3-5句）：')) || 3;
    const newReminders = [];
    
    for (let i = 0; i < reminderCount; i++) {
        const newReminder = prompt(`请输入第 ${i + 1} 句提醒话语：`);
        if (newReminder) {
            newReminders.push(newReminder);
        }
    }

    if (newReminders.length > 0) {
        // 更新密码和提醒语
        password = newPassword;
        reminders = newReminders;
        
        // 保存到存储
        storage.set({
            password: newPassword,
            reminders: newReminders
        }, function() {
            alert('密码和提醒语已成功重置！\n可以使用 Ctrl + Alt + R 快捷键随时重置。');
        });
    }
}

// 添加全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局错误:', e);
    // 确保错误不会影响基本功能
    enterFullscreen();
});

// 建议改进：添加简单加密
function encryptPassword(pwd) {
    return btoa(pwd.split('').reverse().join('')); 
}

function decryptPassword(encrypted) {
    return atob(encrypted).split('').reverse().join('');
}

// 建议改进：添加清理函数并在重新设置前调用
function cleanupEventListeners() {
    document.removeEventListener('keydown', handleKeyPress, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    // ...移除其他监听器
}

// 建议改进：添加更多备选选择器和错误处理
function getVideoPlayer() {
    const selectors = [
        '.bpx-player-video-wrap video',
        '.bilibili-player-video video',
        '#bilibili-player video',
        'video'  // 最后的备选
    ];
    
    for (const selector of selectors) {
        const player = document.querySelector(selector);
        if (player) return player;
    }
    return null;
}

// 建议改进：添加浏览器前缀支持
function requestFullscreen(element) {
    const methods = [
        'requestFullscreen',
        'webkitRequestFullscreen',
        'mozRequestFullScreen',
        'msRequestFullscreen'
    ];
    
    for (const method of methods) {
        if (element[method]) {
            element[method]();
            return true;
        }
    }
    return false;
}

// 添加全局错误处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise错误:', event.reason);
    // 添加适当的错误恢复机制
});

// 优化页面滚动性能
// 添加节流函数，优化频繁触发的事件处理
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

function optimizePageScroll() {
    // 移除可能存在的旧样式，避免重复添加
    const oldStyle = document.getElementById('bilibili-scroll-optimizer');
    if (oldStyle) {
        oldStyle.remove();
    }
    
    // 使用节流函数处理滚动事件，减少性能消耗
    const handleScroll = throttle(() => {
        // 检测是否是搜索结果页面
        const isSearchPage = window.location.href.includes('search.bilibili.com');
        if (isSearchPage) {
            // 确保搜索页面的滚动行为正常
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }
    }, 100); // 100ms的节流时间
    
    // 使用被动事件监听器提高滚动性能
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    // 对滚轮事件使用被动监听器
    document.addEventListener('wheel', function(e) {
        // 确保在搜索结果页面允许正常滚动
        const isSearchPage = window.location.href.includes('search.bilibili.com');
        if (isSearchPage) {
            return true; // 允许默认行为
        }
    }, { passive: true });
    
    // 对触摸事件使用被动监听器，优化移动端体验
    document.addEventListener('touchstart', function() {
        // 空函数，仅用于启用被动滚动
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        // 确保在搜索结果页面允许正常滚动
        const isSearchPage = window.location.href.includes('search.bilibili.com');
        if (isSearchPage) {
            return true; // 允许默认行为
        }
    }, { passive: true });
    
    // 添加全局样式以确保所有页面可以正常滚动
    const scrollStyle = document.createElement('style');
    scrollStyle.id = 'bilibili-scroll-optimizer';
    scrollStyle.textContent = `
        /* 确保所有非视频页面可以正常滚动 */
        body:not(.video-page) {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            height: auto !important;
            position: relative !important;
        }
        
        /* 特别优化搜索结果页面的滚动体验 */
        body.search-page {
            overflow: auto !important;
            height: auto !important;
            position: relative !important;
        }
        
        /* 优化滚动性能 */
        * {
            scroll-behavior: smooth;
        }
        
        /* 减少不必要的重排和重绘 */
        .bili-video-card,
        .bili-live-card,
        .feed-card,
        .search-page-video-list {
            will-change: transform;
            transform: translateZ(0);
            contain: content; /* 使用CSS包含属性优化渲染 */
        }
        
        /* 优化搜索结果页面的视频卡片渲染 */
        .search-page .video-list .video-item {
            contain: layout;
            will-change: transform;
        }
    `;
    document.head.appendChild(scrollStyle);
    
    // 检测当前是否是搜索页面，如果是则添加特定类名
    if (window.location.href.includes('search.bilibili.com')) {
        document.body.classList.add('search-page');
    }
}

// 添加重试机制
async function retry(fn, maxAttempts = 3) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxAttempts - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// 修改首页检测函数
function isHomePage(url = window.location.href) {
    const urlToCheck = url.split('?')[0].toLowerCase();
    // 严格匹配首页URL
    return (
        urlToCheck === 'https://www.bilibili.com' ||
        urlToCheck === 'https://www.bilibili.com/' ||
        urlToCheck === 'https://bilibili.com' ||
        urlToCheck === 'https://bilibili.com/' ||
        urlToCheck === 'https://m.bilibili.com' ||
        urlToCheck === 'https://m.bilibili.com/'
    );
}

// 添加一个专门处理搜索页面的函数
function fixSearchPage() {
  console.log('正在修复搜索页面...');
  
  // 检查是否是搜索页面
  if (!window.location.href.includes('search.bilibili.com')) {
    return;
  }
  
  // 添加搜索页面专用样式
  const style = document.createElement('style');
  style.textContent = `
    /* 强制显示搜索结果 */
    .bili-video-card__info--tit,
    .bili-video-card__info--desc,
    .bili-video-card__info--bottom,
    .bili-video-card__stats,
    .bili-video-card__stats--left,
    .bili-video-card__stats--right {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      overflow: visible !important;
      color: #000 !important;
    }
    
    /* 确保视频卡片可见 */
    .bili-video-card {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      min-height: 200px !important;
      margin-bottom: 20px !important;
      background-color: #fff !important;
    }
    
    /* 修复搜索页面布局 */
    .search-content {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
  
  // 直接修改DOM元素
  function forceShowElements() {
    // 查找所有视频卡片标题
    const titles = document.querySelectorAll('.bili-video-card__info--tit');
    titles.forEach(title => {
      // 保存原始内容
      const originalText = title.textContent;
      
      // 创建新元素替换原来的标题
      const newTitle = document.createElement('h3');
      newTitle.textContent = originalText;
      newTitle.style.display = 'block';
      newTitle.style.visibility = 'visible';
      newTitle.style.opacity = '1';
      newTitle.style.color = '#000';
      newTitle.style.fontSize = '16px';
      newTitle.style.margin = '10px 0';
      newTitle.style.fontWeight = 'bold';
      
      // 替换原始标题
      if (title.parentNode) {
        title.parentNode.insertBefore(newTitle, title);
        title.style.display = 'none';
      }
    });
    
    // 查找所有视频卡片描述
    const descs = document.querySelectorAll('.bili-video-card__info--desc');
    descs.forEach(desc => {
      // 保存原始内容
      const originalText = desc.textContent;
      
      // 创建新元素替换原来的描述
      const newDesc = document.createElement('p');
      newDesc.textContent = originalText;
      newDesc.style.display = 'block';
      newDesc.style.visibility = 'visible';
      newDesc.style.opacity = '1';
      newDesc.style.color = '#666';
      newDesc.style.fontSize = '14px';
      newDesc.style.margin = '5px 0';
      
      // 替换原始描述
      if (desc.parentNode) {
        desc.parentNode.insertBefore(newDesc, desc);
        desc.style.display = 'none';
      }
    });
  }
  
  // 立即执行一次
  forceShowElements();
  
  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver((mutations) => {
    forceShowElements();
  });
  
  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 60秒后停止观察
  setTimeout(() => observer.disconnect(), 60000);
}

// 在页面加载完成后执行
document.addEventListener('DOMContentLoaded', fixSearchPage);

// 添加一个专门处理UP主页面和视频列表的函数
function fixVideoListPage() {
  console.log('正在修复视频列表页面...');
  
  // 添加专用样式
  const style = document.createElement('style');
  style.textContent = `
    /* 强制显示所有视频卡片和标题 */
    .video-card, .small-card, .video-page-card, 
    .video-item, .small-item, .mini-item,
    .bili-video-card, .bili-video-card__wrap,
    .up-info-video-card {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      min-height: 100px !important;
      margin-bottom: 20px !important;
      overflow: visible !important;
      background-color: #fff !important;
      transform: none !important;
      transition: none !important;
    }
    
    /* 强制显示标题和描述 */
    .title, .video-title, .bili-video-card__info--tit,
    .desc, .des, .bili-video-card__info--desc,
    .video-name, .info-title, .up-video-title {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      min-height: 16px !important;
      color: #000 !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      margin: 5px 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      text-overflow: ellipsis !important;
      white-space: normal !important;
      pointer-events: auto !important;
    }
    
    /* 强制显示底部信息 */
    .bili-video-card__info--bottom, .bili-video-card__stats,
    .video-card__info, .video-info, .info-bottom,
    .meta, .meta-line, .meta-item {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      color: #666 !important;
    }
  `;
  document.head.appendChild(style);
  
  // 直接修改DOM元素
  function forceShowAllVideoElements() {
    // 查找所有可能的视频卡片
    const videoCards = document.querySelectorAll('.video-card, .small-card, .video-page-card, .video-item, .small-item, .mini-item, .bili-video-card, .up-info-video-card');
    
    videoCards.forEach(card => {
      // 强制显示卡片
      card.style.display = 'block';
      card.style.visibility = 'visible';
      card.style.opacity = '1';
      card.style.height = 'auto';
      card.style.minHeight = '100px';
      card.style.overflow = 'visible';
      
      // 查找并强制显示标题
      const title = card.querySelector('.title, .video-title, .bili-video-card__info--tit, .video-name, .info-title, .up-video-title');
      if (title) {
        title.style.display = 'block';
        title.style.visibility = 'visible';
        title.style.opacity = '1';
        title.style.height = 'auto';
        title.style.color = '#000';
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.margin = '5px 0';
        title.style.overflow = 'visible';
      }
      
      // 查找并强制显示描述
      const desc = card.querySelector('.desc, .des, .bili-video-card__info--desc');
      if (desc) {
        desc.style.display = 'block';
        desc.style.visibility = 'visible';
        desc.style.opacity = '1';
        desc.style.height = 'auto';
        desc.style.color = '#666';
        desc.style.fontSize = '12px';
        desc.style.margin = '5px 0';
        desc.style.overflow = 'visible';
      }
      
      // 查找并强制显示底部信息
      const bottom = card.querySelector('.bili-video-card__info--bottom, .bili-video-card__stats, .video-card__info, .video-info, .info-bottom, .meta');
      if (bottom) {
        bottom.style.display = 'flex';
        bottom.style.visibility = 'visible';
        bottom.style.opacity = '1';
        bottom.style.height = 'auto';
        bottom.style.color = '#666';
      }
    });
    
    // 特殊处理：如果找不到元素，尝试创建新元素
    document.querySelectorAll('.bili-video-card__info').forEach(info => {
      const title = info.querySelector('.bili-video-card__info--tit');
      const desc = info.querySelector('.bili-video-card__info--desc');
      
      if (title && title.textContent && title.offsetHeight < 5) {
        // 标题存在但不可见，创建新元素
        const newTitle = document.createElement('h3');
        newTitle.textContent = title.textContent;
        newTitle.style.display = 'block';
        newTitle.style.visibility = 'visible';
        newTitle.style.opacity = '1';
        newTitle.style.color = '#000';
        newTitle.style.fontSize = '14px';
        newTitle.style.fontWeight = 'bold';
        newTitle.style.margin = '5px 0';
        
        // 插入到原标题前面
        if (title.parentNode) {
          title.parentNode.insertBefore(newTitle, title);
          title.style.display = 'none';
        }
      }
      
      if (desc && desc.textContent && desc.offsetHeight < 5) {
        // 描述存在但不可见，创建新元素
        const newDesc = document.createElement('p');
        newDesc.textContent = desc.textContent;
        newDesc.style.display = 'block';
        newDesc.style.visibility = 'visible';
        newDesc.style.opacity = '1';
        newDesc.style.color = '#666';
        newDesc.style.fontSize = '12px';
        newDesc.style.margin = '5px 0';
        
        // 插入到原描述前面
        if (desc.parentNode) {
          desc.parentNode.insertBefore(newDesc, desc);
          desc.style.display = 'none';
        }
      }
    });
  }
  
  // 立即执行一次
  forceShowAllVideoElements();
  
  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver(() => {
    forceShowAllVideoElements();
  });
  
  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 60秒后停止观察
  setTimeout(() => observer.disconnect(), 60000);
}

// 在页面加载完成后执行
document.addEventListener('DOMContentLoaded', fixVideoListPage);

// 修复专注模式黑屏问题
function fixFullscreenMode() {
  console.log('正在修复专注模式...');
  
  // 添加专用样式确保视频元素可见
  const style = document.createElement('style');
  style.id = 'bilibili-fullscreen-fix';
  style.textContent = `
    /* 确保视频播放器在全屏模式下可见 */
    body.fullscreen-mode #bilibili-player,
    body.fullscreen-mode .bpx-player-container,
    body.fullscreen-mode .player-container,
    body.fullscreen-mode .bilibili-player-video-container {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 999999 !important;
      background-color: #000 !important;
    }
    
    /* 确保视频元素本身可见 */
    body.fullscreen-mode video,
    body.fullscreen-mode .bpx-player-video-wrap video,
    body.fullscreen-mode .bilibili-player-video video {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
      z-index: 1000000 !important;
    }
    
    /* 确保控制栏可见 */
    body.fullscreen-mode .bpx-player-control-wrap,
    body.fullscreen-mode .bilibili-player-video-control-wrap,
    body.fullscreen-mode .bpx-player-sending-bar,
    body.fullscreen-mode .bilibili-player-video-sendbar,
    body.fullscreen-mode .bpx-player-ctrl-btn,
    body.fullscreen-mode .bilibili-player-video-btn,
    body.fullscreen-mode .bpx-player-ctrl-volume,
    body.fullscreen-mode .bilibili-player-video-volume,
    body.fullscreen-mode .bpx-player-ctrl-quality,
    body.fullscreen-mode .bilibili-player-video-quality,
    body.fullscreen-mode .bpx-player-video-progress,
    body.fullscreen-mode .bilibili-player-video-progress {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1000001 !important;
    }
    
    /* 隐藏弹幕相关选项 */
    body.fullscreen-mode .bpx-player-dm-wrap,
    body.fullscreen-mode .bilibili-player-video-danmaku,
    body.fullscreen-mode .bpx-player-dm-btn-wrap,
    body.fullscreen-mode .bilibili-player-video-danmaku-switch,
    body.fullscreen-mode .bpx-player-dm-setting,
    body.fullscreen-mode .bilibili-player-video-danmaku-setting {
      display: none !important;
    }
    
    /* 确保选集功能可见 */
    body.fullscreen-mode .bpx-player-playlist-wrap,
    body.fullscreen-mode .bilibili-player-video-playlist-wrap,
    body.fullscreen-mode .bpx-player-sending-bar,
    body.fullscreen-mode .bilibili-player-video-sendbar {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 1000002 !important;
    }
  `;
  document.head.appendChild(style);
  
  // 定期检查视频是否可见
  const checkVideoInterval = setInterval(() => {
    if (document.body.classList.contains('fullscreen-mode')) {
      ensureVideoVisible();
    }
  }, 1000);
  
  // 最多检查5分钟
  setTimeout(() => clearInterval(checkVideoInterval), 300000);
}

// 确保视频元素可见
function ensureVideoVisible() {
  // 查找视频元素
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    // 强制设置视频元素样式
    video.style.display = 'block';
    video.style.visibility = 'visible';
    video.style.opacity = '1';
    video.style.zIndex = '1000000';
    
    // 如果视频暂停了，尝试播放
    if (video.paused && document.body.classList.contains('fullscreen-mode')) {
      video.play().catch(err => console.log('自动播放失败:', err));
    }
    
    // 确保视频容器可见
    const playerContainer = video.closest('.bpx-player-container, #bilibili-player, .player-container');
    if (playerContainer) {
      playerContainer.style.display = 'block';
      playerContainer.style.visibility = 'visible';
      playerContainer.style.opacity = '1';
      playerContainer.style.zIndex = '999999';
    }
  });
}

// 在页面加载完成后执行所有初始化函数
document.addEventListener('DOMContentLoaded', function() {
  console.log('B站学习助手初始化...');
  
  // 初始化URL变化检测
  urlChangeDetector.init();
  
  // 检查当前页面类型并应用相应功能
  const currentUrl = window.location.href;
  
  if (isHomePage(currentUrl)) {
    console.log('检测到首页，应用专注搜索');
    setupHomePage();
  } else if (isVideoPage(currentUrl)) {
    console.log('检测到视频页面，应用专注模式');
    setupPageBehavior();
    fixFullscreenMode();
    
    // 设置视频学习记录
    setupVideoStudyRecording();
  } else if (currentUrl.includes('search.bilibili.com')) {
    console.log('检测到搜索页面，应用搜索结果优化');
    fixBilibiliSearchResults();
  }
});

// 设置视频学习记录
function setupVideoStudyRecording() {
  // 等待视频元素加载
  const checkVideoInterval = setInterval(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      clearInterval(checkVideoInterval);
      console.log('找到视频元素，设置学习记录');
      
      if (typeof window.setupStudyRecording === 'function') {
        window.setupStudyRecording(videoElement);
      } else {
        console.log('学习记录模块未加载，等待加载...');
        // 延迟再次尝试
        setTimeout(() => {
          if (typeof window.setupStudyRecording === 'function') {
            window.setupStudyRecording(videoElement);
          } else {
            console.error('学习记录模块加载失败');
          }
        }, 2000);
      }
    }
  }, 1000);
  
  // 最多等待30秒
  setTimeout(() => clearInterval(checkVideoInterval), 30000);
}

// 完全替换content.js中的URL监听部分

// 删除所有现有的URL监听代码
// 添加单一的URL监听实现
const urlChangeDetector = {
  lastUrl: location.href,
  observer: null,
  
  init: function() {
    console.log('初始化URL变化检测器');
    
    // 创建MutationObserver
    this.observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== this.lastUrl) {
        console.log(`URL变化: ${this.lastUrl} -> ${currentUrl}`);
        
        // 更新lastUrl
        const oldUrl = this.lastUrl;
        this.lastUrl = currentUrl;
        
        // 处理URL变化
        this.handleUrlChange(currentUrl, oldUrl);
      }
    });
    
    // 开始观察
    this.observer.observe(document, {subtree: true, childList: true});
    
    // 立即处理当前URL
    this.handleUrlChange(this.lastUrl, null);
  },
  
  handleUrlChange: function(newUrl, oldUrl) {
    // 延迟执行，确保DOM已加载
    setTimeout(() => {
      // 综合处理所有页面类型
      if (newUrl.includes('search.bilibili.com')) {
        console.log('检测到搜索页面，应用搜索结果优化');
        fixSearchPage();
        fixVideoListPage();
        fixBilibiliSearchResults();
      } else if (isHomePage(newUrl)) {
        console.log('检测到首页，应用专注搜索');
        setupHomePage();
      } else if (isVideoPage(newUrl)) {
        console.log('检测到视频页面，应用专注模式');
        setupPageBehavior();
        fixFullscreenMode();
      }
    }, 1000);
  }
};

// 在页面加载完成后初始化URL监听
document.addEventListener('DOMContentLoaded', function() {
  console.log('B站学习助手初始化...');
  urlChangeDetector.init();
});

// 添加一个专门处理B站搜索结果页面的函数
function fixBilibiliSearchResults() {
  console.log('正在修复B站搜索结果页面...');
  
  // 检查是否是B站搜索页面
  if (!window.location.href.includes('search.bilibili.com')) {
    return;
  }
  
  // 添加内联样式，强制显示视频标题和描述
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* 强制显示搜索结果中的视频标题和描述 */
    .bili-video-card .bili-video-card__info--tit,
    .bili-video-card .bili-video-card__info--desc,
    .bili-video-card__info--tit,
    .bili-video-card__info--desc,
    .video-item .info .title,
    .video-item .info .desc {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      min-height: 20px !important;
      overflow: visible !important;
      color: #000 !important;
      font-size: 14px !important;
      margin: 8px 0 !important;
      padding: 0 !important;
      position: static !important;
      z-index: 1 !important;
      pointer-events: auto !important;
      white-space: normal !important;
      text-overflow: ellipsis !important;
      -webkit-line-clamp: none !important;
    }
    
    /* 确保视频卡片可见 */
    .bili-video-card,
    .video-item {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      min-height: 120px !important;
      margin-bottom: 20px !important;
      background-color: #fff !important;
      border-radius: 8px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      overflow: visible !important;
    }
  `;
  document.head.appendChild(styleElement);
  
  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver(() => {
    // 查找所有视频卡片标题和描述
    document.querySelectorAll('.bili-video-card__info--tit, .video-item .info .title').forEach(title => {
      title.style.display = 'block';
      title.style.visibility = 'visible';
      title.style.opacity = '1';
      title.style.height = 'auto';
      title.style.color = '#000';
    });
    
    document.querySelectorAll('.bili-video-card__info--desc, .video-item .info .desc').forEach(desc => {
      desc.style.display = 'block';
      desc.style.visibility = 'visible';
      desc.style.opacity = '1';
      desc.style.height = 'auto';
      desc.style.color = '#666';
    });
  });
  
  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 60秒后停止观察
  setTimeout(() => observer.disconnect(), 60000);
}

// 主初始化函数
function init() {
  console.log('B站学习助手初始化...');
  
  if (state.initialized) {
    console.log('已经初始化过，跳过');
    return;
  }
  
  state.initialized = true;
  
  // 设置URL变化监听
  setupUrlChangeListener();
  
  // 处理当前页面
  handlePageByUrl(window.location.href);
}

// 设置URL变化监听
function setupUrlChangeListener() {
  const observer = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== state.lastUrl) {
      console.log(`URL变化: ${state.lastUrl} → ${currentUrl}`);
      
      // 更新lastUrl
      state.lastUrl = currentUrl;
      
      // 处理新页面
      handlePageByUrl(currentUrl);
    }
  });
  
  // 开始观察
  observer.observe(document, {subtree: true, childList: true});
}

// 根据URL处理页面
function handlePageByUrl(url) {
  if (isHomePage(url)) {
    console.log('检测到首页，应用专注搜索');
    setupHomePage();
  } else if (isVideoPage(url)) {
    console.log('检测到视频页面，应用专注模式');
    setupVideoPage();
  } else if (url.includes('search.bilibili.com')) {
    console.log('检测到搜索页面，应用搜索结果优化');
    fixBilibiliSearchResults();
  }
}

// 视频页面设置
function setupVideoPage() {
  // 设置页面行为
  setupPageBehavior();
  
  // 修复全屏模式
  fixFullscreenMode();
  
  // 设置视频学习记录
  setupVideoStudyRecording();
}

// 设置脚本初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 添加页面行为设置函数
function setupPageBehavior() {
  console.log('设置页面行为...');
  
  // 添加专注模式的样式
  if (isVideoPage()) {
    // 添加全屏模式类
    document.body.classList.add('fullscreen-mode');
    
    // 隐藏不必要的元素
    const style = document.createElement('style');
    style.setAttribute('data-plugin-style', 'true');
    style.textContent = `
      /* 隐藏干扰元素 */
      .bili-header, .international-header, .right-container, 
      .comment-container, #arc_toolbar, .recommend-container,
      .bpx-player-ending-related {
        display: none !important;
      }
      
      /* 专注于视频播放器 */
      .video-container, .bpx-player-container, #bilibili-player {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 999999 !important;
        background: #000 !important;
      }
      
      /* 隐藏弹幕 */
      .bpx-player-dm-wrap {
        display: none !important;
      }
      
      /* 优化滚动行为 */
      body {
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);
    
    // 禁用快捷键（除了必要的控制）
    disableShortcuts();
  } else {
    // 非视频页面，移除专注模式
    document.body.classList.remove('fullscreen-mode');
    const styles = document.querySelectorAll('style[data-plugin-style]');
    styles.forEach(style => style.remove());
  }
}

// 禁用可能导致页面离开的快捷键
function disableShortcuts() {
  document.addEventListener('keydown', function(e) {
    // 允许视频控制键（空格、方向键等）
    const allowedKeys = ['Space', 'ArrowLeft', 'ArrowRight', 
                         'ArrowUp', 'ArrowDown', 'KeyF'];
    
    if (!allowedKeys.includes(e.code)) {
      // 阻止其他键盘快捷键
      e.stopPropagation();
    }
  }, true);
}

// 优化页面滚动性能
function optimizePageScroll() {
  // 添加平滑滚动
  const style = document.createElement('style');
  style.textContent = `
    html {
      scroll-behavior: smooth;
    }
    
    /* 优化滚动性能 */
    .bili-video-card, .video-card {
      will-change: transform;
      transform: translateZ(0);
    }
  `;
  document.head.appendChild(style);
}