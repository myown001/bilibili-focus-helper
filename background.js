// background.js - 处理学习记录数据存储和管理

// 初始化数据库
function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BilibiliStudyAssistant', 1);
    
    request.onerror = (event) => {
      console.error('数据库打开失败:', event);
      reject(event);
    };
    
    request.onsuccess = (event) => {
      console.log('数据库打开成功');
      resolve(event.target.result);
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
      
      // 创建笔记存储对象
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// 添加学习记录
function addStudyRecord(record) {
  return new Promise((resolve, reject) => {
    console.log('开始添加学习记录:', record);
    
    if (!record || !record.videoId || !record.duration) {
      console.error('无效的学习记录数据:', record);
      reject(new Error('无效的学习记录数据'));
      return;
    }
    
    initDatabase().then(db => {
      try {
        const transaction = db.transaction(['studyRecords', 'videoInfo', 'dailyStats'], 'readwrite');
        const studyRecordsStore = transaction.objectStore('studyRecords');
        const videoInfoStore = transaction.objectStore('videoInfo');
        const dailyStatsStore = transaction.objectStore('dailyStats');
        
        transaction.onerror = (event) => {
          console.error('事务错误:', event);
          reject(event);
        };
        
        // 保存学习记录
        const recordRequest = studyRecordsStore.add({
          videoId: record.videoId,
          title: record.title,
          duration: record.duration,
          rawDuration: record.rawDuration || record.duration,
          startTime: record.startTime,
          endTime: record.endTime,
          date: record.date,
          playbackRate: record.playbackRate || 1.0,
          url: record.url || ''
        });
        
        recordRequest.onerror = (event) => {
          console.error('添加学习记录失败:', event);
        };
        
        // 保存视频信息
        videoInfoStore.put({
          videoId: record.videoId,
          title: record.title,
          url: record.url
        });
        
        // 更新每日统计
        const dateStr = new Date(record.date).toISOString().split('T')[0];
        const dailyStatsRequest = dailyStatsStore.get(dateStr);
        
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
          
          dailyStatsStore.put(dailyStats);
        };
        
        transaction.oncomplete = () => {
          console.log('学习记录添加成功');
          resolve(record);
        };
      } catch (error) {
        console.error('添加学习记录时发生异常:', error);
        reject(error);
      }
    }).catch(error => {
      console.error('初始化数据库失败:', error);
      reject(error);
    });
  });
}

// 获取学习统计数据
function getStudyStats(period = 'week') {
  return new Promise((resolve, reject) => {
    try {
      console.log('开始获取学习统计数据，周期:', period);
      
      // 获取日期范围
      const dateRange = getDateRange(period);
      console.log('日期范围:', dateRange);
      
      initDatabase().then(db => {
        const transaction = db.transaction(['dailyStats', 'studyRecords'], 'readonly');
        const dailyStatsStore = transaction.objectStore('dailyStats');
        const studyRecordsStore = transaction.objectStore('studyRecords');
        
        const stats = {
          totalDuration: 0,
          videoCount: 0,
          recordCount: 0,
          avgPlaybackRate: 1.0,
          dailyData: [],
          topVideos: []
        };
        
        // 获取日期范围内的每日统计
        const dailyStatsPromise = new Promise((resolve, reject) => {
          const range = IDBKeyRange.bound(
            dateRange.start.toISOString().split('T')[0],
            dateRange.end.toISOString().split('T')[0]
          );
          
          const dailyData = [];
          const videoMap = {};
          
          const cursorRequest = dailyStatsStore.openCursor(range);
          
          cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const dailyStats = cursor.value;
              
              // 累计总时长
              stats.totalDuration += dailyStats.totalDuration;
              
              // 添加到每日数据数组
              dailyData.push({
                date: dailyStats.date,
                duration: dailyStats.totalDuration,
                videoCount: dailyStats.videoCount
              });
              
              // 累计视频信息
              Object.entries(dailyStats.videos).forEach(([videoId, video]) => {
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
              
              cursor.continue();
            } else {
              // 处理完所有数据
              
              // 计算不同视频的数量
              stats.videoCount = Object.keys(videoMap).length;
              
              // 获取学习时间最长的前10个视频
              stats.topVideos = Object.values(videoMap)
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 10);
              
              // 按日期排序每日数据
              stats.dailyData = dailyData.sort((a, b) => a.date.localeCompare(b.date));
              
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
        Promise.all([dailyStatsPromise, recordsPromise])
          .then(() => {
            console.log('准备返回统计数据:', stats);
            resolve(stats);
          })
          .catch(error => {
            console.error('获取统计数据失败:', error);
            reject(error);
          });
      }).catch(error => {
        console.error('初始化数据库失败:', error);
        reject(error);
      });
    } catch (error) {
      console.error('获取学习统计数据异常:', error);
      reject(error);
    }
  });
}

// 获取学习历史记录
function getStudyHistory(limit = 20, offset = 0) {
  return new Promise((resolve, reject) => {
    initDatabase().then(db => {
      const transaction = db.transaction(['studyRecords'], 'readonly');
      const studyRecordsStore = transaction.objectStore('studyRecords');
      
      // 使用索引按日期倒序获取记录
      const index = studyRecordsStore.index('date');
      const records = [];
      let count = 0;
      let skipped = 0;
      
      const request = index.openCursor(null, 'prev');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
          } else if (count < limit) {
            records.push(cursor.value);
            count++;
            cursor.continue();
          } else {
            resolve(records);
          }
        } else {
          resolve(records);
        }
      };
      
      request.onerror = (event) => {
        console.error('获取学习历史失败:', event);
        reject(event);
      };
    }).catch(reject);
  });
}

// 清除过期数据（保留最近一年的数据）
function cleanupOldData() {
  return new Promise((resolve, reject) => {
    initDatabase().then(db => {
      const transaction = db.transaction(['studyRecords', 'dailyStats'], 'readwrite');
      const studyRecordsStore = transaction.objectStore('studyRecords');
      const dailyStatsStore = transaction.objectStore('dailyStats');
      
      // 计算一年前的日期
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      // 删除旧的学习记录
      const recordIndex = studyRecordsStore.index('date');
      const recordRange = IDBKeyRange.upperBound(oneYearAgo);
      recordIndex.openCursor(recordRange).onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          studyRecordsStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      
      // 删除旧的每日统计
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      const statsRange = IDBKeyRange.upperBound(oneYearAgoStr);
      dailyStatsStore.openCursor(statsRange).onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          dailyStatsStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => {
        console.log('过期数据清理完成');
        resolve();
      };
      
      transaction.onerror = (event) => {
        console.error('清理过期数据失败:', event);
        reject(event);
      };
    }).catch(reject);
  });
}

// Electron通信器实例
let electronCommunicator = null;

// 初始化Electron通信器
function initElectronCommunicator() {
  // 动态加载electron-communicator.js
  importScripts('electron-communicator.js');
  electronCommunicator = new ElectronCommunicator();
  console.log('Electron通信器已初始化');
}

// 连接到Electron应用
function connectToElectron(serverUrl) {
  if (!electronCommunicator) {
    try {
      initElectronCommunicator();
    } catch (error) {
      console.error('初始化Electron通信器失败:', error);
      return Promise.reject(error);
    }
  }
  
  return new Promise((resolve, reject) => {
    try {
      electronCommunicator.connect(serverUrl);
      // 由于WebSocket连接是异步的，我们需要等待一段时间
      setTimeout(() => {
        if (electronCommunicator.isConnected) {
          resolve();
        } else {
          reject(new Error('连接超时'));
        }
      }, 3000);
    } catch (error) {
      reject(error);
    }
  });
}

// 断开与Electron应用的连接
function disconnectFromElectron() {
  if (electronCommunicator) {
    electronCommunicator.disconnect();
    return Promise.resolve();
  }
  return Promise.resolve();
}

// 生成配对码
function generatePairingCode() {
  if (!electronCommunicator) {
    return Promise.reject(new Error('Electron通信器未初始化'));
  }
  
  if (!electronCommunicator.isConnected) {
    return Promise.reject(new Error('未连接到Electron应用'));
  }
  
  const pairingCode = electronCommunicator.requestPairing();
  return Promise.resolve(pairingCode);
}

// 重置配对
function resetPairing() {
  if (!electronCommunicator) {
    return Promise.reject(new Error('Electron通信器未初始化'));
  }
  
  electronCommunicator.resetPairing();
  return Promise.resolve();
}

// 同步数据到Electron应用
function syncDataToElectron() {
  if (!electronCommunicator || !electronCommunicator.isConnected || !electronCommunicator.isPaired()) {
    return Promise.reject(new Error('未连接或未配对Electron应用'));
  }
  
  electronCommunicator.syncStudyData();
  return Promise.resolve();
}

// 添加一个检查数据库状态的函数
function checkDatabaseStatus() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('BilibiliStudyAssistant', 1);
      
      request.onerror = (event) => {
        resolve({
          status: 'error',
          message: '数据库打开失败',
          error: event.target.error.message
        });
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const stores = Array.from(db.objectStoreNames);
        
        // 检查所有存储对象
        const transaction = db.transaction(stores, 'readonly');
        const storeStats = {};
        
        let storeChecks = stores.map(storeName => {
          return new Promise(resolveStore => {
            const store = transaction.objectStore(storeName);
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
              storeStats[storeName] = countRequest.result;
              resolveStore();
            };
            
            countRequest.onerror = () => {
              storeStats[storeName] = 'error';
              resolveStore();
            };
          });
        });
        
        Promise.all(storeChecks).then(() => {
          resolve({
            status: 'success',
            stores: stores,
            stats: storeStats,
            version: db.version
          });
        });
      };
    } catch (error) {
      resolve({
        status: 'exception',
        message: error.toString()
      });
    }
  });
}

// 获取每日详细统计数据
function getDailyDetailedStats(date) {
  return new Promise((resolve, reject) => {
    initDatabase().then(db => {
      try {
        const transaction = db.transaction(['dailyStats', 'studyRecords'], 'readonly');
        const dailyStatsStore = transaction.objectStore('dailyStats');
        const studyRecordsStore = transaction.objectStore('studyRecords');
        
        // 获取日期统计数据
        const dailyStatsRequest = dailyStatsStore.get(date);
        
        dailyStatsRequest.onsuccess = (event) => {
          const dailyStats = event.target.result || {
            date: date,
            totalDuration: 0,
            videoCount: 0,
            videos: {}
          };
          
          // 创建小时分布数据数组(24小时)
          const hourlyStats = new Array(24).fill(0);
          
          // 获取当天的学习记录
          const dateObj = new Date(date);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          
          const dateIndex = studyRecordsStore.index('date');
          const range = IDBKeyRange.bound(
            dateObj.toISOString(),
            nextDate.toISOString(),
            false,
            true
          );
          
          const recordsRequest = dateIndex.getAll(range);
          
          recordsRequest.onsuccess = (event) => {
            const records = event.target.result || [];
            
            // 计算小时分布
            records.forEach(record => {
              const startTime = new Date(record.startTime);
              const hour = startTime.getHours();
              hourlyStats[hour] += record.duration;
            });
            
            // 构建完整的响应对象
            const result = {
              date: date,
              totalDuration: dailyStats.totalDuration || 0,
              videoCount: dailyStats.videoCount || 0,
              videos: dailyStats.videos || {},
              hourlyStats: hourlyStats,
              records: records
            };
            
            resolve(result);
          };
          
          recordsRequest.onerror = (event) => {
            reject(event);
          };
        };
        
        dailyStatsRequest.onerror = (event) => {
          reject(event);
        };
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

// 获取月度统计数据
function getMonthlyStats(startDate, endDate) {
  return new Promise((resolve, reject) => {
    try {
      initDatabase().then(db => {
        const transaction = db.transaction(['dailyStats'], 'readonly');
        const dailyStatsStore = transaction.objectStore('dailyStats');
        
        // 定义日期范围
        const range = IDBKeyRange.bound(startDate, endDate);
        
        // 获取该范围内的所有日期数据
        const dailyData = [];
        
        const cursorRequest = dailyStatsStore.openCursor(range);
        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            dailyData.push(cursor.value);
            cursor.continue();
          } else {
            resolve(dailyData);
          }
        };
        
        cursorRequest.onerror = (event) => {
          console.error('获取月度数据失败:', event);
          reject(event);
        };
      }).catch(reject);
    } catch (error) {
      console.error('获取月度统计数据异常:', error);
      reject(error);
    }
  });
}

// 导出学习数据为CSV
function exportStudyData(period) {
  return new Promise((resolve, reject) => {
    getStudyStats(period)
      .then(stats => {
        // 创建CSV内容
        let csv = 'date,total_duration_seconds,video_count\n';
        
        // 添加每日数据
        stats.dailyData.forEach(day => {
          csv += `${day.date},${day.duration},${day.videoCount}\n`;
        });
        
        csv += '\n\ntitle,duration_seconds,count\n';
        
        // 添加视频数据
        stats.topVideos.forEach(video => {
          // 处理CSV中的引号和逗号
          const safeTitle = video.title.replace(/"/g, '""');
          csv += `"${safeTitle}",${video.duration},${video.count}\n`;
        });
        
        resolve({ csv: csv });
      })
      .catch(reject);
  });
}

// 监听来自content.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'saveStudyRecord') {
    addStudyRecord(message.data)
      .then(() => {
        // 如果已连接到Electron应用，同步新记录
        if (electronCommunicator && electronCommunicator.isConnected && electronCommunicator.isPaired()) {
          // 发送单条记录
          electronCommunicator.sendMessage({
            type: 'newStudyRecord',
            data: message.data
          });
        }
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'getStudyStats') {
    getStudyStats(message.period)
      .then(stats => sendResponse({ success: true, data: stats }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'getStudyHistory') {
    getStudyHistory(message.limit, message.offset)
      .then(records => sendResponse({ success: true, data: records }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'connectToElectron') {
    connectToElectron(message.serverUrl)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'disconnectFromElectron') {
    disconnectFromElectron()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'generatePairingCode') {
    generatePairingCode()
      .then(pairingCode => sendResponse({ success: true, pairingCode: pairingCode }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'resetPairing') {
    resetPairing()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'syncDataNow') {
    syncDataToElectron()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'getConnectionStatus') {
    // 返回当前连接状态
    sendResponse({
      isConnected: electronCommunicator ? electronCommunicator.isConnected : false,
      isPaired: electronCommunicator ? electronCommunicator.isPaired() : false
    });
    return false; // 同步响应
  } else if (message.type === 'initDatabase') {
    initDatabase()
      .then(db => {
        console.log('数据库初始化成功');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('数据库初始化失败:', error);
        sendResponse({ success: false, error: error.toString() });
      });
    return true; // 异步响应
  } else if (message.type === 'rebuildDatabase') {
    // 删除旧数据库并重新创建
    const deleteRequest = indexedDB.deleteDatabase('BilibiliStudyAssistant');
    
    deleteRequest.onsuccess = function() {
      console.log('数据库已删除，准备重建');
      // 重新初始化数据库
      initDatabase()
        .then(db => {
          console.log('数据库重建成功');
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('数据库重建失败:', error);
          sendResponse({ success: false, error: error.toString() });
        });
    };
    
    deleteRequest.onerror = function(event) {
      console.error('删除数据库失败:', event);
      sendResponse({ success: false, error: '删除数据库失败' });
    };
    
    return true; // 异步响应
  } else if (message.type === 'checkDatabaseStatus') {
    checkDatabaseStatus().then(status => {
      sendResponse(status);
    }).catch(error => {
      sendResponse({ status: 'error', message: error.toString() });
    });
    return true; // 异步响应
  } else if (message.type === 'getDailyDetailedStats') {
    getDailyDetailedStats(message.date)
      .then(stats => sendResponse({ success: true, data: stats }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'saveNote') {
    saveNote(message.data)
      .then(result => sendResponse({ success: true, id: result.id }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'getNotes') {
    getNotes()
      .then(notes => sendResponse({ success: true, data: notes }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'deleteNote') {
    deleteNote(message.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'getMonthlyStats') {
    getMonthlyStats(message.startDate, message.endDate)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  } else if (message.type === 'exportStudyData') {
    exportStudyData(message.period)
      .then(data => sendResponse({ success: true, csv: data.csv }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // 异步响应
  }
});

// 定期清理过期数据（每周一次）
setInterval(cleanupOldData, 7 * 24 * 60 * 60 * 1000);

// 初始化数据库
initDatabase().catch(error => console.error('初始化数据库失败:', error));

// 修复 getDateRange 函数
function getDateRange(period) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
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
  
  startDate.setHours(0, 0, 0, 0);
  
  return {
    start: startDate,
    end: today
  };
}