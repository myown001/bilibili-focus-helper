// popup.js - 学习统计数据展示（新版：直接读取 chrome.storage.local）

console.log('[Popup] 开始加载');

// ===== 工具函数 =====

/**
 * 格式化时间（秒 → 时分秒）
 */
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0秒';
  if (seconds < 60) return Math.floor(seconds) + '秒';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
  } else {
    return `${minutes}分钟${secs > 0 ? secs + '秒' : ''}`;
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * 格式化日期为本地时间字符串（避免时区问题）
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取日期范围
 */
function getDateRange(days) {
  const dates = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(formatLocalDate(date));  // 使用本地时间格式化
  }
  
  return dates;
}

/**
 * 获取指定日期的周键名
 */
function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `study_${year}_W${String(week).padStart(2, '0')}`;
}

// ===== 数据加载函数 =====

/**
 * 从 chrome.storage.local 加载指定日期范围的数据
 */
async function loadStudyData(dates) {
  try {
    // 获取需要的周键
    const weekKeys = [...new Set(dates.map(date => getWeekKey(date)))];
    
    // 批量读取所有周的数据
    const result = await chrome.storage.local.get(weekKeys);
    
    // 提取每一天的数据
    const dailyData = [];
    for (const date of dates) {
      const weekKey = getWeekKey(date);
      const weekData = result[weekKey] || {};
      const dayData = weekData[date];
      
      if (dayData) {
        dailyData.push({
          date,
          total: dayData.t || 0,
          effective: dayData.e || 0,
          pauseCount: dayData.p || 0,
          exitCount: dayData.x || 0,
          switchCount: dayData.s || 0,
          longestSession: dayData.l || 0,
          videos: dayData.v || {}
        });
      } else {
        // 没有数据的日期，填充0
        dailyData.push({
          date,
          total: 0,
          effective: 0,
          pauseCount: 0,
          exitCount: 0,
          switchCount: 0,
          longestSession: 0,
          videos: {}
        });
      }
    }
    
    return dailyData;
  } catch (err) {
    console.error('[Popup] 加载学习数据失败:', err);
    return [];
  }
}

/**
 * 计算统计数据
 */
function calculateStats(dailyData) {
  const stats = {
    totalTime: 0,
    effectiveTime: 0,
    videoCount: 0,
    studyDays: 0,
    pauseCount: 0,
    exitCount: 0,
    switchCount: 0,
    longestSession: 0,
    focusQuality: 0,
    dailyData: []
  };
  
  const allVideos = new Set();
  
  dailyData.forEach(day => {
    if (day.total > 0) {
      stats.studyDays++;
    }
    
    stats.totalTime += day.total;
    stats.effectiveTime += day.effective;
    stats.pauseCount += day.pauseCount;
    stats.exitCount += day.exitCount;
    stats.switchCount += day.switchCount;
    
    if (day.longestSession > stats.longestSession) {
      stats.longestSession = day.longestSession;
    }
    
    // 统计视频
    Object.keys(day.videos).forEach(videoId => allVideos.add(videoId));
    
    // 保存每日数据（用于图表）
    stats.dailyData.push({
      date: day.date,
      total: day.total,
      effective: day.effective
    });
  });
  
  stats.videoCount = allVideos.size;
  
  // 计算专注度
  if (stats.totalTime > 0) {
    stats.focusQuality = (stats.effectiveTime / stats.totalTime * 100).toFixed(1);
  }
  
  return stats;
}

// ===== UI 渲染函数 =====

/**
 * 渲染统计数据（已废弃，逻辑已整合到 loadAndDisplayStats）
 */
function renderStats(stats, aggregation = 'daily') {
  console.log('[Popup] renderStats 已废弃，请使用 loadAndDisplayStats');
}

// ===== 数据聚合函数 =====

/**
 * 按周聚合数据
 */
function aggregateDataWeekly(dailyData) {
  const weekMap = new Map();
  
  dailyData.forEach(day => {
    const date = new Date(day.date);
    const weekKey = getWeekLabel(date);
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        label: weekKey,
        total: 0,
        effective: 0,
        pauseCount: 0,
        exitCount: 0,
        switchCount: 0,
        longestSession: 0,
        days: 0
      });
    }
    
    const week = weekMap.get(weekKey);
    week.total += day.total;
    week.effective += day.effective;
    week.pauseCount += day.pauseCount;
    week.exitCount += day.exitCount;
    week.switchCount += day.switchCount;
    week.longestSession = Math.max(week.longestSession, day.longestSession);
    if (day.total > 0) week.days++;
  });
  
  return Array.from(weekMap.values());
}

/**
 * 按月聚合数据（固定显示最近12个月）
 */
function aggregateDataMonthly(dailyData) {
  const monthMap = new Map();
  
  // 1. 从今天往前推12个月生成月份列表
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(currentMonth);
    monthDate.setMonth(currentMonth.getMonth() - i);
    
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
    
    monthMap.set(monthKey, {
      label: monthLabel,
      total: 0,
      effective: 0,
      pauseCount: 0,
      exitCount: 0,
      switchCount: 0,
      longestSession: 0,
      days: 0
    });
  }
  
  // 2. 填充实际数据
  dailyData.forEach(day => {
    const date = new Date(day.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (monthMap.has(monthKey)) {
      const month = monthMap.get(monthKey);
      month.total += day.total;
      month.effective += day.effective;
      month.pauseCount += day.pauseCount;
      month.exitCount += day.exitCount;
      month.switchCount += day.switchCount;
      month.longestSession = Math.max(month.longestSession, day.longestSession);
      if (day.total > 0) month.days++;
    }
  });
  
  console.log(`[Popup] 按月聚合: 生成${monthMap.size}个月份 (从${Array.from(monthMap.values())[0].label}到${Array.from(monthMap.values())[11].label})`);
  return Array.from(monthMap.values());
}

/**
 * 获取周标签
 */
function getWeekLabel(date) {
  const year = date.getFullYear();
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${year}年第${week}周`;
}

/**
 * 渲染图表
 */
function renderChart(dailyData, aggregation = 'daily') {
  const chartEl = document.getElementById('study-chart');
  if (!chartEl) {
    console.warn('[Popup] 图表容器不存在');
    return;
  }
  
  // 检查 Chart.js 是否加载
  if (typeof Chart === 'undefined') {
    console.error('[Popup] Chart.js 未加载');
    chartEl.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">图表加载失败</p>';
    return;
  }
  
  // 清空容器
  chartEl.innerHTML = '<canvas id="studyChart"></canvas>';
  
  const canvas = document.getElementById('studyChart');
  const ctx = canvas.getContext('2d');
  
  // 根据聚合方式处理数据
  let chartData = [];
  let labels = [];
  let totalData = [];
  let effectiveData = [];
  
  if (aggregation === 'weekly') {
    chartData = aggregateDataWeekly(dailyData);
    labels = chartData.map(d => d.label);
    totalData = chartData.map(d => Math.floor(d.total / 60));
    effectiveData = chartData.map(d => Math.floor(d.effective / 60));
  } else if (aggregation === 'monthly') {
    chartData = aggregateDataMonthly(dailyData);
    labels = chartData.map(d => d.label);
    totalData = chartData.map(d => Math.floor(d.total / 60));
    effectiveData = chartData.map(d => Math.floor(d.effective / 60));
  } else {
    // 按日显示
    labels = dailyData.map(d => formatDate(d.date));
    totalData = dailyData.map(d => Math.floor(d.total / 60));
    effectiveData = dailyData.map(d => Math.floor(d.effective / 60));
  }
  
  // 创建图表
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '总时长（分钟）',
          data: totalData,
          backgroundColor: 'rgba(102, 126, 234, 0.6)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: '有效时长（分钟）',
          data: effectiveData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 10,      // 图例下方增加间距
          bottom: 5,    // 减少底部留白
          left: 10,
          right: 10
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: function(value) {
              return value + '分';
            },
            font: {
              size: 11
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            autoSkip: false,  // 不自动跳过标签，确保所有月份都显示
            font: {
              size: 10
            },
            maxRotation: 45,
            minRotation: 0
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',     // 改为底部，为图表留出更多空间
          align: 'center',
          labels: {
            font: {
              size: 11            // 字体改小（从12改为11）
            },
            padding: 12,          // 紧凑间距（从20改为12）
            boxWidth: 12,         // 色块改小（从15改为12）
            boxHeight: 12,        // 色块改小（从15改为12）
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 13
          },
          bodyFont: {
            size: 12
          },
          callbacks: {
            label: function(context) {
              const minutes = context.parsed.y;
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              let timeStr = '';
              if (hours > 0) {
                timeStr = `${hours}小时${mins}分钟`;
              } else {
                timeStr = `${mins}分钟`;
              }
              return `${context.dataset.label}: ${timeStr}`;
            }
          }
        }
      }
    }
  });
  
  console.log('[Popup] 图表渲染完成, 聚合方式:', aggregation);
}

/**
 * 渲染空图表（无数据时）
 */
function renderEmptyChart() {
  const chartEl = document.getElementById('study-chart');
  if (chartEl) {
    chartEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">暂无学习数据<br>开始学习后数据将显示在这里</p>';
  }
}

// ===== 月历视图功能 =====

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();

/**
 * 渲染月历
 */
async function renderCalendar(year, month) {
  console.log('[Popup] 渲染月历:', year, month + 1);
  
  const calendarDays = document.getElementById('calendar-days');
  const calendarTitle = document.getElementById('calendar-title');
  
  if (!calendarDays || !calendarTitle) {
    console.warn('[Popup] 月历容器不存在');
    return;
  }
  
  // 更新标题
  calendarTitle.textContent = `${year}年${month + 1}月`;
  
  try {
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // 获取当月第一天是星期几（0-6）
    const firstDayOfWeek = firstDay.getDay();
    
    // 获取上月的最后几天
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthDays = firstDayOfWeek;
    
    // 获取下月需要显示的天数
    const totalCells = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;
    const nextMonthDays = totalCells - daysInMonth - firstDayOfWeek;
    
    // 生成需要加载的日期列表（使用本地时间格式化）
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      dates.push(formatLocalDate(date));  // 使用本地时间格式化
    }
    
    // 加载数据
    const monthData = await loadStudyData(dates);
    const dataMap = new Map();
    monthData.forEach(day => {
      dataMap.set(day.date, day);
    });
    
    // 清空容器
    calendarDays.innerHTML = '';
    
    // 渲染上月的日期
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const dayEl = createCalendarDay(dayNum, 'other-month');
      calendarDays.appendChild(dayEl);
    }
    
    // 渲染当月的日期（使用本地时间）
    const today = formatLocalDate(new Date());  // 使用本地时间格式化今天
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = formatLocalDate(date);  // 使用本地时间格式化
      const dayData = dataMap.get(dateStr);
      const isToday = dateStr === today;
      
      const dayEl = createCalendarDay(i, '', dayData, isToday, dateStr);
      calendarDays.appendChild(dayEl);
    }
    
    // 渲染下月的日期
    for (let i = 1; i <= nextMonthDays; i++) {
      const dayEl = createCalendarDay(i, 'other-month');
      calendarDays.appendChild(dayEl);
    }
    
    console.log('[Popup] 月历渲染完成');
  } catch (err) {
    console.error('[Popup] 渲染月历失败:', err);
    calendarDays.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">月历加载失败</p>';
  }
}

/**
 * 创建日历单元格
 */
function createCalendarDay(dayNum, extraClass = '', dayData = null, isToday = false, dateStr = '') {
  const dayEl = document.createElement('div');
  dayEl.className = `calendar-day ${extraClass}`;
  
  if (isToday) {
    dayEl.classList.add('today');
  }
  
  const dayNumEl = document.createElement('div');
  dayNumEl.textContent = dayNum;
  dayEl.appendChild(dayNumEl);
  
  if (dayData && dayData.total > 0) {
    dayEl.classList.add('has-data');
    
    // 只保留悬浮交互，不显示时间标签（保持界面简洁）
    dayEl.style.cursor = 'pointer';
    dayEl.addEventListener('mouseenter', (e) => {
      showCalendarTooltip(e, dateStr, dayData);
    });
    
    dayEl.addEventListener('mousemove', (e) => {
      updateCalendarTooltipPosition(e);
    });
    
    dayEl.addEventListener('mouseleave', () => {
      hideCalendarTooltip();
    });
  }
  
  return dayEl;
}

/**
 * 显示日历tooltip
 */
async function showCalendarTooltip(e, dateStr, dayData) {
  let tooltip = document.querySelector('.calendar-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'calendar-tooltip';
    document.body.appendChild(tooltip);
  }
  
  // 格式化数据
  const totalMins = Math.floor(dayData.total / 60);
  const effectiveMins = Math.floor(dayData.effective / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;
  
  const effectiveHours = Math.floor(effectiveMins / 60);
  const effectiveMinsRem = effectiveMins % 60;
  const effectiveStr = effectiveHours > 0 ? `${effectiveHours}小时${effectiveMinsRem}分钟` : `${effectiveMinsRem}分钟`;
  
  const quality = dayData.total > 0 ? Math.round((dayData.effective / dayData.total) * 100) : 0;
  const videoCount = dayData.videos ? Object.keys(dayData.videos).length : 0;
  
  // 获取视频列表
  let videoListHtml = '';
  if (dayData.videos && videoCount > 0) {
    try {
      const result = await chrome.storage.local.get('index_videos');
      const videoIndex = result.index_videos || {};
      const videos = Object.keys(dayData.videos);
      const displayCount = Math.min(3, videos.length); // 最多显示3个
      
      for (let i = 0; i < displayCount; i++) {
        const bvid = videos[i];
        const videoData = videoIndex[bvid];
        let title = bvid;
        
        if (videoData && typeof videoData === 'object' && videoData.title) {
          title = videoData.title;
          // 限制标题长度
          if (title.length > 25) {
            title = title.substring(0, 25) + '...';
          }
        }
        
        videoListHtml += `<div class="tooltip-video">• ${title}</div>`;
      }
      
      if (videos.length > displayCount) {
        videoListHtml += `<div class="tooltip-more">...等${videos.length}个视频</div>`;
      }
      
      videoListHtml += `<div class="tooltip-hint">💡 完整列表请查看导出数据</div>`;
    } catch (err) {
      console.error('[Popup] 加载视频信息失败:', err);
    }
  }
  
  // 构建tooltip内容
  tooltip.innerHTML = `
    <div class="tooltip-date">${dateStr}</div>
    <div class="tooltip-row">📚 总时长：${timeStr}</div>
    <div class="tooltip-row">⭐ 有效时长：${effectiveStr} (${quality}%)</div>
    <div class="tooltip-row">📹 学习视频：${videoCount}个</div>
    <div class="tooltip-row">⏸️ 暂停次数：${dayData.pauseCount || 0}次</div>
    ${videoListHtml ? `<div class="tooltip-videos">${videoListHtml}</div>` : ''}
  `;
  
  tooltip.style.display = 'block';
  updateCalendarTooltipPosition(e);
}

/**
 * 更新日历tooltip位置
 */
function updateCalendarTooltipPosition(e) {
  const tooltip = document.querySelector('.calendar-tooltip');
  if (!tooltip) return;
  
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = e.clientX + 10;
  let top = e.clientY + 10;
  
  // 边界检查
  if (left + tooltipRect.width > window.innerWidth) {
    left = e.clientX - tooltipRect.width - 10;
  }
  if (top + tooltipRect.height > window.innerHeight) {
    top = e.clientY - tooltipRect.height - 10;
  }
  if (left < 0) left = 10;
  if (top < 0) top = 10;
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

/**
 * 隐藏日历tooltip
 */
function hideCalendarTooltip() {
  const tooltip = document.querySelector('.calendar-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

/**
 * 切换到上一月
 */
function prevMonth() {
  currentCalendarMonth--;
  if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  }
  renderCalendar(currentCalendarYear, currentCalendarMonth);
}

/**
 * 切换到下一月
 */
function nextMonth() {
  currentCalendarMonth++;
  if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  }
  renderCalendar(currentCalendarYear, currentCalendarMonth);
}

// ===== 热力图功能 =====

/**
 * 获取第一次学习记录的日期
 */
async function getFirstStudyDate() {
  try {
    const result = await chrome.storage.local.get(null);
    const weekKeys = Object.keys(result).filter(k => k.startsWith('study_'));
    
    if (weekKeys.length === 0) {
      return null;
    }
    
    let firstDate = null;
    for (const key of weekKeys) {
      const weekData = result[key];
      if (weekData && typeof weekData === 'object') {
        const dates = Object.keys(weekData);
        for (const date of dates) {
          // 验证是否是有效的日期格式
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            if (!firstDate || date < firstDate) {
              firstDate = date;
            }
          }
        }
      }
    }
    return firstDate;
  } catch (err) {
    console.error('[Popup] 获取第一次学习日期失败:', err);
    return null;
  }
}

/**
 * 获取日期范围（固定窗口）
 * @param {number} days - 天数（7, 28, 365）
 * @returns {Array<string>} - 日期字符串数组
 */
function getDateRange(days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 总是从今天往前推指定天数（固定窗口）
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatLocalDate(d));
  }
  
  console.log(`[Popup] 获取最近${days}天数据: ${dates[0]} ~ ${dates[dates.length-1]}`);
  return dates;
}

/**
 * 渲染年度热力图（GitHub风格竖向布局）
 */
async function renderHeatmap() {
  console.log('[Popup] 开始渲染热力图');
  
  const heatmapGrid = document.getElementById('heatmap-grid');
  if (!heatmapGrid) {
    console.warn('[Popup] 热力图容器不存在');
    return;
  }
  
  try {
    // 找到最近的周日（包括今天）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
    
    // 如果今天不是周日，回退到最近的周日
    const recentSunday = new Date(today);
    if (dayOfWeek !== 0) {
      recentSunday.setDate(recentSunday.getDate() - dayOfWeek);
    }
    
    // 获取第一次学习记录的日期
    const firstStudyDate = await getFirstStudyDate();
    let startDate;
    
    if (firstStudyDate) {
      // 从第一次学习日期开始，对齐到那周的周一（不往前推）
      const firstDate = new Date(firstStudyDate);
      firstDate.setHours(0, 0, 0, 0);
      const firstDayOfWeek = firstDate.getDay(); // 0=周日, 1=周一, ..., 6=周六
      startDate = new Date(firstDate);
      
      if (firstDayOfWeek === 0) {
        // 如果第一天是周日，回退到本周一（前6天）
        startDate.setDate(startDate.getDate() - 6);
      } else if (firstDayOfWeek > 1) {
        // 如果是周二到周六，回退到本周一
        startDate.setDate(startDate.getDate() - (firstDayOfWeek - 1));
      }
      // 如果第一天就是周一，startDate不变
      
      console.log(`[Popup] 从第一次学习日期开始: ${firstStudyDate}, 对齐周一: ${formatLocalDate(startDate)}`);
    } else {
      // 新用户，从本周周一开始
      const todayDayOfWeek = today.getDay();
      startDate = new Date(today);
      if (todayDayOfWeek === 0) {
        // 今天是周日，回退6天到周一
        startDate.setDate(startDate.getDate() - 6);
      } else {
        // 回退到本周周一
        startDate.setDate(startDate.getDate() - (todayDayOfWeek - 1));
      }
      console.log('[Popup] 新用户，从本周周一开始');
    }
    
    // 计算结束日期：从起始周一开始，显示364天（52周完整矩形）
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 363); // +363天 = 364天（包括起始日）
    
    // 生成日期列表（从startDate到endDate）- 使用本地时间避免时区问题
    const dates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(formatLocalDate(currentDate));  // 使用本地时间格式化
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`[Popup] 热力图日期范围: ${dates[0]} 到 ${dates[dates.length-1]}, 共${dates.length}天（52周）`);
    
    // 加载数据
    const yearData = await loadStudyData(dates);
    
    // 创建数据映射（保存完整数据，不只是时长）
    const dataMap = new Map();
    let studyDaysCount = 0;
    let maxTime = 0;
    
    yearData.forEach(day => {
      const time = Math.floor(day.total / 60); // 转换为分钟
      dataMap.set(day.date, {
        time: time,
        total: day.total,
        effective: day.effective,
        videoCount: day.videos ? Object.keys(day.videos).length : 0,
        pauseCount: day.pauseCount || 0
      });
      if (time > 0) studyDaysCount++;
      if (time > maxTime) maxTime = time;
    });
    
    // 更新统计和标题
    const statEl = document.getElementById('heatmap-total-days');
    if (statEl) {
      statEl.textContent = `${studyDaysCount}天`;
    }
    
    // 动态更新标题，根据有数据的天数判断
    const titleEl = document.querySelector('.heatmap-title');
    if (titleEl && dates.length > 0) {
      const dayCount = dates.length;  // 总天数（包括空白天）
      const weekCount = Math.ceil(dayCount / 7);
      
      if (studyDaysCount === 0) {
        titleEl.textContent = '📅 学习热力图（暂无数据）';
      } else if (studyDaysCount <= 7) {
        titleEl.textContent = `📅 学习热力图（${studyDaysCount}天）`;
      } else if (dayCount <= 31) {
        titleEl.textContent = '📅 本月学习热力图';
      } else if (dayCount <= 90) {
        titleEl.textContent = `📅 近${weekCount}周学习热力图`;
      } else {
        titleEl.textContent = `📅 学习热力图（${Math.floor(dayCount/30)}个月）`;
      }
    }
    
    // 计算颜色级别阈值
    const thresholds = {
      level1: maxTime * 0.2,
      level2: maxTime * 0.4,
      level3: maxTime * 0.6,
      level4: maxTime * 0.8
    };
    
    // 清空容器
    heatmapGrid.innerHTML = '';
    
    // 创建tooltip
    let tooltip = document.querySelector('.heatmap-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'heatmap-tooltip';
      document.body.appendChild(tooltip);
    }
    
    // 渲染每一天（从周日开始，grid-auto-flow: column会自动排列）
    dates.forEach(date => {
      const dayEl = document.createElement('div');
      dayEl.className = 'heatmap-day';
      
      const dayData = dataMap.get(date) || { time: 0, total: 0, effective: 0, videoCount: 0, pauseCount: 0 };
      const time = dayData.time;
      
      // 设置颜色级别
      if (time === 0) {
        dayEl.classList.add('level-0');
      } else if (time <= thresholds.level1) {
        dayEl.classList.add('level-1');
      } else if (time <= thresholds.level2) {
        dayEl.classList.add('level-2');
      } else if (time <= thresholds.level3) {
        dayEl.classList.add('level-3');
      } else {
        dayEl.classList.add('level-4');
      }
      
      // 添加悬停效果 - 增强显示
      dayEl.addEventListener('mouseenter', (e) => {
        // 显示星期几
        const d = new Date(date);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[d.getDay()];
        
        if (time === 0) {
          tooltip.textContent = `${date} (${weekday}): 未学习`;
        } else {
          // 格式化时间
          const totalMins = Math.floor(dayData.total / 60);
          const effectiveMins = Math.floor(dayData.effective / 60);
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          
          let timeStr = hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
          let details = `📚 ${timeStr}`;
          
          if (dayData.videoCount > 0) {
            details += ` | 📹 ${dayData.videoCount}个视频`;
          }
          
          if (dayData.total > 0) {
            const quality = Math.round((dayData.effective / dayData.total) * 100);
            details += ` | ⭐ ${quality}%`;
          }
          
          tooltip.textContent = `${date} (${weekday}) ${details}`;
        }
        
        // 显示tooltip并计算位置（带边界检查）
        tooltip.style.display = 'block';
        
        // 先显示以获取实际宽高
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = e.clientX + 10;
        let top = e.clientY + 10;
        
        // 检查右边界
        if (left + tooltipRect.width > window.innerWidth) {
          left = e.clientX - tooltipRect.width - 10; // 显示在鼠标左侧
        }
        
        // 检查底部边界
        if (top + tooltipRect.height > window.innerHeight) {
          top = e.clientY - tooltipRect.height - 10; // 显示在鼠标上方
        }
        
        // 确保不超出左边界
        if (left < 0) {
          left = 10;
        }
        
        // 确保不超出顶部边界
        if (top < 0) {
          top = 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
      });
      
      dayEl.addEventListener('mousemove', (e) => {
        // 移动时也要做边界检查
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = e.clientX + 10;
        let top = e.clientY + 10;
        
        if (left + tooltipRect.width > window.innerWidth) {
          left = e.clientX - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > window.innerHeight) {
          top = e.clientY - tooltipRect.height - 10;
        }
        if (left < 0) left = 10;
        if (top < 0) top = 10;
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
      });
      
      dayEl.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
      
      heatmapGrid.appendChild(dayEl);
    });
    
    console.log('[Popup] 热力图渲染完成（竖向布局）');
  } catch (err) {
    console.error('[Popup] 渲染热力图失败:', err);
    heatmapGrid.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">热力图加载失败</p>';
  }
}

/**
 * 渲染质量评分（新增）
 */
function renderQualityScore(stats) {
  console.log('[Popup] 渲染质量评分:', stats);
  
  // 获取DOM元素
  const scoreEl = document.getElementById('quality-score');
  const starsEl = document.getElementById('rating-stars');
  const levelEl = document.getElementById('rating-level');
  const messageEl = document.getElementById('rating-message');
  const card = document.getElementById('quality-score-card');
  
  // 四维度元素
  const dimensionEls = {
    time: {
      fill: document.getElementById('dimension-time'),
      value: document.getElementById('dimension-time-value')
    },
    stability: {
      fill: document.getElementById('dimension-stability'),
      value: document.getElementById('dimension-stability-value')
    },
    continuous: {
      fill: document.getElementById('dimension-continuous'),
      value: document.getElementById('dimension-continuous-value')
    },
    completion: {
      fill: document.getElementById('dimension-completion'),
      value: document.getElementById('dimension-completion-value')
    }
  };
  
  const suggestionsContainer = document.getElementById('quality-suggestions');
  const suggestionsList = document.getElementById('suggestions-list');
  
  // 如果没有数据，显示空状态
  if (!stats || stats.totalTime === 0) {
    if (scoreEl) scoreEl.textContent = '--';
    if (starsEl) starsEl.textContent = '📊';
    if (levelEl) levelEl.textContent = '暂无数据';
    if (messageEl) messageEl.textContent = '开始学习后即可查看';
    
    // 重置所有进度条
    Object.values(dimensionEls).forEach(el => {
      if (el.fill) el.fill.style.width = '0%';
      if (el.value) el.value.textContent = '--%';
    });
    
    // 隐藏建议
    if (suggestionsContainer) suggestionsContainer.style.display = 'none';
    if (card) card.removeAttribute('data-rating');
    
    return;
  }
  
  // 创建质量分析器实例
  const analyzer = new QualityAnalyzer();
  
  // 计算质量评分
  const result = analyzer.calculateQualityScore(stats);
  console.log('[Popup] 质量评分结果:', result);
  
  // 显示总分
  if (scoreEl) {
    scoreEl.textContent = Math.round(result.totalScore);
  }
  
  // 显示评级
  if (starsEl) starsEl.textContent = result.rating.icon;
  if (levelEl) {
    levelEl.textContent = result.rating.level;
    levelEl.style.color = result.rating.color;
  }
  if (messageEl) messageEl.textContent = result.rating.message;
  
  // 设置卡片评级属性（用于CSS样式）
  if (card) {
    if (result.totalScore >= 80) {
      card.setAttribute('data-rating', 'excellent');
    } else if (result.totalScore >= 70) {
      card.setAttribute('data-rating', 'good');
    } else if (result.totalScore >= 60) {
      card.setAttribute('data-rating', 'fair');
    } else {
      card.setAttribute('data-rating', 'poor');
    }
  }
  
  // 显示四维度得分
  const dimensions = result.dimensions;
  
  if (dimensions.timeEfficiency) {
    const timeEl = dimensionEls.time;
    if (timeEl.fill) {
      setTimeout(() => {
        timeEl.fill.style.width = dimensions.timeEfficiency.score + '%';
      }, 100);
    }
    if (timeEl.value) {
      timeEl.value.textContent = dimensions.timeEfficiency.value + dimensions.timeEfficiency.unit;
    }
  }
  
  if (dimensions.focusStability) {
    const stabilityEl = dimensionEls.stability;
    if (stabilityEl.fill) {
      setTimeout(() => {
        stabilityEl.fill.style.width = dimensions.focusStability.score + '%';
      }, 200);
    }
    if (stabilityEl.value) {
      stabilityEl.value.textContent = dimensions.focusStability.score.toFixed(0) + '分';
    }
  }
  
  if (dimensions.continuousFocus) {
    const continuousEl = dimensionEls.continuous;
    if (continuousEl.fill) {
      setTimeout(() => {
        continuousEl.fill.style.width = dimensions.continuousFocus.score + '%';
      }, 300);
    }
    if (continuousEl.value) {
      continuousEl.value.textContent = dimensions.continuousFocus.value + dimensions.continuousFocus.unit;
    }
  }
  
  if (dimensions.completion) {
    const completionEl = dimensionEls.completion;
    if (completionEl.fill) {
      setTimeout(() => {
        completionEl.fill.style.width = dimensions.completion.score + '%';
      }, 400);
    }
    if (completionEl.value) {
      completionEl.value.textContent = dimensions.completion.score.toFixed(0) + '分';
    }
  }
  
  // 生成并显示改进建议
  const suggestions = analyzer.generateSuggestions(result);
  
  if (suggestions.length > 0 && suggestionsContainer && suggestionsList) {
    suggestionsContainer.style.display = 'block';
    suggestionsList.innerHTML = suggestions.map(suggestion => `
      <div class="suggestion-item">
        <div class="suggestion-icon">${suggestion.icon}</div>
        <div class="suggestion-content">
          <div class="suggestion-title">${suggestion.title}</div>
          <div class="suggestion-text">${suggestion.content}</div>
        </div>
      </div>
    `).join('');
  } else if (suggestionsContainer) {
    suggestionsContainer.style.display = 'none';
  }
}

// ===== 主加载函数 =====

/**
 * 加载并显示统计数据
 */
async function loadAndDisplayStats(days = 7, aggregation = 'daily') {
  console.log('[Popup] 加载统计数据，天数:', days, '聚合:', aggregation);
  
  // 显示加载状态
  const totalTimeEl = document.getElementById('total-time');
  const videoCountEl = document.getElementById('video-count');
  const pomodoroCountEl = document.getElementById('pomodoro-count');
  if (totalTimeEl) totalTimeEl.textContent = '加载中...';
  if (videoCountEl) videoCountEl.textContent = '...';
  if (pomodoroCountEl) pomodoroCountEl.textContent = '...';
  
  try {
    // 1. 单独加载今天的数据（用于顶部显示）
    const today = formatLocalDate(new Date());
    const todayData = await loadStudyData([today]);
    const todayStats = calculateStats(todayData);
    
    // 加载今日番茄钟数据
    const pomodoroToday = await loadPomodoroData(today);
    
    // 2. 加载选定范围的数据（用于图表）
    const dates = getDateRange(days);
    const dailyData = await loadStudyData(dates);
    const stats = calculateStats(dailyData);
    
    // 3. 更新顶部显示（只显示今日数据）
    if (totalTimeEl) {
      totalTimeEl.textContent = todayStats.totalTime > 0 
        ? formatTime(todayStats.totalTime) 
        : '0秒';
    }
    if (videoCountEl) {
      videoCountEl.textContent = todayStats.videoCount;
    }
    // 更新番茄钟显示
    if (pomodoroCountEl) {
      if (pomodoroToday.completed > 0) {
        const minutes = Math.floor(pomodoroToday.totalWorkTime / 60);
        // 显示精确番茄钟数（保留1位小数）和次数/时长
        const pomodoroText = pomodoroToday.totalPomodoroCount.toFixed(1);
        const detailText = `${pomodoroToday.completed}次·${minutes}分钟`;
        pomodoroCountEl.innerHTML = `
          <div style="font-size: 20px;">${pomodoroText}</div>
          <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${detailText}</div>
        `;
      } else {
        pomodoroCountEl.textContent = '0';
      }
    }
    
    // 4. 渲染图表（显示选定范围）
    if (stats.totalTime > 0) {
      renderChart(stats.dailyData, aggregation);
      // 渲染质量评分（使用今日数据）
      renderQualityScore(todayStats);
    } else {
      renderEmptyChart();
      renderQualityScore(todayStats.totalTime > 0 ? todayStats : null);
    }
    
    console.log('[Popup] 统计数据加载完成 - 今日:', todayStats.totalTime, '分钟，视频数:', todayStats.videoCount);
  } catch (err) {
    console.error('[Popup] 加载统计数据失败:', err);
    if (totalTimeEl) totalTimeEl.textContent = '加载失败';
    if (videoCountEl) videoCountEl.textContent = '0';
    if (pomodoroCountEl) pomodoroCountEl.textContent = '0';
    renderEmptyChart();
  }
}

// loadPomodoroData 函数已移至 export-utils.js，在所有模块加载前定义

// ===== 番茄钟详情面板 =====

/**
 * 渲染番茄钟详情面板
 */
async function renderPomodoroDetails() {
  const today = formatLocalDate(new Date());
  const pomodoroData = await loadPomodoroData(today);
  
  // 更新统计数据
  document.getElementById('detail-total-pomodoro').textContent = 
    pomodoroData.totalPomodoroCount.toFixed(1) + '个';
  document.getElementById('detail-completed').textContent = 
    pomodoroData.completed + '次';
  document.getElementById('detail-work-time').textContent = 
    Math.floor(pomodoroData.totalWorkTime / 60) + '分钟';
  document.getElementById('detail-break-time').textContent = 
    Math.floor(pomodoroData.totalBreakTime / 60) + '分钟';
  document.getElementById('detail-countdown').textContent = 
    pomodoroData.countdownCount + '次';
  document.getElementById('detail-countup').textContent = 
    pomodoroData.countupCount + '次';
  
  // 渲染最近记录
  const recentRecordsEl = document.getElementById('recent-records');
  if (pomodoroData.history.length === 0) {
    recentRecordsEl.innerHTML = '<div class="no-data">暂无记录</div>';
    return;
  }
  
  // 只显示最近5条工作记录
  const workRecords = pomodoroData.history
    .filter(entry => entry.type === 'work')
    .slice(-5)
    .reverse();
  
  if (workRecords.length === 0) {
    recentRecordsEl.innerHTML = '<div class="no-data">暂无工作记录</div>';
    return;
  }
  
  recentRecordsEl.innerHTML = workRecords.map(entry => {
    const startTime = new Date(entry.startTime).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const duration = Math.floor((entry.actualDuration || entry.duration) / 60);
    const pomodoroCount = entry.pomodoroCount 
      ? entry.pomodoroCount.toFixed(1) 
      : (duration / 25).toFixed(1);
    const modeIcon = entry.mode === 'countdown' ? '⏳' : '⏰';
    const modeName = entry.mode === 'countdown' ? '倒计时' : '正计时';
    
    return `
      <div class="record-item">
        <span class="record-icon">🍅</span>
        <div class="record-content">
          <div class="record-time">${startTime} · ${duration}分钟</div>
          <div class="record-info">${modeIcon} ${modeName} · ${pomodoroCount}个番茄钟</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 初始化番茄钟详情展开功能
 */
function initPomodoroDetails() {
  const toggleBtn = document.getElementById('pomodoro-toggle-btn');
  const detailsPanel = document.getElementById('pomodoro-details');
  
  if (!toggleBtn || !detailsPanel) return;
  
  toggleBtn.addEventListener('click', async () => {
    const isOpen = detailsPanel.style.display !== 'none';
    
    if (isOpen) {
      // 关闭
      detailsPanel.style.display = 'none';
      toggleBtn.classList.remove('active');
    } else {
      // 打开并加载数据
      detailsPanel.style.display = 'block';
      toggleBtn.classList.add('active');
      await renderPomodoroDetails();
    }
  });
}

// ===== 事件监听 =====

/**
 * 初始化
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Popup] DOM加载完成');
  
  // 渲染月历
  renderCalendar(currentCalendarYear, currentCalendarMonth);
  
  // 渲染年度热力图
  renderHeatmap();
  
  // 默认加载最近7天（按日）
  loadAndDisplayStats(7, 'daily');
  
  // 初始化番茄钟详情面板
  initPomodoroDetails();
  
  // 监听图表视图选择器
  const chartViewSelector = document.getElementById('chart-view-selector');
  if (chartViewSelector) {
    chartViewSelector.addEventListener('change', function() {
      const value = this.value;
      const [period, aggregation] = value.split('-');
      console.log('[Popup] 切换视图:', value, '→ period:', period, 'aggregation:', aggregation);
      
      // 映射 period 到天数
      const periodToDays = {
        'week': 7,      // 最近7天
        'month': 28,    // 最近4周（28天）
        'year': 365     // 最近12个月（365天）
      };
      
      const days = periodToDays[period] || 7;
      loadAndDisplayStats(days, aggregation);
    });
  }
  
  // 导出按钮
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async function() {
      try {
        console.log('[Popup] 触发导出');
        await window.exportSystem.handleExport();
      } catch (err) {
        console.error('[Popup] 导出失败:', err);
        alert('导出失败: ' + err.message);
      }
    });
  }
  
  // 帮助按钮
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/help.html') });
    });
  }
  
  // 月历导航按钮
  const prevMonthBtn = document.getElementById('calendar-prev-month');
  const nextMonthBtn = document.getElementById('calendar-next-month');
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', prevMonth);
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', nextMonth);
  }
  
  console.log('[Popup] 初始化完成');
});

console.log('[Popup] 脚本加载完成');

