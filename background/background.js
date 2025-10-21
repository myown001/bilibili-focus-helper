// background.js - Service Worker for B站专注学习助手
// 简化版：只处理通知功能，学习数据由 content script 直接存储到 chrome.storage.local

console.log('B站专注学习助手 Service Worker 已启动');

// 注册消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message.type);
  
  // 只处理通知消息
  if (message.type === 'notification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: message.title || 'B站专注学习助手',
      message: message.message,
      priority: 2
    });
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: '未知的消息类型' });
  }
  
  return true; // 保持消息通道开放以支持异步响应
}); 