// export-timeline.js - 时间线生成器

class TimelineGenerator {
  /**
   * 生成单日时间线事件
   */
  generateTimeline(dayData, videoIndex = {}) {
    const events = [];
    const videos = dayData.videos || {};
    
    // 提取并排序视频
    const videoList = Object.entries(videos)
      .filter(([_, v]) => v.st)  // 必须有开始时间
      .map(([bvid, v]) => ({
        bvid,
        title: v.ti || videoIndex[bvid]?.title || bvid,
        duration: v.d || 0,
        startTime: new Date(v.st)
      }))
      .sort((a, b) => a.startTime - b.startTime);
    
    // 生成事件序列
    videoList.forEach((video, index) => {
      const endTime = new Date(video.startTime.getTime() + video.duration * 1000);
      
      // 添加视频事件
      events.push({
        type: 'video',
        bvid: video.bvid,
        title: video.title,
        startTime: video.startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: video.duration,
        startFormatted: formatTimeHHMM(video.startTime),
        endFormatted: formatTimeHHMM(endTime),
        durationFormatted: formatTimeForExport(video.duration)
      });
      
      // 检测学习间隔（休息）
      if (index < videoList.length - 1) {
        const nextStart = videoList[index + 1].startTime;
        const gapMs = nextStart - endTime;
        const gapMinutes = gapMs / 60000;
        
        if (gapMinutes > 3) {  // 超过3分钟算休息
          events.push({
            type: 'break',
            startTime: endTime.toISOString(),
            endTime: nextStart.toISOString(),
            duration: Math.floor(gapMs / 1000),
            startFormatted: formatTimeHHMM(endTime),
            endFormatted: formatTimeHHMM(nextStart),
            durationFormatted: formatTimeForExport(Math.floor(gapMs / 1000))
          });
        }
      }
    });
    
    return events;
  }
  
  /**
   * 分析学习模式
   */
  analyzePattern(timeline, dayData) {
    const insights = [];
    const videoEvents = timeline.filter(e => e.type === 'video');
    
    if (videoEvents.length === 0) {
      return ['今日暂无学习数据'];
    }
    
    // 分析1：学习时段分布
    const hourStats = {};
    videoEvents.forEach(event => {
      const hour = new Date(event.startTime).getHours();
      hourStats[hour] = (hourStats[hour] || 0) + event.duration;
    });
    
    const bestHour = Object.entries(hourStats)
      .sort(([,a], [,b]) => b - a)[0];
    if (bestHour) {
      const hourLabel = `${bestHour[0]}:00-${parseInt(bestHour[0])+1}:00`;
      insights.push(`🌟 最佳学习时段：${hourLabel} (${formatDurationInMinutes(bestHour[1])})`);
    }
    
    // 分析2：学习连续性
    const breaks = timeline.filter(e => e.type === 'break');
    if (breaks.length > 0) {
      const avgBreak = breaks.reduce((sum, b) => sum + b.duration, 0) / breaks.length;
      insights.push(`⏱️ 平均休息间隔：${formatDurationInMinutes(avgBreak)}`);
      
      const shortBreaks = breaks.filter(b => b.duration < 600).length; // 小于10分钟
      if (shortBreaks / breaks.length > 0.7) {
        insights.push(`✅ 学习连续性很好，休息间隔短促`);
      }
    } else {
      insights.push(`✅ 学习非常专注，几乎无中断`);
    }
    
    // 分析3：最长连续学习
    if (dayData.longestSession) {
      insights.push(`⭐ 最长连续学习：${formatTimeForExport(dayData.longestSession)}`);
    }
    
    return insights;
  }
  
  /**
   * 生成Markdown格式的时间线
   */
  toMarkdown(timeline, dayData, insights) {
    let md = `## ⏰ 学习时间线\n\n`;
    
    if (timeline.length === 0) {
      return md + `今日暂无学习记录\n\n`;
    }
    
    const firstEvent = timeline[0];
    const lastEvent = timeline[timeline.length - 1];
    const start = formatTimeHHMM(firstEvent.startTime);
    const end = formatTimeHHMM(lastEvent.endTime || lastEvent.startTime);
    
    md += `**学习时段**：${start} - ${end}\n\n`;
    md += `\`\`\`\n`;
    
    timeline.forEach((event, index) => {
      if (event.type === 'video') {
        md += `${event.startFormatted} ━━━┓\n`;
        md += `            ┃ 📺 ${event.title}\n`;
        md += `            ┃    ⏱️ ${event.durationFormatted}\n`;
        if (index < timeline.length - 1 && timeline[index + 1].type === 'break') {
          md += `            ┃\n`;
        } else {
          md += `            ┣━━━\n`;
        }
      } else if (event.type === 'break') {
        md += `            ┃\n`;
        md += `${event.startFormatted} ┃ ☕ 休息 (${event.durationFormatted})\n`;
        md += `            ┃\n`;
        md += `            ┣━━━\n`;
      }
    });
    
    md += `${end} ━━━┛ 结束学习\n`;
    md += `\`\`\`\n\n`;
    
    // 添加智能分析
    if (insights && insights.length > 0) {
      md += `## 💡 学习模式分析\n\n`;
      insights.forEach(insight => {
        md += `- ${insight}\n`;
      });
      md += `\n`;
    }
    
    return md;
  }
  
  /**
   * 生成HTML格式的时间线
   */
  toHTML(timeline, dayData, insights) {
    if (timeline.length === 0) {
      return `<div class="timeline-empty">今日暂无学习记录</div>`;
    }
    
    let html = `<div class="timeline">`;
    
    timeline.forEach(event => {
      if (event.type === 'video') {
        html += `
          <div class="timeline-item video">
            <div class="timeline-time">${event.startFormatted}</div>
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-badge video">📺 视频</div>
              <h4>${event.title}</h4>
              <div class="timeline-duration">${event.durationFormatted}</div>
            </div>
          </div>`;
      } else if (event.type === 'break') {
        html += `
          <div class="timeline-item break">
            <div class="timeline-time">${event.startFormatted}</div>
            <div class="timeline-dot break"></div>
            <div class="timeline-content">
              <div class="timeline-badge break">☕ 休息</div>
              <div class="timeline-duration">${event.durationFormatted}</div>
            </div>
          </div>`;
      }
    });
    
    html += `</div>`;
    
    // 添加分析
    if (insights && insights.length > 0) {
      html += `<div class="timeline-insights">`;
      html += `<h3>💡 学习模式分析</h3><ul>`;
      insights.forEach(insight => {
        html += `<li>${insight}</li>`;
      });
      html += `</ul></div>`;
    }
    
    return html;
  }
}

// 导出单例
window.timelineGenerator = new TimelineGenerator();

console.log('[时间线生成器] 模块加载完成');

