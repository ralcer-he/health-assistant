class ArthrosisModule {
    constructor() {
        this.reliefMethods = null; // 移除硬编码数据
        this.dataLoaded = false;
    }

    // 修改数据加载方法
    async loadReliefData() {
        try {
            // 使用绝对路径确保访问正确
            const response = await fetch('/health-assistant/data/arthrosis_data.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`); // 显示具体错误
            }
            
            // 添加内容类型验证
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                throw new Error('响应不是有效的JSON格式');
            }

            const data = await response.json();
            
            // 添加数据验证
            if (!data?.reliefMethods) {
                throw new Error('JSON数据结构异常');
            }
            
            this.reliefMethods = data.reliefMethods;
            this.dataLoaded = true;
            
        } catch (error) {
            console.error('加载疼痛数据失败:', error);
            this.showDataError(`数据加载失败: ${error.message}`); // 传递具体错误信息
        }
    }

    // 修改错误提示方法
    showDataError(message = '未知错误') {
        const reliefResults = document.getElementById('reliefResults');
        if (reliefResults) {
            reliefResults.innerHTML = `
                <div class="error-alert">
                    ⚠️ ${message}
                    <br><small>建议操作：刷新页面或检查网络连接</small>
                </div>
            `;
        }
    }

    // 在初始化时添加加载状态提示
    async init({ container }) {
        this.container = document.querySelector(container);
        if (!this.container) return;
        
        // 添加加载中提示
        this.container.innerHTML = `<div class="loading">正在加载疼痛数据库...</div>`;
        
        try {
            await this.loadReliefData();
            this.renderInterface();
            this.bindEvents();
        } catch (error) {
            this.container.innerHTML = `<div class="error">初始化失败: ${error.message}</div>`;
        }
    }
      // 新增AI建议获取方法
    // 修改getAISuggestion方法
    // 修改getAISuggestion方法的提示语和格式处理
    async getAISuggestion(painPoint, symptoms) {
        try {
            const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer 2d2890e3eb4e44beb74ca74d90448fe4.3ESsg6u5Nv8vvsBo'
                },
                body: JSON.stringify({
                    model: "glm-4-flash",
                    messages: [{
                        role: "user",
                        content: `作为骨科专家，请用通俗易懂的方式为${painPoint}疼痛患者提供自用建议。患者症状：${symptoms}。
                        要求返回严格JSON格式：{ 
                            "aiAdvice": "按以下格式（每个建议换行）：\n1. 第一条自用建议\n2. 第二条自用建议\n3. 第三条自用建议"
                        } 包含3-5条实用建议，用中文回答，每条以数字开头，不超过40字`
                    }],
                    response_format: { type: "json_object" }
                })
            });
    
            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);

            return result;
        } catch (error) {
            console.error('AI建议获取失败:', error);
            return { aiAdvice: null };
        }
    }
    // 修改后的showReliefMethods方法
    async showReliefMethods() {
        if (!this.dataLoaded) {
            document.getElementById('reliefResults').innerHTML = 
                '<p class="error">数据未加载完成，请稍后重试</p>';
            return;
        }
    
        const jointInput = document.getElementById('jointInput').value.trim();
        const reliefResults = document.getElementById('reliefResults');
        
        // 显示加载动画
        reliefResults.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
            </div>
        `;
    
        if (!jointInput) {
            reliefResults.innerHTML = '<p class="error">请输入疼痛的关节名称。</p>';
            return;
        }
    
        try {
            // 修改数据库存在时的逻辑分支
            if (this.reliefMethods[jointInput]) {
            // 获取AI建议
            const symptoms = document.getElementById('symptomsInput').value;
            const { aiAdvice } = await this.getAISuggestion(jointInput, symptoms);
            
            // 修复建议展示逻辑
            const adviceSection = aiAdvice ? `
                <div class="ai-advice">
                    <h4>🧠 智能分析建议</h4>
                    <div class="ai-content">${aiAdvice}</div>
                </div>
            ` : '';

            const methods = this.reliefMethods[jointInput].basic // 访问基础建议
                .map((method, index) => `
                    <div class="relief-method">
                        <div class="method-index">${index + 1}</div>
                        <div class="method-content">${method}</div>
                    </div>
                `).join('');
            
            // 添加阶段建议
            const stageTips = Object.entries(this.reliefMethods[jointInput].stages)
                .map(([stage, tips]) => `
                    <div class="stage-advice">
                        <h4>${stage === 'acute' ? '🆘 急性期' : '🩺 慢性期'}建议</h4>
                        <ul>${tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
                    </div>
                `).join('');
            reliefResults.innerHTML = `
                <div class="relief-header">
                    <div class="method-icon">❄️</div>
                    <h3>${jointInput} 缓解方案</h3>
                </div>
                <div class="relief-methods-container">${methods}</div>
                <div class="stage-container">${stageTips}</div>
                ${adviceSection}  
                <div class="medical-note">
                    ⚠️ 温馨提示：建议根据自身情况调整方案，持续疼痛请及时就医
                </div>
            `;
        } else {
            // 新增AI全方案生成
            const symptoms = document.getElementById('symptomsInput').value;
            const aiData = await this.generateAISuggestions(jointInput, symptoms);
            
            // 新增智能建议模块
            const aiAdviceSection = aiData?.aiAdvice ? `
                <div class="ai-advice">
                    <h4>🧠 智能分析建议</h4>
                    <div class="ai-content">${aiData.aiAdvice}</div>
                </div>
            ` : '';
            
            const methods = aiData.basic
                .map((method, index) => `
                    <div class="relief-method ai-generated">
                        <div class="method-index">${index + 1}</div>
                        <div class="method-content">${method}</div>
                    </div>
                `).join('');
            
            const stageTips = Object.entries(aiData.stages)
                .map(([stage, tips]) => `
                    <div class="stage-advice">
                        <h4>${stage === 'acute' ? '🆘 急性期' : '🩺 慢性期'}建议</h4>
                        <ul>${tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
                    </div>
                `).join('');
            reliefResults.innerHTML = `
                <div class="relief-header">
                    <div class="method-icon">🤖</div>
                    <h3>AI生成 ${jointInput} 缓解方案</h3>
                </div>
                <div class="relief-methods-container">${methods}</div>
                <div class="stage-container">${stageTips}</div>
                ${aiAdviceSection}
                <div class="medical-note">
                    💡 此方案由AI智能生成，仅供参考使用
                </div>
            `;
        }

    } catch (error) {
        reliefResults.innerHTML = `<p class="error">方案获取失败: ${error.message}</p>`;
    }
}

// 新增AI全方案生成方法
async generateAISuggestions(joint, symptoms) {
    try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 2d2890e3eb4e44beb74ca74d90448fe4.3ESsg6u5Nv8vvsBo'
            },
            body: JSON.stringify({
                model: "glm-4-flash",
                messages: [{
                    role: "user",
                    content: `作为骨科专家，请为${joint}疼痛患者生成居家自用方案。患者症状：${symptoms}。
                    要求返回严格JSON格式：{
                        "basic": ["3条实用建议"],
                        "stages": {
                            "acute": ["2条急性期自用方法"], 
                            "chronic": ["2条慢性期调理建议"]
                        },
                        "aiAdvice": "按以下格式（每个建议换行）：\n1. 第一条自用建议\n2. 第二条自用建议\n3. 第三条自用建议"
                    }  包含3-5条实用建议，用中文回答，每条以数字开头，不超过40字`
                }],
                response_format: { type: "json_object" }
            })
        });
    
        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        // 修复换行符转换逻辑
        result.aiAdvice = result.aiAdvice?.replace(/\n/g, '<br>') || '';
        return result;
    } catch (error) {
        console.error('AI方案生成失败:', error);
        throw new Error('AI服务暂不可用，请稍后重试');
    }
}
// 新增错误提示方法
showDataError() {
    const reliefResults = document.getElementById('reliefResults');
    if (reliefResults) {
        reliefResults.innerHTML = `
            <p class="error">⚠️ 数据加载失败，请检查网络连接后刷新页面</p>
        `;
    }
}

// 修改界面渲染方法
renderInterface() {
    this.container.innerHTML = `
        <section class="arthrosis-module">
            <h2 class="section-title">🦴 关节疼痛缓解</h2>
            <div class="arthrosis-content">
                <div class="arthrosis-image">
                    <img src="images/疼痛示意图.png" alt="人体关节图">
                </div>
                <div class="arthrosis-form">
                    <div class="input-hint">
                        <span class="hint-icon">💡</span> 
                        输入如图示部位和常见疼痛症状
                    </div>
                    <input type="text" id="jointInput" 
                               placeholder="例如：头痛，痛经，肩上"
                               class="smart-input">
                    <div class="symptom-input">
                        <textarea id="symptomsInput" 
                               placeholder="请描述具体症状（如：偏头痛、小腹拉扯痛、疼痛持续时间）"
                               class="smart-input"></textarea>
                    </div>
                    <button id="reliefBtn" class="btn-analyze-pain">
                        ⚡ 获取缓解方案
                    </button>
                    <div id="reliefResults"></div>
                </div>
            </section>
        `;
}

bindEvents() {
    const reliefBtn = document.getElementById('reliefBtn');
    reliefBtn.addEventListener('click', () => this.showReliefMethods());
}

cleanup() {
    // 清理逻辑
}
}

export default new ArthrosisModule();
