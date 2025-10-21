/**
 * 首次设置处理类
 * 负责处理用户的首次设置流程，包括密码设置和提醒语设置
 */
class FirstTimeSetup {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.currentStep = 0;
    this.tempSettings = {
      password: '',
      reminderCount: 3,
      reminders: []
    };
  }
  
  // 使用独立的对话框样式类名
  static DIALOG_CLASS = 'focus-first-time-dialog';
  
  /**
   * 显示设置流程
   */
  async showSetup() {
    try {
      console.log('[专注模式] FirstTimeSetup.showSetup() 开始执行');
      
      // 确保设置管理器已初始化
      await this.settingsManager.initialize();
      console.log('[专注模式] 设置管理器初始化完成');
      
      // 开始设置流程
      console.log('[专注模式] 开始显示密码设置对话框');
      await this.showPasswordSetup();
    } catch (err) {
      console.error('[专注模式] 首次设置失败:', err);
      console.error('[专注模式] 详细错误堆栈:', err.stack);
      // 显示错误提示
      this.showError('设置失败，请刷新页面重试');
    }
  }
  
  /**
   * 显示密码设置对话框
   */
  async showPasswordSetup() {
    console.log('[专注模式] showPasswordSetup() 开始执行');
    
    // 弹窗显示问题已解决，直接进入设置流程
    this.showRealPasswordSetup();
  }
  
  
  /**
   * 强制显示对话框 - 覆盖所有可能的隐藏规则
   */
  forceShowDialog(element, name) {
    try {
      // 使用最高优先级的样式强制显示
      element.style.setProperty('display', 'flex', 'important');
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
      element.style.setProperty('position', 'fixed', 'important');
      element.style.setProperty('top', '0', 'important');
      element.style.setProperty('left', '0', 'important');
      element.style.setProperty('right', '0', 'important');
      element.style.setProperty('bottom', '0', 'important');
      element.style.setProperty('width', '100vw', 'important');
      element.style.setProperty('height', '100vh', 'important');
      element.style.setProperty('z-index', '999999999', 'important');
      element.style.setProperty('pointer-events', 'auto', 'important');
      
      // 检查是否成功显示
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'flex' && computedStyle.opacity === '1') {
        console.log(`✅ [专注模式] ${name}强制显示成功！`);
        return true;
      } else {
        console.warn(`⚠️ [专注模式] ${name}仍未完全显示:`, {
          display: computedStyle.display,
          opacity: computedStyle.opacity,
          visibility: computedStyle.visibility
        });
        return false;
      }
    } catch (error) {
      console.error(`[专注模式] 强制显示${name}时出错:`, error);
      return false;
    }
  }
  
  /**
   * 显示真正的密码设置对话框
   */
  async showRealPasswordSetup() {
    console.log('[专注模式] showRealPasswordSetup() 开始执行');
    
    const { dialog, background } = UIUtils.createDialog({
      title: '设置退出密码',
      content: `
        <div class="dialog-form-group">
          <label>请输入密码（至少6位）：</label>
          <input type="password" id="password-input" minlength="6" required>
        </div>
        <div class="dialog-form-group">
          <label>请确认密码：</label>
          <input type="password" id="password-confirm" minlength="6" required>
        </div>
      `,
      buttons: [
        {
          text: '下一步',
          type: 'primary',
          id: 'password-next',
          onClick: async (e, dialog) => {
            const password = dialog.querySelector('#password-input').value;
            const confirm = dialog.querySelector('#password-confirm').value;
            
            if (password.length < 6) {
              this.showError('密码长度不能少于6位');
              return;
            }
            
            if (password !== confirm) {
              this.showError('两次输入的密码不一致');
              return;
            }
            
            this.tempSettings.password = password;
            UIUtils.closeDialog(background);
            await this.showReminderCountSetup();
          }
        }
      ],
      className: FirstTimeSetup.DIALOG_CLASS
    });
    
    console.log('[专注模式] 密码设置对话框创建完成');
    
    // 添加回车键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const nextButton = dialog.querySelector('#password-next');
        if (nextButton) nextButton.click();
      }
    });
    
    // 自动聚焦到第一个输入框
    setTimeout(() => {
      const firstInput = dialog.querySelector('#password-input');
      if (firstInput) firstInput.focus();
    }, 100);
  }
  
  /**
   * 显示提醒语数量设置对话框
   */
  async showReminderCountSetup() {
    const { dialog, background } = UIUtils.createDialog({
      title: '设置提醒语数量',
      content: `
        <div class="dialog-form-group">
          <label>请输入提醒语数量（至少3条）：</label>
          <input type="number" id="reminder-count" min="3" value="3" required>
        </div>
      `,
      buttons: [
        {
          text: '上一步',
          type: 'secondary',
          id: 'count-prev',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            this.showRealPasswordSetup();
          }
        },
        {
          text: '下一步',
          type: 'primary',
          id: 'count-next',
          onClick: async (e, dialog) => {
            const count = parseInt(dialog.querySelector('#reminder-count').value);
            
            if (count < 3) {
              this.showError('提醒语数量不能少于3条');
              return;
            }
            
            this.tempSettings.reminderCount = count;
            UIUtils.closeDialog(background);
            await this.showReminderSetup(0);
          }
        }
      ],
      className: FirstTimeSetup.DIALOG_CLASS
    });
    
    
    // 添加回车键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const nextButton = dialog.querySelector('#count-next');
        if (nextButton) nextButton.click();
      }
    });
    
    // 自动聚焦到输入框
    setTimeout(() => {
      const input = dialog.querySelector('#reminder-count');
      if (input) {
        input.focus();
        input.select(); // 选中当前值，方便用户直接修改
      }
    }, 100);
  }
  
  /**
   * 显示提醒语设置对话框
   */
  async showReminderSetup(index) {
    if (index >= this.tempSettings.reminderCount) {
      // 所有提醒语设置完成，保存设置
      await this.saveSettings();
      return;
    }
    
    const { dialog, background } = UIUtils.createDialog({
      title: `设置第 ${index + 1} 条提醒语`,
      content: `
        <div class="dialog-form-group">
          <label>请输入提醒语：</label>
          <input type="text" id="reminder-input" required>
        </div>
      `,
      buttons: [
        {
          text: '上一步',
          type: 'secondary',
          id: 'reminder-prev',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            if (index > 0) {
              this.showReminderSetup(index - 1);
            } else {
              this.showReminderCountSetup();
            }
          }
        },
        {
          text: '下一步',
          type: 'primary',
          id: 'reminder-next',
          onClick: async (e, dialog) => {
            const reminder = dialog.querySelector('#reminder-input').value.trim();
            
            if (!reminder) {
              this.showError('提醒语不能为空');
              return;
            }
            
            this.tempSettings.reminders[index] = reminder;
            UIUtils.closeDialog(background);
            await this.showReminderSetup(index + 1);
          }
        }
      ],
      className: FirstTimeSetup.DIALOG_CLASS
    });
    
    
    // 添加回车键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const nextButton = dialog.querySelector('#reminder-next');
        if (nextButton) nextButton.click();
      }
    });
    
    // 自动聚焦到输入框
    setTimeout(() => {
      const input = dialog.querySelector('#reminder-input');
      if (input) input.focus();
    }, 100);
  }
  
  /**
   * 保存设置
   */
  async saveSettings() {
    try {
      await this.settingsManager.updateSettings({
        ...this.tempSettings,
        isFirstTime: false
      });
      
      // 显示完成提示
      const { dialog, background } = UIUtils.createDialog({
        title: '设置完成',
        content: `
          <div class="dialog-message">
            设置已完成！现在你可以开始使用专注模式了。
          </div>
        `,
        buttons: [
          {
            text: '确定',
            type: 'primary',
            id: 'complete-ok',
            onClick: (e, dialog, background) => {
              UIUtils.closeDialog(background);
            }
          }
        ],
        className: FirstTimeSetup.DIALOG_CLASS
      });
      
      
      // 添加回车键支持
      dialog.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          const okButton = dialog.querySelector('#complete-ok');
          if (okButton) okButton.click();
        }
      });
    } catch (err) {
      console.error('[专注模式] 保存设置失败:', err);
      this.showError('保存设置失败，请重试');
    }
  }
  
  /**
   * 显示错误提示 - 美化版本
   */
  showError(message) {
    const { dialog, background } = UIUtils.createDialog({
      title: '⚠️ 提示',
      content: `
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
        </style>
      `,
      buttons: [
        {
          text: '我知道了',
          type: 'primary',
          id: 'error-ok',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
          }
        }
      ],
      className: FirstTimeSetup.DIALOG_CLASS
    });
    
    // 🔧 修复：确保错误弹窗按钮可交互
    setTimeout(() => {
      const confirmButton = dialog.querySelector('#error-ok');
      if (confirmButton) {
        UIUtils.ensureButtonInteractive(confirmButton);
        confirmButton.focus();
        
        // 验证按钮状态
        if (!UIUtils.verifyButtonInteractive(confirmButton)) {
          console.warn('[首次设置] 错误弹窗按钮交互异常，尝试修复');
          UIUtils.ensureButtonInteractive(confirmButton);
        }
      }
    }, 100);
    
    // 添加回车键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const okButton = dialog.querySelector('#error-ok');
        if (okButton) okButton.click();
      }
    });
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof FirstTimeSetup !== 'undefined' && !window.FirstTimeSetup) window.FirstTimeSetup = FirstTimeSetup; 