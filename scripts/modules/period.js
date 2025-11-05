// 经期计算提醒模块
import { showLoading, createElement } from '../utils.js';
// 添加全局变量检查，确保使用正确的类定义
if (typeof window !== 'undefined') {
  window.PeriodModule = class PeriodModule {}
}
export class PeriodModule {
  constructor() {
    this.periodData = {
      lastPeriodDate: '',
      cycleLength: 28,
      periodLength: 5,
      notificationsEnabled: true,
      upcomingPeriod: null,
      fertileWindow: null,
      history: []
    };
    this.eventListeners = {};
  }

  async init({ container }) {
    try {
      this.container = document.querySelector(container);
      this.loadData();
      this.renderMainView();
      this.bindEvents();
    } catch (error) {
      console.error('经期模块初始化失败:', error);
      this.showError('经期模块初始化失败，请刷新页面重试');
    }
  }

  loadData() {
    try {
      const savedData = localStorage.getItem('periodData');
      if (savedData) {
        this.periodData = { ...this.periodData, ...JSON.parse(savedData) };
        this.calculateNextPeriod();
      }
    } catch (e) {
      console.error('加载经期数据失败:', e);
    }
  }

  saveData() {
    try {
      localStorage.setItem('periodData', JSON.stringify(this.periodData));
    } catch (e) {
      console.error('保存经期数据失败:', e);
    }
  }

  renderMainView() {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="period-module">
        <h2 class="section-title">🌸 经期计算与提醒</h2>
        
        <div class="period-form-container">
          <form id="periodForm" class="period-form">
            <div class="input-group">
              <label class="form-label">📅 上次经期开始日期</label>
              <input type="date" id="lastPeriodDate" class="form-input" required>
            </div>
            
            <div class="input-group">
              <label class="form-label">🔄 月经周期长度 (天)</label>
              <input type="number" id="cycleLength" class="form-input" value="28" required>
            </div>
            
            <div class="input-group">
              <label class="form-label">💧 经期持续天数</label>
              <input type="number" id="periodLength" class="form-input" value="5" required>
            </div>
            
            <div class="notification-toggle">
              <label class="switch">
                <input type="checkbox" id="notificationsEnabled" checked>
                <span class="slider round"></span>
              </label>
              <span>启用提醒通知</span>
            </div>
            
            <div class="action-buttons">
              <button type="submit" class="btn btn-primary">💾 保存并计算</button>
              <button type="button" id="resetPeriodBtn" class="btn btn-secondary">🔄 重置数据</button>
            </div>
          </form>
        </div>
        
        <div id="periodResult" class="period-result ${this.periodData.lastPeriodDate ? '' : 'hidden'}">
          <h3 class="result-title">📊 周期预测</h3>
          
          <div class="period-cards">
            <div class="period-card" id="nextPeriodCard">
              <div class="card-icon">🌸</div>
              <h4>下次经期</h4>
              <p id="nextPeriodDate" class="date-value">计算中...</p>
              <p class="days-away">还有 <span id="daysUntilPeriod">--</span> 天</p>
            </div>
            
            <div class="period-card" id="fertileCard">
              <div class="card-icon">🌱</div>
              <h4>易孕期</h4>
              <p id="fertileWindowDate" class="date-value">计算中...</p>
              <p class="status" id="fertileStatus">非易孕期</p>
            </div>
            
            <div class="period-card" id="ovulationCard">
              <div class="card-icon">✨</div>
              <h4>排卵日</h4>
              <p id="ovulationDate" class="date-value">计算中...</p>
            </div>
          </div>
          
          <div class="period-calendar">
            <h4>📅 30天周期预览</h4>
            <div id="calendarGrid" class="calendar-grid"></div>
          </div>
          
          <div class="health-tips">
            <h4>💡 健康小贴士</h4>
            <ul id="healthTipsList">
              <li>保持充足睡眠，有助于调节内分泌</li>
              <li>适量运动，但避免经期剧烈运动</li>
              <li>注意饮食均衡，避免生冷刺激性食物</li>
            </ul>
          </div>
        </div>
      </section>
    `;

    // 填充表单数据
    if (this.periodData.lastPeriodDate) {
      document.getElementById('lastPeriodDate').value = this.periodData.lastPeriodDate;
      document.getElementById('cycleLength').value = this.periodData.cycleLength;
      document.getElementById('periodLength').value = this.periodData.periodLength;
      document.getElementById('notificationsEnabled').checked = this.periodData.notificationsEnabled;
      this.updateResults();
    }
  }

  bindEvents() {
    const form = document.getElementById('periodForm');
    const resetBtn = document.getElementById('resetPeriodBtn');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetData();
      });
    }
  }

  handleFormSubmit() {
    const lastPeriodDate = document.getElementById('lastPeriodDate').value;
    const cycleLength = parseInt(document.getElementById('cycleLength').value);
    const periodLength = parseInt(document.getElementById('periodLength').value);
    const notificationsEnabled = document.getElementById('notificationsEnabled').checked;

    if (!lastPeriodDate) {
      this.showError('请选择上次经期开始日期');
      return;
    }
    
    if (!cycleLength || cycleLength <= 0) {
      this.showError('请输入有效的月经周期长度（正整数）');
      return;
    }
    
    if (!periodLength || periodLength <= 0) {
      this.showError('请输入有效的经期持续天数（正整数）');
      return;
    }

    this.periodData = {
      lastPeriodDate,
      cycleLength,
      periodLength,
      notificationsEnabled,
      history: [...this.periodData.history, { date: new Date().toISOString(), ...this.periodData }]
    };

    this.saveData();
    this.calculateNextPeriod();
    this.updateResults();
    this.showSuccess('经期数据已保存');
    document.getElementById('periodResult').classList.remove('hidden');
  }

  calculateNextPeriod() {
    const lastDate = new Date(this.periodData.lastPeriodDate);
    const nextPeriod = new Date(lastDate);
    nextPeriod.setDate(nextPeriod.getDate() + this.periodData.cycleLength);
    
    // 计算排卵日（周期长度减去14天）
    const ovulationDate = new Date(lastDate);
    ovulationDate.setDate(ovulationDate.getDate() + (this.periodData.cycleLength - 14));
    
    // 计算易孕期（排卵日前后各3天）
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 3);
    
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 3);
    
    this.periodData.upcomingPeriod = nextPeriod;
    this.periodData.ovulationDate = ovulationDate;
    this.periodData.fertileWindow = { start: fertileStart, end: fertileEnd };
  }

  updateResults() {
    const today = new Date();
    const daysUntilPeriod = Math.ceil((this.periodData.upcomingPeriod - today) / (1000 * 60 * 60 * 24));
    
    // 更新下次经期信息
    document.getElementById('nextPeriodDate').textContent = this.formatDate(this.periodData.upcomingPeriod);
    document.getElementById('daysUntilPeriod').textContent = Math.max(0, daysUntilPeriod);
    
    // 更新排卵日信息
    document.getElementById('ovulationDate').textContent = this.formatDate(this.periodData.ovulationDate);
    
    // 更新易孕期信息
    const fertileText = `${this.formatDate(this.periodData.fertileWindow.start)} - ${this.formatDate(this.periodData.fertileWindow.end)}`;
    document.getElementById('fertileWindowDate').textContent = fertileText;
    
    // 检查是否处于易孕期或经期
    const isInFertileWindow = today >= this.periodData.fertileWindow.start && today <= this.periodData.fertileWindow.end;
    const periodEnd = new Date(this.periodData.lastPeriodDate);
    periodEnd.setDate(periodEnd.getDate() + this.periodData.periodLength);
    const isInPeriod = today >= new Date(this.periodData.lastPeriodDate) && today <= periodEnd;
    
    const fertileStatus = document.getElementById('fertileStatus');
    if (isInPeriod) {
      fertileStatus.textContent = '经期中';
      fertileStatus.className = 'status in-period';
    } else if (isInFertileWindow) {
      fertileStatus.textContent = '易孕期';
      fertileStatus.className = 'status fertile';
    } else {
      fertileStatus.textContent = '非易孕期';
      fertileStatus.className = 'status safe';
    }
    
    // 生成日历预览
    this.generateCalendarPreview();
    
    // 更新健康小贴士
    this.updateHealthTips(isInPeriod, isInFertileWindow, daysUntilPeriod);
  }

  generateCalendarPreview() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 5); // 从今天往前5天开始
    
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      
      const dayCell = createElement('div', 'calendar-day');
      const dayNum = currentDate.getDate();
      const isToday = currentDate.toDateString() === today.toDateString();
      
      // 检查日期类型
      let type = 'normal';
      let icon = '';
      
      // 检查是否是经期
      const periodStart = new Date(this.periodData.lastPeriodDate);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + this.periodData.periodLength - 1);
      
      if (this.isSameDay(currentDate, periodStart)) {
        type = 'period-start';
        icon = '🌸';
      } else if (currentDate > periodStart && currentDate <= periodEnd) {
        type = 'period';
      } 
      // 检查下次经期
      else if (this.isSameDay(currentDate, this.periodData.upcomingPeriod)) {
        type = 'next-period';
        icon = '🌸';
      }
      // 检查排卵日
      else if (this.isSameDay(currentDate, this.periodData.ovulationDate)) {
        type = 'ovulation';
        icon = '✨';
      }
      // 检查易孕期
      else if (currentDate >= this.periodData.fertileWindow.start && currentDate <= this.periodData.fertileWindow.end) {
        type = 'fertile';
      }
      
      dayCell.className = `calendar-day ${type} ${isToday ? 'today' : ''}`;
      dayCell.innerHTML = `
        <div class="day-number">${dayNum}</div>
        <div class="day-icon">${icon}</div>
      `;
      
      // 添加 tooltip
      let tooltipText = '';
      if (type === 'period' || type === 'period-start') tooltipText = '经期';
      if (type === 'next-period') tooltipText = '下次经期';
      if (type === 'ovulation') tooltipText = '排卵日';
      if (type === 'fertile') tooltipText = '易孕期';
      
      if (tooltipText) {
        dayCell.setAttribute('title', tooltipText);
        dayCell.setAttribute('data-tooltip', tooltipText);
      }
      
      grid.appendChild(dayCell);
    }
  }

  updateHealthTips(isInPeriod, isInFertileWindow, daysUntilPeriod) {
    const tipsList = document.getElementById('healthTipsList');
    let tips = [];
    
    if (isInPeriod) {
      tips = [
        '保持温暖，避免受凉',
        '注意休息，避免过度劳累',
        '适当补充铁质和蛋白质',
        '可以热敷下腹部缓解不适',
        '保持外阴清洁，勤换卫生巾'
      ];
    } else if (isInFertileWindow) {
      tips = [
        '如果有生育计划，这是最佳受孕时机',
        '保持规律作息，提高卵子质量',
        '注意营养均衡，多吃富含叶酸的食物',
        '避免吸烟饮酒和接触有害物质',
        '保持心情愉悦，减轻压力'
      ];
    } else if (daysUntilPeriod <= 3) {
      tips = [
        '即将进入经期，注意保暖',
        '避免食用生冷刺激性食物',
        '可以适当补充维生素B6缓解经前症状',
        '保持充足睡眠，有助于缓解疲劳',
        '适当运动，但避免剧烈活动'
      ];
    } else {
      tips = [
        '保持充足睡眠，有助于调节内分泌',
        '适量运动，维持身体健康',
        '注意饮食均衡，多吃新鲜蔬果',
        '保持心情愉悦，减轻压力',
        '定期记录经期变化，了解身体规律'
      ];
    }
    
    tipsList.innerHTML = tips.map(tip => `<li>${tip}</li>`).join('');
  }

  resetData() {
    if (confirm('确定要重置所有经期数据吗？')) {
      this.periodData = {
        lastPeriodDate: '',
        cycleLength: 28,
        periodLength: 5,
        notificationsEnabled: true,
        upcomingPeriod: null,
        fertileWindow: null,
        history: []
      };
      this.saveData();
      this.renderMainView();
      this.showSuccess('经期数据已重置');
    }
  }

  formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    const notification = createElement('div', `notification notification-${type}`);
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  cleanup() {
    // 清理事件监听器
    Object.values(this.eventListeners).forEach(listeners => {
      listeners.forEach(({ element, event, handler }) => {
        if (element && handler) {
          element.removeEventListener(event, handler);
        }
      });
    });
    this.eventListeners = {};
  }
}