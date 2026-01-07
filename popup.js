// 2GIS Parser Pro - Popup Script v2.3.1

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
      // Inject and execute the auto-pagination script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.autoCollectScript,
        args: [delay, maxPages]
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
    // Reset state
    window.__2gisParserStop = false;
    window.__2gisParserDone = false;
    window.__2gisParserError = null;
    window.__2gisParserCurrentPage = 1;
    window.__2gisParserTotalPages = '?';

    async function collectAllPages() {
      try {
        // Find total results count from "Места XXXXX"
        const getTotalPages = () => {
          // Look for "Места 19371" or similar text
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            if (el.children.length === 0) {
              const text = el.textContent.trim();
              const match = text.match(/Места\s+(\d+)/i);
              if (match) {
                const total = parseInt(match[1]);
                return Math.ceil(total / 12);
              }
            }
          }

          // Fallback: look for pagination numbers
          const paginationContainer = document.querySelector('._1x4k50l, [class*="Pagination"], [class*="pagination"]');
          if (paginationContainer) {
            let maxPage = 1;
            const buttons = paginationContainer.querySelectorAll('button, a');
            buttons.forEach(btn => {
              const num = parseInt(btn.textContent.trim());
              if (!isNaN(num) && num > maxPage) maxPage = num;
            });
            return maxPage;
          }

          return 100; // Default fallback
        };

        // Find the pagination container and next button
        const findNextButton = () => {
          // 2GIS specific: pagination is usually at the bottom of the list
          // Look for container with page numbers and arrows

          // Method 1: Find by looking for sibling of number buttons
          const paginationContainer = document.querySelector('._1x4k50l') ||
                                      document.querySelector('[class*="Pagination"]') ||
                                      document.querySelector('[class*="pagination"]');

          if (paginationContainer) {
            // Find all buttons/links in pagination
            const items = paginationContainer.querySelectorAll('button, a, span[role="button"]');
            const itemArray = Array.from(items);

            // Find the "next" arrow - it's usually the last clickable element
            // or has an arrow icon
            for (let i = itemArray.length - 1; i >= 0; i--) {
              const item = itemArray[i];
              const text = item.textContent.trim();

              // Check if it's the next arrow
              if (text === '›' || text === '>' || text === '→' || text === '') {
                // Check if it has an SVG arrow
                const svg = item.querySelector('svg');
                if (svg || text === '›' || text === '>') {
                  // Check not disabled
                  if (!item.disabled &&
                      !item.classList.contains('disabled') &&
                      !item.classList.contains('_1iczast') && // 2GIS disabled class
                      item.getAttribute('aria-disabled') !== 'true' &&
                      !item.hasAttribute('disabled')) {
                    return item;
                  }
                }
              }
            }
          }

          // Method 2: Direct search for arrow button
          const arrowSelectors = [
            'button svg[class*="arrow"]',
            '[class*="pagination"] button:last-child:not([disabled])',
            '[class*="pagination"] a:last-child:not([disabled])',
            'button[aria-label*="next"]',
            'button[aria-label*="следующ"]',
            'a[aria-label*="next"]',
            'a[aria-label*="следующ"]'
          ];

          for (const selector of arrowSelectors) {
            try {
              const el = document.querySelector(selector);
              if (el) {
                const btn = el.closest('button') || el.closest('a') || el;
                if (!btn.disabled && !btn.classList.contains('disabled')) {
                  return btn;
                }
              }
            } catch (e) {}
          }

          // Method 3: Look at the scroll panel for the list and find pagination
          const scrollPanel = document.querySelector('[class*="searchResults"], [class*="SearchResult"]');
          if (scrollPanel) {
            const pagination = scrollPanel.querySelector('[class*="pagination"], [class*="Pagination"]');
            if (pagination) {
              const lastBtn = pagination.querySelector('button:last-of-type, a:last-of-type');
              if (lastBtn && !lastBtn.disabled) return lastBtn;
            }
          }

          return null;
        };

        // Get current page from active button
        const getCurrentPage = () => {
          const paginationContainer = document.querySelector('._1x4k50l') ||
                                      document.querySelector('[class*="Pagination"]') ||
                                      document.querySelector('[class*="pagination"]');

          if (paginationContainer) {
            // Find active/current button
            const activeBtn = paginationContainer.querySelector('[class*="_selected"], [class*="active"], [class*="_current"], [aria-current="page"]');
            if (activeBtn) {
              const num = parseInt(activeBtn.textContent.trim());
              if (!isNaN(num)) return num;
            }

            // Alternative: find button with different styling
            const buttons = paginationContainer.querySelectorAll('button, a');
            for (const btn of buttons) {
              const num = parseInt(btn.textContent.trim());
              if (!isNaN(num)) {
                // Check if this button looks "selected" (has different background, etc)
                const style = window.getComputedStyle(btn);
                if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    style.backgroundColor !== 'transparent') {
                  return num;
                }
              }
            }
          }

          return window.__2gisParserCurrentPage || 1;
        };

        let totalPages = getTotalPages();
        window.__2gisParserTotalPages = Math.min(totalPages, maxPages);
        let currentPage = getCurrentPage();
        window.__2gisParserCurrentPage = currentPage;

        console.log(`[2GIS Parser] Starting auto-collect. Total pages: ~${totalPages}, Max: ${maxPages}, Current: ${currentPage}`);

        let attempts = 0;
        const maxAttempts = 3;

        while (currentPage < maxPages && !window.__2gisParserStop) {
          // Wait for page to load
          await new Promise(r => setTimeout(r, delay));

          if (window.__2gisParserStop) break;

          const nextBtn = findNextButton();

          if (!nextBtn) {
            attempts++;
            console.log(`[2GIS Parser] Next button not found, attempt ${attempts}/${maxAttempts}`);
            if (attempts >= maxAttempts) {
              console.log('[2GIS Parser] No more pages or pagination not found');
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          attempts = 0;

          // Scroll next button into view and click
          nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 300));

          console.log(`[2GIS Parser] Clicking next button...`);
          nextBtn.click();

          // Wait for content to update
          await new Promise(r => setTimeout(r, delay));

          const newPage = getCurrentPage();
          if (newPage > currentPage) {
            currentPage = newPage;
          } else {
            // Page didn't change based on selector, increment manually
            currentPage++;
          }
          window.__2gisParserCurrentPage = currentPage;

          // Update total if it changed
          totalPages = getTotalPages();
          window.__2gisParserTotalPages = Math.min(totalPages, maxPages);

          console.log(`[2GIS Parser] Now on page ${currentPage}/${window.__2gisParserTotalPages}`);
        }

        window.__2gisParserDone = true;
        console.log(`[2GIS Parser] Auto-collect finished. Pages collected: ${currentPage}`);

      } catch (error) {
        console.error('[2GIS Parser] Auto-collect error:', error);
        window.__2gisParserError = error.message;
      }
    }

    collectAllPages();
  }
}

new ParserPopup();
