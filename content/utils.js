// utils.js - 公共工具函数和类

/**
 * 日志工具 - 统一的日志记录和错误处理
 */
class Logger {
  static INFO = 'info';
  static WARN = 'warn';
  static ERROR = 'error';
  
  /**
   * 输出日志信息
   * @param {string} module - 模块名称
   * @param {string} message - 日志信息
   * @param {string} level - 日志级别(info|warn|error)
   * @param {any} [data] - 额外数据
   */
  static log(module, message, level = Logger.INFO, data) {
    const prefix = `[专注模式${module ? ': ' + module : ''}]`;
    
    switch(level) {
      case Logger.WARN:
        console.warn(prefix, message, data || '');
        break;
      case Logger.ERROR:
        console.error(prefix, message, data || '');
        break;
      default:
        console.log(prefix, message, data || '');
    }
  }
  
  /**
   * 安全执行函数，捕获并记录错误
   * @param {Function} func - 要执行的函数
   * @param {string} module - 模块名称
   * @param {string} operation - 操作描述
   * @param {any[]} args - 传递给函数的参数
   * @returns {any} 函数执行结果，或null(如果出错)
   */
  static safeExecute(func, module, operation, ...args) {
    try {
      return func(...args);
    } catch (err) {
      this.log(module, `${operation}失败: ${err.message}`, Logger.ERROR, err);
      return null;
    }
  }
}

/**
 * 事件管理器 - 统一管理事件绑定和清理
 */
class EventManager {
  constructor() {
    this.handlers = new Map();
  }
  
  /**
   * 添加事件监听器
   * @param {Element} target - 目标元素
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 事件处理函数
   * @param {boolean|Object} options - 事件选项
   * @returns {string} 事件ID，用于移除
   */
  addListener(target, eventType, handler, options = false) {
    if (!target || typeof target.addEventListener !== 'function') return null;
    
    // 生成唯一ID
    const eventId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 绑定事件
    target.addEventListener(eventType, handler, options);
    
    // 存储引用
    this.handlers.set(eventId, { target, eventType, handler, options });
    
    return eventId;
  }
  
  /**
   * 移除特定事件监听器
   * @param {string} eventId - 事件ID
   * @returns {boolean} 是否成功移除
   */
  removeListener(eventId) {
    if (!this.handlers.has(eventId)) return false;
    
    const { target, eventType, handler, options } = this.handlers.get(eventId);
    
    try {
      target.removeEventListener(eventType, handler, options);
      this.handlers.delete(eventId);
      return true;
    } catch (err) {
      Logger.log('事件管理器', `移除事件监听器失败: ${err.message}`, Logger.ERROR, err);
      return false;
    }
  }
  
  /**
   * 移除所有事件监听器
   */
  removeAll() {
    for (const eventId of this.handlers.keys()) {
      this.removeListener(eventId);
    }
  }
  
  /**
   * 添加全屏变化事件监听
   * @param {Function} handler - 事件处理函数
   * @returns {string[]} 事件ID数组
   */
  addFullscreenChangeListener(handler) {
    const ids = [];
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    
    events.forEach(eventType => {
      const id = this.addListener(document, eventType, handler);
      if (id) ids.push(id);
    });
    
    return ids;
  }
}

/**
 * DOM观察器 - 创建和管理MutationObserver
 */
class DOMObserver {
  /**
   * 创建DOM观察器
   * @param {Function} callback - 回调函数
   * @param {Object} options - 观察选项
   * @param {boolean} useThrottle - 是否使用节流
   * @param {number} throttleTime - 节流时间(毫秒)
   * @returns {MutationObserver} 创建的观察器
   */
  static create(callback, options = null, useThrottle = false, throttleTime = 300) {
    const defaultOptions = {
      childList: true,
      subtree: true,
      attributes: false
    };
    
    const observerOptions = options || defaultOptions;
    
    const processCallback = useThrottle 
      ? throttle(callback, throttleTime)
      : callback;
      
    return new MutationObserver(processCallback);
  }
  
  /**
   * 创建并立即开始观察
   * @param {Element} target - 目标元素
   * @param {Function} callback - 回调函数
   * @param {Object} options - 观察选项
   * @param {boolean} useThrottle - 是否使用节流
   * @returns {MutationObserver} 创建的观察器
   */
  static observe(target, callback, options = null, useThrottle = false) {
    if (!target) {
      Logger.log('DOM观察器', '无效的观察目标', Logger.WARN);
      return null;
    }
    
    const observer = this.create(callback, options, useThrottle);
    const observerOptions = options || {
      childList: true,
      subtree: true,
      attributes: false
    };
    
    observer.observe(target, observerOptions);
    return observer;
  }
}

/**
 * 模块初始化器 - 处理依赖加载和初始化
 */
class ModuleInitializer {
  /**
   * 等待依赖加载
   * @param {string[]} dependencies - 依赖模块名称数组
   * @param {number} timeout - 超时时间(毫秒)
   * @returns {Promise} 解析为true(成功)或false(失败)
   */
  static async waitForDependencies(dependencies, timeout = 5000) {
    const startTime = Date.now();
    
    return new Promise(resolve => {
      const checkDependencies = () => {
        const missing = dependencies.filter(dep => typeof window[dep] === 'undefined');
        
        // 所有依赖都已加载
        if (missing.length === 0) {
          Logger.log('初始化器', `所有依赖加载完成`, Logger.INFO);
          resolve(true);
          return;
        }
        
        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          Logger.log('初始化器', `等待依赖超时: ${missing.join(', ')}`, Logger.WARN);
          resolve(false);
          return;
        }
        
        // 继续等待
        setTimeout(checkDependencies, 100);
      };
      
      checkDependencies();
    });
  }
  
  /**
   * 检查元素是否存在
   * @param {string|string[]} selectors - 选择器或选择器数组
   * @param {number} timeout - 超时时间(毫秒)
   * @returns {Promise<Element|null>} 解析为找到的元素或null
   */
  static async waitForElement(selectors, timeout = 5000) {
    const startTime = Date.now();
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    
    return new Promise(resolve => {
      const checkElement = () => {
        // 尝试查找元素
        for (const selector of selectorArray) {
          const element = document.querySelector(selector);
          if (element) {
            resolve(element);
            return;
          }
        }
        
        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          Logger.log('初始化器', `等待元素超时: ${selectorArray.join(', ')}`, Logger.WARN);
          resolve(null);
          return;
        }
        
        // 继续等待
        setTimeout(checkElement, 100);
      };
      
      checkElement();
    });
  }
}

/**
 * 安全执行函数，带错误处理
 * @param {Function} func 要执行的函数
 * @param {string} funcName 函数名称(用于日志)
 * @param {Array} args 函数参数
 * @param {*} defaultValue 发生错误时的默认返回值
 * @returns {*} 函数执行结果或默认值
 */
function safeExecute(func, funcName, args = [], defaultValue = null) {
  try {
    return func(...args);
  } catch (err) {
    console.warn(`[专注模式] ${funcName}执行失败:`, err);
    return defaultValue;
  }
}

/**
 * 安全执行异步函数，带错误处理
 * @param {Function} asyncFunc 要执行的异步函数
 * @param {string} funcName 函数名称(用于日志)
 * @param {Array} args 函数参数
 * @param {*} defaultValue 发生错误时的默认返回值
 * @returns {Promise<*>} 函数执行结果或默认值
 */
async function safeExecuteAsync(asyncFunc, funcName, args = [], defaultValue = null) {
  try {
    return await asyncFunc(...args);
  } catch (err) {
    console.warn(`[专注模式] ${funcName}执行失败:`, err);
    return defaultValue;
  }
}

/**
 * 功能特性检测
 * @param {Object} features 要检测的功能对象
 * @returns {Object} 可用功能的对象
 */
function detectFeatures(features) {
  const result = {};
  for (const [name, detector] of Object.entries(features)) {
    try {
      result[name] = detector();
    } catch (e) {
      console.log(`[专注模式] 功能${name}不可用:`, e);
      result[name] = false;
    }
  }
  return result;
}

/**
 * 通过属性和内容查找元素的高级方法
 * @param {Object} options 查找选项
 * @param {string} options.type 元素类型 (例如: 'fullscreenButton', 'videoContainer')
 * @param {string[]} [options.selectors] 常规CSS选择器数组
 * @param {Object[]} [options.attributeRules] 属性规则数组
 * @param {Object[]} [options.contentRules] 内容规则数组
 * @param {Element} [options.context=document] 搜索上下文
 * @returns {Element[]} 找到的元素数组
 */
function findElementsByAttribute(options) {
  const { type, selectors = [], attributeRules = [], contentRules = [], context = document } = options;
  
  console.log(`[专注模式] 开始查找${type}元素`);
  const results = [];
  
  // 首先尝试使用选择器直接查找
  if (selectors.length > 0) {
    for (const selector of selectors) {
      try {
        const elements = context.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`[专注模式] 使用选择器 "${selector}" 找到${elements.length}个${type}元素`);
          elements.forEach(el => results.push(el));
        }
      } catch (err) {
        console.warn(`[专注模式] 选择器 "${selector}" 查询失败:`, err);
      }
    }
  }
  
  // 如果没有找到元素或要进一步验证，使用属性规则
  if (attributeRules.length > 0) {
    // 获取所有元素
    const allElements = context.querySelectorAll('*');
    
    // 遍历每个元素，检查是否符合属性规则
    for (const element of allElements) {
      for (const rule of attributeRules) {
        try {
          let matchesRule = false;
          
          // 检查元素是否有指定的属性和值
          if (rule.attribute && rule.values) {
            const attrValue = element.getAttribute(rule.attribute);
            if (attrValue) {
              // 检查属性值是否匹配任何规则值
              matchesRule = rule.values.some(value => {
                if (rule.matchType === 'exact') {
                  return attrValue === value;
                } else if (rule.matchType === 'contains') {
                  return attrValue.includes(value);
                } else if (rule.matchType === 'startsWith') {
                  return attrValue.startsWith(value);
                } else if (rule.matchType === 'endsWith') {
                  return attrValue.endsWith(value);
                } else if (rule.matchType === 'regex' && value instanceof RegExp) {
                  return value.test(attrValue);
                }
                // 默认为包含匹配
                return attrValue.includes(value);
              });
            }
          }
          
          // 检查元素是否有指定的样式值
          if (rule.style && rule.styleValues) {
            const computedStyle = window.getComputedStyle(element);
            matchesRule = rule.styleValues.some(item => {
              return computedStyle[item.property] === item.value;
            });
          }
          
          // 如果元素符合规则，添加到结果数组
          if (matchesRule && !results.includes(element)) {
            console.log(`[专注模式] 通过属性规则找到${type}元素:`, element);
            results.push(element);
          }
        } catch (err) {
          console.warn(`[专注模式] 属性规则检查失败:`, err);
        }
      }
    }
  }
  
  // 使用内容规则进一步筛选
  if (contentRules.length > 0 && results.length > 0) {
    const filteredResults = [];
    
    for (const element of results) {
      for (const rule of contentRules) {
        try {
          let matchesRule = false;
          const text = element.textContent || element.innerText || '';
          
          // 检查文本内容是否匹配规则
          if (rule.values) {
            matchesRule = rule.values.some(value => {
              if (rule.matchType === 'exact') {
                return text === value;
              } else if (rule.matchType === 'contains') {
                return text.includes(value);
              } else if (rule.matchType === 'startsWith') {
                return text.startsWith(value);
              } else if (rule.matchType === 'endsWith') {
                return text.endsWith(value);
              } else if (rule.matchType === 'regex' && value instanceof RegExp) {
                return value.test(text);
              }
              // 默认为包含匹配
              return text.includes(value);
            });
          }
          
          // 如果元素符合规则，添加到过滤结果数组
          if (matchesRule && !filteredResults.includes(element)) {
            console.log(`[专注模式] 通过内容规则确认${type}元素:`, element);
            filteredResults.push(element);
          }
        } catch (err) {
          console.warn(`[专注模式] 内容规则检查失败:`, err);
        }
      }
    }
    
    // 如果过滤后有结果，使用过滤结果
    if (filteredResults.length > 0) {
      return filteredResults;
    }
  }
  
  console.log(`[专注模式] ${type}元素查找完成，找到${results.length}个结果`);
  return results;
}

/**
 * 全局错误处理器
 */
function setupGlobalErrorHandlers() {
  // 注意：此函数应在初始化时被调用，确保全局错误处理功能生效
  window.addEventListener('error', function(event) {
    console.log('[专注模式] 捕获到全局错误:', event.error);
    // 防止错误中断执行
    event.preventDefault();
    return true;
  });

  window.addEventListener('unhandledrejection', function(event) {
    console.log('[专注模式] 未处理的Promise错误:', event.reason);
    // 防止错误中断执行
    event.preventDefault();
    return true;
  });
  
  console.log('[专注模式] 全局错误处理器已设置');
}

/**
 * 安全的页面导航函数
 * @param {string} url 目标URL
 * @param {boolean} useModernAPI 是否尝试使用现代导航API
 * @returns {Promise<boolean>} 导航是否成功
 */
async function safeNavigate(url, useModernAPI = true) {
  console.log(`[专注模式] 尝试导航到: ${url}`);
  
  try {
    // 检查现代导航API是否可用
    if (useModernAPI && window.navigation && typeof window.navigation.navigate === 'function') {
      try {
        await window.navigation.navigate(url);
        console.log('[专注模式] 使用现代导航API成功');
        return true;
      } catch (err) {
        console.warn('[专注模式] 现代导航API失败:', err);
        // 失败后回退到传统方法
      }
    }
    
    // 传统导航方法
    console.log('[专注模式] 使用传统导航方法');
    window.location.href = url;
    return true;
  } catch (err) {
    console.error('[专注模式] 所有导航方法均失败:', err);
    
    // 最终回退 - 直接替换当前URL
    try {
      window.location.replace(url);
      return true;
    } catch (finalErr) {
      console.error('[专注模式] 最终导航方法也失败:', finalErr);
      return false;
    }
  }
}

/**
 * 确保样式只添加一次的工具函数
 * @param {string} styleId - 样式元素的ID
 * @param {string} cssText - CSS样式内容
 */
function ensureStylesOnce(styleId, cssText) {
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  if (styleEl.textContent !== cssText) {
    styleEl.textContent = cssText;
  }
}

/**
 * 节流函数 - 限制函数执行频率
 * @param {Function} func - 需要节流的函数
 * @param {number} limit - 节流时间间隔（毫秒）
 * @returns {Function} - 节流后的函数
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

/**
 * 防抖函数 - 延迟函数执行，如果短时间内多次调用则以最后一次为准
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} - 防抖后的函数
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * 健壮的元素选择器
 * 尝试多种选择器并提供备选查找策略
 * @param {string|string[]} selectors - 要尝试的选择器或选择器数组
 * @param {Document|Element} context - 查找上下文
 * @returns {Element[]} 找到的元素数组
 */
function robustSelector(selectors, context = document) {
  // 尝试多种选择器
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  const foundElements = [];
  
  // 记录尝试次数和结果
  let attemptCount = 0;
  let successCount = 0;
  
  // 遍历所有选择器
  for (const selector of selectorArray) {
    try {
      attemptCount++;
      const elements = context.querySelectorAll(selector);
      
      if (elements && elements.length > 0) {
        successCount++;
        // 将找到的元素添加到结果中
        Array.from(elements).forEach(el => {
          // 避免重复添加相同的元素
          if (!foundElements.some(existingEl => existingEl === el)) {
            foundElements.push(el);
          }
        });
      }
    } catch (e) {
      Logger.log('选择器', `${selector} 错误:`, Logger.WARN, e);
    }
  }
  
  // 调试日志
  // if (foundElements.length > 0) {
  //   console.log(`[专注模式] 选择器成功率: ${successCount}/${attemptCount}，找到 ${foundElements.length} 个元素`);
  // } else if (attemptCount > 0) {
  //   console.log(`[专注模式] 所有选择器(${attemptCount}个)均未找到匹配元素`);
  // }
  
  return foundElements;
}

/**
 * 按特征查找元素
 * @param {string} type - 元素类型(video|danmaku|comment)
 * @param {Document|Element} context - 查找上下文
 * @returns {Element[]} 找到的元素数组
 */
function findElementsByFeature(type, context = document) {
  const results = [];
  
  switch(type) {
    case 'video':
      // 查找视频元素
      const videos = context.querySelectorAll('video');
      if (videos.length) return Array.from(videos);
      
      // 备选：查找可能包含视频的容器
      return robustSelector([
        '.bpx-player-video-wrap', 
        '.bilibili-player-video', 
        '[data-player-video-container]'
      ], context);
      
    case 'danmaku':
      // 查找弹幕容器
      return robustSelector([
        '.bpx-player-dm-root',
        '.bpx-player-dm-wrap',
        '.bilibili-player-video-danmaku',
        '.bilibili-player-video-danmaku-root',
        '[data-danmaku-container]'
      ], context);
      
    case 'comment':
      // 查找评论区容器
      return robustSelector([
        '.comment-container', 
        '#comment', 
        '.reply-list',
        '[data-comment-container]'
      ], context);
    
    case 'navigation':
      // 根据特征识别导航栏元素
      
      // 1. 尝试找到顶部导航栏容器
      const possibleNavs = [];
      
      // 查找包含特定导航关键词的元素
      const navKeywords = ['登录', 'login', '注册', 'register', '动态', 'dynamic', 
                          '消息', 'message', '历史', 'history', '创作中心', '头像', 
                          '大会员', 'vip', '搜索', 'search'];
      
      // 查找顶部区域的所有容器元素
      const topContainers = context.querySelectorAll('header, nav, .header, .nav, .navbar, div[class*="header"], div[class*="nav"]');
      
      topContainers.forEach(container => {
        // 检查容器位置是否在页面顶部
        const rect = container.getBoundingClientRect();
        const isInTopArea = rect.top < 100 && rect.height < 100;
        
        if (isInTopArea) {
          // 检查是否包含导航关键词
          const text = container.textContent || '';
          const hasNavKeyword = navKeywords.some(keyword => text.includes(keyword));
          
          // 检查是否包含导航特征（多个链接）
          const links = container.querySelectorAll('a');
          const hasMultipleLinks = links.length >= 3;
          
          // 检查是否包含用户头像
          const hasAvatar = !!container.querySelector('img[src*="avatar"], .avatar, [class*="avatar"], [class*="face"]');
          
          // 如果满足多个条件，则可能是导航栏
          if ((hasNavKeyword && hasMultipleLinks) || (hasMultipleLinks && hasAvatar)) {
            possibleNavs.push(container);
          }
        }
      });
      
      if (possibleNavs.length > 0) {
        return possibleNavs;
      }
      
      // 2. 改进的备选方案 - 添加更多排除条件避免误识别搜索结果
      const allTopElements = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          
          // 基础位置条件
          const isInTopArea = rect.top < 50 && rect.left < 50 && rect.width > window.innerWidth * 0.5;
          if (!isInTopArea) return false;
          
          // 排除搜索结果相关元素
          const isSearchRelated = el.closest('.search-container, .search-content, .video-list, .search-page-wrapper, .bili-video-card, .search-result-container') ||
                                  el.querySelector('.bili-video-card, .video-item, .search-video-card, .video-list') ||
                                  el.matches('.bili-video-card, .video-item, .search-video-card, .video-list, .search-content');
          
          if (isSearchRelated) return false;
          
          // 排除视频相关容器
          const isVideoContainer = el.matches('[class*="video"]:not([class*="nav"]):not([class*="header"])') ||
                                   el.querySelector('video, [class*="video-card"], [class*="video-item"]') ||
                                   el.classList.toString().includes('video') && !el.classList.toString().includes('nav');
          
          if (isVideoContainer) return false;
          
          // 排除明显的内容区域
          const isContentArea = el.matches('.main-content, .content, .page-content, [class*="content"]:not([class*="nav"])') ||
                                el.querySelector('.main-content, .content, .page-content');
          
          if (isContentArea) return false;
          
          // 优先选择明确的导航相关元素
          const isNavRelated = el.matches('header, nav, [class*="header"], [class*="nav"], [class*="top-bar"]') ||
                               el.closest('header, nav, [class*="header"], [class*="nav"]');
          
          // 如果是导航相关元素，优先返回
          if (isNavRelated) return true;
          
          // 对于其他元素，确保高度不超过150px（避免选择大的内容区域）
          return rect.height <= 150;
        })
        .slice(0, 3); // 减少返回数量，只保留最可能的元素
      
      return allTopElements;
      
    default:
      return [];
  }
}

/**
 * 通用UI工具类
 * 提供对话框创建、元素操作等通用UI功能
 */
class UIUtils {
  /**
   * 创建对话框
   * @param {Object} options - 对话框配置
   * @param {string} options.title - 对话框标题
   * @param {string} options.content - 对话框内容HTML
   * @param {Object[]} options.buttons - 对话框按钮配置
   * @param {string} options.buttons[].text - 按钮文本
   * @param {string} options.buttons[].type - 按钮类型 (primary/secondary)
   * @param {Function} options.buttons[].onClick - 按钮点击回调
   * @param {string} options.width - 对话框宽度
   * @param {string} options.className - 对话框附加类名
   * @param {boolean} options.preventEscape - 是否阻止ESC键关闭 (默认: false)
   * @param {number} options.customZIndex - 自定义z-index值 (优先于CSS类)
   * @param {Function} options.onClose - 对话框关闭时的回调
   * @returns {Object} 包含对话框元素和背景元素的对象
   */
  static createDialog(options) {
    // 创建对话框背景 - 使用新的统一样式系统
    const dialogBackground = document.createElement('div');
    
    // 设置基础类名和优先级
    let overlayClasses = ['focus-dialog-overlay'];
    
    // 根据对话框类型设置优先级
    if (options.className) {
      if (options.className.includes('first-time')) {
        overlayClasses.push('focus-dialog-emergency');
      } else if (options.className.includes('exit')) {
        overlayClasses.push('focus-dialog-critical');
      } else if (options.className.includes('settings') || options.className.includes('global')) {
        overlayClasses.push('focus-dialog-important');
      }
      overlayClasses.push(options.className);
    }
    
    // 保留 dialog-overlay 类用于向后兼容（focused-homepage.js 的备用实现）
    overlayClasses.push('dialog-overlay');
    
    dialogBackground.className = overlayClasses.join(' ');
    
    // 应用自定义z-index（如果提供）
    if (options.customZIndex) {
      dialogBackground.style.zIndex = options.customZIndex;
    }
    
    // 创建对话框主体
    const dialog = document.createElement('div');
    dialog.className = 'focus-dialog';
    
    // ✅ 不添加自定义类名到内层弹窗，避免遮罩层样式污染弹窗内容
    // options.className 只应该应用到外层遮罩 dialogBackground，不应该应用到内层 dialog
    
    // 自定义宽度
    if (options.width) {
      dialog.style.width = options.width;
    }
    
    // 设置对话框内容
    let dialogContent = `<h3>${options.title}</h3>`;
    dialogContent += `<div class="dialog-content">${options.content}</div>`;
    
    // 添加按钮
    if (options.buttons && options.buttons.length > 0) {
      dialogContent += `<div class="dialog-buttons">`;
      options.buttons.forEach(button => {
        dialogContent += `<button class="dialog-button ${button.type || 'secondary'}" id="${button.id || ''}" data-text="${button.text}">${button.text}</button>`;
      });
      dialogContent += `</div>`;
    }
    
    dialog.innerHTML = dialogContent;
    
    // 添加额外的稳定性样式
    dialog.style.willChange = 'opacity';
    dialog.style.transform = 'translateZ(0)';
    dialogBackground.style.willChange = 'opacity, visibility';
    dialogBackground.style.transform = 'translateZ(0)';
    
    // 添加到页面
    dialogBackground.appendChild(dialog);
    document.body.appendChild(dialogBackground);
    
    // 🆕 启用ESC键阻止（如果需要）
    if (options.preventEscape) {
      UIUtils.preventEscape(true, dialogBackground);
    }
    
    // 使用渐入效果显示对话框 - 使用新的统一样式系统
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dialogBackground.classList.add('focus-dialog-visible');
        // 保留 visible 类用于向后兼容
        dialogBackground.classList.add('visible');
      });
    });
    
    // 绑定按钮事件
    if (options.buttons) {
      options.buttons.forEach(button => {
        // 修复：使用data-text属性代替:contains选择器
        let buttonElement = null;
        if (button.id) {
          buttonElement = dialog.querySelector(`#${button.id}`);
        } else {
          // 遍历所有按钮查找匹配文本的按钮
          const buttons = dialog.querySelectorAll('.dialog-button');
          for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].textContent === button.text || 
                buttons[i].getAttribute('data-text') === button.text) {
              buttonElement = buttons[i];
              break;
            }
          }
        }
        
        if (buttonElement && button.onClick) {
          // 🔧 修复：确保按钮可交互
          UIUtils.ensureButtonInteractive(buttonElement);
          
          buttonElement.addEventListener('click', (e) => {
            button.onClick(e, dialog, dialogBackground);
          });
        }
      });
    }
    
    // 🔧 修复：延迟验证所有按钮的交互性
    setTimeout(() => {
      if (options.buttons) {
        const allButtons = dialog.querySelectorAll('.dialog-button, button');
        allButtons.forEach(btn => {
          if (!UIUtils.verifyButtonInteractive(btn)) {
            console.warn('[UIUtils] 按钮交互异常，尝试修复:', btn.textContent?.trim());
            UIUtils.ensureButtonInteractive(btn);
          }
        });
      }
    }, 100);
    
    return { dialog, background: dialogBackground };
  }
  
  /**
   * 创建带优先级的对话框 - 简化接口
   * @param {string} title - 对话框标题
   * @param {string} content - 对话框内容HTML
   * @param {Object[]} buttons - 按钮配置
   * @param {string} priority - 优先级 ('normal'|'important'|'critical'|'emergency')
   * @param {Object} options - 其他选项
   * @param {boolean} options.preventEscape - 是否阻止ESC键关闭
   * @param {number} options.customZIndex - 自定义z-index值
   */
  static createPriorityDialog(title, content, buttons, priority = 'normal', options = {}) {
    const priorityClasses = {
      normal: '',
      important: 'focus-dialog-important',
      critical: 'focus-dialog-critical', 
      emergency: 'focus-dialog-emergency'
    };
    
    return this.createDialog({
      title,
      content,
      buttons,
      className: `${priorityClasses[priority]} ${options.className || ''}`.trim(),
      width: options.width,
      preventEscape: options.preventEscape,
      customZIndex: options.customZIndex,
      onClose: options.onClose
    });
  }
  
  /**
   * 确保按钮处于可交互状态
   * @param {HTMLElement} button - 按钮元素
   */
  static ensureButtonInteractive(button) {
    if (!button) return;
    
    try {
      // 重置所有可能影响交互的属性
      button.disabled = false;
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
      button.style.opacity = '1';
      button.style.display = button.style.display || 'inline-block';
      button.style.visibility = 'visible';
      
      // 确保按钮在正确的z-index层级
      const parentOverlay = button.closest('.dialog-overlay, .focus-dialog-overlay, .top-level-exit-overlay');
      if (parentOverlay) {
        parentOverlay.style.pointerEvents = 'auto';
      }
      
      // console.log('[UIUtils] 按钮状态已重置为可交互:', button.textContent?.trim().substring(0, 20));
    } catch (err) {
      console.error('[UIUtils] 重置按钮状态失败:', err);
    }
  }
  
  /**
   * 验证按钮是否可交互
   * @param {HTMLElement} button - 按钮元素
   * @returns {boolean} 是否可交互
   */
  static verifyButtonInteractive(button) {
    if (!button) return false;
    
    try {
      const style = window.getComputedStyle(button);
      
      const isVisible = style.display !== 'none' && 
                       style.visibility !== 'hidden' &&
                       parseFloat(style.opacity) > 0.1;
      
      const isClickable = style.pointerEvents !== 'none' && 
                         !button.disabled;
      
      const hasListener = button.onclick !== null || 
                         button._listeners?.click?.length > 0;
      
      const isInteractive = isVisible && isClickable;
      
      if (!isInteractive) {
        // console.warn('[UIUtils] 按钮不可交互:', {
        //   text: button.textContent?.trim(),
        //   visible: isVisible,
        //   clickable: isClickable,
        //   disabled: button.disabled,
        //   pointerEvents: style.pointerEvents
        // });
      }
      
      return isInteractive;
    } catch (err) {
      console.error('[UIUtils] 验证按钮状态失败:', err);
      return false;
    }
  }
  
  /**
   * 阻止或启用ESC键关闭弹窗
   * @param {boolean} enable - 是否启用ESC键阻止
   * @param {Element} dialogElement - 对话框元素（用于标识）
   */
  static preventEscape(enable = true, dialogElement = null) {
    if (enable) {
      // 创建事件处理器
      const handler = (e) => {
        if (e.key === 'Escape') {
          // 检查对话框是否仍然存在
          if (dialogElement && document.body.contains(dialogElement)) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[UIUtils] 阻止ESC键关闭弹窗');
          }
        }
      };
      
      // 保存处理器到元素上，以便后续移除
      if (dialogElement) {
        dialogElement._escapeHandler = handler;
      }
      
      // 使用捕获阶段监听
      document.addEventListener('keydown', handler, true);
    } else {
      // 如果有绑定的处理器，移除它
      if (dialogElement && dialogElement._escapeHandler) {
        document.removeEventListener('keydown', dialogElement._escapeHandler, true);
        dialogElement._escapeHandler = null;
      }
    }
  }
  
  /**
   * 关闭对话框
   * @param {Element} dialogBackground - 对话框背景元素
   */
  static closeDialog(dialogBackground) {
    if (dialogBackground && dialogBackground.parentNode) {
      // 解除ESC键监听（如果有）
      if (dialogBackground._escapeHandler) {
        UIUtils.preventEscape(false, dialogBackground);
      }
      
      // 使用渐出效果关闭对话框 - 支持新旧样式系统
      dialogBackground.classList.add('focus-dialog-fade-out');
      dialogBackground.classList.remove('focus-dialog-visible');
      // 向后兼容：也使用旧的类名
      dialogBackground.classList.add('fade-out');
      dialogBackground.classList.remove('visible');
      
      // 等待动画完成后从DOM中移除
      setTimeout(() => {
    if (dialogBackground && dialogBackground.parentNode) {
      dialogBackground.parentNode.removeChild(dialogBackground);
        }
      }, 300); // 等待300ms（与CSS过渡时间匹配）
    }
  }
  
  /**
   * 显示临时消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success/error/info)
   * @param {number} duration - 显示时长(毫秒)
   */
  static showMessage(message, type = 'success', duration = 3000) {
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.position = 'fixed';
    messageElement.style.bottom = '20px';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translateX(-50%)';
    messageElement.style.padding = '10px 20px';
    messageElement.style.borderRadius = '4px';
    messageElement.style.zIndex = '9999';
    messageElement.style.transition = 'opacity 0.3s';
    
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
}

/**
 * 存储工具类
 * 提供统一的存储读写接口，封装Chrome存储API和localStorage
 */
class StorageUtils {
  /**
   * 检查Chrome存储API是否可用
   * @returns {boolean} 存储API是否可用
   */
  static isChromeStorageAvailable() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.storage && 
             chrome.storage.local && 
             typeof chrome.storage.local.set === 'function' &&
             typeof chrome.storage.local.get === 'function';
    } catch (e) {
      Logger.log('存储工具', 'Chrome存储API检查失败', Logger.WARN, e);
      return false;
    }
  }

  /**
   * 保存数据到存储
   * @param {string} key - 存储键名
   * @param {any} data - 要存储的数据
   * @param {number} retryCount - 内部重试计数
   * @returns {Promise} 保存操作的Promise
   */
  static save(key, data, retryCount = 0) {
    return new Promise((resolve, reject) => {
      // 最大重试次数
      const MAX_RETRIES = 3;
      
      // 先尝试本地备份
      try {
        localStorage.setItem(`${key}_backup`, JSON.stringify(data));
        localStorage.setItem(`${key}_backup_time`, Date.now().toString());
      } catch (backupError) {
        Logger.log('存储工具', '本地备份失败', Logger.WARN, backupError);
      }
      
      // 使用Chrome存储API
      if (StorageUtils.isChromeStorageAvailable()) {
      try {
          const saveObj = {};
          saveObj[key] = data;
          
            chrome.storage.local.set(saveObj, () => {
              const error = chrome.runtime.lastError;
              if (error) {
              // 判断是否要重试
              if (retryCount < MAX_RETRIES) {
                Logger.log('存储工具', `保存失败，正在重试 (${retryCount + 1}/${MAX_RETRIES})...`, Logger.WARN);
                setTimeout(() => {
                  StorageUtils.save(key, data, retryCount + 1)
                    .then(resolve)
                    .catch(reject);
                }, 500 * (retryCount + 1));
              } else {
                // 降级到localStorage
                  try {
                    localStorage.setItem(key, JSON.stringify(data));
                  Logger.log('存储工具', '降级到localStorage存储');
                  resolve();
                  } catch (localErr) {
                  Logger.log('存储工具', '所有存储方式都失败', Logger.ERROR, localErr);
                    reject(localErr);
                  }
                }
              } else {
                resolve();
              }
            });
          } catch (chromeError) {
          // 降级到localStorage
            try {
              localStorage.setItem(key, JSON.stringify(data));
            Logger.log('存储工具', '降级到localStorage存储');
            resolve();
            } catch (localErr) {
            Logger.log('存储工具', '所有存储方式都失败', Logger.ERROR, localErr);
              reject(localErr);
            }
          }
        } else {
        // Chrome存储不可用，直接使用localStorage
        try {
          localStorage.setItem(key, JSON.stringify(data));
          resolve();
        } catch (localErr) {
          reject(localErr);
        }
      }
    });
  }
  
  /**
   * 从存储加载数据
   * @param {string} key - 存储键名
   * @param {any} defaultValue - 默认值
   * @returns {Promise} 包含加载数据的Promise
   */
  static load(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      // 尝试从Chrome存储API加载
        if (StorageUtils.isChromeStorageAvailable()) {
          try {
          chrome.storage.local.get(key, (result) => {
              const error = chrome.runtime.lastError;
              if (error) {
              Logger.log('存储工具', '从Chrome存储加载失败', Logger.WARN, error);
              // 降级到localStorage
                  StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
            } else if (result && result[key] !== undefined) {
                resolve(result[key]);
              } else {
              // 未找到数据，尝试从localStorage加载
                StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
              }
            });
          } catch (chromeError) {
          Logger.log('存储工具', 'Chrome存储API异常', Logger.WARN, chromeError);
          // 降级到localStorage
          StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
        }
          } else {
        // Chrome存储不可用，直接使用localStorage
        StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
      }
    });
  }
  
  /**
   * 从localStorage加载数据的辅助方法
   * @private
   */
  static loadFromLocalStorage(key, defaultValue, resolve, reject) {
    try {
      // 尝试加载正常数据
      const storedData = localStorage.getItem(key);
      if (storedData !== null) {
        resolve(JSON.parse(storedData));
        return;
      }
      
      // 尝试加载备份数据
      const backupData = localStorage.getItem(`${key}_backup`);
      if (backupData !== null) {
        Logger.log('存储工具', '使用本地备份数据');
        resolve(JSON.parse(backupData));
        return;
      }
      
      // 没有找到数据，返回默认值
      resolve(defaultValue);
    } catch (localErr) {
      Logger.log('存储工具', '从localStorage加载失败', Logger.ERROR, localErr);
      resolve(defaultValue);
    }
  }
  
  /**
   * 从存储中移除数据
   * @param {string} key - 要移除的键
   * @returns {Promise} 操作结果
   */
  static remove(key) {
    return new Promise((resolve) => {
      // 尝试从所有存储方式中移除
      try {
        // 移除本地备份
        localStorage.removeItem(`${key}_backup`);
        localStorage.removeItem(`${key}_backup_time`);
        localStorage.removeItem(key);
      } catch (localErr) {
        Logger.log('存储工具', '从localStorage移除失败', Logger.WARN, localErr);
      }
        
      // 从Chrome存储移除
        if (StorageUtils.isChromeStorageAvailable()) {
          try {
            chrome.storage.local.remove(key, () => {
            const error = chrome.runtime.lastError;
            if (error) {
              Logger.log('存储工具', '从Chrome存储移除失败', Logger.WARN, error);
            }
              resolve();
            });
        } catch (chromeErr) {
          Logger.log('存储工具', 'Chrome存储API异常', Logger.WARN, chromeErr);
            resolve();
          }
        } else {
        resolve();
      }
    });
  }
  
  /**
   * 清除所有存储数据
   * @returns {Promise} 操作结果
   */
  static clearAll() {
    return new Promise((resolve) => {
      // 清除localStorage
      try {
        localStorage.clear();
      } catch (localErr) {
        Logger.log('存储工具', '清除localStorage失败', Logger.WARN, localErr);
      }
      
      // 清除Chrome存储
      if (StorageUtils.isChromeStorageAvailable()) {
        try {
          chrome.storage.local.clear(() => {
            const error = chrome.runtime.lastError;
            if (error) {
              Logger.log('存储工具', '清除Chrome存储失败', Logger.WARN, error);
            }
            resolve();
          });
        } catch (chromeErr) {
          Logger.log('存储工具', 'Chrome存储API异常', Logger.WARN, chromeErr);
          resolve();
        }
      } else {
        resolve();
      }
    });
  }
}

/**
 * 页面UI增强工具 - 优化导航栏、搜索框等元素
 */
class PageEnhancer {
  /**
   * 处理导航栏，只保留首页可点击
   */
  static processNavBar() {
    try {
      // 查找导航栏 - 更新选择器以匹配最新版B站UI
      const navSelectors = [
        // 最新版B站导航栏选择器
        '.bili-header__bar .bili-header__right',
        '.bili-header__bar .right-entry',
        '.v-popover-wrap.right-entry-item',
        '.v-popover-wrap',
        'ul.right-entry-item',
        'ul.left-entry',
        '.bstar-header__bar',
        '.bili-header-m .head-right',
        '.bili-header-m .right-entry',
        '.bili-header-m .left-entry',
        // 旧版选择器保留，以保证兼容性
        '.international-header .right-entry',
        '.right-part',
        '.nav-user-center',
        'nav.nav-bar',
        '.bili-wrapper .right-entry',
        '.nav-link',
        '.left-entry li',
        '.bili-header .bili-header__bar'
      ];
      
      console.log('[专注模式] 尝试查找导航栏元素...');
      
      // 尝试找到导航栏元素
      let navElements = robustSelector(navSelectors);
      
      // 如果使用精确选择器未找到，使用更宽松的备用选择器
      if (!navElements || navElements.length === 0) {
        console.log('[专注模式] 未找到精确匹配的导航栏元素，尝试备用选择器...');
        
        // 备用选择器 - 更通用的选择器
        const fallbackSelectors = [
          'header',
          '.bili-header',
          '.bili-header-m',
          '.bstar-header',
          '.international-header',
          '.page-header',
          '.top-header'
        ];
        
        navElements = robustSelector(fallbackSelectors);
        
        if (navElements && navElements.length > 0) {
          console.log('[专注模式] 使用备用选择器找到导航栏元素');
        }
      }
      
      if (!navElements || navElements.length === 0) {
        console.warn('[专注模式] 找不到导航栏元素，尝试使用特征识别方法...');
        
        // 特征识别：查找可能是导航栏的元素
        const possibleNavElements = findElementsByFeature('navigation');
        if (possibleNavElements && possibleNavElements.length > 0) {
          console.log('[专注模式] 通过特征识别找到可能的导航栏元素');
          navElements = possibleNavElements;
        } else {
          console.warn('[专注模式] 无法识别导航栏元素');
          return false;
        }
      }
      
      // 添加导航栏样式
      this.addNavBarStyles();
      
      // 遍历每个导航元素，隐藏不需要的项目
      navElements.forEach(navElement => {
        if (!navElement) return;
        
        // 获取所有导航项
        const items = navElement.querySelectorAll('li, .item, .v-popover-wrap, .v-popover, .right-entry-item, a');
        
        // 白名单：允许保留的导航项关键词
        const whitelistKeywords = ['首页', 'home', '退出', 'logout', 'login', '登录', '头像'];
      
      // 处理每个导航项
        Array.from(items).forEach(item => {
          // 检查是否为白名单项
          const isWhitelisted = whitelistKeywords.some(keyword => {
            // 检查文本内容
            if (item.textContent && item.textContent.includes(keyword)) return true;
            // 检查title属性
            if (item.title && item.title.includes(keyword)) return true;
            // 检查aria-label属性
            if (item.getAttribute('aria-label') && item.getAttribute('aria-label').includes(keyword)) return true;
            // 检查class
            if (item.className && item.className.includes(keyword.toLowerCase())) return true;
            // 检查链接
            const link = item.querySelector('a');
            if (link && link.href && (link.href === 'https://www.bilibili.com/' || link.href.includes('/index'))) return true;
            // 检查自身是否是链接
            if (item.tagName === 'A' && (item.href === 'https://www.bilibili.com/' || item.href.includes('/index'))) return true;
            
            return false;
          });
          
          // 如果不在白名单中，禁用该项而不是隐藏
          if (!isWhitelisted) {
            this.disableNavItem(item);
          }
        });
      });
      
      // 设置观察器，处理动态添加的导航项
      this.setupNavObserver();
      
      // 设置菜单观察器，处理动态添加的下拉菜单
      this.setupMenuObserver();
      
      return true;
    } catch (err) {
      console.error('[专注模式] 处理导航栏时出错:', err);
      return false;
    }
  }
  
  /**
   * 禁用导航项而不是隐藏
   * @param {Element} item - 要禁用的导航项
   */
  static disableNavItem(item) {
    if (!item) return;
    
    // 如果已经禁用，不重复处理
    if (item.classList.contains('focus-mode-disabled')) {
      return;
    }
        
    // 添加禁用类名
    item.classList.add('focus-mode-disabled');
    
    // 添加提示标题
    const originalTitle = item.getAttribute('title') || '';
    item.setAttribute('data-original-title', originalTitle);
    item.setAttribute('title', '导航已禁用，专注学习模式');
    
    // 禁用点击
    item.style.pointerEvents = 'none';
    item.style.cursor = 'not-allowed';
    item.style.opacity = '0.6';
    item.style.filter = 'grayscale(50%)';
    
    // 处理链接
    const links = item.querySelectorAll('a');
    links.forEach(link => {
      // 备份原有href以防需要恢复
      if (link.href) {
        link.setAttribute('data-original-href', link.href);
        link.href = 'javascript:void(0)';
      }
      link.style.pointerEvents = 'none';
      link.style.cursor = 'not-allowed';
      link.setAttribute('tabindex', '-1'); // 防止键盘导航
      link.setAttribute('aria-disabled', 'true'); // 增加可访问性
      
      // 添加提示标题
      const linkOriginalTitle = link.getAttribute('title') || '';
      link.setAttribute('data-original-title', linkOriginalTitle);
      link.setAttribute('title', '导航已禁用，专注学习模式');
    });
    
    // 如果自身是链接
    if (item.tagName === 'A' && item.href) {
      item.setAttribute('data-original-href', item.href);
      item.href = 'javascript:void(0)';
      item.setAttribute('tabindex', '-1');
      item.setAttribute('aria-disabled', 'true');
    }
    
    // 处理按钮
    const buttons = item.querySelectorAll('button');
    buttons.forEach(button => {
      button.disabled = true;
      button.style.pointerEvents = 'none';
      button.style.cursor = 'not-allowed';
      
      // 添加提示标题
      const buttonOriginalTitle = button.getAttribute('title') || '';
      button.setAttribute('data-original-title', buttonOriginalTitle);
      button.setAttribute('title', '功能已禁用，专注学习模式');
    });
    
    // 扩展：拦截所有鼠标相关事件
    const eventTypes = ['mouseover', 'mouseenter', 'mousemove', 'mouseout', 'mouseleave', 'click', 'dblclick'];
    eventTypes.forEach(eventType => {
      item.addEventListener(eventType, (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, true); // 使用捕获阶段以确保尽早拦截
    });
    
    // 处理所有子元素，确保事件不会通过子元素触发
    const allChildren = item.querySelectorAll('*');
    allChildren.forEach(child => {
      // 为每个子元素添加相同的事件拦截
      eventTypes.forEach(eventType => {
        child.addEventListener(eventType, (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, true);
      });
    });
    
    // 添加事件监听器拦截点击
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 显示提示信息
      const rect = item.getBoundingClientRect();
      
      // 创建并显示临时提示
      const tooltip = document.createElement('div');
      tooltip.className = 'focus-mode-tooltip';
      tooltip.textContent = '导航已禁用，专注学习模式';
      tooltip.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width/2}px;
        top: ${rect.bottom + 5}px;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
      `;
      
      document.body.appendChild(tooltip);
      
      // 自动移除提示
      setTimeout(() => {
        if (tooltip.parentNode) {
          document.body.removeChild(tooltip);
        }
      }, 1500);
      
      return false;
    }, true);
    
    // 处理下拉菜单特殊情况
    this.handleDropdownMenus(item);
  }
  
  /**
   * 处理导航项中的下拉菜单
   * @param {Element} item - 要处理的导航项
   */
  static handleDropdownMenus(item) {
    try {
      // 查找可能的下拉菜单触发器
      const dropdownTriggers = item.querySelectorAll('[class*="dropdown"], [class*="popup"], [class*="menu"], [class*="hover"]');
      
      dropdownTriggers.forEach(trigger => {
        // 移除所有可能触发下拉的属性
        trigger.removeAttribute('data-v-dropdown');
        trigger.removeAttribute('dropdown-trigger');
        trigger.removeAttribute('data-popup');
        trigger.removeAttribute('data-hover');
        
        // 移除可能包含的事件监听器
        const clone = trigger.cloneNode(true);
        if (trigger.parentNode) {
          // 保留类名和ID
          clone.className = trigger.className;
          if (trigger.id) clone.id = trigger.id;
          
          // 添加禁用样式
          clone.classList.add('focus-mode-disabled');
          clone.style.pointerEvents = 'none';
          clone.style.cursor = 'not-allowed';
          
          // 替换元素
          trigger.parentNode.replaceChild(clone, trigger);
        }
      });
      
      // 查找并隐藏已经存在的下拉菜单
      const menuSelectors = [
        '.v-popover-content', 
        '.dropdown-menu', 
        '.popup-content',
        '[class*="tooltip"]',
        '[class*="popup"]',
        '[class*="menu-"]'
      ];
      
      const menus = document.querySelectorAll(menuSelectors.join(','));
      menus.forEach(menu => {
        // 检查是否与当前导航项相关
        const rect = item.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        // 简单的位置关联检查
        if (Math.abs(menuRect.left - rect.left) < 100 || Math.abs(menuRect.right - rect.right) < 100) {
          menu.style.display = 'none';
          menu.style.visibility = 'hidden';
          menu.style.opacity = '0';
        }
      });
    } catch (err) {
      Logger.log('页面增强', '处理下拉菜单时出错', Logger.ERROR, err);
    }
  }
  
  /**
   * 设置导航栏观察器，处理动态加载的导航
   */
  static setupNavObserver() {
    try {
      // 观察document.body变化
      const observer = DOMObserver.create((mutations) => {
        // 检查是否有新的导航项添加
        const navSelectors = [
          '.bili-header__bar a',
          '.international-header a',
          '.nav-item a',
          '.bili-tab a',
          '.home-tab .tab-item',
          '.right-entry-item',
          '.left-entry li',
          '.nav-link',
          '.bili-header .bili-header__bar a'
        ];
        
        const newNavItems = robustSelector(navSelectors).filter(
          item => !item.classList.contains('focus-disabled-link') && 
                 !item.classList.contains('focus-enabled-link') &&
                 !item.classList.contains('focus-mode-disabled')
        );
        
        if (newNavItems && newNavItems.length > 0) {
          // 找到新的导航项，再次处理
          // Logger.log('页面增强', `发现${newNavItems.length}个新导航项，重新处理`);
          
          // 处理新导航项
          newNavItems.forEach(item => {
            // 白名单：允许保留的导航项关键词
            const whitelistKeywords = ['首页', 'home', '退出', 'logout', 'login', '登录', '头像'];
            
            // 检查是否为白名单项
            const isWhitelisted = whitelistKeywords.some(keyword => {
              // 检查文本内容
              if (item.textContent && item.textContent.includes(keyword)) return true;
              // 检查title属性
              if (item.title && item.title.includes(keyword)) return true;
              // 检查aria-label属性
              if (item.getAttribute('aria-label') && item.getAttribute('aria-label').includes(keyword)) return true;
              // 检查class
              if (item.className && item.className.includes(keyword.toLowerCase())) return true;
              // 检查链接
              if (item.href && (item.href === 'https://www.bilibili.com/' || item.href.includes('/index'))) return true;
              
              return false;
            });
            
            // 如果不在白名单中，禁用该项
            if (!isWhitelisted) {
              PageEnhancer.disableNavItem(item);
            }
          });
        }
      }, null, true); // 使用节流以降低性能影响
      
      // 开始观察
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      Logger.log('页面增强', '导航观察器设置成功');
    } catch (err) {
      Logger.log('页面增强', '设置导航观察器时出错', Logger.ERROR, err);
    }
  }
  
  /**
   * 添加导航栏样式
   */
  static addNavBarStyles() {
    const styleId = 'focus-nav-bar-styles';
    const cssText = `
      /* 禁用的导航链接样式 */
      .focus-disabled-link {
        cursor: default !important;
        pointer-events: none !important;
        opacity: 0.5 !important;
        text-decoration: none !important;
        color: #999 !important;
      }
      
      /* 启用的导航链接样式 */
      .focus-enabled-link {
        cursor: pointer !important;
        color: #00a1d6 !important;
        font-weight: bold !important;
      }
      
      /* 禁用状态的导航项 */
      .focus-mode-disabled {
        opacity: 0.6 !important;
        pointer-events: none !important;
        cursor: not-allowed !important;
        position: relative;
        filter: grayscale(50%) !important;
        transition: all 0.2s ease !important;
      }
      
      /* 添加禁用视觉提示 */
      .focus-mode-disabled::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(200, 200, 200, 0.1);
        pointer-events: none;
        border-radius: 2px;
        z-index: 999;
      }
      
      .focus-mode-disabled * {
        pointer-events: none !important;
        cursor: default !important;
      }
      
      /* 增强：禁用所有悬浮状态 */
      .focus-mode-disabled:hover,
      .focus-mode-disabled:focus,
      .focus-mode-disabled:active,
      .focus-mode-disabled *:hover,
      .focus-mode-disabled *:focus,
      .focus-mode-disabled *:active {
        background-color: inherit !important;
        color: #999 !important;
        transform: none !important;
        opacity: 0.6 !important;
        border-color: transparent !important;
        box-shadow: none !important;
        text-decoration: none !important;
        filter: grayscale(50%) !important;
      }
      
      /* 阻止所有可能的菜单、提示框显示 */
      body .focus-mode-disabled .v-popover-content,
      body .focus-mode-disabled .dropdown-menu,
      body .focus-mode-disabled .popup-content,
      body .focus-mode-disabled [class*="tooltip"],
      body .focus-mode-disabled [class*="popup"],
      body .focus-mode-disabled [class*="menu-"],
      body .v-popover-content[style*="display: block"],
      body .dropdown-menu[style*="display: block"],
      body .popup-content[style*="display: block"],
      body [class*="tooltip"][style*="display: block"],
      body [class*="popup"][style*="display: block"],
      body [class*="menu-"][style*="display: block"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transform: scale(0) !important;
      }
      
      /* 伪元素覆盖层，确保没有交互 */
      .focus-mode-disabled::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        background-color: transparent;
      }
      
      /* 确保首页按钮正常 */
      .home-link, 
      a[href="https://www.bilibili.com/"], 
      a[href="https://www.bilibili.com/index.html"],
      a[href="/"],
      .bili-header__bar .left-entry li:first-child,
      .header-left-entry li:first-child,
      .navbar-home-link,
      .n-tab-links a:first-child,
      .left-entry a:first-child,
      a.nav-item-home,
      .bili-tab a:first-child,
      [data-idx="home"],
      [data-route="home"],
      a[title*="首页"],
      a[aria-label*="首页"],
      .home-icon {
        opacity: 1 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      
      /* 修复搜索按钮 */
      .search-submit,
      .search-button {
        opacity: 1 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      
      /* 修复顶部导航栏层级 */
      .bili-header__bar,
      .international-header,
      .bili-wrapper,
      .bili-header {
        z-index: 1000 !important;
      }
    `;
    
    ensureStylesOnce(styleId, cssText);
  }
  
  /**
   * 隐藏搜索框下方的热榜
   */
  static hideSearchHotList() {
    try {
      // 添加隐藏热榜的CSS
      const styleId = 'focus-hide-hot-search';
      const cssText = `
        /* 隐藏搜索热榜 */
        .search-panel .trending,
        .bili-header .trending,
        .search-panel .hotlist,
        .search-panel .history,
        .search-panel .suggest-wrap,
        .search-suggest-wrap,
        .suggest-wrap,
        .bilibili-search-suggest,
        .trending-list,
        .hotlist,
        #nav-searchform .suggest-wrap,
        #nav-searchform [class*=trending],
        #nav_searchform .suggest-wrap,
        #nav_searchform [class*=trending],
        .bili-search-suggestions,
        .search-suggestions,
        .search-container .suggest-wrap,
        #server-search-app .suggest-wrap,
        .search-page .suggest-wrap,
        .search-trending-hotlist,
        [class*=search-trending],
        .trending-item,
        .trending-section {
          display: none !important;
          visibility: hidden !important;
          max-height: 0 !important;
          overflow: hidden !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
        }
        
        /* 修复搜索框样式 */
        .international-header .nav-search-box,
        .nav-search-box,
        .search-box {
          border-bottom-left-radius: 4px !important;
          border-bottom-right-radius: 4px !important;
          box-shadow: none !important;
        }
      `;
      
      ensureStylesOnce(styleId, cssText);
      
      // 监听搜索框，动态移除热榜
      // 直接调用静态方法，修复this指向问题
      PageEnhancer.setupSearchObserver();
      
      Logger.log('页面增强', '搜索框热榜隐藏成功');
    } catch (err) {
      Logger.log('页面增强', '隐藏搜索框热榜时出错', Logger.ERROR, err);
    }
  }
  
  /**
   * 设置搜索框观察器，动态移除热榜
   */
  static setupSearchObserver() {
    try {
      // 可能的搜索框选择器
      const searchContainers = [
        '.international-header .nav-search-box',
        '.search-panel',
        '#nav-searchform',
        '#nav_searchform',
        '.bili-header__bar .right-entry .right-search',
        '.search-box',
        '.bili-search-box'
      ];
      
      const containers = robustSelector(searchContainers);
      
      if (!containers || containers.length === 0) {
        return;
      }
      
      // 创建观察器
      const observer = DOMObserver.create((mutations) => {
        try {
          const hotListSelectors = [
            '.trending',
            '.hotlist',
            '.history',
            '.suggest-wrap',
            '.search-suggest-wrap',
            '.bilibili-search-suggest',
            '.trending-list',
            '[class*=trending]',
            '.bili-search-suggestions',
            '.search-suggestions'
          ];
          
          const elements = robustSelector(hotListSelectors);
          if (elements && elements.length > 0) {
            elements.forEach(el => {
              if (el && el.parentElement) {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
              }
            });
          }
        } catch (innerErr) {
          // 忽略错误，确保不影响用户体验
        }
      });
      
      // 为每个容器添加观察器
      containers.forEach(container => {
        if (container) {
          observer.observe(container, {
            childList: true,
            subtree: true
          });
        }
      });
    } catch (err) {
      Logger.log('页面增强', '设置搜索框观察器时出错', Logger.ERROR, err);
    }
  }
  
  /**
   * 设置菜单观察器，处理动态添加的菜单和提示框
   */
  static setupMenuObserver() {
    try {
      // 观察body变化，捕获动态添加的菜单
      const observer = DOMObserver.create((mutations) => {
        // 检查是否有新的菜单或提示添加
        const menuSelectors = [
          '.v-popover-content', 
          '.dropdown-menu', 
          '.popup-content',
          '[class*="tooltip"]',
          '[class*="popup"]',
          '[class*="menu-"]',
          '.bili-popover',
          '.channel-popover',
          '.bili-dropdown'
        ];
        
        const newMenus = robustSelector(menuSelectors);
        
        if (newMenus && newMenus.length > 0) {
          // 对每个可能的菜单，检查它是否与禁用的导航项关联
          newMenus.forEach(menu => {
            // 检查位置是否在顶部导航区域
            const rect = menu.getBoundingClientRect();
            if (rect.top < 100) { // 导航栏通常在顶部
              menu.style.display = 'none';
              menu.style.visibility = 'hidden';
              menu.style.opacity = '0';
              menu.style.pointerEvents = 'none';
              menu.style.transform = 'scale(0)';
            }
          });
        }
      }, null, true, 200); // 使用节流，降低性能影响
      
      // 开始观察
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      Logger.log('页面增强', '菜单观察器设置成功');
    } catch (err) {
      Logger.log('页面增强', '设置菜单观察器时出错', Logger.ERROR, err);
    }
  }
}

/**
 * 统一设置服务 - 单例模式避免重复实例化
 * 管理所有设置相关的操作，确保一致性
 */
class SettingsService {
  static instance = null;
  static settingsManager = null;
  
  /**
   * 获取设置管理器单例
   */
  static async getInstance() {
    if (!this.settingsManager) {
      if (typeof FocusSettingsManager !== 'function') {
        throw new Error('FocusSettingsManager 类未加载');
      }
      
      this.settingsManager = new FocusSettingsManager();
      await this.settingsManager.initialize();
      console.log('[设置服务] 设置管理器初始化完成');
    }
    return this.settingsManager;
  }
  
  /**
   * 重置设置管理器（用于清理）
   */
  static reset() {
    this.settingsManager = null;
    console.log('[设置服务] 设置管理器已重置');
  }
}

/**
 * FirstTimeSetup 工厂类
 * 统一创建首次设置实例
 */
class SetupFactory {
  /**
   * 创建 FirstTimeSetup 实例
   */
  static async createFirstTimeSetup() {
    try {
      const settingsManager = await SettingsService.getInstance();
      
      // 等待 FirstTimeSetup 类加载
      const maxRetries = 10;
      let retries = 0;
      
      while (typeof FirstTimeSetup !== 'function' && retries < maxRetries) {
        console.log(`[设置工厂] 等待FirstTimeSetup类加载... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }
      
      if (typeof FirstTimeSetup !== 'function') {
        throw new Error('FirstTimeSetup 类加载超时');
      }
      
      return new FirstTimeSetup(settingsManager);
    } catch (err) {
      console.error('[设置工厂] 创建FirstTimeSetup失败:', err);
      throw err;
    }
  }
}

/**
 * 全局设置对话框管理器 - 美化版本
 * 统一处理所有设置相关的对话框
 */
class GlobalSettingsManager {
  
  /**
   * 显示主设置对话框 - 美化版本
   */
  static async showMainDialog() {
    try {
      const settingsManager = await SettingsService.getInstance();
      
      return new Promise((resolve) => {
        const { dialog, background } = UIUtils.createDialog({
          title: '🎯 专注模式设置',
          content: `
            <div class="modern-settings-container">
              <div class="settings-header">
                <div class="settings-icon">⚙️</div>
                <p class="settings-description">选择要修改的设置项</p>
              </div>
              
              <div class="settings-options">
                <button id="reset-password-btn" class="modern-option-button password-option" data-option="password">
                  <div class="option-icon">🔑</div>
                  <div class="option-content">
                    <div class="option-title">重置密码</div>
                    <div class="option-description">修改退出全屏时的验证密码</div>
                  </div>
                  <div class="option-arrow">›</div>
                </button>
                
                <button id="edit-reminders-btn" class="modern-option-button reminders-option" data-option="reminders">
                  <div class="option-icon">💬</div>
                  <div class="option-content">
                    <div class="option-title">编辑提醒语</div>
                    <div class="option-description">修改退出全屏时显示的提醒语句</div>
                  </div>
                  <div class="option-arrow">›</div>
                </button>
                
                <button id="reset-all-btn" class="modern-option-button reset-option" data-option="reset-all">
                  <div class="option-icon">🔄</div>
                  <div class="option-content">
                    <div class="option-title">重置所有设置</div>
                    <div class="option-description">清除所有设置，重新进行完整设置流程</div>
                  </div>
                  <div class="option-arrow">›</div>
                </button>
              </div>
            </div>
            
            <style>
              .modern-settings-container {
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              
              .settings-header {
                text-align: center;
                margin-bottom: 24px;
                padding: 16px 0;
                border-bottom: 1px solid #f0f0f0;
              }
              
              .settings-icon {
                font-size: 32px;
                margin-bottom: 8px;
              }
              
              .settings-description {
                color: #666;
                font-size: 14px;
                margin: 0;
              }
              
              .settings-options {
                display: flex;
                flex-direction: column;
                gap: 12px;
              }
              
              .modern-option-button {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                border: 2px solid #f0f0f0;
                border-radius: 12px;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
                text-align: left;
                position: relative;
                overflow: hidden;
              }
              
              .modern-option-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                transition: left 0.5s ease;
              }
              
              .modern-option-button:hover::before {
                left: 100%;
              }
              
              .modern-option-button:hover {
                border-color: #00a1d6;
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 161, 214, 0.15);
              }
              
              .password-option:hover {
                border-color: #4CAF50;
                box-shadow: 0 8px 25px rgba(76, 175, 80, 0.15);
              }
              
              .reminders-option:hover {
                border-color: #2196F3;
                box-shadow: 0 8px 25px rgba(33, 150, 243, 0.15);
              }
              
              .reset-option:hover {
                border-color: #ff5722;
                box-shadow: 0 8px 25px rgba(255, 87, 34, 0.15);
              }
              
              .modern-option-button:active {
                transform: translateY(0);
                box-shadow: 0 4px 12px rgba(0, 161, 214, 0.2);
              }
              
              .option-icon {
                font-size: 24px;
                margin-right: 16px;
                flex-shrink: 0;
              }
              
              .option-content {
                flex: 1;
              }
              
              .option-title {
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 4px;
                font-size: 16px;
              }
              
              .option-description {
                color: #7f8c8d;
                font-size: 13px;
                line-height: 1.4;
              }
              
              .option-arrow {
                font-size: 20px;
                color: #bdc3c7;
                margin-left: 12px;
                transition: transform 0.3s ease;
              }
              
              .modern-option-button:hover .option-arrow {
                transform: translateX(4px);
              }
              
              @keyframes slideInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              .modern-option-button {
                animation: slideInUp 0.4s ease forwards;
              }
              
              .modern-option-button:nth-child(2) {
                animation-delay: 0.1s;
              }
              
              .modern-option-button:nth-child(3) {
                animation-delay: 0.2s;
              }
            </style>
          `,
          buttons: [
            {
              text: '取消',
              type: 'secondary',
              onClick: (e, dialog, background) => {
                UIUtils.closeDialog(background);
                resolve(null);
              }
            }
          ],
          className: 'modern-global-settings-dialog'
        });
        
        // 添加按钮点击事件
        const buttons = dialog.querySelectorAll('.modern-option-button');
        buttons.forEach(button => {
          button.addEventListener('click', () => {
            const option = button.getAttribute('data-option');
            UIUtils.closeDialog(background);
            resolve(option);
          });
        });
      });
    } catch (err) {
      console.error('[全局设置] 显示主对话框失败:', err);
      throw err;
    }
  }
  
  /**
   * 处理密码重置
   */
  static async handlePasswordReset() {
    try {
      const settingsManager = await SettingsService.getInstance();
      const newPassword = await this.showPasswordDialog();
      
      if (newPassword) {
        await settingsManager.updatePassword(newPassword);
        this.showMessage('密码已成功重置', 'success');
      }
    } catch (err) {
      console.error('[全局设置] 处理密码重置失败:', err);
      this.showMessage('密码重置失败，请重试', 'error');
    }
  }
  
  /**
   * 处理提醒语编辑
   */
  static async handleRemindersEdit() {
    try {
      const settingsManager = await SettingsService.getInstance();
      const currentReminders = await settingsManager.getReminders();
      const newReminders = await this.showRemindersDialog(currentReminders);
      
      if (newReminders && newReminders.length > 0) {
        await settingsManager.updateReminders(newReminders);
        this.showMessage('提醒语已成功更新', 'success');
      }
    } catch (err) {
      console.error('[全局设置] 处理提醒语编辑失败:', err);
      this.showMessage('提醒语更新失败，请重试', 'error');
    }
  }
  
  /**
   * 处理重置所有设置
   */
  static async handleResetAll() {
    try {
      const settingsManager = await SettingsService.getInstance();
      const confirmed = await this.showConfirmDialog(
        '⚠️ 重置所有设置',
        '此操作将清除所有当前设置，并启动完整的重新设置流程。\n\n您需要重新设置：\n• 登录密码\n• 提醒语句\n• 其他个人偏好\n\n确定要继续吗？',
        true
      );
      
      if (confirmed) {
        // 先清除现有设置
        await settingsManager.resetSettings();
        console.log('[全局设置] 现有设置已清除');
        
        // 启动首次设置流程
        console.log('[全局设置] 启动首次设置流程');
        const firstTimeSetup = await SetupFactory.createFirstTimeSetup();
        await firstTimeSetup.showSetup();
        
        this.showMessage('设置已重置完成，请根据向导重新配置', 'success');
      }
    } catch (err) {
      console.error('[全局设置] 处理重置所有设置失败:', err);
      this.showMessage('重置设置失败：' + (err.message || '未知错误'), 'error');
    }
  }
  
  /**
   * 统一的设置处理入口
   */
  static async handleGlobalSettings() {
    try {
      console.log('[全局设置] 开始处理设置请求');
      
      // 显示设置选择对话框
      const option = await this.showMainDialog();
      
      if (option === 'password') {
        await this.handlePasswordReset();
      } else if (option === 'reminders') {
        await this.handleRemindersEdit();
      } else if (option === 'reset-all') {
        await this.handleResetAll();
      }
    } catch (err) {
      console.error('[全局设置] 处理设置失败:', err);
      this.showMessage('设置功能暂时不可用，请稍后重试', 'error');
    }
  }
  
  /**
   * 显示密码输入对话框 - 美化版本
   */
  static showPasswordDialog() {
    return new Promise((resolve) => {
      const { dialog, background } = UIUtils.createDialog({
        title: '🔑 设置新密码',
        content: `
          <div class="password-dialog-container">
            <div class="password-form">
              <div class="form-group">
                <label class="form-label">新密码</label>
                <input type="password" id="new-password" class="form-input" placeholder="请输入至少6位密码" minlength="6" required>
                <div class="form-hint">密码长度至少6位，建议使用字母数字组合</div>
              </div>
              
              <div class="form-group">
                <label class="form-label">确认密码</label>
                <input type="password" id="confirm-password" class="form-input" placeholder="请再次输入密码" minlength="6" required>
                <div class="form-hint">请确保两次输入的密码一致</div>
              </div>
            </div>
          </div>
          
          <style>
            .password-dialog-container {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .form-group {
              margin-bottom: 20px;
            }
            
            .form-label {
              display: block;
              margin-bottom: 8px;
              font-weight: 600;
              color: #2c3e50;
              font-size: 14px;
            }
            
            .form-input {
              width: 100%;
              padding: 12px 16px;
              border: 2px solid #e1e8ed;
              border-radius: 8px;
              font-size: 14px;
              transition: all 0.3s ease;
              box-sizing: border-box;
            }
            
            .form-input:focus {
              border-color: #00a1d6;
              outline: none;
              box-shadow: 0 0 0 3px rgba(0, 161, 214, 0.1);
            }
            
            .form-hint {
              font-size: 12px;
              color: #7f8c8d;
              margin-top: 6px;
            }
          </style>
        `,
        buttons: [
          {
            text: '取消',
            type: 'secondary',
            onClick: (e, dialog, background) => {
              UIUtils.closeDialog(background);
              resolve(null);
            }
          },
          {
            text: '确定',
            type: 'primary',
            onClick: (e, dialog, background) => {
              const newPassword = dialog.querySelector('#new-password').value;
              const confirmPassword = dialog.querySelector('#confirm-password').value;
              
              if (newPassword.length < 6) {
                GlobalSettingsManager.showMessage('密码长度不能少于6位', 'error');
                return;
              }
              
              if (newPassword !== confirmPassword) {
                GlobalSettingsManager.showMessage('两次输入的密码不一致', 'error');
                return;
              }
              
              UIUtils.closeDialog(background);
              resolve(newPassword);
            }
          }
        ],
        className: 'modern-password-dialog'
      });
      
      // 自动聚焦到第一个输入框
      setTimeout(() => {
        const firstInput = dialog.querySelector('#new-password');
        if (firstInput) firstInput.focus();
      }, 100);
      
      // 添加回车键支持
      dialog.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          const confirmButton = dialog.querySelector('button[type="primary"]');
          if (confirmButton) confirmButton.click();
        }
      });
    });
  }
  
  /**
   * 显示提醒语编辑对话框 - 美化版本
   */
  static showRemindersDialog(currentReminders = []) {
    return new Promise((resolve) => {
      const reminders = [...currentReminders];
      
      const { dialog, background } = UIUtils.createDialog({
        title: '💬 编辑提醒语',
        content: `
          <div class="reminders-dialog-container">
            <div class="reminders-header">
              <p class="reminders-description">设置退出全屏时显示的提醒语句，帮助您保持专注</p>
            </div>
            
            <div class="reminders-list" id="reminders-list">
              <!-- 动态生成提醒语列表 -->
            </div>
            
            <button class="add-reminder-btn" id="add-reminder-btn">
              <span class="add-icon">+</span>
              添加新提醒语
            </button>
          </div>
          
          <style>
            .reminders-dialog-container {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-height: 400px;
            }
            
            .reminders-header {
              margin-bottom: 20px;
              padding-bottom: 16px;
              border-bottom: 1px solid #f0f0f0;
            }
            
            .reminders-description {
              color: #666;
              font-size: 14px;
              margin: 0;
              line-height: 1.5;
            }
            
            .reminders-list {
              max-height: 250px;
              overflow-y: auto;
              margin-bottom: 16px;
            }
            
            .reminder-item {
              display: flex;
              align-items: center;
              padding: 12px;
              border: 2px solid #f0f0f0;
              border-radius: 8px;
              margin-bottom: 8px;
              background: #fff;
              transition: all 0.3s ease;
            }
            
            .reminder-item:hover {
              border-color: #00a1d6;
              box-shadow: 0 4px 12px rgba(0, 161, 214, 0.1);
            }
            
            .reminder-input {
              flex: 1;
              border: none;
              outline: none;
              font-size: 14px;
              padding: 4px 8px;
            }
            
            .remove-reminder-btn {
              padding: 4px 8px;
              background: #ff5722;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              margin-left: 8px;
              transition: background 0.3s ease;
            }
            
            .remove-reminder-btn:hover {
              background: #e64a19;
            }
            
            .add-reminder-btn {
              width: 100%;
              padding: 12px;
              border: 2px dashed #bdc3c7;
              background: transparent;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              color: #7f8c8d;
              transition: all 0.3s ease;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .add-reminder-btn:hover {
              border-color: #00a1d6;
              color: #00a1d6;
              background: rgba(0, 161, 214, 0.05);
            }
            
            .add-icon {
              font-size: 18px;
              margin-right: 8px;
            }
          </style>
        `,
        buttons: [
          {
            text: '取消',
            type: 'secondary',
            onClick: (e, dialog, background) => {
              UIUtils.closeDialog(background);
              resolve(null);
            }
          },
          {
            text: '保存',
            type: 'primary',
            onClick: (e, dialog, background) => {
              const inputs = dialog.querySelectorAll('.reminder-input');
              const newReminders = Array.from(inputs)
                .map(input => input.value.trim())
                .filter(text => text.length > 0);
              
              if (newReminders.length < 3) {
                GlobalSettingsManager.showMessage('至少需要3条提醒语', 'error');
                return;
              }
              
              UIUtils.closeDialog(background);
              resolve(newReminders);
            }
          }
        ],
        className: 'modern-reminders-dialog'
      });
      
      // 渲染提醒语列表
      const renderReminders = () => {
        const list = dialog.querySelector('#reminders-list');
        list.innerHTML = '';
        
        reminders.forEach((reminder, index) => {
          const item = document.createElement('div');
          item.className = 'reminder-item';
          item.innerHTML = `
            <input type="text" class="reminder-input" value="${reminder}" placeholder="请输入提醒语">
            <button class="remove-reminder-btn" data-index="${index}">删除</button>
          `;
          list.appendChild(item);
        });
      };
      
      // 初始渲染
      renderReminders();
      
      // 添加事件监听
      dialog.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-reminder-btn')) {
          const index = parseInt(e.target.getAttribute('data-index'));
          reminders.splice(index, 1);
          renderReminders();
        }
        
        if (e.target.id === 'add-reminder-btn' || e.target.parentElement.id === 'add-reminder-btn') {
          reminders.push('');
          renderReminders();
          // 聚焦到新添加的输入框
          setTimeout(() => {
            const inputs = dialog.querySelectorAll('.reminder-input');
            const lastInput = inputs[inputs.length - 1];
            if (lastInput) lastInput.focus();
          }, 100);
        }
      });
      
      // 监听输入变化
      dialog.addEventListener('input', (e) => {
        if (e.target.classList.contains('reminder-input')) {
          const inputs = dialog.querySelectorAll('.reminder-input');
          inputs.forEach((input, index) => {
            reminders[index] = input.value;
          });
        }
      });
    });
  }
  
  /**
   * 显示确认对话框 - 美化版本
   */
  static showConfirmDialog(title, message, isWarning = false) {
    return new Promise((resolve) => {
      const icon = isWarning ? '⚠️' : '❓';
      const buttonColor = isWarning ? '#ff5722' : '#00a1d6';
      
      const { dialog, background } = UIUtils.createDialog({
        title: title,
        content: `
          <div class="confirm-dialog-container">
            <div class="confirm-icon">${icon}</div>
            <div class="confirm-message">${message.replace(/\n/g, '<br>')}</div>
          </div>
          
          <style>
            .confirm-dialog-container {
              text-align: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .confirm-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }
            
            .confirm-message {
              color: #2c3e50;
              font-size: 14px;
              line-height: 1.6;
              margin-bottom: 20px;
            }
          </style>
        `,
        buttons: [
          {
            text: '取消',
            type: 'secondary',
            onClick: (e, dialog, background) => {
              UIUtils.closeDialog(background);
              resolve(false);
            }
          },
          {
            text: '确定',
            type: 'primary',
            style: `background: ${buttonColor} !important; border-color: ${buttonColor} !important;`,
            onClick: (e, dialog, background) => {
              UIUtils.closeDialog(background);
              resolve(true);
            }
          }
        ],
        className: 'modern-confirm-dialog'
      });
    });
  }
  
  /**
   * 显示消息提示 - 美化版本
   */
  static showMessage(message, type = 'info') {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };
    
    const icon = icons[type] || icons.info;
    const color = colors[type] || colors.info;
    
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = 'modern-message-toast';
    messageEl.innerHTML = `
      <div class="message-content">
        <span class="message-icon">${icon}</span>
        <span class="message-text">${message}</span>
      </div>
      
      <style>
        .modern-message-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          border-left: 4px solid ${color};
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          padding: 16px 20px;
          z-index: 1000000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideInRight 0.3s ease;
          max-width: 400px;
        }
        
        .message-content {
          display: flex;
          align-items: center;
        }
        
        .message-icon {
          font-size: 18px;
          margin-right: 12px;
        }
        
        .message-text {
          color: #2c3e50;
          font-size: 14px;
          font-weight: 500;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      </style>
    `;
    
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
      messageEl.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 300);
    }, 3000);
  }
}

// 导出全局变量
if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.EventManager = EventManager;
  window.DOMObserver = DOMObserver;
  window.ModuleInitializer = ModuleInitializer;
  window.ensureStylesOnce = ensureStylesOnce;
  window.throttle = throttle;
  window.debounce = debounce;
  window.robustSelector = robustSelector;
  window.findElementsByFeature = findElementsByFeature;
  window.UIUtils = UIUtils;
  window.StorageUtils = StorageUtils; 
  window.PageEnhancer = PageEnhancer;
  
  // 新增的统一服务
  window.SettingsService = SettingsService;
  window.SetupFactory = SetupFactory;
  window.GlobalSettingsManager = GlobalSettingsManager;
} 