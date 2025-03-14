// public/scripts/modules/health.js
import { fetchLocalData, showLoading, createElement } from '../utils.js';

export class HealthModule {
  constructor() {
    window.currentModule = this;
    this.formData = { age: '', height: '', weight: '' };
    
    try {
      this.history = JSON.parse(localStorage.getItem('healthHistory') || '[]');
      this.healthPlan = JSON.parse(localStorage.getItem('healthPlan') || '{}');
    } catch (e) {
      this.clearCorruptedData();
    }
    
    this.currentBMI = null;
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
    this.handleEvaluate = (e) => this.onSubmit(e);
    this.handleGenerate = () => this.generateHealthPlan();

    document.getElementById('bmiForm')?.addEventListener('submit', this.handleEvaluate);
    document.getElementById('planForm')?.addEventListener('submit', this.handleGenerate);
    this.handleReset = () => this.onReset();
    this.handleInput = () => this.onInput();

    document.getElementById('bmiForm')?.addEventListener('submit', this.handleSubmit);
    document.getElementById('resetBtn')?.addEventListener('click', this.handleReset);
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
    document.getElementById('bmiForm')?.removeEventListener('submit', this.handleEvaluate);
    document.getElementById('planForm')?.removeEventListener('submit', this.handleGenerate);
    document.getElementById('bmiForm')?.removeEventListener('submit', this.handleSubmit);
    document.getElementById('resetBtn')?.removeEventListener('click', this.handleReset);
    document.querySelectorAll('.form-input').forEach(input => {
      input.removeEventListener('input', this.handleInput);
    });
  }

  async onSubmit(e) {
    e.preventDefault();
    showLoading('#resultSection .result-content');
    
    try {
      const errors = this.validateInputs();
      if (errors.length) {
        this.showError(errors.join('\n'));
        return;
      }

      const bmi = this.calculateBMI();
      this.currentBMI = bmi;
      this.renderHealthDashboard(bmi);
      this.saveToHistory(bmi);
    } catch (error) {
      this.showError('评估失败，请检查输入');
    }
  }

  onReset() {
    this.formData = { age: '', height: '', weight: '' };
    document.getElementById('bmiForm')?.reset();
    document.getElementById('resultSection')?.classList.add('hidden');
    localStorage.removeItem('healthData');
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
      </div>
    `;

    this.bindPlanTaskEvents();
    this.bindPsychoTestEvents();
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

  // 修改 handleTestStart 方法
  handleTestStart(e) {
    const testType = e.currentTarget.dataset.test.toUpperCase(); // 统一转为大写
    showLoading('#resultSection');
    
    // 添加  支持
    if (['SDS', 'SAS','EES'].includes(testType)) {
      const resultSection = document.getElementById('resultSection');
      if (resultSection) {
        resultSection.innerHTML = this.createTestLandingPage(testType);
        this.bindTestLandingEvents(testType);
      }
    }
  }

  // 更新测试入口页面创建方法
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
      SAS: {  // 新增 SAS 配置
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
        } else if (testType === 'SDS') {  // 添加 else 保证互斥
          this.sdsTest = new SDSTest(questions, this);
          this.sdsTest.renderQuestion();
        } else if (testType === 'SAS') {
          // 修复点：添加SAS测试初始化逻辑
          this.sasTest = new SASTest(questions, this);
          this.sasTest.renderQuestion(); // 新增渲染调用
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

    // 修正选择器为 .btn-regenerate
    document.querySelector('.btn-regenerate')?.addEventListener('click', () => {
      this.generateHealthPlan();
    });
  }

  createBMICard(bmi) {
    if (bmi === null) return '<div class="bmi-result placeholder">请先进行健康评估</div>';

    const { category, advice } = this.getHealthAdvice(bmi);
    return `
      <div class="bmi-result">
        <h3>📝 健康报告</h3>
        <div class="bmi-value ${category}">
          <span>BMI</span>
          <strong>${bmi}</strong>
          <span class="category">${category}</span>
          <img src="/health-assistant/images/${category}.png" class="bmi-image" alt="BMI状态示意图">
        </div>
        
        <div class="progress-container">
          <div class="progress-bar" style="width: ${this.getProgress(bmi)}%"></div>
        </div>

        <div class="health-advice">
          <h4>📌 健康建议</h4>
          <ul>${advice.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  createHealthPlanCard() {
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
          .slice(0, 8)
          .map((task, index) => ({
            ...task,
            id: `task_${Date.now()}_${index}`,
            completed: false
          })),
        _version: '2.0'
      };

      localStorage.setItem('healthPlan', JSON.stringify(this.healthPlan));
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

  getProgress(bmi) {
    return Math.min(Math.max((bmi - 16) / 24 * 100, 0), 100);
  }

  getHealthAdvice(bmi) {
    const ageFactor = this.formData.age < 18 ? 0.95 : 1;
    let category, advice;

    if (bmi < 18.5 * ageFactor) {
      category = '过轻';
      advice = [
        "建议每日增加300-500大卡热量摄入",
        "优先选择高蛋白食物如鸡蛋、牛奶",
        "每周进行3次力量训练"
      ];
    } else if (bmi < 24 * ageFactor) {
      category = '健康';
      advice = [
        "保持均衡饮食结构",
        "每周至少150分钟中等强度运动",
        "定期监测体脂率"
      ];
    } else {
      category = '超重';
      advice = [
        "控制每日热量摄入",
        "增加膳食纤维摄入",
        "每周至少300分钟有氧运动"
      ];
    }

    return { category, advice };
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
}

class SDSTest {
  constructor(questionData, parentModule) {
    this.questionData = questionData;
    this.questions = questionData.questions;
    this.reverseScoring = new Set(questionData.reverseScoring);
    this.answers = [];
    this.currentQuestion = 0;
    this.parentModule = parentModule;  // 保存父模块引用
    this.answerHistory = []; // 新增回答历史记录
  }

  renderQuestion() {
    const resultSection = document.getElementById('resultSection');
    if (!resultSection) return;

    resultSection.style.opacity = '0'; // 添加淡出效果
    setTimeout(() => {
      const question = this.questions[this.currentQuestion];
      resultSection.innerHTML = `
        <div class="sds-test-container">
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
            
            <!-- 将导航按钮移动到题目容器内 -->
            <div class="question-navigation">
              ${this.currentQuestion > 0 ? 
                '<button class="btn-prev">← 上一题</button>' : ''}
              <div class="progress-text">${this.currentQuestion + 1}/20</div>
            </div>
          </div>
        </div>
      `;
      resultSection.style.opacity = '1'; // 淡入效果

      // 添加进度条动画
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
      this.bindNavEvents(); // 新增导航事件绑定
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
      // 先移除旧的监听器再添加新的
      prevButton.onclick = null; // 先清空事件
      prevButton.addEventListener('click', () => {
        if (this.currentQuestion > 0) {
          this.currentQuestion--;
          this.answers.length = this.currentQuestion + 1; // 保留之前的答案
          this.renderQuestion();
        }
      });
    }
  }

  recordAnswer(selectedScore, isReverse) {
    const finalScore = isReverse ? 5 - selectedScore : selectedScore;
    this.answers[this.currentQuestion] = finalScore; // 改为索引存储
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
          
          <!-- 新增建议部分 -->
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
        this.parentModule.renderHealthDashboard(this.parentModule.currentBMI);  // 使用父模块引用
      });
    }
  }
}
// 新建SAS测试类
class SASTest extends SDSTest {
  constructor(questionData, parentModule) {
    super(questionData, parentModule);
    this.testType = 'SAS'; // 用于区分测试类型
  }
  
  // 可覆盖父类方法实现差异逻辑
}
class EESTest extends SDSTest {
  constructor(questionData, parentModule) {
    super(questionData, parentModule);
    this.testType = 'EES';
    // 动态获取题目总数
    this.totalQuestions = this.questions.length; 
    
    // 新增数据完整性校验
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
      // 修复索引保护逻辑（修改此处）
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
        return; // 不再重置为0，而是限制在有效范围
      }
      
      const question = this.questions[this.currentQuestion];
      if (!question?.text) { // 加强空值检查
        this.parentModule.showError('题目加载失败，请重试测试');
        return;
      }

      const progressPercent = (this.currentQuestion / this.totalQuestions * 100).toFixed(1);
      resultSection.innerHTML = `
        <div class="ees-test-container">
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

      // 进度条动画逻辑（使用总题数）
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

  // 覆盖父类选项点击事件处理
  bindOptionEvents() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // 修改边界条件判断
        if (this.currentQuestion >= this.totalQuestions - 1) {
          this.calculateResult(); // 到达最后一题直接计算结果
          return;
        }
        
        const value = parseInt(e.target.dataset.score);
        this.recordAnswer(value, false);
        
        this.currentQuestion = Math.min(this.currentQuestion + 1, this.totalQuestions - 1);
        this.renderQuestion();
      });
    });
  
  }

  // 新增维度分数计算
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
      // 修复类型问题：先转为数值再保留一位小数
      average: scores.length > 0 
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : 0
    }));
  }

  // 覆盖结果计算方法
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

        <!-- 新增评分标准展示 -->
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