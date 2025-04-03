// optimized-study-recorder.js - 优化版视频学习记录功能

// 使用立即执行函数表达式(IIFE)创建模块化结构
(function() {
  'use strict';
  
  // ===== 工具函数 =====
  const Utils = {
    // 防抖函数 - 用于处理频繁触发的事件
    debounce: function(func, wait) {
      let timeout;
      return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    },
    
    // 节流函数 - 限制函数在一定时间内只执行一次
    throttle: function(func, limit) {
      let inThrottle;
      return function(...args) {
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
    
    // 安全地获取DOM元素
    getElement: function(selector) {
      try {
        return document.querySelector(selector);
      } catch (error) {
        console.error(`获取元素失败: ${selector}`, error);
        return null;
      }
    },
    
    // 安全地添加事件监听器
    addEvent: function(element, event, handler, options = {}) {
      if (!element) return false;
      try {
        element.addEventListener(event, handler, options);
        return true;
      } catch (error) {
        console.error(`添加事件监听器失败: ${event}`, error);
        return false;
      }
    },
    
    // 安全地发送消息到background.js
    sendMessage: function(message, callback) {
      try {
        chrome.runtime.sendMessage(message, callback || function() {});
      } catch (error) {
        console.error('发送消息失败:', error);
      }
    },
    
    // 日志记录函数 - 可以根据环境切换是否显示日志
    log: function(message, data, type = 'log') {
      const DEBUG = true; // 设置为false可以在生产环境中禁用日志
      if (!DEBUG) return;
      
      switch (type) {
        case 'error':
          console.error(message, data || '');
          break;
        case 'warn':
          console.warn(message, data || '');
          break;
        case 'info':
          console.info(message, data || '');
          break;
        default:
          console.log(message, data || '');
      }
    }
  };
  
  // ===== 视频学习记录器类 =====
  class StudyRecorder {
    constructor() {
      // 基本状态
      this.isRecording = false;
      this.startTime = null;
      this.pauseTime = null;
      this.totalPausedTime = 0;
      this.videoId = null;
      this.videoTitle = null;
      this.playbackRate = 1.0;
      this.checkInterval = null;
      this.lastActiveTime = null;
      
      // 配置参数
      this.config = {
        inactiveThreshold: 60000, // 60秒无操作视为不活跃
        minRecordDuration: 10,    // 最小记录时长（秒）
        activityCheckInterval: 5000, // 活动检查间隔（毫秒）
        videoSelectors: [
          '.bpx-player-video video', 
          '#bilibili-player video', 
          '.player-container video', 
          '.bilibili-player-video video',
          'video'
        ]
      };
      
      // 绑定方法到实例
      this.start = this.start.bind(this);
      this.pause = this.pause.bind(this);
      this.resume = this.resume.bind(this);
      this.stop = this.stop.bind(this);
      this.onUserActivity = this.onUserActivity.bind(this);
      this.checkUserActivity = this.checkUserActivity.bind(this);
      this.getEffectiveDuration = this.getEffectiveDuration.bind(this);
      this.handleVideoEvents = this.handleVideoEvents.bind(this);
      this.findVideoElement = this.findVideoElement.bind(this);
      
      // 初始化
      this.init();
    }
    
    // 初始化函数
    init() {
      // 初始化用户活动监听 - 使用事件委托减少事件监听器数量
      this.initActivityTracking();
      
      // 等待DOM加载完成
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupVideoTracking());
      } else {
        this.setupVideoTracking();
      }
      
      // 监听页面可见性变化
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // 页面不可见时暂停记录
          if (this.isRecording && !this.pauseTime) {
            Utils.log('页面不可见，暂停学习记录');
            this.pause();
          }
        } else {
          // 页面可见时恢复记录
          if (this.isRecording && this.pauseTime) {
            Utils.log('页面重新可见，恢复学习记录');
            this.resume();
          }
        }
      });
      
      // 监听页面卸载事件，确保记录被保存
      window.addEventListener('beforeunload', () => {
        if (this.isRecording) {
          this.stop();
        }
      });
    }
    
    // 设置视频跟踪
    setupVideoTracking() {
      // 使用MutationObserver监听DOM变化，自动检测视频元素
      const observer = new MutationObserver(Utils.debounce(() => {
        const videoElement = this.findVideoElement();
        if (videoElement && !videoElement._studyRecorderInitialized) {
          this.handleVideoEvents(videoElement);
          videoElement._studyRecorderInitialized = true;
        }
      }, 500));
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // 立即检查一次
      const videoElement = this.findVideoElement();
      if (videoElement) {
        this.handleVideoEvents(videoElement);
        videoElement._studyRecorderInitialized = true;
      }
    }
    
    // 查找视频元素
    findVideoElement() {
      for (const selector of this.config.videoSelectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
      return null;
    }
    
    // 处理视频事件
    handleVideoEvents(videoElement) {
      if (!videoElement) return;
      
      // 提取视频信息
      this.videoId = this.extractVideoId();
      this.videoTitle = this.extractVideoTitle();
      
      Utils.log('发现视频元素', {
        videoId: this.videoId,
        title: this.videoTitle
      });
      
      // 使用事件委托处理视频事件
      const handlePlay = Utils.debounce(() => {
        if (!this.isRecording) {
          this.start(videoElement);
        } else if (this.pauseTime) {
          this.resume();
        }
      }, 300);
      
      const handlePause = Utils.debounce(() => {
        if (this.isRecording && !this.pauseTime) {
          this.pause();
        }
      }, 300);
      
      const handleEnded = () => {
        if (this.isRecording) {
          this.stop();
        }
      };
      
      const handleRateChange = () => {
        if (this.isRecording) {
          this.playbackRate = videoElement.playbackRate || 1.0;
          Utils.log('播放速率变更', this.playbackRate);
        }
      };
      
      // 添加事件监听器
      Utils.addEvent(videoElement, 'play', handlePlay);
      Utils.addEvent(videoElement, 'pause', handlePause);
      Utils.addEvent(videoElement, 'ended', handleEnded);
      Utils.addEvent(videoElement, 'ratechange', handleRateChange);
      
      // 如果视频已经在播放，立即开始记录
      if (videoElement.paused === false) {
        handlePlay();
      }
    }
    
    // 初始化用户活动跟踪
    initActivityTracking() {
      // 使用事件委托减少事件监听器数量
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      
      // 使用事件委托，只在document上添加一个监听器
      activityEvents.forEach(eventType => {
        document.addEventListener(eventType, this.onUserActivity, { passive: true });
      });
      
      // 初始化最后活动时间
      this.lastActiveTime = Date.now();
    }
    
    // 用户活动事件处理 - 使用节流函数减少处理频率
    onUserActivity() {
      this.lastActiveTime = Date.now();
    }
    
    // 检查用户活动状态
    checkUserActivity() {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActiveTime;
      
      // 如果用户长时间不活跃且正在记录，暂停记录
      if (timeSinceLastActivity > this.config.inactiveThreshold && this.isRecording && !this.pauseTime) {
        Utils.log('用户不活跃，暂停学习记录');
        this.pause();
      }
      // 如果用户重新活跃且记录被暂停，恢复记录
      else if (timeSinceLastActivity <= this.config.inactiveThreshold && this.isRecording && this.pauseTime) {
        Utils.log('用户重新活跃，恢复学习记录');
        this.resume();
      }
    }
    
    // 提取视频ID
    extractVideoId() {
      const url = window.location.href;
      let videoId = '';
      
      // 匹配B站视频ID (BV开头的ID)
      const bvMatch = url.match(/\/video\/([A-Za-z0-9]+)/);
      if (bvMatch && bvMatch[1]) {
        videoId = bvMatch[1];
      }
      
      // 匹配番剧ID
      const bangumiMatch = url.match(/\/bangumi\/play\/([A-Za-z0-9]+)/);
      if (bangumiMatch && bangumiMatch[1]) {
        videoId = 'bangumi_' + bangumiMatch[1];
      }
      
      // 匹配课程ID
      const cheeseMatch = url.match(/\/cheese\/play\/([A-Za-z0-9]+)/);
      if (cheeseMatch && cheeseMatch[1]) {
        videoId = 'cheese_' + cheeseMatch[1];
      }
      
      return videoId || 'unknown_' + Date.now();
    }
    
    // 提取视频标题
    extractVideoTitle() {
      // 尝试从页面元素中获取标题
      const titleSelectors = [
        '.video-title', 
        '.media-title', 
        'h1',
        '.tit'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          return titleElement.textContent.trim();
        }
      }
      
      // 如果找不到标题元素，使用文档标题
      const docTitle = document.title;
      // 移除B站后缀
      return docTitle.replace(/_哔哩哔哩_bilibili$/, '').trim() || '未知视频';
    }
    
    // 开始记录
    start(videoElement) {
      if (this.isRecording) return;
      
      // 提取视频信息
      this.videoId = this.extractVideoId();
      this.videoTitle = this.extractVideoTitle();
      this.playbackRate = videoElement ? videoElement.playbackRate : 1.0;
      
      Utils.log(`开始记录学习: ${this.videoTitle} (${this.videoId})`);
      
      this.isRecording = true;
      this.startTime = new Date();
      this.pauseTime = null;
      this.totalPausedTime = 0;
      this.lastActiveTime = Date.now();
      
      // 启动定期检查
      this.checkInterval = setInterval(
        this.checkUserActivity, 
        this.config.activityCheckInterval
      );
    }
    
    // 暂停记录
    pause() {
      if (!this.isRecording || this.pauseTime) return;
      
      this.pauseTime = new Date();
      Utils.log('学习记录已暂停');
    }
    
    // 恢复记录
    resume() {
      if (!this.isRecording || !this.pauseTime) return;
      
      const pauseDuration = (new Date() - this.pauseTime) / 1000;
      this.totalPausedTime += pauseDuration;
      this.pauseTime = null;
      Utils.log(`学习记录已恢复，暂停了 ${Math.round(pauseDuration)} 秒`);
    }
    
    // 停止记录并保存
    stop() {
      if (!this.isRecording) return;
      
      // 如果当前处于暂停状态，计算暂停时间
      if (this.pauseTime) {
        const pauseDuration = (new Date() - this.pauseTime) / 1000;
        this.totalPausedTime += pauseDuration;
        this.pauseTime = null;
      }
      
      clearInterval(this.checkInterval);
      
      const endTime = new Date();
      const rawDuration = (endTime - this.startTime) / 1000; // 秒
      const effectiveDuration = this.getEffectiveDuration();
      
      Utils.log(`停止记录学习: 总时长 ${Math.round(rawDuration)} 秒，有效时长 ${Math.round(effectiveDuration)} 秒`);
      
      // 只记录超过最小时长的学习会话
      if (effectiveDuration >= this.config.minRecordDuration) {
        const studyRecord = {
          videoId: this.videoId,
          title: this.videoTitle,
          duration: Math.round(effectiveDuration),
          rawDuration: Math.round(rawDuration),
          startTime: this.startTime.toISOString(),
          endTime: endTime.toISOString(),
          date: new Date().toISOString(),
          url: window.location.href,
          playbackRate: this.playbackRate
        };
        
        // 发送到background.js存储
        Utils.sendMessage({
          type: 'saveStudyRecord',
          data: studyRecord
        }, function(response) {
          if (response && response.success) {
            Utils.log('学习记录已保存');
          } else {
            Utils.log('学习记录保存失败:', response ? response.error : '未知错误', 'error');
          }
        });
      } else {
        Utils.log(`学习时长 ${Math.round(effectiveDuration)} 秒不足 ${this.config.minRecordDuration} 秒，不记录`);
      }
      
      this.isRecording = false;
      this.startTime = null;
    }
    
    // 计算有效学习时长（考虑暂停和播放速率）
    getEffectiveDuration() {
      if (!this.startTime) return 0;
      
      let endTime = new Date();
      let totalDuration = (endTime - this.startTime) / 1000; // 秒
      
      // 减去暂停时间
      let effectiveDuration = totalDuration - this.totalPausedTime;
      
      // 如果当前处于暂停状态，减去当前暂停时间
      if (this.pauseTime) {
        const currentPauseDuration = (endTime - this.pauseTime) / 1000;
        effectiveDuration -= currentPauseDuration;
      }
      
      // 考虑播放速率
      effectiveDuration = effectiveDuration * this.playbackRate;
      
      return Math.max(0, effectiveDuration);
    }
  }
  
  // 创建并导出实例
  window.studyRecorder = new StudyRecorder();
})();