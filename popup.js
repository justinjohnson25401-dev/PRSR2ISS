// 2GIS Parser Pro - Popup Script v2.3.3

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
        // Find total from "Места XXXXX" - simple text search
        const getTotalPages = () => {
          // Ищем текст "Места" на странице
          const bodyText = document.body.innerText;
          const match = bodyText.match(/Места\s+(\d[\d\s]*)/i);
          if (match) {
            const total = parseInt(match[1].replace(/\s/g, ''));
            if (!isNaN(total) && total > 0) {
              return Math.ceil(total / 12);
            }
          }
          return maxPages; // fallback
        };

        // Поиск кнопки ">" - на 2GIS это div с SVG внутри
        const findNextButton = () => {
          // Метод 1: Ищем контейнер пагинации по классу _1x4k6z7
          const paginationContainer = document.querySelector('._1x4k6z7, [class*="_1x4k6z"]');

          if (paginationContainer) {
            console.log('[2GIS Parser] Found pagination container');

            // Ищем все div с SVG внутри пагинации
            const divsWithSvg = paginationContainer.querySelectorAll('div');
            const arrowDivs = [];

            for (const div of divsWithSvg) {
              const svg = div.querySelector('svg');
              if (svg && div.children.length === 1) {
                // Это div который содержит только SVG - вероятно кнопка навигации
                arrowDivs.push(div);
              }
            }

            console.log('[2GIS Parser] Found arrow divs:', arrowDivs.length);

            // Последний div с SVG - это кнопка "вперед" (>)
            if (arrowDivs.length >= 2) {
              const nextBtn = arrowDivs[arrowDivs.length - 1];
              console.log('[2GIS Parser] Found next button (last arrow div)');
              return nextBtn;
            }
            if (arrowDivs.length === 1) {
              // Только одна стрелка - проверим это ">" или "<"
              const svg = arrowDivs[0].querySelector('svg');
              const style = window.getComputedStyle(svg);
              const transform = style.transform || svg.style.transform || '';
              // rotate(-90deg) = стрелка вправо, rotate(90deg) = стрелка влево
              if (transform.includes('-90') || transform.includes('270')) {
                console.log('[2GIS Parser] Found next button (single arrow, rotated right)');
                return arrowDivs[0];
              }
            }
          }

          // Метод 2: Ищем по классу _n5hmn94 напрямую
          const arrowButtons = document.querySelectorAll('[class*="_n5hmn94"], [class*="arrow"], [class*="Arrow"]');
          if (arrowButtons.length >= 2) {
            const nextBtn = arrowButtons[arrowButtons.length - 1];
            console.log('[2GIS Parser] Found next button by class pattern');
            return nextBtn;
          }

          // Метод 3: Ищем любой div с SVG стрелкой в нижней части страницы
          const allSvgs = document.querySelectorAll('svg');
          for (const svg of allSvgs) {
            const rect = svg.getBoundingClientRect();
            // Пагинация обычно внизу видимой области
            if (rect.top > 500) {
              const parent = svg.parentElement;
              if (parent && parent.tagName === 'DIV') {
                const style = window.getComputedStyle(svg);
                const transform = style.transform || '';
                if (transform.includes('-90') || transform.includes('270')) {
                  console.log('[2GIS Parser] Found next button by SVG position and rotation');
                  return parent;
                }
              }
            }
          }

          console.log('[2GIS Parser] Next button not found');
          return null;
        };

        // Получаем текущую страницу из URL или из кнопок
        const getCurrentPage = () => {
          // Попробуем из URL
          const url = window.location.href;
          const pageMatch = url.match(/[?&]page=(\d+)/);
          if (pageMatch) {
            return parseInt(pageMatch[1]);
          }

          // Ищем активную кнопку с номером
          const clickables = document.querySelectorAll('button, a, [role="button"]');
          for (const el of clickables) {
            const text = el.textContent.trim();
            const num = parseInt(text);

            if (!isNaN(num) && num >= 1 && num <= 100) {
              // Проверяем стили - активная кнопка обычно имеет другой фон
              const style = window.getComputedStyle(el);
              const bg = style.backgroundColor;

              // Если фон не прозрачный и не белый - вероятно это активная кнопка
              if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' &&
                  bg !== 'rgb(255, 255, 255)' && bg !== 'white') {
                console.log('[2GIS Parser] Found current page:', num, 'bg:', bg);
                return num;
              }
            }
          }

          return window.__2gisParserCurrentPage || 1;
        };

        let totalPages = getTotalPages();
        window.__2gisParserTotalPages = Math.min(totalPages, maxPages);
        let currentPage = getCurrentPage();
        window.__2gisParserCurrentPage = currentPage;

        console.log(`[2GIS Parser] Starting auto-collect. Total: ~${totalPages}, Max: ${maxPages}, Current: ${currentPage}`);

        let noButtonCount = 0;

        while (currentPage < maxPages && !window.__2gisParserStop) {
          // Ждем загрузки
          await new Promise(r => setTimeout(r, delay));

          if (window.__2gisParserStop) break;

          const nextBtn = findNextButton();

          if (!nextBtn) {
            noButtonCount++;
            console.log(`[2GIS Parser] Next button not found, attempt ${noButtonCount}`);
            if (noButtonCount >= 3) {
              console.log('[2GIS Parser] Stopping - no next button found');
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          noButtonCount = 0;

          // Прокручиваем к кнопке и кликаем
          nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 300));

          console.log(`[2GIS Parser] Clicking next...`);
          nextBtn.click();

          currentPage++;
          window.__2gisParserCurrentPage = currentPage;

          // Ждем обновления контента
          await new Promise(r => setTimeout(r, delay));

          // Обновляем total если нужно
          const newTotal = getTotalPages();
          if (newTotal !== totalPages) {
            totalPages = newTotal;
            window.__2gisParserTotalPages = Math.min(totalPages, maxPages);
          }

          console.log(`[2GIS Parser] Page ${currentPage}/${window.__2gisParserTotalPages}`);
        }

        window.__2gisParserDone = true;
        console.log(`[2GIS Parser] Done! Collected ${currentPage} pages`);

      } catch (error) {
        console.error('[2GIS Parser] Error:', error);
        window.__2gisParserError = error.message;
      }
    }

    collectAllPages();
  }
}

new ParserPopup();
