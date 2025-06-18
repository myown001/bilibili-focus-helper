// 简化版Chart.js库，用于B站学习助手插件

class Chart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.type = config.type;
    this.data = config.data;
    this.options = config.options;
    this.render();
  }

  // 渲染图表
  render() {
    const canvas = this.ctx.canvas;
    const ctx = this.ctx;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 根据图表类型渲染
    if (this.type === 'bar') {
      this.renderBarChart();
    } else if (this.type === 'line') {
      this.renderLineChart();
    }
    
    // 渲染图例
    this.renderLegend();
  }
  
  // 渲染柱状图
  renderBarChart() {
    const ctx = this.ctx;
    const data = this.data;
    const options = this.options;
    const canvas = ctx.canvas;
    
    const datasets = data.datasets;
    const labels = data.labels;
    
    // 计算图表区域
    const chartArea = {
      left: 40,
      top: 20,
      right: canvas.width - 20,
      bottom: canvas.height - 40
    };
    
    // 计算柱子宽度和间距
    const barCount = labels.length;
    const barWidth = (chartArea.right - chartArea.left) / barCount / datasets.length * 0.8;
    const barSpacing = barWidth * 0.2;
    
    // 找出最大值，用于计算比例
    let maxValue = 0;
    for (const dataset of datasets) {
      if (dataset.type !== 'line') {
        const dataMax = Math.max(...dataset.data);
        maxValue = Math.max(maxValue, dataMax);
      }
    }
    
    // 绘制坐标轴
    ctx.beginPath();
    ctx.moveTo(chartArea.left, chartArea.top);
    ctx.lineTo(chartArea.left, chartArea.bottom);
    ctx.lineTo(chartArea.right, chartArea.bottom);
    ctx.strokeStyle = '#ccc';
    ctx.stroke();
    
    // 绘制柱状图
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      if (dataset.type === 'line') continue;
      
      for (let j = 0; j < dataset.data.length; j++) {
        const value = dataset.data[j];
        const x = chartArea.left + (j + 0.5) * ((chartArea.right - chartArea.left) / barCount) - (barWidth * datasets.length) / 2 + i * barWidth;
        const height = (value / maxValue) * (chartArea.bottom - chartArea.top);
        const y = chartArea.bottom - height;
        
        ctx.fillStyle = dataset.backgroundColor;
        ctx.fillRect(x, y, barWidth, height);
        
        // 绘制数值
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(value, x + barWidth / 2, y - 5);
      }
    }
    
    // 绘制X轴标签
    for (let i = 0; i < labels.length; i++) {
      const x = chartArea.left + (i + 0.5) * ((chartArea.right - chartArea.left) / barCount);
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, chartArea.bottom + 15);
    }
  }
  
  // 渲染折线图
  renderLineChart() {
    const ctx = this.ctx;
    const data = this.data;
    const options = this.options;
    const canvas = ctx.canvas;
    
    const datasets = data.datasets;
    const labels = data.labels;
    
    // 计算图表区域
    const chartArea = {
      left: 40,
      top: 20,
      right: canvas.width - 20,
      bottom: canvas.height - 40
    };
    
    // 找出最大值，用于计算比例
    let maxValue = 0;
    for (const dataset of datasets) {
      const dataMax = Math.max(...dataset.data);
      maxValue = Math.max(maxValue, dataMax);
    }
    
    // 绘制坐标轴
    ctx.beginPath();
    ctx.moveTo(chartArea.left, chartArea.top);
    ctx.lineTo(chartArea.left, chartArea.bottom);
    ctx.lineTo(chartArea.right, chartArea.bottom);
    ctx.strokeStyle = '#ccc';
    ctx.stroke();
    
    // 绘制折线图
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      
      ctx.beginPath();
      for (let j = 0; j < dataset.data.length; j++) {
        const value = dataset.data[j];
        const x = chartArea.left + (j + 0.5) * ((chartArea.right - chartArea.left) / labels.length);
        const y = chartArea.bottom - (value / maxValue) * (chartArea.bottom - chartArea.top);
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.strokeStyle = dataset.borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // 绘制数据点
      for (let j = 0; j < dataset.data.length; j++) {
        const value = dataset.data[j];
        const x = chartArea.left + (j + 0.5) * ((chartArea.right - chartArea.left) / labels.length);
        const y = chartArea.bottom - (value / maxValue) * (chartArea.bottom - chartArea.top);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = dataset.borderColor;
        ctx.fill();
      }
    }
    
    // 绘制X轴标签
    for (let i = 0; i < labels.length; i++) {
      const x = chartArea.left + (i + 0.5) * ((chartArea.right - chartArea.left) / labels.length);
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, chartArea.bottom + 15);
    }
  }
  
  // 渲染图例
  renderLegend() {
    const ctx = this.ctx;
    const data = this.data;
    const canvas = ctx.canvas;
    
    const datasets = data.datasets;
    
    let legendX = 20;
    const legendY = 15;
    
    for (let i = 0; i < datasets.length; i++) {
      const dataset = datasets[i];
      
      // 绘制图例颜色块
      ctx.fillStyle = dataset.backgroundColor || dataset.borderColor;
      ctx.fillRect(legendX, legendY - 8, 12, 8);
      
      // 绘制图例文字
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(dataset.label, legendX + 16, legendY);
      
      legendX += ctx.measureText(dataset.label).width + 30;
    }
  }
  
  // 销毁图表
  destroy() {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.data = null;
    this.options = null;
    this.config = null;
  }
}

// 导出Chart类
window.Chart = Chart;