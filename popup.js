// 2GIS Parser Pro - Popup Script v2.3.5

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
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindEvents();
      this.loadFilters();
      this.loadCity();
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

    chrome.runtime.sendMessage({
      action: 'download',
      format: format,
      filters: this.filters,
      city: this.selectedCity
    }, (response) => {
      if (!response) {
        this.showStatus('Ошибка соединения', 'error');
        return;
      }

      if (response.status === 'ok') {
        this.showStatus(`Экспортировано ${response.count} компаний!`, 'success');
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
    const delayInput = document.getElementById('collectDelay');
    const maxPagesInput = document.getElementById('maxPages');

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
    btn.classList.add('collecting');
    btn.querySelector('.text').textContent = 'Остановить сбор';
    btn.querySelector('.icon').textContent = '⏹️';

    const delay = parseFloat(delayInput.value) * 1000 || 2000;
    const maxPages = parseInt(maxPagesInput.value) || 100;

    statusEl.textContent = 'Запуск сбора...';
    statusEl.className = 'auto-collect-status';

    try {
      // Inject and execute the auto-pagination script in MAIN world
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.autoCollectScript,
        args: [delay, maxPages],
        world: 'MAIN'  // Run in page context to access DOM properly
      });

      // Start monitoring progress
      this.monitorProgress(tab.id, statusEl);

    } catch (error) {
      console.error('Auto-collect error:', error);
      statusEl.textContent = 'Ошибка: ' + error.message;
      statusEl.className = 'auto-collect-status error';
      this.stopAutoCollect();
    }
  }

  stopAutoCollect() {
    const btn = document.getElementById('autoCollectBtn');
    const statusEl = document.getElementById('autoCollectStatus');

    this.isCollecting = false;
    btn.classList.remove('collecting');
    btn.querySelector('.text').textContent = 'Собрать все страницы';
    btn.querySelector('.icon').textContent = '🔄';

    // Send stop signal to the page
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',  // Same world as the auto-collect script
          func: () => {
            window.__2gisParserStop = true;
          }
        }).catch(() => {});
      }
    });

    statusEl.textContent = 'Сбор остановлен';
    statusEl.className = 'auto-collect-status';
  }

  monitorProgress(tabId, statusEl) {
    const checkProgress = () => {
      if (!this.isCollecting) return;

      chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',  // Same world as the auto-collect script
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
          this.stopAutoCollect();
          return;
        }

        if (done) {
          statusEl.textContent = `Готово! Собрано ${page} страниц`;
          statusEl.className = 'auto-collect-status success';
          this.stopAutoCollect();
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

  // This function runs in the context of the 2GIS page
  autoCollectScript(delay, maxPages) {
    console.log('=== [2GIS Parser] Script injected! ===');
    console.log('[2GIS Parser] delay:', delay, 'maxPages:', maxPages);

    // Reset state
    window.__2gisParserStop = false;
    window.__2gisParserDone = false;
    window.__2gisParserError = null;
    window.__2gisParserCurrentPage = 1;
    window.__2gisParserTotalPages = '?';

    console.log('[2GIS Parser] Variables initialized');

    async function collectAllPages() {
      console.log('[2GIS Parser] collectAllPages() started');

      try {
        // Find total from "Места XXXXX" - simple text search
        const getTotalPages = () => {
          const bodyText = document.body.innerText;
          const match = bodyText.match(/Места\s+(\d[\d\s]*)/i);
          console.log('[2GIS Parser] getTotalPages - match:', match);
          if (match) {
            const total = parseInt(match[1].replace(/\s/g, ''));
            if (!isNaN(total) && total > 0) {
              return Math.ceil(total / 12);
            }
          }
          return maxPages;
        };

        // Поиск кнопки ">" - на 2GIS это div с SVG внутри
        const findNextButton = () => {
          console.log('[2GIS Parser] findNextButton() called');

          // Метод 1: Ищем контейнер пагинации по классу
          const paginationContainer = document.querySelector('._1x4k6z7');
          console.log('[2GIS Parser] Method 1 - _1x4k6z7:', paginationContainer);

          if (!paginationContainer) {
            // Попробуем найти по частичному совпадению
            const allDivs = document.querySelectorAll('div[class]');
            for (const div of allDivs) {
              if (div.className && div.className.includes('1x4k6z')) {
                console.log('[2GIS Parser] Found by partial class:', div.className);
                // Используем этот контейнер
              }
            }
          }

          if (paginationContainer) {
            console.log('[2GIS Parser] Pagination container found!');
            console.log('[2GIS Parser] Container HTML:', paginationContainer.innerHTML.substring(0, 200));

            // Ищем все div с SVG
            const allDivs = paginationContainer.querySelectorAll('div');
            console.log('[2GIS Parser] Total divs in container:', allDivs.length);

            const arrowDivs = [];
            for (const div of allDivs) {
              const svg = div.querySelector(':scope > svg');
              if (svg) {
                console.log('[2GIS Parser] Found div with direct SVG child:', div.className);
                arrowDivs.push(div);
              }
            }

            console.log('[2GIS Parser] Arrow divs found:', arrowDivs.length);

            if (arrowDivs.length >= 2) {
              const nextBtn = arrowDivs[arrowDivs.length - 1];
              console.log('[2GIS Parser] Using last arrow div as next button');
              return nextBtn;
            }
            if (arrowDivs.length === 1) {
              console.log('[2GIS Parser] Only one arrow, checking rotation...');
              return arrowDivs[0];
            }
          }

          // Метод 2: Ищем по классу _n5hmn94
          const arrowButtons = document.querySelectorAll('[class*="_n5hmn94"]');
          console.log('[2GIS Parser] Method 2 - _n5hmn94 elements:', arrowButtons.length);

          if (arrowButtons.length >= 2) {
            console.log('[2GIS Parser] Using last _n5hmn94 as next button');
            return arrowButtons[arrowButtons.length - 1];
          }

          // Метод 3: Ищем все SVG с rotate(-90deg)
          console.log('[2GIS Parser] Method 3 - searching all SVGs...');
          const allSvgs = document.querySelectorAll('svg');
          console.log('[2GIS Parser] Total SVGs on page:', allSvgs.length);

          for (const svg of allSvgs) {
            const style = window.getComputedStyle(svg);
            const transform = style.transform;
            if (transform && transform !== 'none') {
              console.log('[2GIS Parser] SVG with transform:', transform, 'parent:', svg.parentElement?.className);
            }
          }

          console.log('[2GIS Parser] Next button NOT FOUND');
          return null;
        };

        let totalPages = getTotalPages();
        window.__2gisParserTotalPages = Math.min(totalPages, maxPages);

        console.log('[2GIS Parser] Total pages:', totalPages);
        console.log('[2GIS Parser] Starting collection loop...');

        let currentPage = 1;
        window.__2gisParserCurrentPage = currentPage;
        let noButtonCount = 0;

        while (currentPage < maxPages && !window.__2gisParserStop) {
          console.log(`[2GIS Parser] --- Loop iteration, page ${currentPage} ---`);

          await new Promise(r => setTimeout(r, delay));

          if (window.__2gisParserStop) {
            console.log('[2GIS Parser] Stop signal received');
            break;
          }

          const nextBtn = findNextButton();

          if (!nextBtn) {
            noButtonCount++;
            console.log(`[2GIS Parser] No button, attempt ${noButtonCount}/3`);
            if (noButtonCount >= 3) {
              console.log('[2GIS Parser] Giving up - no button found');
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          noButtonCount = 0;
          console.log('[2GIS Parser] Button found, clicking...');

          nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 300));

          nextBtn.click();
          console.log('[2GIS Parser] Click sent!');

          currentPage++;
          window.__2gisParserCurrentPage = currentPage;

          await new Promise(r => setTimeout(r, delay));
          console.log(`[2GIS Parser] Now on page ${currentPage}`);
        }

        window.__2gisParserDone = true;
        console.log(`[2GIS Parser] === DONE! Collected ${currentPage} pages ===`);

      } catch (error) {
        console.error('[2GIS Parser] ERROR:', error);
        window.__2gisParserError = error.message;
      }
    }

    collectAllPages();
    console.log('[2GIS Parser] collectAllPages() launched (async)');
  }
}

new ParserPopup();
