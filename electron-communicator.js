// electron-communicator.js - 处理与Electron应用的通信

/**
 * Electron通信器 - 负责与Electron应用建立WebSocket连接并同步学习数据
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
    
    // 绑定方法
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.reconnect = this.reconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.syncStudyData = this.syncStudyData.bind(this);
    this.sendPendingMessages = this.sendPendingMessages.bind(this);
    this.generatePairingCode = this.generatePairingCode.bind(this);
    this.isPaired = this.isPaired.bind(this);
    
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
        
        // 尝试重新连接
        if (this.autoReconnect) {
          this.reconnect();
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        this.isConnected = false;
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
          
          // 通知UI更新配对状态
          chrome.runtime.sendMessage({
            type: 'pairingStatus',
            paired: true,
            appId: this.appId
          });
        } else {
          console.error('配对失败:', message.error);
          // 通知UI更新配对状态
          chrome.runtime.sendMessage({
            type: 'pairingStatus',
            paired: false,
            error: message.error
          });
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
   * 同步学习数据到Electron应用
   */
  syncStudyData() {
    // 获取最近的学习记录
    chrome.runtime.sendMessage(
      { type: 'getStudyStats', period: 'month' },
      (response) => {
        if (response && response.success) {
          // 发送学习统计数据
          this.sendMessage({
            type: 'studyStats',
            data: response.data
          });
        }
      }
    );
    
    // 获取最近的学习历史
    chrome.runtime.sendMessage(
      { type: 'getStudyHistory', limit: 50, offset: 0 },
      (response) => {
        if (response && response.success) {
          // 发送学习历史数据
          this.sendMessage({
            type: 'studyHistory',
            data: response.data
          });
        }
      }
    );
  }
  
  /**
   * 发送视频观看事件到Electron应用
   */
  sendVideoEvent(eventType, videoData) {
    return this.sendMessage({
      type: 'videoEvent',
      eventType: eventType,
      data: videoData
    });
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

// 创建全局实例
window.electronCommunicator = new ElectronCommunicator();

// 导出通信器
export default ElectronCommunicator;