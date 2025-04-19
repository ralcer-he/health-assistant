import { showLoading, createElement } from './utils.js';

let currentModule = null;

const moduleMap = {
    recipe: './modules/recipe.js',
    health: './modules/health.js',
    disease: './modules/disease.js',
    ai: './modules/ai.js',
    // 新增关节疼痛模块映射
    arthrosis: './modules/arthrosis.js'
};

async function loadModule(moduleName) {
    try {
        if (currentModule?.cleanup) {
            await currentModule.cleanup();
        }

        showLoading('#contentContainer');

        const module = await import(moduleMap[moduleName]);
        currentModule = module.default;
        
        // 确保模块加载逻辑正确传递参数
        await currentModule.init({
          container: '#contentContainer',  // 必须包含 container 参数
          utils: { createElement }         // 其他原有参数
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] 模块加载失败:`, error);
        showModuleError(moduleName, error);
    }
}

function showModuleError(moduleName, error) {
    const container = document.getElementById('contentContainer');
    if (!container) return;

    const errorCard = createElement('div', 'module-error', {
        'role': 'alert',
        'tabindex': '-1'
    });
    
    errorCard.innerHTML = `
        <div class="error-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8l-4 4 4-4m0-8l4 4-4 4" />
            </svg>
        </div>
        <div class="error-message">
            <h4 class="text-danger">⚠️ 出现错误</h4>
            <p>${error.message}</p>
        </div>
        ${error.retry ? `<button class="btn btn-primary" onclick="${error.retry}">重试</button>` : ''}
    `;
    container.appendChild(errorCard);
    setTimeout(() => {
        container.removeChild(errorCard);
    }, 5000);
}

// 全局方法（需要在index.html的script标签中暴露）
window.retryLoad = (moduleName) => {
    loadModule(moduleName);
};

// 初始化事件监听
function initEventListeners() {
    const moduleButtons = [
        { id: 'recipeBtn', name: 'recipe' },
        { id: 'healthBtn', name: 'health' },
        { id: 'diseaseBtn', name: 'disease' },
        // 新增关节疼痛模块按钮配置
        { id: 'arthrosis', name: 'arthrosis' }
    ];

    moduleButtons.forEach(({ id, name }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-button').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                loadModule(name);
            });
        }
    });
    document.getElementById('aiChatBtn')?.addEventListener('click', () => loadModule('ai'));
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('应用初始化...');
    initEventListeners();
    
    loadModule('health');
});