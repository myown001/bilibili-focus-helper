// daily-stats.js - 优化版每日学习记录和统计功能

// 使用立即执行函数表达式(IIFE)创建模块化结构
(function() {
  'use strict';
  
  // ===== 工具函数模块 =====
  const Utils = {
    // 日期格式化工具函数
    formatDate: function(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    
    // 时间格式化工具函数
    formatTime: function(seconds) {
      if (seconds < 60) return seconds + '秒';
      
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (hours > 0) {
        return hours + '小时' + (minutes > 0 ? minutes + '分钟' : '');
      } else {
        return minutes + '分钟';
      }
    },
    
    // 防抖函数
    debounce: function(func, wait) {
      let timeout;
      return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    },
    
    // 节流函数
    throttle: function(func, limit) {
      let inThrottle;
      return function(...args) {
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
    
    // 安全地发送消息到background.js
    sendMessage: function(message) {
      return new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(message, function(response) {
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(response ? response.error : '未知错误');
            }
          });
        } catch (error) {
          console.error('发送消息失败:', error);
          reject(error);
        }
      });
    },
    
    // 创建DOM元素的辅助函数
    createElement: function(tag, attributes = {}, children = []) {
      const element = document.createElement(tag);
      
      // 设置属性
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
          const eventName = key.slice(2).toLowerCase();
          element.addEventListener(eventName, value);
        } else {
          element.setAttribute(key, value);
        }
      });
      
      // 添加子元素
      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      });
      
      return element;
    }
  };
  
  // ===== 数据管理模块 =====
  const DataManager = {
    // 获取日期范围
    getDateRange: function(period) {
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
    },
    
    // 获取每日学习统计数据
    getDailyStats: function(period = 'week') {
      return Utils.sendMessage({ 
        type: 'getStudyStats', 
        period: period 
      });
    },
    
    // 获取学习历史记录
    getStudyHistory: function(limit = 10, offset = 0) {
      return Utils.sendMessage({ 
        type: 'getStudyHistory', 
        limit: limit, 
        offset: offset 
      });
    },
    
    // 导出每日学习数据为CSV
    exportDailyStatsToCSV: async function(period = 'month') {
      try {
        const stats = await this.getDailyStats(period);
        
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
        link.setAttribute("download", `学习统计_${period}_${Utils.formatDate(new Date())}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return { success: true };
      } catch (error) {
        console.error('导出数据失败:', error);
        throw new Error('导出数据失败: ' + error);
      }
    }
  };
  
  // ===== 视图渲染模块 =====
  const ViewRenderer = {
    // 渲染图表
    renderChart: function(containerId, dailyData) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // 清空容器
      container.innerHTML = '';
      
      // 如果没有数据，显示空状态
      if (!dailyData || dailyData.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
      }
      
      // 准备图表数据
      const dates = dailyData.map(day => day.date);
      const durations = dailyData.map(day => Math.round(day.duration / 60)); // 转换为分钟
      
      // 创建图表容器
      const canvas = Utils.createElement('canvas', {
        width: container.clientWidth,
        height: container.clientHeight
      });
      container.appendChild(canvas);
      
      // 使用Chart.js渲染图表
      if (window.Chart) {
        new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: dates,
            datasets: [{
              label: '学习时长(分钟)',
              data: durations,
              backgroundColor: 'rgba(0, 161, 214, 0.5)',
              borderColor: 'rgba(0, 161, 214, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: '分钟'
                }
              }
            }
          }
        });
      } else {
        // 如果没有Chart.js，使用简单的DIV条形图
        const maxDuration = Math.max(...durations, 1);
        const chartHtml = dates.map((date, index) => {
          const height = (durations[index] / maxDuration) * 100;
          return `
            <div class="chart-bar-container">
              <div class="chart-bar" style="height: ${height}%;" title="${date}: ${durations[index]}分钟"></div>
              <div class="chart-label">${date.slice(-2)}</div>
            </div>
          `;
        }).join('');
        
        container.innerHTML = `
          <div class="simple-chart">
            ${chartHtml}
          </div>
          <div class="chart-y-axis">
            <div class="chart-y-label">${Math.round(maxDuration)}分钟</div>
            <div class="chart-y-label">${Math.round(maxDuration/2)}分钟</div>
            <div class="chart-y-label">0分钟</div>
          </div>
        `;
      }
    },
    
    // 渲染历史列表
    renderHistoryList: function(containerId, historyData) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // 清空容器
      container.innerHTML = '';
      
      // 如果没有数据，显示空状态
      if (!historyData || historyData.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
      }
      
      // 创建列表
      const list = Utils.createElement('div', { className: 'history-list' });
      
      // 添加列表项
      historyData.forEach(item => {
        const date = new Date(item.date);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const formattedTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        const listItem = Utils.createElement('div', { className: 'history-item' }, [
          Utils.createElement('div', { className: 'history-title' }, [item.title]),
          Utils.createElement('div', { className: 'history-meta' }, [
            `${formattedDate} ${formattedTime} · ${Utils.formatTime(item.duration)} · ${item.playbackRate}x`
          ]),
          Utils.createElement('a', { 
            className: 'history-link',
            href: item.url,
            target: '_blank'
          }, ['查看视频'])
        ]);
        
        list.appendChild(listItem);
      });
      
      container.appendChild(list);
    },
    
    // 渲染热力图
    renderHeatmap: function(containerId, dailyData) {
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
      const heatmapContainer = Utils.createElement('div', { className: 'heatmap-container' });
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
      const weekLabels = Utils.createElement('div', { className: 'week-labels' });
      for (let i = 0; i < 7; i++) {
        weekLabels.appendChild(
          Utils.createElement('div', { className: 'week-label' }, [dayNames[i]])
        );
      }
      heatmapContainer.appendChild(weekLabels);
      
      // 创建热力图网格
      const grid = Utils.createElement('div', { className: 'heatmap-grid' });
      heatmapContainer.appendChild(grid);
      
      // 填充热力图
    }
  };
  
  // 导出函数
  window.DailyStats = {
    getDailyStats: DataManager.getDailyStats,
    getStudyHistory: DataManager.getStudyHistory,
    exportDailyStatsToCSV: DataManager.exportDailyStatsToCSV,
    renderChart: ViewRenderer.renderChart,
    renderHistoryList: ViewRenderer.renderHistoryList,
    renderHeatmap: ViewRenderer.renderHeatmap,
    formatDate: Utils.formatDate,
    formatTime: Utils.formatTime
  };
})();