// utils.js - 公共工具函数和类

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
 * 通用UI工具类
 * 提供对话框创建、元素操作等通用UI功能
 */
class UIUtils {
  /**
   * 创建并显示对话框
   * @param {Object} options - 对话框配置选项
   * @param {string} options.title - 对话框标题
   * @param {string} options.content - 对话框内容HTML
   * @param {Object[]} options.buttons - 对话框按钮配置
   * @param {string} options.buttons[].text - 按钮文本
   * @param {string} options.buttons[].type - 按钮类型 (primary/secondary)
   * @param {Function} options.buttons[].onClick - 按钮点击回调
   * @param {string} options.width - 对话框宽度
   * @param {string} options.className - 对话框附加类名
   * @returns {Object} 包含对话框元素和背景元素的对象
   */
  static createDialog(options) {
    // 创建对话框背景
    const dialogBackground = document.createElement('div');
    dialogBackground.className = 'dialog-overlay active';
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    
    if (options.width) {
      dialog.style.width = options.width;
    }
    
    if (options.className) {
      dialog.classList.add(options.className);
    }
    
    // 设置对话框内容
    let dialogContent = `<h3>${options.title}</h3>`;
    dialogContent += options.content;
    
    // 添加按钮
    if (options.buttons && options.buttons.length > 0) {
      dialogContent += `<div class="dialog-buttons">`;
      options.buttons.forEach(button => {
        dialogContent += `<button class="dialog-button ${button.type || 'secondary'}" id="${button.id || ''}">${button.text}</button>`;
      });
      dialogContent += `</div>`;
    }
    
    dialog.innerHTML = dialogContent;
    
    // 添加到页面
    dialogBackground.appendChild(dialog);
    document.body.appendChild(dialogBackground);
    
    // 绑定按钮事件
    if (options.buttons) {
      options.buttons.forEach(button => {
        const buttonElement = button.id ? dialog.querySelector(`#${button.id}`) : 
                                        dialog.querySelector(`.dialog-button:contains('${button.text}')`);
        if (buttonElement && button.onClick) {
          buttonElement.addEventListener('click', (e) => {
            button.onClick(e, dialog, dialogBackground);
          });
        }
      });
    }
    
    return { dialog, background: dialogBackground };
  }
  
  /**
   * 关闭对话框
   * @param {Element} dialogBackground - 对话框背景元素
   */
  static closeDialog(dialogBackground) {
    if (dialogBackground && dialogBackground.parentNode) {
      dialogBackground.parentNode.removeChild(dialogBackground);
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
      console.warn('[存储工具] Chrome存储API检查失败:', e);
      return false;
    }
  }

  /**
   * 保存数据到存储
   * @param {string} key - 存储键名
   * @param {any} data - 要存储的数据
   * @returns {Promise} 保存操作的Promise
   */
  static save(key, data) {
    return new Promise((resolve, reject) => {
      // 先尝试本地备份
      try {
        // 确保即使Chrome存储失败，本地存储也能作为备份
        localStorage.setItem(`${key}_backup`, JSON.stringify(data));
      } catch (backupError) {
        console.warn('[存储工具] 本地备份失败:', backupError);
        // 备份失败不阻止主要存储过程继续
      }
      
      try {
        // 检查Chrome存储API是否可用
        if (StorageUtils.isChromeStorageAvailable()) {
          const saveObj = {};
          saveObj[key] = data;
          
          // 使用try-catch包装Chrome存储操作
          try {
            chrome.storage.local.set(saveObj, () => {
              const error = chrome.runtime.lastError;
              if (error) {
                const errorMessage = error.message || '未知错误';
                console.warn(`[存储工具] Chrome存储API错误: ${errorMessage}`);
                
                // 判断是否是上下文失效错误
                if (errorMessage.includes('context invalidated') || 
                    errorMessage.includes('Extension context')) {
                  console.warn('[存储工具] 检测到扩展上下文失效，回退到localStorage');
                  
                  // 回退到localStorage
                  try {
                    localStorage.setItem(key, JSON.stringify(data));
                    console.log('[存储工具] 成功回退到localStorage存储');
                    resolve(); // 回退成功也算成功
                  } catch (localErr) {
                    console.error('[存储工具] 回退到localStorage也失败:', localErr);
                    reject(localErr);
                  }
                } else {
                  reject(error);
                }
              } else {
                resolve();
              }
            });
          } catch (chromeError) {
            console.warn('[存储工具] Chrome存储API调用异常:', chromeError);
            
            // 回退到localStorage
            try {
              localStorage.setItem(key, JSON.stringify(data));
              console.log('[存储工具] 存储API异常，成功回退到localStorage');
              resolve(); // 回退成功也算成功
            } catch (localErr) {
              console.error('[存储工具] 回退到localStorage也失败:', localErr);
              reject(localErr);
            }
          }
        } else {
          // Chrome存储API不可用，直接使用localStorage
          console.log('[存储工具] Chrome存储API不可用，使用localStorage');
          localStorage.setItem(key, JSON.stringify(data));
          resolve();
        }
      } catch (e) {
        console.error('[存储工具] 保存数据失败:', e);
        reject(e);
      }
    });
  }
  
  /**
   * 从存储中加载数据
   * @param {string} key - 存储键名
   * @param {any} defaultValue - 默认值(如果数据不存在)
   * @returns {Promise<any>} 包含数据的Promise
   */
  static load(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      try {
        // 检查Chrome存储API是否可用
        if (StorageUtils.isChromeStorageAvailable()) {
          try {
            chrome.storage.local.get([key], (result) => {
              const error = chrome.runtime.lastError;
              if (error) {
                const errorMessage = error.message || '未知错误';
                console.warn(`[存储工具] Chrome存储API读取错误: ${errorMessage}`);
                
                // 判断是否是上下文失效错误
                if (errorMessage.includes('context invalidated') || 
                    errorMessage.includes('Extension context')) {
                  console.warn('[存储工具] 检测到扩展上下文失效，尝试从localStorage读取');
                  StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
                } else {
                  reject(error);
                }
              } else if (result[key] !== undefined) {
                console.log(`[存储工具] 成功从Chrome存储API加载: ${key}`);
                resolve(result[key]);
              } else {
                // 数据在Chrome存储中不存在，尝试从localStorage读取
                console.log(`[存储工具] Chrome存储中不存在${key}，尝试从localStorage读取`);
                StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
              }
            });
          } catch (chromeError) {
            console.warn('[存储工具] Chrome存储API调用异常:', chromeError);
            // 回退到localStorage
            StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
          }
        } else {
          // Chrome存储API不可用，直接使用localStorage
          console.log('[存储工具] Chrome存储API不可用，从localStorage读取');
          StorageUtils.loadFromLocalStorage(key, defaultValue, resolve, reject);
        }
      } catch (e) {
        console.error('[存储工具] 加载数据失败:', e);
        
        // 最终回退到默认值
        try {
          // 尝试从备份加载
          const backupData = localStorage.getItem(`${key}_backup`);
          if (backupData) {
            console.log(`[存储工具] 从备份中恢复数据: ${key}`);
            resolve(JSON.parse(backupData));
          } else {
            resolve(defaultValue);
          }
        } catch (finalError) {
          console.error('[存储工具] 最终回退失败，返回默认值:', finalError);
          resolve(defaultValue);
        }
      }
    });
  }
  
  /**
   * 从localStorage加载数据的辅助方法
   * @private
   */
  static loadFromLocalStorage(key, defaultValue, resolve, reject) {
    try {
      // 先尝试直接从localStorage读取
      const data = localStorage.getItem(key);
      if (data) {
        console.log(`[存储工具] 成功从localStorage加载: ${key}`);
        resolve(JSON.parse(data));
        return;
      }
      
      // 如果没有，尝试从备份读取
      const backupData = localStorage.getItem(`${key}_backup`);
      if (backupData) {
        console.log(`[存储工具] 从localStorage备份加载: ${key}`);
        resolve(JSON.parse(backupData));
        return;
      }
      
      // 如果都没有，返回默认值
      console.log(`[存储工具] 未找到${key}数据，返回默认值`);
      resolve(defaultValue);
    } catch (localErr) {
      console.error('[存储工具] 从localStorage加载失败:', localErr);
      // 出错时仍返回默认值，保证不会中断操作流
      resolve(defaultValue);
    }
  }
  
  /**
   * 从存储中删除数据
   * @param {string} key - 存储键名
   * @returns {Promise} 删除操作的Promise
   */
  static remove(key) {
    return new Promise((resolve, reject) => {
      try {
        // 确保同时删除主存储和备份
        localStorage.removeItem(`${key}_backup`);
        
        if (StorageUtils.isChromeStorageAvailable()) {
          try {
            chrome.storage.local.remove(key, () => {
              if (chrome.runtime.lastError) {
                console.warn('[存储工具] Chrome存储删除失败，尝试从localStorage删除');
                localStorage.removeItem(key);
              }
              // 无论Chrome存储是否成功，都认为操作完成
              resolve();
            });
          } catch (chromeError) {
            console.warn('[存储工具] Chrome存储API调用异常，从localStorage删除:', chromeError);
            localStorage.removeItem(key);
            resolve();
          }
        } else {
          // Chrome存储不可用，直接从localStorage删除
          localStorage.removeItem(key);
          resolve();
        }
      } catch (e) {
        console.error('[存储工具] 删除数据失败:', e);
        // 删除操作失败不应阻止应用程序继续运行
        resolve();
      }
    });
  }
}

// 把工具函数和类绑定到全局对象
window.ensureStylesOnce = ensureStylesOnce;
window.throttle = throttle;
if (typeof window !== 'undefined' && typeof UIUtils !== 'undefined' && !window.UIUtils) window.UIUtils = UIUtils;
window.StorageUtils = StorageUtils; 