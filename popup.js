// 2GIS Parser Pro - Popup Script v2.7.0

class ParserPopup {
  constructor() {
    this.filters = {
      minRating: 0,
      onlyWithPhone: false,
      onlyMobilePhones: false,
      onlyWithEmail: false,
      onlyWithSite: false,
      onlyWithTelegram: false,
      onlyWithAnySocial: false,
      noSiteWithSocial: false
    };
    this.selectedCity = 'Москва';
    this.isCollecting = false;
    this.collectingTabId = null;

    // Export settings
    this.exportSettings = {
      category: '',
      specialOrder: false,
      customCity: '',
      customPackSize: 1000
    };

    // Auto-collect settings
    this.collectInterval = 20; // Default 20 seconds
    this.pageHistory = []; // History of pages with company counts
    this.historyExpanded = false;

    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindEvents();
      this.loadFilters();
      this.loadCity();
      this.loadExportSettings();
      this.loadCollectSettings(); // Загружаем настройки интервала
      this.checkCollectingState(); // Проверяем состояние сбора при открытии
      this.updateStats();
      this.startAutoUpdate();
    });
  }

  bindEvents() {
    // Export button (only XLSX now)
    document.getElementById('downloadXlsx').addEventListener('click', () => this.download('xlsx'));

    // City selector
    document.getElementById('citySelect').addEventListener('change', (e) => {
      this.selectedCity = e.target.value;
      this.saveCity();
    });

    // Auto-collect button
    document.getElementById('autoCollectBtn').addEventListener('click', () => this.toggleAutoCollect());

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

    // Filters
    document.getElementById('filterRating').addEventListener('change', (e) => {
      this.filters.minRating = parseFloat(e.target.value) || 0;
      this.saveFilters();
    });

    document.getElementById('filterPhone').addEventListener('change', (e) => {
      this.filters.onlyWithPhone = e.target.checked;
      this.saveFilters();
    });

    document.getElementById('filterMobile').addEventListener('change', (e) => {
      this.filters.onlyMobilePhones = e.target.checked;
      this.saveFilters();
    });

    document.getElementById('filterEmail').addEventListener('change', (e) => {
      this.filters.onlyWithEmail = e.target.checked;
      this.saveFilters();
    });

    document.getElementById('filterSite').addEventListener('change', (e) => {
      this.filters.onlyWithSite = e.target.checked;
      this.saveFilters();
    });

    document.getElementById('filterTelegram').addEventListener('change', (e) => {
      this.filters.onlyWithTelegram = e.target.checked;
      this.saveFilters();
    });

    document.getElementById('filterAnySocial').addEventListener('change', (e) => {
      this.filters.onlyWithAnySocial = e.target.checked;
      this.saveFilters();
    });

    document.getElementById('filterNoSiteWithSocial').addEventListener('change', (e) => {
      this.filters.noSiteWithSocial = e.target.checked;
      this.saveFilters();
    });

    // Export settings
    document.getElementById('categoryInput').addEventListener('input', (e) => {
      this.exportSettings.category = e.target.value.trim();
      this.saveExportSettings();
    });

    document.getElementById('specialOrderCheck').addEventListener('change', (e) => {
      this.exportSettings.specialOrder = e.target.checked;
      this.toggleSpecialOrderFields(e.target.checked);
      this.saveExportSettings();
    });

    document.getElementById('customCity').addEventListener('input', (e) => {
      this.exportSettings.customCity = e.target.value.trim();
      this.saveExportSettings();
    });

    document.getElementById('customPackSize').addEventListener('change', (e) => {
      this.exportSettings.customPackSize = Math.max(100, Math.min(50000, parseInt(e.target.value) || 1000));
      e.target.value = this.exportSettings.customPackSize;
      this.saveExportSettings();
    });

    // Interval selector
    document.getElementById('intervalSelect').addEventListener('change', (e) => {
      this.collectInterval = parseInt(e.target.value) || 20;
      this.saveCollectSettings();
    });

    // History toggle
    document.getElementById('historyToggle').addEventListener('click', () => {
      this.historyExpanded = !this.historyExpanded;
      const historyEl = document.getElementById('pageHistory');
      const toggleEl = document.getElementById('historyToggle');
      if (this.historyExpanded) {
        historyEl.classList.add('active');
        toggleEl.innerHTML = '📜 Скрыть историю ▲';
      } else {
        historyEl.classList.remove('active');
        toggleEl.innerHTML = '📜 Показать историю ▼';
      }
    });
  }

  toggleSpecialOrderFields(show) {
    const fieldsContainer = document.getElementById('specialOrderFields');
    if (show) {
      fieldsContainer.classList.add('active');
    } else {
      fieldsContainer.classList.remove('active');
    }
  }

  saveFilters() {
    chrome.storage.local.set({ parserFilters: this.filters });
  }

  loadFilters() {
    chrome.storage.local.get(['parserFilters'], (result) => {
      if (result.parserFilters) {
        this.filters = { ...this.filters, ...result.parserFilters };
        document.getElementById('filterRating').value = this.filters.minRating || 0;
        document.getElementById('filterPhone').checked = this.filters.onlyWithPhone || false;
        document.getElementById('filterMobile').checked = this.filters.onlyMobilePhones || false;
        document.getElementById('filterEmail').checked = this.filters.onlyWithEmail || false;
        document.getElementById('filterSite').checked = this.filters.onlyWithSite || false;
        document.getElementById('filterTelegram').checked = this.filters.onlyWithTelegram || false;
        document.getElementById('filterAnySocial').checked = this.filters.onlyWithAnySocial || false;
        document.getElementById('filterNoSiteWithSocial').checked = this.filters.noSiteWithSocial || false;
      }
    });
  }

  saveCity() {
    chrome.storage.local.set({ parserCity: this.selectedCity });
  }

  loadCity() {
    chrome.storage.local.get(['parserCity'], (result) => {
      if (result.parserCity) {
        this.selectedCity = result.parserCity;
        document.getElementById('citySelect').value = this.selectedCity;
      }
    });
  }

  saveExportSettings() {
    chrome.storage.local.set({ parserExportSettings: this.exportSettings });
  }

  loadExportSettings() {
    chrome.storage.local.get(['parserExportSettings'], (result) => {
      if (result.parserExportSettings) {
        this.exportSettings = { ...this.exportSettings, ...result.parserExportSettings };

        // Update UI
        document.getElementById('categoryInput').value = this.exportSettings.category || '';
        document.getElementById('specialOrderCheck').checked = this.exportSettings.specialOrder || false;
        document.getElementById('customCity').value = this.exportSettings.customCity || '';
        document.getElementById('customPackSize').value = this.exportSettings.customPackSize || 1000;

        // Show/hide special order fields
        this.toggleSpecialOrderFields(this.exportSettings.specialOrder);
      }
    });
  }

  // Collect settings (interval, history)
  saveCollectSettings() {
    chrome.storage.local.set({
      parserCollectSettings: {
        interval: this.collectInterval
      }
    });
  }

  loadCollectSettings() {
    chrome.storage.local.get(['parserCollectSettings', 'parserPageHistory'], (result) => {
      if (result.parserCollectSettings) {
        this.collectInterval = result.parserCollectSettings.interval || 20;
        document.getElementById('intervalSelect').value = this.collectInterval;
      }
      if (result.parserPageHistory) {
        this.pageHistory = result.parserPageHistory;
        this.renderPageHistory();
      }
    });
  }

  savePageHistory() {
    chrome.storage.local.set({ parserPageHistory: this.pageHistory });
  }

  clearPageHistory() {
    this.pageHistory = [];
    chrome.storage.local.remove(['parserPageHistory']);
    this.renderPageHistory();
  }

  addPageToHistory(pageNum, companiesCount) {
    this.pageHistory.push({
      page: pageNum,
      companies: companiesCount,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    // Keep last 100 entries
    if (this.pageHistory.length > 100) {
      this.pageHistory = this.pageHistory.slice(-100);
    }
    this.savePageHistory();
    this.renderPageHistory();
  }

  renderPageHistory() {
    const historyEl = document.getElementById('pageHistory');
    if (!historyEl) return;

    if (this.pageHistory.length === 0) {
      historyEl.innerHTML = '<div class="history-item" style="text-align: center;">История пуста</div>';
      return;
    }

    // Show last 20 entries, reversed (newest first)
    const recentHistory = this.pageHistory.slice(-20).reverse();
    historyEl.innerHTML = recentHistory.map(item =>
      `<div class="history-item">
        <span class="page">Стр. ${item.page}</span>:
        <strong>${item.companies}</strong> комп.
        <span style="font-size: 9px;">(${item.time})</span>
      </div>`
    ).join('');
  }

  updateStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
      if (response && response.status === 'ok') {
        const stats = response.stats;
        const total = stats.total || 0;

        // Format helper: "123/456 (27%)"
        const fmt = (count) => {
          if (total === 0) return '0/0';
          const pct = Math.round((count / total) * 100);
          return `${count}/${total} (${pct}%)`;
        };

        document.getElementById('totalCount').textContent = total;
        document.getElementById('statSites').textContent = fmt(stats.withSites || 0);
        document.getElementById('statMobile').textContent = fmt(stats.withMobilePhones || 0);
        document.getElementById('statTelegram').textContent = fmt(stats.withRealTelegram || 0);
        document.getElementById('statVK').textContent = fmt(stats.withVK || 0);
        document.getElementById('statWhatsApp').textContent = fmt(stats.withWhatsApp || 0);
        document.getElementById('statEmail').textContent = fmt(stats.withEmails || 0);
        document.getElementById('statTarget').textContent = fmt(stats.noSiteWithSocial || 0);
      }
    });
  }

  startAutoUpdate() {
    setInterval(() => this.updateStats(), 2000);
  }

  download(format) {
    this.showStatus('Подготовка файла...', 'warning');

    // Determine which city to use: custom city (if special order) or selected city
    const cityForExport = this.exportSettings.specialOrder && this.exportSettings.customCity
      ? this.exportSettings.customCity
      : this.selectedCity;

    // Determine pack size: custom size (if special order) or default 1000
    const packSize = this.exportSettings.specialOrder
      ? this.exportSettings.customPackSize
      : 1000;

    chrome.runtime.sendMessage({
      action: 'download',
      format: format,
      filters: this.filters,
      city: cityForExport,
      category: this.exportSettings.category,
      packSize: packSize,
      specialOrder: this.exportSettings.specialOrder
    }, (response) => {
      if (!response) {
        this.showStatus('Ошибка соединения', 'error');
        return;
      }

      if (response.status === 'ok') {
        let msg = `Экспортировано ${response.count} компаний!`;
        if (response.files && response.files > 1) {
          msg = `Экспортировано ${response.count} компаний в ${response.files} файлов!`;
        }
        this.showStatus(msg, 'success');
      } else if (response.status === 'empty') {
        this.showStatus('Нет данных для экспорта', 'warning');
      } else {
        this.showStatus(response.message || 'Ошибка', 'error');
      }
    });
  }

  clearData() {
    if (confirm('Удалить все собранные данные?')) {
      chrome.runtime.sendMessage({ action: 'clear' }, (response) => {
        if (response && response.status === 'ok') {
          this.showStatus('Данные очищены', 'success');
          this.updateStats();
        } else {
          this.showStatus('Ошибка очистки', 'error');
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
        let html = '<div style="max-height:250px;overflow-y:auto;font-size:10px;">';
        response.items.forEach((item, i) => {
          const phones = item.mobilePhones?.length > 0
            ? item.mobilePhones.slice(0, 2).join(', ')
            : (item.phonesNormalized?.slice(0, 2).join(', ') || '');

          html += `
            <div style="padding:6px;border-bottom:1px solid #eee;">
              <strong>${i + 1}. ${item.name || 'Без названия'}</strong>
              ${item.category ? `<span style="color:#666;"> - ${item.category}</span>` : ''}
              <br>
              <span style="color:#888;">${item.address || ''}</span>
              ${phones ? `<br>📞 ${phones}` : ''}
              ${item.telegram ? `<br><span class="tg-icon" style="display:inline-block;width:12px;height:12px;"></span> ${item.telegramUsername || 'Telegram'}` : ''}
              ${item.rating?.ratingValue ? `<br>⭐ ${item.rating.ratingValue}` : ''}
            </div>
          `;
        });
        html += '</div>';

        if (response.total > 5) {
          html += `<div style="text-align:center;padding:6px;color:#666;font-size:10px;">... и ещё ${response.total - 5}</div>`;
        }

        this.showStatus(html, 'success', true);
      } else {
        this.showStatus('Нет данных', 'warning');
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

    if (!isHtml) {
      setTimeout(() => {
        statusEl.className = 'status';
        statusEl.textContent = '';
      }, 4000);
    }
  }

  // =============== AUTO-COLLECT FUNCTIONALITY ===============

  // Проверяем состояние сбора при открытии popup
  async checkCollectingState() {
    const result = await chrome.storage.local.get(['parserCollecting']);

    if (result.parserCollecting && result.parserCollecting.active) {
      const { tabId } = result.parserCollecting;

      // Проверяем, существует ли еще эта вкладка и работает ли скрипт
      try {
        const scriptResult = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          world: 'MAIN',
          func: () => {
            return {
              done: window.__2gisParserDone || false,
              page: window.__2gisParserCurrentPage || 0,
              total: window.__2gisParserTotalPages || '?',
              error: window.__2gisParserError || null
            };
          }
        });

        if (scriptResult && scriptResult[0]) {
          const { done, page, total, error } = scriptResult[0].result;

          if (!done && !error) {
            // Сбор все еще идет - восстанавливаем UI
            this.isCollecting = true;
            this.collectingTabId = tabId;
            this.updateCollectingUI(true);

            const statusEl = document.getElementById('autoCollectStatus');
            statusEl.textContent = `Страница ${page} из ${total}...`;
            statusEl.className = 'auto-collect-status';

            // Возобновляем мониторинг
            this.monitorProgress(tabId, statusEl);
            return;
          }
        }
      } catch (e) {
        // Вкладка закрыта или скрипт не работает
        console.log('[Popup] Tab closed or script not running');
      }

      // Сбор завершен или ошибка - очищаем состояние
      this.clearCollectingState();
    }
  }

  // Сохраняем состояние сбора
  saveCollectingState(tabId) {
    chrome.storage.local.set({
      parserCollecting: {
        active: true,
        tabId: tabId,
        startTime: Date.now()
      }
    });
  }

  // Очищаем состояние сбора
  clearCollectingState() {
    chrome.storage.local.remove(['parserCollecting']);
    this.isCollecting = false;
    this.collectingTabId = null;
    this.updateCollectingUI(false);
  }

  // Обновляем UI кнопки сбора
  updateCollectingUI(collecting) {
    const btn = document.getElementById('autoCollectBtn');
    const statusPanel = document.getElementById('collectStatusPanel');
    const intervalRow = document.querySelector('.interval-row');

    if (collecting) {
      btn.classList.add('collecting');
      btn.querySelector('.text').textContent = 'Остановить сбор';
      btn.querySelector('.icon').textContent = '⏹️';
      statusPanel.classList.add('active');
      if (intervalRow) intervalRow.style.display = 'none';
    } else {
      btn.classList.remove('collecting');
      btn.querySelector('.text').textContent = 'Собрать все страницы';
      btn.querySelector('.icon').textContent = '🚀';
      statusPanel.classList.remove('active');
      if (intervalRow) intervalRow.style.display = 'flex';
    }
  }

  // Update status panel with current progress
  updateStatusPanel(data) {
    const currentPageEl = document.getElementById('currentPageNum');
    const lastSuccessEl = document.getElementById('lastSuccessPage');
    const totalCompaniesEl = document.getElementById('totalCompaniesCollected');
    const scrollProgressEl = document.getElementById('scrollProgress');
    const scrollStatusEl = document.getElementById('scrollStatusText');

    if (currentPageEl && data.page !== undefined) currentPageEl.textContent = data.page;
    if (lastSuccessEl && data.lastSuccess !== undefined) lastSuccessEl.textContent = data.lastSuccess;
    if (totalCompaniesEl && data.totalCompanies !== undefined) totalCompaniesEl.textContent = data.totalCompanies;
    if (scrollProgressEl && data.scrollProgress !== undefined) {
      scrollProgressEl.style.width = data.scrollProgress + '%';
    }
    if (scrollStatusEl && data.scrollStatus !== undefined) {
      scrollStatusEl.textContent = data.scrollStatus;
    }
  }

  async toggleAutoCollect() {
    if (this.isCollecting) {
      this.stopAutoCollect();
    } else {
      await this.startAutoCollect();
    }
  }

  async startAutoCollect() {
    const btn = document.getElementById('autoCollectBtn');
    const statusEl = document.getElementById('autoCollectStatus');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('2gis.')) {
      statusEl.textContent = 'Откройте страницу поиска 2ГИС';
      statusEl.className = 'auto-collect-status error';
      return;
    }

    if (!tab.url.includes('/search/')) {
      statusEl.textContent = 'Выполните поиск на 2ГИС';
      statusEl.className = 'auto-collect-status error';
      return;
    }

    this.isCollecting = true;
    this.collectingTabId = tab.id;
    this.updateCollectingUI(true);

    // Сохраняем состояние сбора
    this.saveCollectingState(tab.id);

    statusEl.textContent = 'Запуск сбора...';
    statusEl.className = 'auto-collect-status';

    // Build script as a string - FIXED 10 second delay
    const scriptCode = this.buildAutoCollectScript();

    try {
      // Inject and execute the auto-pagination script in MAIN world
      // Use a minimal wrapper that evals the script string
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: function(code) { eval(code); },
        args: [scriptCode]
      });

      // Start monitoring progress
      this.monitorProgress(tab.id, statusEl);

    } catch (error) {
      console.error('Auto-collect error:', error);
      statusEl.textContent = 'Ошибка: ' + error.message;
      statusEl.className = 'auto-collect-status error';
      this.clearCollectingState();
    }
  }

  stopAutoCollect() {
    const statusEl = document.getElementById('autoCollectStatus');

    // Send stop signal to the page - используем сохраненный tabId или текущую вкладку
    const tabIdToStop = this.collectingTabId;

    if (tabIdToStop) {
      chrome.scripting.executeScript({
        target: { tabId: tabIdToStop },
        world: 'MAIN',
        func: () => {
          window.__2gisParserStop = true;
        }
      }).catch(() => {});
    } else {
      // Fallback: отправляем в текущую вкладку
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: () => {
              window.__2gisParserStop = true;
            }
          }).catch(() => {});
        }
      });
    }

    // Очищаем состояние
    this.clearCollectingState();

    statusEl.textContent = 'Сбор остановлен';
    statusEl.className = 'auto-collect-status';
  }

  monitorProgress(tabId, statusEl) {
    let lastPageRecorded = 0;
    let lastTotalCompanies = 0;

    const checkProgress = () => {
      if (!this.isCollecting) return;

      // Get script state from page
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',
        func: () => {
          return {
            page: window.__2gisParserCurrentPage || 0,
            total: window.__2gisParserTotalPages || '?',
            done: window.__2gisParserDone || false,
            error: window.__2gisParserError || null,
            lastSuccess: window.__2gisParserLastSuccessPage || 0,
            scrollProgress: window.__2gisParserScrollProgress || 0,
            scrollStatus: window.__2gisParserScrollStatus || 'Ожидание...'
          };
        }
      }).then(results => {
        if (!results || !results[0]) return;

        const { page, total, done, error, lastSuccess, scrollProgress, scrollStatus } = results[0].result;

        if (error) {
          statusEl.textContent = error;
          statusEl.className = 'auto-collect-status error';
          this.clearCollectingState();
          return;
        }

        if (done) {
          statusEl.textContent = `Готово! Собрано ${page} страниц`;
          statusEl.className = 'auto-collect-status success';
          this.clearCollectingState();
          this.updateStats();
          return;
        }

        statusEl.textContent = `Страница ${page} из ${total}...`;
        statusEl.className = 'auto-collect-status';

        // Get REAL company count from storage via background
        chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
          const realTotalCompanies = response?.stats?.total || 0;

          // Update status panel with real data
          this.updateStatusPanel({
            page: page,
            lastSuccess: lastSuccess,
            totalCompanies: realTotalCompanies,
            scrollProgress: scrollProgress,
            scrollStatus: scrollStatus
          });

          // Add to history if new page was completed
          if (lastSuccess > lastPageRecorded) {
            const companiesOnThisPage = realTotalCompanies - lastTotalCompanies;
            if (companiesOnThisPage > 0) {
              this.addPageToHistory(lastSuccess, companiesOnThisPage);
            }
            lastPageRecorded = lastSuccess;
            lastTotalCompanies = realTotalCompanies;
          }
        });

        setTimeout(checkProgress, 300);
      }).catch(() => {
        if (this.isCollecting) {
          setTimeout(checkProgress, 1000);
        }
      });
    };

    setTimeout(checkProgress, 300);
  }

  // Build the auto-collect script as a string (avoids Chrome serialization issues)
  // v2.7.0: Smooth scrolling over entire interval duration
  buildAutoCollectScript() {
    const intervalSeconds = this.collectInterval;

    return `
      (async function() {
        console.log('=== [2GIS Parser v2.7.0] Script started! ===');

        // Configuration
        var SCROLL_DURATION_MS = ${intervalSeconds * 1000}; // Smooth scroll takes the entire interval
        var MAX_PAGES = 9999;

        console.log('[2GIS Parser] Scroll duration:', SCROLL_DURATION_MS / 1000, 'seconds');

        // State variables exposed to popup
        window.__2gisParserStop = false;
        window.__2gisParserDone = false;
        window.__2gisParserError = null;
        window.__2gisParserCurrentPage = 1;
        window.__2gisParserTotalPages = '?';
        window.__2gisParserLastSuccessPage = 0;
        window.__2gisParserCompaniesOnPage = 0;
        window.__2gisParserTotalCompanies = 0;
        window.__2gisParserScrollProgress = 0;
        window.__2gisParserScrollStatus = 'Запуск...';

        // Find the scrollable container with company cards
        function findScrollContainer() {
          // Method 1: Find by exact class name (from 2GIS DOM structure)
          var exactContainer = document.querySelector('._jdkjbol');
          if (exactContainer) {
            console.log('[2GIS Parser] Found ._jdkjbol, scrollHeight:', exactContainer.scrollHeight, 'clientHeight:', exactContainer.clientHeight);

            // Check if this container is actually scrollable
            if (exactContainer.scrollHeight > exactContainer.clientHeight + 50) {
              console.log('[2GIS Parser] ._jdkjbol is scrollable!');
              return exactContainer;
            }

            // If not scrollable, check its children
            var children = exactContainer.children;
            for (var c = 0; c < children.length; c++) {
              var child = children[c];
              console.log('[2GIS Parser] Child', c, 'scrollHeight:', child.scrollHeight, 'clientHeight:', child.clientHeight);
              if (child.scrollHeight > child.clientHeight + 50) {
                console.log('[2GIS Parser] Found scrollable child of ._jdkjbol');
                return child;
              }
            }

            // Maybe parent is scrollable?
            var parent = exactContainer.parentElement;
            if (parent && parent.scrollHeight > parent.clientHeight + 50) {
              console.log('[2GIS Parser] Parent of ._jdkjbol is scrollable');
              return parent;
            }
          }

          // Method 2: Find by data-scroll attribute on the cards container
          var scrollContainers = document.querySelectorAll('[data-scroll="true"]');
          for (var i = 0; i < scrollContainers.length; i++) {
            var container = scrollContainers[i];
            console.log('[2GIS Parser] data-scroll container', i, 'width:', container.clientWidth, 'scrollH:', container.scrollHeight, 'clientH:', container.clientHeight);
            // Make sure it's the results container (not filters) - check width > 300px
            if (container.clientWidth > 300 && container.scrollHeight > container.clientHeight + 50) {
              console.log('[2GIS Parser] Using data-scroll container', i);
              return container;
            }
          }

          // Method 3: Brute force - find ANY scrollable container in the results area
          var allDivs = document.querySelectorAll('div');
          for (var j = 0; j < allDivs.length; j++) {
            var div = allDivs[j];
            if (div.scrollHeight > div.clientHeight + 200 &&
                div.clientHeight > 300 &&
                div.clientWidth > 300 &&
                div.clientWidth < 500) { // Results panel is around 350-400px wide
              var style = getComputedStyle(div);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                console.log('[2GIS Parser] Found scrollable div via brute force, class:', div.className.substring(0, 30));
                return div;
              }
            }
          }

          console.warn('[2GIS Parser] No scroll container found');
          return null;
        }

        // Count visible company cards
        function countCompanies() {
          var cards = document.querySelectorAll('[class*="_1hf7139"], [class*="_93444ei"]');
          return cards.length;
        }

        // Human-like smooth scroll function that takes the entire duration
        async function smoothScrollDown(container, durationMs) {
          if (!container) {
            console.warn('[2GIS Parser] No scroll container found');
            return;
          }

          var startScrollTop = container.scrollTop;
          var maxScroll = container.scrollHeight - container.clientHeight;
          var targetScroll = Math.min(startScrollTop + container.clientHeight * 3, maxScroll);
          var scrollDistance = targetScroll - startScrollTop;

          if (scrollDistance <= 0) {
            // Already at bottom, scroll to top and back
            container.scrollTop = 0;
            await new Promise(function(r) { setTimeout(r, 500); });
            startScrollTop = 0;
            scrollDistance = maxScroll;
            targetScroll = maxScroll;
          }

          var startTime = Date.now();
          var frameDelay = 50; // Update every 50ms for smooth appearance
          var steps = Math.floor(durationMs / frameDelay);

          window.__2gisParserScrollStatus = 'Скролл...';

          for (var step = 0; step <= steps; step++) {
            if (window.__2gisParserStop) break;

            // Easing function for natural movement (ease-in-out)
            var progress = step / steps;
            var easedProgress = progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // Add small random variation for human-like behavior
            var variation = (Math.random() - 0.5) * 5;
            var currentScroll = startScrollTop + (scrollDistance * easedProgress) + variation;

            container.scrollTop = Math.max(0, Math.min(currentScroll, maxScroll));

            // Update progress
            window.__2gisParserScrollProgress = Math.round(progress * 100);

            // Random micro-pauses to simulate human behavior
            var delay = frameDelay;
            if (Math.random() < 0.05) {
              delay += Math.random() * 200; // Occasional longer pause
            }

            await new Promise(function(r) { setTimeout(r, delay); });
          }

          // Ensure we reach the target
          container.scrollTop = targetScroll;
          window.__2gisParserScrollProgress = 100;
          window.__2gisParserScrollStatus = 'Скролл завершен';
        }

        // Find next page button
        function findNextButton() {
          // Method 1: pagination container with arrows
          var container = document.querySelector('._1x4k6z7');
          if (container) {
            var divs = container.querySelectorAll('div');
            var arrows = [];
            for (var i = 0; i < divs.length; i++) {
              var svg = divs[i].querySelector(':scope > svg');
              if (svg) arrows.push(divs[i]);
            }
            if (arrows.length >= 2) {
              return arrows[arrows.length - 1]; // Last arrow is "next"
            } else if (arrows.length === 1) {
              return arrows[0];
            }
          }

          // Method 2: by class
          var btns = document.querySelectorAll('[class*="_n5hmn94"]');
          if (btns.length >= 2) {
            return btns[btns.length - 1];
          }

          return null;
        }

        try {
          // Get total count
          var bodyText = document.body.innerText;
          var match = bodyText.match(/Места\\s+(\\d[\\d\\s]*)/i);
          console.log('[2GIS Parser] Match:', match);

          var totalItems = MAX_PAGES * 12;
          if (match) {
            totalItems = parseInt(match[1].replace(/\\s/g, ''));
          }
          var totalPages = Math.ceil(totalItems / 12);
          window.__2gisParserTotalPages = totalPages;
          console.log('[2GIS Parser] Total pages:', totalPages);

          var currentPage = 1;
          window.__2gisParserCurrentPage = currentPage;
          var noButtonCount = 0;
          var scrollContainer = findScrollContainer();

          console.log('[2GIS Parser] Scroll container:', scrollContainer ? 'found' : 'not found');

          // Initial company count
          var initialCompanies = countCompanies();
          window.__2gisParserCompaniesOnPage = initialCompanies;
          window.__2gisParserTotalCompanies = initialCompanies;
          window.__2gisParserLastSuccessPage = 1;

          while (!window.__2gisParserStop) {
            console.log('[2GIS Parser] Page', currentPage, '- starting', SCROLL_DURATION_MS / 1000, 'sec scroll...');
            window.__2gisParserScrollProgress = 0;
            window.__2gisParserScrollStatus = 'Начинаю скролл...';

            // Smooth scroll over the entire interval
            await smoothScrollDown(scrollContainer, SCROLL_DURATION_MS);

            if (window.__2gisParserStop) {
              console.log('[2GIS Parser] STOPPED by user');
              break;
            }

            // Small pause before clicking next
            window.__2gisParserScrollStatus = 'Переход на следующую...';
            await new Promise(function(r) { setTimeout(r, 500); });

            // Find and click next button
            var nextBtn = findNextButton();

            if (!nextBtn) {
              noButtonCount++;
              console.log('[2GIS Parser] No button found, attempt', noButtonCount);
              if (noButtonCount >= 3) {
                console.log('[2GIS Parser] No more pages - DONE');
                break;
              }
              continue;
            }

            noButtonCount = 0;

            // Scroll button into view and click
            nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(function(r) { setTimeout(r, 300); });
            nextBtn.click();

            // Update page counter
            currentPage++;
            window.__2gisParserCurrentPage = currentPage;
            console.log('[2GIS Parser] Now on page', currentPage);

            // Wait for page content to load
            await new Promise(function(r) { setTimeout(r, 1500); });

            // Count companies on new page
            var companiesOnPage = countCompanies();
            window.__2gisParserCompaniesOnPage = companiesOnPage;
            window.__2gisParserTotalCompanies += companiesOnPage;
            window.__2gisParserLastSuccessPage = currentPage;

            console.log('[2GIS Parser] Page', currentPage, '- found', companiesOnPage, 'companies, total:', window.__2gisParserTotalCompanies);

            // Re-find scroll container (might change after page switch)
            scrollContainer = findScrollContainer();
          }

          window.__2gisParserDone = true;
          window.__2gisParserScrollStatus = 'Готово!';
          console.log('[2GIS Parser] === DONE! Total pages:', currentPage, ', Total companies:', window.__2gisParserTotalCompanies, '===');

        } catch (err) {
          console.error('[2GIS Parser] ERROR:', err);
          window.__2gisParserError = err.message;
        }
      })();
    `;
  }
}

new ParserPopup();
