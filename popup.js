// 2GIS Parser Pro - Popup Script v2.4.0

class ParserPopup {
  constructor() {
    this.filters = {
      minRating: 0,
      onlyWithPhone: false,
      onlyMobilePhones: false,
      onlyWithEmail: false,
      onlyWithSite: false,
      onlyWithTelegram: false
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

    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindEvents();
      this.loadFilters();
      this.loadCity();
      this.loadExportSettings();
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
  }

  toggleSpecialOrderFields(show) {
    const fieldsContainer = document.getElementById('specialOrderFields');
    fieldsContainer.style.display = show ? 'block' : 'none';
  }

  saveFilters() {
    chrome.storage.local.set({ parserFilters: this.filters });
  }

  loadFilters() {
    chrome.storage.local.get(['parserFilters'], (result) => {
      if (result.parserFilters) {
        this.filters = result.parserFilters;
        document.getElementById('filterRating').value = this.filters.minRating || 0;
        document.getElementById('filterPhone').checked = this.filters.onlyWithPhone || false;
        document.getElementById('filterMobile').checked = this.filters.onlyMobilePhones || false;
        document.getElementById('filterEmail').checked = this.filters.onlyWithEmail || false;
        document.getElementById('filterSite').checked = this.filters.onlyWithSite || false;
        document.getElementById('filterTelegram').checked = this.filters.onlyWithTelegram || false;
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

  updateStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
      if (response && response.status === 'ok') {
        const stats = response.stats;

        document.getElementById('totalCount').textContent = stats.total || 0;
        document.getElementById('withPhones').textContent = stats.withPhones || 0;
        document.getElementById('withTelegram').textContent = stats.withTelegram || 0;
        document.getElementById('withMobile').textContent = stats.withMobilePhones || 0;
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
    if (collecting) {
      btn.classList.add('collecting');
      btn.querySelector('.text').textContent = 'Остановить сбор';
      btn.querySelector('.icon').textContent = '⏹️';
    } else {
      btn.classList.remove('collecting');
      btn.querySelector('.text').textContent = 'Собрать все страницы';
      btn.querySelector('.icon').textContent = '🔄';
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
    const checkProgress = () => {
      if (!this.isCollecting) return;

      chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',
        func: () => {
          return {
            page: window.__2gisParserCurrentPage || 0,
            total: window.__2gisParserTotalPages || '?',
            done: window.__2gisParserDone || false,
            error: window.__2gisParserError || null
          };
        }
      }).then(results => {
        if (!results || !results[0]) return;

        const { page, total, done, error } = results[0].result;

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

        setTimeout(checkProgress, 500);
      }).catch(() => {
        if (this.isCollecting) {
          setTimeout(checkProgress, 1000);
        }
      });
    };

    setTimeout(checkProgress, 500);
  }

  // Build the auto-collect script as a string (avoids Chrome serialization issues)
  // FIXED: Always 10 seconds delay between pages
  buildAutoCollectScript() {
    return `
      (async function() {
        console.log('=== [2GIS Parser] Script started! ===');
        console.log('[2GIS Parser] FIXED delay: 10 seconds between pages');

        window.__2gisParserStop = false;
        window.__2gisParserDone = false;
        window.__2gisParserError = null;
        window.__2gisParserCurrentPage = 1;
        window.__2gisParserTotalPages = '?';

        // FIXED: Always 10 seconds (10000ms) between page switches
        var DELAY_MS = 10000;
        var MAX_PAGES = 9999;

        try {
          // Получаем общее количество
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

          while (!window.__2gisParserStop) {
            console.log('[2GIS Parser] Page', currentPage, '- waiting 10 seconds...');

            // FIXED: Always wait exactly 10 seconds
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });

            if (window.__2gisParserStop) {
              console.log('[2GIS Parser] STOPPED by user');
              break;
            }

            // Ищем кнопку ">"
            var nextBtn = null;

            // Метод 1: по классу пагинации
            var container = document.querySelector('._1x4k6z7');

            if (container) {
              var divs = container.querySelectorAll('div');
              var arrows = [];
              for (var i = 0; i < divs.length; i++) {
                var svg = divs[i].querySelector(':scope > svg');
                if (svg) arrows.push(divs[i]);
              }
              console.log('[2GIS Parser] Arrows found:', arrows.length);
              if (arrows.length >= 2) {
                nextBtn = arrows[arrows.length - 1];
              } else if (arrows.length === 1) {
                nextBtn = arrows[0];
              }
            }

            // Метод 2: по классу _n5hmn94
            if (!nextBtn) {
              var btns = document.querySelectorAll('[class*="_n5hmn94"]');
              if (btns.length >= 2) {
                nextBtn = btns[btns.length - 1];
              }
            }

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
            console.log('[2GIS Parser] Clicking next page button...');

            nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(function(r) { setTimeout(r, 500); });
            nextBtn.click();

            currentPage++;
            window.__2gisParserCurrentPage = currentPage;
            console.log('[2GIS Parser] Now on page', currentPage);
          }

          window.__2gisParserDone = true;
          console.log('[2GIS Parser] === DONE! Total pages collected:', currentPage, '===');

        } catch (err) {
          console.error('[2GIS Parser] ERROR:', err);
          window.__2gisParserError = err.message;
        }
      })();
    `;
  }
}

new ParserPopup();
