// export-system.js - 导出系统主入口

class ExportSystem {
  constructor() {
    console.log('[导出系统] 初始化');
  }
  
  /**
   * 处理导出流程
   */
  async handleExport() {
    try {
      // 步骤1：选择报告类型
      const reportType = await window.exportDialog.showReportTypeDialog();
      if (!reportType) {
        console.log('[导出系统] 用户取消');
        return;
      }
      
      console.log('[导出系统] 选择报告类型:', reportType);
      
      // 步骤2：选择导出格式
      const format = await window.exportDialog.showFormatDialog(reportType);
      if (!format) {
        console.log('[导出系统] 用户取消');
        return;
      }
      
      console.log('[导出系统] 选择格式:', format);
      
      // 步骤3：根据类型获取数据和生成报告
      let content, filename, mimeType;
      const dateStr = formatDateForExport(new Date());
      
      if (reportType === 'today') {
        // 今日详细报告
        await this.exportTodayReport(format, dateStr);
        
      } else if (reportType === 'custom') {
        // 自定义日期报告
        const date = await window.exportDialog.showDateDialog();
        if (!date) return;
        await this.exportCustomDateReport(date, format);
        
      } else if (reportType === 'week') {
        // 周报告
        await this.exportPeriodReport(7, '最近7天', format, dateStr);
        
      } else if (reportType === 'month') {
        // 月报告
        await this.exportPeriodReport(30, '最近30天', format, dateStr);
        
      } else if (reportType === 'raw') {
        // 原始数据
        await this.exportRawData(format, dateStr);
      }
      
      console.log('[导出系统] 导出完成');
      
    } catch (err) {
      console.error('[导出系统] 导出失败:', err);
      alert('导出失败: ' + err.message);
    }
  }
  
  /**
   * 导出今日报告
   */
  async exportTodayReport(format, dateStr) {
    const today = formatDateForExport(new Date());
    const dailyData = await loadStudyData([today]);
    const dayData = dailyData[0];
    
    if (!dayData || dayData.total === 0) {
      alert('今日暂无学习数据');
      return;
    }
    
    // 获取视频索引
    const result = await chrome.storage.local.get(['index_videos']);
    const videoIndex = result.index_videos || {};
    
    // 获取番茄钟数据
    const pomodoroData = await loadPomodoroData(today);
    
    let content, filename, mimeType;
    
    if (format === 'markdown') {
      content = window.exportCore.generateTodayReportMD(dayData, videoIndex, pomodoroData);
      filename = `bilibili-study-today-${dateStr}.md`;
      mimeType = 'text/markdown;charset=utf-8;';
      window.exportCore.downloadFile(content, filename, mimeType);
    } else if (format === 'html') {
      content = window.exportCore.generateTodayReportHTML(dayData, videoIndex, pomodoroData);
      filename = `bilibili-study-today-${dateStr}.html`;
      mimeType = 'text/html;charset=utf-8;';
      window.exportCore.downloadFile(content, filename, mimeType);
    } else if (format === 'image') {
      // 图片格式：先生成HTML，再转换为图片
      const htmlContent = window.exportCore.generateTodayReportHTML(dayData, videoIndex, pomodoroData);
      filename = `bilibili-study-today-${dateStr}.png`;
      await window.imageExporter.htmlToImage(htmlContent, filename);
    }
  }
  
  /**
   * 导出自定义日期报告
   */
  async exportCustomDateReport(date, format) {
    const dailyData = await loadStudyData([date]);
    const dayData = dailyData[0];
    
    if (!dayData || dayData.total === 0) {
      alert(`${date} 没有学习数据`);
      return;
    }
    
    const result = await chrome.storage.local.get(['index_videos']);
    const videoIndex = result.index_videos || {};
    
    // 获取番茄钟数据
    const pomodoroData = await loadPomodoroData(date);
    
    let content, filename, mimeType;
    
    if (format === 'markdown') {
      content = window.exportCore.generateTodayReportMD(dayData, videoIndex, pomodoroData);
      filename = `bilibili-study-${date}.md`;
      mimeType = 'text/markdown;charset=utf-8;';
      window.exportCore.downloadFile(content, filename, mimeType);
    } else if (format === 'html') {
      content = window.exportCore.generateTodayReportHTML(dayData, videoIndex, pomodoroData);
      filename = `bilibili-study-${date}.html`;
      mimeType = 'text/html;charset=utf-8;';
      window.exportCore.downloadFile(content, filename, mimeType);
    } else if (format === 'image') {
      // 图片格式：先生成HTML，再转换为图片
      const htmlContent = window.exportCore.generateTodayReportHTML(dayData, videoIndex, pomodoroData);
      filename = `bilibili-study-${date}.png`;
      await window.imageExporter.htmlToImage(htmlContent, filename);
    }
  }
  
  /**
   * 导出周期报告
   */
  async exportPeriodReport(days, periodName, format, dateStr) {
    const dates = getDateRange(days);
    const dailyDataList = await loadStudyData(dates);
    
    let content, filename, mimeType;
    
    if (format === 'markdown') {
      content = window.exportCore.generatePeriodReport(dailyDataList, periodName, 'markdown');
      filename = `bilibili-study-${periodName}-${dateStr}.md`;
      mimeType = 'text/markdown;charset=utf-8;';
      window.exportCore.downloadFile(content, filename, mimeType);
    } else if (format === 'html') {
      content = window.exportCore.generatePeriodReport(dailyDataList, periodName, 'html');
      filename = `bilibili-study-${periodName}-${dateStr}.html`;
      mimeType = 'text/html;charset=utf-8;';
      window.exportCore.downloadFile(content, filename, mimeType);
    } else if (format === 'image') {
      // 图片格式：先生成HTML，再转换为图片
      const htmlContent = window.exportCore.generatePeriodReport(dailyDataList, periodName, 'html');
      filename = `bilibili-study-${periodName}-${dateStr}.png`;
      await window.imageExporter.htmlToImage(htmlContent, filename);
    }
  }
  
  /**
   * 导出原始数据
   */
  async exportRawData(format, dateStr) {
    let content, filename, mimeType;
    
    if (format === 'csv') {
      // 🆕 使用exportCore的CSV功能
      const dates = getDateRange(30); // 默认导出30天
      const dailyData = await loadStudyData(dates);
      const result = await chrome.storage.local.get(['index_videos']);
      const videoIndex = result.index_videos || {};
      
      content = window.exportCore.exportToCSV(dailyData, videoIndex);
      filename = `bilibili-study-data-${dateStr}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
      
    } else if (format === 'json') {
      // 🆕 使用exportCore的JSON功能
      const dates = getDateRange(30); // 默认导出30天
      const dailyData = await loadStudyData(dates);
      const result = await chrome.storage.local.get(['index_videos']);
      const videoIndex = result.index_videos || {};
      
      content = window.exportCore.exportToJSON(dailyData, videoIndex);
      filename = `bilibili-study-data-${dateStr}.json`;
      mimeType = 'application/json;charset=utf-8;';
    }
    
    window.exportCore.downloadFile(content, filename, mimeType);
  }
}

// 导出单例
window.exportSystem = new ExportSystem();

console.log('[导出系统] 模块加载完成');

