// optimized-background.js - 优化版后台脚本，处理学习记录数据存储和管理

// 使用立即执行函数表达式(IIFE)创建模块化结构
(function() {
  'use strict';
  
  // ===== 数据库管理模块 =====
  const DatabaseManager = {
    DB_NAME: 'BilibiliStudyAssistant',
    DB_VERSION: 1,
    db: null,
    
    // 初始化数据库
    init: function() {
      return new Promise((resolve, reject) => {
        if (this.db) {
          resolve(this.db);
          return;
        }
        
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
          
          // 创建学习记录存储对象
          if (!db.objectStoreNames.contains('studyRecords')) {
            const studyRecordsStore = db.createObjectStore('studyRecords', { keyPath: 'id', autoIncrement: true });
            studyRecordsStore.createIndex('videoId', 'videoId', { unique: false });
            studyRecordsStore.createIndex('date', 'date', { unique: false });
          }
          
          // 创建视频信息存储对象
          if (!db.objectStoreNames.contains('videoInfo')) {
            const videoInfoStore = db.createObjectStore('videoInfo', { keyPath: 'videoId' });
            videoInfoStore.createIndex('title', 'title', { unique: false });
          }
          
          // 创建每日统计存储对象
          if (!db.objectStoreNames.contains('dailyStats')) {
            const dailyStatsStore = db.createObjectStore('dailyStats', { keyPath: 'date' });
          }
        };
      });
    },
    
    // 获取事务
    getTransaction: function(storeNames, mode = 'readonly') {
      if (!this.db) {
        throw new Error('数据库未初始化');
      }
      return this.db.transaction(storeNames, mode);
    },
    
    // 获取对象存储
    getObjectStore: function(storeName, mode = 'readonly') {
      const transaction = this.getTransaction([storeName], mode);
      return transaction.objectStore(storeName);
    },
    
    // 执行数据库操作并处理结果
    executeRequest: function(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event);
      });
    }
  };
  
  // ===== 学习记录管理模块 =====
  const StudyRecordManager = {
    // 添加学习记录
    addRecord: async function(record) {
      try {
        await DatabaseManager.init();
        
        const transaction = DatabaseManager.getTransaction(
          ['studyRecords', 'videoInfo', 'dailyStats'], 
          'readwrite'
        );
        
        const studyRecordsStore = transaction.objectStore('studyRecords');
        const videoInfoStore = transaction.objectStore('videoInfo');
        const dailyStatsStore = transaction.objectStore('dailyStats');
        
        // 准备学习记录数据
        const studyRecord = {
          videoId: record.videoId,
          title: record.title,
          duration: record.duration,
          rawDuration: record.rawDuration || record.duration,
          startTime: record.startTime,
          endTime: record.endTime,
          date: record.date,
          playbackRate: record.playbackRate || 1.0,
          url: record.url || ''
        };
        
        // 保存学习记录
        const recordPromise = DatabaseManager.executeRequest(
          studyRecordsStore.add(studyRecord)
        );
        
        // 保存视频信息
        const videoInfoPromise = DatabaseManager.executeRequest(
          videoInfoStore.put({
            videoId: record.videoId,
            title: record.title,
            url: record.url
          })
        );
        
        // 更新每日统计
        const dateStr = new Date(record.date).toISOString().split('T')[0];
        const dailyStatsRequest = dailyStatsStore.get(dateStr);
        
        const updateDailyStatsPromise = new Promise((resolve, reject) => {
          dailyStatsRequest.onsuccess = (event) => {
            let dailyStats = event.target.result || {
              date: dateStr,
              totalDuration: 0,
              videoCount: 0,
              videos: {}
            };
            
            // 更新统计数据
            dailyStats.totalDuration += record.duration;
            
            // 如果是新视频，增加计数
            if (!dailyStats.videos[record.videoId]) {
              dailyStats.videoCount++;
              dailyStats.videos[record.videoId] = {
                title: record.title,
                duration: record.duration,
                count: 1
              };
            } else {
              // 已有视频，更新时长和计数
              dailyStats.videos[record.videoId].duration += record.duration;
              dailyStats.videos[record.videoId].count++;
            }
            
            const putRequest = dailyStatsStore.put(dailyStats);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = (error) => reject(error);
          };
          
          dailyStatsRequest.onerror = (event) => reject(event);
        });
        
        // 等待所有操作完成
        await Promise.all([recordPromise, videoInfoPromise, updateDailyStatsPromise]);
        
        return { success: true };
      } catch (error) {
        console.error('保存学习记录失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    },
    
    // 获取学习历史记录
    getHistory: async function(limit = 10, offset = 0) {
      try {
        await DatabaseManager.init();
        
        const studyRecordsStore = DatabaseManager.getObjectStore('studyRecords');
        const count = await DatabaseManager.executeRequest(studyRecordsStore.count());
        
        // 如果没有记录，返回空数组
        if (count === 0) {
          return [];
        }
        
        return new Promise((resolve, reject) => {
          const records = [];
          const cursorRequest = studyRecordsStore.openCursor(null, 'prev');
          let skipped = 0;
          let collected = 0;
          
          cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            
            if (!cursor) {
              resolve(records);
              return;
            }
            
            // 跳过offset条记录
            if (skipped < offset) {
              skipped++;
              cursor.continue();
              return;
            }
            
            // 收集limit条记录
            if (collected < limit) {
              records.push(cursor.value);
              collected++;
              
              if (collected < limit) {
                cursor.continue();
              } else {
                resolve(records);
              }
            }
          };
          
          cursorRequest.onerror = (event) => reject(event);
        });
      } catch (error) {
        console.error('获取学习历史记录失败:', error);
        return [];
      }
    },
    
    // 获取视频信息
    getVideoInfo: async function(videoId) {
      try {
        await DatabaseManager.init();
        
        const videoInfoStore = DatabaseManager.getObjectStore('videoInfo');
        return await DatabaseManager.executeRequest(videoInfoStore.get(videoId));
      } catch (error) {
        console.error('获取视频信息失败:', error);
        return null;
      }
    }
  };
  
  // ===== 统计数据管理模块 =====
  const StatsManager = {
    // 获取日期范围
    getDateRange: function(period = 'week') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let startDate = new Date(today);
      if (period === 'week') {
        startDate.setDate(today.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(today.getMonth() - 1);
      } else if (period === 'year') {
        startDate.setFullYear(today.getFullYear() - 1);
      } else if (period === 'all') {
        startDate.setFullYear(today.getFullYear() - 10); // 假设最多10年数据
      }
      
      return {
        start: startDate,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) // 今天的最后一毫秒
      };
    },
    
    // 获取学习统计数据
    getStats: async function(period = 'week') {
      try {
        await DatabaseManager.init();
        
        const dateRange = this.getDateRange(period);
        const dailyStatsStore = DatabaseManager.getObjectStore('dailyStats');
        const studyRecordsStore = DatabaseManager.getObjectStore('studyRecords');
        
        // 准备统计数据结构
        const stats = {
          totalDuration: 0,
          videoCount: 0,
          recordCount: 0,
          avgPlaybackRate: 1.0,
          dailyData: [],
          topVideos: []
        };
        
        // 获取日期范围内的每日统计数据
        const dailyStatsPromise = new Promise((resolve, reject) => {
          const dateMap = {};
          const videoMap = {};
          let totalPlaybackRate = 0;
          let playbackRateCount = 0;
          
          const cursorRequest = dailyStatsStore.openCursor();
          
          cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const dateStr = cursor.key;
              const recordDate = new Date(dateStr);
              
              // 检查日期是否在范围内
              if (recordDate >= dateRange.start && recordDate <= dateRange.end) {
                const dailyData = cursor.value;
                
                // 累计总时长和视频数
                stats.totalDuration += dailyData.totalDuration;
                
                // 添加到每日数据数组
                stats.dailyData.push({
                  date: dateStr,
                  duration: dailyData.totalDuration,
                  videoCount: dailyData.videoCount
                });
                
                // 累计每个视频的时长
                Object.keys(dailyData.videos).forEach(videoId => {
                  const video = dailyData.videos[videoId];
                  if (!videoMap[videoId]) {
                    videoMap[videoId] = {
                      videoId: videoId,
                      title: video.title,
                      duration: 0,
                      count: 0
                    };
                  }
                  videoMap[videoId].duration += video.duration;
                  videoMap[videoId].count += video.count;
                });
                
                // 记录日期，用于填充缺失的日期
                dateMap[dateStr] = true;
              }
              cursor.continue();
            } else {
              // 计算不同视频的总数
              stats.videoCount = Object.keys(videoMap).length;
              
              // 获取观看时长最多的前5个视频
              stats.topVideos = Object.values(videoMap)
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 5);
              
              // 填充缺失的日期数据
              this.fillMissingDates(stats.dailyData, dateRange, dateMap);
              
              // 按日期排序
              stats.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
              
              resolve();
            }
          };
          
          cursorRequest.onerror = (event) => reject(event);
        });
        
        // 获取记录数量和平均播放速率
        const recordsPromise = new Promise((resolve, reject) => {
          const dateIndex = studyRecordsStore.index('date');
          const range = IDBKeyRange.bound(
            dateRange.start.toISOString(),
            dateRange.end.toISOString()
          );
          
          let totalPlaybackRate = 0;
          let recordCount = 0;
          
          const cursorRequest = dateIndex.openCursor(range);
          
          cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              recordCount++;
              
              // 累计播放速率
              if (cursor.value.playbackRate) {
                totalPlaybackRate += cursor.value.playbackRate;
              }
              
              cursor.continue();
            } else {
              stats.recordCount = recordCount;
              
              // 计算平均播放速率
              if (recordCount > 0) {
                stats.avgPlaybackRate = parseFloat((totalPlaybackRate / recordCount).toFixed(2));
              }
              
              resolve();
            }
          };
          
          cursorRequest.onerror = (event) => reject(event);
        });
        
        // 等待所有查询完成
        await Promise.all([dailyStatsPromise, recordsPromise]);
        
        return stats;
      } catch (error) {
        console.error('获取学习统计数据失败:', error);
        return {
          totalDuration: 0,
          videoCount: 0,
          recordCount: 0,
          avgPlaybackRate: 1.0,
          dailyData: [],
          topVideos: []
        };
      }
    },
    
    // 填充缺失的日期数据
    fillMissingDates: function(dailyData, dateRange, dateMap) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        
        if (!dateMap[dateStr]) {
          dailyData.push({
            date: dateStr,
            duration: 0,
            videoCount: 0
          });
        }
      }
    }
  };
  
  // ===== 消息处理模块 =====
  const MessageHandler = {
    // 处理来自content script的消息
    handleMessage: async function(message, sender, sendResponse) {
      // 使用异步响应模式
      const sendAsyncResponse = function(response) {
        try {
          sendResponse(response);
        } catch (error) {
          console.error('发送响应失败:', error);
        }
      };
      
      // 根据消息类型分发处理
      switch (message.type) {
        case 'saveStudyRecord':
          if (message.data) {
            const result = await StudyRecordManager.addRecord(message.data);
            sendAsyncResponse(result);
          } else {
            sendAsyncResponse({ success: false, error: '无效的学习记录数据' });
          }
          break;
          
        case 'getStudyStats':
          try {
            const period = message.period || 'week';
            const stats = await StatsManager.getStats(period);
            sendAsyncResponse({ success: true, data: stats });
          } catch (error) {
            sendAsyncResponse({ success: false, error: error.message || '获取统计数据失败' });
          }
          break;
          
        case 'getStudyHistory':
          try {
            const limit = message.limit || 10;
            const offset = message.offset || 0;
            const history = await StudyRecordManager.getHistory(limit, offset);
            sendAsyncResponse({ success: true, data: history });
          } catch (error) {
            sendAsyncResponse({ success: false, error: error.message || '获取历史记录失败' });
          }
          break;
          
        case 'getVideoInfo':
          if (message.videoId) {
            const videoInfo = await StudyRecordManager.getVideoInfo(message.videoId);
            sendAsyncResponse({ success: true, data: videoInfo });
          } else {
            sendAsyncResponse({ success: false, error: '无效的视频ID' });
          }
          break;
          
        default:
          sendAsyncResponse({ success: false, error: '未知的消息类型' });
      }
      
      // 返回true表示将使用异步响应
      return true;
    }
  };
  
  // ===== 初始化 =====
  function init() {
    // 初始化数据库
    DatabaseManager.init().catch(error => {
      console.error('数据库初始化失败:', error);
    });
    
    // 注册消息监听器
    chrome.runtime.onMessage.addListener(MessageHandler.handleMessage);
    
    console.log('B站学习助手后台服务已启动');
  }
  
  // 启动后台服务
  init();
})();