// electron-communicator-background.js - 后台脚本版本的Electron通信器

/**
 * Electron通信器 - 负责与Electron应用建立WebSocket连接并同步学习数据
 * 此版本专为Service Worker (background.js) 设计
 */
class ElectronCommunicator {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5秒
    this.pendingMessages = [];
    this.appId = null; // Electron应用的唯一标识
    this.pairingCode = null; // 配对码
    this.autoReconnect = true;
    this.serverUrl = 'ws://localhost:9527';
    
    // 从存储中加载配置
    this.loadConfig();
  }
  
  /**
   * 从存储中加载配置
   */
  loadConfig() {
    chrome.storage.local.get(['electronAppId', 'pairingCode', 'wsServerUrl'], (result) => {
      this.appId = result.electronAppId || null;
      this.pairingCode = result.pairingCode || null;
      this.serverUrl = result.wsServerUrl || 'ws://localhost:9527';
      
      // 如果已经配对，尝试自动连接
      if (this.isPaired()) {
        this.connect();
      }
    });
  }
  
  /**
   * 保存配置到存储
   */
  saveConfig() {
    chrome.storage.local.set({
      electronAppId: this.appId,
      pairingCode: this.pairingCode,
      wsServerUrl: this.serverUrl
    });
  }
  
  /**
   * 生成6位随机配对码
   */
  generatePairingCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.pairingCode = code;
    this.saveConfig();
    return code;
  }
  
  /**
   * 检查是否已与Electron应用配对
   */
  isPaired() {
    return !!this.appId;
  }
  
  /**
   * 连接到Electron应用的WebSocket服务器
   */
  connect(serverUrl = null) {
    if (this.socket && this.isConnected) {
      console.log('已经连接到Electron应用');
      return;
    }
    
    if (serverUrl) {
      this.serverUrl = serverUrl;
      this.saveConfig();
    }
    
    try {
      console.log(`尝试连接到Electron应用: ${this.serverUrl}`);
      this.socket = new WebSocket(this.serverUrl);
      
      this.socket.onopen = () => {
        console.log('已连接到Electron应用');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // 如果已配对，发送认证消息
        if (this.isPaired()) {
          this.sendMessage({
            type: 'auth',
            appId: this.appId
          });
        }
        
        // 发送所有待发送的消息
        this.sendPendingMessages();
        
        // 通知选项页面连接状态变化
        this.notifyConnectionStatus(true);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('处理消息时出错:', error);
        }
      };
      
      this.socket.onclose = () => {
        console.log('与Electron应用的连接已关闭');
        this.isConnected = false;
        
        // 通知选项页面连接状态变化
        this.notifyConnectionStatus(false);
        
        // 尝试重新连接
        if (this.autoReconnect) {
          this.reconnect();
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        this.isConnected = false;
        
        // 通知选项页面连接状态变化
        this.notifyConnectionStatus(false);
      };
    } catch (error) {
      console.error('创建WebSocket连接时出错:', error);
    }
  }
  
  /**
   * 断开与Electron应用的连接
   */
  disconnect() {
    if (this.socket) {
      this.autoReconnect = false; // 禁用自动重连
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      console.log('已断开与Electron应用的连接');
      
      // 通知选项页面连接状态变化
      this.notifyConnectionStatus(false);
    }
  }
  
  /**
   * 尝试重新连接
   */
  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.log('达到最大重连次数，停止重连');
      this.autoReconnect = false;
    }
  }
  
  /**
   * 发送消息到Electron应用
   */
  sendMessage(message) {
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    } else {
      // 存储消息，等待连接恢复后发送
      this.pendingMessages.push(message);
      console.log('连接未建立，消息已加入队列');
      return false;
    }
  }
  
  /**
   * 发送所有待发送的消息
   */
  sendPendingMessages() {
    if (this.pendingMessages.length > 0 && this.isConnected) {
      console.log(`发送${this.pendingMessages.length}条待发送消息`);
      
      while (this.pendingMessages.length > 0) {
        const message = this.pendingMessages.shift();
        this.sendMessage(message);
      }
    }
  }
  
  /**
   * 处理从Electron应用接收到的消息
   */
  handleMessage(message) {
    console.log('收到Electron应用消息:', message);
    
    switch (message.type) {
      case 'pairingResponse':
        if (message.success) {
          this.appId = message.appId;
          console.log('配对成功，应用ID:', this.appId);
          this.saveConfig();
          
          // 通知选项页面配对状态
          this.notifyPairingStatus(true);
        } else {
          console.error('配对失败:', message.error);
          // 通知选项页面配对状态
          this.notifyPairingStatus(false, message.error);
        }
        break;
        
      case 'syncRequest':
        // Electron应用请求同步数据
        this.syncStudyData();
        break;
        
      case 'ping':
        // 心跳检测
        this.sendMessage({ type: 'pong' });
        break;
        
      default:
        console.log('未处理的消息类型:', message.type);
    }
  }
  
  /**
   * 通知选项页面连接状态变化
   */
  notifyConnectionStatus(connected) {
    chrome.runtime.sendMessage({
      type: 'connectionStatus',
      connected: connected
    });
  }
  
  /**
   * 通知选项页面配对状态
   */
  notifyPairingStatus(paired, error = null) {
    chrome.runtime.sendMessage({
      type: 'pairingStatus',
      paired: paired,
      appId: this.appId,
      error: error
    });
  }
  
  /**
   * 同步学习数据到Electron应用
   */
  syncStudyData() {
    // 获取最近的学习记录
    this.getStudyStats('month')
      .then(stats => {
        // 发送学习统计数据
        this.sendMessage({
          type: 'studyStats',
          data: stats
        });
      })
      .catch(error => {
        console.error('获取学习统计失败:', error);
      });
    
    // 获取最近的学习历史
    this.getStudyHistory(50, 0)
      .then(records => {
        // 发送学习历史数据
        this.sendMessage({
          type: 'studyHistory',
          data: records
        });
      })
      .catch(error => {
        console.error('获取学习历史失败:', error);
      });
  }
  
  /**
   * 获取学习统计数据
   */
  getStudyStats(period) {
    return new Promise((resolve, reject) => {
      // 直接调用background.js中的函数
      getStudyStats(period)
        .then(resolve)
        .catch(reject);
    });
  }
  
  /**
   * 获取学习历史记录
   */
  getStudyHistory(limit, offset) {
    return new Promise((resolve, reject) => {
      // 直接调用background.js中的函数
      getStudyHistory(limit, offset)
        .then(resolve)
        .catch(reject);
    });
  }
  
  /**
   * 发送视频观看事件到Electron应用
   */
  sendVideoEvent(eventType, videoData) {
    console.log(`发送视频事件到Electron应用: ${eventType}`, videoData);
    
    // 添加时间戳
    videoData.timestamp = new Date().toISOString();
    
    // 确保视频数据包含必要字段
    if (!videoData.videoId) {
      console.warn('视频事件缺少videoId字段');
      videoData.videoId = 'unknown_' + Date.now();
    }
    
    // 发送事件消息
    const result = this.sendMessage({
      type: 'videoEvent',
      eventType: eventType,
      data: videoData
    });
    
    // 如果发送失败且是重要事件，存储到本地以便稍后同步
    if (!result && ['play', 'pause', 'ended', 'progress'].includes(eventType)) {
      this.storeVideoEventForLaterSync(eventType, videoData);
    }
    
    return result;
  }
  
  /**
   * 存储视频事件以便稍后同步
   */
  storeVideoEventForLaterSync(eventType, videoData) {
    chrome.storage.local.get(['pendingVideoEvents'], (result) => {
      const pendingEvents = result.pendingVideoEvents || [];
      
      // 添加新事件
      pendingEvents.push({
        eventType: eventType,
        data: videoData,
        timestamp: new Date().toISOString()
      });
      
      // 限制存储的事件数量，避免过多占用存储空间
      if (pendingEvents.length > 100) {
        pendingEvents.splice(0, pendingEvents.length - 100);
      }
      
      // 保存到存储
      chrome.storage.local.set({ pendingVideoEvents: pendingEvents });
    });
  }
  
  /**
   * 同步待发送的视频事件
   */
  syncPendingVideoEvents() {
    if (!this.isConnected) return false;
    
    chrome.storage.local.get(['pendingVideoEvents'], (result) => {
      const pendingEvents = result.pendingVideoEvents || [];
      
      if (pendingEvents.length === 0) return;
      
      console.log(`尝试同步${pendingEvents.length}条待发送的视频事件`);
      
      // 创建一个新数组来存储同步失败的事件
      const failedEvents = [];
      
      // 尝试发送每个事件
      pendingEvents.forEach(event => {
        const success = this.sendMessage({
          type: 'videoEvent',
          eventType: event.eventType,
          data: event.data,
          originalTimestamp: event.timestamp
        });
        
        if (!success) {
          failedEvents.push(event);
        }
      });
      
      // 更新存储中的待发送事件
      chrome.storage.local.set({ pendingVideoEvents: failedEvents });
      
      console.log(`视频事件同步完成，成功: ${pendingEvents.length - failedEvents.length}, 失败: ${failedEvents.length}`);
    });
    
    return true;
  }
  
  /**
   * 请求与Electron应用配对
   */
  requestPairing() {
    // 生成新的配对码
    const pairingCode = this.generatePairingCode();
    
    // 发送配对请求
    this.sendMessage({
      type: 'pairingRequest',
      pairingCode: pairingCode
    });
    
    return pairingCode;
  }
  
  /**
   * 重置配对信息
   */
  resetPairing() {
    this.appId = null;
    this.pairingCode = null;
    this.saveConfig();
    
    // 如果已连接，断开连接
    if (this.isConnected) {
      this.disconnect();
    }
    
    console.log('已重置配对信息');
  }
}