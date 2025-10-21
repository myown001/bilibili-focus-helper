// study-recorder.js - 学习记录功能（使用 chrome.storage.local + 按周分片）

// 使用立即执行函数表达式(IIFE)创建模块化结构
(function() {
  'use strict';
  
  // ===== 存储管理器 - 处理按周分片存储 =====
  class StorageManager {
    /**
     * 获取指定日期所属的周键名
     * @param {string|Date} date - 日期
     * @returns {string} - 格式: study_2025_W42
     */
    static getWeekKey(date) {
      const d = typeof date === 'string' ? new Date(date) : date;
      const year = d.getFullYear();
      const week = this.getWeekNumber(d);
      return `study_${year}_W${String(week).padStart(2, '0')}`;
    }
    
    /**
     * 获取ISO 8601周数
     * @param {Date} date - 日期对象
     * @returns {number} - 周数 (1-53)
     */
    static getWeekNumber(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    /**
     * 获取格式化的日期字符串
     * @param {Date} date - 日期对象
     * @returns {string} - 格式: 2025-10-18
     */
    static getDateString(date = new Date()) {
      // 使用本地时间格式化，避免时区问题
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    /**
     * 保存指定日期的数据
     * @param {string} dateStr - 日期字符串
     * @param {Object} dayData - 当天的数据
     */
    static async saveDayData(dateStr, dayData) {
      const weekKey = this.getWeekKey(dateStr);
      
      // 读取当前周的数据
      const result = await chrome.storage.local.get(weekKey);
      const weekData = result[weekKey] || {};
      
      // 更新这一天的数据
      weekData[dateStr] = dayData;
      
      // 保存回去
      await chrome.storage.local.set({ [weekKey]: weekData });
      console.log(`[存储管理器] 已保存 ${dateStr} 的数据到 ${weekKey}`);
    }
    
    /**
     * 读取指定日期的数据
     * @param {string} dateStr - 日期字符串
     * @returns {Object|null} - 当天的数据
     */
    static async getDayData(dateStr) {
      const weekKey = this.getWeekKey(dateStr);
      const result = await chrome.storage.local.get(weekKey);
      const weekData = result[weekKey] || {};
      return weekData[dateStr] || null;
    }
    
    /**
     * 读取指定周的所有数据
     * @param {string} weekKey - 周键名
     * @returns {Object} - 该周的所有数据
     */
    static async getWeekData(weekKey) {
      const result = await chrome.storage.local.get(weekKey);
      return result[weekKey] || {};
    }
  }
  
  // ===== 索引管理器 - 维护视频索引 =====
  class IndexManager {
    /**
     * 更新视频索引
     * @param {string} videoId - 视频BV号
     * @param {string} dateStr - 日期字符串
     * @param {string} videoTitle - 视频标题（可选）
     */
    static async updateVideoIndex(videoId, dateStr, videoTitle = '') {
      if (!videoId) return;
      
      const result = await chrome.storage.local.get('index_videos');
      const index = result.index_videos || {};
      
      if (!index[videoId]) {
        // 初始化视频信息
        index[videoId] = {
          title: videoTitle,
          dates: []
        };
      }
      
      // 更新标题（如果提供了新标题）
      if (videoTitle && !index[videoId].title) {
        index[videoId].title = videoTitle;
      }
      
      // 确保dates是数组（兼容旧数据）
      if (!Array.isArray(index[videoId].dates)) {
        if (Array.isArray(index[videoId])) {
          // 旧格式：直接是日期数组
          index[videoId] = {
            title: videoTitle,
            dates: index[videoId]
          };
        } else {
          index[videoId].dates = [];
        }
      }
      
      // 添加日期（避免重复）
      if (!index[videoId].dates.includes(dateStr)) {
        index[videoId].dates.push(dateStr);
        // 保持排序
        index[videoId].dates.sort();
      }
      
      await chrome.storage.local.set({ index_videos: index });
    }
    
    /**
     * 获取视频的所有学习日期
     * @param {string} videoId - 视频BV号
     * @returns {string[]} - 日期列表
     */
    static async getVideoDates(videoId) {
      const result = await chrome.storage.local.get('index_videos');
      const index = result.index_videos || {};
      const videoData = index[videoId];
      
      // 兼容旧格式（直接是数组）和新格式（对象）
      if (Array.isArray(videoData)) {
        return videoData;
      } else if (videoData && videoData.dates) {
        return videoData.dates;
      }
      return [];
    }
  }
  
  // ===== 汇总管理器 - 维护汇总统计 =====
  class SummaryManager {
    /**
     * 更新月度汇总
     * @param {string} dateStr - 日期字符串
     * @param {Object} dayData - 当天数据
     */
    static async updateMonthlySummary(dateStr, dayData) {
      const [year, month] = dateStr.split('-');
      const monthKey = `summary_${year}_${month}`;
      
      const result = await chrome.storage.local.get(monthKey);
      const summary = result[monthKey] || {
        total: 0,
        effective: 0,
        days: 0,
        videoCount: 0
      };
      
      // 更新汇总数据
      summary.total = (summary.total || 0) + (dayData.t || 0);
      summary.effective = (summary.effective || 0) + (dayData.e || 0);
      summary.days = (summary.days || 0) + 1;
      
      // 统计视频数
      if (dayData.v) {
        const videoSet = new Set(Object.keys(dayData.v));
        summary.videoCount = videoSet.size;
      }
      
      await chrome.storage.local.set({ [monthKey]: summary });
    }
    
    /**
     * 更新全局汇总
     * @param {string} dateStr - 日期字符串
     * @param {Object} dayData - 当天数据
     */
    static async updateGlobalSummary(dateStr, dayData) {
      const result = await chrome.storage.local.get('summary_all');
      const summary = result.summary_all || {
        totalAllTime: 0,
        totalEffective: 0,
        totalDays: 0,
        totalVideos: 0,
        firstDay: dateStr,
        lastDay: dateStr,
        focusQuality: 0
      };
      
      // 更新数据
      summary.totalAllTime += dayData.t || 0;
      summary.totalEffective += dayData.e || 0;
      summary.totalDays = (summary.totalDays || 0) + 1;
      
      // 更新日期范围
      if (!summary.firstDay || dateStr < summary.firstDay) {
        summary.firstDay = dateStr;
      }
      if (!summary.lastDay || dateStr > summary.lastDay) {
        summary.lastDay = dateStr;
      }
      
      // 计算专注度
      if (summary.totalAllTime > 0) {
        summary.focusQuality = summary.totalEffective / summary.totalAllTime;
      }
      
      await chrome.storage.local.set({ summary_all: summary });
    }
  }
  
  // ===== 视频学习记录器类 =====
  /**
   * 学习时间记录器
   * 负责记录用户在B站视频页面的学习时间和统计数据
   */
  class StudyRecorder {
    constructor() {
      this.data = {
        startTime: Date.now(),
        totalTime: 0,             // 总停留时间（秒）
        effectiveTime: 0,         // 有效学习时间（秒）
        pauseCount: 0,            // 暂停次数
        exitFullscreenCount: 0,   // 退出全屏次数（新增）
        switchCount: 0,           // 标签切换次数（新增）
        continuousViewTime: 0,    // 连续观看时间（秒）
        longestSession: 0,        // 最长单次学习时间（秒）
      };
      
      // 每个视频的单独统计
      this.videoData = {};        // { videoId: { time: 0, title: '', startTime: '' } }
      
      this.state = {
        isPaused: true,           // 默认视频暂停状态
        isVisible: true,          // 默认页面可见状态
        isFocused: true,          // 默认页面聚焦状态
        wasVisible: true,         // 上次页面可见状态（用于检测切换）
        lastPauseTime: 0,         // 上次暂停时间
        lastPlayTime: 0,          // 上次播放时间
        lastUpdate: Date.now(),   // 上次更新时间
        currentVideoTitle: '',    // 当前视频标题
        currentVideoId: '',       // 当前视频ID
        currentVideoStartTime: '', // 当前视频开始学习时间
        isRecording: false,       // 是否正在记录
        isDestroyed: false        // 是否已销毁
      };
      
      // 防抖定时器
      this.timers = {
        saveTimer: null,          // 保存数据的定时器
        updateTimer: null         // 更新数据的定时器
      };
      
      this.settings = {
        autoSaveInterval: 30000   // 自动保存间隔（30秒）
      };
      
      // 绑定方法
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
      this.handleWindowFocus = this.handleWindowFocus.bind(this);
      this.handleWindowBlur = this.handleWindowBlur.bind(this);
      this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
      
      console.log('[学习记录] StudyRecorder实例已创建');
    }
    
    /**
     * 初始化记录器
     */
    initialize() {
      if (this.state.isRecording) {
        return true;
      }
      
      try {
        // 设置页面可见性监听
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // 设置窗口焦点监听
        window.addEventListener('focus', this.handleWindowFocus);
        window.addEventListener('blur', this.handleWindowBlur);
        
        // 设置全屏变化监听（新增）
        document.addEventListener('fullscreenchange', this.handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', this.handleFullscreenChange);
        
        // 设置视频播放状态监听
        this.setupVideoMonitoring();
        
        // 开始定期更新
        this.setupPeriodicUpdate();
        
        // 获取当前视频信息
        this.updateVideoInfo();
        
        // 加载历史数据
        this.loadData();
        
        // 标记为已启动
        this.state.isRecording = true;
        
        // 监听页面离开
        window.addEventListener('beforeunload', () => {
          this.saveData();
        });
        
        console.log('[学习记录] 初始化完成');
        return true;
      } catch (err) {
        console.error('[学习记录] 初始化失败:', err);
        return false;
      }
    }
    
    /**
     * 设置视频监控
     */
    setupVideoMonitoring() {
      const checkVideo = () => {
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) {
          videos.forEach(video => {
            // 避免重复监听
            if (video._studyRecorderMonitored) {
              return;
            }
            
            // 标记已监听
            video._studyRecorderMonitored = true;
            
            // 监听播放事件
            video.addEventListener('play', () => this.handleVideoPlay(video));
            video.addEventListener('playing', () => this.handleVideoPlay(video));
            
            // 监听暂停事件
            video.addEventListener('pause', () => this.handleVideoPause(video));
            video.addEventListener('waiting', () => this.handleVideoPause(video));
            video.addEventListener('stalled', () => this.handleVideoPause(video));
            
            // 监听结束事件
            video.addEventListener('ended', () => this.handleVideoEnd(video));
            
            // 监听进度变化
            video.addEventListener('timeupdate', () => this.handleTimeUpdate(video));
            
            // 检查初始状态
            if (video.readyState >= 3 && !video.paused && !video.ended) {
              this.handleVideoPlay(video);
            } else {
              this.handleVideoPause(video);
            }
          });
          
          // 返回找到视频
          return true;
        }
        
        // 没有找到视频
        return false;
      };
      
      // 立即检查一次
      if (!checkVideo()) {
        // 如果没找到视频，设置MutationObserver等待视频加载
        const observer = new MutationObserver((mutations) => {
          if (checkVideo()) {
            observer.disconnect();
            console.log('[学习记录] 视频已监控');
          }
        });
        
        // 监听DOM变化
        observer.observe(document.body, {
          childList: true, 
          subtree: true
        });
        
        // 30秒后停止监听
        setTimeout(() => {
          observer.disconnect();
        }, 30000);
      }
    }
    
    /**
     * 设置定期更新
     */
    setupPeriodicUpdate() {
      // 清除现有定时器
      if (this.timers.updateTimer) {
        clearInterval(this.timers.updateTimer);
      }
      
      // 每秒更新一次数据
      this.timers.updateTimer = setInterval(() => {
        this.update();
      }, 1000);
      
      // 定期保存（30秒）
      if (this.timers.saveTimer) {
        clearInterval(this.timers.saveTimer);
      }
      this.timers.saveTimer = setInterval(() => {
          this.saveData();
      }, this.settings.autoSaveInterval);
    }
    
    /**
     * 处理视频播放
     */
    handleVideoPlay(video) {
      const now = Date.now();
      
      // 更新状态
      this.state.isPaused = false;
      this.state.lastPlayTime = now;
      
      // 计算暂停时长
      if (this.state.lastPauseTime > 0) {
        const pauseDuration = (now - this.state.lastPauseTime) / 1000;
        
        // 如果暂停超过10秒，记录为新会话
        if (pauseDuration > 10) {
          this.data.activeSessions++;
        }
      }
      
      console.log('[学习记录] 视频播放');
      
      // 更新数据
      this.update();
    }
    
    /**
     * 处理视频暂停
     */
    handleVideoPause(video) {
      const now = Date.now();
      
      // 更新状态
      this.state.isPaused = true;
      this.state.lastPauseTime = now;
      
      // 增加暂停计数
      this.data.pauseCount++;
      
      console.log('[学习记录] 视频暂停');
      
      // 更新数据
      this.update();
    }
    
    /**
     * 处理视频结束
     */
    handleVideoEnd(video) {
      // 视频结束等同于暂停
      this.handleVideoPause(video);
      
      // 保存学习数据
      this.saveData();
    }
    
    /**
     * 处理视频时间更新
     */
    handleTimeUpdate(video) {
      // 如果视频在播放中，更新连续观看时间
      if (!this.state.isPaused && this.state.isVisible && this.state.isFocused) {
        const now = Date.now();
        const elapsed = (now - this.state.lastUpdate) / 1000;
        
        if (elapsed > 0 && elapsed < 5) {  // 防止异常大的时间差
          this.data.continuousViewTime += elapsed;
          
          // 更新最长会话时间
          if (this.data.continuousViewTime > this.data.longestSession) {
            this.data.longestSession = this.data.continuousViewTime;
          }
        }
        
        // 5秒一次，减少性能影响
        if (Math.random() < 0.2) {
          this.updateVideoInfo();
        }
      }
    }
    
    /**
     * 更新视频信息
     */
    updateVideoInfo() {
      try {
        // 尝试获取视频标题
        const titleElements = [
          document.querySelector('.video-title, .media-title, h1.title'),
          document.querySelector('h1'),
          document.querySelector('title')
        ];
        
        for (const element of titleElements) {
          if (element && element.textContent.trim()) {
            this.state.currentVideoTitle = element.textContent.trim();
            break;
          }
        }
        
        // 尝试从URL获取视频ID
        const match = location.pathname.match(/\/video\/(av\d+|BV[\w]+)/i) || 
                      location.href.match(/\/av(\d+)/i) ||
                      location.href.match(/\/BV([\w]+)/i);
        
        if (match) {
          this.state.currentVideoId = match[1];
        }
      } catch (err) {
        console.error('[学习记录] 更新视频信息失败:', err);
      }
    }
    
    /**
     * 处理页面可见性变化（记录标签切换）
     */
    handleVisibilityChange() {
      const wasVisible = this.state.wasVisible;
      this.state.isVisible = !document.hidden;
      
      // 检测到标签切换（从可见变为不可见）
      if (wasVisible && !this.state.isVisible) {
        this.data.switchCount++;
        console.log(`[学习记录] 标签切换，切换次数: ${this.data.switchCount}`);
      }
      
      // 更新上次状态
      this.state.wasVisible = this.state.isVisible;
      
      console.log(`[学习记录] 页面可见性变化: ${this.state.isVisible ? '可见' : '不可见'}`);
      this.update();
    }
    
    /**
     * 处理窗口获得焦点
     */
    handleWindowFocus() {
      this.state.isFocused = true;
      console.log('[学习记录] 窗口获得焦点');
      this.update();
    }
    
    /**
     * 处理窗口失去焦点
     */
    handleWindowBlur() {
      this.state.isFocused = false;
      console.log('[学习记录] 窗口失去焦点');
      this.update();
    }
    
    /**
     * 处理全屏变化（记录退出全屏）
     */
    handleFullscreenChange() {
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      
      // 检测到退出全屏
      if (!isFullscreen) {
        this.data.exitFullscreenCount++;
        console.log(`[学习记录] 退出全屏，退出次数: ${this.data.exitFullscreenCount}`);
        // 退出全屏立即保存
        this.saveData();
      }
    }
    
    /**
     * 更新记录
     */
    update() {
      const now = Date.now();
      const elapsed = (now - this.state.lastUpdate) / 1000;
      
      if (elapsed <= 0 || elapsed > 60) {
        // 忽略异常的时间差
        this.state.lastUpdate = now;
        return;
      }
      
      // 总时间始终增加
      this.data.totalTime += elapsed;
      
      // 有效学习时间仅在视频播放、页面可见且窗口聚焦时增加
      if (!this.state.isPaused && this.state.isVisible && this.state.isFocused) {
        this.data.effectiveTime += elapsed;
        
        // 为当前视频累加时长
        if (this.state.currentVideoId) {
          if (!this.videoData[this.state.currentVideoId]) {
            this.videoData[this.state.currentVideoId] = {
              time: 0,
              title: this.state.currentVideoTitle || this.state.currentVideoId,
              startTime: this.state.currentVideoStartTime || new Date().toISOString()
            };
          }
          this.videoData[this.state.currentVideoId].time += elapsed;
        }
        
        // 重置连续观看计时
        if (elapsed > 10) {
          this.data.continuousViewTime = 0;
        }
      } else {
        // 如果不是有效学习状态，重置连续观看时间
        this.data.continuousViewTime = 0;
      }
      
      // 更新时间戳
      this.state.lastUpdate = now;
    }
    
    /**
     * 加载历史数据
     */
    async loadData() {
      try {
        // 检查扩展上下文是否有效
        if (!chrome.storage || !chrome.storage.local) {
          console.warn('[学习记录] 扩展上下文已失效，跳过加载');
          return;
        }
        
        const today = StorageManager.getDateString();
        
        // 从 chrome.storage.local 加载今日数据
        const dayData = await StorageManager.getDayData(today);
        
        if (dayData) {
          // 合并今日已有数据（不重置，累加）
          this.data.totalTime += dayData.t || 0;
          this.data.effectiveTime += dayData.e || 0;
          this.data.pauseCount += dayData.p || 0;
          this.data.exitFullscreenCount += dayData.x || 0;
          this.data.switchCount += dayData.s || 0;
            
            // 保留最大值
          if (dayData.l > this.data.longestSession) {
            this.data.longestSession = dayData.l;
            }
          
          // 加载已有的视频数据
          if (dayData.v) {
            for (const videoId in dayData.v) {
              const videoInfo = dayData.v[videoId];
              this.videoData[videoId] = {
                time: videoInfo.d || 0,
                title: videoInfo.ti || videoId,
                startTime: videoInfo.st || ''
              };
            }
          }
            
          console.log('[学习记录] 已加载今日历史数据:', dayData);
        } else {
          console.log('[学习记录] 今日无历史数据，开始新记录');
        }
      } catch (err) {
        console.error('[学习记录] 加载历史数据失败:', err);
      }
    }
    
    /**
     * 保存学习数据
     */
    async saveData() {
      try {
        // 防止已销毁的实例继续保存
        if (this.state.isDestroyed) {
          return;
        }
        
        // 检查扩展上下文是否有效
        if (!chrome.storage || !chrome.storage.local) {
          console.warn('[学习记录] 扩展上下文已失效，停止保存');
          return;
        }
        
        // 更新最新数据
        this.update();
        
        const today = StorageManager.getDateString();
        const now = new Date();
        
        // 先读取今日已有数据，保留视频列表
        const existingData = await StorageManager.getDayData(today);
        const existingVideos = (existingData && existingData.v) ? existingData.v : {};
        
        // 准备当天数据（使用简化键名节省空间）
        const dayData = {
          t: Math.floor(this.data.totalTime),              // total 总时长
          e: Math.floor(this.data.effectiveTime),          // effective 有效时长
          p: this.data.pauseCount,                         // pauseCount 暂停次数
          x: this.data.exitFullscreenCount,                // exitCount 退出全屏次数
          s: this.data.switchCount,                        // switchCount 标签切换次数
          l: Math.floor(this.data.longestSession),         // longestSession 最长连续
          v: { ...existingVideos }                         // 保留已有的视频列表
        };
        
        // 更新所有视频的信息（保留历史+添加新的）
        for (const videoId in this.videoData) {
          const videoInfo = this.videoData[videoId];
          dayData.v[videoId] = {
            ti: videoInfo.title,                                // title
            d: Math.floor(videoInfo.time),                      // duration（使用该视频的实际时长）
            st: videoInfo.startTime                             // startTime
          };
        }
        
        // 保存到按周分片的存储
        await StorageManager.saveDayData(today, dayData);
        
        // 更新视频索引（包含标题）
        if (this.state.currentVideoId) {
          await IndexManager.updateVideoIndex(
            this.state.currentVideoId, 
            today, 
            this.state.currentVideoTitle || ''
          );
        }
        
        // 更新汇总数据
        await SummaryManager.updateMonthlySummary(today, dayData);
        await SummaryManager.updateGlobalSummary(today, dayData);
        
        console.log('[学习记录] 数据已保存到 chrome.storage.local');
      } catch (err) {
        // 处理扩展上下文失效错误
        if (err.message && err.message.includes('Extension context invalidated')) {
          console.warn('[学习记录] 扩展已重新加载，停止当前记录器');
          this.destroy();
          return;
        }
        console.error('[学习记录] 保存数据失败:', err);
      }
    }
    
    /**
     * 获取总时间
     */
    getTotalDuration() {
      this.update();
      return this.data.totalTime;
    }
    
    /**
     * 获取有效学习时间
     */
    getEffectiveDuration() {
      this.update();
      return this.data.effectiveTime;
    }
    
    /**
     * 重置计时器
     */
    reset() {
      // 保存现有数据
      this.saveData();
      
      // 重置数据
      this.data = {
        startTime: Date.now(),
        totalTime: 0,
        effectiveTime: 0,
        pauseCount: 0,
        exitFullscreenCount: 0,
        switchCount: 0,
        continuousViewTime: 0,
        longestSession: 0
      };
      
      // 重置状态
      this.state.lastUpdate = Date.now();
      
      console.log('[学习记录] 计时器已重置');
    }
    
    /**
     * 销毁计时器
     */
    destroy() {
      // 防止重复销毁
      if (this.state.isDestroyed) {
        return;
      }
      this.state.isDestroyed = true;
      
      // 尝试保存数据（如果上下文有效）
      if (chrome.storage && chrome.storage.local) {
        this.saveData();
      }
      
      // 清除所有定时器
      Object.values(this.timers).forEach(timer => {
        if (timer) {
          clearInterval(timer);
          clearTimeout(timer);
        }
      });
      
      // 移除事件监听
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('blur', this.handleWindowBlur);
      document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', this.handleFullscreenChange);
      
      // 重置状态
      this.state.isRecording = false;
      
      console.log('[学习记录] 计时器已销毁');
    }
    
    /**
     * 调试工具：查看存储的数据
     */
    async debugShowData() {
      try {
        const today = StorageManager.getDateString();
        const weekKey = StorageManager.getWeekKey(today);
        
        console.log('=== 学习记录数据查看 ===');
        console.log('📅 当前日期:', today);
        console.log('📦 当前周键:', weekKey);
        
        // 获取今日数据
        const dayData = await StorageManager.getDayData(today);
        console.log('\n📊 今日数据:', dayData);
        
        if (dayData) {
          console.log('  - 总时长:', Math.floor(dayData.t / 60), '分钟', dayData.t % 60, '秒');
          console.log('  - 有效时长:', Math.floor(dayData.e / 60), '分钟', dayData.e % 60, '秒');
          console.log('  - 暂停次数:', dayData.p);
          console.log('  - 退出全屏次数:', dayData.x);
          console.log('  - 标签切换次数:', dayData.s);
          console.log('  - 最长连续:', Math.floor(dayData.l / 60), '分钟');
          console.log('  - 学习视频:', Object.keys(dayData.v || {}).length, '个');
          if (dayData.v) {
            Object.entries(dayData.v).forEach(([videoId, info]) => {
              console.log(`    * ${videoId}: ${info.ti} (${Math.floor(info.d / 60)}分钟)`);
            });
          }
        }
        
        // 获取当前内存中的数据
        console.log('\n💾 当前内存数据:');
        console.log('  - 总时长:', Math.floor(this.data.totalTime / 60), '分钟');
        console.log('  - 有效时长:', Math.floor(this.data.effectiveTime / 60), '分钟');
        console.log('  - 暂停次数:', this.data.pauseCount);
        console.log('  - 退出全屏次数:', this.data.exitFullscreenCount);
        console.log('  - 标签切换次数:', this.data.switchCount);
        
        // 获取视频索引
        const result = await chrome.storage.local.get('index_videos');
        console.log('\n🎬 视频索引:', result.index_videos);
        
        // 获取月度汇总
        const [year, month] = today.split('-');
        const monthKey = `summary_${year}_${month}`;
        const monthResult = await chrome.storage.local.get(monthKey);
        console.log('\n📈 月度汇总:', monthResult[monthKey]);
        
        // 获取全局汇总
        const summaryResult = await chrome.storage.local.get('summary_all');
        console.log('\n🌍 全局汇总:', summaryResult.summary_all);
        
        console.log('\n======================');
        
        return {
          today: dayData,
          memory: this.data,
          index: result.index_videos,
          monthly: monthResult[monthKey],
          global: summaryResult.summary_all
        };
      } catch (err) {
        console.error('[学习记录] 调试工具出错:', err);
      }
    }
  }
  
  // 创建全局实例
  window.studyRecorder = new StudyRecorder();
  
  // 自动初始化（仅在视频页面）
  if (location.pathname.includes('/video/')) {
    // 等待DOM完全加载后初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[学习记录] DOM加载完成，开始初始化');
        window.studyRecorder.initialize();
      });
    } else {
      // DOM已经加载完成，直接初始化
      console.log('[学习记录] DOM已就绪，立即初始化');
      window.studyRecorder.initialize();
    }
  }
})();