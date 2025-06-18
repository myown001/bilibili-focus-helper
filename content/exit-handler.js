/**
 * 退出处理类
 * 负责处理退出全屏的流程，包括提醒语确认和密码验证
 */
class ExitHandler {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.currentReminderIndex = 0;
  }
  
  // 使用独立的对话框样式类名
  static DIALOG_CLASS = 'focus-exit-dialog';
  
  /**
   * 处理退出流程
   */
  async handleExit() {
    try {
      // 确保设置管理器已初始化
      await this.settingsManager.initialize();
      
      // 获取设置
      const settings = await this.settingsManager.getSettings();
      
      // 如果没有设置密码，直接退出
      if (!settings.password) {
        this.exitFullscreen();
        return;
      }
      
      // 开始显示提醒语
      this.currentReminderIndex = 0;
      await this.showNextReminder(settings.reminders);
    } catch (err) {
      console.error('[专注模式] 退出处理失败:', err);
      // 显示错误提示
      this.showError('退出失败，请重试');
    }
  }
  
  /**
   * 显示下一条提醒语
   */
  async showNextReminder(reminders) {
    if (this.currentReminderIndex >= reminders.length) {
      // 所有提醒语已确认，显示密码验证
      await this.showPasswordVerification();
      return;
    }
    
    const { dialog, background } = UIUtils.createDialog({
      title: '确认提醒语',
      content: `
        <div class="dialog-message">
          ${reminders[this.currentReminderIndex]}
        </div>
      `,
      buttons: [
        {
          text: '取消',
          type: 'secondary',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            // 取消退出，恢复全屏
            this.restoreFullscreen();
          }
        },
        {
          text: '确认',
          type: 'primary',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            this.currentReminderIndex++;
            this.showNextReminder(reminders);
          }
        }
      ],
      className: ExitHandler.DIALOG_CLASS
    });
    
    // 添加ESC键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        UIUtils.closeDialog(background);
        this.restoreFullscreen();
      }
    });
  }
  
  /**
   * 显示密码验证对话框
   */
  async showPasswordVerification() {
    const { dialog, background } = UIUtils.createDialog({
      title: '验证密码',
      content: `
        <div class="dialog-form-group">
          <label>请输入密码：</label>
          <input type="password" id="password-input" required>
        </div>
      `,
      buttons: [
        {
          text: '取消',
          type: 'secondary',
          onClick: (e, dialog, background) => {
            UIUtils.closeDialog(background);
            // 取消退出，恢复全屏
            this.restoreFullscreen();
          }
        },
        {
          text: '确认',
          type: 'primary',
          onClick: async (e, dialog) => {
            const password = dialog.querySelector('#password-input').value;
            
            if (await this.settingsManager.validatePassword(password)) {
              UIUtils.closeDialog(background);
              this.exitFullscreen();
            } else {
              this.showError('密码错误');
            }
          }
        }
      ],
      className: ExitHandler.DIALOG_CLASS
    });
    
    // 添加ESC键支持
    dialog.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        UIUtils.closeDialog(background);
        this.restoreFullscreen();
      }
    });
  }
  
  /**
   * 退出全屏
   */
  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
  
  /**
   * 恢复全屏
   */
  restoreFullscreen() {
    const videoContainer = document.querySelector('#bilibili-player') || 
                          document.querySelector('.bpx-player-container');
    if (videoContainer) {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      } else if (videoContainer.webkitRequestFullscreen) {
        videoContainer.webkitRequestFullscreen();
      } else if (videoContainer.mozRequestFullScreen) {
        videoContainer.mozRequestFullScreen();
      } else if (videoContainer.msRequestFullscreen) {
        videoContainer.msRequestFullscreen();
      }
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
      className: ExitHandler.DIALOG_CLASS
    });
  }
}

// 导出全局变量
if (typeof window !== 'undefined' && typeof ExitHandler !== 'undefined' && !window.ExitHandler) window.ExitHandler = ExitHandler; 