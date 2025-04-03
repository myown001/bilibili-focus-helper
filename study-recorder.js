// study-recorder.js - 处理视频学习记录功能

// 视频学习记录器
class StudyRecorder {
  constructor() {
    this.isRecording = false;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPausedTime = 0;
    this.videoId = null;
    this.videoTitle = null;
    this.playbackRate = 1.0;
    this.checkInterval = null;
    this.lastActiveTime = null;
    this.inactiveThreshold = 60000; // 60秒无操作视为不活跃
    this.minRecordDuration = 10; // 最小记录时长（秒）
    
    // 绑定方法到实例
    this.start = this.start.bind(this);
    this.pause = this.pause.bind(this);
    this.resume = this.resume.bind(this);
    this.stop = this.stop.bind(this);
    this.onUserActivity = this.onUserActivity.bind(this);
    this.checkUserActivity = this.checkUserActivity.bind(this);
    this.getEffectiveDuration = this.getEffectiveDuration.bind(this);
    
    // 初始化用户活动监听
    this.initActivityTracking();
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
    const titleElement = document.querySelector('.video-title, .media-title, h1');
    if (titleElement) {
      return titleElement.textContent.trim();
    }
    
    // 如果找不到标题元素，使用文档标题
    const docTitle = document.title;
    // 移除B站后缀
    return docTitle.replace(/_哔哩哔哩_bilibili$/, '').trim() || '未知视频';
  }
  
  // 初始化用户活动跟踪
  initActivityTracking() {
    // 使用事件委托，只在document上添加监听器
    const activityHandler = this.onUserActivity.bind(this);
    document.addEventListener('mousedown', activityHandler, { passive: true });
    document.addEventListener('keydown', activityHandler, { passive: true });
    document.addEventListener('scroll', throttle(activityHandler, 200), { passive: true });
    document.addEventListener('touchstart', activityHandler, { passive: true });
    
    // 初始化最后活动时间
    this.lastActiveTime = Date.now();
  }
  
  // 用户活动事件处理
  onUserActivity() {
    this.lastActiveTime = Date.now();
  }
  
  // 检查用户活动状态
  checkUserActivity() {
    // 减少检查频率，从原来可能的几十毫秒一次改为每秒一次
    if (!this.lastActivityCheck || Date.now() - this.lastActivityCheck > 1000) {
      this.lastActivityCheck = Date.now();
      
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActiveTime;
      
      // 如果用户长时间不活跃，暂停记录
      if (timeSinceLastActivity > this.inactiveThreshold && !this.pauseTime) {
        console.log('用户不活跃，暂停记录');
        this.pause();
      }
    }
  }
  
  // 开始记录
  start(videoElement) {
    if (this.isRecording) return;
    
    // 提取视频信息
    this.videoId = this.extractVideoId();
    this.videoTitle = this.extractVideoTitle();
    this.playbackRate = videoElement ? videoElement.playbackRate : 1.0;
    
    console.log(`开始记录学习: ${this.videoTitle} (${this.videoId}), 播放速率: ${this.playbackRate}`);
    
    // 记录视频元素信息，帮助调试
    if (videoElement) {
      console.log('视频元素信息:', {
        duration: videoElement.duration,
        currentTime: videoElement.currentTime,
        paused: videoElement.paused,
        ended: videoElement.ended,
        readyState: videoElement.readyState
      });
    }
    
    this.isRecording = true;
    this.startTime = new Date();
    this.pauseTime = null;
    this.totalPausedTime = 0;
    this.lastActiveTime = Date.now();
    
    // 启动定期检查
    this.checkInterval = setInterval(this.checkUserActivity, 5000);
    
    // 通知后台开始记录
    chrome.runtime.sendMessage({
      type: 'startStudySession',
      data: {
        videoId: this.videoId,
        title: this.videoTitle,
        startTime: this.startTime.toISOString(),
        playbackRate: this.playbackRate
      }
    }, response => {
      console.log('开始学习会话响应:', response);
    });
  }
  
  // 暂停记录
  pause() {
    if (!this.isRecording || this.pauseTime) return;
    
    this.pauseTime = new Date();
    console.log('学习记录已暂停');
  }
  
  // 恢复记录
  resume() {
    if (!this.isRecording || !this.pauseTime) return;
    
    const pauseDuration = (new Date() - this.pauseTime) / 1000;
    this.totalPausedTime += pauseDuration;
    this.pauseTime = null;
    console.log(`学习记录已恢复，暂停了 ${Math.round(pauseDuration)} 秒`);
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
    
    console.log(`停止记录学习: 总时长 ${Math.round(rawDuration)} 秒，有效时长 ${Math.round(effectiveDuration)} 秒`);
    
    // 只记录超过最小时长的学习会话
    if (effectiveDuration >= this.minRecordDuration) {
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
      
      console.log('准备保存学习记录:', studyRecord);
      
      // 发送到background.js存储
      chrome.runtime.sendMessage({
        type: 'saveStudyRecord',
        data: studyRecord
      }, function(response) {
        console.log('保存学习记录响应:', response);
        if (response && response.success) {
          console.log('学习记录已保存');
        } else {
          console.error('学习记录保存失败:', response ? response.error : '未知错误');
        }
      });
    } else {
      console.log(`学习时长 ${Math.round(effectiveDuration)} 秒不足 ${this.minRecordDuration} 秒，不记录`);
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
    effectiveDuration *= this.playbackRate;
    
    return Math.max(0, effectiveDuration);
  }
  
  // 更新播放速率
  updatePlaybackRate(rate) {
    if (this.isRecording) {
      console.log(`播放速率更新: ${this.playbackRate} -> ${rate}`);
      this.playbackRate = rate;
    }
  }
}

// 导出学习记录器
window.StudyRecorder = StudyRecorder;

// 设置视频学习记录功能
function setupStudyRecording(videoElement) {
  console.log('设置视频学习记录...');
  
  if (!videoElement) {
    console.error('未找到视频元素');
    return;
  }
  
  // 创建记录器实例
  const recorder = new StudyRecorder();
  
  // 播放事件
  videoElement.addEventListener('play', () => {
    console.log('视频开始播放');
    if (!recorder.isRecording) {
      recorder.start(videoElement);
    } else if (recorder.pauseTime) {
      recorder.resume();
    }
  });
  
  // 暂停事件
  videoElement.addEventListener('pause', () => {
    console.log('视频暂停');
    if (recorder.isRecording && !recorder.pauseTime) {
      recorder.pause();
    }
  });
  
  // 结束事件
  videoElement.addEventListener('ended', () => {
    console.log('视频结束');
    if (recorder.isRecording) {
      recorder.stop();
    }
  });
  
  // 如果视频已经在播放，开始记录
  if (!videoElement.paused && !videoElement.ended) {
    console.log('视频已经在播放，开始记录');
    recorder.start(videoElement);
  }
}

// 设置视频事件监听
function setupVideoListeners(videoElement, recorder) {
  if (!videoElement || !recorder) return;
  
  console.log('设置视频事件监听');
  
  // 获取同步设置
  let syncSettings = {
    autoSync: true,
    syncPlay: true,
    syncProgress: true,
    syncRate: true
  };
  
  // 从存储中加载同步设置
  chrome.storage.local.get(
    ['autoSync', 'syncPlay', 'syncProgress', 'syncRate'],
    (result) => {
      syncSettings.autoSync = result.autoSync !== false;
      syncSettings.syncPlay = result.syncPlay !== false;
      syncSettings.syncProgress = result.syncProgress !== false;
      syncSettings.syncRate = result.syncRate !== false;
    }
  );
  
  // 播放事件
  videoElement.addEventListener('play', () => {
    if (!recorder.isRecording) {
      recorder.start(videoElement);
    } else if (recorder.pauseTime) {
      recorder.resume();
    }
    
    // 同步播放事件到Electron应用
    if (syncSettings.autoSync && syncSettings.syncPlay && window.electronCommunicator) {
      window.electronCommunicator.sendVideoEvent('play', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        playbackRate: videoElement.playbackRate,
        url: window.location.href
      });
    }
  });
  
  // 暂停事件
  videoElement.addEventListener('pause', () => {
    if (recorder.isRecording && !recorder.pauseTime) {
      recorder.pause();
    }
    
    // 同步暂停事件到Electron应用
    if (syncSettings.autoSync && syncSettings.syncPlay && window.electronCommunicator) {
      window.electronCommunicator.sendVideoEvent('pause', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        playbackRate: videoElement.playbackRate,
        url: window.location.href
      });
    }
  });
  
  // 结束事件
  videoElement.addEventListener('ended', () => {
    if (recorder.isRecording) {
      recorder.stop();
    }
    
    // 同步结束事件到Electron应用
    if (syncSettings.autoSync && syncSettings.syncPlay && window.electronCommunicator) {
      window.electronCommunicator.sendVideoEvent('ended', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        playbackRate: videoElement.playbackRate,
        url: window.location.href
      });
    }
  });
  
  // 播放速率变化
  videoElement.addEventListener('ratechange', () => {
    recorder.updatePlaybackRate(videoElement.playbackRate);
    
    // 同步播放速率变化到Electron应用
    if (syncSettings.autoSync && syncSettings.syncRate && window.electronCommunicator) {
      window.electronCommunicator.sendVideoEvent('ratechange', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        currentTime: videoElement.currentTime,
        playbackRate: videoElement.playbackRate,
        url: window.location.href
      });
    }
  });
  
  // 播放进度更新
  let lastProgressUpdate = 0;
  videoElement.addEventListener('timeupdate', () => {
    const now = Date.now();
    // 每5秒同步一次进度，避免过多请求
    if (syncSettings.autoSync && syncSettings.syncProgress && window.electronCommunicator && now - lastProgressUpdate > 5000) {
      lastProgressUpdate = now;
      window.electronCommunicator.sendVideoEvent('progress', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        playbackRate: videoElement.playbackRate,
        progress: videoElement.currentTime / videoElement.duration,
        url: window.location.href
      });
    }
  });
  
  // 视频元数据加载完成
  videoElement.addEventListener('loadedmetadata', () => {
    if (syncSettings.autoSync && window.electronCommunicator) {
      window.electronCommunicator.sendVideoEvent('metadata', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        duration: videoElement.duration,
        url: window.location.href
      });
    }
  });
  
  // 监听视频错误
  videoElement.addEventListener('error', () => {
    if (recorder.isRecording) {
      recorder.pause();
    }
    
    // 同步错误事件到Electron应用
    if (syncSettings.autoSync && window.electronCommunicator) {
      window.electronCommunicator.sendVideoEvent('error', {
        videoId: recorder.videoId,
        title: recorder.videoTitle,
        error: videoElement.error ? videoElement.error.code : 'unknown',
        url: window.location.href
      });
    }
  });
  
  // 监听同步设置变化
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateSyncSettings') {
      // 重新加载同步设置
      chrome.storage.local.get(
        ['autoSync', 'syncPlay', 'syncProgress', 'syncRate'],
        (result) => {
          syncSettings.autoSync = result.autoSync !== false;
          syncSettings.syncPlay = result.syncPlay !== false;
          syncSettings.syncProgress = result.syncProgress !== false;
          syncSettings.syncRate = result.syncRate !== false;
          sendResponse({success: true});
        }
      );
      return true;
    }
  });
}

// 导出函数
window.setupStudyRecording = setupStudyRecording;