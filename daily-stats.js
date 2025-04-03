// daily-stats.js - 增强版每日学习记录和统计功能

// 日期格式化工具函数
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 时间格式化工具函数
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

// 获取日期范围
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

// 获取每日学习统计数据
function getDailyStats(period = 'week') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'getStudyStats', period: period },
      function(response) {
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(response ? response.error : '未知错误');
        }
      }
    );
  });
}

// 获取学习历史记录
function getStudyHistory(limit = 10, offset = 0) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'getStudyHistory', limit: limit, offset: offset },
      function(response) {
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(response ? response.error : '未知错误');
        }
      }
    );
  });
}

// 导出每日学习数据为CSV
function exportDailyStatsToCSV(period = 'month') {
  getDailyStats(period).then(stats => {
    // 准备CSV数据
    let csvContent = "日期,学习时长(分钟),学习视频数\n";
    
    stats.dailyData.forEach(day => {
      const row = [
        day.date,
        Math.round(day.duration / 60), // 转换为分钟
        day.videoCount
      ];
      csvContent += row.join(',') + "\n";
    });
    
    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `学习统计_${period}_${formatDate(new Date())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }).catch(error => {
    console.error('导出数据失败:', error);
    alert('导出数据失败: ' + error);
  });
}

// 渲染每日学习热力图
function renderHeatmap(containerId, dailyData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // 清空容器
  container.innerHTML = '';
  
  // 如果没有数据，显示空状态
  if (!dailyData || dailyData.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无数据</div>';
    return;
  }
  
  // 创建热力图容器
  const heatmapContainer = document.createElement('div');
  heatmapContainer.className = 'heatmap-container';
  container.appendChild(heatmapContainer);
  
  // 获取最近3个月的日期
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(today.getMonth() - 3);
  
  // 创建日期映射
  const dateMap = {};
  dailyData.forEach(item => {
    dateMap[item.date] = {
      duration: Math.round(item.duration / 60), // 转换为分钟
      videoCount: item.videoCount
    };
  });
  
  // 创建热力图单元格
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  
  // 创建星期标签
  const weekLabels = document.createElement('div');
  weekLabels.className = 'week-labels';
  for (let i = 0; i < 7; i++) {
    const label = document.createElement('div');
    label.className = 'week-label';
    label.textContent = dayNames[i];
    weekLabels.appendChild(label);
  }
  heatmapContainer.appendChild(weekLabels);
  
  // 创建热力图网格
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  heatmapContainer.appendChild(grid);
  
  // 填充热力图数据
  let currentDate = new Date(startDate);
  while (currentDate <= today) {
    const dateStr = formatDate(currentDate);
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    // 设置单元格颜色
    if (dateMap[dateStr]) {
      const intensity = Math.min(dateMap[dateStr].duration / 120, 1); // 最高2小时
      cell.style.backgroundColor = `rgba(0, 161, 214, ${intensity})`;
      cell.title = `${dateStr}\n学习时长: ${formatTime(dateMap[dateStr].duration * 60)}\n视频数: ${dateMap[dateStr].videoCount}`;
    } else {
      cell.style.backgroundColor = '#eee';
      cell.title = dateStr;
    }
    
    grid.appendChild(cell);
    
    // 移动到下一天
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // 添加图例
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  legend.innerHTML = `
    <div class="legend-item">
      <div class="legend-color" style="background-color: #eee;"></div>
      <div class="legend-label">无学习</div>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: rgba(0, 161, 214, 0.2);"></div>
      <div class="legend-label">< 30分钟</div>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: rgba(0, 161, 214, 0.5);"></div>
      <div class="legend-label">30-60分钟</div>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: rgba(0, 161, 214, 0.8);"></div>
      <div class="legend-label">1-2小时</div>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: rgba(0, 161, 214, 1);"></div>
      <div class="legend-label">≥ 2小时</div>
    </div>
  `;
  container.appendChild(legend);
}

// 导出函数
window.DailyStats = {
  getDailyStats,
  getStudyHistory,
  exportDailyStatsToCSV,
  renderHeatmap,
  formatDate,
  formatTime
};