(function () {
  'use strict';

  // ── DOM refs ────────────────────────────────────────────────────────────
  var viewLogin       = document.getElementById('view-login');
  var viewDashboard   = document.getElementById('view-dashboard');
  var viewList        = document.getElementById('view-list');
  var viewDetail      = document.getElementById('view-detail');
  var loginForm       = document.getElementById('login-form');
  var engineerSelect  = document.getElementById('engineer-select');
  var pinInput        = document.getElementById('pin-input');
  var loginError      = document.getElementById('login-error');
  var headerEngineer  = document.getElementById('header-engineer');
  var btnLogout       = document.getElementById('btn-logout');
  var btnRetry        = document.getElementById('btn-retry');
  var btnViewAll      = document.getElementById('btn-view-all');
  var btnBack         = document.getElementById('btn-back');
  var btnLogoutList   = document.getElementById('btn-logout-list');
  var listTitle       = document.getElementById('list-title');
  var listSubtitle    = document.getElementById('list-subtitle');
  var woList          = document.getElementById('wo-list');
  var listSearch      = document.getElementById('list-search');
  var btnBackDetail   = document.getElementById('btn-back-detail');
  var btnLogoutDetail = document.getElementById('btn-logout-detail');
  var detailHeader    = document.querySelector('#view-detail .app-header');
  var detailWoNum     = document.getElementById('detail-wo-num');
  var detailInfo      = document.getElementById('detail-info');
  var readingInput    = document.getElementById('reading-input');
  var compCodeSelect  = document.getElementById('comp-code-select');
  var activityText    = document.getElementById('activity-text');
  var btnSave         = document.getElementById('btn-save');
  var saveFeedback    = document.getElementById('save-feedback');
  var loadingState    = document.getElementById('loading-state');
  var errorState      = document.getElementById('error-state');
  var errorMessage    = document.getElementById('error-message');
  var dashboardContent = document.getElementById('dashboard-content');
  var totalCount      = document.getElementById('total-count');
  var breakdownGrid   = document.getElementById('breakdown-grid');
  var progressFill    = document.getElementById('progress-bar-fill');
  var progressLabel   = document.getElementById('progress-label');
  var btnEmailCsv     = document.getElementById('btn-email-csv');

  // ── Cached data (set after first fetch) ─────────────────────────────────
  var cachedMyRows    = null;   // rows filtered to the logged-in engineer
  var cachedAddrIdx   = -1;
  var cachedCityIdx   = -1;
  var cachedWoIdx     = -1;
  var cachedCodeIdx   = -1;
  var cachedMeterNumIdx  = -1;
  var cachedMeterSizeIdx = -1;
  var cachedNotifTypeIdx = -1;
  var cachedRefErtIdx    = -1;
  var cachedMeterLocIdx  = -1;
  var cachedTgtStartIdx  = -1;
  var cachedTgtFinishIdx = -1;

  // ── Navigation state ─────────────────────────────────────────────────────
  var currentDetailRow  = null;   // raw row array for the open detail view
  var currentListRows   = [];     // rows shown in list view (after code filter, before search)


  // ── Boot ────────────────────────────────────────────────────────────────
  document.getElementById('version-label').textContent = 'v' + CONFIG.VERSION;
  populateDropdown();
  checkSession();

  // ── Populate engineer dropdown ──────────────────────────────────────────
  function populateDropdown() {
    var codes = Object.keys(CONFIG.ENGINEERS).sort(function (a, b) {
      return CONFIG.ENGINEERS[a].name.localeCompare(CONFIG.ENGINEERS[b].name);
    });
    codes.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = CONFIG.ENGINEERS[code].name + ' (' + code + ')';
      engineerSelect.appendChild(opt);
    });
  }

  // ── Session helpers ─────────────────────────────────────────────────────
  function checkSession() {
    try {
      var saved = sessionStorage.getItem('wo_engineer');
      if (saved) {
        var sess = JSON.parse(saved);
        if (sess && sess.code && CONFIG.ENGINEERS[sess.code]) {
          showDashboard(sess.code, sess.name);
        }
      }
    } catch (e) { /* ignore */ }
  }

  function saveSession(code, name) {
    try { sessionStorage.setItem('wo_engineer', JSON.stringify({ code: code, name: name })); }
    catch (e) { /* ignore */ }
  }

  function clearSession() {
    try { sessionStorage.removeItem('wo_engineer'); }
    catch (e) { /* ignore */ }
  }

  // ── Login ───────────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.classList.add('hidden');

    var code = engineerSelect.value;
    var pin  = pinInput.value;

    if (!code) {
      engineerSelect.focus();
      return;
    }

    var engineer = CONFIG.ENGINEERS[code];
    if (!engineer || engineer.pin !== pin) {
      loginError.classList.remove('hidden');
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    saveSession(code, engineer.name);
    showDashboard(code, engineer.name);
  });

  // ── Logout ──────────────────────────────────────────────────────────────
  function doLogout() {
    clearSession();
    cachedMyRows = null;
    currentDetailRow = null;
    currentListRows = [];
    pinInput.value = '';
    engineerSelect.value = '';
    loginError.classList.add('hidden');
    viewDashboard.classList.add('hidden');
    viewList.classList.add('hidden');
    viewDetail.classList.add('hidden');
    viewLogin.classList.remove('hidden');
  }
  btnLogout.addEventListener('click', doLogout);
  btnLogoutList.addEventListener('click', doLogout);
  btnLogoutDetail.addEventListener('click', doLogout);

  // ── View All ─────────────────────────────────────────────────────────────
  btnViewAll.addEventListener('click', function () {
    showList(null);
  });

  // ── Email CSV ────────────────────────────────────────────────────────────
  btnEmailCsv.addEventListener('click', function () {
    var sess = JSON.parse(sessionStorage.getItem('wo_engineer') || '{}');
    var engineerCode = sess.code || 'unknown';
    var csv = buildCSV();
    var date = new Date().toISOString().slice(0, 10);
    var filename = 'wo-entries-' + engineerCode + '-' + date + '.csv';
    var subject = 'Work Orders — ' + engineerCode + ' — ' + date;

    // Web Share API: lets the user pick Mail, Messages, etc. on mobile
    if (navigator.canShare) {
      var blob = new Blob([csv], { type: 'text/csv' });
      var file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: subject }).catch(function () {});
        return;
      }
    }

    // Fallback: open mailto: with CSV pasted into the body
    window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(csv);
  });

  // ── Search ───────────────────────────────────────────────────────────────
  listSearch.addEventListener('input', applySearch);

  // ── Back: list → dashboard ───────────────────────────────────────────────
  btnBack.addEventListener('click', function () {
    viewList.classList.add('hidden');
    viewDashboard.classList.remove('hidden');
    updateProgress();
  });

  // ── Back: detail → list ──────────────────────────────────────────────────
  btnBackDetail.addEventListener('click', function () {
    viewDetail.classList.add('hidden');
    viewList.classList.remove('hidden');
  });

  // ── Save ─────────────────────────────────────────────────────────────────
  btnSave.addEventListener('click', function () {
    if (!currentDetailRow) return;
    var wo = (currentDetailRow[cachedWoIdx] || '').trim();
    if (!wo) return;
    var entry = {
      woNum:        wo,
      address:      (currentDetailRow[cachedAddrIdx]      || '').trim(),
      city:         (currentDetailRow[cachedCityIdx]      || '').trim(),
      meterNum:     (currentDetailRow[cachedMeterNumIdx]  || '').trim(),
      meterSize:    (currentDetailRow[cachedMeterSizeIdx] || '').trim(),
      notifType:    (currentDetailRow[cachedNotifTypeIdx] || '').trim(),
      refErt:       (currentDetailRow[cachedRefErtIdx]    || '').trim(),
      meterLoc:     (currentDetailRow[cachedMeterLocIdx]  || '').trim(),
      tgtStart:     (currentDetailRow[cachedTgtStartIdx]  || '').trim().replace(/\s\d{2}:\d{2}(:\d{2})?$/, ''),
      tgtFinish:    (currentDetailRow[cachedTgtFinishIdx] || '').trim().replace(/\s\d{2}:\d{2}(:\d{2})?$/, ''),
      reading:      readingInput.value,
      compCode:     compCodeSelect.value,
      activityText: activityText.value,
      savedAt:      new Date().toISOString()
    };
    try {
      localStorage.setItem('wo_entry_' + wo, JSON.stringify(entry));
    } catch (e) { /* storage unavailable */ }

    // Save CSV silently to Origin Private File System
    saveToOPFS(buildCSV());

    saveFeedback.classList.remove('hidden');
    setTimeout(function () {
      saveFeedback.classList.add('hidden');
      var idx = currentListRows.indexOf(currentDetailRow);
      if (idx >= 0 && idx + 1 < currentListRows.length) {
        showDetail(currentListRows[idx + 1]);
      } else {
        // Last work order — return to list
        viewDetail.classList.add('hidden');
        viewList.classList.remove('hidden');
      }
    }, 800);
  });

  // ── Retry ───────────────────────────────────────────────────────────────
  btnRetry.addEventListener('click', function () {
    try {
      var saved = sessionStorage.getItem('wo_engineer');
      if (saved) {
        var sess = JSON.parse(saved);
        loadData(sess.code);
      }
    } catch (e) { /* ignore */ }
  });

  // ── Show dashboard view ─────────────────────────────────────────────────
  function showDashboard(code, name) {
    viewLogin.classList.add('hidden');
    viewDashboard.classList.remove('hidden');
    headerEngineer.textContent = name + ' (' + code + ')';
    loadData(code);
  }

  // ── Fetch published CSV ─────────────────────────────────────────────────
  function loadData(engineerCode) {
    setLoading();

    fetch(CONFIG.CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' — check that the sheet is published to the web as CSV.');
        return res.text();
      })
      .then(function (csvText) {
        var rows = parseCSV(csvText);
        renderDashboard(rows, engineerCode);
      })
      .catch(function (err) {
        setError(err.message || 'Could not load data. Check your internet connection.');
      });
  }

  // ── CSV parser (handles quoted fields and embedded commas/newlines) ──────
  function parseCSV(text) {
    var rows = [];
    var i = 0;
    var len = text.length;

    while (i < len) {
      var row = [];

      while (i < len) {
        var field = '';

        if (text[i] === '"') {
          // Quoted field
          i++; // skip opening quote
          while (i < len) {
            if (text[i] === '"') {
              if (i + 1 < len && text[i + 1] === '"') {
                field += '"'; // escaped quote
                i += 2;
              } else {
                i++; // skip closing quote
                break;
              }
            } else {
              field += text[i];
              i++;
            }
          }
        } else {
          // Unquoted field — read until comma or newline
          while (i < len && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
            field += text[i];
            i++;
          }
        }

        row.push(field.trim());

        if (i < len && text[i] === ',') {
          i++; // skip comma → next field
        } else {
          // End of row
          if (i < len && text[i] === '\r') i++;
          if (i < len && text[i] === '\n') i++;
          break;
        }
      }

      // Skip blank rows
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        rows.push(row);
      }
    }

    return rows;
  }

  // ── Render dashboard ────────────────────────────────────────────────────
  function renderDashboard(rows, engineerCode) {
    if (!rows || rows.length < 2) {
      setError('No data found in the spreadsheet.');
      return;
    }

    // Build header → index map (trim whitespace from headers)
    var headers = rows[0].map(function (h) { return (h || '').trim(); });
    var engineerIdx  = headers.indexOf('engineer');
    var notifCodeIdx = headers.indexOf('Notification Code');

    if (engineerIdx === -1) {
      setError('Column "engineer" not found in the spreadsheet.');
      return;
    }
    if (notifCodeIdx === -1) {
      setError('Column "Notification Code" not found in the spreadsheet.');
      return;
    }

    // Cache column indices for list + detail views
    cachedWoIdx       = headers.indexOf('Workorder');
    cachedAddrIdx     = headers.indexOf('Street Address');
    cachedCityIdx     = headers.indexOf('City');
    cachedCodeIdx     = notifCodeIdx;
    cachedMeterNumIdx  = headers.indexOf('Meter Number');
    cachedMeterSizeIdx = headers.indexOf('Meter Size');
    cachedNotifTypeIdx = headers.indexOf('Notification Type');
    cachedRefErtIdx    = headers.indexOf('Reference ERT');
    cachedMeterLocIdx  = headers.indexOf('Meter Location');
    cachedTgtStartIdx  = headers.indexOf('targetstart');
    cachedTgtFinishIdx = headers.indexOf('targetfinish');

    // Filter rows for this engineer
    var myRows = rows.slice(1).filter(function (row) {
      return ((row[engineerIdx] || '').trim()) === engineerCode;
    });
    cachedMyRows = myRows;

    // Count by notification code
    var codeCounts = {};
    myRows.forEach(function (row) {
      var code = ((row[notifCodeIdx] || '').trim());
      if (code) {
        codeCounts[code] = (codeCounts[code] || 0) + 1;
      }
    });

    // Sort by count descending, then alphabetically
    var sorted = Object.keys(codeCounts)
      .map(function (k) { return [k, codeCounts[k]]; })
      .sort(function (a, b) {
        return b[1] - a[1] || a[0].localeCompare(b[0]);
      });

    // ── Total ──
    totalCount.textContent = myRows.length;

    // ── Breakdown ──
    breakdownGrid.innerHTML = '';

    if (sorted.length === 0) {
      var msg = document.createElement('p');
      msg.style.cssText = 'color:#616161;grid-column:1/-1;text-align:center;padding:24px 0';
      msg.textContent = 'No work orders found for your account.';
      breakdownGrid.appendChild(msg);
    } else {
      sorted.forEach(function (pair) {
        var code  = pair[0];
        var count = pair[1];
        var colors = getCodeColors(code);
        var badgeStyle = colors.bg
          ? ' style="background:' + colors.bg + ';color:' + colors.text + '"'
          : '';
        var card  = document.createElement('div');
        card.className = 'code-card code-card--clickable';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        if (colors.bg) {
          card.style.borderLeft = '3px solid ' + colors.bg;
        }
        card.innerHTML =
          '<div class="code-badge"' + badgeStyle + '>' + esc(code) + '</div>' +
          '<div class="code-info">' +
            '<div class="code-count">' + count + '</div>' +
            '<div class="code-label">order' + (count !== 1 ? 's' : '') + '</div>' +
          '</div>' +
          '<div class="code-arrow">&#8250;</div>';
        card.addEventListener('click', (function (c) {
          return function () { showList(c); };
        }(code)));
        card.addEventListener('keydown', (function (c) {
          return function (e) { if (e.key === 'Enter' || e.key === ' ') showList(c); };
        }(code)));
        breakdownGrid.appendChild(card);
      });
    }

    updateProgress();
    setContent();
  }

  // ── Progress bar ─────────────────────────────────────────────────────────
  function updateProgress() {
    if (!cachedMyRows) return;
    var total = cachedMyRows.length;
    var savedCount = cachedMyRows.filter(function (row) {
      var wo = (cachedWoIdx >= 0 ? (row[cachedWoIdx] || '') : '').trim();
      return wo && localStorage.getItem('wo_entry_' + wo) !== null;
    }).length;
    var pct = total > 0 ? Math.round((savedCount / total) * 100) : 0;
    progressFill.style.width = pct + '%';
    progressLabel.textContent = savedCount + ' of ' + total + ' completed (' + pct + '%)';
  }

  // ── Show list view ───────────────────────────────────────────────────────
  function showList(filterCode) {
    if (!cachedMyRows) return;
    viewDashboard.classList.add('hidden');
    viewList.classList.remove('hidden');
    renderList(filterCode);
  }

  // ── Render list (sets header, resets search, stores base rows) ───────────
  function renderList(filterCode) {
    currentListRows = filterCode
      ? cachedMyRows.filter(function (r) {
          return ((r[cachedCodeIdx] || '').trim()) === filterCode;
        })
      : cachedMyRows;

    listTitle.textContent    = filterCode || 'All Work Orders';
    listSubtitle.textContent = currentListRows.length + ' work order' + (currentListRows.length !== 1 ? 's' : '');

    listSearch.value = '';
    renderRows(currentListRows);
  }

  // ── Apply search filter ───────────────────────────────────────────────────
  function applySearch() {
    var term = listSearch.value.trim().toLowerCase();
    if (!term) {
      renderRows(currentListRows);
      return;
    }
    var filtered = currentListRows.filter(function (r) {
      return [cachedAddrIdx, cachedCityIdx, cachedWoIdx, cachedMeterNumIdx, cachedMeterSizeIdx]
        .some(function (idx) {
          return idx >= 0 && (r[idx] || '').toLowerCase().indexOf(term) !== -1;
        });
    });
    renderRows(filtered);
  }

  // ── Render a given array of rows into the list ────────────────────────────
  function renderRows(rows) {
    woList.innerHTML = '';

    if (rows.length === 0) {
      var empty = document.createElement('p');
      empty.style.cssText = 'text-align:center;color:#616161;padding:48px 16px';
      empty.textContent = listSearch.value.trim() ? 'No results found.' : 'No work orders found.';
      woList.appendChild(empty);
      return;
    }

    rows.forEach(function (row) {
      var wo     = (row[cachedWoIdx]       || '').trim();
      var addr   = (row[cachedAddrIdx]     || '').trim();
      var city   = (row[cachedCityIdx]     || '').trim();
      var loc    = (row[cachedMeterLocIdx] || '').trim();
      var code   = (row[cachedCodeIdx]     || '').trim();
      var colors = getCodeColors(code);

      var saved = wo && localStorage.getItem('wo_entry_' + wo) !== null;

      var item = document.createElement('div');
      item.className = 'wo-item wo-item--clickable' + (saved ? ' wo-item--done' : '');
      if (colors.bg) item.style.borderLeft = '4px solid ' + colors.bg;
      item.innerHTML =
        '<div class="wo-body">' +
          '<div class="wo-address">' + esc(addr || '—') + '</div>' +
          (city ? '<div class="wo-city">' + esc(city) + '</div>' : '') +
          (loc  ? '<div class="wo-loc">'  + esc(loc)  + '</div>' : '') +
          (code ? '<div class="wo-code"' + (colors.bg ? ' style="background:' + colors.bg + ';color:' + colors.text + '"' : '') + '>' + esc(code) + '</div>' : '') +
        '</div>' +
        (wo ? '<div class="wo-num">' + esc(wo) + '</div>' : '') +
        '<div class="wo-arrow">&#8250;</div>';
      item.addEventListener('click', (function (r) {
        return function () { showDetail(r); };
      }(row)));
      woList.appendChild(item);
    });
  }

  // ── Show detail view ─────────────────────────────────────────────────────
  function showDetail(row) {
    currentDetailRow = row;
    viewList.classList.add('hidden');
    viewDetail.classList.remove('hidden');
    renderDetail(row);
  }

  // ── Render detail ────────────────────────────────────────────────────────
  function renderDetail(row) {
    var wo = (row[cachedWoIdx] || '').trim();
    detailWoNum.textContent = wo || '';

    // Colour the header banner by notification code
    var notifCode  = (cachedCodeIdx >= 0 ? (row[cachedCodeIdx] || '') : '').trim();
    var hdrColors  = getCodeColors(notifCode);
    detailHeader.style.background = hdrColors.bg || '#1565c0';

    // Info fields — singles and [paired] groups (City removed)
    var fieldGroups = [
      { label: 'Work Order',        idx: cachedWoIdx },
      { label: 'Address',           idx: cachedAddrIdx },
      [
        { label: 'Meter Number',    idx: cachedMeterNumIdx },
        { label: 'Meter Size',      idx: cachedMeterSizeIdx },
      ],
      [
        { label: 'Reference ERT',   idx: cachedRefErtIdx },
        { label: 'Meter Location',  idx: cachedMeterLocIdx },
      ],
      [
        { label: 'Target Start',    idx: cachedTgtStartIdx,  date: true },
        { label: 'Target Finish',   idx: cachedTgtFinishIdx, date: true },
      ],
    ];

    detailInfo.innerHTML = '';
    fieldGroups.forEach(function (group) {
      if (Array.isArray(group)) {
        var pairDiv = document.createElement('div');
        pairDiv.className = 'detail-pair';
        group.forEach(function (f) {
          var raw = (f.idx >= 0 ? (row[f.idx] || '') : '').trim();
          if (!raw) return;
          var val = f.date ? formatDate(raw) : raw.replace(/\s\d{2}:\d{2}(:\d{2})?$/, '');
          var div = document.createElement('div');
          div.className = 'detail-row';
          div.innerHTML =
            '<span class="detail-label">' + esc(f.label) + '</span>' +
            '<span class="detail-value">' + esc(val) + '</span>';
          pairDiv.appendChild(div);
        });
        if (pairDiv.children.length > 0) detailInfo.appendChild(pairDiv);
      } else {
        var raw = (group.idx >= 0 ? (row[group.idx] || '') : '').trim();
        if (!raw) return;
        var val = group.date ? formatDate(raw) : raw.replace(/\s\d{2}:\d{2}(:\d{2})?$/, '');
        var div = document.createElement('div');
        div.className = 'detail-row';
        div.innerHTML =
          '<span class="detail-label">' + esc(group.label) + '</span>' +
          '<span class="detail-value">' + esc(val) + '</span>';
        detailInfo.appendChild(div);
      }
    });

    // Restore any previously saved entry for this work order
    readingInput.value = '';
    compCodeSelect.value = '';
    activityText.value = '';
    saveFeedback.classList.add('hidden');
    if (wo) {
      try {
        var saved = localStorage.getItem('wo_entry_' + wo);
        if (saved) {
          var entry = JSON.parse(saved);
          readingInput.value   = entry.reading      || '';
          compCodeSelect.value = entry.compCode     || '';
          activityText.value   = entry.activityText || '';
        }
      } catch (e) { /* ignore */ }
    }
  }

  // ── UI state helpers ────────────────────────────────────────────────────
  function setLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    dashboardContent.classList.add('hidden');
  }

  function setError(msg) {
    errorMessage.textContent = msg;
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
  }

  function setContent() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
  }

  // ── CSV export ───────────────────────────────────────────────────────────

  // Build the CSV string from all localStorage entries
  function buildCSV() {
    var headers = [
      'Work Order', 'Address', 'City', 'Meter Number', 'Meter Size',
      'Notification Type', 'Reference ERT', 'Meter Location',
      'Target Start', 'Target Finish',
      'Reading', 'Completion Code', 'Activity Text', 'Saved At'
    ];
    var fields = [
      'woNum', 'address', 'city', 'meterNum', 'meterSize',
      'notifType', 'refErt', 'meterLoc',
      'tgtStart', 'tgtFinish',
      'reading', 'compCode', 'activityText', 'savedAt'
    ];
    var rows = [headers.map(csvCell).join(',')];
    Object.keys(localStorage)
      .filter(function (k) { return k.indexOf('wo_entry_') === 0; })
      .forEach(function (k) {
        try {
          var e = JSON.parse(localStorage.getItem(k));
          rows.push(fields.map(function (f) { return csvCell(e[f] || ''); }).join(','));
        } catch (ex) { /* skip corrupt entry */ }
      });
    return rows.join('\r\n');
  }

  // Fallback: trigger a browser download (used when FSA is unavailable)
  function triggerDownload(engineerCode, csv) {
    var date = new Date().toISOString().slice(0, 10);
    var filename = 'wo-entries-' + engineerCode + '-' + date + '.csv';
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Silent background save to Origin Private File System (no prompts ever)
  function saveToOPFS(csv) {
    if (!navigator.storage || !navigator.storage.getDirectory) return;
    navigator.storage.getDirectory().then(function (dir) {
      return dir.getFileHandle('wo-entries.csv', { create: true });
    }).then(function (fh) {
      return fh.createWritable();
    }).then(function (writable) {
      return writable.write(csv).then(function () { return writable.close(); });
    }).catch(function () { /* silent — data already safe in localStorage */ });
  }

  // ── Date formatter: "2025-03-08" → "Mar 08 (Sat)" ───────────────────────
  function formatDate(val) {
    if (!val) return val;
    var s = val.trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s; // not a recognised date — return as-is
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var year   = parseInt(m[1], 10);
    var mo     = parseInt(m[2], 10) - 1;
    var day    = parseInt(m[3], 10);
    var d      = new Date(year, mo, day); // local date, avoids UTC offset issues
    return months[mo] + ' ' + (day < 10 ? '0' + day : day) + ' (' + days[d.getDay()] + ')';
  }

  // ── Notification code colour map ─────────────────────────────────────────
  function getCodeColors(code) {
    var map = {
      'RDLK': { bg: '#c62828', text: '#fff' },
      'LKFS': { bg: '#212121', text: '#fff' },
      'TLOC': { bg: '#212121', text: '#fff' },
      'LKOO': { bg: '#212121', text: '#fff' },
      'LOCK': { bg: '#212121', text: '#fff' },
      'MT31': { bg: '#f9a825', text: '#212121' },
      'CKRD': { bg: '#f9a825', text: '#212121' },
      'ESTS': { bg: '#f9a825', text: '#212121' },
      'RMBE': { bg: '#e65100', text: '#fff' },
      'TC01': { bg: '#00897b', text: '#fff' },
      'MOVE': { bg: '#1565c0', text: '#fff' },
    };
    return map[code] || { bg: null, text: null };
  }

  function csvCell(val) {
    var s = String(val === null || val === undefined ? '' : val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // ── XSS-safe text helper ────────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

}());
