document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultsContainer = document.getElementById('results-container');
    const incomeTableHead = document.querySelector('#income-table thead');
    const incomeTableBody = document.querySelector('#income-table tbody');
    const feesTableHead = document.querySelector('#fees-table thead');
    const feesTableBody = document.querySelector('#fees-table tbody');
    const readmeDetails = document.getElementById('readme-details');
    const readmeContainer = document.getElementById('readme-container');

    let isReadmeFetched = false;

    // Fetch README from GitHub only when opened
    readmeDetails.addEventListener('toggle', (event) => {
        if (event.target.open && !isReadmeFetched) {
            isReadmeFetched = true;
            fetch('https://api.github.com/repos/JohnFlowerBouquet/revolut-pit/readme')
                .then(response => response.json())
                .then(data => {
                    if (data.content) {
                        try {
                            const text = decodeURIComponent(escape(atob(data.content)));
                            const formattedHtml = text
                                .split('\n\n')
                                .map(paragraph => paragraph.startsWith('> ') 
                                    ? `<blockquote>${paragraph.replace(/^> /, '').trim()}</blockquote>`
                                    : paragraph)
                                .map(paragraph => {
                                    if (paragraph.startsWith('<')) return paragraph; 
                                    let html = paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                    html = html.replace(/https:\/\/api.nbp.pl([^\s]+)/g, '<a href="https://api.nbp.pl$1" target="_blank" class="api-link">https://api.nbp.pl$1</a>');
                                    return `<p>${html}</p>`;
                                })
                                .join('');
                                
                            readmeContainer.innerHTML = formattedHtml;
                        } catch(e) {
                            readmeContainer.innerHTML = '<p>Failed to parse summary</p>';
                        }
                    }
                })
                .catch(err => {
                    console.error("Failed to load README from GitHub", err);
                    readmeContainer.innerHTML = '<p>Failed to load summary from GitHub.</p>';
                });
        }
    });

    // Drag & Drop Handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    // Also allow clicking the whole dropzone to trigger file input
    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            fileInput.click();
        }
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                parseCSV(file);
            } else {
                alert('Please upload a valid CSV file.');
            }
        }
    }

    function parseCSV(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            processText(text);
        };
        reader.readAsText(file);
    }

    function parseCSVLine(line) {
        // Handle tab separation
        if (line.includes('\t')) return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
        
        let result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && line[i+1] === '"') {
                current += '"';
                i++; // Skip escaped quote
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    }

    let parsedIncomeHeaders = [];
    let parsedIncomeRows = [];
    let parsedFeesHeaders = [];
    let parsedFeesRows = [];

    let incomeColumnVisibility = [];
    let feesColumnVisibility = [];

    let nbpRates = {};
    let isConvertPLN = false;
    const convertPlnToggle = document.getElementById('convert-pln-toggle');
    const convertPlnText = document.getElementById('convert-pln-text');

    // Date Filters
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const btnLastYear = document.getElementById('btn-last-year');
    const btnCurrentYear = document.getElementById('btn-current-year');
    const filterSection = document.getElementById('filter-section');

    function formatDateForInput(dateObj) {
        if (!dateObj || isNaN(dateObj.getTime())) return '';
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    btnLastYear.addEventListener('click', () => {
        const currentYear = new Date().getFullYear();
        const lastYear = currentYear - 1;
        startDateInput.value = `${lastYear}-01-01`;
        endDateInput.value = `${lastYear}-12-31`;
        applyFilters();
    });

    btnCurrentYear.addEventListener('click', () => {
        const currentYear = new Date().getFullYear();
        startDateInput.value = `${currentYear}-01-01`;
        endDateInput.value = `${currentYear}-12-31`;
        applyFilters();
    });

    applyFiltersBtn.addEventListener('click', () => {
        applyFilters();
    });

    clearFiltersBtn.addEventListener('click', () => {
        autoFillDates();
        applyFilters();
    });

    function parseDateObj(dateStr) {
        if (!dateStr) return null;
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        
        // Fallback for tricky formats e.g DD/MM/YYYY or YYYY-MM-DD that fails
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            }
            if (parts[2].length === 4) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        return null;
    }

    function autoFillDates() {
        let earliestDate = null;
        let latestDate = null;

        const checkDate = (dateStr) => {
            const d = parseDateObj(dateStr);
            if (d) {
                if (!earliestDate || d < earliestDate) earliestDate = new Date(d);
                if (!latestDate || d > latestDate) latestDate = new Date(d);
            }
        };

        const dateSoldIdx = parsedIncomeHeaders.findIndex(h => h && h.toLowerCase() === 'date sold');
        if (dateSoldIdx !== -1) {
            parsedIncomeRows.forEach(row => checkDate(row[dateSoldIdx]));
        }

        const dateIdx = parsedFeesHeaders.findIndex(h => h && h.toLowerCase() === 'date');
        if (dateIdx !== -1) {
            parsedFeesRows.forEach(row => checkDate(row[dateIdx]));
        }

        startDateInput.value = formatDateForInput(earliestDate);
        endDateInput.value = formatDateForInput(latestDate);
    }

    function applyFilters() {
        const start = startDateInput.value ? new Date(startDateInput.value) : null;
        const end = endDateInput.value ? new Date(endDateInput.value) : null;

        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        // Filter Income Rows (using "Date sold" column)
        const dateSoldIdx = parsedIncomeHeaders.findIndex(h => h && h.toLowerCase() === 'date sold');
        let filteredIncome = parsedIncomeRows;
        
        if (dateSoldIdx !== -1 && (start || end)) {
            filteredIncome = parsedIncomeRows.filter(row => {
                const dateVal = row[dateSoldIdx];
                if (!dateVal) return false;
                const d = parseDateObj(dateVal);
                if (!d) return true; // keep if invalid date
                
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
        }

        // Filter Fees Rows (using "Date" column)
        const dateIdx = parsedFeesHeaders.findIndex(h => h && h.toLowerCase() === 'date');
        let filteredFees = parsedFeesRows;

        if (dateIdx !== -1 && (start || end)) {
            filteredFees = parsedFeesRows.filter(row => {
                const dateVal = row[dateIdx];
                if (!dateVal) return false;
                const d = parseDateObj(dateVal);
                if (!d) return true;
                
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
        }

        renderTable(incomeTableHead, incomeTableBody, parsedIncomeHeaders, filteredIncome, incomeColumnVisibility, true);
        renderTable(feesTableHead, feesTableBody, parsedFeesHeaders, filteredFees, feesColumnVisibility, false);
    }

    function processText(text) {
        const lines = text.split(/\r?\n/);
        
        let currentSection = null;
        parsedIncomeHeaders = [];
        parsedIncomeRows = [];
        parsedFeesHeaders = [];
        parsedFeesRows = [];
        
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            if (!line) {
                i++;
                continue;
            }
            
            const cols = parseCSVLine(line);
            
            // Clean out empty trailing columns
            while(cols.length > 0 && !cols[cols.length-1]) {
                cols.pop();
            }
            
            if (cols.length === 0) {
                i++;
                continue;
            }

            const firstCol = cols[0].toLowerCase();

            // Check for sections
            if (firstCol === 'income from sells') {
                currentSection = 'income';
                i++;
                // Try to find header
                while(i < lines.length) {
                    const headerCols = parseCSVLine(lines[i]);
                    while(headerCols.length > 0 && !headerCols[headerCols.length-1]) headerCols.pop();
                    if (headerCols.length > 0 && headerCols[0].toLowerCase() === 'date acquired') {
                        parsedIncomeHeaders = headerCols;
                        i++;
                        break;
                    }
                    i++;
                }
                continue;
            } else if (firstCol === 'other income & fees' || firstCol === 'other income') {
                currentSection = 'fees';
                i++;
                // Try to find header
                while(i < lines.length) {
                    const headerCols = parseCSVLine(lines[i]);
                    while(headerCols.length > 0 && !headerCols[headerCols.length-1]) headerCols.pop();
                    if (headerCols.length > 0 && headerCols[0].toLowerCase() === 'date') {
                        parsedFeesHeaders = headerCols;
                        i++;
                        break;
                    }
                    i++;
                }
                continue;
            }

            // Process data row
            if (currentSection === 'income' && cols.length > 1) {
                parsedIncomeRows.push(cols);
            } else if (currentSection === 'fees' && cols.length > 1) {
                parsedFeesRows.push(cols);
            }
            
            i++;
        }

        // Sort parsed rows based on requested columns
        const dateSoldIdxIncome = parsedIncomeHeaders.findIndex(h => h && h.toLowerCase() === 'date sold');
        if (dateSoldIdxIncome !== -1) {
            parsedIncomeRows.sort((a, b) => {
                const da = parseDateObj(a[dateSoldIdxIncome]);
                const db = parseDateObj(b[dateSoldIdxIncome]);
                return (da ? da.getTime() : 0) - (db ? db.getTime() : 0); // Ascending
            });
        }

        const dateIdxFees = parsedFeesHeaders.findIndex(h => h && h.toLowerCase() === 'date');
        if (dateIdxFees !== -1) {
            parsedFeesRows.sort((a, b) => {
                const da = parseDateObj(a[dateIdxFees]);
                const db = parseDateObj(b[dateIdxFees]);
                return (da ? da.getTime() : 0) - (db ? db.getTime() : 0); // Ascending
            });
        }

        // Initialize column visibility defaults
        incomeColumnVisibility = parsedIncomeHeaders.map(h => {
            const lower = h ? h.toLowerCase() : '';
            return !(lower === 'isin' || lower === 'cost basis');
        });

        feesColumnVisibility = parsedFeesHeaders.map(h => {
            const lower = h ? h.toLowerCase() : '';
            return !(lower === 'isin' || lower === 'cost basis'); // Applies if these columns exist in fees
        });

        renderToggles(document.getElementById('income-column-toggles'), parsedIncomeHeaders, incomeColumnVisibility, () => applyFilters());
        renderToggles(document.getElementById('fees-column-toggles'), parsedFeesHeaders, feesColumnVisibility, () => applyFilters());

        // Populate Start and End Date Inputs automatically
        autoFillDates();

        // Apply initial rendering (with no filters active yet, but using the boundaries)
        applyFilters();

        fetchNBPRates(); // Starts background fetch

        // Show results containers smoothly
        resultsContainer.classList.remove('hidden');
        filterSection.classList.remove('hidden');
    }

    async function fetchNBPRates() {
        const currencyIdx = parsedIncomeHeaders.findIndex(h => h && h.toLowerCase() === 'currency');
        const dateSoldIdxIncome = parsedIncomeHeaders.findIndex(h => h && h.toLowerCase() === 'date sold');

        if (currencyIdx === -1 || dateSoldIdxIncome === -1) return;
        
        const currenciesToFetch = new Set();
        let minYear = Infinity;
        let maxYear = -Infinity;

        parsedIncomeRows.forEach(row => {
            const currency = row[currencyIdx] ? row[currencyIdx].toUpperCase() : '';
            const dateStr = row[dateSoldIdxIncome];
            if (currency && currency !== 'PLN' && currency !== 'UNKNOWN' && currency !== 'TOTAL') {
                currenciesToFetch.add(currency);
            }
            const d = parseDateObj(dateStr);
            if (d) {
                const year = d.getFullYear();
                if (year < minYear) minYear = year;
                if (year > maxYear) maxYear = year;
            }
        });

        if (currenciesToFetch.size === 0 || minYear === Infinity) {
            convertPlnToggle.disabled = true;
            convertPlnText.textContent = "Convert to PLN (No foreign currencies found)";
            return;
        }

        try {
            for (const currency of currenciesToFetch) {
                nbpRates[currency] = {};
                for (let year = minYear; year <= maxYear; year++) {
                    const url = `https://api.nbp.pl/api/exchangerates/rates/a/${currency.toLowerCase()}/${year}-01-01/${year}-12-31/?format=json`;
                    try {
                        const response = await fetch(url);
                        if (response.ok) {
                            const data = await response.json();
                            if (data && data.rates) {
                                data.rates.forEach(rateObj => {
                                    nbpRates[currency][rateObj.effectiveDate] = rateObj.mid;
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch NBP rates for ${currency} ${year}`, e);
                    }
                }
            }
            
            convertPlnToggle.disabled = false;
            convertPlnText.textContent = "Convert to PLN (Rates loaded)";
            
            convertPlnToggle.addEventListener('change', (e) => {
                isConvertPLN = e.target.checked;
                applyFilters();
            });

        } catch (err) {
            console.error("Error fetching NBP rates", err);
            convertPlnText.textContent = "Convert to PLN (Failed to load rates)";
        }
    }

    function renderToggles(container, headers, visibilityArray, changeCallback) {
        container.innerHTML = '';
        headers.forEach((h, index) => {
            if (!h) return;
            
            const labelBtn = document.createElement('label');
            labelBtn.className = 'column-toggle-label';
            if (visibilityArray[index]) labelBtn.classList.add('active');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = visibilityArray[index];
            
            checkbox.addEventListener('change', (e) => {
                visibilityArray[index] = e.target.checked;
                if (e.target.checked) {
                    labelBtn.classList.add('active');
                } else {
                    labelBtn.classList.remove('active');
                }
                changeCallback();
            });

            labelBtn.appendChild(checkbox);
            labelBtn.appendChild(document.createTextNode(h));
            container.appendChild(labelBtn);
        });
    }

    function getPreviousBusinessDayRate(currency, dateSoldObj) {
        if (currency === 'PLN') return 1;
        if (!nbpRates[currency]) return null;

        let d = new Date(dateSoldObj);
        d.setDate(d.getDate() - 1); // Start from day before

        // Look back up to 10 days
        for (let i = 0; i < 10; i++) {
            const dateStr = formatDateForInput(d);
            if (nbpRates[currency][dateStr]) {
                return nbpRates[currency][dateStr];
            }
            d.setDate(d.getDate() - 1);
        }
        return null;
    }

    function renderTable(thead, tbody, headers, rows, visibilityArray, isIncomeTable) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (headers.length === 0 && rows.length === 0) return;

        // Render headers
        const trHead = document.createElement('tr');
        headers.forEach((h, index) => {
            if (!visibilityArray || visibilityArray[index]) {
                const th = document.createElement('th');
                th.textContent = h;
                trHead.appendChild(th);
            }
        });
        thead.appendChild(trHead);

        const currencyIdx = headers.findIndex(h => h && h.toLowerCase() === 'currency');
        const dateSoldIdxIncome = headers.findIndex(h => h && h.toLowerCase() === 'date sold');
        const columnSums = {};

        // Render rows
        rows.forEach(row => {
            let trCurrencyVal = currencyIdx !== -1 ? (row[currencyIdx] || 'Unknown') : 'Total';
            let rowConversionRate = 1;
            let didConvert = false;

            if (isIncomeTable && isConvertPLN && trCurrencyVal.toUpperCase() !== 'PLN' && dateSoldIdxIncome !== -1) {
                const dateSoldStr = row[dateSoldIdxIncome];
                const dSold = parseDateObj(dateSoldStr);
                if (dSold) {
                    const rate = getPreviousBusinessDayRate(trCurrencyVal.toUpperCase(), dSold);
                    if (rate) {
                        rowConversionRate = rate;
                        trCurrencyVal = 'PLN';
                        didConvert = true;
                    }
                }
            }

            const tr = document.createElement('tr');

            for (let j = 0; j < headers.length; j++) {
                let val = row[j] || '';
                const headerName = headers[j] ? headers[j].toLowerCase() : '';
                const isMonetaryCol = ['cost', 'proceeds', 'pnl', 'amount', 'tax', 'price'].some(kw => headerName.includes(kw));

                // Process Conversions inline Before display and Math block
                if (didConvert && isMonetaryCol) {
                    const numStr = String(val).replace(/[^-0-9.]/g, '');
                    if (numStr !== '') {
                        const isNegative = String(val).includes('-');
                        let numVal = parseFloat(numStr);
                        if (!isNaN(numVal)) {
                            numVal = isNegative ? -Math.abs(numVal) : Math.abs(numVal);
                            numVal = numVal * rowConversionRate;
                            val = parseFloat(numVal.toFixed(2)).toString();
                        }
                    }
                } else if (didConvert && headerName === 'currency') {
                    val = 'PLN';
                }

                if (!visibilityArray || visibilityArray[j]) {
                    const td = document.createElement('td');
                    td.textContent = val;

                    if (isMonetaryCol && val) {
                        const numStr = String(val).replace(/[^-0-9.]/g, '');
                        if (numStr !== '') {
                            const isNegative = String(val).includes('-');
                            const finalVal = isNegative ? -Math.abs(parseFloat(numStr)) : Math.abs(parseFloat(numStr));
                            if (!isNaN(finalVal)) {
                                if (finalVal > 0) td.classList.add('val-positive');
                                else if (finalVal < 0) td.classList.add('val-negative');
                            }
                        }
                    }
                    tr.appendChild(td);
                }

                // Foot math sums
                if (isMonetaryCol && val) {
                    const numStr = String(val).replace(/[^-0-9.]/g, '');
                    if (numStr !== '') {
                        const isNegative = String(val).includes('-');
                        let numVal = parseFloat(numStr);
                        if (!isNaN(numVal)) {
                            numVal = isNegative ? -Math.abs(numVal) : Math.abs(numVal);
                            
                            if (!columnSums[j]) columnSums[j] = {};
                            if (!columnSums[j][trCurrencyVal]) columnSums[j][trCurrencyVal] = 0;
                            columnSums[j][trCurrencyVal] += numVal;
                        }
                    }
                }
            }
            tbody.appendChild(tr);
        });

        const table = thead.parentElement;
        let tfoot = table.querySelector('tfoot');
        if (!tfoot) {
            tfoot = document.createElement('tfoot');
            table.appendChild(tfoot);
        }
        tfoot.innerHTML = '';

        const trFoot = document.createElement('tr');
        trFoot.classList.add('summary-row');

        for (let j = 0; j < headers.length; j++) {
            if (!visibilityArray || visibilityArray[j]) {
                const td = document.createElement('td');
                const firstVisible = visibilityArray ? visibilityArray.findIndex(v => v) : 0;
                
                if (j === firstVisible) {
                    td.textContent = 'Summary';
                } else if (columnSums[j]) {
                    const sumsHTML = Object.entries(columnSums[j]).map(([curr, sum]) => {
                        const sumStr = (parseFloat(sum.toFixed(2))).toString();
                        let colorClass = '';
                        const headerName = headers[j].toLowerCase();
                        if (headerName.includes('pnl') || headerName.includes('net amount')) {
                            if (sum > 0) colorClass = 'val-positive';
                            else if (sum < 0) colorClass = 'val-negative';
                        }
                        return `<div class="${colorClass}">${sumStr} ${curr !== 'Total' ? curr : ''}</div>`;
                    }).join('');
                    td.innerHTML = sumsHTML;
                }
                trFoot.appendChild(td);
            }
        }
        tfoot.appendChild(trFoot);
    }
});
