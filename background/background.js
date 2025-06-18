// background.js - Service Worker for B站专注学习模式
  
  // ===== 数据库管理模块 =====
  const DatabaseManager = {
    DB_NAME: 'BilibiliStudyAssistant',
    DB_VERSION: 1,
    db: null,
    
    // 初始化数据库
  init: async function() {
        if (this.db) {
      return this.db;
        }
        
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        request.onerror = (event) => {
          console.error('数据库打开失败:', event);
          reject(event);
        };
        
        request.onsuccess = (event) => {
          console.log('数据库打开成功');
          this.db = event.target.result;
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
        // 创建所需的对象存储
          if (!db.objectStoreNames.contains('studyRecords')) {
            const studyRecordsStore = db.createObjectStore('studyRecords', { keyPath: 'id', autoIncrement: true });
            studyRecordsStore.createIndex('videoId', 'videoId', { unique: false });
            studyRecordsStore.createIndex('date', 'date', { unique: false });
          }
          
          if (!db.objectStoreNames.contains('videoInfo')) {
            const videoInfoStore = db.createObjectStore('videoInfo', { keyPath: 'videoId' });
            videoInfoStore.createIndex('title', 'title', { unique: false });
          }
          
          if (!db.objectStoreNames.contains('dailyStats')) {
          db.createObjectStore('dailyStats', { keyPath: 'date' });
          }
        };
      });
  }
};

// ===== 学习记录管理器 =====
  const StudyRecordManager = {
  async addRecord(record) {
      try {
        await DatabaseManager.init();
      const db = DatabaseManager.db;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['studyRecords', 'dailyStats'], 'readwrite');
        const recordStore = transaction.objectStore('studyRecords');
        const statsStore = transaction.objectStore('dailyStats');
        
        // 添加学习记录
        const recordRequest = recordStore.add({
          videoId: record.videoId,
          title: record.title,
          duration: record.duration,
          startTime: record.startTime,
          endTime: record.endTime,
          date: new Date().toISOString()
        });
        
        recordRequest.onsuccess = () => {
        // 更新每日统计
          const dateStr = new Date().toISOString().split('T')[0];
          const statsRequest = statsStore.get(dateStr);
        
          statsRequest.onsuccess = () => {
            let stats = statsRequest.result || {
              date: dateStr,
              totalDuration: 0,
              videoCount: 0,
              videos: {}
            };
            
            stats.totalDuration += record.duration;
            if (!stats.videos[record.videoId]) {
              stats.videoCount++;
              stats.videos[record.videoId] = {
                title: record.title,
                duration: record.duration,
                count: 1
              };
            } else {
              stats.videos[record.videoId].duration += record.duration;
              stats.videos[record.videoId].count++;
            }
            
            statsStore.put(stats);
          };
        };
            
            transaction.oncomplete = () => {
          resolve({ success: true });
            };
            
            transaction.onerror = (event) => {
            reject(event);
          };
        });
      } catch (error) {
        console.error('添加学习记录失败:', error);
        throw error;
      }
  }
};

// ===== 消息处理器 =====
const MessageHandler = {
  async handleMessage(message, sender) {
    console.log('收到消息:', message.type);
    
      switch (message.type) {
        case 'saveStudyRecord':
          if (message.data) {
            try {
            return await StudyRecordManager.addRecord(message.data);
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
        return { success: false, error: '无效的学习记录数据' };
        
      case 'notification':
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon128.png',
          title: message.title || 'B站专注学习模式',
          message: message.message,
          priority: 2
        });
        return { success: true };
        
      default:
        return { success: false, error: '未知的消息类型' };
    }
  }
};

// ===== Service Worker 初始化 =====
async function initialize() {
  try {
    // 初始化数据库
    await DatabaseManager.init();
    console.log('B站专注学习模式 Service Worker 已启动');
  } catch (error) {
    console.error('Service Worker 初始化失败:', error);
  }
}

// 注册消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  MessageHandler.handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // 保持消息通道开放以支持异步响应
});

// 启动 Service Worker
initialize(); 