// 2GIS Parser Pro - Popup Script v2.0
// Без внешней телеметрии, все данные хранятся локально

class ParserPopup {
  constructor() {
    this.filters = {
      minRating: 0,
      onlyWithPhone: false,
      onlyWithEmail: false,
      onlyWithSite: false
    };
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindEvents();
      this.loadFilters();
      this.updateStats();
      this.startAutoUpdate();
    });
  }

  bindEvents() {
    // Export buttons
    document.getElementById('downloadXlsx').addEventListener('click', () => this.download('xlsx'));
    document.getElementById('downloadCsv').addEventListener('click', () => this.download('csv'));
    document.getElementById('downloadJson').addEventListener('click', () => this.download('json'));

    // Action buttons
    document.getElementById('clearBtn').addEventListener('click', () => this.clearData());
    document.getElementById('previewBtn').addEventListener('click', () => this.showPreview());

    // Footer links
    document.getElementById('supportBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://t.me/aza_support' });
    });

    document.getElementById('instructionBtn').addEventListener('click', () => {
      const lang = chrome.i18n?.getUILanguage()?.startsWith('ru') ? 'ru' : 'en';
      chrome.tabs.create({ url: `instruction/${lang}.html` });
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

    // Filters
    document.getElementById('filterRating').addEventListener('change', (e) => {
      this.filters.minRating = parseFloat(e.target.value) || 0;
      this.saveFilters();
      this.updateStats();
    });

    document.getElementById('filterPhone').addEventListener('change', (e) => {
      this.filters.onlyWithPhone = e.target.checked;
      this.saveFilters();
      this.updateStats();
    });

    document.getElementById('filterEmail').addEventListener('change', (e) => {
      this.filters.onlyWithEmail = e.target.checked;
      this.saveFilters();
      this.updateStats();
    });

    document.getElementById('filterSite').addEventListener('change', (e) => {
      this.filters.onlyWithSite = e.target.checked;
      this.saveFilters();
      this.updateStats();
    });
  }

  saveFilters() {
    chrome.storage.local.set({ parserFilters: this.filters });
  }

  loadFilters() {
    chrome.storage.local.get(['parserFilters'], (result) => {
      if (result.parserFilters) {
        this.filters = result.parserFilters;
        document.getElementById('filterRating').value = this.filters.minRating;
        document.getElementById('filterPhone').checked = this.filters.onlyWithPhone;
        document.getElementById('filterEmail').checked = this.filters.onlyWithEmail;
        document.getElementById('filterSite').checked = this.filters.onlyWithSite;
      }
    });
  }

  updateStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
      if (response && response.status === 'ok') {
        const stats = response.stats;

        // Update counters
        document.getElementById('totalCount').textContent = stats.total || 0;
        document.getElementById('withPhones').textContent = stats.withPhones || 0;

        // Update progress
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (stats.total > 0) {
          const phonePercent = Math.round((stats.withPhones / stats.total) * 100);
          progressFill.style.width = `${phonePercent}%`;
          progressText.textContent = `${stats.withPhones} из ${stats.total} с телефонами (${phonePercent}%)`;
        } else {
          progressFill.style.width = '0%';
          progressText.textContent = 'Откройте 2ГИС и выполните поиск';
        }

        // Update filtered count if filters active
        if (this.hasActiveFilters()) {
          chrome.runtime.sendMessage({
            action: 'getFilteredCount',
            filters: this.filters
          }, (filteredResponse) => {
            if (filteredResponse && filteredResponse.status === 'ok') {
              progressText.textContent = `Отфильтровано: ${filteredResponse.count} из ${stats.total}`;
            }
          });
        }
      }
    });
  }

  hasActiveFilters() {
    return this.filters.minRating > 0 ||
           this.filters.onlyWithPhone ||
           this.filters.onlyWithEmail ||
           this.filters.onlyWithSite;
  }

  startAutoUpdate() {
    // Update stats every 2 seconds
    setInterval(() => this.updateStats(), 2000);
  }

  download(format) {
    this.showStatus('Подготовка файла...', 'warning');

    chrome.runtime.sendMessage({
      action: 'download',
      format: format,
      filters: this.filters
    }, (response) => {
      if (!response) {
        this.showStatus('Ошибка соединения с расширением', 'error');
        return;
      }

      if (response.status === 'ok') {
        this.showStatus(`Файл ${format.toUpperCase()} успешно скачан!`, 'success');
      } else if (response.status === 'empty') {
        this.showStatus('Нет данных для экспорта', 'warning');
      } else {
        this.showStatus(response.message || 'Ошибка при скачивании', 'error');
      }
    });
  }

  clearData() {
    if (confirm('Вы уверены, что хотите удалить все собранные данные?')) {
      chrome.runtime.sendMessage({ action: 'clear' }, (response) => {
        if (response && response.status === 'ok') {
          this.showStatus('Данные успешно очищены', 'success');
          this.updateStats();
        } else {
          this.showStatus('Ошибка при очистке данных', 'error');
        }
      });
    }
  }

  showPreview() {
    chrome.runtime.sendMessage({
      action: 'getPreview',
      filters: this.filters,
      limit: 5
    }, (response) => {
      if (response && response.status === 'ok' && response.items.length > 0) {
        let previewHtml = '<div style="max-height: 300px; overflow-y: auto; font-size: 11px;">';
        response.items.forEach((item, index) => {
          previewHtml += `
            <div style="padding: 8px; border-bottom: 1px solid #eee;">
              <strong>${index + 1}. ${item.title}</strong><br>
              <span style="color: #666;">${item.address || 'Нет адреса'}</span><br>
              ${item.contacts ? `📞 ${item.contacts.slice(0, 2).join(', ')}` : ''}
              ${item.rating?.ratingValue ? `⭐ ${item.rating.ratingValue}` : ''}
            </div>
          `;
        });
        previewHtml += '</div>';

        if (response.total > 5) {
          previewHtml += `<div style="text-align: center; padding: 8px; color: #666; font-size: 11px;">... и ещё ${response.total - 5} компаний</div>`;
        }

        this.showStatus(previewHtml, 'success', true);
      } else {
        this.showStatus('Нет данных для превью', 'warning');
      }
    });
  }

  showStatus(message, type = 'success', isHtml = false) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${type}`;

    if (isHtml) {
      statusEl.innerHTML = message;
    } else {
      statusEl.textContent = message;
    }

    // Auto-hide after 5 seconds (except for preview)
    if (!isHtml) {
      setTimeout(() => {
        statusEl.className = 'status';
        statusEl.textContent = '';
      }, 5000);
    }
  }

  toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
    chrome.storage.local.set({ darkTheme: isDark });
  }

  loadTheme() {
    chrome.storage.local.get(['darkTheme'], (result) => {
      if (result.darkTheme) {
        document.body.classList.add('dark-theme');
        document.getElementById('themeToggle').textContent = '☀️';
      }
    });
  }
}

// Initialize popup
const popup = new ParserPopup();
