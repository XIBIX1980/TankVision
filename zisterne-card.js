/**
 * Zisterne / TankVision Custom Card für Home Assistant
 *
 * Datei nach 'config/www/zisterne-card.js' kopieren und als Lovelace-Ressource
 * einbinden (/local/zisterne-card.js). Nutzbar als:
 *   type: custom:zisterne-card   ODER   type: custom:tankvision-card
 *
 * WICHTIG (gegen das Ruckeln der Welle):
 * Die Karte baut ihre Struktur nur EINMAL auf (_build) und aktualisiert danach
 * nur noch die Werte (_apply). Dadurch wird das animierte Wellen-Element bei
 * Zustandsänderungen NICHT neu erzeugt und die Animation startet nicht dauernd neu.
 */

class ZisterneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._built = false;
    this._refs = {};
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
      wave_speed: 8, // Dauer eines Wellendurchlaufs in Sekunden (größer = ruhiger)
      roundness: '16px',
      shadow: true,
      show_liter: true,
      show_percent: true,
      show_diagnostics: true,
      unit_liter: 'L',
      unit_percent: '%',
      unit_distance: 'cm',
      language: 'de',
      ...config
    };
    // Konfiguration hat sich geändert -> Struktur beim nächsten Update neu aufbauen
    this._built = false;
    if (this._hass) this._update();
  }

  // Home Assistant aktualisiert die Sensorwerte (wird sehr häufig aufgerufen)
  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  // ---- Hilfsfunktionen --------------------------------------------------

  // Liest einen Zahlenwert sauber aus; null bei fehlender/ungültiger Entität
  _getNum(id) {
    if (!id || typeof id !== 'string') return null;
    const st = this._hass.states[id];
    if (!st) return null;
    const s = st.state;
    if (s === 'unavailable' || s === 'unknown' || s === '' || s === null || s === undefined) {
      return null;
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // Prüft den Status einer Entität für die Diagnose-Anzeige
  _checkEntity(label, id) {
    if (!id || typeof id !== 'string') return null;
    const st = this._hass.states[id];
    let status;
    let ok = false;
    if (!st) {
      status = 'nicht gefunden';
    } else if (st.state === 'unavailable' || st.state === 'unknown' || st.state === '') {
      status = st.state || 'leer';
    } else if (isNaN(parseFloat(st.state))) {
      status = 'kein Zahlenwert';
    } else {
      status = 'OK (' + st.state + ')';
      ok = true;
    }
    return { label, id, status, ok };
  }

  _t() {
    const lang = this._config.language || 'de';
    return {
      de: { title: 'Zisterne', liter: 'Liter', percent: 'Prozent', distance: 'Abstand', max_volume: 'Max. Volumen', fill_level: 'Füllstand', connected: 'Verbunden', empty: 'Leer' },
      en: { title: 'Cistern', liter: 'Liters', percent: 'Percent', distance: 'Distance', max_volume: 'Max Volume', fill_level: 'Fill Level', connected: 'Connected', empty: 'Empty' }
    }[lang] || { title: 'Zisterne', liter: 'Liter' };
  }

  // ---- Hauptablauf ------------------------------------------------------

  _update() {
    if (!this._hass || !this._config) return;

    // 1) Entitäten auflösen
    const sensorDistanceId = this._config.entities?.sensor_distance || this._config.sensor_distance;
    const fillLiterId = this._config.entities?.fill_liter || this._config.fill_liter;
    const fillPercentId = this._config.entities?.fill_percent || this._config.fill_percent;

    // max_volume darf eine ZAHL oder ein Sensor-Name sein
    const maxVolumeConfig = this._config.entities?.max_volume ?? this._config.max_volume;
    let maxVolumeVal = 5000;
    if (typeof maxVolumeConfig === 'number') {
      maxVolumeVal = maxVolumeConfig;
    } else if (typeof maxVolumeConfig === 'string') {
      const v = this._getNum(maxVolumeConfig);
      if (v !== null) maxVolumeVal = v;
    }

    // cistern_height darf Zahl oder Sensor sein
    const cisternHeightConfig = this._config.cistern_height;
    let cisternHeight = 200;
    if (typeof cisternHeightConfig === 'number') {
      cisternHeight = cisternHeightConfig;
    } else if (typeof cisternHeightConfig === 'string') {
      const v = this._getNum(cisternHeightConfig);
      if (v !== null) cisternHeight = v;
    }

    // 2) Werte auslesen
    const distanceVal = this._getNum(sensorDistanceId);
    const fillLiterVal = this._getNum(fillLiterId);
    const fillPercentVal = this._getNum(fillPercentId);

    // 3) Prozent berechnen
    let percent = 0;
    let dataSource = 'Fallback (50%)';
    let isFallback = true;

    if (fillPercentVal !== null) {
      percent = fillPercentVal;
      dataSource = 'Direkter Prozent-Sensor';
      isFallback = false;
    } else if (fillLiterVal !== null) {
      percent = (fillLiterVal / maxVolumeVal) * 100;
      dataSource = 'Berechnet aus Litern / Max. Volumen';
      isFallback = false;
    } else if (distanceVal !== null) {
      const waterHeight = Math.max(0, cisternHeight - distanceVal);
      percent = (waterHeight / cisternHeight) * 100;
      dataSource = 'Berechnet aus Sensorabstand';
      isFallback = false;
    } else {
      percent = 50;
    }

    percent = Math.min(100, Math.max(0, percent));
    const finalPercent = Math.round(percent);
    const finalLiter = fillLiterVal !== null ? fillLiterVal : Math.round((percent / 100) * maxVolumeVal);
    const finalDistance = distanceVal !== null ? distanceVal : Math.round(cisternHeight - (percent / 100) * cisternHeight);
    const connected = !isFallback;

    // 4) Diagnose
    const checks = [];
    const t = this._t();
    const cDist = this._checkEntity(t.distance, sensorDistanceId);
    const cLit = this._checkEntity(t.liter, fillLiterId);
    const cPct = this._checkEntity(t.percent, fillPercentId);
    if (cDist) checks.push(cDist);
    if (cLit) checks.push(cLit);
    if (cPct) checks.push(cPct);
    const hasProblem = isFallback || checks.some((c) => !c.ok);
    const showDiag = this._config.show_diagnostics !== false && hasProblem;

    // 5) Struktur EINMALIG aufbauen (nur wenn nötig)
    if (!this._built) {
      this._build(sensorDistanceId);
      this._built = true;
    }

    // 6) Nur Werte aktualisieren (kein Neuaufbau -> Animation läuft ruhig weiter)
    this._apply({
      finalPercent, finalLiter, finalDistance, maxVolumeVal,
      dataSource, connected, showDiag, checks
    });
  }

  // ---- Struktur (läuft nur einmal) --------------------------------------

  _build(sensorDistanceId) {
    const cfg = this._config;
    const t = this._t();
    const waterColor = cfg.water_color;
    const isAnimated = cfg.animations !== false;
    const hasWaves = cfg.waves !== false;
    const hasShadow = cfg.shadow !== false;
    const waveSpeed = Number(cfg.wave_speed) > 0 ? Number(cfg.wave_speed) : 8;

    const style = `
      :host { display: block; width: 100%; max-width: ${cfg.card_width}; }
      .card-wrapper {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: ${cfg.roundness};
        color: #f1f5f9;
        font-family: var(--paper-font-body1_-_font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
        overflow: hidden;
        transition: all 0.3s ease;
        ${hasShadow ? 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);' : ''}
      }
      .card-header {
        padding: 16px 24px;
        border-bottom: 1px solid #334155;
        display: flex; align-items: center; justify-content: space-between;
        background-color: rgba(15, 23, 42, 0.4);
      }
      .card-title { font-size: 18px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 8px; }
      .status-badge {
        padding: 2px 8px;
        background-color: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.2);
        color: #10b981;
        font-size: 10px; font-weight: bold; text-transform: uppercase;
        border-radius: 4px; display: flex; align-items: center; gap: 6px;
      }
      .status-badge.disconnected {
        background-color: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }
      .status-dot { width: 6px; height: 6px; border-radius: 50%; background-color: #10b981; }
      .status-badge.disconnected .status-dot { background-color: #ef4444; }
      .card-content {
        padding: 24px; display: flex; flex-direction: row;
        align-items: center; justify-content: center; gap: 32px;
      }
      @media (max-width: 480px) { .card-content { flex-direction: column; } }
      .vessel-area { position: relative; width: 192px; display: flex; flex-direction: column; align-items: center; }
      .tank-vessel {
        position: relative; width: 192px; height: 256px;
        border: 4px solid #475569; background-color: rgba(15, 23, 42, 0.5);
        border-bottom-left-radius: 24px; border-bottom-right-radius: 24px;
        border-top-left-radius: 8px; border-top-right-radius: 8px;
        overflow: hidden; display: flex; align-items: flex-end;
      }
      .sensor-mount {
        position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
        z-index: 5; display: flex; flex-direction: column; align-items: center;
        gap: 3px; pointer-events: none;
      }
      .sensor-head {
        display: flex; align-items: center; gap: 6px;
        background-color: rgba(15, 23, 42, 0.9); border: 1px solid #475569;
        border-radius: 8px; padding: 4px 9px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
      }
      .sensor-head svg { width: 16px; height: 16px; color: #60a5fa; flex-shrink: 0; }
      .sensor-distance-value { font-size: 12px; font-weight: 700; color: #e2e8f0; font-family: monospace; white-space: nowrap; }
      .sensor-pulse {
        width: 3px; height: 16px; border-radius: 2px;
        background: linear-gradient(to bottom, rgba(96, 165, 250, 0.7), rgba(96, 165, 250, 0));
        ${isAnimated ? 'animation: sensor-ping 2s ease-in-out infinite;' : ''}
      }
      .water-column {
        width: 100%; position: relative;
        transition: height 1s ease-out; height: 0%;
        background-color: ${waterColor}; opacity: 0.85;
      }
      .water-column::after {
        content: ''; position: absolute; top: 0; left: 0; right: 0;
        height: 4px; background-color: rgba(255, 255, 255, 0.3);
      }
      .wave-container {
        position: absolute; top: -16px; left: 0; width: 100%; height: 20px;
        overflow: visible; pointer-events: none;
      }
      .wave-svg {
        position: absolute; width: 200%; height: 100%; top: 0; left: 0;
        fill: ${waterColor};
        will-change: transform; backface-visibility: hidden;
        ${isAnimated ? `animation: wave-movement ${waveSpeed}s linear infinite;` : ''}
      }
      .percentage-label {
        position: absolute; inset: 0; display: flex;
        align-items: center; justify-content: center;
        font-size: 32px; font-weight: 900; color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      .stats-panel { flex: 1; display: flex; flex-direction: column; gap: 16px; width: 100%; }
      .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .metric-box {
        background-color: rgba(15, 23, 42, 0.4); border: 1px solid rgba(51, 65, 85, 0.8);
        padding: 12px; border-radius: 12px;
      }
      .metric-label { font-size: 12px; color: #94a3b8; }
      .metric-value { font-size: 24px; font-weight: bold; color: white; margin-top: 4px; }
      .metric-unit { font-size: 14px; color: #94a3b8; font-weight: normal; }
      .sensor-mapping-box {
        background-color: rgba(15, 23, 42, 0.2); border: 1px solid rgba(51, 65, 85, 0.5);
        border-radius: 12px; padding: 14px;
      }
      .mapping-title {
        font-size: 11px; font-weight: 600; color: #94a3b8;
        text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;
      }
      .mapping-row {
        display: flex; justify-content: space-between; font-size: 12px;
        font-family: monospace; padding: 6px 0; border-bottom: 1px solid rgba(51, 65, 85, 0.3);
      }
      .mapping-row:last-child { border-bottom: none; }
      .mapping-label { color: #94a3b8; }
      .mapping-value { color: #60a5fa; }
      .info-row { font-size: 10px; color: #64748b; margin-top: 8px; }
      .diag-box {
        margin: 0 24px 24px 24px; background-color: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 14px;
      }
      .diag-title { font-size: 12px; font-weight: 700; color: #fca5a5; margin: 0 0 8px 0; }
      .diag-hint { font-size: 11px; color: #fca5a5; margin: 0 0 10px 0; line-height: 1.4; }
      .diag-row {
        display: flex; justify-content: space-between; align-items: center; gap: 8px;
        font-size: 11px; font-family: monospace; padding: 5px 0;
        border-bottom: 1px solid rgba(239, 68, 68, 0.15);
      }
      .diag-row:last-child { border-bottom: none; }
      .diag-id { color: #e2e8f0; word-break: break-all; }
      .diag-status-ok { color: #10b981; white-space: nowrap; }
      .diag-status-bad { color: #ef4444; white-space: nowrap; }
      @keyframes wave-movement {
        from { transform: translate3d(0, 0, 0); }
        to   { transform: translate3d(-50%, 0, 0); }
      }
      @keyframes sensor-ping {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
    `;

    const sensorMountHtml = sensorDistanceId ? `
      <div class="sensor-mount">
        <div class="sensor-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="3" width="12" height="7" rx="1.5"></rect>
            <path d="M9 6h6"></path>
            <path d="M8.5 13.5c2 1.6 5 1.6 7 0"></path>
            <path d="M7 16.5c3 2.2 7 2.2 10 0"></path>
          </svg>
          <span class="sensor-distance-value" data-ref="distance">–</span>
        </div>
        <div class="sensor-pulse"></div>
      </div>
    ` : '';

    const waveHtml = hasWaves ? `
      <div class="wave-container" data-ref="wave" style="display:none;">
        <svg class="wave-svg" viewBox="0 0 1000 120" preserveAspectRatio="none">
          <path d="M0,60 q62.5,-30 125,0 t125,0 t125,0 t125,0 t125,0 t125,0 t125,0 t125,0 L1000,120 L0,120 Z"></path>
        </svg>
      </div>
    ` : '';

    const percentLabelHtml = cfg.show_percent !== false ? `
      <div class="percentage-label" data-ref="percent-label" style="display:none;"></div>
    ` : '';

    const metricPercentHtml = cfg.show_percent !== false ? `
      <div class="metric-box">
        <div class="metric-label">${t.fill_level}</div>
        <div class="metric-value"><span data-ref="metric-percent">–</span><span class="metric-unit">${cfg.unit_percent}</span></div>
      </div>
    ` : '';

    const metricLiterHtml = cfg.show_liter !== false ? `
      <div class="metric-box">
        <div class="metric-label">${t.liter}</div>
        <div class="metric-value"><span data-ref="metric-liter">–</span><span class="metric-unit">${cfg.unit_liter}</span></div>
      </div>
    ` : '';

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="card-wrapper">
        <div class="card-header">
          <div class="card-title">
            <svg style="width: 20px; height: 20px; color: #60a5fa;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            ${cfg.title || t.title}
          </div>
          <div class="status-badge" data-ref="badge">
            <span class="status-dot"></span>
            <span data-ref="badge-text">${t.connected}</span>
          </div>
        </div>
        <div class="card-content">
          <div class="vessel-area">
            <div class="tank-vessel">
              ${sensorMountHtml}
              <div class="water-column" data-ref="water">
                ${waveHtml}
                ${percentLabelHtml}
              </div>
            </div>
          </div>

          <div class="stats-panel">
            <div class="metric-grid">
              ${metricPercentHtml}
              ${metricLiterHtml}
            </div>

            <div class="sensor-mapping-box">
              <div class="mapping-title">Sensoren</div>
              <div class="mapping-row">
                <span class="mapping-label">${t.max_volume}</span>
                <span class="mapping-value" data-ref="max-volume">–</span>
              </div>
              <div class="info-row" data-ref="data-source"></div>
            </div>
          </div>
        </div>
        <div class="diag-box" data-ref="diag" style="display:none;"></div>
      </div>
    `;

    // Referenzen auf die veränderlichen Elemente merken
    const q = (sel) => this.shadowRoot.querySelector(sel);
    this._refs = {
      badge: q('[data-ref="badge"]'),
      badgeText: q('[data-ref="badge-text"]'),
      water: q('[data-ref="water"]'),
      wave: q('[data-ref="wave"]'),
      percentLabel: q('[data-ref="percent-label"]'),
      metricPercent: q('[data-ref="metric-percent"]'),
      metricLiter: q('[data-ref="metric-liter"]'),
      distance: q('[data-ref="distance"]'),
      maxVolume: q('[data-ref="max-volume"]'),
      dataSource: q('[data-ref="data-source"]'),
      diag: q('[data-ref="diag"]')
    };
  }

  // ---- Werte aktualisieren (läuft bei jeder Änderung, ohne Neuaufbau) ----

  _apply(v) {
    const r = this._refs;
    if (!r || !r.water) return;
    const cfg = this._config;

    // Wasserhöhe (sanfte Höhen-Transition, Welle bleibt unangetastet)
    r.water.style.height = v.finalPercent + '%';

    // Welle nur zwischen 1% und 99% anzeigen
    if (r.wave) {
      r.wave.style.display = (v.finalPercent > 0 && v.finalPercent < 100) ? 'block' : 'none';
    }

    // Große Prozentzahl im Wasser
    if (r.percentLabel) {
      r.percentLabel.textContent = v.finalPercent + cfg.unit_percent;
      r.percentLabel.style.display = (v.finalPercent >= 20) ? 'flex' : 'none';
    }

    if (r.metricPercent) r.metricPercent.textContent = v.finalPercent;
    if (r.metricLiter) r.metricLiter.textContent = v.finalLiter.toLocaleString();
    if (r.distance) r.distance.textContent = v.finalDistance.toLocaleString() + ' ' + cfg.unit_distance;
    if (r.maxVolume) r.maxVolume.textContent = v.maxVolumeVal.toLocaleString() + ' ' + cfg.unit_liter;
    if (r.dataSource) r.dataSource.textContent = 'Datenquelle: ' + v.dataSource;

    // Verbindungs-Badge
    if (r.badge) r.badge.classList.toggle('disconnected', !v.connected);
    if (r.badgeText) r.badgeText.textContent = v.connected ? 'Verbunden' : 'Kein Signal';

    // Diagnose-Kasten
    if (r.diag) {
      if (v.showDiag) {
        const rows = v.checks.map((c) => `
          <div class="diag-row">
            <span class="diag-id">${c.label}: ${c.id}</span>
            <span class="${c.ok ? 'diag-status-ok' : 'diag-status-bad'}">${c.status}</span>
          </div>
        `).join('');
        const noEntities = v.checks.length === 0
          ? '<div class="diag-hint">Es ist gar kein Sensor konfiguriert. Trage z. B. <b>fill_percent</b>, <b>fill_liter</b> oder <b>sensor_distance</b> in die YAML ein.</div>'
          : '';
        r.diag.innerHTML = `
          <div class="diag-title">⚠️ Keine gültigen Sensordaten – es werden Notwerte (50 %) angezeigt</div>
          <div class="diag-hint">
            Prüfe die Namen unter <b>Entwicklerwerkzeuge → Zustände</b>. Sie müssen exakt übereinstimmen.
            "nicht gefunden" = Name falsch. "unavailable/unknown" = Gerät offline.
          </div>
          ${noEntities}
          ${rows}
        `;
        r.diag.style.display = 'block';
      } else {
        r.diag.style.display = 'none';
        r.diag.innerHTML = '';
      }
    }
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement('zisterne-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'Regenwasser-Zisterne',
      fill_percent: '',
      fill_liter: '',
      max_volume: '',
      sensor_distance: '',
      cistern_height: 200,
      wave_speed: 8,
      water_color: '#3b82f6',
      animations: true,
      waves: true
    };
  }
}

// ---------------------------------------------------------------------------
// Konfigurations-Editor (GUI) – nutzt das eingebaute ha-form von Home Assistant
// ---------------------------------------------------------------------------

const ZISTERNE_LABELS = {
  title: 'Titel',
  fill_percent: 'Füllstand-Sensor (%)',
  fill_liter: 'Füllmengen-Sensor (Liter)',
  max_volume: 'Max-Volumen-Sensor (Liter)',
  sensor_distance: 'Abstands-Sensor (cm)',
  cistern_height: 'Zisternenhöhe (cm)',
  wave_speed: 'Wellen-Tempo (Sekunden)',
  water_color: 'Wasserfarbe (Hex, z. B. #3b82f6)',
  animations: 'Animationen',
  waves: 'Wellen anzeigen',
  shadow: 'Schatten',
  show_percent: 'Prozent anzeigen',
  show_liter: 'Liter anzeigen',
  show_diagnostics: 'Diagnose-Hinweis anzeigen'
};

const ZISTERNE_HELPERS = {
  fill_percent: 'Beste Quelle. Wenn gesetzt, wird direkt dieser Prozentwert verwendet.',
  max_volume: 'Sensor ODER feste Zahl (feste Zahl nur per YAML).',
  cistern_height: 'Nur nötig, wenn du ausschließlich den Abstands-Sensor nutzt.'
};

const ZISTERNE_SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: 'fill_percent', selector: { entity: { filter: [{ domain: 'sensor' }] } } },
  { name: 'fill_liter', selector: { entity: { filter: [{ domain: 'sensor' }] } } },
  { name: 'max_volume', selector: { entity: { filter: [{ domain: 'sensor' }] } } },
  { name: 'sensor_distance', selector: { entity: { filter: [{ domain: 'sensor' }] } } },
  { name: 'cistern_height', selector: { number: { min: 1, max: 1000, mode: 'box', unit_of_measurement: 'cm' } } },
  { name: 'wave_speed', selector: { number: { min: 1, max: 60, mode: 'box', unit_of_measurement: 's' } } },
  { name: 'water_color', selector: { text: {} } },
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'animations', selector: { boolean: {} } },
      { name: 'waves', selector: { boolean: {} } },
      { name: 'shadow', selector: { boolean: {} } },
      { name: 'show_percent', selector: { boolean: {} } },
      { name: 'show_liter', selector: { boolean: {} } },
      { name: 'show_diagnostics', selector: { boolean: {} } }
    ]
  }
];

class ZisterneCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this.shadowRoot) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (schema) => ZISTERNE_LABELS[schema.name] || schema.name;
      this._form.computeHelper = (schema) => ZISTERNE_HELPERS[schema.name] || '';
      this._form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        const newConfig = { ...this._config, ...ev.detail.value };
        this._config = newConfig;
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: newConfig },
          bubbles: true,
          composed: true
        }));
      });
      this.shadowRoot.appendChild(this._form);
    }
    this._form.schema = ZISTERNE_SCHEMA;
    this._form.data = this._config;
    if (this._hass) this._form.hass = this._hass;
  }
}

if (!customElements.get('zisterne-card-editor')) {
  customElements.define('zisterne-card-editor', ZisterneCardEditor);
}

// Karte unter beiden Namen registrieren
if (!customElements.get('zisterne-card')) {
  customElements.define('zisterne-card', ZisterneCard);
}
if (!customElements.get('tankvision-card')) {
  customElements.define('tankvision-card', ZisterneCard);
}

// In der "Karte hinzufügen"-Auswahl anzeigen
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'zisterne-card',
  name: 'Zisterne / TankVision Card',
  description: 'Füllstandsanzeige für Zisterne oder Tank – mit grafischem Editor',
  preview: true
});
