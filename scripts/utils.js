export function createElement(tag, classes, attributes = {}) {
  const elem = document.createElement(tag);
  if (classes) elem.className = classes;
  for (const [key, value] of Object.entries(attributes)) {
      elem.setAttribute(key, value);
  }
  return elem;
} 

export async function fetchLocalData(filePath) {
  try {
      const response = await fetch(filePath);
      if (!response.ok) {
          throw new Error(`数据加载失败: ${response.status}`);
      }
      return await response.json();
  } catch (error) {
      console.error(`[ERROR] 加载数据失败 (${filePath})`, error);
      throw error;
  }
}

export function showLoading(containerId = 'contentContainer', spinnerColor = 'primary') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
      <div class="loading-overlay">
          <div class="spinner-border text-${spinnerColor}" role="status">
              <div class="spinner-dot"></div>
          </div>
          <p>加载中...</p>
      </div>
  `;
}

export function hideLoading(containerId = 'contentContainer') {
  const container = document.getElementById(containerId);
  if (container) {
      container.innerHTML = container.innerHTML.replace(/<div class="loading-overlay">.*<\/div>/gs, '');
  }
}

export function showError(containerId = 'contentContainer', message, retryCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const errorCard = createElement('div', 'error-card', {
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
          <p>${message}</p>
      </div>
      ${retryCallback ? `<button class="btn btn-primary" onclick="${retryCallback}">重试</button>` : ''}
  `;
  container.appendChild(errorCard);
  setTimeout(() => {
      container.removeChild(errorCard);
  }, 5000);
}

export function saveLocalStorage(key, data, expiration = 7 * 24 * 60 * 60) {
  const now = Date.now();
  const item = {
      data,
      expiresAt: now + expiration * 1000
  };
  localStorage.setItem(key, JSON.stringify(item));
}

export function loadLocalStorage(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;
  
  const item = JSON.parse(itemStr);
  if (item.expiresAt && item.expiresAt < Date.now()) {
      localStorage.removeItem(key);
      return null;
  }
  return item.data;
}

export function uniqueBy(arr, key) {
  return [...new Map(arr.map(a => [a[key], a])).values()];
}

export function validateForm(form) {
  const errors = [];
  for (const field of form.elements) {
      if (field.required && !field.value.trim()) {
          errors.push(`${getFieldLabel(field)}不能为空`);
      }
  }
  return errors;
}

export function getFieldLabel(input) {
  const label = document.querySelector(`label[for="${input.id}"]`);
  return label ? label.textContent.trim() : input.name;
}