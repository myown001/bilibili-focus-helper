// export-dialog.js - 导出对话框管理

class ExportDialog {
  /**
   * 显示报告类型选择对话框
   */
  async showReportTypeDialog() {
    const choice = prompt(
      '📊 请选择报告类型：\n\n' +
      '1 - 📅 今日详细报告\n' +
      '    完整学习时间线+视频清单+智能分析\n\n' +
      '2 - 📊 周报告（最近7天）\n' +
      '    每日概览+趋势分析+改进建议\n\n' +
      '3 - 📈 月报告（最近30天）\n' +
      '    月度汇总+质量评分+学习轨迹\n\n' +
      '4 - 📝 自定义日期报告\n' +
      '    指定某一天的详细学习记录\n\n' +
      '5 - 🔧 导出原始数据（CSV/JSON）\n' +
      '    完整的结构化数据\n\n' +
      '请输入数字 1-5:',
      '1'
    );
    
    if (!choice) return null;
    
    const num = parseInt(choice);
    if (num < 1 || num > 5) {
      alert('无效选择，请输入 1-5');
      return null;
    }
    
    const types = ['today', 'week', 'month', 'custom', 'raw'];
    return types[num - 1];
  }
  
  /**
   * 显示格式选择对话框
   */
  async showFormatDialog(reportType) {
    let formatOptions;
    
    if (reportType === 'raw') {
      // 原始数据只支持CSV和JSON
      formatOptions = 
        '📊 请选择导出格式：\n\n' +
        '1 - 📄 CSV (Excel友好)\n' +
        '2 - 🗂️ JSON (完整数据)\n\n' +
        '请输入数字 1-2:';
      
      const choice = prompt(formatOptions, '1');
      if (!choice) return null;
      
      const num = parseInt(choice);
      if (num === 1) return 'csv';
      if (num === 2) return 'json';
      
      alert('无效选择');
      return null;
    } else {
      // 报告类型支持Markdown、HTML和图片
      formatOptions = 
        '📊 请选择导出格式：\n\n' +
        '1 - 📝 Markdown (.md)\n' +
        '    文本报告，可用编辑器打开\n\n' +
        '2 - 🌐 HTML网页 (.html)\n' +
        '    可视化报告，在浏览器中查看\n\n' +
        '3 - 🖼️ 图片 (.png)\n' +
        '    高清图片格式，方便分享\n\n' +
        '请输入数字 1-3:';
      
      const choice = prompt(formatOptions, '1');
      if (!choice) return null;
      
      const num = parseInt(choice);
      if (num === 1) return 'markdown';
      if (num === 2) return 'html';
      if (num === 3) return 'image';
      
      alert('无效选择，请输入 1-3');
      return null;
    }
  }
  
  /**
   * 显示日期选择对话框
   */
  async showDateDialog() {
    const today = formatDateForExport(new Date());
    const choice = prompt(
      '📅 请输入日期（格式：YYYY-MM-DD）\n\n' +
      '留空则使用今天\n\n' +
      `今天是：${today}`,
      today
    );
    
    if (choice === null) return null; // 用户取消
    if (!choice || choice === today) return today;
    
    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(choice)) {
      alert('日期格式错误，请使用 YYYY-MM-DD 格式');
      return null;
    }
    
    // 验证日期是否有效
    const date = new Date(choice);
    if (isNaN(date.getTime())) {
      alert('无效的日期');
      return null;
    }
    
    return choice;
  }
}

// 导出单例
window.exportDialog = new ExportDialog();

console.log('[导出对话框] 模块加载完成');

