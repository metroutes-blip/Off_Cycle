(function () {
  'use strict';

  // ── DOM refs ────────────────────────────────────────────────────────────
  var viewLogin       = document.getElementById('view-login');
  var viewDashboard   = document.getElementById('view-dashboard');
  var loginForm       = document.getElementById('login-form');
  var engineerSelect  = document.getElementById('engineer-select');
  var pinInput        = document.getElementById('pin-input');
  var loginError      = document.getElementById('login-error');
  var headerEngineer  = document.getElementById('header-engineer');
  var btnLogout       = document.getElementById('btn-logout');
  var btnRetry        = document.getElementById('btn-retry');
  var loadingState    = document.getElementById('loading-state');
  var errorState      = document.getElementById('error-state');
  var errorMessage    = document.getElementById('error-message');
  var dashboardContent = document.getElementById('dashboard-content');
  var totalCount      = document.getElementById('total-count');
  var breakdownGrid   = document.getElementById('breakdown-grid');

  // ── Boot ────────────────────────────────────────────────────────────────
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
  btnLogout.addEventListener('click', function () {
    clearSession();
    pinInput.value = '';
    engineerSelect.value = '';
    loginError.classList.add('hidden');
    viewDashboard.classList.add('hidden');
    viewLogin.classList.remove('hidden');
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

    // Filter rows for this engineer
    var myRows = rows.slice(1).filter(function (row) {
      return ((row[engineerIdx] || '').trim()) === engineerCode;
    });

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
        var card  = document.createElement('div');
        card.className = 'code-card';
        card.innerHTML =
          '<div class="code-badge">' + esc(code) + '</div>' +
          '<div class="code-info">' +
            '<div class="code-count">' + count + '</div>' +
            '<div class="code-label">order' + (count !== 1 ? 's' : '') + '</div>' +
          '</div>';
        breakdownGrid.appendChild(card);
      });
    }

    setContent();
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

  // ── XSS-safe text helper ────────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

}());
