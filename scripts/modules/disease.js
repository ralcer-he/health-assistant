// public/scripts/modules/disease.js
// 修改模块引入方式
// 删除顶部导入（第5行）
import { fetchLocalData, showLoading, createElement } from '../utils.js';

if (typeof window !== 'undefined' && !window.DiseaseModule) {
  window.DiseaseModule = class DiseaseModule {};
}

class DiseaseModule {
  constructor() {
    this.diseaseData = null;
    this.currentSymptoms = new Set();
    this.feedbackHistory = [];
    this.diagnosisHistory = JSON.parse(localStorage.getItem('diagnosisHistory') || '[]');
    window.currentModule = this; // 确保 currentModule 正确指向当前实例
    this.healthModule = this.getHealthModule();
    if (!window.modules) window.modules = {};
    window.modules.disease = this;
    window.currentModule = this;
  }
  getHealthModule() {
    const fallback = {
      currentBMI: null,
      getUserProfile: () => JSON.parse(localStorage.getItem('userProfile') || '{}')
    };
    
    try {
      return window.modules?.health || 
             window.healthModule || 
             fallback;
    } catch (e) {
      console.error('模块连接失败:', e);
      return fallback;
    }
  }

  async init() {
    try {
      this.diseaseData = await fetchLocalData('/health-assistant/data/diseases.json');
      this.renderDiagnosisInterface();
      this.bindEvents();
    } catch (error) {
      console.error('疾病模块初始化失败:', error);
      this.showError('无法加载疾病数据库');
    }
  }

  // 在 renderDiagnosisInterface 方法中修改历史记录部分
  // 在 DiseaseModule 类中新增方法
  // 修改 getPreventionTips 方法
  async getPreventionTips() {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
  
          const now = new Date();
          const season = this.getCurrentSeason(now.getMonth() + 1);
          const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
          
          // 根据年龄和性别生成合适的称呼
          let title = "朋友";
          if (profile.age) {
              if (profile.age < 18) {
                  title = "同学";
              } else if (profile.age >= 18 && profile.age < 30) {
                  title = profile.gender === '女' ? "小姐姐" : "小哥哥";
              } else if (profile.age >= 30 && profile.age < 50) {
                  title = profile.gender === '女' ? "女士" : "先生";
              } else {
                  title = profile.gender === '女' ? "女士" : "先生";
              }
          }
          
          // 优化后的提示词模板
          const prompt = `作为健康顾问，请为${profile.name ? `${profile.name}${title}` : title}提供${season}健康建议：
          1. 使用自然流畅的中文，避免生硬的标点和断句
          2. 结合${profile.age ? `${profile.age}岁` : ''}${profile.gender ? profile.gender : ''}的特点
          3. 考虑${season}常见健康问题和季节特点
          4. 最近${this.getRecentEpidemic()}较多，需要特别注意
          5. 给出3-4条实用、自然的预防建议
          要求：
          - 语气像朋友聊天一样自然流畅
          - 使用${profile.name ? `"${profile.name}${title}"` : `"${title}"`}称呼
          - 每条建议用☆开头，每条不超过30字
          - 包含1条针对${profile.gender === '女' ? '女性' : profile.gender === '男' ? '男性' : ''}的特殊建议
          - 避免出现生硬的标点和断句，如"的身体"这样的表达`;
  
          const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
              signal: controller.signal,
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer 2d2890e3eb4e44beb74ca74d90448fe4.3ESsg6u5Nv8vvsBo' 
              },
              body: JSON.stringify({ 
                  model: "glm-4-flash",
                  messages: [{ 
                      role: "user", 
                      content: prompt
                  }],
                  temperature: 0.7
              })
          });
  
          clearTimeout(timeoutId);
          
          const data = await response.json();
          if (!data?.choices?.[0]?.message?.content) {
              throw new Error('API返回数据格式异常');
          }
  
          return this.formatAdvice(data.choices[0].message.content);
  
      } catch (error) {
          console.error('获取建议失败:', error);
          return '⚠️ 暂时无法获取建议，请稍后再试';
      }
  }
  


  
  // 新增获取近期流行病情况的方法
  getRecentEpidemic() {
      const month = new Date().getMonth() + 1;
      const epidemics = {
          1: '流感',
          2: '流感',
          3: '过敏',
          4: '过敏',
          5: '手足口病',
          6: '肠道传染病',
          7: '中暑',
          8: '登革热',
          9: '秋季腹泻',
          10: '流感',
          11: '流感',
          12: '流感'
      };
      return epidemics[month] || '呼吸道疾病';
  }

  // 优化后的建议格式化方法
  formatAdvice(text) {
      // 替换数字序号为☆，并移除生硬的连接词
      return text
          .replace(/(\d+\.|\-)/g, '☆')
          .replace(/建议您|提醒您|你/g, '')
          .replace(/可以/g, '')
          .replace(/BMI.*?(?=☆|$)/g, '')
          .replace(/应该/g, '可以')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('请') && !line.startsWith('注意'))
          .join('<br>');
  }
  
  // 修改渲染方法
  renderDiagnosisInterface() {
      const container = document.getElementById('contentContainer');
      container.innerHTML = `
          <section class="diagnosis-module">
              <div class="prevention-alert">
                  <div class="alert-header">🌡️ 当前季节健康提示</div>
                  <div class="alert-content">
                      <div class="loading-status">
                        <div class="spinner"></div>
                        正在获取最新健康建议...
                      </div>
                  </div>
              </div>
              <h2 class="module-title">🔍 疾病智能诊断</h2>
              <div class="disclaimer">
                 <strong>重要提示：</strong>本工具仅提供初步健康自检参考，不能替代专业医疗诊断。检测结果可能与实际情况存在偏差，如有不适或症状持续，请及时咨询执业医师或前往正规医疗机构就诊。
              </div>
              <div class="symptom-selector">
                  <div class="search-container">
                      <input type="text" id="symptomSearch" placeholder="🔍 搜索症状 (如头痛、咳嗽)">
                      <button id="clearSearch" class="btn-clear">×</button>
                  </div>
                  <div class="symptom-categories-container">
                      ${this.renderSymptomCategories()}
                  </div>
              </div>
              
              <div class="selected-symptoms">
                  <span>已选症状:</span>
                  <div class="selected-symptoms-list"></div>
              </div>
              
              <div class="action-bar">
                  <button id="analyzeBtn" class="btn-analyze">🔍 分析症状</button>
                  <button id="clearAllBtn" class="btn-clear-all">🗑️ 清除所有</button>
              </div>
              
              <div id="diagnosisResults" class="results-container"></div>
              
              <div class="history-section">
                  <div class="history-header">
                      <h3>📝 诊断历史（最近3次）</h3>
                      <button class="btn-view-full" onclick="currentModule.renderFullHistoryModal()">
                          📋 查看完整病历
                      </button>
                  </div>
                  <div class="history-list">
                      ${this.renderDiagnosisHistory()}
                  </div>
              </div>
              
              <div class="feedback-section">
                  <button class="btn-feedback" onclick="currentModule.showFeedbackForm()">
                      ✏️ 提交反馈
                  </button>
              </div>
          </section>
      `;
  
      this.updateSelectedSymptomsDisplay();
      this.setupSearch();
      this.getPreventionTips().then(tips => {
        const contentEl = document.querySelector('.alert-content');
        contentEl.innerHTML = tips;
        contentEl.classList.add('loaded');
    }).catch(error => {
        document.querySelector('.alert-content').innerHTML = 
            `⚠️ 数据加载失败: ${error.message}`;
    });
  }

  renderSymptomCategories() {
    if (!this.diseaseData || !this.diseaseData.symptom_categories) return '';

    return Object.entries(this.diseaseData.symptom_categories).map(([category, symptoms]) => {
      return `
        <div class="symptom-category">
          <h3>${category}</h3>
          <div class="symptom-buttons">
            ${symptoms.map(symptom => this.renderSymptomButton(symptom)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderSymptomButton(symptom) {
    const isActive = this.currentSymptoms.has(symptom);
    return `
      <button 
        class="symptom-btn ${isActive ? 'active' : ''}" 
        data-symptom="${symptom}"
      >
        ${symptom}
      </button>
    `;
  }

  setupSearch() {
    const searchInput = document.getElementById('symptomSearch');
    const clearButton = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.symptom-btn').forEach(btn => {
        const symptom = btn.getAttribute('data-symptom');
        btn.style.display = symptom.includes(query) ? 'block' : 'none';
      });
    });

    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      document.querySelectorAll('.symptom-btn').forEach(btn => {
        btn.style.display = 'block';
      });
    });
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('symptom-btn')) {
        this.toggleSymptom(e.target.getAttribute('data-symptom'));
      }
    });

    document.getElementById('analyzeBtn')?.addEventListener('click', () => {
      this.calculateDiagnosis();
    });

    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
      this.clearAllSymptoms();
    });
  }

  toggleSymptom(symptom) {
    if (this.currentSymptoms.has(symptom)) {
      this.currentSymptoms.delete(symptom);
    } else {
      this.currentSymptoms.add(symptom);
    }
    
    this.updateSymptomButtons();
    this.updateSelectedSymptomsDisplay();
  }

  updateSymptomButtons() {
    document.querySelectorAll('.symptom-btn').forEach(btn => {
      const symptom = btn.getAttribute('data-symptom');
      btn.classList.toggle('active', this.currentSymptoms.has(symptom));
    });
  }

  updateSelectedSymptomsDisplay() {
    const selectedList = document.querySelector('.selected-symptoms-list');
    selectedList.innerHTML = '';
    
    if (this.currentSymptoms.size === 0) {
      selectedList.innerHTML = '<span class="placeholder">未选择任何症状</span>';
      return;
    }
    
    this.currentSymptoms.forEach(symptom => {
      const item = createElement('div', 'selected-symptom');
      item.innerHTML = `
        <span>${symptom}</span>
        <button class="remove-btn" onclick="currentModule.removeSymptom('${symptom}')">×</button>
      `;
      selectedList.appendChild(item);
    });
  }
  

  removeSymptom(symptom) {
    this.toggleSymptom(symptom);
  }

  toggleSymptom(symptom) {
    if (this.currentSymptoms.has(symptom)) {
      this.currentSymptoms.delete(symptom);
    } else {
      this.currentSymptoms.add(symptom);
    }
    
    this.updateSymptomButtons();
    this.updateSelectedSymptomsDisplay();
  }

  clearAllSymptoms() {
    this.currentSymptoms.clear();
    this.updateSymptomButtons();
    this.updateSelectedSymptomsDisplay();
    this.clearResults();
  }

  clearResults() {
    document.getElementById('diagnosisResults').innerHTML = '';
  }

  calculateDiagnosis() {
    if (this.currentSymptoms.size === 0) {
      this.showError('请选择至少一个症状进行分析');
      return;
    }

    showLoading('.diagnosis-module');
    
    try {
      const results = this.diseaseData.diseases.map(disease => {
        let score = 0;
        const matchedSymptoms = [];
        const totalWeight = Object.values(disease.symptoms).reduce((sum, s) => sum + s.weight, 0);
        
        this.currentSymptoms.forEach(symptom => {
          if (disease.symptoms[symptom]) {
            score += disease.symptoms[symptom].weight;
            matchedSymptoms.push(symptom);
          }
        });
        
        const confidence = score / totalWeight;
        return {
          ...disease,
          confidence: confidence,
          matchedSymptoms,
          commonSymptoms: Object.entries(disease.symptoms)
            .filter(([_, data]) => data.common)
            .map(([symptom]) => symptom)
        };
      }).filter(result => result.confidence >= 0.2)
         .sort((a, b) => b.confidence - a.confidence);

      this.saveDiagnosisToHistory(results);
      this.displayResults(results);
    } catch (error) {
      console.error('诊断计算错误:', error);
      this.showError('诊断计算失败，请稍后重试');
    } finally {
      document.querySelector('.loading-overlay')?.remove();
    }
  }

  // 在 saveDiagnosisToHistory 方法中修改记录保留数量
  saveDiagnosisToHistory(results) {
      if (results.length === 0) return;
      
      this.diagnosisHistory.push({
        timestamp: new Date().toISOString(),
        symptoms: [...this.currentSymptoms],
        results: results.map(result => ({
          id: result.id,
          name: result.name,
          confidence: result.confidence,
          matchedSymptoms: result.matchedSymptoms
        }))
      });
      
      // 仅保留最近的3条记录
      if (this.diagnosisHistory.length > 3) {
        this.diagnosisHistory = this.diagnosisHistory.slice(-3);
      }
  }
  
  // 新增完整病历模态框渲染方法
  // 修改 renderFullHistoryModal 方法
  renderFullHistoryModal() {
      const modal = document.createElement('div');
      modal.className = 'history-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2 style="color:#2c3e50">📂 完整诊断病历</h2>
            <button class="close-btn">×</button>
          </div>
          <div class="modal-body">
            ${this.diagnosisHistory.map(entry => `
              <div class="history-detail">
                <div class="history-time">${new Date(entry.timestamp).toLocaleString()}</div>
                <div class="history-symptoms">症状: ${entry.symptoms.join('、')}</div>
                ${entry.results.map(result => `
                  <div class="diagnosis-result">
                    <span class="disease-name">${result.name}</span>
                    <span class="confidence">${Math.round(result.confidence * 100)}% 匹配</span>
                    <div class="matched-symptoms">匹配症状: ${result.matchedSymptoms.join('、')}</div>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      // 新增关闭事件
      modal.querySelector('.close-btn').addEventListener('click', () => {
          document.body.removeChild(modal);
      });
      document.body.appendChild(modal);
  }

  displayResults(results) {
    const container = document.getElementById('diagnosisResults');
    container.innerHTML = '';
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="no-result">
          根据您选择的症状，未找到匹配的疾病。请尝试添加更多症状或调整选择。
        </div>
      `;
      return;
    }

    results.forEach(result => {
      const diagnosisCard = this.createDiagnosisCard(result);
      container.appendChild(diagnosisCard);
    });
  }

  createDiagnosisCard(result) {
    const card = createElement('div', 'diagnosis-card');
    
    // 计算常见症状匹配度
    const commonMatched = result.matchedSymptoms.filter(symptom => 
      result.commonSymptoms.includes(symptom)
    );
    const commonMatchPercentage = Math.round((commonMatched.length / result.commonSymptoms.length) * 100);
    
    card.innerHTML = `
      <div class="confidence-overlay" style="width: ${result.confidence * 100}%"></div>
      <div class="card-content">
        <h3>${result.name}</h3>
        <div class="confidence-indicator">
          <span class="probability">${Math.round(result.confidence * 100)}% 匹配度</span>
          <span class="common-symptoms-match">${commonMatchPercentage}% 常见症状匹配</span>
        </div>
        
        <div class="symptom-details">
          <div class="matched-symptoms">
            <h4>匹配症状</h4>
            <div class="symptom-list">
              ${result.matchedSymptoms.map(symptom => `
                <span class="symptom-item">${symptom}</span>
              `).join('')}
            </div>
          </div>
          
          <div class="related-symptoms">
            <h4>相关症状</h4>
            <div class="symptom-list">
              ${result.related_symptoms.map(symptom => `
                <span class="symptom-item">${symptom}</span>
              `).join('')}
            </div>
          </div>
        </div>
        
        <div class="advice-section">
          <div class="advice-box diagnosis">
            <h4>医生诊断</h4>
            <p>${result.advice.diagnosis}</p>
          </div>
          <div class="advice-box recommendation">
            <h4>治疗建议</h4>
            <p>${result.advice.recommendation}</p>
          </div>
        </div>
        
        <button 
          class="btn-view-details" 
          onclick="currentModule.showDetailedInfo('${result.id}')"
        >
          查看详细信息
        </button>
      </div>
    `;
    
    return card;
  }

  showDetailedInfo(diseaseId) {
    const disease = this.diseaseData.diseases.find(d => d.id === diseaseId);
    if (!disease) return;
    
    const detailModal = createElement('div', 'disease-detail-modal');
    detailModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${disease.name}</h2>
          <button class="close-btn" onclick="currentModule.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <h3>症状详情</h3>
          <div class="symptom-details-grid">
            ${Object.entries(disease.symptoms).map(([symptom, data]) => `
              <div class="symptom-detail-item">
                <div class="symptom-name">${symptom}</div>
                <div class="symptom-weight">
                  权重: ${data.weight.toFixed(2)} 
                  <span class="common-indicator ${data.common ? 'common' : 'not-common'}">
                    ${data.common ? '常见症状' : '少见症状'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <h3>相关症状</h3>
          <p>${disease.related_symptoms.join('、')}</p>
          
          <h3>诊断建议</h3>
          <p>${disease.advice.diagnosis}</p>
          
          <h3>治疗建议</h3>
          <p>${disease.advice.recommendation}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(detailModal);
  }

  closeModal() {
    document.querySelector('.disease-detail-modal')?.remove();
  }

  renderDiagnosisHistory() {
    if (this.diagnosisHistory.length === 0) {
      return '<div class="no-history">暂无诊断历史</div>';
    }
    
    return this.diagnosisHistory.map(entry => {
      const date = new Date(entry.timestamp).toLocaleString();
      const topResult = entry.results[0];
      
      return `
        <div class="history-item">
          <div class="history-header">
            <span class="history-date">${date}</span>
            <span class="history-symptoms">症状: ${entry.symptoms.join('、')}</span>
          </div>
          <div class="history-result">
            最可能诊断: ${topResult ? topResult.name : '未知'} (${topResult ? Math.round(topResult.confidence * 100) : 0}%)
          </div>
        </div>
      `;
    }).join('');
  }

  showFeedbackForm() {
    const form = createElement('div', 'feedback-form');
    form.innerHTML = `
      <h3>提交诊断反馈</h3>
      <p>帮助我们改进诊断系统:</p>
      <textarea placeholder="请描述诊断不准确的地方及您的建议..." rows="4"></textarea>
      <div class="form-actions">
        <button class="btn-cancel" onclick="this.parentElement.parentElement.remove()">取消</button>
        <button class="btn-submit" onclick="currentModule.submitFeedback()">提交反馈</button>
      </div>
    `;
    document.querySelector('.feedback-section').appendChild(form);
  }

  submitFeedback() {
    const feedbackText = document.querySelector('.feedback-form textarea').value;
    if (!feedbackText.trim()) {
      this.showError('请输入反馈内容');
      return;
    }
    
    this.feedbackHistory.push({
      timestamp: new Date().toISOString(),
      symptoms: [...this.currentSymptoms],
      feedback: feedbackText
    });
    
    localStorage.setItem('diagnosisFeedback', JSON.stringify(this.feedbackHistory));
    document.querySelector('.feedback-form').remove();
    this.showFeedbackSuccess();
  }

  showFeedbackSuccess() {
    const successMsg = createElement('div', 'feedback-success');
    successMsg.innerHTML = `
      <p>感谢您的反馈！您的意见将帮助我们改进诊断系统。</p>
      <button onclick="this.parentElement.remove()">关闭</button>
    `;
    document.querySelector('.feedback-section').appendChild(successMsg);
  }

  showError(message) {
    const container = document.querySelector('.diagnosis-module');
    if (!container) return;

    const errorElem = createElement('div', 'error-message');
    errorElem.innerHTML = message;
    
    container.insertBefore(errorElem, container.firstChild);
    setTimeout(() => errorElem.remove(), 5000);
  }
  // 新增季节判断方法
  getCurrentSeason(month) {
    return [[12,1,2], [3,4,5], [6,7,8], [9,10,11]]
          .find((m,i) => m.includes(month))
          .join(',').replace(/12,1,2/g, '冬季')
          .replace(/3,4,5/g, '春季')
          .replace(/6,7,8/g, '夏季')
          .replace(/9,10,11/g, '秋季');
  }


}

export default new DiseaseModule();

if (typeof window !== 'undefined') {
  window.DiseaseModule = DiseaseModule;
}