import { showLoading } from '../utils.js';

const API_KEY = '2d2890e3eb4e44beb74ca74d90448fe4.3ESsg6u5Nv8vvsBo';
const LITERATURE_DB_PATH = 'data/literature_db.json';

export  class AIModule {
  constructor() {
    this.chatHistory = [];
    this.isLoading = false;
    this.lastRequestTime = 0;
    this.MAX_RETRIES = 3;
    this.literatureData = null;
    this.responseMode = 'normal'; // 新增模式状态
  }

  async init({ container }) {
      this.container = document.querySelector(container);
      this.renderUI();
      await this.loadLiteratureData();
      this.bindEvents();
      this.addMessage(
          `我是你的AI健康伙伴小禾，在这里陪你守护每一份健康的小确幸～\n\n` +
          `📌 目前我最拿手的领域是：\n` +
          `✨ 高血压的日常管理\n` +
          `✨ 高血脂的饮食调节\n` +
          `✨ 痛风的预防小妙招\n` +
          `✨ 成年人/青少年肥胖的科学减重\n` +
          `✨ 糖尿病的控糖攻略\n\n` +
          `当然啦，其他健康问题也欢迎随时问我！虽然知识库还在成长中，但我会用心为你查找可靠建议～❤️\n\n` +
          `👉 试试这样问我：\n` +
          `“体检发现血脂偏高怎么办？”\n` +
          `“青少年减肥如何避免营养不足？”\n` +
          `“帮我做一个减肥计划（需点击健康计划模式）”\n\n` +
          `🩺 我们一起把健康变得简单又有温度吧！`, 
          false
      );
  }

  // 在loadLiteratureData中移除addMessage调用
  async loadLiteratureData() {
    try {
      const response = await fetch(LITERATURE_DB_PATH);
      
      // 添加响应状态检查
      if (!response.ok) {
          throw new Error(`HTTP错误 ${response.status}`);
      }
      
      // 验证内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
          throw new Error('无效的JSON响应');
      }
  
      this.literatureData = await response.json();
    } catch (error) {
      console.error('文献库加载失败:', error);
      // 改为控制台提示，避免DOM未就绪
      console.error('医学知识库加载失败，请联系管理员');
      this.literatureData = { docs: [] };
    }
  }

  // 修改renderUI方法中的textarea部分
  // 在renderUI方法中添加导出按钮
  renderUI() {
    this.container.innerHTML = `
      <div class="ai-wrapper">   
        <div class="ai-chat-container">   
          <div class="mode-switcher">
            <button class="mode-btn active" data-mode="normal">常规咨询</button>
            <button class="mode-btn" data-mode="plan">健康计划</button>
          </div>
          <div class="chat-history"></div>
          <div class="AI-input-group">
            <textarea id="aiInput" 
              placeholder="${this.responseMode === 'normal' ? 
                '请输入健康问题（示例：青少年BMI超标如何干预？）' : 
                '请输入健康需求（示例：请为糖尿病患者制定一周饮食计划）'}"
              rows="3"></textarea>
            <button class="btn-send">发送</button>
          </div>
          <div class="loading-indicator hidden">
            <div class="spinner"></div>
            思考中...
          </div>
          <div class="literature-sidebar"></div>
        <div class="plan-display-container hidden"></div>
        <div class="export-buttons hidden">
          <button class="btn-export-txt">导出文本</button>
          <button class="btn-export-pdf">导出PDF</button>
        </div>
      </div>
    `;
  }

  async sendToGLM(prompt) {
    try {
      // 请求频率控制
      if (Date.now() - this.lastRequestTime < 1500) {
        throw new Error('操作过于频繁，请稍后再试');
      }
      this.lastRequestTime = Date.now();

      this.toggleLoading(true);
      const systemPrompt = this.buildSystemPrompt();

      let response;
      for (let i = 0; i < this.MAX_RETRIES; i++) {
        response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            model: "glm-4-flash",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            top_p: 0.7,
            max_tokens: 1000
          })
        });

        if (response.status === 429) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, i) * 1000));
          continue;
        }
        break;
      }

      if (!response.ok) {
        throw new Error(`请求失败: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "未获取有效回答";
    } catch (error) {
      console.error('API请求错误:', error);
      return `服务暂不可用: ${error.message}`;
    } finally {
      this.toggleLoading(false);
    }
  }
    // 新增健康计划生成
  async generateHealthPlan(userProfile) {
    const prompt = `为以下用户生成健康计划：\n${JSON.stringify(userProfile)}\n包含饮食、运动、监测要求`;
    const response = await this.sendToGLM(prompt);
    return this._parsePlanResponse(response);
  }
    // 新增用药提醒整合
  addMedicationReminder(messageDiv, meds) {
    const reminderHtml = `
      <div class="med-reminder">
        <span>💊 下次服药时间：${new Date(Date.now() + 3600000).toLocaleTimeString()}</span>
        <button class="btn-remind">设置提醒</button>
      </div>
    `;
    messageDiv.insertAdjacentHTML('beforeend', reminderHtml);
  }

  // 私有方法：解析健康计划
  _parsePlanResponse(response) {
    const [diet, exercise, monitoring] = response.split('\n').filter(l => l);
    return {
      diet: diet?.replace('饮食建议:', '') || '暂无建议',
      exercise: exercise?.replace('运动方案:', '') || '暂无建议',
      monitoring: monitoring?.replace('监测要求:', '') || '暂无建议'
    };
  }

  // 修改buildSystemPrompt方法
  buildSystemPrompt() {
    const literatureContext = this.literatureData.docs
      .map(doc => `[${doc.id}] ${doc.title}`)
      .join('\n');

    const modePrompts = {
      normal: `作为健康顾问用口语化回答（100字内），基于以下指南：
      ${literatureContext}
      回答要求：
      1. 使用专业但亲切的语气，避免过度口语化
      2. 直接回答问题，不要使用"哎呀"等感叹词开头
      3. 不单独列出参考文献
      4. 全部以txt的格式输出，且排版规整
      5. 保持专业性的同时适当使用生活化表达
      6. 示例回答格式：
         "根据您的情况，建议..."
         "这个问题需要考虑..."
         "通常我们会建议..."`,


      plan: `作为健康管理师生成可执行计划，基于以下指南：
      ${literatureContext}
      回答要求：
      1. 必须生成完整7天计划，表格包含日期、三餐、运动、监测四部分
      2. 表格格式严格使用：
        | 星期 | 早餐 | 午餐 | 晚餐 | 运动项目 | 监测指标 |
      3. 每餐格式必须为：餐名（食材说明，热量，成本），如：
         早餐：全麦三明治（全麦面包2片、煎蛋1个、生菜2片，约350大卡，成本约6元）
         午餐：香煎鸡胸肉（鸡胸肉150g、橄榄油5ml，约280大卡，成本约8元） 
         晚餐：蔬菜沙拉（生菜100g、小番茄50g、黄瓜50g，约120大卡，成本约5元）
      4. 运动项目必须包含至少两项，格式为：项目1（说明）+项目2（说明），如：跑步（30分钟，消耗300卡）+游泳（45分钟，消耗400卡）
      5. 监测指标必须包含至少两项，格式为：指标1（要求）+指标2（要求），如：血糖（空腹<6.1mmol/L）+血压（<140/90mmHg）
      6. 在表格最后添加【计划说明】卡片，总结饮食原则和注意事项
      7. 不允许出现任何分隔线或空行
      8. 必须严格遵循上述格式要求，否则视为无效响应`
    };

    return modePrompts[this.responseMode] || modePrompts.normal;
  }
    // 新增模式切换方法
  setResponseMode(mode) {
    this.responseMode = ['normal', 'plan'].includes(mode) ? mode : 'normal';
    this.addMessage(`已切换到${this.responseMode === 'normal' ? '常规' : '计划'}模式`, false);
  }

  addMessage(content, isUser = true) {
    const history = this.container.querySelector('.chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'ai'}`;
  
    if (isUser) {
      messageDiv.textContent = content;
    } else {
      this.formatAIResponse(content, messageDiv);

    }
  
    history.appendChild(messageDiv);
    history.scrollTop = history.scrollHeight;
  }

  // 新增PDF导出方法
  async exportToPDF(planContainer) {
    try {
      // 动态加载html2pdf.js库
      if (!window.html2pdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => this._generatePDF(planContainer);
        document.head.appendChild(script);
      } else {
        this._generatePDF(planContainer);
      }
    } catch (error) {
      console.error('PDF导出失败:', error);
      alert('PDF导出失败，请重试');
    }
  }

  // 实际生成PDF的方法
  // 修改_generatePDF方法
  _generatePDF(planContainer) {
    // 创建新的干净容器
    const pdfContainer = document.createElement('div');
    pdfContainer.style.width = '190mm';
    pdfContainer.style.padding = '10px';
    pdfContainer.style.backgroundColor = 'white';
    
    // 只复制需要的内容
    const content = planContainer.querySelector('.plan-block').cloneNode(true);
    pdfContainer.appendChild(content);
  
    // 添加打印优化样式
    const style = document.createElement('style');
    style.textContent = `
      body, html {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
      }
      .plan-block {
        background: white !important;
        box-shadow: none !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `;
    pdfContainer.appendChild(style);
  
    const opt = {
      margin: 0,
      filename: `健康计划_${new Date().toLocaleDateString()}.pdf`,
      image: {
        type: 'jpeg',
        quality: 1,
        background: 'white'
      },
      html2canvas: {
        scale: 1.5,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        removeContainer: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };
  
    document.body.appendChild(pdfContainer);
    
    // 使用setTimeout确保DOM完全加载
    setTimeout(() => {
      html2pdf().from(pdfContainer).set(opt).save().then(() => {
        document.body.removeChild(pdfContainer);
      });
    }, 100);
  }
  formatAIResponse(content, container) {
    const formattedContent = content
      .replace(/\[文献(\w+)\]/g, '<span class="ref-tag" data-doc="$1">[$1]</span>');
  
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-response-content';
  
    if (this.responseMode === 'plan') {
      const planContainer = this.container.querySelector('.plan-display-container');
      planContainer.innerHTML = this._formatPlanContent(formattedContent);
      planContainer.classList.remove('hidden');
      
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-view-plan';
      viewBtn.textContent = '查看完整健康计划';
      viewBtn.onclick = () => planContainer.scrollIntoView({ behavior: 'smooth' });
      contentDiv.appendChild(viewBtn);

      // 只保留新的导出按钮组代码
      const exportButtons = this.container.querySelector('.export-buttons');
      exportButtons.classList.remove('hidden');
      exportButtons.querySelector('.btn-export-txt').onclick = () => this.exportPlan(planContainer);
      exportButtons.querySelector('.btn-export-pdf').onclick = () => this.exportToPDF(planContainer);
    } else {
      // 新增常规模式内容处理
      contentDiv.innerHTML = formattedContent;
      this.container.querySelector('.plan-display-container')?.classList.add('hidden');
      this.container.querySelector('.export-buttons')?.classList.add('hidden');
      // 添加文献引用交互
      contentDiv.querySelectorAll('.ref-tag').forEach(tag => {
        tag.style.cursor = 'pointer';
        tag.addEventListener('click', () => this.showDocumentDetail(tag.dataset.doc));
      });
    }
  
    container.appendChild(contentDiv);
  }

  // 新增健康计划格式化方法
  // 修改_formatPlanContent方法
  _formatPlanContent(content) {
  // 分离说明内容和表格内容
  const summaryIndex = content.indexOf('【计划说明】');
  const summaryContent = summaryIndex > 0 ? content.substring(summaryIndex) : '';
  const tableContent = summaryIndex > 0 ? content.substring(0, summaryIndex) : content;
  
  return `
    <div class="plan-block">
      <div class="plan-header">
        <span class="plan-icon">📋</span>
        <h3>个性化健康计划</h3>
        <span class="plan-duration">7天执行方案</span>
      </div>
      
      ${summaryContent ? `
        <div class="plan-summary-card">
          <div class="plan-summary-content">
            ${summaryContent.replace('【计划说明】', '').trim()}
          </div>
        </div>
      ` : ''}
      
      ${this._renderTable(tableContent)}
    </div>`;
  }
  
  // 新增表格渲染方法
  // 修改_renderTable方法
  _renderTable(content) {
    const rows = content.split('\n').filter(line => 
      line.trim() && line.includes('|') && !line.includes('---')
    );
    
    if (rows.length < 2) return '<div class="plan-error">未获取有效计划数据</div>';
    
    return rows.slice(1).map(row => {
      const [date, breakfast, lunch, dinner, exercise, monitor] = 
        row.split('|').map(item => item.trim()).filter(Boolean);
      
      // 提取餐食说明
      const formatMeal = (meal) => {
        const match = meal.match(/(.+?)（(.*?)(?:，\s*([^，]+))?(?:，\s*([^，]+))?）/) || [null, meal, '', '', ''];
        return `<div class="meal-item">
          <div class="meal-name">${match[1]}</div>
          <div class="meal-info">
              ${match[2] ? `<div class="meal-line"><span class="meal-label">食材:</span>${match[2]}</div>` : ''}
              ${match[3] ? `<div class="meal-line"><span class="meal-label">热量:</span>${match[3]}</div>` : ''}
              ${match[4] ? `<div class="meal-line"><span class="meal-label">成本:</span>${match[4]}</div>` : ''}
          </div>
      </div>`;
      };
      
      return `
        <div class="plan-section-group">
          <div class="plan-day-header">${date}</div>
          <div class="plan-columns">
            <div class="diet-section">
              <div class="plan-subtitle">🍴 饮食安排</div>
              <div class="diet-grid">
                <div class="meal-card breakfast">
                  <div class="meal-title">早餐：</div>
                  ${formatMeal(breakfast)}
                </div>
                <div class="meal-card lunch">
                  <div class="meal-title">午餐：</div>
                  ${formatMeal(lunch)}
                </div>
                <div class="meal-card dinner">
                  <div class="meal-title">晚餐：</div>
                  ${formatMeal(dinner)}
                </div>
              </div>
            </div>
            <div class="activity-section">
              <div class="plan-subtitle">🏃 运动计划</div>
              <div class="exercise-card">${exercise}</div>
              <div class="plan-subtitle">📊 健康监测</div>
              <div class="monitor-card">${monitor}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  showDocumentDetail(docId) {
    const doc = this.literatureData.docs.find(d => d.id === docId);
    if (!doc) return;

    const sidebar = this.container.querySelector('.literature-sidebar');
    sidebar.innerHTML = `
      <div class="doc-detail">
        <h4>${doc.title}</h4>
        <div class="doc-meta">
          <span>版本: ${doc.version}</span>
          <span>发布机构: ${doc.publisher}</span>
        </div>
        <a href="${doc.file_path}" 
           target="_blank" 
           class="doc-link">
           查看完整文档
        </a>
      </div>
    `;
  }

  toggleLoading(show) {
    const loader = this.container.querySelector('.loading-indicator');
    loader.classList.toggle('hidden', !show);
    this.isLoading = show;
  }

  // 在 bindEvents 方法中添加以下代码
  bindEvents() {
    const sendBtn = this.container.querySelector('.btn-send');
    const input = this.container.querySelector('#aiInput');
  
    // 修改事件绑定方式，使用箭头函数保持this指向
    const handleSend = async () => {
      if (this.isLoading) return;
  
      const prompt = input.value.trim();
      if (!prompt) return;
  
      this.addMessage(prompt, true);
      input.value = '';
  
      try {
        const response = await this.sendToGLM(prompt);
        this.addMessage(response, false);
      } catch (error) {
        this.addMessage(`请求失败: ${error.message}`, false);
      }
    };
  
    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  
    // 修复模式切换事件绑定（确保在DOM加载后执行）
    setTimeout(() => {
      this.container.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = () => {  // 改用onclick直接赋值
          const mode = btn.dataset.mode;
          this.setResponseMode(mode);
          
          // 新增placeholder更新
          const input = this.container.querySelector('#aiInput');
          input.placeholder = mode === 'normal' ? 
            '请输入健康问题（示例：青少年BMI超标如何干预？）' : 
            '请输入健康需求（示例：请为II型糖尿病患者制定控糖计划）';
  
          // 添加按钮状态切换日志
          console.log('切换模式至:', mode);
          this.container.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b === btn);
          });
        };
      });
    }, 0); // 放入事件队列确保DOM就绪
  }
  // 新增导出方法
  exportPlan(planContainer) {
    const planContent = planContainer.innerText;
    const blob = new Blob([planContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `健康计划_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
export default new AIModule();
