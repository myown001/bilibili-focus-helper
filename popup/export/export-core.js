// export-core.js - 核心导出逻辑（重构自export-manager.js）

class ExportCore {
  constructor() {
    console.log('[导出核心] 初始化');
  }
  
  /**
   * 生成今日详细报告（Markdown）
   * @param {Object} pomodoroData - 番茄钟数据（可选）
   */
  generateTodayReportMD(dayData, videoIndex, pomodoroData = null) {
    const date = dayData.date;
    const weekday = getWeekdayName(date);
    
    let md = `# 📅 今日学习报告 - ${date} (周${weekday})\n\n`;
    
    // 概况
    md += `## 📊 今日概况\n\n`;
    md += `- 🕐 学习时长：${formatTimeForExport(dayData.total)}\n`;
    md += `- ✅ 有效时长：${formatTimeForExport(dayData.effective)}\n`;
    const quality = dayData.total > 0 ? ((dayData.effective / dayData.total) * 100).toFixed(1) : '0';
    md += `- 🎯 专注质量：${quality}% `;
    
    // 评级
    if (quality >= 90) md += `(S级 🏆)\n`;
    else if (quality >= 75) md += `(A级 ⭐)\n`;
    else if (quality >= 60) md += `(B级 👍)\n`;
    else if (quality >= 40) md += `(C级 📈)\n`;
    else md += `(D级 ⚠️)\n`;
    
    const videoCount = Object.keys(dayData.videos || {}).length;
    md += `- 📚 学习视频：${videoCount}个\n`;
    md += `- ⏱️ 最长连续：${formatTimeForExport(dayData.longestSession || 0)}\n\n`;
    
    // 专注表现
    md += `## 🎯 专注表现\n\n`;
    md += `- ⏸️ 暂停次数：${dayData.pauseCount || 0}次`;
    if (dayData.pauseCount <= 2) md += ` ✅ 优秀\n`;
    else if (dayData.pauseCount <= 5) md += ` 👍 良好\n`;
    else md += ` ⚠️ 建议减少\n`;
    
    md += `- 🚪 退出全屏：${dayData.exitCount || 0}次`;
    if (dayData.exitCount === 0) md += ` 🎉 完美\n`;
    else if (dayData.exitCount <= 2) md += ` ✅ 良好\n`;
    else md += ` ⚠️ 建议减少\n`;
    
    md += `- 🔄 标签切换：${dayData.switchCount || 0}次`;
    if (dayData.switchCount === 0) md += ` 🎉 完美\n`;
    else if (dayData.switchCount <= 3) md += ` ✅ 良好\n`;
    else md += ` ⚠️ 建议减少\n`;
    
    md += `\n`;
    
    // 番茄钟使用情况
    if (pomodoroData && pomodoroData.completed > 0) {
      md += `## 🍅 番茄钟使用情况\n\n`;
      md += `- ✅ 完成番茄钟：${pomodoroData.totalPomodoroCount.toFixed(1)}个（${pomodoroData.completed}次）\n`;
      md += `- ⏱️ 工作时长：${formatTimeForExport(pomodoroData.totalWorkTime)}\n`;
      md += `- ☕ 休息时长：${formatTimeForExport(pomodoroData.totalBreakTime)}\n`;
      
      // 模式统计
      if (pomodoroData.countdownCount > 0 || pomodoroData.countupCount > 0) {
        md += `- 📊 模式统计：倒计时${pomodoroData.countdownCount}次，正计时${pomodoroData.countupCount}次\n`;
      }
      
      if (pomodoroData.totalPomodoroCount >= 8) {
        md += `- 💯 评价：非常优秀！坚持使用番茄钟保持高效\n`;
      } else if (pomodoroData.totalPomodoroCount >= 4) {
        md += `- ✨ 评价：表现良好，继续保持\n`;
      } else {
        md += `- 💪 评价：建议增加番茄钟使用频率\n`;
      }
      
      md += `\n`;
      
      // 详细的番茄钟时间线
      if (pomodoroData.history && pomodoroData.history.length > 0) {
        md += `### 番茄钟时间线\n\n`;
        pomodoroData.history.forEach((entry, index) => {
          const startTime = new Date(entry.startTime).toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const endTime = new Date(entry.endTime).toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const icon = entry.type === 'work' ? '🍅' : '☕';
          const label = entry.type === 'work' ? '工作' : '休息';
          const actualDuration = entry.actualDuration || entry.duration || 0;
          const actualMinutes = Math.floor(actualDuration / 60);
          
          // 模式标签
          let modeLabel = '';
          if (entry.mode === 'countdown') {
            modeLabel = '倒计时';
          } else if (entry.mode === 'countup') {
            modeLabel = '正计时';
          }
          
          // 番茄钟数（仅工作类型）
          let pomodoroInfo = '';
          if (entry.type === 'work' && entry.pomodoroCount) {
            pomodoroInfo = ` = ${entry.pomodoroCount.toFixed(2)}个番茄钟`;
          }
          
          md += `${index + 1}. ${icon} ${label} ${startTime} - ${endTime} (${actualMinutes}分钟`;
          if (modeLabel) md += `，${modeLabel}`;
          md += `)${pomodoroInfo}\n`;
        });
        md += `\n`;
      }
    }
    
    // 时间线
    const timeline = window.timelineGenerator.generateTimeline(dayData, videoIndex);
    const insights = window.timelineGenerator.analyzePattern(timeline, dayData);
    md += window.timelineGenerator.toMarkdown(timeline, dayData, insights);
    
    // 视频清单详情
    if (videoCount > 0) {
      md += `## 📚 学习视频清单\n\n`;
      const videos = Object.entries(dayData.videos || {})
        .filter(([_, v]) => v.st)
        .sort(([_, a], [__, b]) => new Date(a.st) - new Date(b.st));
      
      videos.forEach(([bvid, v], index) => {
        const title = v.ti || videoIndex[bvid]?.title || bvid;
        const duration = formatTimeForExport(v.d || 0);
        const startTime = formatTimeHHMM(v.st);
        md += `### ${index + 1}. ${title}\n\n`;
        md += `- ⏱️ 观看时长：${duration}\n`;
        md += `- 🕐 开始时间：${startTime}\n`;
        md += `- 🔗 BV号：${bvid}\n\n`;
      });
    }
    
    // 🆕 质量深度分析（复用QualityAnalyzer）
    if (typeof QualityAnalyzer !== 'undefined') {
      const qualityAnalyzer = new QualityAnalyzer();
      const qualityResult = qualityAnalyzer.calculateQualityScore({
        totalTime: dayData.total,
        effectiveTime: dayData.effective,
        pauseCount: dayData.pauseCount || 0,
        exitFullscreenCount: dayData.exitCount || 0,
        switchCount: dayData.switchCount || 0,
        longestSession: dayData.longestSession || 0
      });
      
      md += this._generateQualityAnalysisMD(qualityResult, qualityAnalyzer);
    }
    
    // 反思分析
    const reflections = window.reflectionAnalyzer.analyzeDailyBehavior(dayData);
    md += window.reflectionAnalyzer.toMarkdown(reflections);
    
    md += `---\n\n*报告由 B站专注学习助手 自动生成*\n`;
    
    return md;
  }
  
  /**
   * 生成今日详细报告（HTML）
   * @param {Object} pomodoroData - 番茄钟数据（可选）
   */
  generateTodayReportHTML(dayData, videoIndex, pomodoroData = null) {
    const date = dayData.date;
    const weekday = getWeekdayName(date);
    const quality = dayData.total > 0 ? ((dayData.effective / dayData.total) * 100).toFixed(1) : '0';
    const videoCount = Object.keys(dayData.videos || {}).length;
    
    // 获取时间线
    const timeline = window.timelineGenerator.generateTimeline(dayData, videoIndex);
    const insights = window.timelineGenerator.analyzePattern(timeline, dayData);
    const timelineHTML = window.timelineGenerator.toHTML(timeline, dayData, insights);
    
    // 生成质量分析HTML（在模板字符串之前，避免this上下文丢失）
    let qualityAnalysisHTML = '';
    if (typeof QualityAnalyzer !== 'undefined') {
      const qualityAnalyzer = new QualityAnalyzer();
      const qualityResult = qualityAnalyzer.calculateQualityScore({
        totalTime: dayData.total,
        effectiveTime: dayData.effective,
        pauseCount: dayData.pauseCount || 0,
        exitFullscreenCount: dayData.exitCount || 0,
        switchCount: dayData.switchCount || 0,
        longestSession: dayData.longestSession || 0
      });
      qualityAnalysisHTML = this._generateQualityAnalysisHTML(qualityResult, qualityAnalyzer);
    }
    
    // 生成反思分析HTML（在模板字符串之前）
    const reflections = window.reflectionAnalyzer.analyzeDailyBehavior(dayData);
    const reflectionHTML = window.reflectionAnalyzer.toHTML(reflections);
    
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>今日学习报告 - ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .content { padding: 40px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 8px;
    }
    .stat-label { font-size: 14px; color: #6b7280; }
    .section { margin-bottom: 40px; }
    .section h2 {
      font-size: 24px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    .metric-item {
      padding: 12px;
      margin: 8px 0;
      background: #f8f9fa;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .timeline {
      position: relative;
      padding-left: 80px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 60px;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(to bottom, #667eea, #764ba2);
    }
    .timeline-item {
      position: relative;
      margin-bottom: 30px;
    }
    .timeline-time {
      position: absolute;
      left: -80px;
      top: 0;
      font-weight: 600;
      color: #667eea;
    }
    .timeline-dot {
      position: absolute;
      left: -23px;
      top: 5px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #667eea;
      border: 3px solid white;
      box-shadow: 0 0 0 3px #667eea;
    }
    .timeline-dot.break {
      background: #f59e0b;
      box-shadow: 0 0 0 3px #f59e0b;
    }
    .timeline-content {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
    }
    .timeline-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .timeline-badge.video {
      background: #dbeafe;
      color: #1e40af;
    }
    .timeline-badge.break {
      background: #fef3c7;
      color: #92400e;
    }
    .timeline-content h4 {
      margin: 8px 0;
      color: #1f2937;
    }
    .timeline-duration {
      color: #6b7280;
      font-size: 14px;
    }
    .timeline-insights {
      background: #f0fdf4;
      padding: 20px;
      border-radius: 12px;
      margin-top: 20px;
    }
    .timeline-insights h3 {
      color: #166534;
      margin-bottom: 12px;
    }
    .timeline-insights ul {
      list-style: none;
      padding: 0;
    }
    .timeline-insights li {
      padding: 8px 0;
      color: #166534;
    }
    .summary-section {
      background: #eff6ff;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .summary-section h3 {
      color: #1e40af;
      margin-bottom: 16px;
    }
    .summary-list {
      list-style: none;
      padding: 0;
    }
    .summary-list li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
    }
    .summary-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #10b981;
      font-weight: bold;
    }
    .reflection-section {
      margin-top: 40px;
    }
    .reflection-item {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }
    .reflection-item.critical {
      background: #fee2e2;
      border-left-color: #dc2626;
    }
    .reflection-item.warning {
      background: #fef3c7;
      border-left-color: #f59e0b;
    }
    .reflection-item.notice {
      background: #dbeafe;
      border-left-color: #3b82f6;
    }
    .reflection-item.positive {
      background: #d1fae5;
      border-left-color: #10b981;
    }
    .reflection-item h3 {
      margin-bottom: 12px;
      color: #1f2937;
    }
    .reflection-data {
      font-weight: 600;
      margin-bottom: 12px;
      color: #4b5563;
    }
    .reflection-questions, .reflection-suggestions {
      margin-top: 12px;
    }
    .reflection-questions ul, .reflection-suggestions ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    .reflection-questions li, .reflection-suggestions li {
      margin: 6px 0;
      color: #374151;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 今日学习报告</h1>
      <p>${date} (周${weekday})</p>
    </div>
    
    <div class="content">
      <div class="section">
        <h2>📊 今日概况</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatTimeForExport(dayData.total)}</div>
            <div class="stat-label">学习时长</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatTimeForExport(dayData.effective)}</div>
            <div class="stat-label">有效时长</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${quality}%</div>
            <div class="stat-label">专注质量</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${videoCount}</div>
            <div class="stat-label">学习视频</div>
          </div>
          ${pomodoroData && pomodoroData.completed > 0 ? `
          <div class="stat-card" style="background: linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%);">
            <div class="stat-value" style="color: #ef4444;">${pomodoroData.completed}</div>
            <div class="stat-label">完成番茄钟 🍅</div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="section">
        <h2>🎯 专注表现</h2>
        <div class="metric-item">
          <span>⏸️ 暂停次数</span>
          <span>${dayData.pauseCount || 0}次</span>
        </div>
        <div class="metric-item">
          <span>🚪 退出全屏</span>
          <span>${dayData.exitCount || 0}次</span>
        </div>
        <div class="metric-item">
          <span>🔄 标签切换</span>
          <span>${dayData.switchCount || 0}次</span>
        </div>
        <div class="metric-item">
          <span>⏱️ 最长连续</span>
          <span>${formatTimeForExport(dayData.longestSession || 0)}</span>
        </div>
      </div>
      
      ${pomodoroData && pomodoroData.completed > 0 ? `
      <div class="section">
        <h2>🍅 番茄钟使用情况</h2>
        <div class="metric-item">
          <span>✅ 完成番茄钟</span>
          <strong>${pomodoroData.totalPomodoroCount.toFixed(1)}个（${pomodoroData.completed}次）</strong>
        </div>
        <div class="metric-item">
          <span>⏱️ 工作时长</span>
          <strong>${formatTimeForExport(pomodoroData.totalWorkTime)}</strong>
        </div>
        <div class="metric-item">
          <span>☕ 休息时长</span>
          <strong>${formatTimeForExport(pomodoroData.totalBreakTime)}</strong>
        </div>
        ${(pomodoroData.countdownCount > 0 || pomodoroData.countupCount > 0) ? `
        <div class="metric-item">
          <span>📊 模式统计</span>
          <strong>倒计时${pomodoroData.countdownCount}次，正计时${pomodoroData.countupCount}次</strong>
        </div>
        ` : ''}
        
        ${pomodoroData.history && pomodoroData.history.length > 0 ? `
        <h3 style="margin-top: 20px; margin-bottom: 12px;">番茄钟时间线</h3>
        <div class="timeline">
          ${pomodoroData.history.map((entry, index) => {
            const startTime = new Date(entry.startTime).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            const endTime = new Date(entry.endTime).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            const icon = entry.type === 'work' ? '🍅' : '☕';
            const label = entry.type === 'work' ? '工作' : '休息';
            const actualDuration = entry.actualDuration || entry.duration || 0;
            const actualMinutes = Math.floor(actualDuration / 60);
            
            // 模式标签
            let modeLabel = '';
            if (entry.mode === 'countdown') {
              modeLabel = '倒计时';
            } else if (entry.mode === 'countup') {
              modeLabel = '正计时';
            }
            
            // 番茄钟数（仅工作类型）
            let pomodoroInfo = '';
            if (entry.type === 'work' && entry.pomodoroCount) {
              pomodoroInfo = ` <span style="color: #10b981;">= ${entry.pomodoroCount.toFixed(2)}个番茄钟</span>`;
            }
            
            return `
            <div class="timeline-item">
              <div class="timeline-time">${startTime}</div>
              <div class="timeline-dot${entry.type === 'break' ? ' break' : ''}"></div>
              <div class="timeline-content">
                <strong>${icon} ${label}</strong> ${startTime} - ${endTime} 
                <span style="color: #6b7280;">(${actualMinutes}分钟${modeLabel ? '，' + modeLabel : ''})</span>${pomodoroInfo}
              </div>
            </div>`;
          }).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}
      
      <div class="section">
        <div class="summary-section">
          <h3>📋 今日学习总结</h3>
          <ul class="summary-list">
            <li>完成 ${videoCount} 个视频的学习</li>
            <li>累计学习 ${formatTimeForExport(dayData.total)}</li>
            <li>专注质量达到 ${quality}%</li>
            <li>最长连续学习 ${formatTimeForExport(dayData.longestSession || 0)}</li>
            ${dayData.pauseCount <= 5 ? '<li>暂停次数控制良好</li>' : ''}
            ${dayData.switchCount === 0 ? '<li>学习过程无标签切换</li>' : ''}
          </ul>
        </div>
      </div>
      
      <div class="section">
        <h2>⏰ 学习时间线</h2>
        ${timelineHTML}
      </div>
      
      ${qualityAnalysisHTML}
      
      ${reflectionHTML}
    </div>
    
    <div class="footer">
      <p>报告由 B站专注学习助手 自动生成</p>
    </div>
  </div>
</body>
</html>`;
    
    return html;
  }
  
  /**
   * 生成周报告/月报告
   */
  generatePeriodReport(dailyDataList, periodName, format = 'markdown') {
    // 计算汇总统计
    const stats = {
      totalTime: 0,
      effectiveTime: 0,
      videoCount: new Set(),
      studyDays: 0,
      pauseCount: 0,
      exitCount: 0,
      switchCount: 0,
      longestSession: 0
    };
    
    dailyDataList.forEach(day => {
      if (day.total > 0) stats.studyDays++;
      stats.totalTime += day.total;
      stats.effectiveTime += day.effective;
      stats.pauseCount += day.pauseCount || 0;
      stats.exitCount += day.exitCount || 0;
      stats.switchCount += day.switchCount || 0;
      stats.longestSession = Math.max(stats.longestSession, day.longestSession || 0);
      Object.keys(day.videos || {}).forEach(v => stats.videoCount.add(v));
    });
    
    const avgQuality = stats.totalTime > 0 
      ? ((stats.effectiveTime / stats.totalTime) * 100).toFixed(1)
      : '0';
    
    // 生成趋势分析
    const trends = window.reflectionAnalyzer.analyzePeriodTrend(dailyDataList);
    
    if (format === 'markdown') {
      let md = `# 📊 ${periodName}学习报告\n\n`;
      
      // 总体概况
      md += `## 📈 总体概况\n\n`;
      md += `- 📅 学习天数：${stats.studyDays}/${dailyDataList.length}天 (${(stats.studyDays / dailyDataList.length * 100).toFixed(0)}%)\n`;
      md += `- 🕐 累计时长：${formatTimeForExport(stats.totalTime)}\n`;
      md += `- ✅ 有效时长：${formatTimeForExport(stats.effectiveTime)}\n`;
      md += `- 🎯 平均质量：${avgQuality}%\n`;
      md += `- 📚 学习视频：${stats.videoCount.size}个\n`;
      md += `- ⏱️ 最长连续：${formatTimeForExport(stats.longestSession)}\n`;
      
      if (stats.studyDays > 0) {
        const avgDaily = stats.totalTime / stats.studyDays;
        md += `- 📊 日均时长：${formatTimeForExport(avgDaily)}\n`;
      }
      md += `\n`;
      
      // 每日学习情况表格
      md += `## 📊 每日学习情况\n\n`;
      md += `| 日期 | 星期 | 时长 | 有效时长 | 质量 | 视频数 | 状态 |\n`;
      md += `|------|------|------|----------|------|--------|------|\n`;
      
      dailyDataList.forEach(day => {
        const weekday = getWeekdayName(day.date);
        const time = day.total > 0 ? formatDurationInMinutes(day.total) : '-';
        const effective = day.total > 0 ? formatDurationInMinutes(day.effective) : '-';
        const quality = day.total > 0 ? Math.floor((day.effective / day.total) * 100) + '%' : '-';
        const videoCount = Object.keys(day.videos || {}).length;
        const status = day.total === 0 ? '⚪ 未学习' 
          : parseInt(quality) >= 80 ? '🟢 优秀'
          : parseInt(quality) >= 60 ? '🟡 良好'
          : '🔴 需改进';
        
        md += `| ${day.date} | 周${weekday} | ${time} | ${effective} | ${quality} | ${videoCount} | ${status} |\n`;
      });
      md += `\n`;
      
      // 趋势分析
      md += `## 📈 趋势分析\n\n`;
      trends.forEach(trend => {
        const emoji = trend.type === 'warning' ? '⚠️' 
          : trend.type === 'notice' ? '📌' 
          : '✅';
        md += `### ${emoji} ${trend.title}\n\n`;
        md += `${trend.content}\n\n`;
        if (trend.suggestion) {
          md += `**建议**：${trend.suggestion}\n\n`;
        }
      });
      
      md += `\n---\n\n*报告由 B站专注学习助手 自动生成*\n`;
      return md;
    }
    
    // HTML版本
    return this.generatePeriodReportHTML(dailyDataList, periodName, stats, trends);
  }
  
  /**
   * 生成周期报告HTML
   */
  generatePeriodReportHTML(dailyDataList, periodName, stats, trends) {
    const avgQuality = stats.totalTime > 0 
      ? ((stats.effectiveTime / stats.totalTime) * 100).toFixed(1)
      : '0';
    
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${periodName}学习报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .content { padding: 40px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 8px;
    }
    .stat-label { font-size: 14px; color: #6b7280; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    tr:hover { background: #f9fafb; }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      font-size: 24px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    .trend-item {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }
    .trend-item.warning {
      background: #fef3c7;
      border-left-color: #f59e0b;
    }
    .trend-item.positive {
      background: #d1fae5;
      border-left-color: #10b981;
    }
    .trend-item h3 {
      margin-bottom: 12px;
      color: #1f2937;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${periodName}学习报告</h1>
      <p>${dailyDataList[0].date} ~ ${dailyDataList[dailyDataList.length-1].date}</p>
    </div>
    
    <div class="content">
      <div class="section">
        <h2>📈 总体概况</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.studyDays}/${dailyDataList.length}</div>
            <div class="stat-label">学习天数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatTimeForExport(stats.totalTime)}</div>
            <div class="stat-label">累计时长</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatTimeForExport(stats.effectiveTime)}</div>
            <div class="stat-label">有效时长</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgQuality}%</div>
            <div class="stat-label">平均质量</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.videoCount.size}</div>
            <div class="stat-label">学习视频</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatTimeForExport(stats.longestSession)}</div>
            <div class="stat-label">最长连续</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>📊 每日学习情况</h2>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>星期</th>
              <th>时长</th>
              <th>有效时长</th>
              <th>质量</th>
              <th>视频数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>`;
    
    dailyDataList.forEach(day => {
      const weekday = getWeekdayName(day.date);
      const time = day.total > 0 ? formatDurationInMinutes(day.total) : '-';
      const effective = day.total > 0 ? formatDurationInMinutes(day.effective) : '-';
      const quality = day.total > 0 ? Math.floor((day.effective / day.total) * 100) + '%' : '-';
      const videoCount = Object.keys(day.videos || {}).length;
      const status = day.total === 0 ? '⚪ 未学习' 
        : parseInt(quality) >= 80 ? '🟢 优秀'
        : parseInt(quality) >= 60 ? '🟡 良好'
        : '🔴 需改进';
      
      html += `<tr>
        <td>${day.date}</td>
        <td>周${weekday}</td>
        <td>${time}</td>
        <td>${effective}</td>
        <td>${quality}</td>
        <td>${videoCount}</td>
        <td>${status}</td>
      </tr>`;
    });
    
    html += `</tbody>
        </table>
      </div>
      
      <div class="section">
        <h2>📈 趋势分析</h2>`;
    
    trends.forEach(trend => {
      const typeClass = trend.type === 'warning' ? 'warning' 
        : trend.type === 'positive' ? 'positive' 
        : '';
      html += `<div class="trend-item ${typeClass}">
        <h3>${trend.title}</h3>
        <p>${trend.content}</p>
        ${trend.suggestion ? `<p style="margin-top: 12px;"><strong>建议：</strong>${trend.suggestion}</p>` : ''}
      </div>`;
    });
    
    html += `</div>
    </div>
    
    <div class="footer">
      <p>报告由 B站专注学习助手 自动生成</p>
    </div>
  </div>
</body>
</html>`;
    
    return html;
  }
  
  /**
   * 🆕 生成质量深度分析（Markdown）- 复用QualityAnalyzer
   */
  _generateQualityAnalysisMD(qualityResult, qualityAnalyzer) {
    let md = `## 🎯 专注质量深度分析\n\n`;
    md += `> 💡 **说明**：专注质量评分由4个维度加权计算得出。[查看评分算法说明](#评分算法)\n\n`;
    
    // 综合评分
    md += `### 📊 综合评分\n\n`;
    md += `**${qualityResult.rating.icon} ${qualityResult.rating.level} - ${qualityResult.totalScore}分**\n\n`;
    md += `${qualityResult.rating.message}\n\n`;
    
    // 四维度详细分析
    md += `### 📈 四维度详细分析\n\n`;
    const dims = qualityResult.dimensions;
    
    // 1. 时间有效率
    md += `#### ⏰ 时间有效率（权重35%）\n\n`;
    md += `- **得分**：${dims.timeEfficiency.score}分（${dims.timeEfficiency.level}）\n`;
    md += `- **数值**：${dims.timeEfficiency.value}${dims.timeEfficiency.unit}\n`;
    md += `- **说明**：${dims.timeEfficiency.description}\n`;
    md += `- **计算**：有效学习时长 ÷ 总学习时长 × 100%\n`;
    if (dims.timeEfficiency.score < 70) {
      md += `- **改进**：减少暂停时间，提前准备好学习资料\n`;
    }
    md += `\n`;
    
    // 2. 专注稳定性
    md += `#### 🎯 专注稳定性（权重30%）\n\n`;
    md += `- **得分**：${dims.focusStability.score.toFixed(1)}分（${dims.focusStability.level}）\n`;
    md += `- **干扰密度**：${dims.focusStability.value}${dims.focusStability.unit}\n`;
    md += `- **干扰详情**：暂停${dims.focusStability.details.pauseCount}次 | 退出全屏${dims.focusStability.details.exitFullscreenCount}次 | 切换标签${dims.focusStability.details.switchCount}次\n`;
    md += `- **加权总干扰**：${dims.focusStability.details.totalInterruptions}次（暂停×1 + 退全屏×1.5 + 切标签×0.5）\n`;
    if (dims.focusStability.score < 70) {
      md += `- **改进**：减少外界干扰，使用番茄钟保持专注\n`;
    }
    md += `\n`;
    
    // 3. 持续专注力
    md += `#### 🔥 持续专注力（权重25%）\n\n`;
    md += `- **得分**：${dims.continuousFocus.score}分（${dims.continuousFocus.level}）\n`;
    md += `- **最长连续**：${dims.continuousFocus.description}\n`;
    md += `- **占比**：${dims.continuousFocus.value}${dims.continuousFocus.unit}（最长连续/总时长）\n`;
    if (dims.continuousFocus.score < 70) {
      md += `- **改进**：尝试番茄钟工作法（Ctrl+Shift+T），25分钟专注+5分钟休息\n`;
    }
    md += `\n`;
    
    // 4. 学习完成度
    md += `#### ✅ 学习完成度（权重10%）\n\n`;
    md += `- **得分**：${dims.completion.score}分（${dims.completion.level}）\n`;
    md += `- **时长**：${dims.completion.value}${dims.completion.unit}\n`;
    md += `- **说明**：基于学习时长的完成度评估\n`;
    if (dims.completion.score < 70) {
      md += `- **改进**：设定明确目标，至少保证30分钟连续学习\n`;
    }
    md += `\n`;
    
    // 薄弱环节
    const weakPoints = qualityAnalyzer.analyzeWeakPoints(qualityResult);
    if (weakPoints.length > 0) {
      md += `### ⚠️ 薄弱环节分析\n\n`;
      weakPoints.forEach((weak, index) => {
        md += `${index + 1}. **${weak.dimension}**：${weak.score.toFixed(1)}分（${weak.level}）\n`;
        md += `   ${weak.description}\n\n`;
      });
    }
    
    // 改进建议
    const suggestions = qualityAnalyzer.generateSuggestions(qualityResult);
    if (suggestions.length > 0) {
      md += `### 💡 针对性改进建议\n\n`;
      suggestions.forEach((sug, index) => {
        md += `${index + 1}. ${sug.icon} **${sug.title}**\n`;
        md += `   ${sug.content}\n\n`;
      });
    }
    
    // 评分算法说明
    md += `### 📖 评分算法说明 {#评分算法}\n\n`;
    md += `**综合得分** = 时间有效率(35%) + 专注稳定性(30%) + 持续专注力(25%) + 学习完成度(10%)\n\n`;
    md += `**评级标准**：\n`;
    md += `- 🏆 卓越（90-100分）：专注力极佳\n`;
    md += `- ⭐ 优秀（80-89分）：学习状态很好\n`;
    md += `- 👍 良好（70-79分）：有提升空间\n`;
    md += `- 📈 及格（60-69分）：建议改进专注度\n`;
    md += `- ⚠️ 需改进（<60分）：需要加强训练\n\n`;
    
    return md;
  }
  
  /**
   * 🆕 生成质量深度分析（HTML）- 复用QualityAnalyzer
   */
  _generateQualityAnalysisHTML(qualityResult, qualityAnalyzer) {
    const dims = qualityResult.dimensions;
    let html = `<div class="section quality-analysis">
      <h2>🎯 专注质量深度分析</h2>
      <div class="quality-note">
        💡 <strong>说明</strong>：专注质量评分由4个维度加权计算得出。
        <a href="#scoring-algorithm">查看评分算法</a>
      </div>
      
      <div class="quality-overall">
        <h3>📊 综合评分</h3>
        <div class="score-display" style="background: linear-gradient(135deg, ${qualityResult.rating.color}22 0%, ${qualityResult.rating.color}11 100%); border-left: 4px solid ${qualityResult.rating.color};">
          <div class="score-value" style="color: ${qualityResult.rating.color}; font-size: 48px; font-weight: bold;">
            ${qualityResult.totalScore}分
          </div>
          <div class="score-rating" style="font-size: 24px; margin: 10px 0;">
            ${qualityResult.rating.icon} ${qualityResult.rating.level}
          </div>
          <div class="score-message" style="color: #6b7280;">
            ${qualityResult.rating.message}
          </div>
        </div>
      </div>
      
      <div class="quality-dimensions">
        <h3>📈 四维度详细分析</h3>
        <div class="dimensions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">`;
    
    // 四个维度卡片
    const dimensionsList = [
      { key: 'timeEfficiency', icon: '⏰', name: '时间有效率', weight: '35%', formula: '有效学习时长 ÷ 总学习时长 × 100%' },
      { key: 'focusStability', icon: '🎯', name: '专注稳定性', weight: '30%', formula: '基于干扰密度（次/小时）衰减计算' },
      { key: 'continuousFocus', icon: '🔥', name: '持续专注力', weight: '25%', formula: '最长连续专注 ÷ 总时长 × 100%' },
      { key: 'completion', icon: '✅', name: '学习完成度', weight: '10%', formula: '基于学习时长评估' }
    ];
    
    dimensionsList.forEach(dim => {
      const data = dims[dim.key];
      const color = data.score >= 80 ? '#10b981' : data.score >= 60 ? '#f59e0b' : '#ef4444';
      
      html += `<div class="dimension-card" style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid ${color};">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
          ${dim.icon} ${dim.name}
        </div>
        <div style="color: ${color}; font-size: 32px; font-weight: bold; margin: 10px 0;">
          ${data.score.toFixed(1)}分
        </div>
        <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
          <span style="background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 4px; font-weight: 500;">
            ${data.level}
          </span>
          <span style="margin-left: 8px;">权重${dim.weight}</span>
        </div>
        <div style="margin: 12px 0; padding: 12px; background: #f9fafb; border-radius: 8px;">
          <div style="margin-bottom: 6px;"><strong>数值：</strong>${data.value}${data.unit}</div>
          <div style="margin-bottom: 6px;"><strong>说明：</strong>${data.description}</div>
          ${dim.key === 'focusStability' ? `<div style="font-size: 12px; color: #6b7280; margin-top: 6px;">干扰详情：暂停${data.details.pauseCount}次 | 退全屏${data.details.exitFullscreenCount}次 | 切标签${data.details.switchCount}次</div>` : ''}
        </div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
          📐 ${dim.formula}
        </div>`;
      
      if (data.score < 70) {
        const improvement = dim.key === 'timeEfficiency' ? '减少暂停时间，提前准备好学习资料'
          : dim.key === 'focusStability' ? '减少外界干扰，使用番茄钟保持专注'
          : dim.key === 'continuousFocus' ? '尝试番茄钟工作法（Ctrl+Shift+T）'
          : '设定明确目标，至少保证30分钟连续学习';
        html += `<div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px; font-size: 13px;">
          💡 <strong>改进建议：</strong>${improvement}
        </div>`;
      }
      
      html += `</div>`;
    });
    
    html += `</div></div>`;
    
    // 薄弱环节
    const weakPoints = qualityAnalyzer.analyzeWeakPoints(qualityResult);
    if (weakPoints.length > 0) {
      html += `<div class="weak-points">
        <h3>⚠️ 薄弱环节分析</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">`;
      weakPoints.forEach((weak, index) => {
        html += `<div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <div style="font-weight: bold; margin-bottom: 8px;">
            ${index + 1}. ${weak.dimension}：${weak.score.toFixed(1)}分（${weak.level}）
          </div>
          <div style="color: #6b7280;">${weak.description}</div>
        </div>`;
      });
      html += `</div></div>`;
    }
    
    // 改进建议
    const suggestions = qualityAnalyzer.generateSuggestions(qualityResult);
    if (suggestions.length > 0) {
      html += `<div class="suggestions">
        <h3>💡 针对性改进建议</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">`;
      suggestions.forEach(sug => {
        html += `<div style="background: white; padding: 18px; border-radius: 10px; border: 2px solid #e5e7eb;">
          <div style="font-size: 18px; margin-bottom: 8px;">${sug.icon}</div>
          <div style="font-weight: bold; margin-bottom: 10px; color: #1f2937;">${sug.title}</div>
          <div style="color: #6b7280; font-size: 14px; line-height: 1.6;">${sug.content}</div>
        </div>`;
      });
      html += `</div></div>`;
    }
    
    // 评分算法说明
    html += `<div class="scoring-algorithm" id="scoring-algorithm" style="background: #f9fafb; padding: 20px; border-radius: 12px; margin-top: 20px;">
      <h3>📖 评分算法说明</h3>
      <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 8px;">
        <strong>综合得分</strong> = 时间有效率(35%) + 专注稳定性(30%) + 持续专注力(25%) + 学习完成度(10%)
      </div>
      <div style="margin-top: 15px;">
        <strong>评级标准：</strong>
        <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
          <li>🏆 <strong>卓越（90-100分）</strong>：专注力极佳</li>
          <li>⭐ <strong>优秀（80-89分）</strong>：学习状态很好</li>
          <li>👍 <strong>良好（70-79分）</strong>：有提升空间</li>
          <li>📈 <strong>及格（60-69分）</strong>：建议改进专注度</li>
          <li>⚠️ <strong>需改进（<60分）</strong>：需要加强训练</li>
        </ul>
      </div>
    </div>
    </div>`;
    
    return html;
  }

  /**
   * 🆕 导出为CSV格式（迁移自export-manager.js，避免依赖旧代码）
   */
  exportToCSV(dailyData, videoIndex = null) {
    console.log('[导出核心] 生成CSV');
    
    const headers = [
      '日期', '总时长(分钟)', '有效时长(分钟)', '专注质量(%)',
      '暂停次数', '退出全屏', '标签切换', '学习视频数',
      '最长连续(分钟)', '学习视频列表'
    ];
    
    const rows = dailyData.map(day => {
      const totalMinutes = Math.floor(day.total / 60);
      const effectiveMinutes = Math.floor(day.effective / 60);
      const quality = day.total > 0 ? ((day.effective / day.total) * 100).toFixed(2) : '0.00';
      const longestMinutes = Math.floor((day.longestSession || 0) / 60);
      
      // 获取视频标题列表
      let videoTitles = '';
      if (day.videos && Object.keys(day.videos).length > 0 && videoIndex) {
        const titles = Object.keys(day.videos).map(bvid => {
          const videoData = videoIndex[bvid];
          return (videoData && videoData.title) ? videoData.title : bvid;
        });
        videoTitles = titles.join('; ');
      }
      
      return [
        day.date,
        totalMinutes,
        effectiveMinutes,
        quality,
        day.pauseCount || 0,
        day.exitCount || 0,
        day.switchCount || 0,
        day.videoCount || 0,
        longestMinutes,
        `"${videoTitles}"`
      ].join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }
  
  /**
   * 🆕 导出为JSON格式
   */
  exportToJSON(dailyData, videoIndex = null) {
    console.log('[导出核心] 生成JSON');
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      data: dailyData.map(day => ({
        date: day.date,
        total: day.total,
        effective: day.effective,
        quality: day.total > 0 ? (day.effective / day.total) * 100 : 0,
        pauseCount: day.pauseCount || 0,
        exitCount: day.exitCount || 0,
        switchCount: day.switchCount || 0,
        videoCount: day.videoCount || 0,
        longestSession: day.longestSession || 0,
        videos: day.videos || {}
      })),
      videoIndex: videoIndex || {}
    }, null, 2);
  }

  /**
   * 下载文件
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[导出核心] 文件已下载: ${filename}`);
  }
}

// 导出单例
window.exportCore = new ExportCore();

console.log('[导出核心] 模块加载完成');

