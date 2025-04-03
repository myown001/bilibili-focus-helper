// 全局变量
let communicator = null;
let isConnected = false;
let isPaired = false;

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
  // 初始化标签页切换
  initTabs();
  
  // 加载已保存的设置
  loadSettings();
  
  // 初始化事件监听
  initEventListeners();
  
  // 检查连接状态
  checkConnectionStatus();
});

// 初始化标签页切换
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 移除所有活动状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 设置当前标签为活动状态
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// 加载已保存的设置
function loadSettings() {
  chrome.storage.local.get(
    ['reminder', 'password', 'wsServerUrl', 'electronAppId', 'pairingCode', 'autoSync', 'syncPlay', 'syncProgress', 'syncRate'], 
    (result) => {
      // 基本设置
      document.getElementById('reminder').value = result.reminder || '';
      document.getElementById('password').value = result.password || '';
      
      // 连接设置
      document.getElementById('server-url').value = result.wsServerUrl || 'ws://localhost:9527';
      
      // 同步设置
      document.getElementById('auto-sync').checked = result.autoSync !== false;
      document.getElementById('sync-play').checked = result.syncPlay !== false;
      document.getElementById('sync-progress').checked = result.syncProgress !== false;
      document.getElementById('sync-rate').checked = result.syncRate !== false;
      
      // 更新配对状态
      isPaired = !!result.electronAppId;
      updatePairingStatus();
    }
  );
}

// 初始化事件监听
function initEventListeners() {
  // 保存基本设置
  document.getElementById('save').addEventListener('click', saveBasicSettings);
  
  // 连接服务器
  document.getElementById('connect-btn').addEventListener('click', connectToServer);
  document.getElementById('disconnect-btn').addEventListener('click', disconnectFromServer);
  
  // 配对操作
  document.getElementById('pair-btn').addEventListener('click', generatePairingCode);
  document.getElementById('reset-pair-btn').addEventListener('click', resetPairing);
  
  // 同步数据
  document.getElementById('sync-now-btn').addEventListener('click', syncDataNow);
  
  // 保存同步设置
  document.getElementById('auto-sync').addEventListener('change', saveSyncSettings);
  document.getElementById('sync-play').addEventListener('change', saveSyncSettings);
  document.getElementById('sync-progress').addEventListener('change', saveSyncSettings);
  document.getElementById('sync-rate').addEventListener('change', saveSyncSettings);
}

// 保存基本设置
function saveBasicSettings() {
  chrome.storage.local.set({
    reminder: document.getElementById('reminder').value,
    password: document.getElementById('password').value
  }, () => {
    showMessage('基本设置已保存！');
  });
}

// 保存同步设置
function saveSyncSettings() {
  chrome.storage.local.set({
    autoSync: document.getElementById('auto-sync').checked,
    syncPlay: document.getElementById('sync-play').checked,
    syncProgress: document.getElementById('sync-progress').checked,
    syncRate: document.getElementById('sync-rate').checked
  }, () => {
    showMessage('同步设置已保存！');
    
    // 通知内容脚本更新设置
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'updateSyncSettings'});
      }
    });
  });
}

// 检查连接状态
function checkConnectionStatus() {
  // 向background.js发送消息，获取连接状态
  chrome.runtime.sendMessage({type: 'getConnectionStatus'}, (response) => {
    if (response) {
      isConnected = response.isConnected;
      isPaired = response.isPaired;
      
      updateConnectionStatus();
      updatePairingStatus();
      
      // 如果已连接，启用相关按钮
      if (isConnected) {
        document.getElementById('pair-btn').disabled = false;
        document.getElementById('sync-now-btn').disabled = false;
      }
    }
  });
}

// 连接到服务器
function connectToServer() {
  const serverUrl = document.getElementById('server-url').value.trim();
  if (!serverUrl) {
    showMessage('请输入有效的服务器地址', 'error');
    return;
  }
  
  // 保存服务器地址
  chrome.storage.local.set({wsServerUrl: serverUrl});
  
  // 更新UI状态
  const statusElement = document.getElementById('connection-status');
  statusElement.textContent = '正在连接...';
  statusElement.className = 'status pairing';
  
  // 发送连接请求到background.js
  chrome.runtime.sendMessage(
    {type: 'connectToElectron', serverUrl: serverUrl},
    (response) => {
      if (response && response.success) {
        isConnected = true;
        updateConnectionStatus();
        showMessage('连接成功！');
        
        // 启用配对按钮
        document.getElementById('pair-btn').disabled = false;
      } else {
        showMessage('连接失败: ' + (response ? response.error : '未知错误'), 'error');
        updateConnectionStatus(false);
      }
    }
  );
}

// 断开服务器连接
function disconnectFromServer() {
  // 发送断开连接请求到background.js
  chrome.runtime.sendMessage({type: 'disconnectFromElectron'}, (response) => {
    if (response && response.success) {
      isConnected = false;
      updateConnectionStatus();
      showMessage('已断开连接');
    } else {
      showMessage('断开连接失败: ' + (response ? response.error : '未知错误'), 'error');
    }
  });
}

// 生成配对码
function generatePairingCode() {
  if (!isConnected) {
    showMessage('请先连接到服务器', 'error');
    return;
  }
  
  // 更新UI状态
  const statusElement = document.getElementById('pairing-status');
  statusElement.textContent = '正在生成配对码...';
  statusElement.className = 'status pairing';
  
  // 发送生成配对码请求到background.js
  chrome.runtime.sendMessage({type: 'generatePairingCode'}, (response) => {
    if (response && response.success) {
      // 显示配对码
      document.getElementById('pairing-code').textContent = response.pairingCode;
      document.getElementById('pairing-code-container').style.display = 'block';
      
      // 更新状态
      statusElement.textContent = '等待Electron应用输入配对码...';
      statusElement.className = 'status pairing';
      
      showMessage('配对码已生成，请在Electron应用中输入');
    } else {
      showMessage('生成配对码失败: ' + (response ? response.error : '未知错误'), 'error');
      statusElement.textContent = '配对失败';
      statusElement.className = 'status disconnected';
    }
  });
}

// 重置配对
function resetPairing() {
  // 发送重置配对请求到background.js
  chrome.runtime.sendMessage({type: 'resetPairing'}, (response) => {
    if (response && response.success) {
      isPaired = false;
      updatePairingStatus();
      document.getElementById('pairing-code-container').style.display = 'none';
      showMessage('配对已重置');
    } else {
      showMessage('重置配对失败: ' + (response ? response.error : '未知错误'), 'error');
    }
  });
}

// 立即同步数据
function syncDataNow() {
  if (!isConnected || !isPaired) {
    showMessage('请先连接并配对Electron应用', 'error');
    return;
  }
  
  // 发送同步数据请求到background.js
  chrome.runtime.sendMessage({type: 'syncDataNow'}, (response) => {
    if (response && response.success) {
      showMessage('数据同步成功！');
    } else {
      showMessage('数据同步失败: ' + (response ? response.error : '未知错误'), 'error');
    }
  });
}

// 更新连接状态UI
function updateConnectionStatus() {
  const statusElement = document.getElementById('connection-status');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  
  if (isConnected) {
    statusElement.textContent = '已连接到Electron应用';
    statusElement.className = 'status connected';
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
  } else {
    statusElement.textContent = '未连接到Electron应用';
    statusElement.className = 'status disconnected';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    
    // 禁用依赖连接的按钮
    document.getElementById('pair-btn').disabled = true;
    document.getElementById('sync-now-btn').disabled = true;
  }
}

// 更新配对状态UI
function updatePairingStatus() {
  const statusElement = document.getElementById('pairing-status');
  const pairBtn = document.getElementById('pair-btn');
  const resetPairBtn = document.getElementById('reset-pair-btn');
  
  if (isPaired) {
    statusElement.textContent = '已与Electron应用配对';
    statusElement.className = 'status connected';
    pairBtn.disabled = true;
    resetPairBtn.disabled = false;
    document.getElementById('sync-now-btn').disabled = !isConnected;
  } else {
    statusElement.textContent = '未与Electron应用配对';
    statusElement.className = 'status disconnected';
    pairBtn.disabled = !isConnected;
    resetPairBtn.disabled = true;
    document.getElementById('sync-now-btn').disabled = true;
  }
}

// 显示消息
function showMessage(message, type = 'success') {
  // 创建消息元素
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messageElement.style.position = 'fixed';
  messageElement.style.bottom = '20px';
  messageElement.style.left = '50%';
  messageElement.style.transform = 'translateX(-50%)';
  messageElement.style.padding = '10px 20px';
  messageElement.style.borderRadius = '4px';
  messageElement.style.zIndex = '9999';
  
  if (type === 'error') {
    messageElement.style.backgroundColor = '#f44336';
  } else {
    messageElement.style.backgroundColor = '#4caf50';
  }
  messageElement.style.color = 'white';
  
  document.body.appendChild(messageElement);
  
  // 3秒后移除消息
  setTimeout(() => {
    document.body.removeChild(messageElement);
  }, 3000);
}

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pairingStatus') {
    // 更新配对状态
    isPaired = message.paired;
    updatePairingStatus();
    
    if (message.paired) {
      document.getElementById('pairing-code-container').style.display = 'none';
      showMessage('配对成功！');
    } else if (message.error) {
      showMessage('配对失败: ' + message.error, 'error');
    }
  } else if (message.type === 'connectionStatus') {
    // 更新连接状态
    isConnected = message.connected;
    updateConnectionStatus();
    
    if (!isConnected) {
      // 如果断开连接，更新配对状态UI
      document.getElementById('pairing-status').textContent = '连接已断开';
      document.getElementById('pairing-status').className = 'status disconnected';
    }
  }
  
  sendResponse({received: true});
  return true;
});