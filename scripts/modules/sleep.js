// 睡眠辅助模块
import { showLoading, createElement } from '../utils.js';
// 添加全局变量检查，确保使用正确的类定义
if (typeof window !== 'undefined') {
  window.SleepModule = class SleepModule {}
}
export class SleepModule {
  constructor() {
    this.sleepData = {
      wakeUpTime: '',
      sleepTime: '',
      cycleCount: 5,
      sleepQuality: '',
      wakeUpAlerts: [],
      sleepAlerts: []
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
      console.error('睡眠模块初始化失败:', error);
      this.showError('睡眠模块初始化失败，请刷新页面重试');
    }
  }

  loadData() {
    try {
      const savedData = localStorage.getItem('sleepData');
      if (savedData) {
        this.sleepData = { ...this.sleepData, ...JSON.parse(savedData) };
      }
    } catch (e) {
      console.error('加载睡眠数据失败:', e);
    }
  }

  saveData() {
    try {
      localStorage.setItem('sleepData', JSON.stringify(this.sleepData));
    } catch (e) {
      console.error('保存睡眠数据失败:', e);
    }
  }

  renderMainView() {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="sleep-module">
        <h2 class="section-title">🌙 睡眠辅助</h2>
        
        <div class="sleep-calculator-container">
          <div class="calculator-tabs">
            <button class="tab-btn active" data-tab="wake-up">⏰ 计算睡眠时间</button>
            <button class="tab-btn" data-tab="sleep">😴 计算起床时间</button>
          </div>
          
          <!-- 计算睡眠时间（已知起床时间） -->
          <div class="tab-content active" id="wake-up-tab">
            <form id="wakeUpForm" class="sleep-form">
              <div class="input-group">
                <label class="form-label">⏰ 计划起床时间</label>
                <input type="time" id="wakeUpTime" class="form-input" required>
              </div>
              
              <div class="input-group">
                <label class="form-label">🔄 睡眠周期数量 (每个周期约90分钟)</label>
                <input type="number" id="cycleCountWakeUp" class="form-input" min="1" max="7" value="5" required>
              </div>
              
              <div class="action-buttons">
                <button type="submit" class="btn btn-primary">💤 计算最佳睡眠时间</button>
              </div>
            </form>
          </div>
          
          <!-- 计算起床时间（已知睡眠时间） -->
          <div class="tab-content" id="sleep-tab">
            <form id="sleepForm" class="sleep-form">
              <div class="input-group">
                <label class="form-label">😴 计划入睡时间</label>
                <input type="time" id="sleepTime" class="form-input" required>
              </div>
              
              <div class="input-group">
                <label class="form-label">🔄 睡眠周期数量 (每个周期约90分钟)</label>
                <input type="number" id="cycleCountSleep" class="form-input" min="1" max="7" value="5" required>
              </div>
              
              <div class="action-buttons">
                <button type="submit" class="btn btn-primary">⏰ 计算最佳起床时间</button>
              </div>
            </form>
          </div>
        </div>
        
        <div id="sleepResult" class="sleep-result hidden">
          <h3 class="result-title">📊 睡眠计划</h3>
          
          <div class="sleep-cards">
            <div class="sleep-card" id="optimalTimeCard">
              <div class="card-icon" id="optimalTimeIcon">🌙</div>
              <h4 id="optimalTimeTitle">最佳入睡时间</h4>
              <p id="optimalTimeValue" class="time-value">计算中...</p>
            </div>
            
            <div class="sleep-card" id="totalSleepCard">
              <div class="card-icon">⏱️</div>
              <h4>预计总睡眠时间</h4>
              <p id="totalSleepValue" class="time-value">计算中...</p>
            </div>
            
            <div class="sleep-card" id="sleepCyclesCard">
              <div class="card-icon">🔄</div>
              <h4>睡眠周期</h4>
              <p id="sleepCyclesValue" class="time-value">计算中...</p>
            </div>
          </div>
          
          <div class="alternative-times">
            <h4>📅 其他可选时间</h4>
            <div id="alternativeTimesList" class="alternative-times-list"></div>
          </div>
          
          <div class="sleep-tips">
            <h4>💡 睡眠小贴士</h4>
            <ul id="sleepTipsList">
              <li>保持规律的作息时间，包括周末</li>
              <li>睡前30分钟避免使用电子设备</li>
              <li>创造安静、黑暗、凉爽的睡眠环境</li>
              <li>避免睡前摄入咖啡因和大量食物</li>
              <li>适量运动有助于提高睡眠质量，但避免睡前剧烈运动</li>
            </ul>
          </div>
        </div>
        
        <div class="sleep-quality-tracker">
          <h3 class="section-subtitle">📝 睡眠质量记录</h3>
          <form id="sleepQualityForm" class="quality-form">
            <div class="input-group">
              <label class="form-label">日期</label>
              <input type="date" id="qualityDate" class="form-input" value="${this.getTodayDate()}" required>
            </div>
            
            <div class="input-group">
              <label class="form-label">睡眠质量评分 (1-10)</label>
              <input type="range" id="qualityRating" min="1" max="10" value="7" class="form-range">
              <span id="qualityValue">7</span>/10
            </div>
            
            <div class="input-group">
              <label class="form-label">备注</label>
              <textarea id="qualityNotes" class="form-textarea" rows="3" placeholder="记录睡眠感受、影响因素等..."></textarea>
            </div>
            
            <div class="action-buttons">
              <button type="submit" class="btn btn-secondary">💾 保存记录</button>
            </div>
          </form>
        </div>
      </section>
    `;

    this.bindTabEvents();
  }

  bindEvents() {
    const wakeUpForm = document.getElementById('wakeUpForm');
    const sleepForm = document.getElementById('sleepForm');
    const qualityForm = document.getElementById('sleepQualityForm');
    const qualityRating = document.getElementById('qualityRating');
    const qualityValue = document.getElementById('qualityValue');

    if (wakeUpForm) {
      wakeUpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.calculateSleepTime();
      });
    }

    if (sleepForm) {
      sleepForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.calculateWakeUpTime();
      });
    }

    if (qualityForm) {
      qualityForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveQualityRecord();
      });
    }

    if (qualityRating && qualityValue) {
      qualityRating.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value;
      });
    }
  }

  bindTabEvents() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        
        // 更新标签按钮状态
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 更新内容显示
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
      });
    });
  }

  calculateSleepTime() {
    const wakeUpTime = document.getElementById('wakeUpTime').value;
    const cycleCount = parseInt(document.getElementById('cycleCountWakeUp').value);
    
    if (!wakeUpTime || !cycleCount) {
      this.showError('请填写完整信息');
      return;
    }
    
    // 计算最佳入睡时间（基于睡眠周期倒推）
    const [hours, minutes] = wakeUpTime.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;
    const cycleMinutes = cycleCount * 90; // 每个周期90分钟
    
    // 减去睡眠周期时间和入睡时间（约15分钟）
    totalMinutes -= (cycleMinutes + 15);
    
    // 处理负数情况
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }
    
    const resultHours = Math.floor(totalMinutes / 60);
    const resultMinutes = totalMinutes % 60;
    const optimalSleepTime = `${resultHours.toString().padStart(2, '0')}:${resultMinutes.toString().padStart(2, '0')}`;
    
    // 保存数据
    this.sleepData = {
      ...this.sleepData,
      wakeUpTime,
      cycleCount,
      calculatedSleepTime: optimalSleepTime
    };
    
    this.saveData();
    this.updateResults(true, optimalSleepTime, wakeUpTime, cycleCount);
  }

  calculateWakeUpTime() {
    const sleepTime = document.getElementById('sleepTime').value;
    const cycleCount = parseInt(document.getElementById('cycleCountSleep').value);
    
    if (!sleepTime || !cycleCount) {
      this.showError('请填写完整信息');
      return;
    }
    
    // 计算最佳起床时间（基于睡眠周期）
    const [hours, minutes] = sleepTime.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;
    const cycleMinutes = cycleCount * 90; // 每个周期90分钟
    
    // 加上睡眠周期时间和入睡时间（约15分钟）
    totalMinutes += (cycleMinutes + 15);
    
    // 处理超过24小时的情况
    totalMinutes %= 24 * 60;
    
    const resultHours = Math.floor(totalMinutes / 60);
    const resultMinutes = totalMinutes % 60;
    const optimalWakeUpTime = `${resultHours.toString().padStart(2, '0')}:${resultMinutes.toString().padStart(2, '0')}`;
    
    // 保存数据
    this.sleepData = {
      ...this.sleepData,
      sleepTime,
      cycleCount,
      calculatedWakeUpTime: optimalWakeUpTime
    };
    
    this.saveData();
    this.updateResults(false, sleepTime, optimalWakeUpTime, cycleCount);
  }

  updateResults(isCalculatingSleepTime, firstTime, secondTime, cycleCount) {
    const resultElement = document.getElementById('sleepResult');
    const optimalTimeIcon = document.getElementById('optimalTimeIcon');
    const optimalTimeTitle = document.getElementById('optimalTimeTitle');
    const optimalTimeValue = document.getElementById('optimalTimeValue');
    const totalSleepValue = document.getElementById('totalSleepValue');
    const sleepCyclesValue = document.getElementById('sleepCyclesValue');
    const alternativeTimesList = document.getElementById('alternativeTimesList');
    
    if (!resultElement) return;
    
    // 更新主要结果
    optimalTimeIcon.textContent = isCalculatingSleepTime ? '🌙' : '⏰';
    optimalTimeTitle.textContent = isCalculatingSleepTime ? '最佳入睡时间' : '最佳起床时间';
    
    // 根据计算类型显示正确的结果时间
    optimalTimeValue.textContent = isCalculatingSleepTime ? firstTime : secondTime;
    
    // 计算总睡眠时间
    const totalHours = (cycleCount * 90) / 60;
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    totalSleepValue.textContent = `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
    
    sleepCyclesValue.textContent = `${cycleCount}个周期 (约${cycleCount * 90}分钟)`;
    
    // 生成其他可选时间，使用正确的基础时间
    const baseTimeForAlternatives = isCalculatingSleepTime ? firstTime : secondTime;
    this.generateAlternativeTimes(alternativeTimesList, isCalculatingSleepTime, baseTimeForAlternatives, cycleCount);
    
    // 显示结果
    resultElement.classList.remove('hidden');
  }

  generateAlternativeTimes(container, isCalculatingSleepTime, baseTime, cycleCount) {
    if (!container) return;
    
    const [baseHours, baseMinutes] = baseTime.split(':').map(Number);
    let baseTotalMinutes = baseHours * 60 + baseMinutes;
    
    let html = '';
    
    // 生成前后各两个可选时间（每个相差一个周期）
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue; // 跳过基础时间
      
      let totalMinutes;
      if (isCalculatingSleepTime) {
        // 计算入睡时间时，增加i个周期意味着起床时间减少i个周期
        totalMinutes = baseTotalMinutes - (i * 90);
      } else {
        // 计算起床时间时，增加i个周期意味着起床时间增加i个周期
        totalMinutes = baseTotalMinutes + (i * 90);
      }
      
      // 处理时间范围
      while (totalMinutes < 0) totalMinutes += 24 * 60;
      totalMinutes %= 24 * 60;
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      // 修正周期数计算：对于起床时间计算，增加i个周期应该对应增加i个周期数
      const cycles = isCalculatingSleepTime ? cycleCount + i : cycleCount + i;
      if (cycles >= 1 && cycles <= 7) { // 保持周期在合理范围内
        html += `<div class="alternative-time">
          <span class="time">${timeStr}</span>
          <span class="cycles">(${cycles}个周期)</span>
        </div>`;
      }
    }
    
    container.innerHTML = html;
  }

  saveQualityRecord() {
    const date = document.getElementById('qualityDate').value;
    const rating = document.getElementById('qualityRating').value;
    const notes = document.getElementById('qualityNotes').value;
    
    if (!date) {
      this.showError('请选择日期');
      return;
    }
    
    const qualityRecord = {
      date,
      rating: parseInt(rating),
      notes,
      timestamp: new Date().toISOString()
    };
    
    // 保存记录
    let qualityHistory = JSON.parse(localStorage.getItem('sleepQualityHistory') || '[]');
    
    // 检查是否已存在该日期的记录，如有则更新
    const existingIndex = qualityHistory.findIndex(record => record.date === date);
    if (existingIndex >= 0) {
      qualityHistory[existingIndex] = qualityRecord;
    } else {
      qualityHistory.push(qualityRecord);
    }
    
    localStorage.setItem('sleepQualityHistory', JSON.stringify(qualityHistory));
    this.showSuccess('睡眠质量记录已保存');
  }

  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  cleanup() {
    // 清理事件监听器
    Object.values(this.eventListeners).forEach(listeners => {
      listeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
          element.removeEventListener(event, handler);
        }
      });
    });
  }
}