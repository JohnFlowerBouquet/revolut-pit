document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultsContainer = document.getElementById('results-container');
    const incomeTableHead = document.querySelector('#income-table thead');
    const incomeTableBody = document.querySelector('#income-table tbody');
    const feesTableHead = document.querySelector('#fees-table thead');
    const feesTableBody = document.querySelector('#fees-table tbody');

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

    function processText(text) {
        const lines = text.split(/\r?\n/);
        
        let currentSection = null;
        let incomeHeaders = [];
        let incomeRows = [];
        let feesHeaders = [];
        let feesRows = [];
        
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
                        incomeHeaders = headerCols;
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
                        feesHeaders = headerCols;
                        i++;
                        break;
                    }
                    i++;
                }
                continue;
            }

            // Process data row
            if (currentSection === 'income' && cols.length > 1) {
                incomeRows.push(cols);
            } else if (currentSection === 'fees' && cols.length > 1) {
                feesRows.push(cols);
            }
            
            i++;
        }

        renderTable(incomeTableHead, incomeTableBody, incomeHeaders, incomeRows);
        renderTable(feesTableHead, feesTableBody, feesHeaders, feesRows);

        // Show results container smoothly
        resultsContainer.classList.remove('hidden');
    }

    function renderTable(thead, tbody, headers, rows) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (headers.length === 0 && rows.length === 0) return;

        // Render headers
        const trHead = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);

        // Render rows
        rows.forEach(row => {
            const tr = document.createElement('tr');
            for (let j = 0; j < headers.length; j++) {
                const td = document.createElement('td');
                const val = row[j] || '';
                td.textContent = val;
                
                // Color formatting for PnL / Amount
                if (headers[j]) {
                    const headerName = headers[j].toLowerCase();
                    if (headerName.includes('pnl') || headerName.includes('net amount')) {
                        // Extract number
                        const numStr = String(val).replace(/[^-0-9.]/g, '');
                        // Check if it's genuinely a negative number e.g. -63.21 instead of "-" prefix formatting
                        const isNegative = String(val).includes('-');
                        const numVal = parseFloat(numStr);
                        
                        // We must handle string minus properly
                        const finalVal = isNegative ? -Math.abs(numVal) : Math.abs(numVal);

                        if (!isNaN(finalVal)) {
                            if (finalVal > 0) td.classList.add('val-positive');
                            else if (finalVal < 0) td.classList.add('val-negative');
                        }
                    }
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    }
});
