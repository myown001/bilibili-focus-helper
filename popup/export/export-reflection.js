// export-reflection.js - 反思分析引擎（基于规则，无需AI）

class ReflectionAnalyzer {
  /**
   * 分析单日行为并生成反思问题
   */
  analyzeDailyBehavior(dayData) {
    const reflections = [];
    const quality = dayData.total > 0 ? (dayData.effective / dayData.total) * 100 : 0;
    const videoCount = Object.keys(dayData.videos || {}).length;
    const videos = Object.values(dayData.videos || {}); // ✅ 统一在开头声明，避免重复声明
    
    // 1. 暂停次数分析
    if (dayData.pauseCount > 10) {
      reflections.push({
        type: 'warning',
        issue: '频繁暂停',
        data: `今天暂停了${dayData.pauseCount}次`,
        questions: [
          '是否因为视频内容难度太大，需要反复暂停思考？',
          '是否有外界干扰导致频繁暂停？可以考虑选择更安静的学习环境',
          '是否可以先快速浏览一遍，再精读重点部分？'
        ],
        suggestions: [
          '尝试使用"番茄钟"保持25分钟专注',
          '准备好笔记本，边看边记录疑问',
          '调整播放速度（0.75x/1.5x）以适应理解节奏'
        ]
      });
    } else if (dayData.pauseCount > 5) {
      reflections.push({
        type: 'notice',
        issue: '暂停较多',
        data: `今天暂停了${dayData.pauseCount}次`,
        questions: [
          '暂停的主要原因是什么？做笔记？思考？还是其他？',
          '这些暂停是否帮助你更好地理解内容？'
        ],
        suggestions: [
          '保持当前节奏，适度暂停有助于深度思考'
        ]
      });
    }
    
    // 2. 标签切换分析
    if (dayData.switchCount > 15) {
      reflections.push({
        type: 'warning',
        issue: '频繁切换标签',
        data: `今天切换了${dayData.switchCount}次标签`,
        questions: [
          '切换到其他标签在做什么？查资料？还是分心？',
          '是否可以提前准备好需要的资料，减少学习中的切换？',
          '是否有社交软件或娱乐网站的通知在干扰你？'
        ],
        suggestions: [
          '使用"专注模式"全屏学习，减少干扰',
          '关闭无关标签页和通知',
          '提前准备好学习资料，放在单独窗口'
        ]
      });
    } else if (dayData.switchCount > 5) {
      reflections.push({
        type: 'notice',
        issue: '标签切换',
        data: `今天切换了${dayData.switchCount}次标签`,
        questions: [
          '切换标签是为了查阅资料吗？',
          '可以考虑使用分屏或双显示器减少切换'
        ]
      });
    }
    
    // 3. 退出全屏分析
    if (dayData.exitCount > 8) {
      reflections.push({
        type: 'warning',
        issue: '频繁退出全屏',
        data: `今天退出全屏${dayData.exitCount}次`,
        questions: [
          '为什么频繁退出全屏？是否有紧急事务打断？',
          '可以设定固定的休息时间，而不是随时中断'
        ],
        suggestions: [
          '使用番茄钟：25分钟全屏学习 + 5分钟休息',
          '在学习前处理完其他事务',
          '告知他人你的学习时间，减少打扰'
        ]
      });
    }
    
    // 4. 专注质量分析
    if (quality < 50) {
      reflections.push({
        type: 'warning',
        issue: '专注质量较低',
        data: `专注质量仅${quality.toFixed(1)}%`,
        questions: [
          '今天学习时的状态如何？是否疲劳或注意力不集中？',
          '学习环境是否有太多干扰？',
          '是否选择了不适合当前时段的学习内容？'
        ],
        suggestions: [
          '调整学习时间到你的最佳状态时段（早上/下午/晚上）',
          '确保学习环境安静、舒适',
          '从简单内容开始，逐步进入学习状态',
          '保证充足睡眠，提高专注力'
        ]
      });
    } else if (quality < 70) {
      reflections.push({
        type: 'notice',
        issue: '专注质量有提升空间',
        data: `专注质量${quality.toFixed(1)}%`,
        questions: [
          '相比之前的学习，今天有什么不同？',
          '哪些因素影响了你的专注度？'
        ],
        suggestions: [
          '减少学习中的暂停和中断',
          '尝试深度工作法：长时间专注于单一任务'
        ]
      });
    }
    
    // 5. 视频时长分析
    const longVideos = videos.filter(v => v.d > 3600); // 超过1小时
    if (longVideos.length > 0) {
      const longestVideo = longVideos.reduce((max, v) => v.d > max.d ? v : max, longVideos[0]);
      const hours = (longestVideo.d / 3600).toFixed(1);
      
      reflections.push({
        type: 'notice',
        issue: '长时间观看单个视频',
        data: `最长视频观看了${hours}小时`,
        questions: [
          '长时间观看一个视频，是否感到疲劳？',
          '是否可以分段学习，每学习1小时休息10分钟？',
          '学习效果如何？后半段是否注意力下降？'
        ],
        suggestions: [
          '将长视频分段学习，每45-60分钟休息一次',
          '做好笔记，标记难点，便于复习',
          '适当调整播放速度，提高效率'
        ]
      });
    }
    
    // 6. 学习时长分析
    if (dayData.total < 1800) { // 少于30分钟
      reflections.push({
        type: 'notice',
        issue: '学习时长较短',
        data: `今天只学习了${formatTimeForExport(dayData.total)}`,
        questions: [
          '今天是否有特殊情况导致学习时间短？',
          '可以尝试每天固定学习时段，养成习惯'
        ],
        suggestions: [
          '设定每天最少学习时长目标（如30分钟）',
          '利用碎片时间积累学习时长'
        ]
      });
    } else if (dayData.total > 14400) { // 超过4小时
      reflections.push({
        type: 'notice',
        issue: '学习时长很长',
        data: `今天学习了${formatTimeForExport(dayData.total)}`,
        questions: [
          '长时间学习，是否感到疲劳？',
          '是否有充分的休息和放松？',
          '学习效率如何？是否后期注意力下降？'
        ],
        suggestions: [
          '注意劳逸结合，避免过度疲劳',
          '保证充足的休息和睡眠',
          '可以尝试番茄工作法：25分钟学习+5分钟休息'
        ]
      });
    }
    
    // 7. 🆕 多视频碎片化学习分析
    if (videoCount > 5) {
      const avgDuration = videos.reduce((sum, v) => sum + (v.d || 0), 0) / videos.length;
      
      if (avgDuration < 300) { // 平均每个视频少于5分钟
        reflections.push({
          type: 'warning',
          issue: '碎片化学习严重',
          data: `观看了${videoCount}个视频，平均每个仅${Math.floor(avgDuration / 60)}分钟`,
          questions: [
            '是否在寻找合适的学习内容而频繁切换视频？',
            '是否对学习主题缺乏明确规划？',
            '碎片化学习是否影响了知识的系统性掌握？'
          ],
          suggestions: [
            '先制定学习计划：明确今天要学什么',
            '选定视频后完整观看，不轻易更换',
            '优先选择系统性教程，而非零散知识点',
            '使用收藏功能标记优质视频，避免重复筛选'
          ]
        });
      }
    }
    
    // 8. 🆕 组合场景：高干扰+低质量
    const totalInterruptions = (dayData.pauseCount || 0) + 
                               (dayData.exitCount || 0) * 1.5 + 
                               (dayData.switchCount || 0) * 0.5;
    const interruptionDensity = dayData.total > 0 ? totalInterruptions / (dayData.total / 3600) : 0;
    
    if (interruptionDensity > 30 && quality < 50) {
      reflections.push({
        type: 'critical',
        issue: '严重分心状态',
        data: `干扰密度${interruptionDensity.toFixed(1)}次/小时，专注质量仅${quality.toFixed(1)}%`,
        questions: [
          '今天是否有特殊情况严重影响了学习？',
          '学习环境是否存在持续的干扰源（如社交软件、游戏、视频通知）？',
          '是否在学习和其他任务之间反复切换？',
          '是否因为拖延、焦虑等情绪问题无法专注？'
        ],
        suggestions: [
          '🚨 紧急建议：暂停学习，先处理干扰源',
          '关闭所有社交软件和娱乐网站',
          '启用系统"勿扰模式"，屏蔽所有通知',
          '更换学习环境（如图书馆、自习室）',
          '如果情绪不佳，先休息调整再学习',
          '考虑使用"Forest专注森林"等辅助工具'
        ]
      });
    }
    
    // 9. 🆕 长时间但低效率（假性学习）
    if (dayData.total > 7200 && quality < 40) { // 超过2小时但质量低于40%
      reflections.push({
        type: 'warning',
        issue: '长时间低效学习（假性学习）',
        data: `学习了${formatTimeForExport(dayData.total)}，但有效时间占比仅${quality.toFixed(1)}%`,
        questions: [
          '是否只是"挂着"视频，实际在做其他事情？',
          '是否因为疲劳导致后期注意力严重下降？',
          '是否选择了不适合自己水平的学习内容？',
          '学习过程中是否频繁走神或发呆？'
        ],
        suggestions: [
          '采用主动学习法：边学边做笔记、画思维导图',
          '定期自测：每15-20分钟暂停回顾学到了什么',
          '使用番茄钟：25分钟专注学习+5分钟休息',
          '如果内容太难，先学习基础知识再挑战',
          '如果内容太简单，提高播放速度或更换内容',
          '保证充足睡眠，避免疲劳学习'
        ]
      });
    }
    
    // 10. 🆕 深夜学习效率分析
    const hasLateNightStudy = videos.some(v => {
      if (v.st) {
        const hour = new Date(v.st).getHours();
        return hour >= 23 || hour < 6;
      }
      return false;
    });
    
    if (hasLateNightStudy && quality < 50) {
      reflections.push({
        type: 'notice',
        issue: '深夜学习效率低',
        data: `检测到深夜学习（23:00-6:00），专注质量${quality.toFixed(1)}%`,
        questions: [
          '是否感到疲劳和困倦影响了学习效果？',
          '白天的时间是否可以更好地利用？',
          '是否因为拖延导致深夜才开始学习？'
        ],
        suggestions: [
          '调整作息，在精力充沛时段学习（上午/下午）',
          '如果必须深夜学习，先休息20分钟再开始',
          '设定每天固定学习时间，避免拖延到深夜',
          '保证充足睡眠（7-8小时），提高白天效率'
        ]
      });
    }
    
    // 11. 🆕 单视频长时间学习
    if (videoCount === 1 && dayData.total > 3600) {
      const singleVideo = Object.values(dayData.videos || {})[0];
      const hours = (dayData.total / 3600).toFixed(1);
      
      if (quality >= 70) {
        reflections.push({
          type: 'positive',
          issue: '深度学习状态',
          data: `专注学习单个视频${hours}小时，专注质量${quality.toFixed(1)}%`,
          questions: [
            '今天的深度学习效果如何？',
            '是否完整掌握了视频内容？',
            '有什么经验可以在以后复制？'
          ],
          suggestions: [
            '保持这种深度学习的习惯',
            '做好学习笔记，便于后期复习',
            '可以尝试输出（写总结、做练习）巩固知识'
          ]
        });
      } else if (quality < 50) {
        reflections.push({
          type: 'warning',
          issue: '长时间学习但效果不佳',
          data: `观看单个视频${hours}小时，但专注质量仅${quality.toFixed(1)}%`,
          questions: [
            '视频内容是否过于冗长或枯燥？',
            '是否中途频繁走神或做其他事情？',
            '长时间学习后是否感到疲劳？'
          ],
          suggestions: [
            '将长视频分段学习，每45-60分钟休息一次',
            '尝试1.25x或1.5x播放速度，提高信息密度',
            '使用"跳进度条"快速浏览，再精读重点',
            '考虑更换更精简的学习资源'
          ]
        });
      }
    }
    
    // 12. 🆕 高质量短时学习（高效型）
    if (dayData.total >= 1800 && dayData.total <= 3600 && quality >= 85) {
      reflections.push({
        type: 'positive',
        issue: '高效学习典范',
        data: `在${formatTimeForExport(dayData.total)}内保持了${quality.toFixed(1)}%的专注质量`,
        questions: [
          '今天的学习效率很高！是什么因素促成的？',
          '学习时间、环境、内容选择有什么特别之处？'
        ],
        suggestions: [
          '记录今天的学习条件和状态，形成最佳实践',
          '保持这种高效学习习惯',
          '可以逐步延长高质量学习时长',
          '分享你的学习方法，帮助他人提高效率'
        ]
      });
    }
    
    // 13. 正面反馈（无问题时）
    if (reflections.length === 0) {
      reflections.push({
        type: 'positive',
        issue: '学习状态优秀',
        data: `专注质量${quality.toFixed(1)}%，各项指标良好`,
        questions: [
          '今天的学习状态很好！有什么经验可以分享？',
          '是否有特别的学习方法或技巧？'
        ],
        suggestions: [
          '保持当前的学习节奏和习惯',
          '可以尝试更有挑战性的学习内容',
          '记录今天的成功经验，形成最佳实践'
        ]
      });
    }
    
    return reflections;
  }
  
  /**
   * 分析周期行为趋势
   */
  analyzePeriodTrend(dailyDataList) {
    const insights = [];
    const studyDays = dailyDataList.filter(d => d.total > 0);
    
    if (studyDays.length === 0) {
      return [{
        type: 'warning',
        title: '本周期无学习记录',
        content: '尚未开始学习，建议制定学习计划并开始行动'
      }];
    }
    
    // 1. 学习频率分析
    const frequency = studyDays.length / dailyDataList.length;
    if (frequency < 0.3) {
      insights.push({
        type: 'warning',
        title: '学习频率偏低',
        content: `在${dailyDataList.length}天中只学习了${studyDays.length}天（${(frequency * 100).toFixed(0)}%）`,
        suggestion: '尝试每天至少学习30分钟，养成学习习惯'
      });
    } else if (frequency < 0.6) {
      insights.push({
        type: 'notice',
        title: '学习频率一般',
        content: `在${dailyDataList.length}天中学习了${studyDays.length}天（${(frequency * 100).toFixed(0)}%）`,
        suggestion: '可以适当提高学习频率，建议每周学习5天以上'
      });
    } else {
      insights.push({
        type: 'positive',
        title: '学习频率良好',
        content: `在${dailyDataList.length}天中学习了${studyDays.length}天（${(frequency * 100).toFixed(0)}%）`,
        suggestion: '保持良好的学习习惯'
      });
    }
    
    // 2. 专注质量趋势
    const qualities = studyDays.map(d => (d.effective / d.total) * 100);
    const avgQuality = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    
    // 计算趋势（最近3天 vs 前面3天）
    if (studyDays.length >= 6) {
      const recent = qualities.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const before = qualities.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const trend = recent - before;
      
      if (trend > 5) {
        insights.push({
          type: 'positive',
          title: '专注质量提升',
          content: `专注质量从${before.toFixed(1)}%提升到${recent.toFixed(1)}%`,
          suggestion: '总结最近的学习方法，继续保持'
        });
      } else if (trend < -5) {
        insights.push({
          type: 'warning',
          title: '专注质量下降',
          content: `专注质量从${before.toFixed(1)}%下降到${recent.toFixed(1)}%`,
          suggestion: '检查是否有外界干扰增加，或学习状态不佳'
        });
      }
    }
    
    // 3. 学习时长稳定性
    const durations = studyDays.map(d => d.total);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgDuration; // 变异系数
    
    if (cv > 0.5) {
      insights.push({
        type: 'notice',
        title: '学习时长波动较大',
        content: '每天学习时长不稳定',
        suggestion: '尝试设定固定的学习时段，保持学习节奏'
      });
    }
    
    return insights;
  }
  
  /**
   * 格式化为Markdown
   */
  toMarkdown(reflections) {
    if (!reflections || reflections.length === 0) return '';
    
    let md = `## 🤔 学习反思\n\n`;
    
    reflections.forEach((item, index) => {
      // 支持4种类型：critical（严重）、warning（警告）、notice（提醒）、positive（正面）
      const emoji = item.type === 'critical' ? '🚨'
        : item.type === 'warning' ? '⚠️' 
        : item.type === 'notice' ? '📌' 
        : '✅';
      
      md += `### ${emoji} ${item.issue}\n\n`;
      if (item.data) {
        md += `**数据**：${item.data}\n\n`;
      }
      
      if (item.questions && item.questions.length > 0) {
        md += `**反思问题**：\n`;
        item.questions.forEach(q => {
          md += `- ${q}\n`;
        });
        md += `\n`;
      }
      
      if (item.suggestions && item.suggestions.length > 0) {
        md += `**改进建议**：\n`;
        item.suggestions.forEach(s => {
          md += `- ${s}\n`;
        });
        md += `\n`;
      }
    });
    
    return md;
  }
  
  /**
   * 格式化为HTML
   */
  toHTML(reflections) {
    if (!reflections || reflections.length === 0) return '';
    
    let html = `<div class="reflection-section">
      <h2>🤔 学习反思</h2>`;
    
    reflections.forEach(item => {
      // 支持4种类型：critical（严重）、warning（警告）、notice（提醒）、positive（正面）
      const colorClass = item.type === 'critical' ? 'critical'
        : item.type === 'warning' ? 'warning' 
        : item.type === 'notice' ? 'notice' 
        : 'positive';
      
      html += `<div class="reflection-item ${colorClass}">
        <h3>${item.issue}</h3>`;
      
      if (item.data) {
        html += `<div class="reflection-data">${item.data}</div>`;
      }
      
      if (item.questions && item.questions.length > 0) {
        html += `<div class="reflection-questions">
          <strong>💭 反思问题：</strong>
          <ul>`;
        item.questions.forEach(q => {
          html += `<li>${q}</li>`;
        });
        html += `</ul></div>`;
      }
      
      if (item.suggestions && item.suggestions.length > 0) {
        html += `<div class="reflection-suggestions">
          <strong>💡 改进建议：</strong>
          <ul>`;
        item.suggestions.forEach(s => {
          html += `<li>${s}</li>`;
        });
        html += `</ul></div>`;
      }
      
      html += `</div>`;
    });
    
    html += `</div>`;
    
    return html;
  }
}

// 导出单例
window.reflectionAnalyzer = new ReflectionAnalyzer();

console.log('[反思分析器] 模块加载完成');

