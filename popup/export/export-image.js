// export-image.js - 图片导出模块

class ImageExporter {
  constructor() {
    console.log('[图片导出器] 初始化');
  }
  
  /**
   * 将HTML内容转换为PNG图片
   * @param {string} htmlContent - HTML内容
   * @param {string} filename - 文件名
   */
  async htmlToImage(htmlContent, filename) {
    try {
      console.log('[图片导出器] 开始转换HTML为图片');
      
      // 1. 验证html2canvas已加载
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas库未加载');
      }
      
      // 2. 创建临时iframe（不可见）
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '1200px'; // 固定宽度
      iframe.style.minHeight = '100vh';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      // 3. 写入HTML内容
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      // 4. 等待所有资源加载（包括样式、字体等）
      await new Promise(resolve => {
        if (iframeDoc.readyState === 'complete') {
          resolve();
        } else {
          iframe.onload = resolve;
        }
      });
      
      // 额外等待，确保渲染完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[图片导出器] HTML加载完成，开始截图');
      
      // 5. 使用html2canvas截图
      const body = iframeDoc.body;
      const canvas = await html2canvas(body, {
        backgroundColor: '#ffffff',
        scale: 2, // 2倍清晰度
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: 1200,
        windowWidth: 1200
      });
      
      console.log('[图片导出器] 截图完成，开始下载');
      
      // 6. 转换为blob并下载
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        // 清理
        URL.revokeObjectURL(url);
        document.body.removeChild(iframe);
        
        console.log('[图片导出器] 图片下载完成');
      }, 'image/png', 0.95);
      
    } catch (err) {
      console.error('[图片导出器] 转换失败:', err);
      
      // 清理iframe（如果存在）
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.style.left === '-9999px') {
          document.body.removeChild(iframe);
        }
      });
      
      throw err;
    }
  }
}

// 导出单例
window.imageExporter = new ImageExporter();

console.log('[图片导出器] 模块加载完成');

