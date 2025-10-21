// quality-analyzer.js - 专注质量分析器
// 基于学习数据计算专注质量评分

class QualityAnalyzer {
  constructor() {
    this.weights = {
      timeEfficiency: 0.35,    // 时间有效率
      focusStability: 0.30,    // 专注稳定性
      continuousFocus: 0.25,   // 持续专注力
      completion: 0.10         // 学习完成度
    };
  }

  /**
   * 计算综合质量分数
   * @param {Object} data - 学习数据
   * @returns {Object} 评分结果
   */
  calculateQualityScore(data) {
    if (!data || data.totalTime === 0) {
      return this.getEmptyResult();
    }

    // 计算各维度得分
    const timeEfficiency = this.calculateTimeEfficiency(data);
    const focusStability = this.calculateFocusStability(data);
    const continuousFocus = this.calculateContinuousFocus(data);
    const completion = this.calculateCompletion(data);

    // 加权总分
    const totalScore = 
      timeEfficiency.score * this.weights.timeEfficiency +
      focusStability.score * this.weights.focusStability +
      continuousFocus.score * this.weights.continuousFocus +
      completion.score * this.weights.completion;

    return {
      totalScore: Math.round(totalScore * 10) / 10,
      rating: this.getRating(totalScore),
      dimensions: {
        timeEfficiency,
        focusStability,
        continuousFocus,
        completion
      },
      rawData: data
    };
  }

  /**
   * 1. 计算时间有效率得分 (35%权重)
   */
  calculateTimeEfficiency(data) {
    const { effectiveTime, totalTime } = data;
    const efficiency = (effectiveTime / totalTime) * 100;

    let score;
    let level;
    
    if (efficiency >= 90) {
      score = 100;
      level = '极优';
    } else if (efficiency >= 80) {
      score = 90;
      level = '优秀';
    } else if (efficiency >= 70) {
      score = 80;
      level = '良好';
    } else if (efficiency >= 60) {
      score = 70;
      level = '及格';
    } else if (efficiency >= 50) {
      score = 60;
      level = '一般';
    } else {
      score = Math.max(0, efficiency);
      level = '需改进';
    }

    return {
      name: '时间有效率',
      score,
      level,
      value: Math.round(efficiency),
      unit: '%',
      description: `有效学习时间占比${Math.round(efficiency)}%`
    };
  }

  /**
   * 2. 计算专注稳定性得分 (30%权重)
   */
  calculateFocusStability(data) {
    const { pauseCount = 0, exitFullscreenCount = 0, switchCount = 0, totalTime } = data;
    
    // 计算加权干扰次数
    const totalInterruptions = 
      pauseCount + 
      exitFullscreenCount * 1.5 + 
      switchCount * 0.5;
    
    // 计算每小时干扰密度
    const interruptionDensity = totalInterruptions / (totalTime / 3600);
    
    // 根据干扰密度选择衰减系数
    let decayFactor;
    if (interruptionDensity <= 5) {
      decayFactor = 1;
    } else if (interruptionDensity <= 10) {
      decayFactor = 1.5;
    } else if (interruptionDensity <= 20) {
      decayFactor = 2;
    } else {
      decayFactor = 3;
    }
    
    // 计算稳定性分数
    const stabilityScore = Math.max(0, 100 - (interruptionDensity * decayFactor));
    
    let level;
    if (stabilityScore >= 85) {
      level = '极优';
    } else if (stabilityScore >= 70) {
      level = '优秀';
    } else if (stabilityScore >= 55) {
      level = '良好';
    } else if (stabilityScore >= 40) {
      level = '及格';
    } else {
      level = '需改进';
    }

    return {
      name: '专注稳定性',
      score: stabilityScore,
      level,
      value: Math.round(interruptionDensity * 10) / 10,
      unit: '次/小时',
      description: `平均每小时干扰${Math.round(interruptionDensity)}次`,
      details: {
        pauseCount,
        exitFullscreenCount,
        switchCount,
        totalInterruptions: Math.round(totalInterruptions)
      }
    };
  }

  /**
   * 3. 计算持续专注力得分 (25%权重)
   */
  calculateContinuousFocus(data) {
    const { longestSession = 0, totalTime } = data;
    const continuousRatio = (longestSession / totalTime) * 100;
    
    let score;
    let level;
    
    if (continuousRatio >= 50) {
      score = 100;
      level = '优秀';
    } else if (continuousRatio >= 40) {
      score = 85;
      level = '良好';
    } else if (continuousRatio >= 30) {
      score = 70;
      level = '及格';
    } else if (continuousRatio >= 20) {
      score = 55;
      level = '一般';
    } else {
      score = 40;
      level = '需改进';
    }

    return {
      name: '持续专注力',
      score,
      level,
      value: Math.round(continuousRatio),
      unit: '%',
      description: `最长连续专注${this.formatTime(longestSession)}`,
      longestSessionTime: longestSession
    };
  }

  /**
   * 4. 计算学习完成度得分 (10%权重)
   */
  calculateCompletion(data) {
    // 目前基于总时长的简单评估
    // 未来可以基于视频播放进度
    const { totalTime } = data;
    
    let score;
    let level;
    
    // 基于学习时长的完成度评估
    if (totalTime >= 3600) { // 1小时以上
      score = 100;
      level = '完整';
    } else if (totalTime >= 2700) { // 45分钟以上
      score = 90;
      level = '优秀';
    } else if (totalTime >= 1800) { // 30分钟以上
      score = 75;
      level = '良好';
    } else if (totalTime >= 900) { // 15分钟以上
      score = 60;
      level = '及格';
    } else {
      score = 40;
      level = '较短';
    }

    return {
      name: '学习完成度',
      score,
      level,
      value: Math.round(totalTime / 60),
      unit: '分钟',
      description: `学习时长${this.formatTime(totalTime)}`
    };
  }

  /**
   * 获取评级
   */
  getRating(score) {
    if (score >= 90) {
      return {
        level: '卓越',
        stars: 5,
        color: '#3b82f6', // 深蓝
        icon: '⭐⭐⭐⭐⭐',
        message: '专注力极佳，保持下去！'
      };
    } else if (score >= 80) {
      return {
        level: '优秀',
        stars: 4,
        color: '#0ea5e9', // 蓝色
        icon: '⭐⭐⭐⭐',
        message: '学习状态很好，继续努力！'
      };
    } else if (score >= 70) {
      return {
        level: '良好',
        stars: 3,
        color: '#10b981', // 绿色
        icon: '⭐⭐⭐',
        message: '不错的表现，还有提升空间。'
      };
    } else if (score >= 60) {
      return {
        level: '及格',
        stars: 2,
        color: '#f59e0b', // 黄色
        icon: '⭐⭐',
        message: '基本达标，建议改进专注度。'
      };
    } else if (score >= 50) {
      return {
        level: '一般',
        stars: 1,
        color: '#f97316', // 橙色
        icon: '⭐',
        message: '专注度不足，需要加强训练。'
      };
    } else {
      return {
        level: '需改进',
        stars: 0,
        color: '#ef4444', // 红色
        icon: '⚠️',
        message: '学习效率较低，建议使用番茄钟。'
      };
    }
  }

  /**
   * 分析薄弱环节
   */
  analyzeWeakPoints(result) {
    const weakPoints = [];
    const { dimensions } = result;

    // 检查各维度是否低于70分
    Object.values(dimensions).forEach(dim => {
      if (dim.score < 70) {
        weakPoints.push({
          dimension: dim.name,
          score: dim.score,
          level: dim.level,
          description: dim.description
        });
      }
    });

    return weakPoints.sort((a, b) => a.score - b.score);
  }

  /**
   * 生成改进建议
   */
  generateSuggestions(result) {
    const suggestions = [];
    const { dimensions } = result;

    // 时间有效率建议
    if (dimensions.timeEfficiency.score < 70) {
      suggestions.push({
        type: 'timeEfficiency',
        icon: '⏰',
        title: '提升时间利用率',
        content: '减少视频暂停时间，保持连续观看。建议提前准备好笔记本和笔。'
      });
    }

    // 专注稳定性建议
    if (dimensions.focusStability.score < 70) {
      const { details } = dimensions.focusStability;
      
      if (details.switchCount > 10) {
        suggestions.push({
          type: 'focusStability',
          icon: '🚫',
          title: '减少标签切换',
          content: `检测到频繁切换标签(${details.switchCount}次)。建议关闭无关标签页，专注当前学习内容。`
        });
      }
      
      if (details.exitFullscreenCount > 3) {
        suggestions.push({
          type: 'focusStability',
          icon: '🖥️',
          title: '保持全屏学习',
          content: `退出全屏${details.exitFullscreenCount}次。建议使用全屏模式沉浸式学习，减少干扰。`
        });
      }
      
      if (details.pauseCount > 8) {
        suggestions.push({
          type: 'focusStability',
          icon: '▶️',
          title: '减少暂停次数',
          content: `暂停${details.pauseCount}次。如需记笔记，建议课后整理，或使用0.75x慢速播放。`
        });
      }
    }

    // 持续专注力建议
    if (dimensions.continuousFocus.score < 70) {
      suggestions.push({
        type: 'continuousFocus',
        icon: '🍅',
        title: '尝试番茄钟工作法',
        content: '最长连续专注时间较短。建议使用番茄钟(Ctrl+Shift+T)，25分钟专注 + 5分钟休息。'
      });
    }

    // 学习完成度建议
    if (dimensions.completion.score < 70) {
      suggestions.push({
        type: 'completion',
        icon: '🎯',
        title: '延长学习时长',
        content: '学习时长较短。建议设定明确目标，至少保证30分钟连续学习。'
      });
    }

    return suggestions;
  }

  /**
   * 空结果
   */
  getEmptyResult() {
    return {
      totalScore: 0,
      rating: {
        level: '暂无数据',
        stars: 0,
        color: '#9ca3af',
        icon: '📊',
        message: '开始学习后即可查看质量评分'
      },
      dimensions: {},
      rawData: {}
    };
  }

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QualityAnalyzer;
}

