// export-utils.js - 导出模块共享工具函数

/**
 * 格式化时间（秒 → 时分秒）
 */
function formatTimeForExport(seconds) {
  if (!seconds || seconds < 0) return '0秒';
  if (seconds < 60) return Math.floor(seconds) + '秒';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
  } else {
    return `${minutes}分钟`;
  }
}

/**
 * 格式化时长（分钟版本）
 */
function formatDurationInMinutes(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}分钟`;
}

/**
 * 格式化日期（YYYY-MM-DD）
 */
function formatDateForExport(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间（HH:MM）
 */
function formatTimeHHMM(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 获取星期几
 */
function getWeekdayName(dateStr) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(dateStr);
  return weekdays[date.getDay()];
}

/**
 * 加载指定日期的番茄钟数据
 */
async function loadPomodoroData(dateStr) {
  try {
    const result = await chrome.storage.local.get('pomodoroHistory');
    const history = result.pomodoroHistory || {};
    const dayHistory = history[dateStr] || [];
    
    // 统计工作记录（学习）
    const workEntries = dayHistory.filter(entry => entry.type === 'work');
    
    // 完成次数（整数）
    const completed = workEntries.length;
    
    // 精确番茄钟数（按25分钟换算，支持小数）
    const totalPomodoroCount = workEntries.reduce((sum, entry) => {
      // 优先使用新字段 pomodoroCount，但要确保它是有效的正数
      if (entry.pomodoroCount !== undefined && entry.pomodoroCount !== null && entry.pomodoroCount > 0) {
        return sum + entry.pomodoroCount;
      } else {
        // 回退到用duration计算
        const duration = entry.actualDuration || entry.duration || 0;
        if (duration > 0) {
          return sum + (duration / (25 * 60));
        }
        return sum;
      }
    }, 0);
    
    // 总工作时间（秒）- 优先使用 actualDuration，向后兼容 duration
    const totalWorkTime = workEntries.reduce((sum, entry) => 
      sum + (entry.actualDuration || entry.duration || 0), 0
    );
    
    // 统计休息记录
    const breakEntries = dayHistory.filter(entry => entry.type === 'break');
    const totalBreakTime = breakEntries.reduce((sum, entry) => 
      sum + (entry.actualDuration || entry.duration || 0), 0
    );
    
    // 统计模式使用情况
    const countdownCount = workEntries.filter(e => e.mode === 'countdown').length;
    const countupCount = workEntries.filter(e => e.mode === 'countup').length;
    
    return {
      completed,                    // 完成次数（整数）
      totalPomodoroCount,          // 精确番茄钟数（小数）
      totalWorkTime,               // 总工作时间（秒）
      totalBreakTime,              // 总休息时间（秒）
      countdownCount,              // 倒计时次数
      countupCount,                // 正计时次数
      history: dayHistory          // 完整历史
    };
  } catch (err) {
    console.error('[导出工具] 加载番茄钟数据失败:', err);
    return { 
      completed: 0, 
      totalPomodoroCount: 0,
      totalWorkTime: 0, 
      totalBreakTime: 0,
      countdownCount: 0,
      countupCount: 0,
      history: [] 
    };
  }
}

console.log('[导出工具] 模块加载完成');

