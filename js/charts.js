/**
 * Telemetry Charts & SVG Gauge Engines
 * 1. Chart.js Real-time Power Trend Chart
 * 2. Chart.js Dual-Axis Voltage & Current Trend Chart
 * 3. Radial Power Gauge (0-5000W) with Safe, Warning, Danger zones
 * 4. Current Load % Gauge (0-5A limit)
 */

window.EnergyCharts = (function() {
  let powerChart = null;
  let multiChart = null;
  let maxDataPoints = 30; // Default: ~1 min (at 2s intervals)
  let activeChartType = 'power'; // 'power' or 'multi'

  // Rolling telemetry buffers
  const timestamps = [];
  const powerValues = [];
  const voltageValues = [];
  const currentValues = [];

  /**
   * Initialize Chart.js Instances
   */
  function initCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not found.');
      return;
    }

    const isLight = document.body.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    // 1. Power Trend Chart
    const powerCtx = document.getElementById('power-trend-chart');
    if (powerCtx) {
      const gradient = powerCtx.getContext('2d').createLinearGradient(0, 0, 0, 260);
      gradient.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
      gradient.addColorStop(0.7, 'rgba(37, 99, 235, 0.03)');
      gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

      powerChart = new Chart(powerCtx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: 'Active Power (W)',
            data: powerValues,
            borderColor: '#2563eb',
            borderWidth: 2.5,
            pointBackgroundColor: '#2563eb',
            pointRadius: 2.5,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor: gradient,
            tension: 0.35
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#00f0ff',
              bodyFont: { family: 'JetBrains Mono', size: 13 },
              borderColor: 'rgba(0, 240, 255, 0.3)',
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                label: (ctx) => `${ctx.parsed.y.toFixed(1)} Watts`
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { family: 'JetBrains Mono', size: 11 },
                callback: (val) => val + ' W'
              },
              suggestedMin: 0,
              suggestedMax: 1500
            }
          }
        }
      });
    }

    // 2. Multi-axis Voltage & Current Chart
    const multiCtx = document.getElementById('multi-trend-chart');
    if (multiCtx) {
      multiChart = new Chart(multiCtx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [
            {
              label: 'Voltage (V)',
              data: voltageValues,
              borderColor: '#38bdf8',
              borderWidth: 2,
              yAxisID: 'yVoltage',
              tension: 0.3,
              pointRadius: 1
            },
            {
              label: 'Current (A)',
              data: currentValues,
              borderColor: '#a855f7',
              borderWidth: 2,
              yAxisID: 'yCurrent',
              tension: 0.3,
              pointRadius: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Outfit', size: 11 } }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 10 } }
            },
            yVoltage: {
              type: 'linear',
              position: 'left',
              grid: { color: gridColor },
              ticks: { color: '#38bdf8', callback: (v) => v + ' V' },
              suggestedMin: 180,
              suggestedMax: 270
            },
            yCurrent: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#a855f7', callback: (v) => v + ' A' },
              suggestedMin: 0,
              suggestedMax: 5
            }
          }
        }
      });
    }

    // Initialize SVG Gauges initial position
    updatePowerGauge(0);
    updateCurrentGauge(0);
  }

  /**
   * Update Charts with New Telemetry Point
   */
  function addDataPoint(telemetry) {
    const timeLabel = new Date(telemetry.timestamp || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    timestamps.push(timeLabel);
    powerValues.push(telemetry.p);
    voltageValues.push(telemetry.v);
    currentValues.push(telemetry.i);

    // Limit buffer length
    if (timestamps.length > maxDataPoints) {
      timestamps.shift();
      powerValues.shift();
      voltageValues.shift();
      currentValues.shift();
    }

    // Update Chart.js views
    if (powerChart) {
      // Dynamic Y-axis upper limit if power spikes
      if (telemetry.p > powerChart.options.scales.y.suggestedMax) {
        powerChart.options.scales.y.suggestedMax = Math.ceil(telemetry.p * 1.25 / 500) * 500;
      }
      powerChart.update('none');
    }

    if (multiChart) {
      multiChart.update('none');
    }

    // Calculate Summary Stats (Min, Max, Avg)
    if (powerValues.length > 0) {
      const minP = Math.min(...powerValues);
      const maxP = Math.max(...powerValues);
      const avgP = powerValues.reduce((a, b) => a + b, 0) / powerValues.length;

      const minEl = document.getElementById('stat-min-power');
      const maxEl = document.getElementById('stat-max-power');
      const avgEl = document.getElementById('stat-avg-power');

      if (minEl) minEl.textContent = `${minP.toFixed(0)} W`;
      if (maxEl) maxEl.textContent = `${maxP.toFixed(0)} W`;
      if (avgEl) avgEl.textContent = `${avgP.toFixed(0)} W`;
    }

    // Update SVG Gauges
    updatePowerGauge(telemetry.p);
    updateCurrentGauge(telemetry.i);
  }

  /**
   * SVG Radial Power Gauge (0 - 5000 W)
   * Arc spans from -135deg (0W) to +135deg (5000W) = 270 degrees total
   */
  function updatePowerGauge(watts) {
    const clampedWatts = Math.min(Math.max(watts, 0), 5000);
    const percentage = clampedWatts / 5000;
    
    // Angle in degrees from -135 to +135
    const angle = -135 + percentage * 270;

    const needle = document.getElementById('power-gauge-needle');
    const readout = document.getElementById('power-gauge-val');
    const statusText = document.getElementById('power-gauge-status');

    if (needle) {
      needle.style.transform = `rotate(${angle}deg)`;
    }

    if (readout) {
      readout.textContent = `${Math.round(clampedWatts)}`;
    }

    if (statusText) {
      if (clampedWatts < 1500) {
        statusText.textContent = 'SAFE LOAD';
        statusText.style.color = 'var(--accent-emerald)';
      } else if (clampedWatts < 3000) {
        statusText.textContent = 'ELEVATED LOAD';
        statusText.style.color = 'var(--accent-amber)';
      } else {
        statusText.textContent = 'CRITICAL OVERLOAD';
        statusText.style.color = 'var(--accent-rose)';
      }
    }
  }

  /**
   * SVG Current % Gauge (0 - 5A Rated Limit)
   * Arc from -120deg to +120deg = 240 degrees total
   */
  function updateCurrentGauge(amps) {
    const ratedLimit = 5.0; // 5A ACS712-5A
    const clampedAmps = Math.min(Math.max(amps, 0), 6.0);
    const percentage = Math.min((clampedAmps / ratedLimit) * 100, 120);

    const needle = document.getElementById('current-gauge-needle');
    const readout = document.getElementById('current-gauge-val');
    const percentEl = document.getElementById('current-gauge-percent');
    const statusEl = document.getElementById('current-gauge-status');

    const angle = -120 + (percentage / 100) * 240;

    if (needle) {
      needle.style.transform = `rotate(${angle}deg)`;
    }

    if (readout) {
      readout.textContent = `${clampedAmps.toFixed(2)} A`;
    }

    if (percentEl) {
      percentEl.textContent = `${Math.round(percentage)}% Rated`;
    }

    if (statusEl) {
      if (percentage < 70) {
        statusEl.textContent = 'NORMAL';
        statusEl.style.color = 'var(--accent-emerald)';
      } else if (percentage < 90) {
        statusEl.textContent = 'HEAVY';
        statusEl.style.color = 'var(--accent-amber)';
      } else {
        statusEl.textContent = 'OVERLOAD';
        statusEl.style.color = 'var(--accent-rose)';
      }
    }
  }

  /**
   * Clear Chart History
   */
  function clearData() {
    timestamps.length = 0;
    powerValues.length = 0;
    voltageValues.length = 0;
    currentValues.length = 0;
    if (powerChart) powerChart.update();
    if (multiChart) multiChart.update();
  }

  /**
   * Set Chart Time Window (1m, 3m, 5m)
   */
  function setTimeWindow(minutes) {
    maxDataPoints = Math.round((minutes * 60) / 2); // 2s per telemetry point
    while (timestamps.length > maxDataPoints) {
      timestamps.shift();
      powerValues.shift();
      voltageValues.shift();
      currentValues.shift();
    }
    if (powerChart) powerChart.update();
    if (multiChart) multiChart.update();
  }

  /**
   * Update Chart Colors upon Theme Toggle
   */
  function updateThemeColors() {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    if (powerChart) {
      powerChart.options.scales.x.grid.color = gridColor;
      powerChart.options.scales.x.ticks.color = textColor;
      powerChart.options.scales.y.grid.color = gridColor;
      powerChart.options.scales.y.ticks.color = textColor;
      powerChart.update();
    }

    if (multiChart) {
      multiChart.options.scales.x.grid.color = gridColor;
      multiChart.options.scales.x.ticks.color = textColor;
      multiChart.options.scales.yVoltage.grid.color = gridColor;
      multiChart.options.scales.yCurrent.ticks.color = textColor;
      multiChart.update();
    }
  }

  function resizeCharts() {
    if (powerChart) powerChart.resize();
    if (multiChart) multiChart.resize();
  }

  return {
    initCharts,
    resizeCharts,
    addDataPoint,
    updatePowerGauge,
    updateCurrentGauge,
    clearData,
    setTimeWindow,
    updateThemeColors
  };
})();
