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
      // 确保设置管理器已初始化
      await this.settingsManager.initialize();
      
      // 开始设置流程
      await this.showPasswordSetup();
    } catch (err) {
      console.error('[专注模式] 首次设置失败:', err);
      // 显示错误提示
      this.showError('设置失败，请刷新页面重试');
    }
  }
  
  /**
   * 显示密码设置对话框
   */
  async showPasswordSetup() {
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
    
    // 添加回车键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        dialog.querySelector('button').click();
      }
    });
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
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            this.showPasswordSetup();
          }
        },
        {
          text: '下一步',
          type: 'primary',
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
            onClick: (e, dialog, background) => {
              UIUtils.closeDialog(background);
            }
          }
        ],
        className: FirstTimeSetup.DIALOG_CLASS
      });
    } catch (err) {
      console.error('[专注模式] 保存设置失败:', err);
      this.showError('保存设置失败，请重试');
    }
  }
  
  /**
   * 显示错误提示
   */
  showError(message) {
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
          }
        }
      ],
      className: FirstTimeSetup.DIALOG_CLASS
    });
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof FirstTimeSetup !== 'undefined' && !window.FirstTimeSetup) window.FirstTimeSetup = FirstTimeSetup; 