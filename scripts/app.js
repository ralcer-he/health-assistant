import { showLoading, createElement } from './utils.js';

let currentModule = null;

const moduleMap = {
    recipe: './modules/recipe.js',
    health: './modules/health.js',
    disease: './modules/disease.js',
    ai: './modules/ai.js',
    // 新增关节疼痛模块映射
    arthrosis: './modules/arthrosis.js',
    // 新增经期计算模块映射
    period: './modules/period.js',
    // 新增睡眠辅助模块映射
    sleep: './modules/sleep.js'
};

async function loadModule(moduleName) {
    try {
        if (currentModule?.cleanup) {
            await currentModule.cleanup();
        }

        showLoading('#contentContainer');

        const module = await import(moduleMap[moduleName]);
        // 有些模块可能使用默认导出，有些使用命名导出，需要兼容两种方式
        const moduleExport = module.default || module[Object.keys(module)[0]];
        
        // 兼容多种模块导出方式：
        // 1. 如果是函数（类），则实例化
        // 2. 如果是对象，则直接使用
        if (typeof moduleExport === 'function') {
          // 对于导出类的模块
          currentModule = new moduleExport();
          
          // 检查实例是否有init方法
          if (typeof currentModule.init === 'function') {
            // 对于有init方法的模块（如period.js），调用其init方法
            await currentModule.init({
              container: '#contentContainer',  // 必须包含 container 参数
              utils: { createElement }         // 其他原有参数
            });
          } else {
            // 对于没有init方法但在构造函数中初始化的模块（如health.js），直接继续
            console.log(`模块 ${moduleName} 是类但没有init方法，使用构造函数初始化`);
          }
        } else {
          // 对于直接导出对象实例的模块（如recipe.js、ai.js、arthrosis.js）
          currentModule = moduleExport;
          
          // 检查对象是否有init方法
          if (typeof currentModule.init === 'function') {
            // 调用对象的init方法，并确保传递必要的参数
            await currentModule.init({
              container: '#contentContainer',  // 必须包含 container 参数
              utils: { createElement }         // 其他原有参数
            });
          }
        }

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
        { id: 'arthrosis', name: 'arthrosis' },
        // 新增经期计算模块按钮配置
        { id: 'periodBtn', name: 'period' }
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
    document.getElementById('periodBtn')?.addEventListener('click', () => loadModule('period'));
    document.getElementById('sleepBtn')?.addEventListener('click', () => loadModule('sleep'));
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('应用初始化...');
    initEventListeners();
    
    loadModule('health');
});