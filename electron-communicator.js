// electron-communicator.js - Unified communicator for both content and background contexts

(function() {
  'use strict';
  
  /**
   * Electron通信器 - 负责与Electron应用建立WebSocket连接并同步学习数据
   * 支持在content script和background script中使用
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
      
      // 检测运行环境
      this.isBackgroundScript = typeof importScripts === 'function';
      
      // 加载配置
      this.loadConfig();
    }
    
    // 加载配置 - 适应不同环境
    loadConfig() {
      if (this.isBackgroundScript) {
        // Background script环境
        chrome.storage.local.get(['electronAppId', 'pairingCode'], (result) => {
          this.appId = result.electronAppId || null;
          this.pairingCode = result.pairingCode || null;
        });
      } else {
        // Content script环境
        chrome.storage.local.get(['electronAppId', 'pairingCode'], (result) => {
          this.appId = result.electronAppId || null;
          this.pairingCode = result.pairingCode || null;
        });
      }
    }
    
    // 保存配置 - 适应不同环境
    saveConfig() {
      const config = {
        electronAppId: this.appId,
        pairingCode: this.pairingCode
      };
      
      chrome.storage.local.set(config);
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
  
  // 根据环境导出
  if (typeof importScripts === 'function') {
    // Background script环境
    self.ElectronCommunicator = ElectronCommunicator;
  } else {
    // Content script环境
    window.ElectronCommunicator = ElectronCommunicator;
    window.electronCommunicator = new ElectronCommunicator();
  }
})();

// MessageHandler - 处理与content scripts的消息通信
const MessageHandler = {
  // 处理接收到的消息
  handleMessage: async function(message, sender, sendResponse) {
    // 根据消息类型分发处理:
    // - saveStudyRecord: 保存学习记录
    // - getStudyStats: 获取学习统计
    // - getStudyHistory: 获取学习历史
    // - getVideoInfo: 获取视频信息
  }
};

// Electron通信相关处理
// 创建通信器实例
const electronCommunicator = new ElectronCommunicator();

// 处理与Electron相关的消息:
// - connectToElectron: 连接到WebSocket服务器
// - syncStudyData: 同步学习数据到桌面应用
// - pairWithElectron: 与桌面应用配对

// 处理获取学习统计的请求，包括错误处理和备用数据
function getStudyStatsFromDB(period) {
  // 从数据库获取统计数据
  // 如出错则返回模拟数据
}

// 基于原始记录计算统计数据
function calculateStats(records) {
  // 计算总时长、视频数量、平均速率等统计指标
  // 生成每日数据和热门视频列表
}