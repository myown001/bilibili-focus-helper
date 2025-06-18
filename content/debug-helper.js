// /**
//  * B站专注模式调试助手
//  * 用于在页面上显示调试信息，帮助开发者排查问题
//  */
// (function() {
//   'use strict';
  
//   // 是否启用调试模式
//   const ENABLE_DEBUG = true;
  
//   // 调试信息面板
//   let debugPanel = null;
  
//   // 性能数据
//   const performanceData = {
//     startTime: Date.now(),
//     domCount: 0,
//     styleCount: 0,
//     scriptCount: 0
//   };
  
//   // 调试助手类
//   class DebugHelper {
//     constructor() {
//       this.messages = [];
//       this.isInitialized = false;
//       this.isPanelVisible = false;
      
//       // 推迟初始化调试面板，确保document.body存在
//       this.waitForBody();
//     }
    
//     /**
//      * 等待document.body可用
//      */
//     waitForBody() {
//       if (!ENABLE_DEBUG) return;
      
//       // 如果document.body已存在，直接初始化
//       if (document.body) {
//         this.init();
//         return;
//       }
      
//       // 如果document正在加载，等待DOMContentLoaded事件
//       if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', () => {
//           this.init();
//         });
//       } else {
//         // 使用MutationObserver监听DOM变化，等待body出现
//         const observer = new MutationObserver(() => {
//           if (document.body) {
//             observer.disconnect();
//             this.init();
//           }
//         });
        
//         // 监听document变化，等待body被创建
//         observer.observe(document.documentElement, { childList: true });
        
//         // 设置备用方案，如果5秒内body仍未出现，尝试再次检查
//         setTimeout(() => {
//           if (!this.isInitialized && document.body) {
//             this.init();
//           }
//         }, 5000);
//       }
//     }
    
//     /**
//      * 初始化调试面板
//      */
//     init() {
//       if (!ENABLE_DEBUG) return;
//       if (this.isInitialized) return;
//       if (!document.body) return; // 确保document.body存在
      
//       // 创建调试面板
//       debugPanel = document.createElement('div');
//       debugPanel.className = 'bili-focus-debug-panel';
//       debugPanel.style.cssText = `
//         position: fixed;
//         top: 10px;
//         left: 10px;
//         background: rgba(0, 0, 0, 0.8);
//         color: white;
//         z-index: 999999;
//         padding: 10px;
//         font-size: 12px;
//         border-radius: 4px;
//         max-width: 600px;
//         max-height: 300px;
//         overflow: auto;
//         font-family: monospace;
//         opacity: 0.85;
//         box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
//       `;
      
//       // 添加调试标题
//       const title = document.createElement('div');
//       title.textContent = 'B站学习助手调试工具';
//       title.style.cssText = `
//         font-weight: bold;
//         border-bottom: 1px solid #666;
//         padding-bottom: 5px;
//         margin-bottom: 5px;
//       `;
//       debugPanel.appendChild(title);
      
//       // 添加URL信息
//       this.addMessage(`当前URL: ${window.location.href}`, 'info');
      
//       // 收集页面性能数据
//       this.collectPerformanceData();
      
//       // 安全地添加到页面
//       try {
//         document.body.appendChild(debugPanel);
        
//         // 添加调试切换按钮
//         this.addToggleButton();
        
//         this.isInitialized = true;
//         this.isPanelVisible = true;
        
//         // 显示之前缓存的消息
//         this.showCachedMessages();
        
//         // 设置定时更新
//         setInterval(() => this.updatePerformanceData(), 2000);
//       } catch (e) {
//         console.error('[调试工具] 添加调试面板失败:', e);
//       }
//     }
    
//     /**
//      * 显示缓存的消息
//      */
//     showCachedMessages() {
//       if (this.messages.length > 0 && debugPanel) {
//         // 显示在初始化之前收集的消息
//         this.messages.forEach(msg => {
//           this.addMessage(msg.message, msg.type);
//         });
//         // 清空缓存
//         this.messages = [];
//       }
//     }
    
//     /**
//      * 添加开关按钮
//      */
//     addToggleButton() {
//       const toggleBtn = document.createElement('div');
//       toggleBtn.style.cssText = `
//         position: absolute;
//         top: 0;
//         right: 0;
//         padding: 2px 6px;
//         background: #666;
//         cursor: pointer;
//         border-radius: 0 4px 0 4px;
//       `;
//       toggleBtn.textContent = '—';
//       toggleBtn.title = '最小化/展开调试面板';
      
//       toggleBtn.addEventListener('click', () => {
//         const content = debugPanel.querySelectorAll('div:not(:first-child)');
        
//         if (this.isPanelVisible) {
//           // 隐藏内容
//           content.forEach(el => el.style.display = 'none');
//           toggleBtn.textContent = '+';
//           debugPanel.style.maxHeight = 'auto';
//           debugPanel.style.height = '20px';
//         } else {
//           // 显示内容
//           content.forEach(el => el.style.display = 'block');
//           toggleBtn.textContent = '—';
//           debugPanel.style.height = 'auto';
//           debugPanel.style.maxHeight = '300px';
//         }
        
//         this.isPanelVisible = !this.isPanelVisible;
//       });
      
//       // 添加到调试面板
//       debugPanel.querySelector('div').appendChild(toggleBtn);
//     }
    
//     /**
//      * 添加消息到调试面板
//      * @param {string} message - 消息内容
//      * @param {string} type - 消息类型 (info/warning/error)
//      */
//     addMessage(message, type = 'info') {
//       if (!ENABLE_DEBUG) return;
      
//       // 如果面板尚未初始化，缓存消息
//       if (!this.isInitialized || !debugPanel) {
//         this.messages.push({ message, type });
//         return;
//       }
      
//       // 创建消息元素
//       const msgEl = document.createElement('div');
//       msgEl.style.margin = '5px 0';
//       msgEl.style.wordWrap = 'break-word';
      
//       // 添加时间戳
//       const timestamp = new Date().toLocaleTimeString();
      
//       // 设置不同类型消息的样式
//       switch (type) {
//         case 'error':
//           msgEl.style.color = '#ff4444';
//           msgEl.innerHTML = `<span style="color:#999;">[${timestamp}][性能]</span> <span style="color:#ff4444;">⚠️ ${message}</span>`;
//           break;
//         case 'warning':
//           msgEl.style.color = '#ffaa00';
//           msgEl.innerHTML = `<span style="color:#999;">[${timestamp}][测试]</span> <span style="color:#ffaa00;">⚠ ${message}</span>`;
//           break;
//         default:
//           msgEl.style.color = '#fff';
//           msgEl.innerHTML = `<span style="color:#999;">[${timestamp}]</span> ${message}`;
//       }
      
//       // 添加到面板
//       try {
//         debugPanel.appendChild(msgEl);
        
//         // 自动滚动到底部
//         debugPanel.scrollTop = debugPanel.scrollHeight;
//       } catch (e) {
//         console.error('[调试工具] 添加消息失败:', e);
//       }
//     }
    
//     /**
//      * 收集页面性能数据
//      */
//     collectPerformanceData() {
//       // 添加加载时间信息
//       const loadTime = performance.timing ? 
//         (performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart) : 
//         'performance API不可用';
        
//       this.addMessage(`页面性能检查 开始计时`, 'info');
      
//       try {
//         // 获取DOM元素计数 (安全检查)
//         if (document.body) {
//           performanceData.domCount = document.querySelectorAll('*').length;
          
//           // 获取样式表计数
//           performanceData.styleCount = document.querySelectorAll('style,link[rel="stylesheet"]').length;
          
//           // 获取脚本计数
//           performanceData.scriptCount = document.querySelectorAll('script').length;
          
//           this.updatePerformanceDisplay();
//         }
//       } catch (e) {
//         this.addMessage(`收集性能数据失败: ${e.message}`, 'error');
//       }
      
//       // 添加加载时间结束信息
//       setTimeout(() => {
//         this.addMessage(`performance-check 用时: ${(Date.now() - performanceData.startTime) / 1000}s`, 'info');
//       }, 0);
//     }
    
//     /**
//      * 更新性能数据
//      */
//     updatePerformanceData() {
//       if (!document.body) return;
      
//       try {
//         // 更新DOM元素计数
//         const currentDomCount = document.querySelectorAll('*').length;
//         if (currentDomCount !== performanceData.domCount) {
//           this.addMessage(`[性能] DOM元素数量: ${currentDomCount}`, 'info');
//           performanceData.domCount = currentDomCount;
//         }
        
//         // 白屏检测
//         this.checkWhiteScreen();
//       } catch (e) {
//         this.addMessage(`更新性能数据失败: ${e.message}`, 'error');
//       }
//     }
    
//     /**
//      * 更新性能数据显示
//      */
//     updatePerformanceDisplay() {
//       this.addMessage(`[性能] DOM元素数量: ${performanceData.domCount}`, 'info');
//       this.addMessage(`[性能] 样式表数量: ${performanceData.styleCount}`, 'info');
//       this.addMessage(`[性能] 脚本数量: ${performanceData.scriptCount}`, 'info');
//     }
    
//     /**
//      * 检测白屏问题
//      */
//     checkWhiteScreen() {
//       // 检查主要内容区域是否可见
//       const mainContent = document.querySelector('.bili-layout') || document.querySelector('#app') || document.querySelector('.focused-homepage-container');
//       if (mainContent) {
//         const rect = mainContent.getBoundingClientRect();
//         if (rect.width === 0 || rect.height === 0) {
//           this.addMessage('白屏检测异正常', 'warning');
//         }
//       }
//     }
//   }
  
//   // 创建全局实例
//   window.debugHelper = new DebugHelper();
// })(); 