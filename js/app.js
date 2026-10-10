/**
 * Main Application Controller
 * Handles View Routing, Telemetry Processing, Tariff & Budget Engine,
 * Smart Alerts, Audio Chimes, CSV Export & UI Interactions
 */

(function() {
  // Application State
  const state = {
    currentView: 'landing', // 'landing', 'login', 'dashboard'
    theme: localStorage.getItem('energy_theme') || 'light',
    audioAlertsEnabled: true,
    powerThreshold: 2000, // Watts
    budgetLimit: 100, // INR
    tariffRate: 8.0, // INR / kWh
    readingsHistory: [],
    alertEvents: [],
    isPaused: false,
    lastAlertTime: 0,
    tableMaxRows: 20
  };

  // Audio Synthesizer (Web Audio API)
  let audioCtx = null;
  function playAlertChime(type) {
    if (!state.audioAlertsEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'critical') {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(440, now + 0.12);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'confirm' || type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        osc.frequency.setValueAtTime(659, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'danger') {
      iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    }

    toast.innerHTML = `<span>${iconSvg}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Notification Bell Dropdown Counter & Items
  let unreadNotifCount = 0;
  function addNotification(msg, type = 'info') {
    unreadNotifCount++;
    const badge = document.getElementById('nav-notif-badge');
    const countText = document.getElementById('notif-count-text');
    const list = document.getElementById('notif-dropdown-list');

    if (badge) {
      badge.textContent = unreadNotifCount;
      badge.style.display = 'flex';
    }
    if (countText) {
      countText.textContent = `${unreadNotifCount} active alert${unreadNotifCount > 1 ? 's' : ''}`;
    }

    if (list) {
      const emptyState = list.querySelector('.notif-empty-state');
      if (emptyState) emptyState.remove();

      const item = document.createElement('div');
      item.className = `notif-item ${type}`;
      const timeStr = new Date().toLocaleTimeString();

      item.innerHTML = `
        <div class="notif-item-top">
          <span class="badge ${type === 'critical' ? 'badge-rose' : (type === 'warning' ? 'badge-amber' : 'badge-cyan')}">${type.toUpperCase()}</span>
          <span class="notif-item-time">${timeStr}</span>
        </div>
        <div class="notif-item-msg">${msg}</div>
      `;

      list.insertBefore(item, list.firstChild);
      while (list.children.length > 20) {
        list.removeChild(list.lastChild);
      }
    }
  }

  function clearNotifications() {
    unreadNotifCount = 0;
    const badge = document.getElementById('nav-notif-badge');
    const countText = document.getElementById('notif-count-text');
    const list = document.getElementById('notif-dropdown-list');

    if (badge) {
      badge.textContent = '0';
      badge.style.display = 'none';
    }
    if (countText) countText.textContent = '0 active alerts';
    if (list) {
      list.innerHTML = '<div class="notif-empty-state">No active alarm notifications</div>';
    }
    showToast('Notifications cleared', 'info');
  }

  function toggleAudio() {
    state.audioAlertsEnabled = !state.audioAlertsEnabled;
    const audioBtn = document.getElementById('audio-toggle-btn');
    const iconOn = document.getElementById('audio-icon-on');
    const iconOff = document.getElementById('audio-icon-off');

    if (audioBtn) audioBtn.classList.toggle('active', state.audioAlertsEnabled);
    if (iconOn) iconOn.style.display = state.audioAlertsEnabled ? 'block' : 'none';
    if (iconOff) iconOff.style.display = state.audioAlertsEnabled ? 'none' : 'block';

    if (state.audioAlertsEnabled) {
      playAlertChime('confirm');
      showToast('Sound Alerts Enabled (Audible Test Chime)', 'success');
    } else {
      showToast('Sound Alerts Muted', 'info');
    }
  }

  function updateNavbarMode(viewId) {
    const pubLinks = document.getElementById('nav-public-links');
    const pubActions = document.getElementById('nav-public-actions');
    const dashTabs = document.getElementById('nav-dashboard-tabs');
    const dashActions = document.getElementById('nav-dashboard-actions');
    const liveStatusPill = document.getElementById('nav-live-status-pill');

    if (viewId === 'dashboard') {
      if (pubLinks) pubLinks.style.display = 'none';
      if (pubActions) pubActions.style.display = 'none';
      if (dashTabs) dashTabs.style.display = 'flex';
      if (dashActions) dashActions.style.display = 'flex';
      if (liveStatusPill) liveStatusPill.style.display = 'inline-flex';
    } else {
      if (pubLinks) pubLinks.style.display = 'flex';
      if (pubActions) pubActions.style.display = 'flex';
      if (dashTabs) dashTabs.style.display = 'none';
      if (dashActions) dashActions.style.display = 'none';
      if (liveStatusPill) liveStatusPill.style.display = 'none';
    }
  }

  function switchDashboardTab(tabId) {
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-dash-tab') === tabId);
    });

    document.querySelectorAll('.dash-page-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
      targetTab.classList.add('active');
    }

    // Canvas & Chart Resizing on Tab Change
    if (tabId === 'analytics') {
      setTimeout(() => {
        if (window.EnergyCharts) {
          window.EnergyCharts.initCharts();
          window.EnergyCharts.resizeCharts();
        }
      }, 50);
    } else if (tabId === 'overview') {
      setTimeout(() => {
        if (window.EnergyVisualizer) window.EnergyVisualizer.onReactorResize();
      }, 50);
    }
  }

  /**
   * Router: Switch between Landing, Login, Dashboard
   */
  function navigateTo(viewId) {
    state.currentView = viewId;
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

    const targetSec = document.getElementById(`${viewId}-view`);
    if (targetSec) {
      targetSec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateNavbarMode(viewId);

    // Trigger canvas resizing when switching views
    if (viewId === 'dashboard') {
      switchDashboardTab('overview');
      setTimeout(() => {
        if (window.EnergyVisualizer) window.EnergyVisualizer.onReactorResize();
        if (window.EnergyCharts) {
          window.EnergyCharts.initCharts();
          window.EnergyCharts.resizeCharts();
        }
      }, 100);
    } else if (viewId === 'landing') {
      setTimeout(() => {
        if (window.EnergyVisualizer) window.EnergyVisualizer.onHeroResize();
      }, 100);
    }
  }

  /**
   * Telemetry Handler
   */
  function handleTelemetry(data) {
    if (state.isPaused) return;

    // Apply active tariff to calculate precise cost
    const calculatedCost = data.kwh * state.tariffRate;
    data.cost = calculatedCost;

    // Record into rolling history
    state.readingsHistory.unshift(data);
    if (state.readingsHistory.length > 200) {
      state.readingsHistory.pop();
    }

    // 1. Update 5 Top Metric Cards
    updateLiveCards(data);

    // 2. Feed Chart.js & SVG Gauges
    if (window.EnergyCharts) {
      window.EnergyCharts.addDataPoint(data);
    }

    // 3. Feed 3D Power Reactor
    if (window.EnergyVisualizer) {
      window.EnergyVisualizer.updatePower(data.p);
    }

    // 4. Update Cost Projections & Budget Progress
    updateCostEngine(data);

    // 5. Check Alert Rules
    evaluateAlerts(data);

    // 6. Update Rolling Data Table
    updateTable(data);

    // 7. Update Hero Ticker if on landing page
    updateHeroTicker(data);

    // Update last seen counter
    const lastSeenEl = document.getElementById('last-telemetry-time');
    if (lastSeenEl) {
      lastSeenEl.textContent = new Date().toLocaleTimeString();
    }

    if (data.isLive) {
      const packetCountEl = document.getElementById('wokwi-packet-count');
      if (packetCountEl && window.EnergyMQTT) {
        packetCountEl.textContent = window.EnergyMQTT.getPacketCount();
      }
    }
  }

  /**
   * Update the 5 Live Metric Cards with Dynamic Coloring
   */
  function updateLiveCards(data) {
    // 1. Voltage Card
    const voltEl = document.getElementById('live-voltage-val');
    const voltCard = document.getElementById('card-voltage');
    const voltBadge = document.getElementById('badge-voltage-status');
    const voltDevEl = document.getElementById('voltage-deviation');

    if (voltEl) voltEl.textContent = data.v.toFixed(1);
    if (voltDevEl) {
      const dev = (((data.v - 230) / 230) * 100).toFixed(1);
      voltDevEl.textContent = `${dev > 0 ? '+' : ''}${dev}% from 230V`;
    }

    if (voltCard && voltBadge) {
      if (data.v > 250) {
        voltCard.className = 'metric-card glass-panel status-danger';
        voltBadge.className = 'badge badge-rose';
        voltBadge.textContent = 'HIGH SURGE';
      } else if (data.v < 195) {
        voltCard.className = 'metric-card glass-panel status-warning';
        voltBadge.className = 'badge badge-amber';
        voltBadge.textContent = 'BROWNOUT';
      } else {
        voltCard.className = 'metric-card glass-panel status-voltage';
        voltBadge.className = 'badge badge-cyan';
        voltBadge.textContent = 'NORMAL GRID';
      }
    }

    // 2. Current Card
    const ampEl = document.getElementById('live-current-val');
    const ampCard = document.getElementById('card-current');
    const ampBadge = document.getElementById('badge-current-status');
    const ampBar = document.getElementById('current-capacity-bar');

    if (ampEl) ampEl.textContent = data.i.toFixed(2);
    if (ampBar) {
      const pct = Math.min((data.i / 5.0) * 100, 100);
      ampBar.style.width = `${pct}%`;
    }

    if (ampCard && ampBadge) {
      if (data.i > 4.5) {
        ampCard.className = 'metric-card glass-panel status-danger';
        ampBadge.className = 'badge badge-rose';
        ampBadge.textContent = 'NEAR LIMIT';
      } else if (data.i > 3.0) {
        ampCard.className = 'metric-card glass-panel status-warning';
        ampBadge.className = 'badge badge-amber';
        ampBadge.textContent = 'HEAVY LOAD';
      } else {
        ampCard.className = 'metric-card glass-panel status-safe';
        ampBadge.className = 'badge badge-emerald';
        ampBadge.textContent = 'OPTIMAL';
      }
    }

    // 3. Power Card
    const powerEl = document.getElementById('live-power-val');
    const powerCard = document.getElementById('card-power');
    const powerBadge = document.getElementById('badge-power-status');
    const kwEl = document.getElementById('power-kw-val');

    if (powerEl) powerEl.textContent = data.p.toFixed(1);
    if (kwEl) kwEl.textContent = `${(data.p / 1000).toFixed(3)} kW`;

    if (powerCard && powerBadge) {
      if (data.p > state.powerThreshold) {
        powerCard.className = 'metric-card glass-panel status-danger';
        powerBadge.className = 'badge badge-rose';
        powerBadge.textContent = 'THRESHOLD EXCEEDED';
      } else if (data.p > 1500) {
        powerCard.className = 'metric-card glass-panel status-warning';
        powerBadge.className = 'badge badge-amber';
        powerBadge.textContent = 'ELEVATED';
      } else {
        powerCard.className = 'metric-card glass-panel status-safe';
        powerBadge.className = 'badge badge-emerald';
        powerBadge.textContent = 'SAFE LOAD';
      }
    }

    // 4. Energy Consumed Card (kWh)
    const kwhEl = document.getElementById('live-energy-val');
    if (kwhEl) kwhEl.textContent = data.kwh.toFixed(5);

    // 5. Estimated Cost Card (INR)
    const costEl = document.getElementById('live-cost-val');
    if (costEl) costEl.textContent = `₹ ${data.cost.toFixed(3)}`;
  }

  /**
   * Cost Engine & Budget Calculations
   */
  function updateCostEngine(data) {
    // Current Tariff display
    const tariffReadout = document.getElementById('tariff-readout');
    if (tariffReadout) tariffReadout.textContent = `₹ ${state.tariffRate.toFixed(2)}`;

    // Live Projections based on instant Power
    const costPerHour = (data.p / 1000) * state.tariffRate;
    const costPerDay = costPerHour * 24;
    const costPerMonth = costPerDay * 30;

    const projHourEl = document.getElementById('proj-cost-hour');
    const projDayEl = document.getElementById('proj-cost-day');
    const projMonthEl = document.getElementById('proj-cost-month');

    if (projHourEl) projHourEl.textContent = `₹ ${costPerHour.toFixed(2)}`;
    if (projDayEl) projDayEl.textContent = `₹ ${costPerDay.toFixed(1)}`;
    if (projMonthEl) projMonthEl.textContent = `₹ ${costPerMonth.toFixed(0)}`;

    // Budget Tracker
    const budgetFill = document.getElementById('budget-bar-fill');
    const budgetSpentText = document.getElementById('budget-spent-text');
    const budgetPctText = document.getElementById('budget-pct-text');
    const budgetRemainingText = document.getElementById('budget-remaining-text');

    const spent = data.cost;
    const limit = state.budgetLimit;
    const pct = Math.min((spent / limit) * 100, 150);
    const remaining = Math.max(0, limit - spent);

    if (budgetFill) {
      budgetFill.style.width = `${Math.min(pct, 100)}%`;
      if (pct > 90) {
        budgetFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff0055)';
      } else {
        budgetFill.style.background = 'linear-gradient(90deg, #00ff88 0%, #ffaa00 70%, #ff0055 100%)';
      }
    }

    if (budgetSpentText) budgetSpentText.textContent = `₹ ${spent.toFixed(2)} of ₹ ${limit} spent`;
    if (budgetPctText) budgetPctText.textContent = `${pct.toFixed(1)}%`;
    if (budgetRemainingText) budgetRemainingText.textContent = `₹ ${remaining.toFixed(2)} remaining`;
  }

  /**
   * Alert Rules Evaluator
   */
  function evaluateAlerts(data) {
    const banner = document.getElementById('global-alert-banner');
    const bannerText = document.getElementById('alert-banner-message');
    let hasAlert = false;
    let alertMsg = '';
    let alertType = 'info';

    if (data.p > state.powerThreshold) {
      hasAlert = true;
      alertMsg = `CRITICAL: Power load (${data.p.toFixed(0)}W) crossed configured threshold of ${state.powerThreshold}W!`;
      alertType = 'critical';
    } else if (data.v > 250) {
      hasAlert = true;
      alertMsg = `WARNING: Grid overvoltage detected (${data.v.toFixed(1)}V > 250V). Protect sensitive appliances!`;
      alertType = 'warning';
    } else if (data.v < 195) {
      hasAlert = true;
      alertMsg = `WARNING: Low grid voltage (${data.v.toFixed(1)}V < 195V). Brownout conditions!`;
      alertType = 'warning';
    } else if (data.i > 4.8) {
      hasAlert = true;
      alertMsg = `CRITICAL: Current draw (${data.i.toFixed(2)}A) nearing 5.0A sensor full scale limit!`;
      alertType = 'critical';
    }

    if (hasAlert) {
      if (banner && bannerText) {
        banner.className = `alert-banner active ${alertType}`;
        bannerText.textContent = alertMsg;
      }

      // Throttle chimes and logs to once every 10s for the same alarm
      const now = Date.now();
      if (now - state.lastAlertTime > 10000) {
        state.lastAlertTime = now;
        playAlertChime(alertType);
        showToast(alertMsg, alertType === 'critical' ? 'danger' : 'warning');
        logAlertEvent(alertMsg, alertType);
      }
    } else {
      if (banner) banner.className = 'alert-banner';
    }
  }

  function logAlertEvent(msg, type) {
    const logList = document.getElementById('alerts-log-list');
    if (!logList) return;

    const timeStr = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = `alert-item ${type}`;
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="badge ${type === 'critical' ? 'badge-rose' : 'badge-amber'}">${type.toUpperCase()}</span>
        <span>${msg}</span>
      </div>
      <span class="font-mono" style="color:var(--text-muted); font-size:0.75rem;">${timeStr}</span>
    `;

    logList.insertBefore(item, logList.firstChild);

    // Also push into navigation notification center
    addNotification(msg, type);

    // Keep log limited to 30 items
    while (logList.children.length > 30) {
      logList.removeChild(logList.lastChild);
    }
  }

  /**
   * Update Live Telemetry Table
   */
  function updateTable(data) {
    const tbody = document.getElementById('telemetry-table-body');
    if (!tbody) return;

    const row = document.createElement('tr');
    const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString();

    let statusBadge = '<span class="badge badge-emerald">NORMAL</span>';
    if (data.p > state.powerThreshold || data.i > 4.5 || data.v > 250) {
      statusBadge = '<span class="badge badge-rose">OVERLOAD</span>';
    } else if (data.p > 1500) {
      statusBadge = '<span class="badge badge-amber">ELEVATED</span>';
    }

    row.innerHTML = `
      <td>${timeStr}</td>
      <td style="color:var(--accent-cyan); font-weight:600;">${data.v.toFixed(1)} V</td>
      <td style="color:#a855f7; font-weight:600;">${data.i.toFixed(2)} A</td>
      <td style="color:${data.p > 1500 ? 'var(--accent-amber)' : 'var(--accent-emerald)'}; font-weight:700;">${data.p.toFixed(1)} W</td>
      <td>${data.kwh.toFixed(5)} kWh</td>
      <td style="color:#f59e0b; font-weight:600;">₹ ${data.cost.toFixed(3)}</td>
      <td>${statusBadge}</td>
    `;

    tbody.insertBefore(row, tbody.firstChild);

    while (tbody.children.length > state.tableMaxRows) {
      tbody.removeChild(tbody.lastChild);
    }
  }

  function updateHeroTicker(data) {
    const heroWatts = document.getElementById('hero-ticker-watts');
    const heroVolts = document.getElementById('hero-ticker-volts');
    const heroAmps = document.getElementById('hero-ticker-amps');
    const heroKwh = document.getElementById('hero-ticker-kwh');

    if (heroWatts) heroWatts.textContent = `${data.p.toFixed(0)} W`;
    if (heroVolts) heroVolts.textContent = `${data.v.toFixed(1)} V`;
    if (heroAmps) heroAmps.textContent = `${data.i.toFixed(2)} A`;
    if (heroKwh) heroKwh.textContent = `${data.kwh.toFixed(4)} kWh`;
  }

  /**
   * Export Telemetry History to CSV File
   */
  function exportCSV() {
    if (state.readingsHistory.length === 0) {
      showToast('No telemetry data available to export.', 'warning');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,Voltage_V,Current_A,Power_W,Energy_kWh,EstimatedCost_INR\r\n';

    state.readingsHistory.forEach(item => {
      const timeStr = new Date(item.timestamp || Date.now()).toISOString();
      csvContent += `${timeStr},${item.v},${item.i},${item.p},${item.kwh},${item.cost.toFixed(4)}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smart_energy_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${state.readingsHistory.length} readings as CSV`, 'success');
  }

  /**
   * Initialize All Event Listeners
   */
  function initEvents() {
    // 1. Navigation / Routing Buttons
    document.querySelectorAll('[data-navigate]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-navigate');
        navigateTo(target);
      });
    });

    // 2. Demo Login & Auth Buttons
    const demoLoginBtn = document.getElementById('btn-demo-login');
    if (demoLoginBtn) {
      demoLoginBtn.addEventListener('click', () => {
        showToast('Logged in as Demo Energy Auditor', 'success');
        navigateTo('dashboard');
      });
    }

    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Authenticated successfully', 'success');
        navigateTo('dashboard');
      });
    }

    // 3. Theme Toggle Button
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', state.theme);
        localStorage.setItem('energy_theme', state.theme);
        if (window.EnergyCharts) window.EnergyCharts.updateThemeColors();
        showToast(`Theme switched to ${state.theme} mode`, 'info');
      });
    }

    // 4. Audio Alert Toggle
    const audioToggleBtn = document.getElementById('audio-toggle-btn');
    if (audioToggleBtn) {
      audioToggleBtn.addEventListener('click', () => {
        toggleAudio();
      });
    }

    // 4b. Notification Bell Dropdown Toggle & Clear
    const notifBtn = document.getElementById('notif-toggle-btn');
    const notifMenu = document.getElementById('notif-dropdown');
    if (notifBtn && notifMenu) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifMenu.classList.toggle('active');
      });
      document.addEventListener('click', (e) => {
        if (!notifMenu.contains(e.target) && !notifBtn.contains(e.target)) {
          notifMenu.classList.remove('active');
        }
      });
    }

    const clearNotifsBtn = document.getElementById('btn-clear-dropdown-notifs');
    if (clearNotifsBtn) {
      clearNotifsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearNotifications();
      });
    }

    // 4c. Dashboard Segmented Tab Buttons
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabKey = btn.getAttribute('data-dash-tab');
        if (tabKey) switchDashboardTab(tabKey);
      });
    });

    // 4d. Dashboard Log Out Button
    const logoutBtn = document.getElementById('btn-dashboard-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        showToast('Logged out of SmartEnergy Console', 'info');
        navigateTo('landing');
      });
    }

    // 5. Tariff Slider & Input
    const tariffSlider = document.getElementById('tariff-slider');
    const tariffNumberInput = document.getElementById('tariff-number-input');

    function syncTariff(val) {
      const num = parseFloat(val) || 8.0;
      state.tariffRate = num;
      if (tariffSlider) tariffSlider.value = num;
      if (tariffNumberInput) tariffNumberInput.value = num;
      window.EnergyMQTT.setTariff(num);
      // Immediately refresh with latest reading
      if (state.readingsHistory.length > 0) {
        updateCostEngine(state.readingsHistory[0]);
      }
    }

    if (tariffSlider) tariffSlider.addEventListener('input', (e) => syncTariff(e.target.value));
    if (tariffNumberInput) tariffNumberInput.addEventListener('change', (e) => syncTariff(e.target.value));

    // 6. Power Threshold & Budget Limit Inputs
    const thresholdInput = document.getElementById('threshold-power-input');
    if (thresholdInput) {
      thresholdInput.addEventListener('change', (e) => {
        state.powerThreshold = Number(e.target.value) || 2000;
        showToast(`Power alert threshold set to ${state.powerThreshold} W`, 'info');
      });
    }

    const budgetInput = document.getElementById('budget-limit-input');
    if (budgetInput) {
      budgetInput.addEventListener('change', (e) => {
        state.budgetLimit = Number(e.target.value) || 100;
        showToast(`Monthly budget set to ₹ ${state.budgetLimit}`, 'info');
        if (state.readingsHistory.length > 0) updateCostEngine(state.readingsHistory[0]);
      });
    }

    // 7. Reset kWh Button
    const resetKwhBtn = document.getElementById('btn-reset-kwh');
    if (resetKwhBtn) {
      resetKwhBtn.addEventListener('click', () => {
        if (confirm('Reset Accumulated Energy (kWh) and Cost counter to 0.00?')) {
          window.EnergyMQTT.resetKwh();
          showToast('kWh counter reset to 0.00000', 'warning');
        }
      });
    }

    // 8. CSV Export Buttons
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportCSV);
    }
    const exportCsvTableBtn = document.getElementById('btn-export-csv-table');
    if (exportCsvTableBtn) {
      exportCsvTableBtn.addEventListener('click', exportCSV);
    }

    // 9. Clear Chart Button
    const clearChartBtn = document.getElementById('btn-clear-chart');
    if (clearChartBtn) {
      clearChartBtn.addEventListener('click', () => {
        if (window.EnergyCharts) {
          window.EnergyCharts.clearData();
          showToast('Chart history cleared', 'info');
        }
      });
    }

    // 10. Pause / Resume Stream
    const pauseBtn = document.getElementById('btn-pause-stream');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        state.isPaused = !state.isPaused;
        pauseBtn.innerHTML = state.isPaused 
          ? '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Resume'
          : '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';
        showToast(state.isPaused ? 'Telemetry Stream Paused' : 'Telemetry Stream Resumed', 'info');
      });
    }

    // 11. Chart Timeframe Buttons (1m, 3m, 5m)
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = Number(btn.getAttribute('data-mins')) || 1;
        if (window.EnergyCharts) window.EnergyCharts.setTimeWindow(mins);
      });
    });

    // 12. Chart Type Toggle (Power vs Multi)
    const toggleChartTypeBtn = document.getElementById('btn-toggle-chart-type');
    if (toggleChartTypeBtn) {
      toggleChartTypeBtn.addEventListener('click', () => {
        const powerWrap = document.getElementById('wrap-power-chart');
        const multiWrap = document.getElementById('wrap-multi-chart');
        if (powerWrap.style.display !== 'none') {
          powerWrap.style.display = 'none';
          multiWrap.style.display = 'block';
          toggleChartTypeBtn.textContent = 'Show Power Chart';
        } else {
          powerWrap.style.display = 'block';
          multiWrap.style.display = 'none';
          toggleChartTypeBtn.textContent = 'Show V & I Dual Chart';
        }
      });
    }

    // 13. ESP32 Hardware Simulator Knobs (Voltage & Current Stand-ins)
    const simVoltsSlider = document.getElementById('sim-pot-volts');
    const simAmpsSlider = document.getElementById('sim-pot-amps');
    const simVoltsVal = document.getElementById('sim-val-volts');
    const simAmpsVal = document.getElementById('sim-val-amps');

    if (simVoltsSlider) {
      simVoltsSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (simVoltsVal) simVoltsVal.textContent = `${v} V`;
        window.EnergyMQTT.setSimVolts(v);
      });
    }

    if (simAmpsSlider) {
      simAmpsSlider.addEventListener('input', (e) => {
        const a = parseFloat(e.target.value);
        if (simAmpsVal) simAmpsVal.textContent = `${a.toFixed(2)} A`;
        window.EnergyMQTT.setSimAmps(a);
      });
    }

    // Simulator Presets
    document.querySelectorAll('[data-sim-preset]').forEach(chip => {
      chip.addEventListener('click', () => {
        const v = parseFloat(chip.getAttribute('data-v'));
        const a = parseFloat(chip.getAttribute('data-a'));

        if (simVoltsSlider) simVoltsSlider.value = v;
        if (simAmpsSlider) simAmpsSlider.value = a;
        if (simVoltsVal) simVoltsVal.textContent = `${v} V`;
        if (simAmpsVal) simAmpsVal.textContent = `${a.toFixed(2)} A`;

        window.EnergyMQTT.setSimVolts(v);
        window.EnergyMQTT.setSimAmps(a);
        showToast(`Preset loaded: ${v}V, ${a}A`, 'info');
      });
    });

    // 14. Simulation Toggle
    const simToggleBtn = document.getElementById('btn-toggle-simulator');
    if (simToggleBtn) {
      simToggleBtn.addEventListener('click', () => {
        if (window.EnergyMQTT.isSimulating()) {
          window.EnergyMQTT.stopSimulation();
          simToggleBtn.textContent = 'Start Virtual Hardware Sim';
          simToggleBtn.classList.remove('btn-primary');
          simToggleBtn.classList.add('btn-outline');
          showToast('Virtual Hardware Simulator Stopped', 'info');
        } else {
          window.EnergyMQTT.startSimulation();
          simToggleBtn.textContent = 'Stop Virtual Sim';
          simToggleBtn.classList.remove('btn-outline');
          simToggleBtn.classList.add('btn-primary');
          showToast('Virtual Hardware Simulator Running (2s Interval)', 'success');
        }
      });
    }

    // 15. Modals (Wokwi & MQTT Settings)
    const wokwiModal = document.getElementById('wokwi-modal');
    const openWokwiBtns = document.querySelectorAll('.open-wokwi-modal');
    const closeModals = document.querySelectorAll('.close-modal');

    openWokwiBtns.forEach(b => b.addEventListener('click', () => {
      if (wokwiModal) wokwiModal.classList.add('active');
    }));

    const mqttModal = document.getElementById('mqtt-config-modal');
    const openMqttBtn = document.getElementById('btn-open-mqtt-config');
    if (openMqttBtn) {
      openMqttBtn.addEventListener('click', () => {
        if (mqttModal) mqttModal.classList.add('active');
      });
    }

    closeModals.forEach(b => b.addEventListener('click', () => {
      if (wokwiModal) wokwiModal.classList.remove('active');
      if (mqttModal) mqttModal.classList.remove('active');
    }));

    // Copy Arduino Code Button
    const copyCodeBtn = document.getElementById('btn-copy-firmware');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        const codeText = document.getElementById('firmware-code-block').innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          showToast('ESP32 Arduino code copied to clipboard!', 'success');
        });
      });
    }

    // Save MQTT Config
    const saveMqttForm = document.getElementById('mqtt-config-form');
    if (saveMqttForm) {
      saveMqttForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const broker = document.getElementById('cfg-broker-url').value;
        const topic = document.getElementById('cfg-topic').value;
        window.EnergyMQTT.connect({ brokerUrl: broker, topic: topic });
        if (mqttModal) mqttModal.classList.remove('active');
        showToast(`Subscribed to topic: ${topic}`, 'info');
      });
    }

    // Clear Alert Log
    const clearAlertsBtn = document.getElementById('btn-clear-alerts');
    if (clearAlertsBtn) {
      clearAlertsBtn.addEventListener('click', () => {
        const list = document.getElementById('alerts-log-list');
        if (list) list.innerHTML = '';
        const banner = document.getElementById('global-alert-banner');
        if (banner) banner.className = 'alert-banner';
        showToast('Alerts log cleared', 'info');
      });
    }
  }

  /**
   * Status Pill & Live Wokwi Banner Callback
   */
  function handleStatusChange(status) {
    const pill = document.getElementById('mqtt-status-pill');
    const dot = document.getElementById('mqtt-status-dot');
    const label = document.getElementById('mqtt-status-text');
    const topicLabel = document.getElementById('active-topic-label');

    // Live Stream Banner Elements
    const bannerTitle = document.getElementById('wokwi-feed-status-title');
    const bannerSub = document.getElementById('wokwi-feed-status-sub');
    const modeBadge = document.getElementById('wokwi-mode-badge');
    const packetCountEl = document.getElementById('wokwi-packet-count');
    const bannerDot = document.getElementById('wokwi-indicator-dot');

    const navDot = document.getElementById('nav-mqtt-dot');
    const navText = document.getElementById('nav-mqtt-text');

    if (dot) {
      dot.className = `pulse-dot ${status.state === 'WOKWI_LIVE' || status.state === 'CONNECTED' ? 'online' : (status.state === 'SIMULATOR' ? 'online' : 'warning')}`;
    }

    if (navDot) {
      navDot.className = `pulse-dot ${status.state === 'WOKWI_LIVE' || status.state === 'CONNECTED' ? 'online' : (status.state === 'SIMULATOR' ? 'online' : 'warning')}`;
    }

    if (label) {
      label.textContent = status.label;
    }

    if (navText) {
      navText.textContent = status.state === 'WOKWI_LIVE' ? 'WOKWI LIVE' : (status.state === 'SIMULATOR' ? 'LOCAL SIM' : status.label);
    }

    if (topicLabel) {
      topicLabel.textContent = status.topic;
    }

    if (packetCountEl && status.packetCount !== undefined) {
      packetCountEl.textContent = status.packetCount;
    }

    if (status.state === 'WOKWI_LIVE' || status.isLive) {
      if (bannerTitle) bannerTitle.textContent = '🟢 LIVE WOKWI ESP32 HARDWARE STREAM';
      if (bannerSub) bannerSub.innerHTML = `Live sensor telemetry received from ESP32 on topic: <code>${status.topic}</code> • Packets: <span class="font-mono">${status.packetCount || 1}</span>`;
      if (modeBadge) {
        modeBadge.className = 'feed-badge live';
        modeBadge.textContent = 'LIVE HARDWARE FEED';
      }
      if (bannerDot) bannerDot.className = 'pulse-dot online';
    } else if (status.state === 'SIMULATOR') {
      if (bannerTitle) bannerTitle.textContent = 'VIRTUAL HARDWARE SIMULATOR (STAND-IN)';
      if (bannerSub) bannerSub.innerHTML = `Running local analog potentiometer simulation on GPIO34/35. Launch Wokwi anytime to take over live!`;
      if (modeBadge) {
        modeBadge.className = 'feed-badge sim';
        modeBadge.textContent = 'LOCAL TEST SIM';
      }
    }
  }

  // App Bootstrap
  window.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    document.body.setAttribute('data-theme', state.theme);

    // Initialize events
    initEvents();

    // Setup MQTT callbacks
    window.EnergyMQTT.onTelemetry(handleTelemetry);
    window.EnergyMQTT.onStatusChange(handleStatusChange);

    // Initialize 3D Scenes
    setTimeout(() => {
      if (window.EnergyVisualizer) {
        window.EnergyVisualizer.initHeroScene();
        window.EnergyVisualizer.initReactorScene();
      }
      if (window.EnergyCharts) {
        window.EnergyCharts.initCharts();
      }
    }, 200);

    // Connect to HiveMQ Public WebSocket Broker
    window.EnergyMQTT.connect();

    // Start simulation immediately so dashboard has live data even before Wokwi is launched!
    setTimeout(() => {
      window.EnergyMQTT.startSimulation();
    }, 500);
  });

})();
