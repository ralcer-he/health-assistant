// public/scripts/modules/health.js
import { fetchLocalData, showLoading, createElement } from '../utils.js';
if (typeof window !== 'undefined' && !window.HealthModule) {
  window.HealthModule = class HealthModule {};
}
export class HealthModule {
  constructor() {
    this.formData = { age: '', height: '', weight: '' };
    const today = new Date().toISOString().split('T')[0];
    const dietHistory = JSON.parse(localStorage.getItem('dietHistory') || '[]');
    window.healthModule = this; 
    if (!window.modules) window.modules = {};
    window.modules.health = this;
    this.currentBMI = null;
    this.handleEvaluate = this.onSubmit.bind(this);
    // 从历史记录中获取当天总热量
    const todayCalories = dietHistory
      .filter(record => record.date.startsWith(today))
      .reduce((sum, record) => sum + (record.calories || 0), 0);
    // 数据迁移：将旧数据转换为新格式
    this.dietData = {
      current: todayCalories,
      target: 2000,
      history: dietHistory
    };
    this.eventListeners = {
      bmiForm: { submit: [] },
      planForm: { submit: [] },
      resetBtn: { click: [] }
    };
    
    const waterHistory = JSON.parse(localStorage.getItem('waterHistory') || '[]');
    const todayRecord = waterHistory.find(record => record.date.startsWith(today)) || { amount: 0 };

    this.waterData = {
        current: Number(todayRecord.amount) || 0, 
        target: 2000,
        history: waterHistory
    };
    
    try {
      this.history = JSON.parse(localStorage.getItem('healthHistory') || '[]');
      this.healthPlan = JSON.parse(localStorage.getItem('healthPlan') || '{}');
    } catch (e) {
      this.clearCorruptedData();
    }
    
    this.currentBMI = null;
    this.handleEvaluate = this.onSubmit.bind(this);
    this.handleGenerate = this.generateHealthPlan.bind(this);
    this.handleReset = this.onReset.bind(this);
    this.handleInput = this.onInput.bind(this);
  
  }
  
  loadValidWaterHistory() {
    try {
      return JSON.parse(localStorage.getItem('waterHistory')) || [];
    } catch (e) {
      console.error('载入饮水记录失败，已重置数据');
      return [];
    }
  }
  
  clearCorruptedData() {
    localStorage.removeItem('healthHistory');
    localStorage.removeItem('healthPlan');
    this.history = [];
    this.healthPlan = {};
  }

  async init() {
    try {
      this.renderForm();
      this.loadSavedData();
      this.bindEvents();
    } catch (error) {
      this.showError('健康模块初始化失败');
    }
  }

  renderForm() {
    const container = document.getElementById('contentContainer');
    if (!container) return;

    container.innerHTML = `
      <section class="health-module">
        <h2 class="section-title">⚖️ 健康管理中心</h2>
        <form id="bmiForm" class="bmi-form">
          <div class="input-group">
            <label class="form-label">👤 姓名</label>
            <input type="text" id="name" class="form-input" placeholder="请输入姓名">
          </div>
          <div class="input-group">
            <label class="form-label">👫 性别</label>
            <div class="gender-options">
              <label><input type="radio" name="gender" value="男"> 男</label>
              <label><input type="radio" name="gender" value="女"> 女</label>
            </div>
          </div>
          <div class="input-group">
            <label class="form-label">👤 年龄</label>
            <input type="number" id="age" class="form-input" min="10" max="120" required>
          </div>
          <div class="input-group">
            <label class="form-label">📏 身高 (cm)</label>
            <input type="number" id="height" class="form-input" min="100" max="250" required>
          </div>
          <div class="input-group">
            <label class="form-label">⚖️ 体重 (kg)</label>
            <input type="number" id="weight" class="form-input" min="30" max="300" required>
          </div>
          <div class="action-buttons">
            <button type="submit" class="btn btn-evaluate">📊 立即评估</button>
            <button type="button" id="resetBtn" class="btn btn-secondary">🔄 重置数据</button>
          </div>
        </form>
        <div id="resultSection" class="result-section hidden"></div>
      </section>
    `;
  }

  bindEvents() {
    this.unbindEvents();
    const bmiForm = document.getElementById('bmiForm');
    const planForm = document.getElementById('planForm');
    const resetBtn = document.getElementById('resetBtn');
    if (bmiForm) {
      const handler = (e) => {
        e.preventDefault();
        this.onSubmit(e);
      };
      bmiForm.addEventListener('submit', handler);
      this.eventListeners.bmiForm.submit.push(handler);
    }

    if (planForm) {
      const handler = (e) => {
        e.preventDefault();
        this.generateHealthPlan();
      };
      planForm.addEventListener('submit', handler);
      this.eventListeners.planForm.submit.push(handler);
    }
    this.handleEvaluate = (e) => this.onSubmit(e);
    this.handleGenerate = () => this.generateHealthPlan();

    document.getElementById('bmiForm')?.addEventListener('submit', this.handleEvaluate);
    document.getElementById('planForm')?.addEventListener('submit', this.handleGenerate);
    this.handleReset = () => this.onReset();
    this.handleInput = () => this.onInput();

    document.getElementById('resetBtn')?.addEventListener('click', () => {
      this.onReset();
      this.showSuccess('已重置所有数据');
    });
    document.querySelectorAll('.form-input').forEach(input => {
      input.addEventListener('input', this.handleInput);
    });

    document.addEventListener('submit', e => {
      const form = e.target;
      
      if (form.matches('#planForm')) {
        e.preventDefault();
        console.log('计划表单提交');
        this.generateHealthPlan();
      }
    });
  }

  unbindEvents() {
    const bmiForm = document.getElementById('bmiForm');
    const planForm = document.getElementById('planForm');
    const resetBtn = document.getElementById('resetBtn');
    if (this.eventListeners.bmiForm.submit.length) {
      const [handler] = this.eventListeners.bmiForm.submit.splice(0, 1);
      document.getElementById('bmiForm')?.removeEventListener('submit', handler);
    }
    // 移除并清理记录的事件
    if (bmiForm && this.eventListeners.bmiForm.submit.length) {
      bmiForm.removeEventListener('submit', this.eventListeners.bmiForm.submit.pop());
    }

    if (planForm && this.eventListeners.planForm.submit.length) {
      planForm.removeEventListener('submit', this.eventListeners.planForm.submit.pop());
    }

    if (resetBtn && this.eventListeners.resetBtn.click.length) {
      resetBtn.removeEventListener('click', this.eventListeners.resetBtn.click.pop());
    }
    document.getElementById('bmiForm')?.removeEventListener('submit', this.handleEvaluate);
    document.getElementById('planForm')?.removeEventListener('submit', this.handleGenerate);
    document.getElementById('bmiForm')?.removeEventListener('submit', this.handleSubmit);
    document.getElementById('resetBtn')?.removeEventListener('click', this.handleReset);
    document.querySelectorAll('.form-input').forEach(input => {
      input.removeEventListener('input', this.handleInput);
    });
  }
  diagnoseEventListeners() {
    const bmiFormExists = !!document.getElementById('bmiForm');
    return {
        status: 'success',
        data: {
            formExists: bmiFormExists,
            listeners: this.eventListeners.bmiForm.submit.length,
            validInstance: this instanceof HealthModule,
            domStatus: {
                rendered: !!document.querySelector('.bmi-form'),
                hidden: document.getElementById('bmiForm')?.classList.contains('hidden')
            }
        }
    };
  }
  async onSubmit(e) {
    e.preventDefault();
    showLoading('#resultSection .result-content');
    
    // 先验证基础输入再获取BMI
    const errors = this.validateInputs();
    if (errors.length) {
        this.showError(errors.join('\n'));
        return;
    }

    // 计算BMI后再收集数据
    const bmi = this.calculateBMI();
    this.currentBMI = bmi;

    const userData = {
        name: document.getElementById('name')?.value.trim() || '匿名用户',
        age: Math.max(10, Math.min(120, parseInt(document.getElementById('age')?.value) || 0)),
        gender: document.querySelector('input[name="gender"]:checked')?.value || '未指定',
        bmi: parseFloat(bmi).toFixed(1) || '未测量'
    };

    // 增强姓名校验
    if (!userData.name || userData.name === '匿名用户') {
        this.showError('请输入有效姓名');
        return;
    }

    localStorage.setItem('userProfile', JSON.stringify(userData));
    
    try {
        this.renderHealthDashboard(bmi);
        this.saveToHistory(bmi);
    } catch (error) {
        this.showError('评估失败，请检查输入');
        console.error('评估错误:', error.stack);
    }
  }

  onReset() {
    this.formData = { age: '', height: '', weight: '' };
    document.getElementById('bmiForm')?.reset();
    document.getElementById('resultSection')?.classList.add('hidden');
    localStorage.removeItem('healthData');
    this.waterData = {
      current: 0,
      target: 2000,
      history: []
    };
    localStorage.removeItem('waterHistory');
    this.dietData = {
      current: 0,
      target: 2000,
      history: []
    };
    localStorage.removeItem('dietHistory');
    if(this.currentBMI) {
        this.renderHealthDashboard(this.currentBMI); 
    } else {
        document.getElementById('resultSection')?.classList.add('hidden');
    }
  }

  onInput() {
    this.formData = {
      age: document.getElementById('age').value,
      height: document.getElementById('height').value,
      weight: document.getElementById('weight').value
    };
    this.saveToStorage();
  }

  validateInputs() {
    const errors = [];
    const { age, height, weight } = this.formData;

    if (isNaN(age) || age < 10 || age > 120) {
      errors.push("请输入有效年龄（10-120岁）");
    }
    if (isNaN(height) || height < 100 || height > 250) {
      errors.push("请输入有效身高（100-250cm）");
    }
    if (isNaN(weight) || weight < 30 || weight > 300) {
      errors.push("请输入有效体重（30-300kg）");
    }

    return errors;
  }

  calculateBMI() {
    const heightM = this.formData.height / 100;
    const bmi = this.formData.weight / (heightM * heightM);
    return Math.min(Math.max(bmi, 16), 40).toFixed(1); // 限制显示范围
  }

  renderHealthDashboard(bmi) {
    const resultSection = document.getElementById('resultSection');
    if (!resultSection) return;

    resultSection.classList.remove('hidden');
    resultSection.innerHTML = `
      <div class="health-dashboard">
        ${this.createBMICard(bmi)}
        ${this.createHealthPlanCard()}
        ${this.createPsychoTestCard()}
        ${this.createWaterCard()}     
        ${this.createDietCard()}
      </div>
    `;

    // 恢复食物识别功能绑定
    this.bindPlanTaskEvents();
    this.bindPsychoTestEvents();
    this.bindWaterEvents();
    this.bindDietEvents();
    this.addFoodRecognition(); // 新增这行恢复功能
  }

// ... 其他代码保持不变 ...

  addFoodRecognition() {
    const container = document.createElement('div');
    container.className = 'food-recognition';
    container.innerHTML = `
      <h3>📷 AI识图算热量</h3>
      <div class="upload-section">
        <input type="file" id="foodPhoto" accept="image/*" class="upload-input">
        <label for="foodPhoto" class="btn-upload">
          <span>📤 上传食物照片</span>
          <small>(支持JPG/PNG，最大2MB)</small>
        </label>
        <div class="preview-container"></div>
      </div>
      <div class="recognition-result"></div>
    `;
    document.querySelector('.diet-card')?.before(container);
    
    // 绑定图片上传事件
    container.querySelector('#foodPhoto').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        this.showError('文件大小超过2MB限制');
        return;
      }

      const preview = container.querySelector('.preview-container');
      preview.innerHTML = `<img class="food-preview" src="${URL.createObjectURL(file)}">`;

      try {
        const calories = await this.recognizeFood(file);
        container.querySelector('.recognition-result').innerHTML = `
          <div class="calorie-info">
            <span class="ai-label">AI估算热量：</span>
            <strong>${calories}kcal</strong>
            <button class="btn-apply" onclick="document.getElementById('dietInput').value=${calories}">💡 应用此数值</button>
          </div>
        `;
      } catch (error) {
        this.showError('识别失败，请尝试清晰的菜品照片');
      }
    });
  }

  createBMICard(bmi) {
    if (bmi === null) return '<div class="bmi-result placeholder">请先进行健康评估</div>';
    const { category } = this.getHealthAdvice(bmi);
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const gender = profile.gender || '未指定';
    const genderPrefix = gender === '女' ? '女' : '男';
    const imageMap = {
      '过轻': `${genderPrefix}瘦弱`,
      '健康': `${genderPrefix}健康`,
      '超重': `${genderPrefix}肥胖`
    };
    return `
      <div class="bmi-result">
        <div class="bmi-header">
          <h3 style="font-size: 1.4rem;">📝 健康报告</h3>
          <div class="bmi-value ${category}">
            <div class="bmi-metric">
              <span class="label">BMI</span>
              <strong style="font-size: 1.8rem;">${bmi}</strong>
              <span class="category">${category}</span>
            </div>
            <img src="/health-assistant/images/${imageMap[category]}.${gender === '女' ? 'png' : 'jpeg'}" 
                 class="bmi-image" 
                 alt="${category}状态">
          </div>
        </div>

        <div class="grid-container">
          <div class="health-analysis">
            <h4 style="font-size: 1.3rem;">📊 基础健康建议</h4>
            <div class="manual-advice">
              ${this.getHealthAdvice(bmi).advice.map(tip => `
                <div class="advice-item">★ ${tip}</div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }




  createHealthPlanCard() {
    const hasValidPlan = this.healthPlan?.dailyTasks?.length > 0;
    return `
      <div class="health-plan-card">
        <h3>🏃 本周健康计划</h3>
        ${this.healthPlan.dailyTasks?.length ? 
          `${this.showPlanProgress()}
           <button class="btn btn-regenerate">🔄 重新生成计划</button>` 
          : this.renderPlanForm()}
      </div>
    `;
  }

  renderPlanForm() {
    return `
      <form id="planForm" class="plan-form">
        <div class="form-group">
          <label>每日运动目标（分钟）</label>
          <input type="number" min="15" max="180" value="30" id="exerciseGoal">
        </div>
        <button type="submit" class="btn btn-generate">生成计划</button>
      </form>
    `;
  }

  showPlanProgress() {
    const completed = this.healthPlan.dailyTasks.filter(t => t.completed).length;
    const progress = Math.round((completed / this.healthPlan.dailyTasks.length) * 100);
    
    return `
      <div class="plan-progress">
        <div class="progress-bar" style="width: ${progress}%"></div>
        <span>${progress}% 完成</span>
      </div>
      <ul class="daily-tasks">
        ${this.healthPlan.dailyTasks.map(task => `
          <li class="${task.completed ? 'completed' : ''}">
            <label>
              <input type="checkbox" ${task.completed ? 'checked' : ''} data-task="${task.id}">
              ${task.name}
            </label>
          </li>
        `).join('')}
      </ul>
    `;
  }

  async generateHealthPlan() {
    showLoading('resultSection');
    
    try {
      const planData = await fetchLocalData('/health-assistant/data/daily-plans.json');
      
      const rawPlans = planData.日常计划 || planData.dailyPlans;
      
      if (!Array.isArray(rawPlans)) {
        throw new Error('数据格式错误: 日常计划必须是数组');
      }

      const formattedData = rawPlans.reduce((acc, category) => {
        if (category?.type && Array.isArray(category.tasks)) {
          acc[category.type] = category.tasks.map(task => ({
            name: `${task.icon || '⚙️'} ${task.name}`.trim(),
            type: category.type
          }));
        }
        return acc;
      }, {});

      const allTasks = Object.values(formattedData).flat();
      if (allTasks.length === 0) {
        throw new Error('没有可用的任务数据');
      }

      this.healthPlan = {
        dailyTasks: allTasks
          .sort(() => Math.random() - 0.5)
          .slice(0, 6)
          .map((task, index) => ({
            ...task,
            id: `task_${Date.now()}_${index}`,
            completed: false
          })),
        _version: '2.0'
      };

      localStorage.setItem('healthPlan', JSON.stringify(this.healthPlan));
      this.currentBMI = this.currentBMI || 0; 
      this.renderHealthDashboard(this.currentBMI);

    } catch (error) {
      console.error('[健康计划错误]', {
        error: error.stack,
        path: window.location.href,
        dataStatus: await this.checkDataStatus()
      });

      this.healthPlan = {
        dailyTasks: [ {
          id: 'emergency_task',
          name: '⚠️ 数据加载失败，请稍后重试',
          type: '系统',
          completed: false
        }]
      };
      this.showError(`计划生成失败: ${error.message}`);
    }
  }

  async checkDataStatus() {
    try {
      const res = await fetch('/health-assistant/data/daily-plans.json');
      return {
        status: res.status,
        ok: res.ok,
        size: res.headers.get('content-length')
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  toggleTask(taskId) {
    if (!this.healthPlan || !Array.isArray(this.healthPlan.dailyTasks)) {
      console.error('健康计划未初始化或格式错误');
      return;
    }

    const taskIndex = this.healthPlan.dailyTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      console.error(`任务 ID ${taskId} 未找到`);
      return;
    }

    this.healthPlan.dailyTasks[taskIndex].completed = 
      !this.healthPlan.dailyTasks[taskIndex].completed;
    
    const completedCount = this.healthPlan.dailyTasks.filter(t => t.completed).length;
    this.healthPlan.progress = {
      completed: Math.round((completedCount / this.healthPlan.dailyTasks.length) * 100)
    };
    
    localStorage.setItem('healthPlan', JSON.stringify(this.healthPlan));
    this.renderHealthDashboard(this.currentBMI);
  }

  createPsychoTestCard() {
    return `
      <div class="psycho-test-card">
        <h3>🧠 心理测评中心</h3>
        <div class="test-buttons">
          <button class="test-btn depression" data-test="SDS">
            <span class="emoji">😔</span>
            抑郁自评量表（SDS）
          </button>
          <button class="test-btn anxiety" data-test="SAS">
            <span class="emoji">😰</span>
            焦虑自评量表（SAS）
          </button>
          <button class="test-btn ees" data-test="EES">
            <span class="emoji">😌</span>
            情绪稳定性测试（EES）
          </button>
        </div>
      </div>
    `;
  }

  bindPsychoTestEvents() {
    document.querySelectorAll('.test-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleTestStart(e));
    });
  }

  handleTestStart(e) {
    const testType = e.currentTarget.dataset.test.toUpperCase();
    showLoading('#resultSection');
    
    if (['SDS', 'SAS','EES'].includes(testType)) {
      const resultSection = document.getElementById('resultSection');
      if (resultSection) {
        resultSection.innerHTML = this.createTestLandingPage(testType);
        this.bindTestLandingEvents(testType);
      }
    }
  }

  createTestLandingPage(testType) {
    const testInfo = {
      SDS: {
        title: "抑郁自评量表（SDS）",
        emoji: "😔",
        description: "该量表包含20个题目，可快速评估您的抑郁倾向程度。测试结果将根据标准分自动分析并给出建议。",
        instructions: [
          "测试时长：约3-5分钟",
          "题目类型：单选题",
          "结果保密：仅存储于本地浏览器"
        ]
      },
      SAS: {  
        title: "焦虑自评量表（SAS）",
        emoji: "😰",
        description: "该量表包含20个题目，用于评估焦虑症状的严重程度。测试结果将根据标准分提供专业建议。",
        instructions: [
          "测试时长：约3-5分钟", 
          "按最近一周实际感受作答",
          "结果仅用于自我评估参考"
        ]
      },
      EES: {
        title: "艾森克情绪稳定性测试（EES）",
        emoji: "😌",
        description: "本测试包含7个维度共78题，用于评估情绪稳定性、焦虑程度和心理承受力等核心心理素质。",
        instructions: [
          "测试时长：约15-20分钟",
          "采用7分量表评估",
          "自动生成心理素质分析报告"
        ]
      }
    }[testType];

    return `
      <div class="test-landing">
        <div class="test-header">
          <h2>${testInfo.emoji} ${testInfo.title}</h2>
          <button class="btn-back">← 返回测评中心</button>
        </div>
        <div class="test-overview">
          <div class="test-description">
            <p>${testInfo.description}</p>
            <ul class="test-instructions">
              ${testInfo.instructions.map(i => `<li>📌 ${i}</li>`).join('')}
            </ul>
          </div>
          <div class="test-actions">
            <button class="btn-start">立即开始测试</button>
          </div>
        </div>
      </div>
    `;
  }

  bindTestLandingEvents(testType) {
    document.querySelector('.btn-back')?.addEventListener('click', () => {
      this.renderHealthDashboard(this.currentBMI);
    });

    document.querySelector('.btn-start')?.addEventListener('click', async () => {
      try {
        const dataPath = {
          SDS: '/health-assistant/data/sds_questions.json',
          SAS: '/health-assistant/data/sas_questions.json',
          EES: '/health-assistant/data/ees_questions.json'
        }[testType];
        
        const questions = await fetchLocalData(dataPath);
        
        if (testType === 'EES') {
          this.eesTest = new EESTest(questions, this);
          this.eesTest.renderQuestion();
        } else if (testType === 'SDS') {  
          this.sdsTest = new SDSTest(questions, this);
          this.sdsTest.renderQuestion();
        } else if (testType === 'SAS') {
          this.sasTest = new SASTest(questions, this);
          this.sasTest.renderQuestion(); 
        }
      } catch (error) {
        this.showError('无法加载测试题目');
      }
    });

    document.querySelector('.btn-sample')?.addEventListener('click', () => {
      console.log('显示示例报告');
    });
  }

  bindPlanTaskEvents() {
    document.querySelectorAll('.daily-tasks input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', e => {
        const taskId = e.target.dataset.task;
        this.toggleTask(taskId);
      });
    });

    document.querySelector('.btn-regenerate')?.addEventListener('click', () => {
      this.generateHealthPlan();
    });
  }

  createWaterCard() {
    const progress = (this.waterData.current / this.waterData.target * 100).toFixed(1);
    const today = new Date().toLocaleDateString();
    return `
      <div class="water-card">
        <h3>💧 今日饮水计划（${today}）</h3>
        <div class="water-progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
          <div class="progress-text">
            <span>${this.waterData.current}ml</span>
            <span>目标 ${this.waterData.target}ml</span>
          </div>
        </div>
        <div class="water-controls">
          <input type="number" id="waterInput" min="100" max="1000" 
                 placeholder="输入水量 (ml)" class="water-input">
          <div class="quick-add-btns">
            <button class="btn-water-add" data-amount="200">+200ml</button>
            <button class="btn-water-add" data-amount="500">+500ml</button>
          </div>
        </div>
        <div class="water-history">
          <div class="history-header">
            <h4>📅 最近7天记录</h4>
            <button class="btn-water-reset">↩️ 重置当前进度</button>
          </div>
          ${this.waterData.history.slice(-7).reverse().map(record => `
            <div class="health-history-item">
              <span>${new Date(record.date).toLocaleDateString()}</span>
              <span>${record.amount}ml</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  bindWaterEvents() {
    document.getElementById('waterInput')?.addEventListener('change', (e) => {
      this.handleWaterInput(parseInt(e.target.value));
    });

    document.querySelectorAll('.btn-water-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = parseInt(e.target.dataset.amount);
        this.handleQuickAdd(amount);
      });
    });
    document.querySelector('.btn-water-reset')?.addEventListener('click', () => {
        this.waterData.current = 0;
        this.saveWaterData();
        this.renderHealthDashboard(this.currentBMI);
    });
  }

  handleWaterInput(amount) {
    if (!isNaN(amount) && amount > 0) {
      this.waterData.current = Math.min(this.waterData.current + amount, this.waterData.target);
      this.saveWaterData();
      this.renderHealthDashboard(this.currentBMI);
    }
  }

  handleQuickAdd(amount) {
    const validAmount = parseInt(amount) || 0; 
    if (validAmount > 0) {
        this.waterData.current = Math.min(
            Number(this.waterData.current) + validAmount,
            this.waterData.target
        );
        this.saveWaterData();
        this.renderHealthDashboard(this.currentBMI);
    } else {
        this.showError('请输入有效的饮水量');
    }
}

  saveWaterData() {
    const today = new Date().toISOString().split('T')[0];
    const existingIndex = this.waterData.history.findIndex(h => h.date.startsWith(today));
    
    if (existingIndex !== -1) {
        this.waterData.history[existingIndex].amount = this.waterData.current;
    } else {
        this.waterData.history.push({
            date: today,
            amount: this.waterData.current
        });
    }
    
    localStorage.setItem('waterHistory', JSON.stringify(this.waterData.history.slice(-7)));
}

  createDietCard() {
    const progress = (this.dietData.current / this.dietData.target * 100).toFixed(1);
    const today = new Date().toLocaleDateString();
    return `
      <div class="diet-card">
        <div class="diet-header">
          <h3>🍴 今日饮食记录（${today}）</h3>
          <button class="btn-diet-reset">↩️ 重置当天进度</button>
        </div>
        <div class="diet-progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
          <div class="progress-text">
            <span>${this.dietData.current}kcal</span>
            <span>目标 ${this.dietData.target}kcal</span>
          </div>
        </div>
        ${this.createDietControls()}
      </div>
    `;
  }

  createDietControls() {
    return `
      <div class="diet-controls">
        <select id="mealType" class="diet-input">
          <option value="早餐">🍳 早餐</option>
          <option value="午餐">🍱 午餐</option>
          <option value="晚餐">🍲 晚餐</option>
          <option value="加餐">🍎 加餐</option>
        </select>
        <input type="text" id="foodName" 
               placeholder="输入食物名称（如：燕麦粥）" 
               class="diet-input">
        <input type="number" id="dietInput" min="0" 
               placeholder="热量 (kcal)" class="diet-input">
        <button class="btn-diet-add">+ 添加</button>
      </div>
      <div class="diet-history">
        <h4>📅 最近7天记录</h4>
        ${this.dietData.history.slice(-7).reverse().map(record => `
          <div class="diet-history-item">
            <span class="record-date">${new Date(record.date).toLocaleDateString()}</span>
            <span class="meal-type">${record.mealType || '未分类'}</span>
            <span class="food-name">${record.foodName || '未知食物'}</span>
            <span class="calories">${Math.abs(record.calories) || 0}kcal</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  bindDietEvents() {
    document.querySelector('.btn-diet-add')?.addEventListener('click', () => {
      const input = document.getElementById('dietInput');
      const mealType = document.getElementById('mealType').value;
      const foodName = document.getElementById('foodName').value.trim();
      const calories = parseInt(input.value) || 0;

      if (calories > 0 && foodName) {
        this.dietData.current += calories;
        this.saveDietData(mealType, foodName, calories); 
        this.renderHealthDashboard(this.currentBMI);
        input.value = '';
        document.getElementById('foodName').value = '';
      }
    });

    document.querySelector('.btn-diet-reset')?.addEventListener('click', () => {
      this.dietData.current = 0;
      this.dietData.history = this.dietData.history.filter(record => 
          !record.date.startsWith(new Date().toISOString().split('T')[0])
      );
      localStorage.setItem('dietHistory', JSON.stringify(this.dietData.history));
      this.renderHealthDashboard(this.currentBMI); 
    });
  }

  saveDietData(mealType, foodName, calories) {
    const today = new Date().toISOString().split('T')[0];
    const record = {
      date: today,
      mealType,
      foodName,
      calories
    };

    const existingIndex = this.dietData.history.findIndex(h => 
      h.date.startsWith(today) && 
      h.mealType === mealType &&
      h.foodName === foodName
    );
    
    if (existingIndex !== -1) {
      this.dietData.history[existingIndex].calories += calories;
    } else {
      this.dietData.history.push(record);
    }
    
    localStorage.setItem('dietHistory', JSON.stringify(this.dietData.history.slice(-28)));
    localStorage.setItem('dietCurrent', this.dietData.current);
  }

  getProgress(bmi) {
    return Math.min(Math.max((bmi - 16) / 24 * 100, 0), 100);
  }

  getHealthAdvice(bmi) {
    const ageFactor = this.formData.age < 18 ? 0.95 : 1;
    let category, advice, waterTarget;

    if (bmi < 18.5 * ageFactor) {
      category = '过轻';
      waterTarget = 2500;
      advice = [
        "建议每日增加300-500大卡热量摄入",
        "优先选择高蛋白食物如鸡蛋、牛奶",
        "每周进行3次力量训练"
      ];
    } else if (bmi < 24 * ageFactor) {
      category = '健康';
      waterTarget = 2000;
      advice = [
        "保持均衡饮食结构",
        "每周至少150分钟中等强度运动",
        "定期监测体脂率"
      ];
    } else {
      category = '超重';
      waterTarget = 3000;
      advice = [
        "控制每日热量摄入",
        "增加膳食纤维摄入",
        "每周至少300分钟有氧运动"
      ];
    }
    this.waterData.target = waterTarget;
    return { category, advice, waterTarget };
  }

  showError(message) {
    const container = document.getElementById('bmiForm');
    if (!container) return;

    const errorElem = createElement('div', 'alert alert-danger', {
      'role': 'alert'
    });
    errorElem.innerHTML = message;
    
    container.parentNode.insertBefore(errorElem, container.nextSibling);
    setTimeout(() => errorElem.remove(), 3000);
  }

  showSuccess(message) {
    const container = document.getElementById('bmiForm');
    if (!container) return;

    const successElem = createElement('div', 'alert alert-success', {
      'role': 'alert'
    });
    successElem.innerHTML = message;
    
    container.parentNode.insertBefore(successElem, container.nextSibling);
    setTimeout(() => successElem.remove(), 3000);
  }

  saveToStorage() {
    localStorage.setItem('healthData', JSON.stringify(this.formData));
  }

  loadSavedData() {
    const savedData = JSON.parse(localStorage.getItem('healthData') || '{}');
    Object.entries(savedData).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (input) input.value = value;
    });
  }

  saveToHistory(bmi) {
    this.history.push({
      date: new Date().toLocaleString(),
      bmi: parseFloat(bmi),
      data: { ...this.formData }
    });
    localStorage.setItem('healthHistory', JSON.stringify(this.history.slice(-10)));
  }

  addFoodRecognition() {
    const container = document.createElement('div');
    container.className = 'food-recognition';
    container.innerHTML = `
      <h3>📷 AI识图算热量</h3>
      <div class="upload-section">
        <input type="file" id="foodPhoto" accept="image/*" class="upload-input">
        <label for="foodPhoto" class="btn-upload">
          <span>📤 上传食物照片</span>
          <small>(支持JPG/PNG，最大2MB)</small>
        </label>
        <div class="preview-container"></div>
      </div>
      <div class="recognition-result"></div>
    `;
    document.querySelector('.diet-card')?.before(container);
    container.querySelector('#foodPhoto').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        this.showError('文件大小超过2MB限制');
        return;
      }

      const preview = container.querySelector('.preview-container');
      preview.innerHTML = `<img class="food-preview" src="${URL.createObjectURL(file)}">`;

      try {
        const calories = await this.recognizeFood(file);
        container.querySelector('.recognition-result').innerHTML = `
          <div class="calorie-info">
            <span class="ai-label">AI估算热量：</span>
            <strong>${calories}kcal</strong>
            <button class="btn-apply" onclick="document.getElementById('dietInput').value=${calories}">💡 应用此数值</button>
          </div>
        `;
      } catch (error) {
        this.showError('识别失败，请尝试清晰的菜品照片');
      }
    });

    
  }

  async recognizeFood(file) {
      const apiKey = '2d2890e3eb4e44beb74ca74d90448fe4.3ESsg6u5Nv8vvsBo';
      const base64 = await this.convertToBase64(file);
      
      console.log('Base64长度:', base64.length);
      console.log('API请求负载:', {
        model: "glm-4v-flash",
        messages: [{
          "role": "user",
          "content": [
            {
              "type": "image_url",
              "image_url": {"url": `data:image/jpeg;base64,${base64.substr(0, 20)}...`} 
            },
            {
              "type": "text", 
              "text": `请执行以下操作：
1. 识别图片中的主要食物成分（包含烹饪方式和分量估算）
2. 根据中国居民膳食指南进行热量计算
3. 按以下格式响应：
"""
食物分析：
- {食物1} ({分量估算})
- {食物2} ({分量估算})
热量计算：
{总热量}千卡（基于标准份量计算）
最终结果：[{纯数字}]
"""` 
            }
          ]
        }]
      });
  
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "glm-4v-flash",
          messages: [{
            "role": "user",
            "content": [
              {
                "type": "image_url",
                "image_url": {"url": `data:image/jpeg;base64,${base64}`}
              },
              {
                "type": "text", 
                "text": `请识别图片中的食物并估算热量（千卡），只需返回纯数字。例如：'350'`
              }
            ]
          }]
        })
      });
  
      if (!response.ok) {
        console.error('API请求失败:', {
          status: response.status,
          headers: response.headers,
          body: await response.text()
        });
        return 0;
      }
  
      const data = await response.json();
      console.log('完整API响应:', data); 
      
      const result = data.choices?.[0]?.message?.content;
      if (!result) return 0;
      
      const text = data.choices[0].message.content;
      const lastNumberMatch = text.match(/(\d+)(?!.*\d)/); 
      const calories = lastNumberMatch ? parseInt(lastNumberMatch[1]) : 0;
      
      console.log('增强解析结果:', { 
        rawText: text,
        parsedCalories: calories 
      });
      
      return calories;
    }

  convertToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
  }
}

class SDSTest {
  constructor(questionData, parentModule) {
    this.questionData = questionData;
    this.questions = questionData.questions;
    this.reverseScoring = new Set(questionData.reverseScoring);
    this.answers = [];
    this.currentQuestion = 0;
    this.parentModule = parentModule;  
    this.answerHistory = []; 
  }

  renderQuestion() {
    const resultSection = document.getElementById('resultSection');
    if (!resultSection) return;

    resultSection.style.opacity = '0'; 
    setTimeout(() => {
      const question = this.questions[this.currentQuestion];
      resultSection.innerHTML = `
        <div class="sds-test-container">
          <div class="test-header">
            <button class="btn-back">← 返回测评中心</button>
          </div>
          <div class="progress-bar">
            <div class="progress" style="width: ${(this.currentQuestion / 20) * 100}%"></div>
          </div>
          <div class="question-container">
            <div class="question-number">第 ${this.currentQuestion + 1} 题 / 共 20 题</div>
            <div class="question-text">${question.text}</div>
            <div class="options">
              ${question.options.map(opt => `
                <button class="option-btn" 
                  data-score="${opt.score}" 
                  data-reverse="${this.reverseScoring.has(question.id)}">
                  ${opt.label}
                </button>
              `).join('')}
            </div>
            <div class="question-navigation">
              ${this.currentQuestion > 0 ? 
                '<button class="btn-prev">← 上一题</button>' : ''}
              <div class="progress-text">${this.currentQuestion + 1}/20</div>
            </div>
          </div>
        </div>
      `;
      resultSection.style.opacity = '1'; 

      document.querySelector('.btn-back')?.addEventListener('click', () => {
        this.parentModule.renderHealthDashboard(this.parentModule.currentBMI);
      });

      const progressBar = resultSection.querySelector('.progress');
      if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0';
        setTimeout(() => {
          progressBar.style.transition = 'width 0.3s ease';
          progressBar.style.width = `${(this.currentQuestion / 20) * 100}%`;
        }, 10);
      }

      this.bindOptionEvents();
      this.bindNavEvents();
    }, 300);
  }

  bindOptionEvents() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const value = parseInt(e.target.dataset.score);
        const isReverse = e.target.dataset.reverse === 'true';
        this.recordAnswer(value, isReverse);

        if (this.currentQuestion < 19) {
          this.currentQuestion++;
          this.renderQuestion();
        } else {
          this.calculateResult();
        }
      });
    });
  }

  bindNavEvents() {
    const prevButton = document.querySelector('.btn-prev');
    if (prevButton) {
      prevButton.onclick = null; 
      prevButton.addEventListener('click', () => {
        if (this.currentQuestion > 0) {
          this.currentQuestion--;
          this.answers.length = this.currentQuestion + 1; 
          this.renderQuestion();
        }
      });
    }
  }

  recordAnswer(selectedScore, isReverse) {
    const finalScore = isReverse ? 5 - selectedScore : selectedScore;
    this.answers[this.currentQuestion] = finalScore; 
  }

  calculateResult() {
    const rawScore = this.answers.reduce((a, b) => a + b, 0);
    const standardScore = Math.min(Math.round(rawScore * 1.25), 100);

    const cutoff = this.questionData.scoringRules.standard.cutoffs
      .find(c => standardScore < c.score);

    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
      resultSection.innerHTML = `
        <div class="test-result">
          <h3>${this.questionData.scaleName} 结果</h3>
          <div class="score">标准分：${standardScore}</div>
          <div class="conclusion">${cutoff.label}</div>
          
          <div class="scoring-criteria">
            <h4>📊 评分标准</h4>
            <ul>
              ${this.questionData.scoringRules.standard.cutoffs.map(c => `
                <li ${standardScore < c.score ? 'class="active"' : ''}>
                  <span class="range">${c.range}</span>
                  <span class="label">${c.label}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="advice-section">
            <h4>📌 专家建议</h4>
            <div class="advice-content">
              ${cutoff.advice.map(a => `<p>${a}</p>`).join('')}
            </div>
          </div>

          <button class="btn-back">返回测评中心</button>
        </div>
      `;
      document.querySelector('.btn-back').addEventListener('click', () => {
        this.parentModule.renderHealthDashboard(this.parentModule.currentBMI);
      });
    }
  }
}

class SASTest extends SDSTest {
  constructor(questionData, parentModule) {
    super(questionData, parentModule);
    this.testType = 'SAS'; 
  }
  
}

class EESTest extends SDSTest {
  constructor(questionData, parentModule) {
    super(questionData, parentModule);
    this.testType = 'EES';
    this.totalQuestions = this.questions.length; 
    
    if (this.totalQuestions !== 78) {
      console.error('EES题目数量异常，应为78题，实际加载：', this.totalQuestions);
      this.parentModule.showError('测试数据异常，请刷新重试');
    }
  }

  renderQuestion() {
    const resultSection = document.getElementById('resultSection');
    if (!resultSection) return;

    resultSection.style.opacity = '0';
    setTimeout(() => {
      if (
        this.currentQuestion < 0 || 
        this.currentQuestion >= this.questions.length ||
        !this.questions[this.currentQuestion]
      ) {
        console.error('题目索引异常', {
          current: this.currentQuestion,
          total: this.questions.length,
          question: this.questions[this.currentQuestion]
        });
        this.currentQuestion = Math.max(0, Math.min(this.currentQuestion, this.questions.length - 1));
        return;
      }
      
      const question = this.questions[this.currentQuestion];
      if (!question?.text) { 
        this.parentModule.showError('题目加载失败，请重试测试');
        return;
      }

      const progressPercent = (this.currentQuestion / this.totalQuestions * 100).toFixed(1);
      resultSection.innerHTML = `
        <div class="ees-test-container">
          <div class="test-header">
            <button class="btn-back">← 返回测评中心</button>
          </div>
          <div class="progress-bar">
            <div class="progress" style="width: ${progressPercent}%"></div>
          </div>
          <div class="question-container">
            <div class="question-number">第 ${this.currentQuestion + 1} 题 / 共 ${this.totalQuestions} 题</div>
            <div class="question-text">${question.text}</div>
            <div class="options">
              ${question.options.map(opt => `
                <button class="option-btn" data-score="${opt.score}">
                  ${opt.label}
                </button>
              `).join('')}
            </div>
            <div class="question-navigation">
              ${this.currentQuestion > 0 ? '<button class="btn-prev">← 上一题</button>' : ''}
            </div>
          </div>
        </div>
      `;
      document.querySelector('.btn-back')?.addEventListener('click', () => {
        this.parentModule.renderHealthDashboard(this.parentModule.currentBMI);
      });

      const progressBar = resultSection.querySelector('.progress');
      if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0';
        setTimeout(() => {
          progressBar.style.transition = 'width 0.3s ease';
          progressBar.style.width = `${progressPercent}%`;
        }, 10);
      }

      this.bindOptionEvents();
      this.bindNavEvents();
      resultSection.style.opacity = '1';
    }, 300);
  }

  bindOptionEvents() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.currentQuestion >= this.totalQuestions - 1) {
          this.calculateResult(); 
          return;
        }
        
        const value = parseInt(e.target.dataset.score);
        this.recordAnswer(value, false);
        
        this.currentQuestion = Math.min(this.currentQuestion + 1, this.totalQuestions - 1);
        this.renderQuestion();
      });
    });
  }

  calculateDimensionScores() {
    const dimensionMap = new Map();
    this.questions.forEach((q, index) => {
      const dimension = q.dimension?.trim() || '未分类';
      if (!dimensionMap.has(dimension)) {
        dimensionMap.set(dimension, []);
      }
      if (typeof this.answers[index] === 'number') {
        dimensionMap.get(dimension).push(this.answers[index]);
      }
    });
    
    return Array.from(dimensionMap).map(([dim, scores]) => ({
      dimension: dim,
      average: scores.length > 0 
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : 0
    }));
  }

  calculateResult() {
    const dimensionResults = this.calculateDimensionScores();
    
    const resultSection = document.getElementById('resultSection');
    resultSection.innerHTML = `
      <div class="test-result">
        <h3>${this.questionData.scaleName} 多维分析报告</h3>
        ${dimensionResults.map(d => `
          <div class="dimension-score">
            <h4>${d.dimension}</h4>
            <div class="score-bar" style="width: ${(d.average / 7 * 100).toFixed(1)}%"></div>
            <span>${d.average.toFixed(1)}/7</span>
          </div>
        `).join('')}

        <div class="scoring-criteria">
          <h4>📊 整体评估标准</h4>
          <ul>
            ${this.questionData.scoringRules.standard.cutoffs.map(c => `
              <li>
                <span class="range">${c.score}分以下</span>
                <span class="label">${c.label}</span>
                <div class="analysis">${c.analysis}</div>
              </li>
            `).join('')}
          </ul>
        </div>

        <button class="btn-back">返回测评中心</button>
      </div>
    `;
    
    document.querySelector('.btn-back').addEventListener('click', () => {
      this.parentModule.renderHealthDashboard(this.parentModule.currentBMI);
    });
  }
}

export default new HealthModule();
if (typeof window !== 'undefined') {
  window.HealthModule = HealthModule;
}