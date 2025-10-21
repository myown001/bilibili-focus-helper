// pomodoro-timer.js - 番茄钟功能
// 提供倒计时和正计时两种模式，可拖拽、可快捷键控制

(function() {
  'use strict';
  
  console.log('[番茄钟] 模块开始加载');
  
  // ===== 番茄钟管理器 =====
  class PomodoroTimer {
    constructor() {
      console.log('[番茄钟] PomodoroTimer实例创建');
      
      // 状态
      this.state = {
        mode: 'countdown',           // countdown | countup
        status: 'idle',              // idle | working | break | paused
        timeLeft: 25 * 60,           // 剩余时间（秒）
        elapsed: 0,                  // 已用时间（秒）
        workDuration: 25 * 60,       // 工作时长（秒）
        breakDuration: 5 * 60,       // 休息时长（秒）
        visible: true,               // 是否显示
        displayMode: 'full',         // 显示模式: 'full' | 'minimal' | 'hidden'
        position: null,              // 位置 {x, y}
        completedPomodoros: 0,       // 完成的番茄钟数量（今日从历史记录加载）
        sessionStartTime: null,      // 当前会话开始时间（时间戳）
        sessionMode: null,           // 当前会话模式：'countdown' | 'countup'
        accumulatedTime: 0,          // 累计工作时间（用于暂停恢复）
        autoBreak: true,             // 完成后自动进入休息
        dailyGoal: 5,                // 每日目标番茄钟数
      };
      
      // 定时器
      this.timer = null;
      
      // UI 元素
      this.container = null;
      this.display = null;
      this.progressBar = null;
      
      // 拖拽相关
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      
      // 全屏相关
      this.fullscreenSavedPosition = null;
      
      // 初始化标记
      this.initialized = false;
    }
    
    /**
     * 初始化
     */
    async initialize() {
      try {
        console.log('[番茄钟] 开始初始化');
        
        // 只在视频页面显示
        if (!location.pathname.includes('/video/')) {
          console.log('[番茄钟] 非视频页面，不初始化');
          return;
        }
        
        // 检查是否已初始化（防止SPA导航时重复初始化）
        if (this.initialized) {
          console.log('[番茄钟] 已经初始化过，跳过');
          return;
        }
        
        // 检查并清理可能存在的旧UI（页面刷新或SPA导航）
        const existingContainer = document.getElementById('pomodoro-timer');
        if (existingContainer) {
          console.log('[番茄钟] 发现旧UI元素，清理中...');
          existingContainer.remove();
        }
        
        // 加载设置
        await this.loadSettings();
        
        // 从历史记录加载今日完成数
        await this.loadTodayCompleted();
        
        // 创建UI
        this.createUI();
        
        // 绑定事件
        this.bindEvents();
        
        // 如果刷新前正在运行，恢复定时器
        if (this.state.status === 'working' || this.state.status === 'break') {
          console.log('[番茄钟] 检测到刷新前正在运行，恢复定时器');
          
          // 刷新恢复逻辑说明：
          // - 保存时：计算并保存总累计时间（包含当前段）
          // - 恢复时：accumulatedTime 已包含刷新前的所有时间
          // - 设置新的 sessionStartTime，继续累计后续时间
          // - 完成时：actualDuration = accumulatedTime + (完成时间 - sessionStartTime)
          // 注意：刷新可能丢失最多10秒（两次自动保存之间的间隔）
          
          this.state.sessionStartTime = Date.now();
          
          this.timer = setInterval(() => {
            if (this.state.status === 'break') {
              this.tickBreak();
            } else {
              this.tick();
            }
          }, 1000);
          
          console.log('[番茄钟] 定时器已恢复，已累计时间:', this.state.accumulatedTime, '秒');
        }
        
        // 标记已初始化
        this.initialized = true;
        
        console.log('[番茄钟] 初始化完成，状态:', this.state.status);
      } catch (error) {
        console.error('[番茄钟] 初始化失败:', error);
        // 即使初始化失败，也要确保快捷键能用
        if (this.container) {
          try {
            this.bindEvents();
          } catch (e) {
            console.error('[番茄钟] 绑定事件失败:', e);
          }
        }
      }
    }
    
    /**
     * 加载设置（优先使用sync进行跨设备同步）
     */
    async loadSettings() {
      try {
        // 优先从 sync 读取设置（跨设备同步），如果失败则从 local 读取
        let settings = null;
        try {
          const syncResult = await chrome.storage.sync.get('pomodoroSettings');
          if (syncResult.pomodoroSettings) {
            settings = syncResult.pomodoroSettings;
            console.log('[番茄钟] 从sync加载设置（跨设备）');
          }
        } catch (syncError) {
          console.warn('[番茄钟] sync读取失败，使用local:', syncError);
        }
        
        // 如果sync没有数据，从local读取
        if (!settings) {
          const localResult = await chrome.storage.local.get('pomodoroSettings');
          if (localResult.pomodoroSettings) {
            settings = localResult.pomodoroSettings;
            console.log('[番茄钟] 从local加载设置');
          }
        }
        
        // 读取状态（只从local读取，状态不跨设备同步）
        const stateResult = await chrome.storage.local.get('pomodoroState');
        
        if (settings) {
          this.state.mode = settings.mode || 'countdown';
          this.state.workDuration = (settings.workDuration || 25) * 60;
          this.state.breakDuration = (settings.breakDuration || 5) * 60;
          this.state.displayMode = settings.displayMode || 'full';
          this.state.position = settings.position || null;
          this.state.autoBreak = settings.autoBreak !== false;  // 默认true
          this.state.dailyGoal = settings.dailyGoal || 5;  // 默认每日5个番茄钟
          
          // 根据displayMode同步visible状态
          if (this.state.displayMode === 'hidden') {
            this.state.visible = false;
          } else {
            this.state.visible = settings.visible !== false;
          }
          
          // 边界检查：防止位置超出屏幕
          if (this.state.position) {
            const maxX = window.innerWidth - 280; // 番茄钟宽度280px
            const maxY = window.innerHeight - 350; // 番茄钟大约高度350px
            
            if (this.state.position.x > maxX || this.state.position.y > maxY || 
                this.state.position.x < 0 || this.state.position.y < 0) {
              console.warn('[番茄钟] 保存的位置超出屏幕，已重置为默认位置');
              this.state.position = null;
            }
          }
        }
        
        // 恢复状态（如果页面刷新）
        if (stateResult.pomodoroState) {
          const savedState = stateResult.pomodoroState;
          this.state.status = savedState.status || 'idle';
          this.state.timeLeft = savedState.timeLeft || this.state.workDuration;
          this.state.elapsed = savedState.elapsed || 0;
          this.state.accumulatedTime = savedState.accumulatedTime || 0;
        } else {
          this.state.timeLeft = this.state.workDuration;
        }
        
        console.log('[番茄钟] 设置已加载:', this.state);
      } catch (error) {
        console.error('[番茄钟] 加载设置失败:', error);
      }
    }
    
    /**
     * 保存设置（同时保存到local和sync实现跨设备同步）
     */
    async saveSettings() {
      try {
        const settings = {
          mode: this.state.mode,
          workDuration: this.state.workDuration / 60,
          breakDuration: this.state.breakDuration / 60,
          visible: this.state.visible,
          displayMode: this.state.displayMode,
          position: this.state.position,
          autoBreak: this.state.autoBreak,
          dailyGoal: this.state.dailyGoal
        };
        
        // 保存状态时，计算当前总累计时间（包括当前段）
        // 这样刷新后能准确恢复工作时长，不会丢失时间
        let totalAccumulatedTime = this.state.accumulatedTime || 0;
        if ((this.state.status === 'working' || this.state.status === 'break') && this.state.sessionStartTime) {
          const currentSegmentTime = Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
          totalAccumulatedTime += currentSegmentTime;
        }
        
        const state = {
          status: this.state.status,
          timeLeft: this.state.timeLeft,
          elapsed: this.state.elapsed,
          accumulatedTime: totalAccumulatedTime,  // 保存总累计时间（含当前段）
          lastSaveTime: Date.now()  // 记录保存时间，用于刷新后恢复
        };
        
        // 保存到local（必须）
        await chrome.storage.local.set({
          pomodoroSettings: settings,
          pomodoroState: state
        });
        
        // 同时保存到sync（跨设备同步，失败不影响功能）
        try {
          await chrome.storage.sync.set({
            pomodoroSettings: settings
          });
        } catch (syncError) {
          console.warn('[番茄钟] sync保存失败，但local已保存:', syncError);
        }
      } catch (error) {
        console.error('[番茄钟] 保存设置失败:', error);
      }
    }
    
    /**
     * 从历史记录加载今日完成数（持久化）
     */
    async loadTodayCompleted() {
      try {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        
        const result = await chrome.storage.local.get('pomodoroHistory');
        const history = result.pomodoroHistory || {};
        const todayEntries = history[today] || [];
        
        // 只统计工作类型的完成数
        this.state.completedPomodoros = todayEntries.filter(e => e.type === 'work').length;
        
        console.log('[番茄钟] 今日已完成:', this.state.completedPomodoros, '个');
      } catch (error) {
        console.error('[番茄钟] 加载今日完成数失败:', error);
      }
    }
    
    /**
     * 创建UI
     */
    createUI() {
      // 创建容器
      this.container = document.createElement('div');
      this.container.id = 'pomodoro-timer';
      this.container.className = 'pomodoro-timer';
      
      // 应用显示模式
      if (this.state.displayMode === 'minimal') {
        this.container.classList.add('minimal-mode');
      } else if (this.state.displayMode === 'hidden') {
        this.container.classList.add('hidden');
      } else if (!this.state.visible) {
        this.container.classList.add('hidden');
      }
      
      // 设置位置
      if (this.state.position) {
        this.container.style.left = `${this.state.position.x}px`;
        this.container.style.top = `${this.state.position.y}px`;
        this.container.style.right = 'auto';  // 清除默认的right定位，防止拖动后宽度异常
      }
      
      // HTML 结构
      this.container.innerHTML = `
        <div class="pomodoro-header" draggable="true">
          <span class="pomodoro-icon">🍅</span>
          <span class="pomodoro-mode-label">${this.getModeLabel()}</span>
          <button class="pomodoro-close" title="隐藏">×</button>
        </div>
        <div class="pomodoro-body">
          <div class="pomodoro-display">
            ${this.formatTime(this.state.timeLeft)}
          </div>
          <div class="pomodoro-progress">
            <div class="pomodoro-progress-bar" style="width: 100%"></div>
          </div>
          <div class="pomodoro-controls">
            <button class="pomodoro-btn pomodoro-start" data-action="start">开始</button>
            <button class="pomodoro-btn pomodoro-pause" data-action="pause" style="display:none;">暂停</button>
            <button class="pomodoro-btn pomodoro-complete" data-action="complete" style="display:none;">完成</button>
            <button class="pomodoro-btn pomodoro-reset" data-action="reset">重置</button>
            <button class="pomodoro-btn pomodoro-mode" data-action="toggle-mode">切换模式</button>
          </div>
          <div class="pomodoro-stats">
            <span class="stats-text">完成: ${this.state.completedPomodoros}/${this.state.dailyGoal} 个</span>
            <div class="goal-progress">
              <div class="goal-progress-bar" style="width: ${Math.min(this.state.completedPomodoros / this.state.dailyGoal * 100, 100)}%"></div>
            </div>
          </div>
          <div class="pomodoro-hint">
            <span class="hint-text">💡 Ctrl+Shift+T：完整↔简洁↔隐藏</span>
            <button class="pomodoro-settings-btn" data-action="stats" title="查看统计">📊</button>
            <button class="pomodoro-settings-btn" data-action="settings" title="设置时长">⚙️</button>
          </div>
        </div>
      `;
      
      // 添加到页面
      document.body.appendChild(this.container);
      
      // 保存元素引用
      this.display = this.container.querySelector('.pomodoro-display');
      this.progressBar = this.container.querySelector('.pomodoro-progress-bar');
      
      console.log('[番茄钟] UI已创建');
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
      // 检查容器是否存在
      if (!this.container) {
        console.error('[番茄钟] 容器不存在，无法绑定事件');
        return;
      }
      
      // 控制按钮
      this.container.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        switch (action) {
          case 'start':
            this.start();
            break;
          case 'pause':
            this.pause();
            break;
          case 'complete':
            this.complete();
            break;
          case 'reset':
            await this.reset();
            break;
          case 'toggle-mode':
            await this.toggleMode();
            break;
          case 'settings':
            await this.showSettings();
            break;
          case 'stats':
            await this.showStats();
            break;
        }
      });
      
      // 关闭按钮
      const closeBtn = this.container.querySelector('.pomodoro-close');
      closeBtn.addEventListener('click', () => {
        this.hide();
      });
      
      // 拖拽 - 完整模式拖header，简洁模式拖整个容器
      const header = this.container.querySelector('.pomodoro-header');
      
      // header拖动（完整模式）
      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.pomodoro-close')) return;
        this.startDrag(e);
      });
      
      // 容器拖动（简洁模式）
      this.container.addEventListener('mousedown', (e) => {
        // 只在简洁模式下响应容器直接点击
        if (this.state.displayMode === 'minimal' && e.target === this.container) {
          this.startDrag(e);
        }
        // 简洁模式下点击display也可以拖动
        if (this.state.displayMode === 'minimal' && e.target.classList.contains('pomodoro-display')) {
          this.startDrag(e);
        }
      });
      
      document.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
          this.drag(e);
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.stopDrag();
        }
      });
      
      // 快捷键 Ctrl+Shift+T (跨平台兼容，Mac也适用)
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
          console.log('[番茄钟] 快捷键触发:', this.state.visible ? '显示' : '隐藏');
        }
      }, true); // 使用捕获阶段，优先级更高
      
      // 全屏事件处理：动态移动DOM以保持可见
      document.addEventListener('fullscreenchange', () => {
        this.handleFullscreenChange();
      });
      
      console.log('[番茄钟] 事件已绑定，快捷键: Ctrl+Shift+T');
    }
    
    /**
     * 开始计时
     */
    start() {
      if (this.state.status === 'working') return;
      
      // 如果不是从暂停恢复，重置累计时间
      if (this.state.status !== 'paused') {
        this.state.accumulatedTime = 0;
        this.state.sessionMode = this.state.mode;  // 记录使用的模式
      }
      
      this.state.status = 'working';
      this.state.sessionStartTime = Date.now();  // 记录（或重新记录）会话开始时间
      this.updateUI();
      
      this.timer = setInterval(() => {
        this.tick();
      }, 1000);
      
      console.log('[番茄钟] 开始计时，模式:', this.state.sessionMode, 
                  '累计时间:', this.state.accumulatedTime, '秒');
    }
    
    /**
     * 暂停/跳过休息
     */
    async pause() {
      // 如果在休息模式，跳过休息
      if (this.state.status === 'break') {
        await this.completeBreak();
        return;
      }
      
      if (this.state.status !== 'working') return;
      
      // 累计已工作的时间
      if (this.state.sessionStartTime) {
        const pausedDuration = Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
        this.state.accumulatedTime += pausedDuration;
        console.log('[番茄钟] 暂停前工作:', pausedDuration, '秒，累计:', this.state.accumulatedTime, '秒');
      }
      
      this.state.status = 'paused';
      this.state.sessionStartTime = null;  // 清空开始时间，防止重复计算
      clearInterval(this.timer);
      this.timer = null;
      this.updateUI();
      
      console.log('[番茄钟] 已暂停');
    }
    
    /**
     * 重置（带确认）
     * @returns {Promise<boolean>} 返回true表示重置成功，false表示用户取消
     */
    async reset() {
      // 如果正在工作，提示确认
      if (this.state.status === 'working' || this.state.status === 'paused') {
        const confirmed = await this.showConfirmDialog(
          '⚠️ 确认重置？',
          '当前工作数据将不会被保存，确定要重置吗？'
        );
        
        if (!confirmed) {
          console.log('[番茄钟] 用户取消重置');
          return false;  // 返回false表示用户取消
        }
      }
      
      this.state.status = 'idle';
      clearInterval(this.timer);
      this.timer = null;
      this.state.accumulatedTime = 0;  // 重置累计时间
      this.state.sessionStartTime = null;
      this.state.sessionMode = null;  // 清除会话模式记录
      
      if (this.state.mode === 'countdown') {
        this.state.timeLeft = this.state.workDuration;
      } else {
        this.state.elapsed = 0;
      }
      
      this.updateUI();
      this.saveSettings();
      
      console.log('[番茄钟] 已重置');
      return true;  // 返回true表示重置成功
    }
    
    /**
     * 切换模式
     */
    async toggleMode() {
      // 先尝试重置，如果用户取消则不切换模式
      const resetSuccess = await this.reset();
      if (!resetSuccess) {
        console.log('[番茄钟] 切换模式被取消');
        return;
      }
      
      this.state.mode = this.state.mode === 'countdown' ? 'countup' : 'countdown';
      
      if (this.state.mode === 'countdown') {
        this.state.timeLeft = this.state.workDuration;
      } else {
        this.state.elapsed = 0;
      }
      
      this.updateUI();
      await this.saveSettings();
      
      console.log('[番茄钟] 切换模式:', this.state.mode);
    }
    
    /**
     * 显示设置对话框（使用自定义对话框，支持预设时长）
     */
    async showSettings() {
      const currentWork = this.state.workDuration / 60;
      const currentBreak = this.state.breakDuration / 60;
      
      // 工作时长设置（带预设按钮）
      const workTime = await this.showPresetInputDialog(
        '⏰ 设置工作时长',
        '建议: 25分钟（标准番茄钟）',
        currentWork,
        [15, 25, 45, 60],
        1,
        120
      );
      
      if (workTime === null) {
        console.log('[番茄钟] 用户取消设置');
        return;
      }
      
      const workMinutes = parseInt(workTime);
      if (isNaN(workMinutes) || workMinutes < 1 || workMinutes > 120) {
        await this.showAlertDialog(
          '❌ 工作时长无效',
          '请输入 1-120 之间的数字',
          true
        );
        return;
      }
      
      // 休息时长设置（带预设按钮）
      const breakTime = await this.showPresetInputDialog(
        '☕ 设置休息时长',
        '建议: 5分钟',
        currentBreak,
        [3, 5, 10, 15],
        1,
        30
      );
      
      if (breakTime === null) {
        console.log('[番茄钟] 用户取消设置');
        return;
      }
      
      const breakMinutes = parseInt(breakTime);
      if (isNaN(breakMinutes) || breakMinutes < 1 || breakMinutes > 30) {
        await this.showAlertDialog(
          '❌ 休息时长无效',
          '请输入 1-30 之间的数字',
          true
        );
        return;
      }
      
      // 询问是否启用自动休息
      const autoBreak = await this.showConfirmDialog(
        '☕ 自动休息设置',
        '完成番茄钟后是否自动进入休息？<br><br>选择"确定"：自动休息<br>选择"取消"：手动开始下一个'
      );
      
      // 每日目标设置（带预设按钮）
      const goalInput = await this.showPresetInputDialog(
        '🎯 设置每日目标',
        '建议: 5个番茄钟（约2小时）',
        this.state.dailyGoal,
        [3, 5, 8, 10],
        1,
        20,
        '个',      // 单位
        '目标'     // 标签前缀
      );
      
      if (goalInput === null) {
        console.log('[番茄钟] 用户取消设置');
        return;
      }
      
      const dailyGoal = parseInt(goalInput);
      if (isNaN(dailyGoal) || dailyGoal < 1 || dailyGoal > 20) {
        await this.showAlertDialog(
          '❌ 每日目标无效',
          '请输入 1-20 之间的数字',
          true
        );
        return;
      }
      
      // 更新设置
      this.state.workDuration = workMinutes * 60;
      this.state.breakDuration = breakMinutes * 60;
      this.state.autoBreak = autoBreak;
      this.state.dailyGoal = dailyGoal;
      
      // 如果当前空闲，重置时间
      if (this.state.status === 'idle') {
        this.state.timeLeft = this.state.workDuration;
      }
      
      this.updateUI();
      await this.saveSettings();
      
      console.log(`[番茄钟] 设置已更新: 工作${workMinutes}分钟, 休息${breakMinutes}分钟, 自动休息:${autoBreak}, 每日目标:${dailyGoal}个`);
      await this.showAlertDialog(
        '✅ 设置已保存',
        `工作时长: ${workMinutes} 分钟<br>休息时长: ${breakMinutes} 分钟<br>自动休息: ${autoBreak ? '启用' : '关闭'}<br>每日目标: ${dailyGoal} 个🍅`,
        false
      );
    }
    
    /**
     * 显示带预设按钮的输入对话框
     * @param {string} unit - 单位文本（如：'分钟'、'个'）
     * @param {string} labelPrefix - 输入框标签前缀（如：'时长'、'目标'）
     */
    async showPresetInputDialog(title, hint, defaultValue, presets, min, max, unit = '分钟', labelPrefix = '时长') {
      return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'pomodoro-dialog-overlay';
        
        // 根据单位类型确定按钮后缀（分钟→分，其他→原样）
        const buttonSuffix = unit === '分钟' ? '分' : unit;
        
        dialog.innerHTML = `
          <div class="pomodoro-dialog">
            <div class="pomodoro-dialog-header">
              <h3>${title}</h3>
            </div>
            <div class="pomodoro-dialog-body">
              <p style="margin-bottom: 12px; color: #6b7280; font-size: 13px;">${hint}</p>
              <p style="margin-bottom: 8px; font-weight: 600;">快捷选择:</p>
              <div class="preset-buttons" style="display: flex; gap: 8px; margin-bottom: 16px;">
                ${presets.map(val => `<button class="preset-btn" data-minutes="${val}">${val}${buttonSuffix}</button>`).join('')}
              </div>
              <p style="margin-bottom: 8px; font-weight: 600;">自定义${labelPrefix}（${unit}）:</p>
              <input type="number" class="pomodoro-input" 
                     value="${defaultValue}" min="${min}" max="${max}" 
                     placeholder="输入${min}-${max}之间的数字">
            </div>
            <div class="pomodoro-dialog-footer">
              <button class="pomodoro-dialog-btn cancel">取消</button>
              <button class="pomodoro-dialog-btn confirm">确定</button>
            </div>
          </div>
        `;
        
        const targetElement = document.fullscreenElement || document.body;
        targetElement.appendChild(dialog);
        
        const input = dialog.querySelector('.pomodoro-input');
        const cancelBtn = dialog.querySelector('.cancel');
        const confirmBtn = dialog.querySelector('.confirm');
        const presetBtns = dialog.querySelectorAll('.preset-btn');
        
        // 预设按钮点击
        presetBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const minutes = btn.dataset.minutes;
            input.value = minutes;
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
        
        // 自动聚焦
        setTimeout(() => {
          input.focus();
          input.select();
        }, 100);
        
        const handleInputKeydown = (e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') handleCancel();
        };
        
        const handleCancel = () => {
          input.removeEventListener('keydown', handleInputKeydown);
          dialog.remove();
          resolve(null);
        };
        
        const handleConfirm = () => {
          input.removeEventListener('keydown', handleInputKeydown);
          const value = parseInt(input.value);
          dialog.remove();
          resolve(value);
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleConfirm);
        input.addEventListener('keydown', handleInputKeydown);
        
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) handleCancel();
        });
      });
    }
    
    /**
     * 显示目标达成祝贺
     */
    async showGoalAchieved() {
      await this.showAlertDialog(
        '🎉 恭喜达成今日目标！',
        `你已完成今日目标 ${this.state.dailyGoal} 个番茄钟！<br><br>坚持就是胜利，继续加油！💪`,
        false
      );
      console.log('[番茄钟] 达成今日目标:', this.state.dailyGoal);
    }
    
    /**
     * 显示今日统计
     */
    async showStats() {
      try {
        // 获取今日历史
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        
        const result = await chrome.storage.local.get('pomodoroHistory');
        const history = result.pomodoroHistory || {};
        const todayEntries = history[today] || [];
        
        // 计算统计
        const workEntries = todayEntries.filter(e => e.type === 'work');
        const breakEntries = todayEntries.filter(e => e.type === 'break');
        
        const totalPomodoros = workEntries.reduce((sum, e) => sum + (e.pomodoroCount || 0), 0);
        const totalWorkTime = workEntries.reduce((sum, e) => sum + (e.actualDuration || 0), 0);
        const totalBreakTime = breakEntries.reduce((sum, e) => sum + (e.actualDuration || 0), 0);
        
        const countdownCount = workEntries.filter(e => e.mode === 'countdown').length;
        const countupCount = workEntries.filter(e => e.mode === 'countup').length;
        const totalCount = countdownCount + countupCount;
        
        const countdownPercent = totalCount > 0 ? Math.round(countdownCount / totalCount * 100) : 0;
        const countupPercent = totalCount > 0 ? Math.round(countupCount / totalCount * 100) : 0;
        
        // 生成最近记录（最多5条）
        const recentList = workEntries.slice(-5).reverse().map(e => {
          const time = new Date(e.endTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
          const duration = Math.round(e.actualDuration / 60);
          const mode = e.mode === 'countdown' ? '倒计时' : '正计时';
          return `• ${time} 工作${duration}分 (${mode})`;
        }).join('\n');
        
        // 构建统计消息
        const message = `
          <div style="text-align: left; line-height: 1.8;">
            <p style="margin: 8px 0;"><strong>🍅 完成番茄钟:</strong> ${totalPomodoros.toFixed(1)}个 (${workEntries.length}次)</p>
            <p style="margin: 8px 0;"><strong>⏱️ 工作时长:</strong> ${Math.round(totalWorkTime / 60)}分钟</p>
            <p style="margin: 8px 0;"><strong>☕ 休息时长:</strong> ${Math.round(totalBreakTime / 60)}分钟</p>
            
            ${totalCount > 0 ? `
              <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;">
              
              <p style="margin: 8px 0;"><strong>📈 模式使用:</strong></p>
              <div style="margin: 8px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <div style="flex: 1; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
                    <div style="width: ${countdownPercent}%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);"></div>
                  </div>
                  <span style="margin-left: 8px; font-size: 12px; min-width: 80px;">倒计时 ${countdownPercent}%</span>
                </div>
                <div style="display: flex; align-items: center;">
                  <div style="flex: 1; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
                    <div style="width: ${countupPercent}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%);"></div>
                  </div>
                  <span style="margin-left: 8px; font-size: 12px; min-width: 80px;">正计时 ${countupPercent}%</span>
                </div>
              </div>
            ` : ''}
            
            ${recentList ? `
              <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 8px 0;"><strong>⏰ 最近记录:</strong></p>
              <pre style="font-size: 12px; line-height: 1.6; margin: 8px 0; white-space: pre-wrap; font-family: inherit;">${recentList}</pre>
            ` : ''}
            
            ${workEntries.length === 0 ? '<p style="text-align: center; color: #9ca3af; margin: 16px 0;">今天还没有学习记录，开始你的第一个番茄钟吧！💪</p>' : ''}
          </div>
        `;
        
        await this.showAlertDialog('📊 今日学习统计', message, false);
        
        console.log('[番茄钟] 显示统计:', {
          总番茄钟: totalPomodoros.toFixed(1),
          工作次数: workEntries.length,
          工作时长: Math.round(totalWorkTime / 60)
        });
      } catch (error) {
        console.error('[番茄钟] 显示统计失败:', error);
        await this.showAlertDialog(
          '❌ 统计加载失败',
          '无法加载学习统计数据，请稍后重试',
          true
        );
      }
    }
    
    /**
     * 每秒更新
     */
    tick() {
      if (this.state.mode === 'countdown') {
        this.state.timeLeft--;
        
        if (this.state.timeLeft <= 0) {
          this.complete();
        }
      } else {
        this.state.elapsed++;
      }
      
      this.updateUI();
      
      // 每10秒保存一次状态
      if ((this.state.mode === 'countdown' ? this.state.timeLeft : this.state.elapsed) % 10 === 0) {
        this.saveSettings();
      }
    }
    
    /**
     * 完成一个番茄钟
     */
    async complete() {
      clearInterval(this.timer);
      this.timer = null;
      
      // 计算实际时长（秒）= 累计时间 + 当前段时间
      let actualDuration = this.state.accumulatedTime || 0;
      if (this.state.sessionStartTime) {
        actualDuration += Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
      }
      
      // 如果没有任何时间记录，使用计划时长
      if (actualDuration === 0) {
        actualDuration = this.state.workDuration;
      }
      
      // 计算换算的番茄钟数（按25分钟标准）
      const standardPomodoro = 25 * 60; // 25分钟 = 1500秒
      const pomodoroCount = actualDuration / standardPomodoro;
      
      // 整数显示用（向上取整）
      const previousCount = this.state.completedPomodoros;
      this.state.completedPomodoros++;
      
      // 保存详细历史记录
      await this.saveHistory({
        type: 'work',
        mode: this.state.sessionMode || this.state.mode,
        actualDuration: actualDuration,
        plannedDuration: this.state.workDuration,
        pomodoroCount: pomodoroCount,
        completed: true
      });
      
      // 通知
      this.showNotification('🍅 番茄钟完成！', '休息一下吧~');
      
      // 播放提示音
      this.playSound();
      
      // 检查是否达成每日目标（首次达成时祝贺）
      if (previousCount < this.state.dailyGoal && this.state.completedPomodoros >= this.state.dailyGoal) {
        setTimeout(async () => {
          await this.showGoalAchieved();
        }, 1000);  // 延迟1秒显示，避免与完成通知冲突
      }
      
      // 重置累计时间
      this.state.accumulatedTime = 0;
      
      // 根据设置决定是否自动进入休息模式
      if (this.state.autoBreak) {
        this.startBreak();
      } else {
        this.state.status = 'idle';
        this.state.timeLeft = this.state.workDuration;
        this.state.elapsed = 0;
        this.updateUI();
      }
      
      console.log('[番茄钟] 完成学习，模式:', this.state.sessionMode, 
                  '实际:', Math.floor(actualDuration/60), '分钟',
                  '番茄钟数:', pomodoroCount.toFixed(2), 
                  '总计:', this.state.completedPomodoros);
    }
    
    /**
     * 开始休息
     */
    startBreak() {
      this.state.status = 'break';
      this.state.timeLeft = this.state.breakDuration;
      this.state.sessionStartTime = Date.now();       // 记录休息开始时间
      this.state.sessionMode = 'countdown';           // 休息固定用倒计时
      this.updateUI();
      
      // 自动开始休息倒计时
      this.timer = setInterval(() => {
        this.tickBreak();
      }, 1000);
      
      console.log('[番茄钟] 开始休息');
    }
    
    /**
     * 休息倒计时
     */
    async tickBreak() {
      this.state.timeLeft--;
      
      if (this.state.timeLeft <= 0) {
        await this.completeBreak();
      }
      
      this.updateUI();
    }
    
    /**
     * 完成休息
     */
    async completeBreak() {
      clearInterval(this.timer);
      this.timer = null;
      this.state.status = 'idle';
      
      // 计算实际休息时长
      const actualDuration = this.state.sessionStartTime 
        ? Math.floor((Date.now() - this.state.sessionStartTime) / 1000)
        : this.state.breakDuration;
      
      // 保存休息记录（不计入番茄钟，单独统计）
      await this.saveHistory({
        type: 'break',
        mode: 'countdown',  // 休息固定倒计时
        actualDuration: actualDuration,
        plannedDuration: this.state.breakDuration,
        pomodoroCount: 0,   // 休息不计入番茄钟
        completed: true
      });
      
      // 通知
      this.showNotification('☕ 休息结束！', '准备开始新的专注时间~');
      
      // 播放提示音
      this.playSound();
      
      // 重置到工作时间
      this.state.timeLeft = this.state.workDuration;
      this.state.sessionStartTime = null;  // 清空会话时间
      this.updateUI();
      this.saveSettings();
      
      console.log('[番茄钟] 休息完成，时长:', Math.floor(actualDuration/60), '分钟');
    }
    
    /**
     * 保存历史记录
     * @param {Object|string} entry - 历史记录对象（新格式）或type字符串（旧格式，向后兼容）
     * @param {number} duration - 时长（秒），仅用于旧格式兼容
     */
    async saveHistory(entry, duration = null) {
      try {
        // 使用本地时间格式化，避免时区问题
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        
        // 兼容旧的调用方式：saveHistory('work', 1500)
        let historyEntry;
        if (typeof entry === 'string') {
          // 旧格式：转换为新格式
          console.warn('[番茄钟] 使用旧格式保存历史，建议升级');
          historyEntry = {
            type: entry,
            mode: this.state.mode,
            actualDuration: duration || 0,
            plannedDuration: duration || 0,
            pomodoroCount: entry === 'work' ? (duration / (25 * 60)) : 0,
            startTime: new Date(now - (duration || 0) * 1000).toISOString(),
            endTime: now.toISOString(),
            completed: true
          };
        } else {
          // 新格式：直接使用
          historyEntry = {
            type: entry.type,                    // 'work' | 'break'
            mode: entry.mode,                    // 'countdown' | 'countup'
            actualDuration: entry.actualDuration,     // 实际时长（秒）
            plannedDuration: entry.plannedDuration,   // 计划时长（秒）
            pomodoroCount: entry.pomodoroCount,       // 换算的番茄钟数
            startTime: new Date(now - entry.actualDuration * 1000).toISOString(),
            endTime: now.toISOString(),
            completed: entry.completed
          };
        }
        
        // 同时保存旧字段 duration 以确保完全兼容
        historyEntry.duration = historyEntry.actualDuration;
        
        // 获取今日历史
        const result = await chrome.storage.local.get('pomodoroHistory');
        const history = result.pomodoroHistory || {};
        
        if (!history[today]) {
          history[today] = [];
        }
        
        history[today].push(historyEntry);
        
        // 只保留最近30天的历史
        const dates = Object.keys(history).sort();
        if (dates.length > 30) {
          const oldDates = dates.slice(0, dates.length - 30);
          oldDates.forEach(date => delete history[date]);
        }
        
        await chrome.storage.local.set({ pomodoroHistory: history });
        
        console.log('[番茄钟] 历史记录已保存:', historyEntry);
      } catch (error) {
        console.error('[番茄钟] 保存历史失败:', error);
      }
    }
    
    /**
     * 更新UI
     */
    updateUI() {
      // 不重置className，使用classList管理状态类
      // 移除旧的工作状态类
      this.container.classList.remove('working', 'break');
      
      // 移除旧的显示模式类
      this.container.classList.remove('hidden', 'minimal-mode');
      
      // 应用当前显示模式
      if (this.state.displayMode === 'hidden') {
        this.container.classList.add('hidden');
        return; // 隐藏时无需更新其他UI
      } else if (this.state.displayMode === 'minimal') {
        this.container.classList.add('minimal-mode');
      }
      
      // 应用工作状态类
      if (this.state.status === 'working') {
        this.container.classList.add('working');
      } else if (this.state.status === 'break') {
        this.container.classList.add('break');
      }
      
      // 更新时间显示（简洁模式和完整模式都需要）
      if (this.display) {
        if (this.state.mode === 'countdown') {
          this.display.textContent = this.formatTime(this.state.timeLeft);
        } else {
          this.display.textContent = this.formatTime(this.state.elapsed);
        }
      }
      
      // 简洁模式只显示时间，不更新其他UI
      if (this.state.displayMode === 'minimal') {
        return;
      }
      
      // 以下是完整模式的UI更新
      
      // 更新进度条
      if (this.progressBar) {
        if (this.state.mode === 'countdown') {
          if (this.state.status === 'break') {
            const progress = (this.state.timeLeft / this.state.breakDuration) * 100;
            this.progressBar.style.width = `${progress}%`;
          } else {
            const progress = (this.state.timeLeft / this.state.workDuration) * 100;
            this.progressBar.style.width = `${progress}%`;
          }
        } else {
          const maxDisplay = 3600;
          const progress = Math.min((this.state.elapsed / maxDisplay) * 100, 100);
          this.progressBar.style.width = `${progress}%`;
        }
      }
      
      // 更新按钮（添加空值检查）
      const startBtn = this.container.querySelector('.pomodoro-start');
      const pauseBtn = this.container.querySelector('.pomodoro-pause');
      const completeBtn = this.container.querySelector('.pomodoro-complete');
      const resetBtn = this.container.querySelector('.pomodoro-reset');
      const modeBtn = this.container.querySelector('.pomodoro-mode');
      
      // 只有按钮都存在时才更新
      if (startBtn && pauseBtn && completeBtn && resetBtn && modeBtn) {
        if (this.state.status === 'working' || this.state.status === 'break') {
          startBtn.style.display = 'none';
          resetBtn.disabled = false;
          modeBtn.disabled = true;
          
          if (this.state.status === 'break') {
            pauseBtn.style.display = 'inline-block';
            completeBtn.style.display = 'none';
            pauseBtn.textContent = '跳过休息';
          } else {
            // 工作中：倒计时和正计时都显示"暂停"和"完成"双按钮
            pauseBtn.style.display = 'inline-block';
            pauseBtn.textContent = '暂停';
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '完成';
          }
        } else {
          startBtn.style.display = 'inline-block';
          pauseBtn.style.display = 'none';
          completeBtn.style.display = 'none';
          resetBtn.disabled = false;
          modeBtn.disabled = false;
          
          if (this.state.status === 'paused') {
            startBtn.textContent = '继续';
          } else {
            startBtn.textContent = '开始';
          }
        }
      }
      
      // 更新模式标签
      const modeLabel = this.container.querySelector('.pomodoro-mode-label');
      if (modeLabel) {
        if (this.state.status === 'break') {
          modeLabel.textContent = '☕ 休息中';
        } else {
          modeLabel.textContent = this.getModeLabel();
        }
      }
      
      // 更新统计和目标进度
      const statsText = this.container.querySelector('.pomodoro-stats .stats-text');
      const progressBar = this.container.querySelector('.goal-progress-bar');
      if (statsText) {
        statsText.textContent = `完成: ${this.state.completedPomodoros}/${this.state.dailyGoal} 个`;
      }
      if (progressBar) {
        const progress = Math.min(this.state.completedPomodoros / this.state.dailyGoal * 100, 100);
        progressBar.style.width = `${progress}%`;
      }
    }
    
    /**
     * 格式化时间
     */
    formatTime(seconds) {
      const minutes = Math.floor(Math.abs(seconds) / 60);
      const secs = Math.abs(seconds) % 60;
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * 获取模式标签
     */
    getModeLabel() {
      return this.state.mode === 'countdown' ? '倒计时' : '正计时';
    }
    
    /**
     * 显示通知（页面内轻量级通知，不会导致退出全屏）
     */
    showNotification(title, message) {
      // 创建轻量级通知元素
      const notification = document.createElement('div');
      notification.className = 'pomodoro-notification';
      notification.innerHTML = `
        <div class="notification-content">
          <strong>${title}</strong>
          <p>${message}</p>
        </div>
      `;
      
      // 添加到全屏元素或body（修复全屏模式下看不见的问题）
      const targetElement = document.fullscreenElement || document.body;
      targetElement.appendChild(notification);
      
      // 动画显示
      setTimeout(() => notification.classList.add('show'), 10);
      
      // 3秒后自动消失
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
      
      console.log('[番茄钟] 通知:', title, message);
    }
    
    /**
     * 显示自定义输入对话框（不会导致退出全屏）
     */
    async showInputDialog(title, message, defaultValue, min, max) {
      return new Promise((resolve) => {
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'pomodoro-dialog-overlay';
        dialog.innerHTML = `
          <div class="pomodoro-dialog">
            <div class="pomodoro-dialog-header">
              <h3>${title}</h3>
            </div>
            <div class="pomodoro-dialog-body">
              <p>${message}</p>
              <input type="number" class="pomodoro-input" 
                     value="${defaultValue}" min="${min}" max="${max}" 
                     placeholder="请输入${min}-${max}之间的数字">
            </div>
            <div class="pomodoro-dialog-footer">
              <button class="pomodoro-dialog-btn cancel">取消</button>
              <button class="pomodoro-dialog-btn confirm">确定</button>
            </div>
          </div>
        `;
        
        // 添加到全屏元素或body（修复全屏模式下看不见的问题）
        const targetElement = document.fullscreenElement || document.body;
        targetElement.appendChild(dialog);
        
        // 获取元素
        const input = dialog.querySelector('.pomodoro-input');
        const cancelBtn = dialog.querySelector('.cancel');
        const confirmBtn = dialog.querySelector('.confirm');
        
        // 自动聚焦并选中
        setTimeout(() => {
          input.focus();
          input.select();
        }, 100);
        
        // 键盘事件处理（需要清理）
        const handleInputKeydown = (e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') handleCancel();
        };
        
        // 取消
        const handleCancel = () => {
          input.removeEventListener('keydown', handleInputKeydown);  // 清理
          dialog.remove();
          resolve(null);
        };
        
        // 确认
        const handleConfirm = () => {
          input.removeEventListener('keydown', handleInputKeydown);  // 清理
          const value = parseInt(input.value);
          dialog.remove();
          resolve(value);
        };
        
        // 绑定事件
        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleConfirm);
        input.addEventListener('keydown', handleInputKeydown);
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) handleCancel();
        });
      });
    }
    
    /**
     * 显示确认对话框（不会导致退出全屏）
     */
    async showConfirmDialog(title, message) {
      return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'pomodoro-dialog-overlay';
        dialog.innerHTML = `
          <div class="pomodoro-dialog confirm">
            <div class="pomodoro-dialog-header">
              <h3>${title}</h3>
            </div>
            <div class="pomodoro-dialog-body">
              <p>${message}</p>
            </div>
            <div class="pomodoro-dialog-footer">
              <button class="pomodoro-dialog-btn cancel">取消</button>
              <button class="pomodoro-dialog-btn confirm">确定</button>
            </div>
          </div>
        `;
        
        // 添加到全屏元素或body（修复全屏模式下看不见的问题）
        const targetElement = document.fullscreenElement || document.body;
        targetElement.appendChild(dialog);
        
        const cancelBtn = dialog.querySelector('.cancel');
        const confirmBtn = dialog.querySelector('.confirm');
        
        // ESC键处理（需要清理）
        const handleKeydown = (e) => {
          if (e.key === 'Escape') handleCancel();
          if (e.key === 'Enter') handleConfirm();
        };
        
        const handleCancel = () => {
          document.removeEventListener('keydown', handleKeydown);
          dialog.remove();
          resolve(false);
        };
        
        const handleConfirm = () => {
          document.removeEventListener('keydown', handleKeydown);
          dialog.remove();
          resolve(true);
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleConfirm);
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) handleCancel();
        });
        
        // 绑定键盘
        document.addEventListener('keydown', handleKeydown);
      });
    }
    
    /**
     * 显示自定义提示对话框（不会导致退出全屏）
     */
    async showAlertDialog(title, message, isError = false) {
      return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'pomodoro-dialog-overlay';
        dialog.innerHTML = `
          <div class="pomodoro-dialog ${isError ? 'error' : 'success'}">
            <div class="pomodoro-dialog-header">
              <h3>${title}</h3>
            </div>
            <div class="pomodoro-dialog-body">
              <p>${message}</p>
            </div>
            <div class="pomodoro-dialog-footer">
              <button class="pomodoro-dialog-btn confirm">确定</button>
            </div>
          </div>
        `;
        
        // 添加到全屏元素或body（修复全屏模式下看不见的问题）
        const targetElement = document.fullscreenElement || document.body;
        targetElement.appendChild(dialog);
        
        const confirmBtn = dialog.querySelector('.confirm');
        
        // ESC键处理（需要清理）
        const handleKeydown = (e) => {
          if (e.key === 'Escape') {
            handleClose();
          }
        };
        
        const handleClose = () => {
          document.removeEventListener('keydown', handleKeydown);  // 清理
          dialog.remove();
          resolve();
        };
        
        confirmBtn.addEventListener('click', handleClose);
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) handleClose();
        });
        
        // 绑定ESC键
        document.addEventListener('keydown', handleKeydown);
      });
    }
    
    /**
     * 播放提示音
     */
    playSound() {
      // 创建简单的提示音
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
    
    /**
     * 处理全屏变化
     */
    handleFullscreenChange() {
      if (!this.container) return;
      
      if (document.fullscreenElement) {
        // 进入全屏：移动到全屏容器内
        try {
          // 保存当前位置（相对于viewport）
          const rect = this.container.getBoundingClientRect();
          this.fullscreenSavedPosition = {
            left: rect.left,
            top: rect.top
          };
          
          // 移动到全屏容器
          document.fullscreenElement.appendChild(this.container);
          
          // 强制最高z-index（高于播放器的10000）
          this.container.style.zIndex = '10001';
          
          // 禁用拖拽（避免坐标计算问题）
          if (this.isDragging) {
            this.stopDrag();
          }
          this.container.style.cursor = 'default';
          
          console.log('[番茄钟] 已移入全屏容器，z-index: 10001');
        } catch (error) {
          console.error('[番茄钟] 移入全屏容器失败:', error);
        }
      } else {
        // 退出全屏：移回body
        try {
          document.body.appendChild(this.container);
          
          // 恢复z-index
          this.container.style.zIndex = '999999';
          
          // 恢复拖拽
          this.container.style.cursor = '';
          
          // 恢复位置（如果保存过）
          if (this.fullscreenSavedPosition) {
            this.container.style.left = `${this.fullscreenSavedPosition.left}px`;
            this.container.style.top = `${this.fullscreenSavedPosition.top}px`;
            this.fullscreenSavedPosition = null;
          }
          
          console.log('[番茄钟] 已移回body');
        } catch (error) {
          console.error('[番茄钟] 移回body失败:', error);
        }
      }
    }
    
    /**
     * 显示/隐藏 - 循环切换三种模式（无通知，避免干扰）
     */
    toggle() {
      console.log('[番茄钟] toggle() 被调用，当前模式:', this.state.displayMode);
      
      // Full → Minimal → Hidden → Full
      if (this.state.displayMode === 'full') {
        this.state.displayMode = 'minimal';
        this.state.visible = true;
      } else if (this.state.displayMode === 'minimal') {
        this.state.displayMode = 'hidden';
        this.state.visible = false;
      } else {
        this.state.displayMode = 'full';
        this.state.visible = true;
      }
      
      this.updateUI();
      this.saveSettings();
      
      console.log('[番茄钟] 切换后模式:', this.state.displayMode);
    }
    
    /**
     * 隐藏 - 设置为hidden模式
     */
    hide() {
      this.state.displayMode = 'hidden';
      this.state.visible = false;
      if (this.container) {
        this.container.classList.add('hidden');
        this.container.classList.remove('minimal-mode');
      }
      this.saveSettings();
      console.log('[番茄钟] 已隐藏');
    }
    
    /**
     * 显示 - 恢复到完整模式
     */
    show() {
      this.state.visible = true;
      // 显示时恢复到完整模式
      if (this.state.displayMode === 'hidden') {
        this.state.displayMode = 'full';
      }
      
      if (this.container) {
        this.container.classList.remove('hidden');
        this.container.classList.remove('minimal-mode');
      } else {
        console.warn('[番茄钟] 容器不存在，尝试创建UI');
        // 如果容器不存在，尝试创建
        try {
          this.createUI();
          this.bindEvents();
        } catch (e) {
          console.error('[番茄钟] 创建UI失败:', e);
        }
      }
      this.saveSettings();
      console.log('[番茄钟] 已显示，模式:', this.state.displayMode);
    }
    
    /**
     * 开始拖拽
     */
    startDrag(e) {
      this.isDragging = true;
      const rect = this.container.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      // 添加拖拽状态类，产生悬浮效果
      this.container.classList.add('dragging');
      
      console.log('[番茄钟] 开始拖拽');
    }
    
    /**
     * 拖拽中
     */
    drag(e) {
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      
      // 限制在窗口内
      const maxX = window.innerWidth - this.container.offsetWidth;
      const maxY = window.innerHeight - this.container.offsetHeight;
      
      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));
      
      this.container.style.left = `${boundedX}px`;
      this.container.style.top = `${boundedY}px`;
      this.container.style.right = 'auto';  // 清除right定位，防止宽度计算冲突
    }
    
    /**
     * 停止拖拽
     */
    stopDrag() {
      this.isDragging = false;
      
      // 移除拖拽状态类，恢复正常状态
      this.container.classList.remove('dragging');
      
      // 保存位置
      this.state.position = {
        x: parseInt(this.container.style.left),
        y: parseInt(this.container.style.top)
      };
      this.saveSettings();
      
      console.log('[番茄钟] 拖拽结束，位置已保存:', this.state.position);
    }
  }
  
  // 创建全局实例
  window.pomodoroTimer = new PomodoroTimer();
  
  // // 备用全局快捷键（确保无论如何都能用快捷键控制）
  // document.addEventListener('keydown', (e) => {
  //   if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
  //     e.preventDefault();
  //     e.stopPropagation();
  //     if (window.pomodoroTimer && typeof window.pomodoroTimer.toggle === 'function') {
  //       console.log('[番茄钟] 全局快捷键触发');
  //       window.pomodoroTimer.toggle();
  //     }
  //   }
  // }, true);
  // console.log('[番茄钟] 全局快捷键已绑定 (Ctrl+Shift+T)');
  
  // 自动初始化
  if (location.pathname.includes('/video/')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[番茄钟] DOM加载完成，开始初始化');
        window.pomodoroTimer.initialize().catch(err => {
          console.error('[番茄钟] 初始化异常:', err);
        });
      });
    } else {
      console.log('[番茄钟] DOM已就绪，立即初始化');
      window.pomodoroTimer.initialize().catch(err => {
        console.error('[番茄钟] 初始化异常:', err);
      });
    }
  }
  
  console.log('[番茄钟] 模块加载完成');
})();

