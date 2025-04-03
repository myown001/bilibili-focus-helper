// optimized-daily-stats.js - 优化版每日学习记录和统计功能

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
    getDailyStats: async function(period = 'week') {
      try {
        return await Utils.sendMessage({ type: 'getStudyStats', period: period });
      } catch (error) {
        console.error('获取统计数据失败:', error);
        throw error;
      }
    },
    
    // 获取学习历史记录
    getStudyHistory: async function(limit = 10, offset = 0) {
      try {
        return await Utils.sendMessage({ 
          type: 'getStudyHistory', 
          limit: limit, 
          offset: offset 
        });
      } catch (error) {
        console.error('获取历史记录失败:', error);
        throw error;
      }
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
        
        return true;
      } catch (error) {
        console.error('导出数据失败:', error);
        throw error;
      }
    }
  };
  
  // ===== 视图渲染模块 =====
  const ViewRenderer = {
    // 渲染每日学习热力图
    renderHeatmap: function(containerId, dailyData) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // 使用DocumentFragment减少DOM重排
      const fragment = document.createDocumentFragment();
      
      // 清空容器
      container.innerHTML = '';
      
      // 如果没有数据，显示空状态
      if (!dailyData || dailyData.length === 0) {
        const emptyState = Utils.createElement('div', { className: 'empty-state' }, ['暂无数据']);
        fragment.appendChild(emptyState);
        container.appendChild(fragment);
        return;
      }
      
      // 创建热力图容器
      const heatmapContainer = Utils.createElement('div', { className: 'heatmap-container' });
      
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
        const label = Utils.createElement('div', { className: 'week-label' }, [dayNames[i]]);
        weekLabels.appendChild(label);
      }
      heatmapContainer.appendChild(weekLabels);
      
      // 创建热力图网格
      const grid = Utils.createElement('div', { className: 'heatmap-grid' });
      
      // 填充热力图数据
      let currentDate = new Date(startDate);
      while (currentDate <= today) {
        const dateStr = Utils.formatDate(currentDate);
        const cellData = dateMap[dateStr];
        
        const cellAttrs = { className: 'heatmap-cell' };
        
        // 设置单元格颜色和提示信息
        if (cellData) {
          const intensity = Math.min(cellData.duration / 120, 1); // 最高2小时
          cellAttrs.style = { backgroundColor: `rgba(0, 161, 214, ${intensity})` };
          cellAttrs.title = `${dateStr}\n学习时长: ${Utils.formatTime(cellData.duration * 60)}\n视频数: ${cellData.videoCount}`;
        } else {
          cellAttrs.style = { backgroundColor: '#eee' };
          cellAttrs.title = dateStr;
        }
        
        const cell = Utils.createElement('div', cellAttrs);
        grid.appendChild(cell);
        
        // 移动到下一天
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      heatmapContainer.appendChild(grid);
      
      // 添加图例
      const legend = Utils.createElement('div', { className: 'heatmap-legend' });
      
      const legendItems = [
        { color: '#eee', label: '无学习' },
        { color: 'rgba(0, 161, 214, 0.2)', label: '< 30分钟' },
        { color: 'rgba(0, 161, 214, 0.5)', label: '30-60分钟' },
        { color: 'rgba(0, 161, 214, 0.8)', label: '1-2小时' },
        { color: 'rgba(0, 161, 214, 1)', label: '> 2小时' }
      ];
      
      legendItems.forEach(item => {
        const legendItem = Utils.createElement('div', { className: 'legend-item' });
        const legendColor = Utils.createElement('div', { 
          className: 'legend-color',
          style: { backgroundColor: item.color }
        });
        const legendLabel = Utils.createElement('div', { className: 'legend-label' }, [item.label]);
        
        legendItem.appendChild(legendColor);
        legendItem.appendChild(legendLabel);
        legend.appendChild(legendItem);
      });
      
      heatmapContainer.appendChild(legend);
      fragment.appendChild(heatmapContainer);
      container.appendChild(fragment);
    },
    
    // 渲染学习统计图表
    renderChart: function(containerId, dailyData, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      const ctx = container.getContext('2d');
      
      // 如果已经有图表，先销毁
      if (window.studyChart) {
        window.studyChart.destroy();
      }
      
      // 准备图表数据
      const labels = dailyData.map(item => Utils.formatDate(new Date(item.date)));
      const durations = dailyData.map(item => Math.round(item.duration / 60)); // 转换为分钟
      const videoCount = dailyData.map(item => item.videoCount || 0); // 视频数量
      
      // 创建图表配置
      const chartConfig = {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: '学习时长（分钟）',
              data: durations,
              backgroundColor: 'rgba(0, 161, 214, 0.7)',
              borderColor: 'rgba(0, 161, 214, 1)',
              borderWidth: 1,
              order: 1
            },
            {
              label: '学习视频数',
              data: videoCount,
              type: 'line',
              borderColor: 'rgba(255, 102, 102, 1)',
              backgroundColor: 'rgba(255, 102, 102, 0.2)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(255, 102, 102, 1)',
              pointRadius: 3,
              order: 0,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '学习时长（分钟）'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            y1: {
              beginAtZero: true,
              position: 'right',
              title: {
                display: true,
                text: '视频数量'
              },
              grid: {
                drawOnChartArea: false
              }
            },
            x: {
              title: {
                display: true,
                text: '日期'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.dataset.label || '';
                  const value = context.raw;
                  if (label.includes('时长')) {
                    return label + ': ' + Utils.formatTime(value * 60);
                  }
                  return label + ': ' + value;
                }
              }
            },
            legend: {
              position: 'top'
            }
          }
        }
      };
      
      // 合并自定义选项
      if (options.chartOptions) {
        Object.assign(chartConfig.options, options.chartOptions);
      }
      
      // 创建图表
      window.studyChart = new Chart(ctx, chartConfig);
      
      return window.studyChart;
    },
    
    // 渲染学习历史记录列表
    renderHistoryList: function(containerId, historyData, append = false) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // 使用DocumentFragment减少DOM重排
      const fragment = document.createDocumentFragment();
      
      // 如果不是追加模式，清空容器
      if (!append) {
        container.innerHTML = '';
      }
      
      // 如果没有数据，显示空状态
      if (!historyData || historyData.length === 0) {
        if (!append) {
          const emptyState = Utils.createElement('div', { className: 'empty-state' }, ['暂无历史记录']);
          fragment.appendChild(emptyState);
        }
        container.appendChild(fragment);
        return;
      }
      
      // 创建历史记录列表
      historyData.forEach(record => {
        const recordDate = new Date(record.date);
        const formattedDate = Utils.formatDate(recordDate);
        const formattedTime = recordDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        const historyItem = Utils.createElement('div', { className: 'history-item' });
        
        // 创建时间信息
        const timeInfo = Utils.createElement('div', { className: 'time-info' });
        const dateElement = Utils.createElement('span', { className: 'date' }, [formattedDate]);
        const timeElement = Utils.createElement('span', { className: 'time' }, [formattedTime]);
        timeInfo.appendChild(dateElement);
        timeInfo.appendChild(document.createTextNode(' '));
        timeInfo.appendChild(timeElement);
        
        // 创建视频信息
        const videoInfo = Utils.createElement('div', { className: 'video-info' });
        const titleElement = Utils.createElement('a', { 
          className: 'video-title',
          href: record.url || `https://www.bilibili.com/video/${record.videoId}`,
          target: '_blank'
        }, [record.title]);
        const durationElement = Utils.createElement('span', { className: 'duration' }, [
          `学习时长: ${Utils.formatTime(record.duration)}`
        ]);
        
        // 如果有播放速率信息，添加到时长后面
        if (record.playbackRate && record.playbackRate !== 1.0) {
          const rateElement = Utils.createElement('span', { className: 'playback-rate' }, [
            ` (${record.playbackRate.toFixed(1)}x)`
          ]);
          durationElement.appendChild(rateElement);
        }
        
        videoInfo.appendChild(titleElement);
        videoInfo.appendChild(durationElement);
        
        // 组装历史记录项
        historyItem.appendChild(timeInfo);
        historyItem.appendChild(videoInfo);
        fragment.appendChild(historyItem);
      });
      
      container.appendChild(fragment);
    }
  };
  
  // ===== 事件处理模块 =====
  const EventHandler = {
    // 初始化事件监听
    init: function() {
      // 使用事件委托处理周期选择按钮点击
      const periodSelector = document.querySelector('.period-selector');
      if (periodSelector) {
        periodSelector.addEventListener('click', this.handlePeriodSelect);
      }
      
      // 加载更多按钮
      const loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', this.handleLoadMore);
      }
      
      // 导出数据按钮
      const exportBtn = document.getElementById('export-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', this.handleExport);
      }
    },
    
    // 处理周期选择
    handlePeriodSelect: Utils.debounce(async function(event) {
      const target = event.target;
      if (!target.classList.contains('period-btn')) return;
      
      // 更新按钮状态
      const buttons = document.querySelectorAll('.period-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');
      
      // 获取选择的周期
      const period = target.dataset.period;
      if (!period) return;
      
      try {
        // 显示加载状态
        document.body.classList.add('loading');
        
        // 获取数据并更新图表
        const stats = await DataManager.getDailyStats(period);
        
        // 更新统计数据
        document.getElementById('total-time').textContent = Utils.formatTime(stats.totalDuration);
        document.getElementById('video-count').textContent = stats.videoCount;
        
        if (stats.recordCount && stats.recordCount > 0) {
          const avgDuration = Math.round(stats.totalDuration / stats.recordCount);
          document.getElementById('avg-duration').textContent = Utils.formatTime(avgDuration);
        } else {
          document.getElementById('avg-duration').textContent = '0分钟';
        }
        
        if (stats.avgPlaybackRate) {
          document.getElementById('avg-rate').textContent = stats.avgPlaybackRate.toFixed(1) + 'x';
        }
        
        // 更新图表
        ViewRenderer.renderChart('study-chart', stats.dailyData);
        
        // 更新热门视频列表
        const topVideosContainer = document.getElementById('top-videos');
        if (topVideosContainer) {
          topVideosContainer.innerHTML = '';
          
          stats.topVideos.forEach(video => {
            const videoItem = Utils.createElement('div', { className: 'top-video-item' });
            const videoTitle = Utils.createElement('a', { 
              className: 'video-title',
              href: `https://www.bilibili.com/video/${video.videoId}`,
              target: '_blank',
              title: video.title
            }, [video.title]);
            const videoDuration = Utils.createElement('span', { className: 'video-duration' }, [
              Utils.formatTime(video.duration)
            ]);
            
            videoItem.appendChild(videoTitle);
            videoItem.appendChild(videoDuration);
            topVideosContainer.appendChild(videoItem);
          });
        }
        
        // 更新热力图
        ViewRenderer.renderHeatmap('heatmap-container', stats.dailyData);
      } catch (error) {
        console.error('更新统计数据失败:', error);
        alert('获取数据失败: ' + error);
      } finally {
        // 移除加载状态
        document.body.classList.remove('loading');
      }
    }, 300),
    
    // 处理加载更多
    handleLoadMore: Utils.debounce(async function() {
      const historyContainer = document.getElementById('history-list');
      if (!historyContainer) return;
      
      // 获取当前偏移量
      const currentOffset = parseInt(historyContainer.dataset.offset || '0');
      const limit = parseInt(historyContainer.dataset.limit || '5');
      
      try {
        // 显示加载状态
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
          loadMoreBtn.textContent = '加载中...';
          loadMoreBtn.disabled = true;
        }
        
        // 获取更多历史记录
        const historyData = await DataManager.getStudyHistory(limit, currentOffset + limit);
        
        // 更新历史记录列表
        ViewRenderer.renderHistoryList('history-list', historyData, true);
        
        // 更新偏移量
        historyContainer.dataset.offset = String(currentOffset + limit);
        
        // 更新加载更多按钮状态
        if (loadMoreBtn) {
          loadMoreBtn.textContent = '加载更多';
          loadMoreBtn.disabled = false;
          
          // 如果没有更多数据，隐藏按钮
          if (historyData.length < limit) {
            loadMoreBtn.style.display = 'none';
          }
        }
      } catch (error) {
        console.error('加载更多历史记录失败:', error);
        alert('加载更多失败: ' + error);
        
        if (loadMoreBtn) {
          loadMoreBtn.textContent = '加载更多';
          loadMoreBtn.disabled = false;
        }
      }
    }, 300),
    
    // 处理导出数据
    handleExport: Utils.debounce(async function() {
      try {
        // 获取当前选择的周期
        const activeBtn = document.querySelector('.period-btn.active');
        const period = activeBtn ? activeBtn.dataset.period : 'month';
        
        // 显示导出中状态
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
          exportBtn.textContent = '导出中...';
          exportBtn.disabled = true;
        }
        
        // 导出数据
        await DataManager.exportDailyStatsToCSV(period);
        
        // 恢复按钮状态
        if (exportBtn) {
          exportBtn.textContent = '导出数据';
          exportBtn.disabled = false;
        }
      } catch (error) {
        console.error('导出数据失败:', error);
        alert('导出数据失败: ' + error);
        
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
          exportBtn.textContent = '导出数据';
          exportBtn.disabled = false;
        }
      }
    }, 300)
  };
  
  // ===== 初始化 =====
  function init() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        // 初始化事件处理
        EventHandler.init();
        
        // 加载默认数据
        const defaultPeriod = 'week';
        DataManager.getDailyStats(defaultPeriod).then(stats => {
          // 更新统计数据
          document.getElementById('total-time').textContent = Utils.formatTime(stats.totalDuration);
          document.getElementById('video-count').textContent = stats.videoCount;
          
          if (stats.recordCount && stats.recordCount > 0) {
            const avgDuration = Math.round(stats.totalDuration / stats.recordCount);
            document.getElementById('avg-duration').textContent = Utils.formatTime(avgDuration);
          }
          
          if (stats.avgPlaybackRate) {
            document.getElementById('avg-rate').textContent = stats.avgPlaybackRate.toFixed(1) + 'x';
          }
          
          // 渲染图表
          ViewRenderer.renderChart('study-chart', stats.dailyData);
          
          // 渲染热门视频列表
          ViewRenderer.renderHistoryList('top-videos', stats.topVideos);
          
          // 渲染热力图
          ViewRenderer.renderHeatmap('heatmap-container', stats.dailyData);
        }).catch(error => {
          console.error('初始化数据加载失败:', error);
        });
        
        // 加载历史记录
        DataManager.getStudyHistory(5, 0).then(historyData => {
          ViewRenderer.renderHistoryList('history-list', historyData);
          
          // 设置初始偏移量
          const historyContainer = document.getElementById('history-list');
          if (historyContainer) {
            historyContainer.dataset.offset = '0';
            historyContainer.dataset.limit = '5';
          }
          
          // 更新加载更多按钮状态
          const loadMoreBtn = document.getElementById('load-more-btn');
          if (loadMoreBtn) {
            loadMoreBtn.style.display = historyData.length >= 5 ? 'block' : 'none';
          }
        }).catch(error => {
          console.error('历史记录加载失败:', error);
        });
      });
    }
  }
  
  // 初始化应用
  init();
  
  // 导出公共API
  window.BiliStudyStats = {
    DataManager,
    ViewRenderer,
    Utils
  };
})();