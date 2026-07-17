/**
 * Regenwasserzisterne Custom Card für Home Assistant
 * 
 * Diese Datei kann direkt nach 'config/www/zisterne-card.js' kopiert 
 * und als Lovelace-Ressource registriert werden (/local/zisterne-card.js).
 */

class ZisterneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // Home Assistant übergibt die Konfiguration
  setConfig(config) {
    this._config = {
      title: 'Regenwasserzisterne',
      cistern_height: 200,
      card_width: '100%',
      water_color: '#3b82f6',
      animations: true,
      waves: true,
      roundness: '16px',
      shadow: true,
      show_liter: true,
      show_percent: true,
      unit_liter: 'L',
      unit_percent: '%',
      unit_distance: 'cm',
      language: 'de',
      ...config
    };
  }

  // Home Assistant aktualisiert die Sensorwerte
  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    if (!this._hass || !this._config) return;

    // Entitäten auflösen
    const sensorDistanceId = this._config.entities?.sensor_distance || this._config.sensor_distance;
    const maxVolumeId = this._config.entities?.max_volume || this._config.max_volume;
    const fillLiterId = this._config.entities?.fill_liter || this._config.fill_liter;
    const fillPercentId = this._config.entities?.fill_percent || this._config.fill_percent;

    // Werte aus HA holen
    const distanceState = sensorDistanceId ? this._hass.states[sensorDistanceId] : null;
    const maxVolumeState = maxVolumeId ? this._hass.states[maxVolumeId] : null;
    const fillLiterState = fillLiterId ? this._hass.states[fillLiterId] : null;
    const fillPercentState = fillPercentId ? this._hass.states[fillPercentId] : null;

    const distanceVal = distanceState ? parseFloat(distanceState.state) : null;
    const maxVolumeVal = maxVolumeState ? parseFloat(maxVolumeState.state) : 5000;
    const fillLiterVal = fillLiterState ? parseFloat(fillLiterState.state) : null;
    const fillPercentVal = fillPercentState ? parseFloat(fillPercentState.state) : null;

    const cisternHeight = this._config.cistern_height;

    // Prozent berechnen
    let percent = 0;
    let dataSource = 'Fallback (50%)';

    if (fillPercentVal !== null && !isNaN(fillPercentVal)) {
      percent = fillPercentVal;
      dataSource = 'Direkter Prozent-Sensor';
    } else if (fillLiterVal !== null && !isNaN(fillLiterVal)) {
      percent = (fillLiterVal / maxVolumeVal) * 100;
      dataSource = 'Berechnet aus Litern / Max. Volumen';
    } else if (distanceVal !== null && !isNaN(distanceVal)) {
      const waterHeight = Math.max(0, cisternHeight - distanceVal);
      percent = (waterHeight / cisternHeight) * 100;
      dataSource = 'Berechnet aus Sensorabstand';
    } else {
      percent = 50;
    }

    percent = Math.min(100, Math.max(0, percent));
    const finalPercent = Math.round(percent);
    const finalLiter = fillLiterVal !== null ? fillLiterVal : Math.round((percent / 100) * maxVolumeVal);
    const finalDistance = distanceVal !== null ? distanceVal : Math.round(cisternHeight - (percent / 100) * cisternHeight);

    const lang = this._config.language || 'de';
    const t = {
      de: { title: 'Zisterne', liter: 'Liter', percent: 'Prozent', distance: 'Abstand', max_volume: 'Max. Volumen', fill_level: 'Füllstand', connected: 'Verbunden', empty: 'Leer' },
      en: { title: 'Cistern', liter: 'Liters', percent: 'Percent', distance: 'Distance', max_volume: 'Max Volume', fill_level: 'Fill Level', connected: 'Connected', empty: 'Empty' }
    }[lang] || { title: 'Zisterne', liter: 'Liter' };

    const waterColor = this._config.water_color;
    const isAnimated = this._config.animations !== false;
    const hasWaves = this._config.waves !== false;
    const hasShadow = this._config.shadow !== false;

    // CSS Styling
    const style = `
      :host {
        display: block;
        width: 100%;
        max-width: ${this._config.card_width};
      }
      .card-wrapper {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: ${this._config.roundness};
        color: #f1f5f9;
        font-family: var(--paper-font-body1_-_font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
        overflow: hidden;
        transition: all 0.3s ease;
        ${hasShadow ? 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);' : ''}
      }
      .card-header {
        padding: 16px 24px;
        border-b: 1px solid #334155;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: rgba(15, 23, 42, 0.4);
      }
      .card-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .status-badge {
        padding: 2px 8px;
        background-color: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.2);
        color: #10b981;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #10b981;
      }
      .card-content {
        padding: 24px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 32px;
      }
      @media (max-width: 480px) {
        .card-content {
          flex-direction: column;
        }
      }
      .vessel-area {
        position: relative;
        width: 192px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .tank-vessel {
        position: relative;
        width: 192px;
        height: 256px;
        border: 4px solid #475569;
        background-color: rgba(15, 23, 42, 0.5);
        border-bottom-left-radius: 24px;
        border-bottom-right-radius: 24px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: flex-end;
      }
      .water-column {
        width: 100%;
        position: relative;
        transition: height 1s ease-out;
        height: ${finalPercent}%;
        background-color: ${waterColor};
        opacity: 0.85;
      }
      .water-column::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.3);
      }
      .wave-container {
        position: absolute;
        top: -16px;
        left: 0;
        width: 100%;
        height: 20px;
        overflow: visible;
        pointer-events: none;
      }
      .wave-svg {
        position: absolute;
        width: 200%;
        height: 100%;
        top: 0;
        left: 0;
        fill: ${waterColor};
        animation: wave-movement ${isAnimated ? '6s' : '0s'} linear infinite;
      }
      .percentage-label {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 900;
        color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      .stats-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%;
      }
      .metric-grid {
        display: grid;
        grid-template-cols: 1fr 1fr;
        gap: 12px;
      }
      .metric-box {
        background-color: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(51, 65, 85, 0.8);
        padding: 12px;
        border-radius: 12px;
      }
      .metric-label {
        font-size: 12px;
        color: #94a3b8;
      }
      .metric-value {
        font-size: 24px;
        font-weight: bold;
        color: white;
        margin-top: 4px;
      }
      .metric-unit {
        font-size: 14px;
        color: #94a3b8;
        font-weight: normal;
      }
      .sensor-mapping-box {
        background-color: rgba(15, 23, 42, 0.2);
        border: 1px solid rgba(51, 65, 85, 0.5);
        border-radius: 12px;
        padding: 14px;
      }
      .mapping-title {
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 0 0 10px 0;
      }
      .mapping-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-family: monospace;
        padding: 6px 0;
        border-bottom: 1px solid rgba(51, 65, 85, 0.3);
      }
      .mapping-row:last-child {
        border-bottom: none;
      }
      .mapping-label {
        color: #94a3b8;
      }
      .mapping-value {
        color: #60a5fa;
      }
      .info-row {
        font-size: 10px;
        color: #64748b;
        margin-top: 8px;
      }
      @keyframes wave-movement {
        0% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(-25%, 2px, 0); }
        100% { transform: translate3d(-50%, 0, 0); }
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="card-wrapper">
        <div class="card-header">
          <div class="card-title">
            <svg style="width: 20px; height: 20px; color: #60a5fa;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            ${this._config.title || t.title}
          </div>
          <div class="status-badge">
            <span class="status-dot"></span>
            ${t.connected}
          </div>
        </div>
        <div class="card-content">
          <div class="vessel-area">
            <div class="tank-vessel">
              <div class="water-column">
                ${hasWaves && finalPercent > 0 && finalPercent < 100 ? `
                  <div class="wave-container">
                    <svg class="wave-svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                      <path d="M0,60 C150,100 350,20 500,60 C650,100 850,20 1000,60 C1150,100 1350,20 1500,60 L1500,120 L0,120 Z"></path>
                    </svg>
                  </div>
                ` : ''}
                ${this._config.show_percent !== false && finalPercent >= 20 ? `
                  <div class="percentage-label">${finalPercent}${this._config.unit_percent}</div>
                ` : ''}
              </div>
            </div>
          </div>
          
          <div class="stats-panel">
            <div class="metric-grid">
              ${this._config.show_percent !== false ? `
                <div class="metric-box">
                  <div class="metric-label">${t.fill_level}</div>
                  <div class="metric-value">${finalPercent}<span class="metric-unit">${this._config.unit_percent}</span></div>
                </div>
              ` : ''}
              ${this._config.show_liter !== false ? `
                <div class="metric-box">
                  <div class="metric-label">${t.liter}</div>
                  <div class="metric-value">${finalLiter.toLocaleString()}<span class="metric-unit">${this._config.unit_liter}</span></div>
                </div>
              ` : ''}
            </div>

            <div class="sensor-mapping-box">
              <div class="mapping-title">Sensoren</div>
              ${sensorDistanceId ? `
                <div class="mapping-row">
                  <span class="mapping-label">${t.distance}</span>
                  <span class="mapping-value">${finalDistance} ${this._config.unit_distance}</span>
                </div>
              ` : ''}
              <div class="mapping-row">
                <span class="mapping-label">${t.max_volume}</span>
                <span class="mapping-value">${maxVolumeVal.toLocaleString()} ${this._config.unit_liter}</span>
              </div>
              <div class="info-row">
                Datenquelle: ${dataSource}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Definiert die Größe der Lovelace-Karte (Standard 3)
  getCardSize() {
    return 3;
  }
}

customElements.define('zisterne-card', ZisterneCard);
