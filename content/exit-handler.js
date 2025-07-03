/**
 * 退出处理类
 * 负责处理退出全屏的流程，包括提醒语确认和密码验证
 */
class ExitHandler {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.currentReminderIndex = 0;
    this.preventEscapeHandler = null;
    // 记录退出请求状态
    this.exitRequested = false;
    // 跟踪尝试次数
    this.exitAttempts = 0;
    // 上次尝试时间
    this.lastExitAttemptTime = 0;
    // 提示语对话框活动状态
    this.reminderDialogActive = false;
    // 保存对话框和背景元素的引用
    this.reminderDialog = null;
    this.reminderBackground = null;
    // 退出过渡状态
    this.exitTransitionActive = false;
    
    // 初始化样式系统
    this.initializeStyles();
  }
  
  // 使用独立的对话框样式类名
  static DIALOG_CLASS = 'focus-exit-dialog';
  
  // 定义统一的 z-index 层级系统
  static Z_LAYERS = {
    BASE: 10,            // 基础层级
    OVERLAY: 30,         // 遮罩层
    DIALOG: 40,          // 对话框
    CRITICAL: 50,        // 关键操作对话框
    HIGHEST: 60          // 最高层级（用于特殊情况）
  };
  
  /**
   * 初始化所有样式，集中管理样式定义
   */
  initializeStyles() {
    const styleId = 'exit-handler-styles';
    // 避免重复添加样式
    if (document.getElementById(styleId)) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      /* CSS 变量定义 - 主题颜色和样式 */
      :root {
        --focus-primary: #00a1d6;
        --focus-primary-hover: #0092c3;
        --focus-secondary: #f0f9ff;
        --focus-text: #333333;
        --focus-text-light: #666666;
        --focus-text-lighter: #cccccc;
        --focus-bg: #ffffff;
        --focus-bg-secondary: #f0f0f0;
        --focus-border: rgba(255, 255, 255, 0.1);
        --focus-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        --focus-radius: 8px;
        --focus-radius-sm: 4px;
        --focus-transition: 0.3s ease;
      }
      
      /* 对话框基础样式 */
      .focus-exit-dialog {
        z-index: ${ExitHandler.Z_LAYERS.DIALOG};
        box-shadow: var(--focus-shadow);
        animation: dialog-fade-in 0.3s ease;
        border-radius: var(--focus-radius);
        border: 1px solid var(--focus-border);
        background: var(--focus-bg);
        padding: 20px;
        max-width: 450px;
        width: 90%;
        position: relative;
        margin: 0 auto;
      }
      
      /* 对话框标题 */
      .focus-exit-dialog h3 {
        font-size: 20px;
        margin-bottom: 15px;
        color: var(--focus-primary);
        text-align: center;
        font-weight: bold;
      }
      
      /* 提醒内容样式 */
      .focus-exit-dialog .dialog-message.reminder-content {
        font-size: 18px;
        padding: 20px;
        margin: 15px 0;
        background: var(--focus-secondary);
        border-left: 4px solid var(--focus-primary);
        border-radius: var(--focus-radius-sm);
        color: var(--focus-text);
        line-height: 1.6;
      }
      
      /* 进度条容器 */
      .focus-exit-dialog .reminder-progress {
        margin: 15px 0;
      }
      
      /* 进度文本 */
      .focus-exit-dialog .progress-text {
        font-size: 14px;
        color: var(--focus-text-light);
        margin-bottom: 5px;
        text-align: right;
      }
      
      /* 进度条背景 */
      .focus-exit-dialog .progress-bar {
        height: 4px;
        background: #eee;
        border-radius: 2px;
        overflow: hidden;
      }
      
      /* 进度条填充 */
      .focus-exit-dialog .progress-fill {
        height: 100%;
        background: var(--focus-primary);
        border-radius: 2px;
        transition: width 0.3s ease-out;
      }
      
      /* 按钮容器 */
      .focus-exit-dialog .dialog-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      
      /* 按钮基础样式 */
      .focus-exit-dialog .dialog-button {
        padding: 8px 20px;
        border-radius: 20px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        min-width: 100px;
        transition: all 0.2s ease;
      }
      
      /* 主按钮 */
      .focus-exit-dialog .dialog-button.primary {
        background: var(--focus-primary);
        color: white;
      }
      
      .focus-exit-dialog .dialog-button.primary:hover {
        background: var(--focus-primary-hover);
      }
      
      /* 次要按钮 */
      .focus-exit-dialog .dialog-button.secondary {
        background: var(--focus-bg-secondary);
        color: var(--focus-text-light);
      }
      
      .focus-exit-dialog .dialog-button.secondary:hover {
        background: #e0e0e0;
      }
      
      /* 遮罩层 - 使用较低的透明度允许底层内容可见 */
      .dialog-overlay.fullscreen-overlay {
        z-index: ${ExitHandler.Z_LAYERS.OVERLAY};
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(2px);
      }
      
      /* 顶层遮罩 - 使用较低的透明度允许底层内容可见 */
      .top-level-exit-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${ExitHandler.Z_LAYERS.CRITICAL};
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(3px);
      }
      
      /* 局部覆盖层 - 只覆盖部分屏幕 */
      .partial-exit-overlay {
        position: fixed;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${ExitHandler.Z_LAYERS.OVERLAY};
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(3px);
        border-radius: var(--focus-radius);
      }
      
      /* 退出进度对话框 */
      .exit-progress-dialog {
        background: rgba(18, 18, 18, 0.85);
        border-radius: var(--focus-radius);
        padding: 20px;
        width: 400px;
        max-width: 90%;
        box-shadow: var(--focus-shadow);
        border: 1px solid var(--focus-border);
      }
      
      /* 对话框淡入动画 */
      @keyframes dialog-fade-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* 退出过渡样式 */
      .exit-transition-overlay {
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        width: auto;
        max-width: 90%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: ${ExitHandler.Z_LAYERS.OVERLAY};
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.5s ease, visibility 0.5s ease;
        will-change: opacity, visibility;
        border-radius: var(--focus-radius);
        padding: 10px;
      }
      
      .exit-transition-overlay.visible {
        opacity: 1;
        visibility: visible;
      }
      
      .exit-transition-content {
        background-color: var(--focus-bg);
        border-radius: var(--focus-radius);
        padding: 24px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        box-shadow: var(--focus-shadow);
        transform: translateY(20px);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        will-change: transform, opacity;
      }
      
      .exit-transition-overlay.visible .exit-transition-content {
        transform: translateY(0);
        opacity: 1;
      }
      
      .exit-transition-overlay.fade-out {
        opacity: 0;
      }
      
      .exit-transition-overlay.fade-out .exit-transition-content {
        transform: translateY(10px);
        opacity: 0;
      }
      
      /* 退出图标 */
      .exit-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 60px;
        background-color: var(--focus-secondary);
        border-radius: 50%;
        margin: 0 auto 16px;
      }
      
      .exit-icon svg {
        color: var(--focus-primary);
      }
      
      /* 退出标题 */
      .exit-title {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 16px;
        color: var(--focus-text);
      }
      
      /* 退出描述 */
      .exit-description {
        color: var(--focus-text-light);
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
        background-color: #f8f9fa;
        padding: 15px;
        border-radius: var(--focus-radius-sm);
      }
      
      .exit-description p {
        margin: 6px 0;
      }
      
      /* 退出进度条 */
      .exit-progress-bar {
        height: 4px;
        background-color: #eee;
        border-radius: 2px;
        overflow: hidden;
        margin: 20px 0;
      }
      
      .exit-progress-fill {
        height: 100%;
        width: 0;
        background-color: var(--focus-primary);
        transition: width 4s linear;
      }
      
      /* 确认按钮 */
      .exit-confirm-button {
        margin-top: 20px;
      }
      
      .confirm-btn {
        background-color: var(--focus-primary);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 8px 24px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .confirm-btn:hover {
        background-color: var(--focus-primary-hover);
      }
      
      .confirm-btn:active {
        transform: scale(0.98);
      }
      
      /* 事件透传样式 */
      .event-passthrough {
        pointer-events: none;
      }
      
      .event-passthrough .focus-exit-dialog,
      .event-passthrough .confirm-btn,
      .event-passthrough .dialog-button {
        pointer-events: auto;
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  /**
   * 动态计算最佳的 z-index 值，避免覆盖重要的 B 站原生控件
   * @param {string} type - z-index 类型 ('base', 'overlay', 'dialog', 'critical', 'highest')
   * @returns {number} 计算得到的最佳 z-index 值
   */
  calculateOptimalZIndex(type = 'dialog') {
    try {
      // 基础值映射
      const baseValues = {
        base: ExitHandler.Z_LAYERS.BASE,
        overlay: ExitHandler.Z_LAYERS.OVERLAY,
        dialog: ExitHandler.Z_LAYERS.DIALOG,
        critical: ExitHandler.Z_LAYERS.CRITICAL,
        highest: ExitHandler.Z_LAYERS.HIGHEST
      };
      
      // 获取基础值
      let baseValue = baseValues[type] || ExitHandler.Z_LAYERS.BASE;
      
      // 检查页面上的元素 z-index
      const elementsToCheck = [
        // B站播放器控件
        '.bilibili-player-video-control',
        '.bpx-player-control-wrap',
        // 顶部导航栏
        '#biliMainHeader',
        '.bili-header',
        // 弹幕相关
        '.bilibili-player-video-danmaku',
        '.bpx-player-danmaku',
        // 对话框和弹出层
        '.bili-dialog',
        '.bili-modal',
        '.bili-popover',
        // 全屏控件
        '.bilibili-player-video-btn-fullscreen',
        '.bpx-player-ctrl-btn-fullscreen'
      ];
      
      // 收集页面上元素的 z-index 值
      let maxZIndex = 0;
      elementsToCheck.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el) {
            const style = window.getComputedStyle(el);
            const zIndex = parseInt(style.zIndex);
            if (!isNaN(zIndex) && zIndex > maxZIndex) {
              maxZIndex = zIndex;
            }
          }
        });
      });
      
      // 如果找到了较高的 z-index 值，确保我们的值适当地高于或低于它
      if (maxZIndex > 0) {
        console.log(`[专注模式] 检测到页面最高 z-index: ${maxZIndex}`);
        
        // 根据类型确定相对位置
        switch (type) {
          case 'critical':
          case 'highest':
            // 关键层级应该高于检测到的最大值
            return maxZIndex + 5;
          case 'dialog':
            // 对话框层级应该适当高于检测到的最大值
            return maxZIndex + 3;
          case 'overlay':
            // 遮罩层应该略高于检测到的最大值
            return maxZIndex + 2;
          case 'base':
          default:
            // 基础层级应该略高于检测到的最大值
            return maxZIndex + 1;
        }
      }
      
      // 如果没有检测到较高的 z-index，使用我们的基础值
      return baseValue;
    } catch (err) {
      console.error('[专注模式] 计算最佳 z-index 失败:', err);
      // 出错时返回默认值
      const fallbackValues = {
        base: 10,
        overlay: 30,
        dialog: 40,
        critical: 50,
        highest: 60
      };
      return fallbackValues[type] || 40;
    }
  }
  
  /**
   * 监测DOM变化并修复UI元素
   * @param {HTMLElement} targetElement - 要监测的元素
   * @param {Function} recoveryFunction - 修复函数，在元素被移除时调用
   * @returns {MutationObserver} 创建的MutationObserver实例
   */
  monitorDOMChanges(targetElement, recoveryFunction) {
    if (!targetElement || typeof recoveryFunction !== 'function') {
      console.error('[专注模式] 无法监测DOM变化，参数无效');
      return null;
    }
    
    try {
      // 创建一个观察器实例
      const observer = new MutationObserver((mutations) => {
        // 检查目标元素是否被移除
        let wasRemoved = false;
        let needsStyleFix = false;
        
        for (const mutation of mutations) {
          // 检查节点移除
          if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
            for (const removedNode of mutation.removedNodes) {
              // 检查移除的是否为目标元素或其父元素
              if (removedNode === targetElement || 
                  (removedNode.contains && removedNode.contains(targetElement))) {
                wasRemoved = true;
                break;
              }
            }
          }
          
          // 检查样式变化
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'style' && 
              mutation.target === targetElement) {
            const style = window.getComputedStyle(targetElement);
            // 检查关键样式属性是否被修改
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0' || 
                parseInt(style.zIndex, 10) < 10) {
              needsStyleFix = true;
            }
          }
          
          if (wasRemoved || needsStyleFix) break;
        }
        
        // 如果元素被移除或样式被破坏，调用恢复函数
        if (wasRemoved || needsStyleFix) {
          console.log(`[专注模式] 检测到UI元素${wasRemoved ? '被移除' : '样式被破坏'}，尝试恢复`);
          // 停止观察以避免在恢复过程中触发更多事件
          observer.disconnect();
          // 调用恢复函数
          recoveryFunction(wasRemoved, needsStyleFix);
        }
      });
      
      // 配置观察选项
      const config = { 
        childList: true,       // 观察子节点添加或删除
        attributes: true,      // 观察属性变化
        attributeFilter: ['style', 'class'], // 只关注样式和类变化
        subtree: true,         // 观察所有后代节点
        characterData: false   // 不观察文本内容变化
      };
      
      // 开始观察目标元素的父节点
      if (targetElement.parentNode) {
        observer.observe(targetElement.parentNode, config);
      } else {
        // 如果没有父节点，观察document.body
        observer.observe(document.body, config);
      }
      
      // 返回观察器实例，以便稍后可以停止观察
      return observer;
    } catch (err) {
      console.error('[专注模式] 监测DOM变化失败:', err);
      return null;
    }
  }
  
  /**
   * 验证UI元素可见性
   * @param {HTMLElement} element - 要验证的元素
   * @returns {boolean} 元素是否可见且正常显示
   */
  verifyUIVisibility(element) {
    if (!element || !document.body.contains(element)) {
      return false;
    }
    
    try {
      const style = window.getComputedStyle(element);
      // 检查元素是否可见
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' && 
             parseInt(style.zIndex, 10) > 0;
    } catch (err) {
      console.error('[专注模式] 验证UI元素可见性失败:', err);
      return false;
    }
  }
  
  /**
   * 恢复丢失的UI元素
   * @param {HTMLElement} container - 容器元素
   * @param {HTMLElement} element - 要恢复的元素
   * @param {Function} recreateFunction - 重新创建元素的函数
   */
  recoverUIElement(container, element, recreateFunction) {
    try {
      // 检查元素是否存在且在DOM树中
      const needsRecreation = !element || !document.body.contains(element);
      
      if (needsRecreation && typeof recreateFunction === 'function') {
        console.log('[专注模式] 重新创建UI元素');
        // 调用重新创建函数
        recreateFunction();
      } else if (element) {
        // 如果元素存在但可能样式被破坏，修复样式
        console.log('[专注模式] 修复UI元素样式');
        this.ensureFullscreenDialogStyles();
        
        // 确保元素可见
        element.style.display = '';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        
        // 如果有容器元素，确保元素在容器中
        if (container && !container.contains(element)) {
          container.appendChild(element);
        }
      }
    } catch (err) {
      console.error('[专注模式] 恢复UI元素失败:', err);
    }
  }
  
  /**
   * 处理退出流程
   * @returns {Promise<boolean>} 退出是否被批准
   */
  async handleExit() {
    try {
      // 检查是否在短时间内多次请求退出
      const now = Date.now();
      if (now - this.lastExitAttemptTime < 1000) {
        console.log('[专注模式] 检测到频繁退出请求，忽略');
        return false;
      }
      this.lastExitAttemptTime = now;
      this.exitAttempts++;
      
      // 如果已经在处理退出请求，不重复处理
      if (this.exitRequested) {
        console.log('[专注模式] 已有退出请求正在处理中');
        return false;
      }
      
      // 标记正在处理退出请求
      this.exitRequested = true;
      console.log('[专注模式] 开始处理退出请求');
      
      // 获取退出密码设置
      const needPassword = await this.settingsManager.getSetting('exitPasswordEnabled');
      
      // 如果设置了退出密码，显示密码验证对话框
      if (needPassword) {
        console.log('[专注模式] 需要密码验证才能退出');
        const passwordVerified = await this.showPasswordVerification();
        
        // 重置退出请求标记
        this.exitRequested = false;
        
        if (!passwordVerified) {
          console.log('[专注模式] 密码验证失败，拒绝退出');
          return false;
        }
        
        console.log('[专注模式] 密码验证成功，允许退出');
        return true;
      } else {
        // 没有设置退出密码，显示确认对话框
        console.log('[专注模式] 无需密码验证，显示退出确认');
        
        // 创建局部覆盖层
        const overlay = this.createPartialOverlay({
          width: 450,
          height: 'auto',
          position: 'player',
          eventPassthrough: true
        });
        
        // 创建确认对话框
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'focus-exit-dialog';
        
        // 设置对话框内容
        confirmDialog.innerHTML = `
          <h3 style="font-size: 20px; margin-bottom: 15px; color: var(--focus-primary); text-align: center; font-weight: bold;">退出确认</h3>
          
          <div class="dialog-message" style="font-size: 16px; margin: 20px 0; text-align: center; color: var(--focus-text);">
            确定要退出专注模式吗？
          </div>
          
          <div class="dialog-buttons" style="display: flex; justify-content: space-between; margin-top: 20px;">
            <button id="cancel-exit-btn" class="dialog-button secondary" style="padding: 8px 20px; border-radius: 4px; border: 1px solid #ddd; background: #f4f4f4; color: #666; cursor: pointer; font-size: 14px;">继续学习</button>
            <button id="confirm-exit-btn" class="dialog-button primary" style="padding: 8px 20px; border-radius: 4px; border: none; background: var(--focus-primary); color: white; cursor: pointer; font-size: 14px; font-weight: bold;">确认退出</button>
          </div>
        `;
        
        // 添加对话框到覆盖层
        overlay.appendChild(confirmDialog);
        
        // 安全定位对话框，避免覆盖重要控件
        this.positionDialogSafely(confirmDialog, overlay);
        
        // 设置ESC键处理
        this.preventEscape(true);
        
        // 监测DOM变化，确保对话框不会被移除
        const observer = this.monitorDOMChanges(confirmDialog, (wasRemoved, needsStyleFix) => {
          if (wasRemoved || needsStyleFix) {
            console.log('[专注模式] 退出确认对话框被干扰，尝试恢复');
            this.recoverUIElement(overlay, confirmDialog);
          }
        });
        
        // 等待用户确认
        return new Promise((resolve) => {
          // 取消按钮点击事件
          const cancelBtn = confirmDialog.querySelector('#cancel-exit-btn');
          if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
              // 停止DOM监测
              if (observer) observer.disconnect();
              
              // 移除覆盖层和对话框
              if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
              
              // 解除ESC键处理
              this.preventEscape(false);
              
              // 重置退出请求标记
              this.exitRequested = false;
              
              // 拒绝退出
              resolve(false);
            });
          }
          
          // 确认按钮点击事件
          const confirmBtn = confirmDialog.querySelector('#confirm-exit-btn');
          if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
              // 禁用按钮防止重复点击
              confirmBtn.disabled = true;
              
              // 显示退出进度
              try {
                // 不移除覆盖层，而是在其中显示退出进度
                await this.showExitProgress(overlay);
                
                // 停止DOM监测
                if (observer) observer.disconnect();
                
                // 解除ESC键处理
                this.preventEscape(false);
                
                // 重置退出请求标记
                this.exitRequested = false;
                
                // 批准退出
                resolve(true);
              } catch (err) {
                console.error('[专注模式] 退出进度显示失败:', err);
                
                // 移除覆盖层和对话框
                if (overlay && overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
                }
                
                // 解除ESC键处理
                this.preventEscape(false);
                
                // 重置退出请求标记
                this.exitRequested = false;
                
                // 出错时也允许退出
                resolve(true);
              }
            });
          }
          
          // 添加ESC键支持
          confirmDialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              e.preventDefault(); // 阻止默认行为
              if (cancelBtn) cancelBtn.click(); // 模拟点击取消按钮
            }
          });
        });
      }
    } catch (err) {
      console.error('[专注模式] 处理退出请求失败:', err);
      this.exitRequested = false;
      return false;
    }
  }
  
  /**
   * 处理ESC键退出全屏的行为
   * 优化后的版本只在必要时拦截ESC键，减少对其他功能的干扰
   * @param {boolean} enable - 是否启用ESC键处理
   */
  preventEscape(enable = true) {
    // 移除可能存在的监听器
    if (this.preventEscapeHandler) {
      document.removeEventListener('keydown', this.preventEscapeHandler, true);
      document.removeEventListener('keydown', this.preventEscapeHandler, false);
      this.preventEscapeHandler = null;
    }
    
    // 添加新的监听器
    if (enable) {
      // 创建一个更智能的事件处理器
      this.preventEscapeHandler = (e) => {
        // 只关注ESC键
        if (e.key === 'Escape') {
          // 检查当前是否有对话框处于活动状态
          const hasActiveDialog = !!document.querySelector('.focus-exit-dialog') || 
                                  !!document.querySelector('.top-level-exit-overlay') ||
                                  !!document.querySelector('.partial-exit-overlay') ||
                                  this.reminderDialogActive;
          
          // 只有在有对话框活动时才阻止事件传播
          if (hasActiveDialog) {
            // 仅在对话框活动时阻止默认行为
            e.preventDefault();
            console.log('[专注模式] 处理ESC键 (对话框活动中)');
            return;
          } 
          
          // 如果没有对话框活动，检查是否处于退出流程中
          const isExitInProgress = window.focusMode && 
                                   window.focusMode.fullscreenState && 
                                   window.focusMode.fullscreenState.exitInProgress;
          
          if (isExitInProgress) {
            // 如果正在退出，记录但不阻止事件
            console.log('[专注模式] 检测到ESC键 (退出流程中)');
            return;
          }
          
          // 否则，允许ESC键正常工作，但触发我们的退出流程
          console.log('[专注模式] 检测到ESC键，触发退出流程');
          // 不阻止默认行为，但开始我们的退出流程
          setTimeout(() => this.handleExit(), 0);
        }
      };
      
      // 使用冒泡阶段监听，不阻止事件传播
      document.addEventListener('keydown', this.preventEscapeHandler, false);
    }
  }
  
  /**
   * 显示下一条提醒语
   * @returns {Promise<boolean>} 用户是否批准了退出
   */
  async showNextReminder(reminders) {
    // 防空判断
    if (!reminders || reminders.length === 0) {
      reminders = ['请专注学习，不要分心'];
    }
    
    // 标记对话框活动状态
    this.reminderDialogActive = true;
    console.log('[专注模式] 提示语对话框活动状态设置为：', this.reminderDialogActive);
    
    if (this.currentReminderIndex >= reminders.length) {
      // 所有提醒语已确认，显示密码验证
      this.preventEscape(true); // 确保ESC按键被阻止
      
      // 确保清理现有对话框
      if (this.reminderBackground) {
        UIUtils.closeDialog(this.reminderBackground);
        this.reminderDialog = null;
        this.reminderBackground = null;
      }
      
      // 重置对话框活动状态
      this.reminderDialogActive = false;
      console.log('[专注模式] 提示语显示完成，活动状态重置为：', this.reminderDialogActive);
      
      return await this.showPasswordVerification();
    }
    
    return new Promise((resolve) => {
      // 更新提示语内容和进度的函数
      const updateReminderContent = () => {
        // 准备对话框内容
        const contentHtml = `
          <div class="dialog-message reminder-content">
            ${reminders[this.currentReminderIndex]}
          </div>
          <div class="reminder-progress">
            <div class="progress-text">提示 ${this.currentReminderIndex + 1}/${reminders.length}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(this.currentReminderIndex + 1) / reminders.length * 100}%"></div>
            </div>
          </div>
        `;
        
        return contentHtml;
      };
      
      // 处理返回学习按钮点击
      const handleCancelClick = (e, dialog, background) => {
        // 关闭对话框前重置状态
        this.reminderDialogActive = false;
        console.log('[专注模式] 用户选择返回学习，活动状态重置为：', this.reminderDialogActive);
        
        UIUtils.closeDialog(background);
        this.reminderDialog = null;
        this.reminderBackground = null;
        
        // 取消退出，恢复全屏
        this.preventEscape(false); // 取消时移除ESC拦截
        resolve(false); // 不批准退出
      };
      
      // 处理确认按钮点击
      const handleConfirmClick = (e, dialog, background) => {
        // 增加索引
        this.currentReminderIndex++;
        
        if (this.currentReminderIndex >= reminders.length) {
          // 如果已经是最后一个提示语，关闭对话框并进入密码验证
          UIUtils.closeDialog(background);
          this.reminderDialog = null;
          this.reminderBackground = null;
          
          // 递归调用将进入密码验证
          this.showNextReminder(reminders).then(resolve);
        } else {
          // 否则更新当前对话框内容而不关闭
          console.log('[专注模式] 更新提示语内容到下一条');
          
          // 更平滑地更新对话框内容
          const contentContainer = dialog.querySelector('.dialog-content');
          if (contentContainer) {
            // 先淡出内容
            contentContainer.style.opacity = '0';
            contentContainer.style.transition = 'opacity 0.15s ease';
          
            // 等待淡出完成后更新内容并淡入
          setTimeout(() => {
              contentContainer.innerHTML = updateReminderContent();
              // 强制回流
              contentContainer.offsetHeight;
              contentContainer.style.opacity = '1';
            }, 160);
          }
        }
      };
      
      // 如果已经有对话框，更新内容
      if (this.reminderDialog && this.reminderBackground) {
        console.log('[专注模式] 使用现有对话框更新提示语内容');
        
        // 更新对话框内容
        const contentContainer = this.reminderDialog.querySelector('.dialog-content');
        if (contentContainer) {
          contentContainer.innerHTML = updateReminderContent();
        }
        
        // 确保事件处理器已绑定
        const confirmButton = this.reminderDialog.querySelector('.dialog-button.primary');
        const cancelButton = this.reminderDialog.querySelector('.dialog-button.secondary');
        
        if (confirmButton) {
          confirmButton.onclick = (e) => handleConfirmClick(e, this.reminderDialog, this.reminderBackground);
        }
        
        if (cancelButton) {
          cancelButton.onclick = (e) => handleCancelClick(e, this.reminderDialog, this.reminderBackground);
        }
      } else {
        // 创建新对话框
        console.log('[专注模式] 创建新的提示语对话框');
        
        const { dialog, background } = UIUtils.createDialog({
          title: 'Attention is all you need',
          content: updateReminderContent(),
          buttons: [
            {
              text: '返回学习',
              type: 'secondary',
              onClick: handleCancelClick
            },
            {
              text: '确认',
              type: 'primary',
              onClick: handleConfirmClick
            }
          ],
          className: ExitHandler.DIALOG_CLASS
        });
        
        // 保存对话框引用
        this.reminderDialog = dialog;
        this.reminderBackground = background;
        
        // 设置自定义样式，确保对话框在全屏模式下正确显示
        this.ensureFullscreenDialogStyles();
        
        // 添加动画过渡样式
        const style = document.createElement('style');
        style.textContent = `
          .reminder-update {
            animation: reminder-pulse 0.3s ease;
          }
          
          @keyframes reminder-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.03); }
            100% { transform: scale(1); }
          }
        `;
        document.head.appendChild(style);
        
        // 添加自定义类以确保正确显示
        if (background) {
          background.classList.add('fullscreen-overlay');
        }
        
        // 阻止ESC键关闭对话框
        dialog.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      }
    });
  }
  
  /**
   * 确保全屏对话框样式已添加
   */
  ensureFullscreenDialogStyles() {
    // 由于样式已在 initializeStyles 中集中管理，这里只需确保样式已初始化
    if (!document.getElementById('exit-handler-styles')) {
      this.initializeStyles();
    }
  }
  
  /**
   * 显示密码验证对话框
   * @returns {Promise<boolean>} 密码验证是否通过
   */
  async showPasswordVerification() {
    // 确保样式已初始化
    this.ensureFullscreenDialogStyles();
    
    // 验证密码的最大尝试次数
    const maxPasswordAttempts = 3;
    let passwordAttempts = 0;
    
    return new Promise((resolve) => {
      // 创建局部覆盖层，而非全屏覆盖
      const overlay = this.createPartialOverlay({
        width: 500,
        height: 'auto',
        position: 'player', // 尝试避开播放器控件
        eventPassthrough: true
      });
      
      // 创建密码验证对话框
      const passwordDialog = document.createElement('div');
      passwordDialog.className = 'focus-exit-dialog';
      
      // 设置对话框内容
      passwordDialog.innerHTML = `
        <h3 style="font-size: 20px; margin-bottom: 20px; color: var(--focus-primary, #00a1d6); text-align: center; font-weight: bold;">验证密码</h3>
        
        <div class="verify-icon" style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 40px; color: var(--focus-primary, #00a1d6); margin: 0 auto;">🔐</div>
        </div>
        
        <div class="dialog-form-group">
          <label style="font-size: 16px; margin-bottom: 8px; display: block; color: var(--focus-text, #333);">请输入密码以退出专注模式：</label>
          <input type="password" id="password-input" required placeholder="输入您的密码" style="width: 100%; padding: 10px 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; background: white; color: var(--focus-text, #333); margin-top: 8px; box-sizing: border-box;">
        </div>
        
        <div id="password-error" class="dialog-message error" style="display: none; color: #f25d8e; margin-top: 10px; padding: 8px; background: rgba(242, 93, 142, 0.1); border-radius: 4px;">
          密码错误，请重新输入（剩余尝试次数：<span id="attempts-left">${maxPasswordAttempts}</span>）
        </div>
        
        <div class="dialog-note" style="margin-top: 15px; font-size: 13px; color: var(--focus-text-light, #666);">
          提示：输入正确的密码才能退出专注模式。点击"取消"即可快速返回全屏学习模式。
        </div>
        
        <div class="quick-return-tip" style="margin-top: 10px; text-align: center; padding: 10px; background: rgba(0, 161, 214, 0.1); border-radius: 6px; border: 1px solid rgba(0, 161, 214, 0.3);">
          <span style="color: var(--focus-primary, #00a1d6); font-weight: bold;">💡 快捷提示：</span> 点击"返回学习"立即恢复全屏专注模式
        </div>
        
        <div class="dialog-buttons" style="display: flex; justify-content: space-between; margin-top: 20px;">
          <button id="cancel-btn" class="dialog-button secondary" style="padding: 8px 20px; border-radius: 4px; border: 1px solid #ddd; background: #f4f4f4; color: #666; cursor: pointer; font-size: 14px;">返回学习</button>
          <button id="confirm-password-btn" class="dialog-button primary" style="padding: 8px 20px; border-radius: 4px; border: none; background: var(--focus-primary, #00a1d6); color: white; cursor: pointer; font-size: 14px; font-weight: bold;">确认</button>
        </div>
      `;
      
      // 将对话框添加到覆盖层
      overlay.appendChild(passwordDialog);
      
      // 安全定位对话框，避免覆盖重要控件
      this.positionDialogSafely(passwordDialog, overlay);
      
      // 设置按钮事件处理
      const cancelBtn = passwordDialog.querySelector('#cancel-btn');
      const confirmBtn = passwordDialog.querySelector('#confirm-password-btn');
      const passwordInput = passwordDialog.querySelector('#password-input');
      const errorElement = passwordDialog.querySelector('#password-error');
      const attemptsLeftElement = passwordDialog.querySelector('#attempts-left');
      
      // 取消按钮点击事件
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          // 移除覆盖层和对话框
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          this.preventEscape(false); // 取消时移除ESC拦截
          resolve(false); // 不批准退出
        });
      }
      
      // 确认按钮点击事件
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          // 禁用按钮防止重复点击
          confirmBtn.disabled = true;
          
          try {
            const password = passwordInput.value;
            
            // 确保密码验证函数可用
            if (typeof this.settingsManager.validatePassword !== 'function') {
              console.error('[专注模式] 密码验证函数不可用');
              this.showError('系统错误，无法验证密码');
              if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
              resolve(false);
              return;
            }
            
            // 验证密码
            const isValid = await this.settingsManager.validatePassword(password);
            
            if (isValid) {
              console.log('[专注模式] 密码验证成功，显示退出准备界面');
              
              // 不立即移除覆盖层，而是显示退出进度界面
              this.showExitProgress(overlay).then(exitResult => {
                // 退出进度完成后，通知外部处理
                resolve(exitResult);
              }).catch(err => {
                console.error('[专注模式] 退出进度显示错误:', err);
                if (overlay && overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
                }
                this.preventEscape(false);
                resolve(false);
              });
            } else {
              // 密码错误，增加尝试次数
              passwordAttempts++;
              const attemptsLeft = maxPasswordAttempts - passwordAttempts;
              
              // 显示错误消息
              if (errorElement) {
                errorElement.style.display = 'block';
                if (attemptsLeftElement) {
                  attemptsLeftElement.textContent = attemptsLeft;
                }
                
                // 3秒后隐藏错误消息
                setTimeout(() => {
                  if (errorElement.parentNode) {
                    errorElement.style.display = 'none';
                  }
                }, 3000);
              }
              
              // 如果达到最大尝试次数，关闭对话框并拒绝退出
              if (passwordAttempts >= maxPasswordAttempts) {
                console.log('[专注模式] 密码尝试次数已达上限，拒绝退出');
                if (overlay && overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
                }
                this.preventEscape(false);
                resolve(false);
                
                // 显示超过尝试次数的提示
                this.showError('密码尝试次数已达上限，请稍后再试');
                return;
              }
              
              // 清空密码输入
              passwordInput.value = '';
              passwordInput.focus();
              
              // 恢复按钮状态
              confirmBtn.disabled = false;
            }
          } catch (err) {
            console.error('[专注模式] 密码验证失败:', err);
            // 恢复按钮状态
            if (confirmBtn) confirmBtn.disabled = false;
            
            // 移除覆盖层
            if (overlay && overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
            
            resolve(false); // 验证过程出错，不批准退出
          }
        });
      }
      
      // 自动聚焦密码输入框
      setTimeout(() => {
        if (passwordInput) passwordInput.focus();
      }, 100);
      
      // 添加回车键支持
      passwordDialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (confirmBtn && !confirmBtn.disabled) {
            confirmBtn.click();
          }
        } else if (e.key === 'Escape') {
          // 阻止ESC键，但不传播
          e.preventDefault();
        }
      });
      
      // 设置ESC键处理
      this.preventEscape(true);
      
      // 监测DOM变化，确保对话框不会被移除
      const observer = this.monitorDOMChanges(passwordDialog, (wasRemoved, needsStyleFix) => {
        if (wasRemoved) {
          // 如果对话框被移除，重新创建
          console.log('[专注模式] 密码对话框被意外移除，重新创建');
          this.showPasswordVerification().then(resolve);
        } else if (needsStyleFix) {
          // 如果只是样式问题，修复样式
          console.log('[专注模式] 修复密码对话框样式');
          this.recoverUIElement(overlay, passwordDialog, () => {
            this.showPasswordVerification().then(resolve);
          });
        }
      });
    });
  }
  
  /**
   * 添加强力覆盖样式，确保对话框显示在最上层
   */
  addStrongOverlayStyles() {
    // 由于样式已在 initializeStyles 中集中管理，这里只需确保样式已初始化
    if (!document.getElementById('exit-handler-styles')) {
      this.initializeStyles();
    }
  }
  
  /**
   * 显示错误提示
   */
  showError(message) {
    // 确保样式已初始化
    this.ensureFullscreenDialogStyles();
    
    const { dialog, background } = UIUtils.createDialog({
      title: '错误',
      content: `
        <div class="dialog-message error">
          ${message}
        </div>
      `,
      buttons: [
        {
          text: '确定',
          type: 'primary',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            this.preventEscape(false); // 关闭错误提示时移除ESC拦截
          }
        }
      ],
      className: ExitHandler.DIALOG_CLASS
    });
  }
  
  /**
   * 显示退出准备进度界面
   * @param {HTMLElement} container - 容器元素，可以是局部覆盖层
   * @returns {Promise<boolean>} 退出是否成功
   */
  async showExitProgress(container) {
    return new Promise((resolve) => {
      // 确保样式已初始化
      this.ensureFullscreenDialogStyles();
      
      // 创建退出进度对话框
      const exitProgressDialog = document.createElement('div');
      exitProgressDialog.className = 'focus-exit-dialog exit-progress-dialog';
      
      // 设置对话框内容
      exitProgressDialog.innerHTML = `
        <div class="exit-progress-content" style="padding: 20px; text-align: center;">
          <h3 style="font-size: 20px; margin-bottom: 20px; color: var(--focus-primary); font-weight: bold;">正在准备退出专注模式</h3>
          
          <div class="exit-message" style="margin-bottom: 20px; font-size: 16px; color: #eee;">
            请稍候，正在保存您的学习进度...
          </div>
          
          <div class="progress-container" style="background: rgba(255, 255, 255, 0.1); height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0 20px;">
            <div class="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--focus-primary), #00c4ff); transition: width 3s ease;"></div>
          </div>
          
          <div class="exit-status" style="font-size: 14px; color: #ccc;">
            正在完成退出前准备...
          </div>
        </div>
      `;
      
      // 确保容器存在
      let overlay = container;
      if (!overlay) {
        // 如果没有提供容器，创建一个局部覆盖层
        overlay = this.createPartialOverlay({
          width: 450,
          height: 'auto',
          position: 'player',
          eventPassthrough: true
        });
      } else {
        // 清空现有容器
        while (overlay.firstChild) {
          overlay.removeChild(overlay.firstChild);
        }
      }
      
      // 将进度对话框添加到容器
      overlay.appendChild(exitProgressDialog);
      
      // 安全定位对话框，避免覆盖重要控件
      this.positionDialogSafely(exitProgressDialog, overlay);
      
      // 设置ESC键处理
      this.preventEscape(true);
      
      // 获取进度条元素
      const progressBar = exitProgressDialog.querySelector('.progress-bar');
      const exitStatus = exitProgressDialog.querySelector('.exit-status');
      
      // 启动进度动画
      setTimeout(() => {
        progressBar.style.width = '100%';
      }, 100);
      
      // 更新状态文本的消息
      const statusMessages = [
        { time: 500, text: '正在保存学习数据...' },
        { time: 1200, text: '正在检查退出条件...' },
        { time: 2000, text: '退出准备就绪，即将退出专注模式' }
      ];
      
      // 依次显示状态消息
      statusMessages.forEach(item => {
        setTimeout(() => {
          if (exitStatus) exitStatus.textContent = item.text;
        }, item.time);
      });
      
      // 监测DOM变化，确保进度对话框不会被移除
      const observer = this.monitorDOMChanges(exitProgressDialog, (wasRemoved, needsStyleFix) => {
        if (wasRemoved || needsStyleFix) {
          console.log('[专注模式] 退出进度对话框被干扰，尝试恢复');
          this.recoverUIElement(overlay, exitProgressDialog, () => {
            // 如果无法恢复，直接完成退出流程
            resolve(true);
          });
        }
      });
      
      // 3秒后完成退出流程
      setTimeout(() => {
        console.log('[专注模式] 延迟退出过程完成，现在允许退出');
        
        // 停止DOM监测
        if (observer) observer.disconnect();
        
        // 显示成功消息
        if (exitStatus) exitStatus.textContent = '退出条件已满足，正在退出...';
        if (exitStatus) exitStatus.style.color = '#00c4ff';
        
        // 解除ESC键阻止
        this.preventEscape(false);
        
        // 确保全局退出状态被正确设置
        if (window.focusMode && window.focusMode.fullscreenState) {
          window.focusMode.fullscreenState.exitApproved = true;
          window.focusMode.fullscreenState.exitInProgress = true;
          console.log('[专注模式] 退出进度完成，设置全局退出状态标记');
        }
        
        // 移除覆盖层和对话框
        setTimeout(() => {
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          
          // 退出已批准
          resolve(true);
        }, 500);
      }, 3000);
    });
  }
  
  /**
   * 显示退出过渡提示
   * 平滑过渡到宽屏模式并告知用户已屏蔽干扰内容
   */
  async showExitTransition() {
    try {
      // 避免重复显示
      if (this.exitTransitionActive) {
        return;
      }
      
      // 确保样式已初始化
      this.ensureFullscreenDialogStyles();
      
      this.exitTransitionActive = true;
      console.log('[专注模式] 显示退出过渡提示');
      
      // 创建局部覆盖层
      const transitionOverlay = this.createPartialOverlay({
        width: 450,
        height: 'auto',
        position: 'top',
        eventPassthrough: true
      });
      
      transitionOverlay.classList.add('exit-transition-overlay');
      transitionOverlay.classList.add('visible');
      
      // 设置内容
      const transitionContent = document.createElement('div');
      transitionContent.className = 'exit-transition-content';
      
      transitionContent.innerHTML = `
        <div class="exit-header">
          <h3>Attention is all you need</h3>
        </div>
        <div class="exit-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="M8 12h8"></path>
            <path d="M12 8v8"></path>
          </svg>
        </div>
        <div class="exit-title">已退出全屏模式</div>
        <div class="exit-description">
          <p>已切换为宽屏模式</p>
          <p>已屏蔽推荐视频、相关视频和广告</p>
          <p>您可以正常浏览评论区</p>
        </div>
        <div class="exit-progress-bar">
          <div class="exit-progress-fill"></div>
        </div>
        <div class="exit-confirm-button">
          <button class="confirm-btn">确认</button>
        </div>
      `;
      
      // 添加内容到覆盖层
      transitionOverlay.appendChild(transitionContent);
      
      // 安全定位对话框，避免覆盖重要控件
      this.positionDialogSafely(transitionContent, transitionOverlay);
      
      // 监测DOM变化，确保过渡提示不会被移除
      const observer = this.monitorDOMChanges(transitionOverlay, (wasRemoved, needsStyleFix) => {
        if (wasRemoved) {
          // 如果被移除，不再显示
          console.log('[专注模式] 退出过渡提示被移除，不再尝试恢复');
          this.exitTransitionActive = false;
        } else if (needsStyleFix) {
          // 如果只是样式问题，尝试修复
          console.log('[专注模式] 修复退出过渡提示样式');
          this.recoverUIElement(transitionOverlay, transitionContent);
        }
      });
      
      // 启动进度条动画
      const progressFill = transitionOverlay.querySelector('.exit-progress-fill');
      if (progressFill) {
        setTimeout(() => {
          progressFill.style.width = '100%';
        }, 100);
      }
      
      // 设置确认按钮事件
      const confirmBtn = transitionOverlay.querySelector('.confirm-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          // 添加淡出动画类
          transitionOverlay.classList.add('fade-out');
          
          // 动画结束后移除
          setTimeout(() => {
            if (transitionOverlay && transitionOverlay.parentNode) {
              transitionOverlay.parentNode.removeChild(transitionOverlay);
            }
            
            // 重置状态
            this.exitTransitionActive = false;
            
            // 停止DOM监测
            if (observer) observer.disconnect();
          }, 500);
        });
      }
      
      // 5秒后自动淡出
      setTimeout(() => {
        if (transitionOverlay && transitionOverlay.parentNode) {
          // 添加淡出动画类
          transitionOverlay.classList.add('fade-out');
          
          // 动画结束后移除
          setTimeout(() => {
            if (transitionOverlay && transitionOverlay.parentNode) {
              transitionOverlay.parentNode.removeChild(transitionOverlay);
            }
            
            // 重置状态
            this.exitTransitionActive = false;
            
            // 停止DOM监测
            if (observer) observer.disconnect();
          }, 500);
        }
      }, 5000);
    } catch (err) {
      console.error('[专注模式] 显示退出过渡提示失败:', err);
      this.exitTransitionActive = false;
    }
  }
  
  /**
   * 创建局部覆盖层，而非全屏覆盖
   * @param {Object} options - 配置选项
   * @param {number} [options.width] - 覆盖层宽度
   * @param {number} [options.height] - 覆盖层高度
   * @param {string} [options.position] - 位置 ('center', 'top', 'player')
   * @param {boolean} [options.eventPassthrough] - 是否允许事件透传
   * @returns {HTMLElement} 创建的覆盖层元素
   */
  createPartialOverlay(options = {}) {
    const {
      width = 500,
      height = 'auto',
      position = 'center',
      eventPassthrough = true
    } = options;
    
    // 创建覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'partial-exit-overlay';
    if (eventPassthrough) {
      overlay.classList.add('event-passthrough');
    }
    
    // 使用动态计算的 z-index
    const overlayZIndex = this.calculateOptimalZIndex('overlay');
    
    // 设置基本样式
    overlay.style.zIndex = overlayZIndex;
    overlay.style.width = typeof width === 'number' ? `${width}px` : width;
    overlay.style.height = typeof height === 'number' ? `${height}px` : height;
    
    // 根据位置设置定位
    switch (position) {
      case 'top':
        overlay.style.top = '10%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        break;
      case 'player':
        // 尝试检测播放器位置
        const playerControls = this.detectPlayerControls();
        if (playerControls) {
          // 如果找到播放器控件，避开它们
          overlay.style.top = `${playerControls.top - 20}px`;
          overlay.style.left = '50%';
          overlay.style.transform = 'translateX(-50%)';
        } else {
          // 默认放在中间偏上位置
          overlay.style.top = '30%';
          overlay.style.left = '50%';
          overlay.style.transform = 'translateX(-50%)';
        }
        break;
      case 'center':
      default:
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        break;
    }
    
    // 添加到页面
    document.body.appendChild(overlay);
    
    // 如果启用事件透传，设置相应处理
    if (eventPassthrough) {
      this.setupEventPassthrough(overlay);
    }
    
    return overlay;
  }
  
  /**
   * 检测B站播放器控件位置
   * @returns {Object|null} 播放器控件位置信息或null
   */
  detectPlayerControls() {
    try {
      // 尝试查找B站播放器控件
      const controlSelectors = [
        '.bilibili-player-video-control', // 标准播放器控件
        '.bpx-player-control-wrap',       // 新版播放器控件
        '.bilibili-player-video-bottom',  // 底部控制栏
        '.bpx-player-control-bottom'      // 新版底部控制栏
      ];
      
      for (const selector of controlSelectors) {
        const controlElement = document.querySelector(selector);
        if (controlElement) {
          const rect = controlElement.getBoundingClientRect();
          return {
            element: controlElement,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height
          };
        }
      }
      
      // 如果没有找到具体控件，尝试查找播放器本身
      const playerSelectors = [
        '.bilibili-player-video',         // 标准播放器
        '.bpx-player-video-area',         // 新版播放器
        'video'                           // 视频元素
      ];
      
      for (const selector of playerSelectors) {
        const playerElement = document.querySelector(selector);
        if (playerElement) {
          const rect = playerElement.getBoundingClientRect();
          // 假设控件在播放器底部
          return {
            element: playerElement,
            top: rect.bottom - 50, // 估计控件高度为50px
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: 50 // 估计值
          };
        }
      }
      
      return null;
    } catch (err) {
      console.error('[专注模式] 检测播放器控件失败:', err);
      return null;
    }
  }
  
  /**
   * 设置事件透传，允许鼠标事件透过覆盖层传递到底层元素
   * @param {HTMLElement} overlay - 覆盖层元素
   */
  setupEventPassthrough(overlay) {
    if (!overlay) return;
    
    // 监听鼠标事件，检查是否应该透传
    const mouseEvents = ['click', 'mousedown', 'mouseup', 'mousemove'];
    
    mouseEvents.forEach(eventType => {
      overlay.addEventListener(eventType, (e) => {
        // 检查点击的是否是对话框或按钮等交互元素
        let target = e.target;
        let isInteractive = false;
        
        // 向上遍历DOM树，检查是否点击了对话框或按钮
        while (target && target !== overlay) {
          if (target.classList.contains('focus-exit-dialog') || 
              target.classList.contains('dialog-button') ||
              target.classList.contains('confirm-btn') ||
              target.tagName === 'BUTTON' ||
              target.tagName === 'INPUT') {
            isInteractive = true;
            break;
          }
          target = target.parentElement;
        }
        
        // 如果点击的不是交互元素，透传事件
        if (!isInteractive) {
          // 获取当前位置下的底层元素
          const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
          
          // 找到第一个不是覆盖层或其子元素的元素
          const targetElement = elementsUnder.find(el => !overlay.contains(el) && el !== overlay);
          
          if (targetElement) {
            // 创建新的事件并触发
            const newEvent = new MouseEvent(eventType, {
              bubbles: true,
              cancelable: true,
              view: window,
              detail: e.detail,
              screenX: e.screenX,
              screenY: e.screenY,
              clientX: e.clientX,
              clientY: e.clientY,
              ctrlKey: e.ctrlKey,
              altKey: e.altKey,
              shiftKey: e.shiftKey,
              metaKey: e.metaKey,
              button: e.button,
              buttons: e.buttons,
              relatedTarget: e.relatedTarget
            });
            
            // 触发事件
            targetElement.dispatchEvent(newEvent);
            
            // 阻止原始事件
            e.preventDefault();
            e.stopPropagation();
          }
        }
      });
    });
  }
  
  /**
   * 安全定位对话框，避免覆盖重要控件
   * @param {HTMLElement} dialog - 对话框元素
   * @param {HTMLElement} container - 容器元素
   */
  positionDialogSafely(dialog, container) {
    if (!dialog || !container) return;
    
    try {
      // 检测播放器控件位置
      const playerControls = this.detectPlayerControls();
      
      if (playerControls) {
        // 确保对话框不会覆盖播放器控件
        const dialogRect = dialog.getBoundingClientRect();
        
        // 如果对话框底部与播放器控件重叠，向上移动对话框
        if (dialogRect.bottom > playerControls.top) {
          const overlap = dialogRect.bottom - playerControls.top;
          const newTop = Math.max(10, (parseInt(dialog.style.top) || 0) - overlap - 20);
          dialog.style.top = `${newTop}px`;
        }
      }
    } catch (err) {
      console.error('[专注模式] 安全定位对话框失败:', err);
    }
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof ExitHandler !== 'undefined' && !window.ExitHandler) window.ExitHandler = ExitHandler; 

/**
 * 确保样式只添加一次的辅助函数
 * 注意：此函数保留用于兼容性，新代码应使用 ExitHandler.initializeStyles
 */
function ensureStylesOnce(styleId, cssContent) {
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = cssContent;
  document.head.appendChild(style);
} 