/**
 * MQTT Client & Hardware Telemetry Engine
 * Direct Live Connection to Wokwi ESP32 via HiveMQ Public Broker
 * Broker: wss://broker.hivemq.com:8884/mqtt
 * Topic: mikey/energy/data
 */

window.EnergyMQTT = (function() {
  let client = null;
  let isConnected = false;
  let isLiveFromWokwi = false;
  let livePacketCount = 0;
  let lastPacketTime = 0;

  let config = {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    topic: 'mikey/energy/data',
    clientId: 'WebDashboard-' + Math.random().toString(16).substring(2, 10),
    tariff: 8.0
  };

  // Telemetry & Status Callbacks
  let telemetryCallback = null;
  let statusChangeCallback = null;

  // Standalone Simulator State (Only active if Wokwi is not running or user manually requests)
  let simActive = false;
  let simTimer = null;
  let simState = {
    volts: 230.0,
    amps: 2.45,
    watts: 563.5,
    kwh: 0.04218,
    cost: 0.337,
    lastCalcTime: Date.now()
  };

  /**
   * Connect to MQTT Broker over WebSockets
   */
  function connect(customConfig) {
    if (customConfig) {
      config = { ...config, ...customConfig };
    }

    if (typeof mqtt === 'undefined') {
      console.warn('MQTT.js library not loaded. Falling back to local simulation.');
      startSimulation();
      return;
    }

    try {
      updateStatus('CONNECTING', 'amber', 'Connecting to HiveMQ Broker...');
      
      if (client) {
        client.end(true);
      }

      console.log(`Connecting MQTT client to ${config.brokerUrl} on topic: [${config.topic}]...`);
      
      client = mqtt.connect(config.brokerUrl, {
        clientId: config.clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 3000,
        keepalive: 60
      });

      client.on('connect', () => {
        isConnected = true;
        console.log(`MQTT Connected! Subscribing to topic: ${config.topic}`);
        
        client.subscribe(config.topic, { qos: 0 }, (err) => {
          if (err) {
            console.error('Subscription error:', err);
            updateStatus('ERROR', 'rose', 'Topic Subscribe Error');
          } else {
            console.log(`Subscribed successfully to: ${config.topic}`);
            if (!isLiveFromWokwi) {
              updateStatus('WAITING_WOKWI', 'cyan', 'Broker Connected • Waiting for Wokwi ESP32...');
            }
          }
        });
      });

      // INCOMING TELEMETRY FROM WOKWI ESP32
      client.on('message', (topic, message) => {
        try {
          const payloadStr = message.toString();
          const data = JSON.parse(payloadStr);

          // Mark that this is a LIVE hardware packet from Wokwi
          isLiveFromWokwi = true;
          livePacketCount++;
          lastPacketTime = Date.now();

          // Immediately stop any local mock simulator to prevent data collision!
          if (simActive) {
            stopSimulation();
          }

          updateStatus('WOKWI_LIVE', 'emerald', `LIVE FEED: ESP32 Running (${livePacketCount} packets)`);

          // Deliver data directly to dashboard
          handleIncomingPayload(data, true);
        } catch (e) {
          console.error('Error parsing incoming MQTT JSON payload:', e, message.toString());
        }
      });

      client.on('error', (err) => {
        console.warn('MQTT error:', err.message);
        updateStatus('RECONNECTING', 'amber', 'Retrying HiveMQ connection...');
      });

      client.on('offline', () => {
        isConnected = false;
        updateStatus('OFFLINE', 'rose', 'HiveMQ Offline');
      });

      client.on('close', () => {
        isConnected = false;
        updateStatus('DISCONNECTED', 'rose', 'Broker Disconnected');
      });

    } catch (err) {
      console.error('MQTT initialization failure:', err);
      updateStatus('ERROR', 'rose', 'Connection Failed');
      startSimulation();
    }
  }

  /**
   * Disconnect MQTT client
   */
  function disconnect() {
    if (client) {
      client.end();
      client = null;
      isConnected = false;
      updateStatus('DISCONNECTED', 'rose', 'Disconnected');
    }
  }

  /**
   * Publish data to broker (e.g. from simulator knobs back to MQTT)
   */
  function publish(topic, messageObj) {
    if (client && isConnected) {
      const msgStr = typeof messageObj === 'string' ? messageObj : JSON.stringify(messageObj);
      client.publish(topic || config.topic, msgStr);
    }
  }

  /**
   * Status reporter to UI
   */
  function updateStatus(state, colorClass, label) {
    if (typeof statusChangeCallback === 'function') {
      statusChangeCallback({
        state,
        colorClass,
        label,
        topic: config.topic,
        isLive: isLiveFromWokwi,
        packetCount: livePacketCount
      });
    }
  }

  /**
   * Process payload and dispatch to UI
   */
  function handleIncomingPayload(data, isLive) {
    const telemetry = {
      v: Number(data.v !== undefined ? data.v : data.voltage || 0),
      i: Number(data.i !== undefined ? data.i : data.current || 0),
      p: Number(data.p !== undefined ? data.p : data.power || (data.v * data.i) || 0),
      kwh: Number(data.kwh !== undefined ? data.kwh : data.energy || 0),
      cost: Number(data.cost !== undefined ? data.cost : (data.kwh * config.tariff) || 0),
      timestamp: data.ts || Date.now(),
      isLive: Boolean(isLive)
    };

    if (typeof telemetryCallback === 'function') {
      telemetryCallback(telemetry);
    }
  }

  /**
   * Local Hardware Simulator (Stand-in when Wokwi is not running)
   */
  function startSimulation() {
    if (simActive) return;
    simActive = true;
    simState.lastCalcTime = Date.now();

    simTimer = setInterval(() => {
      const now = Date.now();
      const dtHours = (now - simState.lastCalcTime) / 3600000;
      simState.lastCalcTime = now;

      // Realistic analog ADC jitter
      const jitterV = (Math.random() - 0.5) * 0.6;
      const jitterA = (Math.random() - 0.5) * 0.03;

      const currentV = Math.max(0, simState.volts + jitterV);
      const currentA = Math.max(0, simState.amps + jitterA);
      const currentP = currentV * currentA;

      simState.kwh += (currentP / 1000) * dtHours;
      simState.cost = simState.kwh * config.tariff;

      const payload = {
        v: parseFloat(currentV.toFixed(1)),
        i: parseFloat(currentA.toFixed(2)),
        p: parseFloat(currentP.toFixed(1)),
        kwh: parseFloat(simState.kwh.toFixed(5)),
        cost: parseFloat(simState.cost.toFixed(3)),
        ts: now
      };

      handleIncomingPayload(payload, false);

      // Also publish to MQTT broker if connected
      if (client && isConnected) {
        publish(config.topic, payload);
      }
    }, 2000);

    if (!isLiveFromWokwi) {
      updateStatus('SIMULATOR', 'cyan', 'Virtual Simulator Mode (2s)');
    }
  }

  function stopSimulation() {
    if (!simActive) return;
    simActive = false;
    clearInterval(simTimer);
    simTimer = null;
  }

  function setSimVolts(v) {
    simState.volts = Number(v);
  }

  function setSimAmps(a) {
    simState.amps = Number(a);
  }

  function resetKwh() {
    simState.kwh = 0.0;
    simState.cost = 0.0;
  }

  function setTariff(t) {
    config.tariff = Number(t) || 8.0;
  }

  return {
    connect,
    disconnect,
    publish,
    startSimulation,
    stopSimulation,
    setSimVolts,
    setSimAmps,
    resetKwh,
    setTariff,
    getConfig: () => ({ ...config }),
    setConfig: (newCfg) => { config = { ...config, ...newCfg }; },
    onTelemetry: (cb) => { telemetryCallback = cb; },
    onStatusChange: (cb) => { statusChangeCallback = cb; },
    isSimulating: () => simActive,
    isConnected: () => isConnected,
    isLiveFromWokwi: () => isLiveFromWokwi,
    getPacketCount: () => livePacketCount
  };
})();
