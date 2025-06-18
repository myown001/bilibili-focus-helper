// collection-sidebar.js - 实现视频合集侧边栏功能

/**
 * 视频合集侧边栏类
 * 在专注模式下提供可折叠的视频选集导航
 */
class CollectionSidebar {
  constructor() {
    this.sidebar = null;
    this.toggleBtn = null;
    this.visible = false;
    this.initialized = false;
    
    // 绑定方法
    this.toggle = this.toggle.bind(this);
    this.loadEpisodes = this.loadEpisodes.bind(this);
  }
  
  /**
   * 初始化侧边栏
   * @returns {boolean} 是否成功初始化
   */
  init() {
    // 检查是否已经初始化
    if (this.initialized) return true;
    
    // 检查是否在合集/系列视频中
    if (!this.isInCollection()) return false;
    
    // 添加样式
    this.addStyles();
    
    // 创建侧边栏
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'focus-collection-sidebar collapsed';
    document.body.appendChild(this.sidebar);
    
    // 添加切换按钮
    this.toggleBtn = document.createElement('div');
    this.toggleBtn.className = 'sidebar-toggle collapsed';
    this.toggleBtn.innerHTML = '&lt;';
    this.toggleBtn.addEventListener('click', this.toggle);
    document.body.appendChild(this.toggleBtn);
    
    // 加载合集信息并填充侧边栏
    this.loadEpisodes();
    
    this.initialized = true;
    return true;
  }
  
  /**
   * 添加侧边栏所需的样式
   */
  addStyles() {
    const styleId = 'collection-sidebar-styles';
    let styleEl = document.getElementById(styleId);
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        .focus-collection-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          width: 280px;
          height: 100vh;
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
          z-index: 999999;
          transition: transform 0.3s ease;
          overflow-y: auto;
          padding: 15px 0;
          backdrop-filter: blur(5px);
          box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2);
        }
        
        .focus-collection-sidebar.collapsed {
          transform: translateX(280px);
        }
        
        .sidebar-toggle {
          position: fixed;
          top: 50%;
          right: 280px;
          transform: translateY(-50%);
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
          width: 20px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 999999;
          border-radius: 4px 0 0 4px;
          transition: right 0.3s ease;
        }
        
        .sidebar-toggle.collapsed {
          right: 0;
        }
        
        .sidebar-toggle:hover {
          background: rgba(36, 148, 204, 0.85);
        }
        
        .sidebar-title {
          font-size: 16px;
          font-weight: bold;
          padding: 10px 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 10px;
        }
        
        .episode-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .episode-item {
          padding: 10px 15px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
        }
        
        .episode-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .episode-item.current {
          background: rgba(36, 148, 204, 0.5);
          position: relative;
        }
        
        .episode-item.current::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #00a1d6;
        }
        
        .episode-index {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          margin-right: 10px;
          font-size: 12px;
        }
        
        .episode-title {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }
  
  /**
   * 切换侧边栏显示/隐藏状态
   */
  toggle() {
    if (!this.sidebar || !this.toggleBtn) return;
    
    if (this.visible) {
      this.sidebar.classList.add('collapsed');
      this.toggleBtn.classList.add('collapsed');
      this.toggleBtn.innerHTML = '&lt;';
    } else {
      this.sidebar.classList.remove('collapsed');
      this.toggleBtn.classList.remove('collapsed');
      this.toggleBtn.innerHTML = '&gt;';
    }
    
    this.visible = !this.visible;
  }
  
  /**
   * 检查当前页面是否为视频合集/系列
   * @returns {boolean} 是否在合集中
   */
  isInCollection() {
    // 检查URL是否包含合集信息
    const isInBangumi = window.location.pathname.includes('/bangumi/play/');
    
    // 检查页面中是否有合集元素
    const hasCollectionElements = Boolean(
      document.querySelector('.video-section-list, .multi-page, .part-wrap, .video-episode-card, .up-recommend-item, .video-section-list, .ep-list')
    );
    
    return isInBangumi || hasCollectionElements;
  }
  
  /**
   * 从URL中提取视频ID
   * @param {string} url - 视频URL
   * @returns {string} 视频ID
   */
  extractVideoId(url) {
    if (!url) return '';
    
    // 匹配BV号
    const bvMatch = url.match(/\/video\/([A-Za-z0-9]+)/);
    if (bvMatch && bvMatch[1]) return bvMatch[1];
    
    // 匹配番剧EP号
    const epMatch = url.match(/\/bangumi\/play\/ep(\d+)/);
    if (epMatch && epMatch[1]) return `ep${epMatch[1]}`;
    
    // 匹配番剧SS号
    const ssMatch = url.match(/\/bangumi\/play\/ss(\d+)/);
    if (ssMatch && ssMatch[1]) return `ss${ssMatch[1]}`;
    
    return '';
  }
  
  /**
   * 加载合集视频列表
   */
  loadEpisodes() {
    // 设置标题
    const titleElement = document.createElement('div');
    titleElement.className = 'sidebar-title';
    titleElement.textContent = '视频合集';
    this.sidebar.appendChild(titleElement);
    
    // 创建集数列表容器
    const episodeList = document.createElement('ul');
    episodeList.className = 'episode-list';
    this.sidebar.appendChild(episodeList);
    
    try {
      // 尝试不同的选择器以适应不同类型的合集
      let episodeItems;
      
      // 番剧页面
      if (window.location.pathname.includes('/bangumi/play/')) {
        episodeItems = document.querySelectorAll('.ep-list .ep-item');
      } 
      // 视频合集页面
      else if (document.querySelector('.video-section-list')) {
        episodeItems = document.querySelectorAll('.video-section-list .video-episode-card');
      }
      // 多P视频
      else if (document.querySelector('.multi-page')) {
        episodeItems = document.querySelectorAll('.multi-page .list-box .item');
      }
      // 其他分集视频
      else {
        episodeItems = document.querySelectorAll('.part-wrap .video-item, .up-recommend-item, .video-page-operator-block-list');
      }
      
      if (!episodeItems || episodeItems.length === 0) {
        episodeList.innerHTML = '<div style="padding: 15px; color: #999;">未找到合集视频</div>';
        return;
      }
      
      // 提取当前视频URL或ID以标识当前播放项
      const currentUrl = window.location.href;
      const currentId = this.extractVideoId(currentUrl);
      
      // 遍历并添加每个集数
      episodeItems.forEach((item, index) => {
        const episodeItem = document.createElement('li');
        episodeItem.className = 'episode-item';
        
        // 提取集数链接和标题
        const link = item.querySelector('a') || item;
        const href = link.href || link.getAttribute('href');
        
        // 尝试获取标题
        let title = `第${index + 1}集`;
        const titleElement = item.querySelector('.title, .name');
        if (titleElement) {
          title = titleElement.textContent.trim();
        }
        
        // 检查是否是当前播放的视频
        const itemId = this.extractVideoId(href);
        if (itemId === currentId || href === currentUrl) {
          episodeItem.classList.add('current');
        }
        
        // 设置点击事件
        episodeItem.addEventListener('click', () => {
          if (href) window.location.href = href;
        });
        
        // 设置内容
        episodeItem.innerHTML = `
          <div class="episode-index">${index + 1}</div>
          <div class="episode-title">${title}</div>
        `;
        
        episodeList.appendChild(episodeItem);
      });
    } catch (error) {
      console.error('加载合集信息失败:', error);
      this.sidebar.innerHTML = '<div style="padding: 15px; color: #999;">加载合集失败</div>';
    }
  }
  
  /**
   * 销毁侧边栏
   */
  destroy() {
    if (this.sidebar) {
      this.sidebar.remove();
      this.sidebar = null;
    }
    
    if (this.toggleBtn) {
      this.toggleBtn.remove();
      this.toggleBtn = null;
    }
    
    this.initialized = false;
    this.visible = false;
  }
}

// 导出为全局变量
window.CollectionSidebar = CollectionSidebar; 