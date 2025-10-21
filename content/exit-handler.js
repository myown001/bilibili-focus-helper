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
  }
  
  // 使用独立的对话框样式类名
  static DIALOG_CLASS = 'focus-exit-dialog';
  
  // 定义统一的 z-index 层级系统
  static Z_LAYERS = {
    BASE: 50,             // 基础层级
    OVERLAY: 100,         // 遮罩层
    DIALOG: 200,          // 对话框
    CRITICAL: 300,        // 关键操作对话框
    HIGHEST: 400          // 最高层级（用于特殊情况）
  };
  
  /**
   * 初始化样式 - CSS 已移至 exit-handler.css
   * 此方法已废弃，保留是为了向后兼容
   */
  initializeStyles() {
    // ✅ CSS 样式已完全移至 content/exit-handler.css
    // 不再需要在 JavaScript 中嵌入样式，遵循样式与逻辑分离原则
    // 保留此空方法是为了向后兼容，避免其他代码调用时出错
  }
  
  /**
   * 动态计算最佳的 z-index 值
   * @param {string} type - z-index 类型 ('overlay', 'dialog', 'critical')
   * @returns {number} 计算得到的 z-index 值
   */
  calculateOptimalZIndex(type = 'dialog') {
    try {
      // 获取页面上所有元素
      const allElements = document.querySelectorAll('*');
      let maxZIndex = 0;
      
      // 遍历所有元素，找出最大的 z-index 值
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex, 10);
        if (!isNaN(zIndex) && zIndex > maxZIndex) {
          maxZIndex = zIndex;
        }
      });
      
      // 使用更保守的B站UI z-index基础值
      const bilibiliUIZindex = 1000; // 降低基础值，避免覆盖B站控件
      
      // 获取播放器控件的z-index，确保我们的UI不会覆盖它们
      let playerControlZIndex = 0;
      const playerControls = document.querySelector('.bpx-player-control-wrap, .bilibili-player-video-control-wrap');
      if (playerControls) {
        const controlStyle = window.getComputedStyle(playerControls);
        playerControlZIndex = parseInt(controlStyle.zIndex, 10) || 0;
        console.log('[专注模式] 检测到播放器控件z-index:', playerControlZIndex);
      }
      
      // 特别处理视频页面，确保不干扰播放器控件
      const isVideoPage = document.querySelector('.bpx-player-container, #bilibili-player');
      
      // 根据类型返回合适的 z-index 值
      switch (type.toLowerCase()) {
        case 'overlay':
          // 遮罩层 z-index - 视频页面时避免覆盖播放器控件
          return isVideoPage 
            ? Math.max(maxZIndex + 50, ExitHandler.Z_LAYERS.OVERLAY)
            : Math.max(maxZIndex + 100, bilibiliUIZindex, ExitHandler.Z_LAYERS.OVERLAY);
        case 'critical':
          // 关键对话框 z-index - 保持较高但更合理的值
          return Math.max(maxZIndex + 150, bilibiliUIZindex + 50, ExitHandler.Z_LAYERS.CRITICAL);
        case 'highest':
          // 最高优先级 z-index
          return Math.max(maxZIndex + 200, bilibiliUIZindex + 100, ExitHandler.Z_LAYERS.HIGHEST);
        case 'dialog':
        default:
          // 普通对话框 z-index
          return Math.max(maxZIndex + 100, bilibiliUIZindex + 30, ExitHandler.Z_LAYERS.DIALOG);
      }
    } catch (err) {
      console.error('[专注模式] 计算 z-index 失败:', err);
      // 发生错误时返回默认值，使用更合理的值
      switch (type.toLowerCase()) {
        case 'overlay': return 900;
        case 'critical': return 1100;
        case 'highest': return 1200;
        case 'dialog':
        default: return 1000;
      }
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
   * 统一设置退出状态标记
   * @param {boolean} approved - 退出是否被批准
   * @param {boolean} inProgress - 退出是否正在进行中
   * @returns {boolean} 是否成功设置状态
   */
  setExitStates(approved, inProgress) {
    try {
      if (!window.focusMode || !window.focusMode.fullscreenState) {
        console.warn('[专注模式] 无法设置退出状态：focusMode或fullscreenState不存在');
        return false;
      }
      
      console.log(`[专注模式] 设置退出状态: approved=${approved}, inProgress=${inProgress}`);
      window.focusMode.fullscreenState.exitApproved = approved;
      window.focusMode.fullscreenState.exitInProgress = inProgress;
      
      // 如果状态为false，确保重置相关计时器
      if (!approved && !inProgress) {
        window.focusMode.fullscreenState.deactivateStartTime = 0;
        window.focusMode.fullscreenState.lastExitAttempt = 0;
      }
      
      return true;
    } catch (err) {
      console.error('[专注模式] 设置退出状态失败:', err);
      return false;
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
      
      this.exitRequested = true;
      console.log('[专注模式] 开始处理退出请求');
      
      // 确保设置管理器已初始化
      await this.settingsManager.initialize();
      
      // 获取设置
      const settings = await this.settingsManager.getSettings();
      
      // 检查密码设置是否有效
      if (!settings.password || settings.password.trim() === '') {
        console.log('[专注模式] 未设置密码，允许直接退出');
        this.exitRequested = false;
        return true;
      }
      
      // 设置ESC按键阻止，防止用户通过ESC退出全屏
      this.preventEscape(true);
      
      // 加强验证 - 检查提醒语是否有效并安全地获取用户设置的提醒语
      let reminders = settings.reminders;
      if (!Array.isArray(reminders) || reminders.length === 0) {
        console.log('[专注模式] 未找到有效的提醒语，使用默认提醒语');
        reminders = ['请专注学习，不要分心', '坚持才能成功', '学习需要专注'];
      } else {
        console.log('[专注模式] 成功加载用户设置的提醒语, 数量:', reminders.length);
      }
      
      // 开始显示提醒语
      this.currentReminderIndex = 0;
      console.log('[专注模式] 开始显示提醒语');
      const exitApproved = await this.showNextReminder(reminders);
      
      // 记录退出结果
      console.log('[专注模式] 退出验证结果:', exitApproved ? '批准' : '拒绝');
      
      // 重置状态
      this.exitRequested = false;
      this.reminderDialogActive = false; // 确保对话框活动状态被重置
      
      // 如果退出被批准，设置状态标记并显示退出过渡
      if (exitApproved) {
        // 使用统一方法设置状态
        this.setExitStates(true, true);
        console.log('[专注模式] 在ExitHandler中设置全局退出状态标记');
        
        // 显示退出过渡提示
        await this.showExitTransition();
        
        // ✅ 修复：删除重复调用 deactivate() 的代码
        // deactivate() 将由 approveAndExit() 统一调用，避免重复执行
        // 这样可以确保退出流程只执行一次，状态管理更清晰
        console.log('[专注模式] 退出过渡完成，等待approveAndExit调用deactivate');
      }
      
      return exitApproved;
    } catch (err) {
      console.error('[专注模式] 退出处理失败:', err);
      // 显示错误提示
      this.showError('退出失败，请重试');
      this.exitRequested = false;
      return false;
    }
  }
  
  /**
   * 处理ESC键退出全屏的行为
   * 优化后的版本只在必要时拦截ESC键，减少对其他功能的干扰
   * @param {boolean} enable - 是否启用ESC键拦截
   */
  preventEscape(enable = true) {
    // 移除可能存在的监听器
    if (this.preventEscapeHandler) {
      document.removeEventListener('keydown', this.preventEscapeHandler, true);
      this.preventEscapeHandler = null;
    }
    
    // 添加新的监听器
    if (enable) {
      // 创建一个更智能的事件处理器
      this.preventEscapeHandler = (e) => {
        // 只拦截ESC键
        if (e.key === 'Escape') {
          // 检查当前是否有对话框处于活动状态
          const hasActiveDialog = !!document.querySelector('.focus-exit-dialog') || 
                                  !!document.querySelector('.focus-dialog-overlay') ||
                                  this.reminderDialogActive;
          
          // 只有在有对话框活动时才阻止事件传播
          if (hasActiveDialog) {
          e.preventDefault();
          e.stopPropagation();
            console.log('[专注模式] 阻止ESC键退出全屏 (对话框活动中)');
          } else {
            // 如果没有对话框活动，检查是否处于退出流程中
            const isExitInProgress = window.focusMode && 
                                     window.focusMode.fullscreenState && 
                                     window.focusMode.fullscreenState.exitInProgress;
            
            if (isExitInProgress) {
              // 如果正在退出，仍然阻止ESC键
              e.preventDefault();
              e.stopPropagation();
              console.log('[专注模式] 阻止ESC键退出全屏 (退出流程中)');
            } else {
              // 否则，允许ESC键正常工作，但触发我们的退出流程
              console.log('[专注模式] 检测到ESC键，触发退出流程');
              // 不阻止默认行为，但开始我们的退出流程
              this.handleExit();
            }
          }
        }
      };
      
      // 使用捕获阶段监听，但不阻止事件继续传播
      document.addEventListener('keydown', this.preventEscapeHandler, true);
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
        this.closeDialog(this.reminderBackground);
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
        // 获取当前提示语
        const currentReminder = reminders[this.currentReminderIndex];
        
        // 根据字数添加不同的CSS类
        let textLengthClass = '';
        const textLength = currentReminder.length;
        
        if (textLength <= 15) {
          textLengthClass = 'short-text';
        } else if (textLength <= 40) {
          textLengthClass = 'medium-text';
        } else if (textLength <= 80) {
          textLengthClass = 'long-text';
        } else {
          textLengthClass = 'extra-long-text';
        }
        
        // 准备对话框内容
        const contentHtml = `
          <div class="dialog-message reminder-content ${textLengthClass}">
            ${currentReminder}
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
        // 防止重复点击
        if (e && e.target && e.target.disabled) return;
        if (e && e.target) e.target.disabled = true;
        
        console.log('[专注模式] 用户选择返回学习');
        
        // 关闭对话框前重置状态
        this.reminderDialogActive = false;
        console.log('[专注模式] 活动状态重置为：', this.reminderDialogActive);
        
        this.closeDialog(background);
        this.reminderDialog = null;
        this.reminderBackground = null;
        
        // 取消退出，恢复全屏
        this.preventEscape(false); // 取消时移除ESC拦截
        resolve(false); // 不批准退出
      };
      
      // 处理确认按钮点击
      const handleConfirmClick = (e, dialog, background) => {
        // 防止重复点击
        if (e && e.target && e.target.disabled) return;
        if (e && e.target) {
          e.target.disabled = true;
          const originalText = e.target.textContent;
          e.target.textContent = '处理中...';
          e.target.style.opacity = '0.7';
          
          // 延迟恢复按钮状态（如果需要）
          setTimeout(() => {
            if (e.target && e.target.parentNode) {
              this.restoreButtonState(e.target, originalText);
            }
          }, 1000);
        }
        
        console.log('[专注模式] 用户确认提示语，进入下一条');
        
        // 增加索引
        this.currentReminderIndex++;
        
        if (this.currentReminderIndex >= reminders.length) {
          // 如果已经是最后一个提示语，关闭对话框并进入密码验证
          this.closeDialog(background);
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
              if (contentContainer.parentNode) { // 检查元素仍然存在
                contentContainer.innerHTML = updateReminderContent();
                // 强制回流
                contentContainer.offsetHeight;
                contentContainer.style.opacity = '1';
              }
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
          // 🔧 修复：确保按钮可交互
          this.ensureButtonInteractive(confirmButton);
          confirmButton.onclick = (e) => handleConfirmClick(e, this.reminderDialog, this.reminderBackground);
        }
        
        if (cancelButton) {
          // 🔧 修复：确保按钮可交互
          this.ensureButtonInteractive(cancelButton);
          cancelButton.onclick = (e) => handleCancelClick(e, this.reminderDialog, this.reminderBackground);
        }
      } else {
        // 创建新对话框
        console.log('[专注模式] 创建新的提示语对话框');
        
        const { dialog, overlay } = this.createCenteredDialog(
          'Attention is all you need',
          updateReminderContent(),
          [
            {
              text: '返回学习',
              type: 'secondary',
              onClick: (e, dialog, background) => handleCancelClick(e, dialog, background)
            },
            {
              text: '确认',
              type: 'primary',
              onClick: (e, dialog, background) => handleConfirmClick(e, dialog, background)
            }
          ]
        );
        
        // 保存对话框引用
        this.reminderDialog = dialog;
        this.reminderBackground = overlay;
        
        // 🔧 修复：确保新创建的按钮可交互
        setTimeout(() => {
          const buttons = dialog.querySelectorAll('.dialog-button');
          buttons.forEach(btn => this.ensureButtonInteractive(btn));
          console.log('[专注模式] 已确保所有按钮可交互');
        }, 50);
        
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
    
    // 🔧 改进：密码尝试机制
    const maxPasswordAttempts = 3;
    const cooldownTime = 30000; // 30秒冷却时间
    let passwordAttempts = 0;
    
    // 检查是否在冷却期间
    const lastFailTime = sessionStorage.getItem('focus_password_fail_time');
    if (lastFailTime) {
      const timeSinceLastFail = Date.now() - parseInt(lastFailTime);
      if (timeSinceLastFail < cooldownTime) {
        const remainingTime = Math.ceil((cooldownTime - timeSinceLastFail) / 1000);
        this.showError(`密码验证失败次数过多，请等待 ${remainingTime} 秒后再试`);
        return false;
      } else {
        // 冷却时间已过，清除记录
        sessionStorage.removeItem('focus_password_fail_time');
      }
    }
    
    return new Promise((resolve) => {
      // 创建顶层遮罩层，使用更适中的背景透明度
      const topOverlay = document.createElement('div');
      // ✅ 修复：使用正确的类名，并添加flexbox布局
      topOverlay.className = 'focus-dialog-overlay';
      // 使用动态计算的 z-index
      const overlayZIndex = this.calculateOptimalZIndex('critical');
      topOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.7);
        z-index: ${overlayZIndex};
      `;
      document.body.appendChild(topOverlay);
      topOverlay.classList.add('focus-dialog-visible');  // ✅ 正确的变量名
      // 创建密码验证对话框
      const passwordDialog = document.createElement('div');
      passwordDialog.className = 'focus-exit-dialog';
      // ✅ 所有样式已移至 exit-handler.css，不再需要内联样式
      
      // 设置对话框内容 - ✅ 所有样式已移至 exit-handler.css
      passwordDialog.innerHTML = `
        <h3>验证密码</h3>
        
        <div class="verify-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="#00a1d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="#00a1d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="16" r="1.5" fill="#00a1d6"/>
          </svg>
          </div>
        
        <div class="dialog-form-group">
          <label>请输入密码以退出专注模式：</label>
          <div>
            <input type="password" id="password-input" required placeholder="输入您的密码">
          </div>
          </div>
        
        <div id="password-error" class="dialog-message error" style="display: none;">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#f25d8e" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
          </svg>
            密码错误，请重新输入（剩余尝试次数：<span id="attempts-left">${maxPasswordAttempts}</span>）
          </div>
        
        <div class="dialog-note">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#666" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z"/>
          </svg>
          提示：输入正确的密码才能退出专注模式。点击"返回学习"即可快速返回全屏学习模式。
          </div>
        
        <div class="quick-return-tip">
          <span>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#00a1d6" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4h-3l4-7 4 7h-3v4h-2z"/>
            </svg>
            点击"返回学习"立即恢复全屏专注模式
          </span>
          </div>
        
        <div class="dialog-buttons">
          <button id="cancel-btn" class="dialog-button secondary">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            返回学习
          </button>
          <button id="confirm-password-btn" class="dialog-button primary">
            确认
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
          </button>
        </div>
      `;
      
      // 将对话框添加到遮罩层
      topOverlay.appendChild(passwordDialog);
      
      // 设置按钮事件处理
      const cancelBtn = passwordDialog.querySelector('#cancel-btn');
      const confirmBtn = passwordDialog.querySelector('#confirm-password-btn');
      const passwordInput = passwordDialog.querySelector('#password-input');
      const errorElement = passwordDialog.querySelector('#password-error');
      const attemptsLeftElement = passwordDialog.querySelector('#attempts-left');
      
      // 🔧 修复：确保按钮可交互
      if (cancelBtn) {
        this.ensureButtonInteractive(cancelBtn);
      }
      if (confirmBtn) {
        this.ensureButtonInteractive(confirmBtn);
      }
      
      // 取消按钮点击事件
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          // 移除遮罩层和对话框
              if (topOverlay && topOverlay.parentNode) {
                topOverlay.parentNode.removeChild(topOverlay);
              }
              this.preventEscape(false); // 取消时移除ESC拦截
              resolve(false); // 不批准退出
        });
      }
      
      // 确认按钮点击事件
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          // 防止重复点击并提供视觉反馈
          if (confirmBtn.disabled) return;
          
          confirmBtn.disabled = true;
          const originalText = confirmBtn.textContent;
          confirmBtn.textContent = '验证中...';
          confirmBtn.style.opacity = '0.7';
          
          try {
            const password = passwordInput.value;
            
            // 确保密码验证函数可用
            if (typeof this.settingsManager.validatePassword !== 'function') {
              console.error('[专注模式] 密码验证函数不可用');
              this.showError('系统错误，无法验证密码');
              if (topOverlay && topOverlay.parentNode) {
                topOverlay.parentNode.removeChild(topOverlay);
              }
              resolve(false);
              return;
            }
            
            // 验证密码
            const isValid = await this.settingsManager.validatePassword(password);
            
            if (isValid) {
              console.log('[专注模式] 密码验证成功，显示退出准备界面');
              
              // 🔧 改进：密码验证成功时清除冷却记录
              sessionStorage.removeItem('focus_password_fail_time');
              
              // 不立即移除遮罩层，而是显示退出进度界面
              this.showExitProgress(topOverlay).then(exitResult => {
                // 退出进度完成后，通知外部处理
                resolve(exitResult);
              }).catch(err => {
                console.error('[专注模式] 退出进度显示错误:', err);
                if (topOverlay && topOverlay.parentNode) {
                  topOverlay.parentNode.removeChild(topOverlay);
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
                  if (errorElement && errorElement.parentNode) {
                    errorElement.style.display = 'none';
                  }
                }, 3000);
              }
              
              // 如果达到最大尝试次数，启动冷却机制
              if (passwordAttempts >= maxPasswordAttempts) {
                console.log('[专注模式] 密码尝试次数已达上限，启动冷却机制');
                
                // 记录失败时间，启动冷却
                sessionStorage.setItem('focus_password_fail_time', Date.now().toString());
                
                if (topOverlay && topOverlay.parentNode) {
                  topOverlay.parentNode.removeChild(topOverlay);
                }
                this.preventEscape(false);
                resolve(false);
                
                // 显示冷却提示
                this.showError('密码尝试次数已达上限，请等待30秒后再试');
                return;
              }
              
              // 清空密码输入并聚焦
              passwordInput.value = '';
              setTimeout(() => {
                passwordInput.focus();
              }, 100);
              
              // 恢复按钮状态
              this.restoreButtonState(confirmBtn, originalText);
              // 🔧 修复：确保按钮恢复后仍可交互
              this.ensureButtonInteractive(confirmBtn);
            }
          } catch (err) {
            console.error('[专注模式] 密码验证失败:', err);
            
            // 恢复按钮状态
            this.restoreButtonState(confirmBtn, originalText);
            // 🔧 修复：确保按钮恢复后仍可交互
            this.ensureButtonInteractive(confirmBtn);
            
            // 移除遮罩层
            if (topOverlay && topOverlay.parentNode) {
              topOverlay.parentNode.removeChild(topOverlay);
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
          // 完全阻止ESC键
          e.preventDefault();
          e.stopPropagation();
        }
      });
      
      // 设置ESC键阻止
      this.preventEscape(true);
      
      // 🔧 修复：延迟验证按钮交互性
      setTimeout(() => {
        if (cancelBtn && !this.verifyButtonInteractive(cancelBtn)) {
          console.warn('[专注模式] 密码弹窗-取消按钮交互异常，尝试修复');
          this.ensureButtonInteractive(cancelBtn);
        }
        if (confirmBtn && !this.verifyButtonInteractive(confirmBtn)) {
          console.warn('[专注模式] 密码弹窗-确认按钮交互异常，尝试修复');
          this.ensureButtonInteractive(confirmBtn);
        }
      }, 100);
      
      // 监测DOM变化，确保对话框不会被移除
      const observer = this.monitorDOMChanges(passwordDialog, (wasRemoved, needsStyleFix) => {
        if (wasRemoved) {
          // 如果对话框被移除，重新创建
          console.log('[专注模式] 密码对话框被意外移除，重新创建');
          this.showPasswordVerification().then(resolve);
        } else if (needsStyleFix) {
          // 如果只是样式问题，修复样式
          console.log('[专注模式] 修复密码对话框样式');
          this.recoverUIElement(topOverlay, passwordDialog, () => {
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
   * 显示错误提示 - 美化版本
   */
  showError(message) {
    // 使用新的居中对话框方法创建错误提示
    const { dialog, overlay } = this.createCenteredDialog(
      '⚠️ 提示',
      `
      <div class="error-dialog-container">
        <div class="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#ff4757" stroke-width="2" fill="none"/>
            <path d="M12 8v4M12 16h.01" stroke="#ff4757" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="error-message">
          ${message}
        </div>
        ${message.includes('密码尝试次数') ? 
          `<div class="error-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
              <path fill="#666" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            为了账户安全，请等待30秒后再次尝试
          </div>` : ''
        }
      </div>
      
      <style>
        .error-dialog-container {
          text-align: center;
          padding: 20px 10px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .error-icon {
          margin-bottom: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .error-message {
          font-size: 16px;
          color: #333;
          line-height: 1.6;
          margin-bottom: 15px;
          font-weight: 500;
        }
        
        .error-hint {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 15px;
        }
        
        .error-hint svg {
          opacity: 0.7;
        }
      </style>`,
      [
        {
          text: '我知道了',
          type: 'primary',
          onClick: (e) => {
            this.closeDialog(overlay);
            this.preventEscape(false); // 关闭错误提示时移除ESC拦截
          }
        }
      ]
    );
    
    // 🔧 修复：确保错误弹窗按钮可交互
    setTimeout(() => {
      const confirmButton = dialog.querySelector('.dialog-button.primary');
      if (confirmButton) {
        this.ensureButtonInteractive(confirmButton);
        
        // 验证按钮状态
        if (!this.verifyButtonInteractive(confirmButton)) {
          console.warn('[专注模式] 错误弹窗按钮交互异常，尝试修复');
          this.ensureButtonInteractive(confirmButton);
        }
      }
    }, 100);
    
    // 添加自动聚焦和回车键支持
    setTimeout(() => {
      const confirmButton = dialog.querySelector('.dialog-button.primary');
      if (confirmButton) {
        confirmButton.focus();
        
        // 添加回车键支持
        const handleKeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            confirmButton.click();
            document.removeEventListener('keydown', handleKeydown);
          }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // 5秒后移除键盘监听器
        setTimeout(() => {
          document.removeEventListener('keydown', handleKeydown);
        }, 5000);
      }
    }, 200);
  }
  
  /**
   * 显示退出准备进度界面
   * @param {HTMLElement} topOverlay - 顶层遮罩元素
   * @returns {Promise<boolean>} 退出是否成功
   */
  async showExitProgress(topOverlay) {
    return new Promise((resolve) => {
      // 确保样式已初始化
      this.ensureFullscreenDialogStyles();
      
      // 创建退出进度对话框
      const exitProgressDialog = document.createElement('div');
      exitProgressDialog.className = 'focus-exit-dialog exit-progress-dialog';
      
      // 使用动态计算的 z-index
      const dialogZIndex = this.calculateOptimalZIndex('highest');
      exitProgressDialog.style.zIndex = dialogZIndex;
      
      // 设置对话框内容 - ✅ 所有样式已移至 exit-handler.css
      exitProgressDialog.innerHTML = `
        <div class="exit-progress-content">
          <h3>正在准备退出专注模式</h3>
          
          <div class="exit-message">
            请稍候，正在保存您的学习进度...
          </div>
          
          <div class="exit-progress-container">
            <div class="exit-progress-bar">
              <div class="exit-progress-fill"></div>
            </div>
          </div>
          
          <div class="exit-status">
            正在完成退出前准备...
          </div>
        </div>
      `;
      
      // 确保顶层遮罩存在
      if (!topOverlay) {
        topOverlay = document.createElement('div');
        // ✅ 修复：使用正确的类名和flexbox布局
        topOverlay.className = 'focus-dialog-overlay';
        
        // 使用动态计算的 z-index
        const overlayZIndex = this.calculateOptimalZIndex('critical');
        topOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.7);
          z-index: ${overlayZIndex};
        `;
        
        document.body.appendChild(topOverlay);
      }
      
      // 将进度对话框添加到遮罩层
      topOverlay.appendChild(exitProgressDialog);
      
      // 设置ESC键阻止
      this.preventEscape(true);
      
      // 获取进度条元素 - ✅ 使用正确的类名
      const progressBar = exitProgressDialog.querySelector('.exit-progress-fill');
      const exitStatus = exitProgressDialog.querySelector('.exit-status');
      
      // 启动进度动画
      setTimeout(() => {
        if (progressBar) {
        progressBar.style.width = '100%';
        }
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
          this.recoverUIElement(topOverlay, exitProgressDialog, () => {
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
        
        // 移除遮罩层和对话框
        setTimeout(() => {
          if (topOverlay && topOverlay.parentNode) {
            topOverlay.parentNode.removeChild(topOverlay);
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
      
      // 创建过渡层 - 使用统一的遮罩层类名
      const transitionOverlay = document.createElement('div');
      transitionOverlay.className = 'focus-dialog-overlay exit-transition-overlay';
      
      // 使用动态计算的 z-index
      const overlayZIndex = this.calculateOptimalZIndex('overlay');
      transitionOverlay.style.zIndex = overlayZIndex;
      
      // 添加flexbox居中样式（focus-dialog-overlay 已经有了，这里是确保）
      transitionOverlay.style.display = 'flex';
      transitionOverlay.style.justifyContent = 'center';
      transitionOverlay.style.alignItems = 'center';
      
      transitionOverlay.innerHTML = `
        <div class="exit-transition-content">
          <div class="exit-header">
            <h3>Attention is all you need</h3>
          </div>
          <div class="exit-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <button class="confirm-btn" id="exit-transition-confirm">确认</button>
          </div>
        </div>
      `;
      
      // 添加到页面
      document.body.appendChild(transitionOverlay);
      
      // 监测DOM变化，确保过渡提示不会被移除
      const observer = this.monitorDOMChanges(transitionOverlay, (wasRemoved, needsStyleFix) => {
        if (wasRemoved) {
          // 如果被移除，不再显示
          console.log('[专注模式] 退出过渡提示被移除，不再尝试恢复');
          this.exitTransitionActive = false;
        } else if (needsStyleFix) {
          // 如果只是样式问题，修复样式并重新绑定事件
          console.log('[专注模式] 修复退出过渡提示样式');
          transitionOverlay.style.zIndex = this.calculateOptimalZIndex('overlay');
          transitionOverlay.style.opacity = '1';
          transitionOverlay.style.visibility = 'visible';
          // 重新绑定按钮事件
          this.bindExitTransitionEvents(transitionOverlay, observer);
        }
      });
      
      // 等待一帧后再添加可见类，确保过渡效果正常
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          transitionOverlay.classList.add('focus-dialog-visible');
          
          // 进度条动画
          const progressFill = transitionOverlay.querySelector('.exit-progress-fill');
          if (progressFill) {
            progressFill.style.width = '100%';
          }
        });
      });
      
      // 绑定交互事件
      return this.bindExitTransitionEvents(transitionOverlay, observer);
      
    } catch (err) {
      console.error('[专注模式] 显示退出过渡提示失败:', err);
      this.exitTransitionActive = false;
    }
  }
  
  /**
   * 恢复按钮状态的辅助方法
   * 修复：确保按钮状态能够正确恢复，避免按钮卡在禁用状态
   */
  restoreButtonState(button, originalText, delay = 0) {
    if (!button) return;
    
    const restore = () => {
      try {
        button.disabled = false;
        button.textContent = originalText || '确认';
        button.style.opacity = '1';
        console.log('[专注模式] 按钮状态已恢复');
      } catch (err) {
        console.warn('[专注模式] 恢复按钮状态失败:', err);
      }
    };
    
    if (delay > 0) {
      setTimeout(restore, delay);
    } else {
      restore();
    }
  }
  
  /**
   * 绑定退出过渡对话框的事件处理器
   * 修复：避免重复绑定事件，提高交互可靠性
   */
  bindExitTransitionEvents(transitionOverlay, observer) {
    return new Promise((resolve) => {
      let isResolved = false; // 防止重复resolve
      
      const handleConfirmClick = () => {
        if (isResolved) return;
        isResolved = true;
        
        console.log('[专注模式] 用户确认退出过渡');
        
        // 停止DOM监测
        if (observer) observer.disconnect();
        
        // 添加淡出类，使用统一的类名系统
        transitionOverlay.classList.add('focus-dialog-fade-out');
        transitionOverlay.classList.remove('focus-dialog-visible');
        
        // 确保状态保持一致
        if (window.focusMode && window.focusMode.fullscreenState) {
          // 确保退出状态标记保持激活，直到deactivate完成
          this.setExitStates(true, true);
        }
        
        // 延迟后移除整个弹窗
        setTimeout(() => {
          if (transitionOverlay.parentNode) {
            transitionOverlay.parentNode.removeChild(transitionOverlay);
          }
          this.exitTransitionActive = false;
          resolve();
        }, 500);
      };
      
      const handleAutoHide = () => {
        if (isResolved) return;
        isResolved = true;
        
        console.log('[专注模式] 退出过渡自动隐藏');
        
        // 停止DOM监测
        if (observer) observer.disconnect();
        
        // 添加淡出类，使用统一的类名系统
        transitionOverlay.classList.add('focus-dialog-fade-out');
        transitionOverlay.classList.remove('focus-dialog-visible');
        
        // 确保状态保持一致
        if (window.focusMode && window.focusMode.fullscreenState) {
          // 确保退出状态标记保持激活，直到deactivate完成
          this.setExitStates(true, true);
        }
        
        setTimeout(() => {
          if (transitionOverlay.parentNode) {
            transitionOverlay.parentNode.removeChild(transitionOverlay);
          }
          this.exitTransitionActive = false;
          resolve();
        }, 500); // 等待淡出动画完成
      };
      
      // 获取确认按钮并添加点击事件（只绑定一次）
      const confirmButton = transitionOverlay.querySelector('#exit-transition-confirm');
      if (confirmButton) {
        // 🔧 修复：确保按钮处于可交互状态
        this.ensureButtonInteractive(confirmButton);
        
        // 移除可能存在的旧事件监听器
        const existingHandler = confirmButton._exitTransitionHandler;
        if (existingHandler) {
          confirmButton.removeEventListener('click', existingHandler);
        }
        
        // 绑定新的事件监听器
        confirmButton._exitTransitionHandler = handleConfirmClick;
        confirmButton.addEventListener('click', handleConfirmClick);
        
        // 添加视觉反馈
        confirmButton.addEventListener('mousedown', () => {
          confirmButton.style.transform = 'scale(0.95)';
        });
        
        confirmButton.addEventListener('mouseup', () => {
          confirmButton.style.transform = '';
        });
        
        console.log('[专注模式] 退出过渡按钮事件已绑定');
        
        // 🔧 修复：验证按钮可交互性
        setTimeout(() => {
          if (!this.verifyButtonInteractive(confirmButton)) {
            console.warn('[专注模式] 警告：按钮可能无法交互，尝试修复');
            this.ensureButtonInteractive(confirmButton);
          }
        }, 100);
      }
      
      // 自动隐藏定时器（5秒后）
      const autoHideTimer = setTimeout(handleAutoHide, 5000);
      
      // 如果手动确认，清除自动隐藏定时器
      if (confirmButton) {
        confirmButton.addEventListener('click', () => {
          clearTimeout(autoHideTimer);
        });
      }
    });
  }
  
  /**
   * 创建居中对话框 - 使用增强的UIUtils.createDialog
   * @param {string} title - 对话框标题
   * @param {string} content - 对话框内容HTML
   * @param {Array} buttons - 按钮配置数组
   * @returns {Object} 包含对话框和背景遮罩元素的对象
   */
  createCenteredDialog(title, content, buttons) {
    // 确保样式已初始化
    this.ensureFullscreenDialogStyles();
    
    // 计算最佳z-index
    const overlayZIndex = this.calculateOptimalZIndex('critical');
    
    // 转换按钮配置格式以兼容UIUtils.createDialog
    const uiUtilsButtons = buttons ? buttons.map((btn, index) => ({
      text: btn.text,
      type: btn.type || 'secondary',
      id: btn.id || `dialog-btn-${index}`,
      onClick: (e, dialog, background) => {
        if (typeof btn.onClick === 'function') {
          // 适配参数：(e, dialog, overlay)
          btn.onClick(e, dialog, background);
        }
      }
    })) : [];
    
    // 使用UIUtils.createDialog创建对话框
    const { dialog, background } = UIUtils.createDialog({
      title: title,
      content: content,
      buttons: uiUtilsButtons,
      className: 'focus-exit-dialog-overlay',  // ✅ 使用明确的类名标识退出弹窗
      preventEscape: true,  // 启用ESC键阻止
      customZIndex: overlayZIndex  // 使用动态计算的z-index
    });
    
    // ✅ 添加 focus-exit-dialog 类，让 exit-handler.css 中的样式生效
    dialog.classList.add('focus-exit-dialog');
    
    // 返回对话框和背景元素（使用overlay作为别名以保持兼容性）
    return { dialog, overlay: background };
  }
  
  /**
   * 关闭对话框
   * @param {HTMLElement} overlay - 对话框遮罩元素
   */
  closeDialog(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
  
  /**
   * 确保按钮处于可交互状态
   * @param {HTMLElement} button - 按钮元素
   */
  ensureButtonInteractive(button) {
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
      const parentOverlay = button.closest('.dialog-overlay, .focus-dialog-overlay');
      if (parentOverlay) {
        parentOverlay.style.pointerEvents = 'auto';
      }
      
      console.log('[专注模式] 按钮状态已重置为可交互:', button.textContent.trim().substring(0, 20));
    } catch (err) {
      console.error('[专注模式] 重置按钮状态失败:', err);
    }
  }
  
  /**
   * 验证按钮是否可交互
   * @param {HTMLElement} button - 按钮元素
   * @returns {boolean} 是否可交互
   */
  verifyButtonInteractive(button) {
    if (!button) return false;
    
    try {
      const style = window.getComputedStyle(button);
      
      const isVisible = style.display !== 'none' && 
                       style.visibility !== 'hidden' &&
                       parseFloat(style.opacity) > 0.1;
      
      const isClickable = style.pointerEvents !== 'none' && 
                         !button.disabled;
      
      const hasListener = button._exitTransitionHandler !== undefined ||
                         button.onclick !== null;
      
      const isInteractive = isVisible && isClickable && hasListener;
      
      if (!isInteractive) {
        console.warn('[专注模式] 按钮不可交互:', {
          text: button.textContent.trim(),
          visible: isVisible,
          clickable: isClickable,
          hasListener: hasListener,
          disabled: button.disabled,
          pointerEvents: style.pointerEvents
        });
      }
      
      return isInteractive;
    } catch (err) {
      console.error('[专注模式] 验证按钮状态失败:', err);
      return false;
    }
  }
  
  /**
   * 弹窗交互诊断函数
   * 修复：提供详细的诊断信息，帮助排查交互问题
   */
  diagnoseDialogInteraction() {
    console.log('\n🔍========== 弹窗交互诊断报告 ==========');
    
    // 检查当前活动的对话框
    const dialogs = document.querySelectorAll(
      '.focus-exit-dialog, .exit-transition-overlay, .dialog-overlay, .focus-dialog-overlay'
    );
    
    if (dialogs.length === 0) {
      console.log('✅ 当前没有活动的退出弹窗');
      console.log('💡 要测试弹窗交互，请尝试按 ESC 键退出全屏');
      return { status: 'no-dialogs', dialogs: 0 };
    }
    
    console.log(`🔍 发现 ${dialogs.length} 个活动弹窗:`);
    
    let overallStatus = 'healthy';
    const results = [];
    
    dialogs.forEach((dialog, index) => {
      console.log(`\n📋 弹窗 ${index + 1}:`);
      console.log('   类名:', dialog.className);
      console.log('   ID:', dialog.id || '无');
      
      // 检查显示状态
      const style = window.getComputedStyle(dialog);
      const displayStatus = {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents
      };
      
      console.log('   显示状态:', displayStatus);
      
      // 检查按钮
      const buttons = dialog.querySelectorAll('button, [role="button"], [class*="btn"]');
      console.log(`   找到 ${buttons.length} 个按钮`);
      
      let workingButtons = 0;
      let disabledButtons = 0;
      
      buttons.forEach((btn, btnIndex) => {
        const btnStyle = window.getComputedStyle(btn);
        const isClickable = btnStyle.pointerEvents !== 'none' && 
                           btnStyle.display !== 'none' && 
                           btnStyle.visibility !== 'hidden';
        const isDisabled = btn.disabled;
        const hasText = btn.textContent.trim().length > 0;
        
        if (isClickable && !isDisabled && hasText) {
          workingButtons++;
        } else {
          if (isDisabled) disabledButtons++;
          
          console.log(`   ❌ 按钮 ${btnIndex + 1} 状态异常:`, {
            text: btn.textContent.trim(),
            disabled: isDisabled,
            pointerEvents: btnStyle.pointerEvents,
            display: btnStyle.display,
            visibility: btnStyle.visibility,
            clickable: isClickable
          });
          
          if (overallStatus === 'healthy') overallStatus = 'warning';
        }
      });
      
      // 检查事件监听器
      let hasEventListeners = false;
      buttons.forEach(btn => {
        if (btn._exitTransitionHandler || btn.onclick || btn.addEventListener.length > 0) {
          hasEventListeners = true;
        }
      });
      
      const dialogResult = {
        index: index + 1,
        element: dialog,
        totalButtons: buttons.length,
        workingButtons: workingButtons,
        disabledButtons: disabledButtons,
        hasEventListeners: hasEventListeners,
        displayStatus: displayStatus
      };
      
      results.push(dialogResult);
      
      console.log(`   🎯 按钮状态: ${workingButtons}/${buttons.length} 可交互, ${disabledButtons} 禁用`);
      console.log(`   📡 事件监听器: ${hasEventListeners ? '已绑定' : '未检测到'}`);
      
      if (workingButtons === 0 && buttons.length > 0) {
        overallStatus = 'error';
        console.log('   🚨 警告: 所有按钮都无法交互！');
      }
    });
    
    // 检查全局状态
    console.log('\n🌐 全局状态检查:');
    console.log('   ExitHandler活动状态:', {
      exitRequested: this.exitRequested,
      reminderDialogActive: this.reminderDialogActive,
      exitTransitionActive: this.exitTransitionActive
    });
    
    if (window.focusMode) {
      console.log('   FocusMode退出状态:', {
        exitApproved: window.focusMode.fullscreenState?.exitApproved,
        exitInProgress: window.focusMode.fullscreenState?.exitInProgress
      });
    }
    
    // 总结报告
    console.log(`\n📊 诊断总结:`);
    console.log(`   状态: ${overallStatus === 'healthy' ? '✅ 正常' : overallStatus === 'warning' ? '⚠️ 有警告' : '❌ 有错误'}`);
    console.log(`   弹窗数量: ${dialogs.length}`);
    console.log(`   可交互按钮: ${results.reduce((sum, r) => sum + r.workingButtons, 0)}`);
    console.log(`   禁用按钮: ${results.reduce((sum, r) => sum + r.disabledButtons, 0)}`);
    
    if (overallStatus !== 'healthy') {
      console.log('\n🔧 建议修复措施:');
      console.log('   1. 刷新页面重试');
      console.log('   2. 检查控制台错误日志');
      console.log('   3. 确认没有其他脚本干扰');
      console.log('   4. 尝试使用 window.focusMode.exitHandler.restoreButtonState() 恢复按钮状态');
    }
    
    console.log('\n========================================');
    
    return {
      status: overallStatus,
      dialogs: dialogs.length,
      results: results,
      timestamp: new Date().toISOString()
    };
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