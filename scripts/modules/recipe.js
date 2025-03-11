import { fetchLocalData, showLoading, createElement } from '../utils.js';

const PAGE_SIZE = 6;

export default {
    currentState: {},
    data: null,
    clickHandler: null,
    currentPage: 1,

    async init() {
        try {
            this.renderLoading();
            this.data = await fetchLocalData('/health-assistant/data/recipes.json');
            this.renderScenarioSelection();
            this.bindGlobalEvents();
        } catch (error) {
            this.showError('食谱数据加载失败，请刷新重试');
        }
    },

    cleanup() {
        this.unbindGlobalEvents();
        const container = document.getElementById('contentContainer');
        if (container) container.innerHTML = '';
    },

    renderLoading() {
        const container = document.getElementById('contentContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>正在加载美味食谱...</p>
            </div>
        `;
    },

    renderScenarioSelection() {
        const container = document.getElementById('contentContainer');
        if (!container) return;

        container.innerHTML = `
            <section class="recipe-module">
                <h2 class="section-title">🍴 智能食谱推荐</h2>
                <div class="scenario-buttons" id="scenarioButtons"></div>
                <div id="recipeContent"></div>
            </section>
        `;

        const scenarios = Object.keys(this.data);
        const buttonsContainer = document.getElementById('scenarioButtons');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = scenarios.map(scenario => `
                <button class="scenario-btn" data-scenario="${scenario}">
                    ${this.getScenarioIcon(scenario)} ${scenario}
                </button>
            `).join('');
        }
    },

    bindGlobalEvents() {
        this.clickHandler = (e) => this.handleClick(e);
        document.addEventListener('click', this.clickHandler);
    },

    unbindGlobalEvents() {
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler);
        }
    },

    handleClick(e) {
        const scenarioBtn = e.target.closest('.scenario-btn');
        const methodBtn = e.target.closest('.method-btn');
        const backBtn = e.target.closest('.back-btn');
        const recipeCard = e.target.closest('.recipe-card');
        const pageBtn = e.target.closest('.page-btn');

        if (pageBtn) {
            this.handlePageChange(parseInt(pageBtn.dataset.page, 10));
            return;
        }

        if (scenarioBtn) {
            this.handleScenarioSelect(scenarioBtn.dataset.scenario);
        } else if (methodBtn) {
            this.handleMethodSelect(methodBtn.dataset.method);
        } else if (backBtn) {
            this.handleBackNavigation();
        } else if (recipeCard) {
            this.toggleRecipeDetails(recipeCard.dataset.recipeId);
        }
    },

    handlePageChange(newPage) {
        this.currentPage = newPage;
        this.renderRecipes();
        window.scrollTo({
            top: document.getElementById('recipeContent').offsetTop - 100,
            behavior: 'smooth'
        });
    },

    handleScenarioSelect(scenario) {
        this.currentState = { scenario };
        this.currentPage = 1;
        this.renderCookingMethods(scenario);
    },

    renderCookingMethods(scenario) {
        const methods = Object.keys(this.data[scenario]);
        const content = `
            <div class="method-selection">
                <button class="back-btn">← 返回场景选择</button>
                <h3>选择烹饪方式</h3>
                <div class="method-grid">
                    ${methods.map(method => `
                        <button class="method-btn" data-method="${method}">
                            ${this.getMethodIcon(method)} ${method}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        const recipeContent = document.getElementById('recipeContent');
        if (recipeContent) recipeContent.innerHTML = content;
    },

    handleMethodSelect(method) {
        this.currentState.method = method;
        this.currentPage = 1;
        this.renderRecipes();
    },

    renderRecipes() {
        const { scenario, method } = this.currentState;
        if (!scenario || !method) return;

        const allRecipes = this.data[scenario][method];
        const start = (this.currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginatedRecipes = allRecipes.slice(start, end);

        const content = `
            <div class="recipe-list">
                <button class="back-btn">← 返回方式选择</button>
                <h3>${scenario} - ${method} 食谱</h3>
                <div class="recipe-grid">
                    ${paginatedRecipes.map((recipe, index) => `
                        <div class="recipe-card" data-recipe-id="recipe_${index}">
                            <div class="card-header">
                                <h4>${recipe.name}</h4>
                                <div class="recipe-meta">
                                    <span class="calorie-badge">🔥 ${recipe.calories}kcal</span>
                                    <span class="time-badge">⏱️ ${recipe.time}</span>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="quick-info">
                                    <p class="description">${recipe.role}</p>
                                    <div class="ingredients-preview">
                                        <span>主要食材: </span>
                                        ${recipe.ingredients.slice(0,3).map(i => `<span class="ingredient-item">${i}</span>`).join(', ')}
                                        ${recipe.ingredients.length > 3 ? `等${recipe.ingredients.length}种` : ''}
                                    </div>
                                </div>
                                <div class="details hidden" id="details_${index}">
                                    <div class="recipe-image">
                                        ${recipe.image ? `<img src="images/${recipe.image}" alt="${recipe.name}">` : ''}
                                    </div>
                                    <h5>完整食材清单：</h5>
                                    <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
                                    <h5>详细制作步骤：</h5>
                                    <ol>${recipe.steps.map(s => `<li>${s}</li>`).join('')}</ol>
                                    <div class="recipe-footer">
                                        <span class="taste">${recipe.taste}</span>
                                        <span class="evaluation">${recipe.evaluation}</span>
                                        <button class="favorite-btn">❤ 收藏</button>
                                    </div>
                                </div>
                                <button class="toggle-details">▼ 查看详情</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${this.createPagination(allRecipes.length)}
            </div>
        `;

        const recipeContent = document.getElementById('recipeContent');
        if (recipeContent) recipeContent.innerHTML = content;
    },

    createPagination(totalItems) {
        const totalPages = Math.ceil(totalItems / PAGE_SIZE);
        return `
            <div class="pagination">
                ${Array.from({ length: totalPages }, (_, i) => {
                    const page = i + 1;
                    return `
                        <button class="page-btn ${page === this.currentPage ? 'active' : ''}" 
                                data-page="${page}">
                            ${page}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    },

    toggleRecipeDetails(recipeId) {
      const details = document.getElementById(`details_${recipeId.split('_')[1]}`);
      const imageContainer = details.querySelector('.recipe-image');
      if (!details) return;
  
      const isOpening = details.classList.contains('hidden');
      details.classList.toggle('hidden');
      
      if (isOpening) {
          details.style.maxHeight = '0';
          setTimeout(() => {
              details.style.maxHeight = `${details.scrollHeight}px`;
          }, 10);
          // 显示图片
          if (imageContainer) {
              imageContainer.style.display = 'inline';
          }
      } else {
          details.style.maxHeight = '0';
          // 隐藏图片
          if (imageContainer) {
              imageContainer.style.display = 'none';
          }
      }
  },

    handleBackNavigation() {
        if (this.currentState.method) {
            delete this.currentState.method;
            this.renderCookingMethods(this.currentState.scenario);
        } else {
            delete this.currentState.scenario;
            this.renderScenarioSelection();
        }
    },

    getScenarioIcon(scenario) {
        return {
            '应急': '🚨',
            '正常': '🏠',
            '休闲': '🎉'
        }[scenario] || '🍳';
    },

    getMethodIcon(method) {
        const icons = {
            '热水速食': '🔥',
            '微波速烹': '🌀',
            '即食罐头': '🥫',
            '能量棒组合': '⚡',
            '冲泡饮品': '☕',
            '快炒料理': '🍳',
            '烤箱烘焙': '🔥',
            '电饭煲菜': '🍚',
            '空气炸锅': '🍟',
            '汤煲慢炖': '🍲',
            '创意摆盘': '🎨',
            '分子料理': '🧪',
            '甜品制作': '🍰',
            '鸡尾酒调饮': '🍸',
            '主题套餐': '🍽️'
        };
        return icons[method] || '⚙️';
    },

    showError(message) {
        const container = document.getElementById('contentContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <p>${message}</p>
                <button class="retry-btn" onclick="location.reload()">刷新页面</button>
            </div>
        `;
    }
};