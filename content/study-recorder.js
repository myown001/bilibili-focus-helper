// study-recorder.js - 优化版视频学习记录功能

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
  /**
   * 学习时间记录类
   * 跟踪和记录用户的学习时间
   */
  class StudyRecorder {
    constructor() {
      this.startTime = null;
      this.totalTime = 0;
      this.isRecording = false;
      this.lastUpdateTime = Date.now();
      this.effectiveDuration = 0;
      
      // 从存储中加载累计时间
      this.loadTotalTime();
      
      // 检查是否在视频页面，自动开始记录
      if (this.isVideoPage()) {
        setTimeout(() => this.start(), 1000);
      }
    }
    
    /**
     * 检查是否是视频页面
     * @returns {boolean} 是否是视频页面
     */
    isVideoPage() {
      return window.location.pathname.includes('/video/') || 
             window.location.pathname.includes('/bangumi/play/') ||
             window.location.pathname.includes('/cheese/play/');
    }
    
    /**
     * 开始记录学习时间
     */
    start() {
      if (this.isRecording) return;
      
      this.startTime = Date.now();
      this.lastUpdateTime = this.startTime;
      this.isRecording = true;
      
      // 启动定期更新
      this.updateInterval = setInterval(() => this.update(), 30000);
      
      // 添加页面可见性变化监听
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      
      console.log('开始记录学习时间');
    }
    
    /**
     * 更新学习时间
     */
    update() {
      if (!this.isRecording) return;
      
      const now = Date.now();
      const elapsedTime = now - this.lastUpdateTime;
      
      // 累计有效时间
      this.effectiveDuration += elapsedTime / 1000; // 转换为秒
      this.totalTime += elapsedTime / 1000;
      
      // 更新时间戳
      this.lastUpdateTime = now;
      
      // 保存到存储
      this.saveTotalTime();
    }
    
    /**
     * 处理页面可见性变化
     */
    handleVisibilityChange() {
      if (document.hidden) {
        // 页面不可见，暂停计时
        this.update(); // 先更新当前累计时间
      } else {
        // 页面重新可见，重置计时器
        this.lastUpdateTime = Date.now();
      }
    }
    
    /**
     * 停止记录学习时间
     */
    stop() {
      if (!this.isRecording) return;
      
      // 更新最终时间
      this.update();
      
      // 清除定时器
      clearInterval(this.updateInterval);
      
      // 移除事件监听
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      
      this.isRecording = false;
      console.log('停止记录学习时间');
      
      return this.effectiveDuration;
    }
    
    /**
     * 获取当前学习时长（秒）
     * @returns {number} 学习时长（秒）
     */
    getEffectiveDuration() {
      if (!this.isRecording) return this.effectiveDuration;
      
      // 如果正在记录，计算当前时间点的累计时间
      const now = Date.now();
      const currentSessionTime = (now - this.lastUpdateTime) / 1000;
      
      return this.effectiveDuration + currentSessionTime;
    }
    
    /**
     * 获取总学习时间
     * @returns {number} 总学习时间（秒）
     */
    getTotalTime() {
      return this.totalTime;
    }
    
    /**
     * 保存总学习时间到存储
     */
    saveTotalTime() {
      if (window.StorageUtils) {
        window.StorageUtils.save('studyTotalTime', this.totalTime).catch(
          err => console.error('保存学习时间失败:', err)
        );
      } else {
        console.warn('StorageUtils不可用，无法保存学习时间');
      }
    }
    
    /**
     * 从存储中加载总学习时间
     */
    loadTotalTime() {
      if (window.StorageUtils) {
        window.StorageUtils.load('studyTotalTime', 0).then(
          time => this.totalTime = time
        ).catch(
          err => console.error('加载学习时间失败:', err)
        );
      } else {
        // 回退使用localStorage
        try {
          const savedTime = localStorage.getItem('studyTotalTime');
          if (savedTime) {
            this.totalTime = parseFloat(savedTime);
          }
        } catch (e) {
          console.error('本地存储加载失败:', e);
        }
      }
    }
  }
  
  // 创建全局实例
  window.studyRecorder = new StudyRecorder();
})();