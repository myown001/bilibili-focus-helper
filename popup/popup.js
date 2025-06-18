// popup.js - 处理学习统计数据展示

// 当前选择的时间段
let currentPeriod = 'week';
// 历史记录分页
let historyOffset = 0;
let historyLimit = 5;
let hasMoreHistory = true;

// 格式化时间（将秒转换为小时:分钟:秒格式）
function formatTime(seconds) {
  if (seconds < 60) return seconds + '秒';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return hours + '小时' + (minutes > 0 ? minutes + '分钟' : '');
  } else {
    return minutes + '分钟';
  }
}

// 格式化日期
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 安全地设置元素内容的辅助函数
function safeSetElementText(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`元素 #${id} 不存在，无法设置文本内容`);
  }
}

// 添加重置数据库按钮
document.addEventListener('DOMContentLoaded', function() {
  // 添加重置按钮到页面
  const headerDiv = document.querySelector('.header');
  if (headerDiv) {
    const resetButton = document.createElement('button');
    resetButton.textContent = '重置数据';
    resetButton.className = 'reset-btn';
    resetButton.style.fontSize = '12px';
    resetButton.style.padding = '4px 8px';
    resetButton.style.backgroundColor = '#f44336';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.borderRadius = '4px';
    resetButton.style.cursor = 'pointer';
    
    resetButton.addEventListener('click', function() {
      if (confirm('确定要重置所有学习数据吗？这将删除所有记录！')) {
        chrome.runtime.sendMessage({ type: 'rebuildDatabase' }, function(response) {
          if (response && response.success) {
            alert('数据已重置，请重新开始记录学习数据');
            window.location.reload();
          } else {
            alert('重置数据失败: ' + (response ? response.error : '未知错误'));
          }
        });
      }
    });
    
    headerDiv.appendChild(resetButton);
  }
  
  // 添加调试信息按钮
  const debugButton = document.createElement('button');
  debugButton.textContent = '诊断';
  debugButton.className = 'debug-btn';
  debugButton.style.fontSize = '12px';
  debugButton.style.padding = '4px 8px';
  debugButton.style.backgroundColor = '#2196F3';
  debugButton.style.color = 'white';
  debugButton.style.border = 'none';
  debugButton.style.borderRadius = '4px';
  debugButton.style.cursor = 'pointer';
  debugButton.style.marginLeft = '8px';
  
  debugButton.addEventListener('click', function() {
    // 检查数据库状态
    chrome.runtime.sendMessage({ type: 'checkDatabaseStatus' }, function(response) {
      alert('数据库状态: ' + JSON.stringify(response, null, 2));
    });
  });
  
  if (headerDiv) {
    headerDiv.appendChild(debugButton);
  }
});

// 修改loadStudyStats函数，添加更多错误处理
function loadStudyStats(period = 'week') {
  console.log('正在加载学习统计数据，周期:', period);
  
  // 显示加载状态
  safeSetElementText('total-time', '加载中...');
  safeSetElementText('video-count', '...');
  
  // 添加调试信息
  console.log('发送消息到后台脚本获取学习统计数据');
  
  chrome.runtime.sendMessage(
    { type: 'getStudyStats', period: period },
    function(response) {
      console.log('获取到的统计数据响应:', response);
      
      if (response && response.success) {
        console.log('成功获取数据，准备渲染');
        renderStats(response.data);
      } else {
        console.error('获取学习统计失败:', response ? response.error : '未知错误');
        
        // 显示错误状态
        safeSetElementText('total-time', '加载失败');
        safeSetElementText('video-count', '0');
        safeSetElementText('avg-duration', '0分钟');
        safeSetElementText('avg-rate', '1.0x');
        
        // 显示空图表
        renderEmptyChart();
        
        // 显示错误消息
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = '无法加载学习数据，请尝试重置数据库';
        errorMsg.style.color = '#f44336';
        errorMsg.style.textAlign = 'center';
        errorMsg.style.padding = '10px';
        
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
          chartContainer.appendChild(errorMsg);
        }
      }
    }
  );
}

// 加载学习历史记录
function loadStudyHistory(limit = 5, offset = 0, append = false) {
  chrome.runtime.sendMessage(
    { type: 'getStudyHistory', limit: limit, offset: offset },
    function(response) {
      if (response && response.success) {
        renderHistory(response.data, append);
        // 更新是否有更多历史记录
        hasMoreHistory = response.data.length === limit;
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
          loadMoreBtn.style.display = hasMoreHistory ? 'block' : 'none';
        }
      } else {
        console.error('获取学习历史失败:', response ? response.error : '未知错误');
        if (!append) {
          const historyList = document.getElementById('history-list');
          if (historyList) {
            historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
          }
        }
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
          loadMoreBtn.style.display = 'none';
        }
      }
    }
  );
}

// 渲染统计数据
function renderStats(stats) {
  console.log('渲染统计数据:', stats);
  
  // 确保stats对象包含所有必要的属性
  stats = stats || {};
  stats.totalDuration = stats.totalDuration || 0;
  stats.videoCount = stats.videoCount || 0;
  stats.recordCount = stats.recordCount || 0;
  stats.avgPlaybackRate = stats.avgPlaybackRate || 1.0;
  stats.dailyData = stats.dailyData || [];
  stats.topVideos = stats.topVideos || [];
  
  // 安全地更新UI元素
  safeSetElementText('total-time', formatTime(stats.totalDuration));
  safeSetElementText('video-count', stats.videoCount.toString());
  
  // 只有在元素存在时才尝试更新
  const avgDurationElement = document.getElementById('avg-duration');
  if (avgDurationElement) {
    if (stats.recordCount && stats.recordCount > 0) {
      const avgDuration = Math.round(stats.totalDuration / stats.recordCount);
      avgDurationElement.textContent = formatTime(avgDuration);
    } else {
      avgDurationElement.textContent = '0分钟';
    }
  }
  
  const avgRateElement = document.getElementById('avg-rate');
  if (avgRateElement) {
    avgRateElement.textContent = stats.avgPlaybackRate.toFixed(1) + 'x';
  }
  
  // 渲染图表
  renderChart(stats.dailyData);
  
  // 渲染热门视频列表（如果相关元素存在）
  if (stats.topVideos && stats.topVideos.length > 0) {
    const topVideosElement = document.getElementById('top-videos');
    if (topVideosElement) {
      renderTopVideos(stats.topVideos);
    }
  }
}

// 渲染图表
function renderChart(dailyData) {
  const chartElement = document.getElementById('study-chart');
  if (!chartElement) {
    console.warn('图表容器不存在，无法渲染图表');
    return;
  }
  
  try {
    // 确保有有效数据
    if (!dailyData || dailyData.length === 0) {
      renderEmptyChart();
      return;
    }
    
    const ctx = chartElement.getContext('2d');
    
    // 准备图表数据
    const labels = dailyData.map(item => item.date);
    const data = dailyData.map(item => Math.round(item.duration / 60)); // 转换为分钟
    
    // 如果已有图表，先销毁
    if (window.studyChart) {
      window.studyChart.destroy();
    }
    
    // 创建新图表
    window.studyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '学习时长（分钟）',
          data: data,
          backgroundColor: 'rgba(0, 161, 214, 0.7)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error('渲染图表时出错:', error);
    // 尝试渲染空图表作为后备
    try {
      renderEmptyChart();
    } catch (e) {
      console.error('渲染空图表也失败:', e);
    }
  }
}

// 渲染热门视频列表
function renderTopVideos(topVideos) {
  const topVideosList = document.getElementById('top-videos-list');
  
  if (topVideos.length === 0) {
    topVideosList.innerHTML = '<div class="empty-state">暂无数据</div>';
    return;
  }
  
  let html = '';
  topVideos.forEach(video => {
    html += `
      <div class="video-item">
        <div class="video-title">${video.title}</div>
        <div class="video-duration">${formatTime(video.duration)}</div>
      </div>
    `;
  });
  
  topVideosList.innerHTML = html;
}

// 渲染历史记录
function renderHistory(records, append = false) {
  const historyList = document.getElementById('history-list');
  
  if (records.length === 0) {
    if (!append) {
      historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
    }
    return;
  }
  
  let html = append ? historyList.innerHTML : '';
  if (html.includes('empty-state')) {
    html = '';
  }
  
  records.forEach(record => {
    // 使用记录中的持续时间，如果没有则计算
    const duration = record.duration || Math.round((new Date(record.endTime) - new Date(record.startTime)) / 1000);
    const playbackRate = record.playbackRate || 1.0;
    
    // 构建更详细的历史记录项
    html += `
      <div class="history-item">
        <div class="history-title">${record.title}</div>
        <div class="history-meta">
          <span>${formatDate(record.date)}</span>
          <span>${formatTime(duration)}</span>
          ${playbackRate !== 1.0 ? `<span class="playback-rate">速率: ${playbackRate}x</span>` : ''}
        </div>
        ${record.url ? `<a href="${record.url}" class="history-link" target="_blank">继续学习</a>` : ''}
      </div>
    `;
  });
  
  historyList.innerHTML = html;
}

// 显示空状态
function showEmptyState() {
  document.getElementById('total-time').textContent = '0小时';
  document.getElementById('video-count').textContent = '0';
  document.getElementById('top-videos-list').innerHTML = '<div class="empty-state">暂无数据</div>';
  
  // 创建空图表
  const ctx = document.getElementById('study-chart').getContext('2d');
  if (window.studyChart) {
    window.studyChart.destroy();
  }
  window.studyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '学习时长（分钟）',
        data: [],
        backgroundColor: 'rgba(0, 161, 214, 0.7)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// 添加空图表渲染函数
function renderEmptyChart() {
  const chartElement = document.getElementById('study-chart');
  if (!chartElement) {
    console.warn('图表容器不存在，无法渲染空图表');
    return;
  }
  
  try {
    // 如果已有图表，先销毁
    if (window.studyChart) {
      window.studyChart.destroy();
    }
    
    // 创建空图表
    window.studyChart = new Chart(chartElement.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['无数据'],
        datasets: [{
          label: '学习时长（分钟）',
          data: [0],
          backgroundColor: 'rgba(0, 161, 214, 0.7)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error('渲染空图表时出错:', error);
  }
}

// 增强日历视图
function enhancedCalendarView() {
  const container = document.getElementById('calendar-container');
  if (!container) return;
  
  // 清空现有内容
  container.innerHTML = '';
  
  // 创建日历标题和控制区域
  const calendarHeader = document.createElement('div');
  calendarHeader.className = 'calendar-header';
  
  // 添加月份导航
  const currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  
  const monthNavigation = document.createElement('div');
  monthNavigation.className = 'month-navigation';
  monthNavigation.innerHTML = `
    <button class="prev-month">←</button>
    <h3 id="month-display">${currentYear}年${currentMonth + 1}月</h3>
    <button class="next-month">→</button>
  `;
  
  calendarHeader.appendChild(monthNavigation);
  container.appendChild(calendarHeader);
  
  // 创建并更新日历网格
  const calendarGrid = document.createElement('div');
  calendarGrid.className = 'calendar-grid';
  container.appendChild(calendarGrid);
  
  updateCalendarGrid(calendarGrid, currentYear, currentMonth);
  
  // 设置月份切换事件
  document.querySelector('.prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    document.getElementById('month-display').textContent = `${currentYear}年${currentMonth + 1}月`;
    updateCalendarGrid(calendarGrid, currentYear, currentMonth);
  });
  
  document.querySelector('.next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    document.getElementById('month-display').textContent = `${currentYear}年${currentMonth + 1}月`;
    updateCalendarGrid(calendarGrid, currentYear, currentMonth);
  });
}

// 优化日历渲染，减少不必要的重绘
function updateCalendarGrid(grid, year, month) {
  // 清空现有内容
  grid.innerHTML = '';
  
  // 添加星期标题
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekdayFragment = document.createDocumentFragment();
  
  weekdays.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'weekday-header';
    dayHeader.textContent = day;
    weekdayFragment.appendChild(dayHeader);
  });
  
  grid.appendChild(weekdayFragment);
  
  // 获取该月第一天和最后一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // 使用文档片段减少DOM操作
  const cellFragment = document.createDocumentFragment();
  
  // 填充前置空白
  for (let i = 0; i < firstDay.getDay(); i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    cellFragment.appendChild(emptyCell);
  }
  
  // 加载该月的学习数据
  loadMonthStudyData(year, month, (studyData) => {
    // 填充日期
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateCell = document.createElement('div');
      dateCell.className = 'calendar-day';
      
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = studyData[dateStr] || null;
      
      // 日期数字
      const dateNumber = document.createElement('span');
      dateNumber.className = 'date-number';
      dateNumber.textContent = day;
      dateCell.appendChild(dateNumber);
      
      // 如果有学习数据，添加指示器
      if (dayData) {
        const timeIndicator = document.createElement('div');
        timeIndicator.className = 'study-time-indicator';
        timeIndicator.textContent = `${Math.round(dayData.totalDuration / 60)}分钟`;
        dateCell.appendChild(timeIndicator);
        
        // 设置背景色深浅表示学习时间长度
        const intensity = Math.min(1, dayData.totalDuration / 7200); // 最高2小时
        dateCell.style.backgroundColor = `rgba(0, 161, 214, ${intensity * 0.4 + 0.1})`;
        dateCell.classList.add('has-data');
        
        // 添加点击事件显示详情
        dateCell.addEventListener('click', () => {
          showDailyDetail(dateStr);
        });
      }
      
      cellFragment.appendChild(dateCell);
    }
    
    grid.appendChild(cellFragment);
  });
}

// 加载月度学习数据
function loadMonthStudyData(year, month, callback) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  chrome.runtime.sendMessage({
    type: 'getMonthlyStats',
    startDate: startDateStr,
    endDate: endDateStr
  }, function(response) {
    if (response && response.success) {
      // 转换为以日期为键的对象
      const studyData = {};
      response.data.forEach(day => {
        studyData[day.date] = day;
      });
      callback(studyData);
    } else {
      console.error('获取月度数据失败:', response ? response.error : '未知错误');
      callback({});
    }
  });
}

// 显示每日详细信息
function showDailyDetail(dateStr) {
  const container = document.getElementById('daily-detail-container');
  if (!container) return;
  
  // 显示加载中
  container.innerHTML = '<div class="loading">正在加载数据...</div>';
  container.style.display = 'block';
  
  // 滚动到详情区域
  container.scrollIntoView({ behavior: 'smooth' });
  
  // 获取详细数据
  chrome.runtime.sendMessage({
    type: 'getDailyDetailedStats',
    date: dateStr
  }, function(response) {
    if (!response || !response.success) {
      container.innerHTML = '<div class="error">加载数据失败</div>';
      return;
    }
    
    const stats = response.data;
    
    // 创建详情面板
    container.innerHTML = `
      <div class="daily-detail-header">
        <div class="date-info">${dateStr}</div>
        <div class="close-button">×</div>
      </div>
      
      <div class="daily-summary">
        <div class="summary-card">
          <div class="summary-value">${formatTime(stats.totalDuration)}</div>
          <div class="summary-label">总学习时间</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${stats.videoCount}</div>
          <div class="summary-label">观看视频数</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${stats.records ? stats.records.length : 0}</div>
          <div class="summary-label">学习次数</div>
        </div>
      </div>
      
      <div class="distribution-chart">
        <h4>学习时间分布</h4>
        <canvas id="hourly-distribution" height="150"></canvas>
      </div>
      
      <div class="daily-videos">
        <h4>学习的视频</h4>
        <div id="video-list" class="video-list"></div>
      </div>
      
      <div class="study-sessions">
        <h4>学习记录</h4>
        <div id="session-list" class="session-list"></div>
      </div>
    `;
    
    // 关闭按钮事件
    document.querySelector('.close-button').addEventListener('click', () => {
      container.style.display = 'none';
    });
    
    // 渲染小时分布图表
    renderHourlyDistribution(stats.hourlyStats);
    
    // 渲染视频列表
    renderDailyVideoList(stats.videos);
    
    // 渲染学习记录
    renderStudySessions(stats.records);
  });
}

// 渲染小时分布图表
function renderHourlyDistribution(hourlyData) {
  const ctx = document.getElementById('hourly-distribution').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 24}, (_, i) => `${i}:00`),
      datasets: [{
        label: '学习时长（分钟）',
        data: hourlyData.map(seconds => Math.round(seconds / 60)),
        backgroundColor: 'rgba(0, 161, 214, 0.7)'
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// 渲染视频列表
function renderDailyVideoList(videos) {
  const container = document.getElementById('video-list');
  if (!container || !videos) return;
  
  const videoEntries = Object.entries(videos);
  if (videoEntries.length === 0) {
    container.innerHTML = '<div class="empty-message">没有学习记录</div>';
    return;
  }
  
  // 按学习时长排序
  videoEntries.sort((a, b) => b[1].duration - a[1].duration);
  
  let html = '';
  videoEntries.forEach(([videoId, video]) => {
    html += `
      <div class="video-item">
        <div class="video-title">${video.title}</div>
        <div class="video-meta">
          <span class="video-duration">${formatTime(video.duration)}</span>
          <span class="video-count">${video.count}次观看</span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 渲染学习记录
function renderStudySessions(records) {
  const container = document.getElementById('session-list');
  if (!container || !records) return;
  
  if (records.length === 0) {
    container.innerHTML = '<div class="empty-message">没有详细记录</div>';
    return;
  }
  
  // 按开始时间排序
  records.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  
  let html = '';
  records.forEach(record => {
    const startTime = new Date(record.startTime);
    const endTime = new Date(record.endTime);
    
    html += `
      <div class="session-item">
        <div class="session-time">
          ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}
        </div>
        <div class="session-title">${record.title}</div>
        <div class="session-meta">
          <span class="session-duration">${formatTime(record.duration)}</span>
          ${record.playbackRate !== 1 ? `<span class="playback-rate">${record.playbackRate}x</span>` : ''}
        </div>
        ${record.url ? `<a href="${record.url}" class="session-link" target="_blank">继续观看</a>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 添加导出功能按钮
function addExportButton() {
  const statsHeader = document.querySelector('.stats-header');
  if (!statsHeader) return;
  
  const exportButton = document.createElement('button');
  exportButton.className = 'export-btn';
  exportButton.textContent = '导出数据';
  exportButton.addEventListener('click', () => {
    exportStudyData(currentPeriod);
  });
  
  statsHeader.appendChild(exportButton);
}

// 导出学习数据
function exportStudyData(period) {
  chrome.runtime.sendMessage(
    { type: 'exportStudyData', period: period },
    function(response) {
      if (response && response.success) {
        // 创建下载链接
        const blob = new Blob([response.csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bilibili_study_data_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('导出数据失败: ' + (response ? response.error : '未知错误'));
      }
    }
  );
}

// 添加一个函数来检查数据库状态
function checkDatabaseStatus() {
  chrome.runtime.sendMessage(
    { type: 'checkDatabaseStatus' },
    function(response) {
      console.log('数据库状态检查结果:', response);
      
      // 在UI中显示数据库状态
      const statusInfo = document.createElement('div');
      statusInfo.style.fontSize = '12px';
      statusInfo.style.color = '#666';
      statusInfo.style.padding = '5px';
      statusInfo.style.marginTop = '10px';
      statusInfo.style.borderTop = '1px solid #eee';
      
      if (response && response.success) {
        statusInfo.textContent = `数据库状态: 正常 (${response.recordCount || 0}条记录)`;
      } else {
        statusInfo.textContent = '数据库状态: 异常';
      }
      
      const container = document.querySelector('.container');
      if (container) {
        container.appendChild(statusInfo);
      }
    }
  );
}

// 合并初始化函数，保留单一入口点
function initPopup() {
  console.log('初始化弹出窗口...');
  
  try {
    // 检查必要的HTML元素是否存在
    const requiredElements = ['total-time', 'video-count', 'study-chart', 'period-selector', 'export-btn'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
      console.warn('页面中缺少以下元素:', missingElements.join(', '));
    }
    
    // 加载初始数据
    loadStudyStats('week');
    loadStudyHistory(historyLimit, historyOffset);
    
    // 设置时间段选择器事件监听
    const periodSelector = document.getElementById('period-selector');
    if (periodSelector) {
      periodSelector.addEventListener('change', function() {
        const period = this.value;
        console.log('选择了新的时间段:', period);
        loadStudyStats(period);
      });
    } else {
      console.warn('找不到时间段选择器元素');
    }
    
    // 设置导出按钮事件
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        console.log('点击了导出按钮');
        chrome.runtime.sendMessage(
          { type: 'exportStudyData', period: periodSelector ? periodSelector.value : 'week' },
          function(response) {
            if (response && response.success) {
              // 创建下载链接
              const blob = new Blob([response.csv], {type: 'text/csv'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `bilibili_study_data_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } else {
              alert('导出数据失败: ' + (response ? response.error : '未知错误'));
            }
          }
        );
      });
    } else {
      console.warn('找不到导出按钮元素');
    }
    
    // 添加数据库状态检查
    checkDatabaseStatus();
    
    // 动态创建加载更多按钮（如果不存在）
    const historyContainer = document.querySelector('.chart-container');
    if (historyContainer && !document.getElementById('load-more-btn')) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.textContent = '加载更多';
      loadMoreBtn.style.display = 'none'; // 默认隐藏
      historyContainer.appendChild(loadMoreBtn);
      
      // 为新创建的按钮添加事件监听器
      loadMoreBtn.addEventListener('click', function() {
        if (hasMoreHistory) {
          historyOffset += historyLimit;
          loadStudyHistory(historyLimit, historyOffset, true);
        }
      });
    }
    
    // 初始化日历视图
    enhancedCalendarView();
    
    // 添加导出功能按钮
    addExportButton();
  } catch (error) {
    console.error('初始化弹出窗口时出错:', error);
    alert('初始化失败: ' + error.message);
  }
}

// 使用单一的DOMContentLoaded监听器
document.addEventListener('DOMContentLoaded', initPopup);

// Electron配对功能
document.getElementById('connect-electron-btn').addEventListener('click', () => {
  const serverUrl = document.getElementById('electron-server-url').value;
  
  if (!serverUrl) {
    alert('请输入WebSocket服务器地址');
    return;
  }
  
  // 保存服务器地址
  chrome.storage.local.set({ electronServerUrl: serverUrl });
  
  // 连接到Electron应用
  chrome.runtime.sendMessage(
    { type: 'connectToElectron', serverUrl },
    (response) => {
      if (response && response.success) {
        // 请求配对
        chrome.runtime.sendMessage(
          { type: 'pairWithElectron' },
          (pairResponse) => {
            if (pairResponse && pairResponse.success) {
              // 显示配对码
              document.getElementById('pairing-code').textContent = pairResponse.pairingCode;
              document.getElementById('electron-pairing-code').style.display = 'block';
              document.getElementById('electron-pairing-controls').style.display = 'none';
            }
          }
        );
      }
    }
  );
});

// 监听配对状态更新
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'pairingStatus') {
    if (message.paired) {
      // 配对成功
      document.getElementById('pairing-status-text').textContent = '已连接到桌面应用';
      document.getElementById('pairing-status-text').style.color = 'green';
      document.getElementById('electron-pairing-code').style.display = 'none';
      
      // 显示同步按钮
      const syncBtn = document.createElement('button');
      syncBtn.textContent = '立即同步数据';
      syncBtn.id = 'sync-data-btn';
      document.getElementById('electron-pairing-status').appendChild(syncBtn);
      
      // 添加同步按钮的点击事件
      document.getElementById('sync-data-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'syncStudyData' });
      });
    } else {
      // 配对失败
      document.getElementById('pairing-status-text').textContent = '连接失败: ' + (message.error || '未知错误');
      document.getElementById('pairing-status-text').style.color = 'red';
      document.getElementById('electron-pairing-controls').style.display = 'block';
    }
  }
});

// 检查当前配对状态
chrome.storage.local.get(['electronAppId'], (result) => {
  if (result.electronAppId) {
    document.getElementById('pairing-status-text').textContent = '已连接到桌面应用';
    document.getElementById('pairing-status-text').style.color = 'green';
    document.getElementById('electron-pairing-code').style.display = 'none';
    
    // 显示同步按钮
    const syncBtn = document.createElement('button');
    syncBtn.textContent = '立即同步数据';
    syncBtn.id = 'sync-data-btn';
    document.getElementById('electron-pairing-status').appendChild(syncBtn);
    
    // 添加同步按钮的点击事件
    document.getElementById('sync-data-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'syncStudyData' });
    });
  }
});