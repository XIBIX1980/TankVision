/**
 * TankWatch / TankVision Custom Card für Home Assistant
 *
 * Rundes Tacho-Design: Wasser füllt den Kreis von unten, blauer Fortschrittsbogen,
 * große Prozentzahl in der Mitte, aktuelle Menge + max. Behältervolumen darunter,
 * angedeuteter Sensor mit Abstandswert oberhalb des Gefässes.
 *
 * Datei nach 'config/www/tankvision.js' kopieren und als Lovelace-Ressource
 * einbinden (/local/tankvision.js). Nutzbar als:
 *   type: custom:tankvision-card   ODER   type: custom:zisterne-card
 *
 * Logo: das Logo-Bild nach 'config/www/tankvision-logo.png' kopieren.
 * Es wird automatisch statt des Titel-Textes angezeigt (Option: logo).
 *
 * Aufbau erfolgt EINMALIG (_build), danach werden nur Werte aktualisiert (_apply).
 * Dadurch startet die Wasser-Animation nicht bei jeder Zustandsänderung neu.
 */

class ZisterneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._built = false;
    this._refs = {};
  }

  setConfig(config) {
    this._config = {
      title: 'TankWatch',
      logo: '/local/tankvision-logo.png',
      center_label: 'KAPAZITÄT',
      cistern_height: 200,
      card_width: '100%',
      water_color: '#2f80c9',
      animations: true,
      wave_speed: 8,
      roundness: '20px',
      shadow: true,
      show_diagnostics: true,
      unit_percent: '%',
      unit_distance: 'cm',
      language: 'de',
      ...config
    };
    this._built = false;
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  // ---- Hilfsfunktionen --------------------------------------------------

  _getNum(id) {
    if (!id || typeof id !== 'string') return null;
    const st = this._hass.states[id];
    if (!st) return null;
    const s = st.state;
    if (s === 'unavailable' || s === 'unknown' || s === '' || s === null || s === undefined) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

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
      de: { distance: 'Abstand', liter: 'Liter', percent: 'Prozent' },
      en: { distance: 'Distance', liter: 'Liters', percent: 'Percent' }
    }[lang] || { distance: 'Abstand', liter: 'Liter', percent: 'Prozent' };
  }

  // ---- Hauptablauf ------------------------------------------------------

  _update() {
    if (!this._hass || !this._config) return;

    const sensorDistanceId = this._config.entities?.sensor_distance || this._config.sensor_distance;
    const fillLiterId = this._config.entities?.fill_liter || this._config.fill_liter;
    const fillPercentId = this._config.entities?.fill_percent || this._config.fill_percent;

    const maxVolumeConfig = this._config.entities?.max_volume ?? this._config.max_volume;
    let maxVolumeVal = 5000;
    if (typeof maxVolumeConfig === 'number') {
      maxVolumeVal = maxVolumeConfig;
    } else if (typeof maxVolumeConfig === 'string') {
      const v = this._getNum(maxVolumeConfig);
      if (v !== null) maxVolumeVal = v;
    }

    const cisternHeightConfig = this._config.cistern_height;
    let cisternHeight = 200;
    if (typeof cisternHeightConfig === 'number') {
      cisternHeight = cisternHeightConfig;
    } else if (typeof cisternHeightConfig === 'string') {
      const v = this._getNum(cisternHeightConfig);
      if (v !== null) cisternHeight = v;
    }

    const distanceVal = this._getNum(sensorDistanceId);
    const fillLiterVal = this._getNum(fillLiterId);
    const fillPercentVal = this._getNum(fillPercentId);

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

    if (!this._built) {
      this._build(sensorDistanceId);
      this._built = true;
    }

    this._apply({ finalPercent, finalLiter, finalDistance, maxVolumeVal, connected, showDiag, checks });
  }

  // ---- Struktur (läuft nur einmal) --------------------------------------

  _build(sensorDistanceId) {
    const cfg = this._config;
    const waterColor = cfg.water_color;
    const isAnimated = cfg.animations !== false;
    const hasShadow = cfg.shadow !== false;
    const waveSpeed = Number(cfg.wave_speed) > 0 ? Number(cfg.wave_speed) : 8;
    const dur = (waveSpeed * 0.7).toFixed(1);

    // Wasseroberfläche: feste Grundhöhe (y≈200), Füllstand wird per translateY gesetzt.
    const fillA = 'M40,196 C110,176 190,216 240,200 C300,184 340,212 360,204 L360,600 L40,600 Z';
    const fillB = 'M40,204 C110,212 190,180 240,200 C300,216 340,184 360,196 L360,600 L40,600 Z';
    const rimA = 'M40,196 C110,176 190,216 240,200 C300,184 340,212 360,204';
    const rimB = 'M40,204 C110,212 190,180 240,200 C300,216 340,184 360,196';
    const hiA = 'M40,199 C110,179 190,219 240,203 C300,187 340,215 360,207';
    const hiB = 'M40,207 C110,215 190,183 240,203 C300,219 340,187 360,199';

    const anim = (a, b) => isAnimated
      ? `<animate attributeName="d" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" values="${a};${b};${a}"/>`
      : '';

    const style = `
      :host { display: block; width: 100%; max-width: ${cfg.card_width}; }
      .card-wrapper {
        background-color: #111a2b;
        border: 1px solid #24314a;
        border-radius: ${cfg.roundness};
        color: #e8f0fb;
        font-family: var(--paper-font-body1_-_font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
        overflow: hidden;
        padding: 20px;
        box-sizing: border-box;
        ${hasShadow ? 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);' : ''}
      }
      .tw-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .tw-title { font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
      .tw-logo { height: 38px; max-width: 62%; width: auto; object-fit: contain; display: block; }
      .tw-badge {
        display: flex; align-items: center; gap: 7px;
        background-color: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34d399; font-size: 12px; font-weight: 600;
        padding: 6px 11px; border-radius: 9px; white-space: nowrap;
      }
      .tw-badge.disconnected {
        background-color: rgba(239, 68, 68, 0.12);
        border-color: rgba(239, 68, 68, 0.3);
        color: #f87171;
      }
      .tw-dot { width: 7px; height: 7px; border-radius: 50%; background-color: #34d399; }
      .tw-badge.disconnected .tw-dot { background-color: #f87171; }

      .tw-sensor-wrap {
        display: flex; flex-direction: column; align-items: center;
        margin-top: 12px; margin-bottom: -6px;
      }
      .tw-sensor {
        display: flex; align-items: center; gap: 8px;
        background-color: #16223a; border: 1px solid #2b3c5a;
        border-radius: 10px; padding: 5px 12px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      }
      .tw-sensor svg { width: 17px; height: 17px; color: #67b0ea; flex-shrink: 0; }
      .tw-sensor span { font-family: monospace; font-weight: 700; color: #dbe6f5; font-size: 14px; white-space: nowrap; }
      .tw-pulse {
        width: 3px; height: 16px; border-radius: 2px;
        background: linear-gradient(to bottom, #67b0ea, rgba(103, 176, 230, 0));
        ${isAnimated ? 'animation: tw-ping 2s ease-in-out infinite;' : ''}
      }

      .tw-gauge { display: flex; justify-content: center; padding: 2px 0; }
      .tw-gauge svg { width: 300px; max-width: 100%; height: auto; }
      .tw-water { transition: transform 1s ease-out; transform-box: view-box; transform-origin: 0 0; }
      .tw-arc { transition: stroke-dasharray 1s ease-out; }

      .tw-volume { text-align: center; margin-top: 4px; }
      .tw-amount { font-size: 32px; font-weight: 700; color: #f4f8fd; }
      .tw-maxlabel { font-size: 13px; color: #8aa0bd; margin-top: 12px; letter-spacing: 0.3px; }
      .tw-maxval { font-size: 20px; font-weight: 600; color: #c3d4ea; margin-top: 2px; }

      .diag-box {
        margin-top: 16px; background-color: rgba(239, 68, 68, 0.08);
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
      .diag-status-bad { color: #f87171; white-space: nowrap; }

      @keyframes tw-ping { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
    `;

    const sensorHtml = sensorDistanceId ? `
      <div class="tw-sensor-wrap">
        <div class="tw-sensor">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="3" width="12" height="7" rx="1.5"></rect>
            <path d="M9 6h6"></path>
            <path d="M8.5 13.5c2 1.6 5 1.6 7 0"></path>
            <path d="M7 16.5c3 2.2 7 2.2 10 0"></path>
          </svg>
          <span data-ref="distance">–</span>
        </div>
        <div class="tw-pulse"></div>
      </div>
    ` : '';

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="card-wrapper">
        <div class="tw-header">
          ${cfg.logo
            ? `<img class="tw-logo" data-ref="logo" src="${cfg.logo}" alt="${cfg.title}"><span class="tw-title" data-ref="title" style="display:none;">${cfg.title}</span>`
            : `<span class="tw-title" data-ref="title">${cfg.title}</span>`}
          <div class="tw-badge" data-ref="badge">
            <span class="tw-dot"></span>
            <span data-ref="badge-text">Verbunden</span>
          </div>
        </div>

        ${sensorHtml}

        <div class="tw-gauge">
          <svg viewBox="0 0 400 400" role="img">
            <title>Füllstandsanzeige</title>
            <defs>
              <clipPath id="tw-wclip"><circle cx="200" cy="200" r="132"/></clipPath>
            </defs>

            <circle cx="200" cy="200" r="178" fill="none" stroke="#33456a" stroke-width="9" stroke-dasharray="1.5 6" opacity="0.55"/>
            <circle cx="200" cy="200" r="150" pathLength="100" fill="none" stroke="#26344f" stroke-width="14" stroke-linecap="round" stroke-dasharray="75 25" transform="rotate(135 200 200)"/>
            <circle class="tw-arc" data-ref="arc" cx="200" cy="200" r="150" pathLength="100" fill="none" stroke="${waterColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="0 100" transform="rotate(135 200 200)"/>

            <circle cx="200" cy="200" r="132" fill="#141f33"/>

            <g clip-path="url(#tw-wclip)">
              <g class="tw-water" data-ref="water">
                <path fill="${waterColor}" opacity="0.95" d="${fillA}">${anim(fillA, fillB)}</path>
                <path fill="none" stroke="#0b1424" stroke-width="4" opacity="0.5" d="${rimA}">${anim(rimA, rimB)}</path>
                <path fill="none" stroke="#67b0ea" stroke-width="2.5" opacity="0.7" d="${hiA}">${anim(hiA, hiB)}</path>
              </g>
            </g>

            <text text-anchor="middle" x="200" y="202" font-family="var(--paper-font-body1_-_font-family, -apple-system, 'Segoe UI', Roboto, sans-serif)"><tspan data-ref="percent" font-size="80" font-weight="800" fill="#f4f8fd">50</tspan><tspan font-size="30" font-weight="600" fill="#c3d4ea" dx="2" dy="-30">${cfg.unit_percent}</tspan></text>
            <text text-anchor="middle" x="200" y="234" fill="#7f93b0" font-size="17" font-weight="600" letter-spacing="4" font-family="var(--paper-font-body1_-_font-family, -apple-system, 'Segoe UI', Roboto, sans-serif)">${cfg.center_label}</text>
          </svg>
        </div>

        <div class="tw-volume">
          <div class="tw-amount"><span data-ref="liter">–</span> Liter</div>
          <div class="tw-maxlabel">max. Behältervolumen</div>
          <div class="tw-maxval"><span data-ref="maxvol">–</span> l</div>
        </div>

        <div class="diag-box" data-ref="diag" style="display:none;"></div>
      </div>
    `;

    const q = (sel) => this.shadowRoot.querySelector(sel);
    this._refs = {
      logo: q('[data-ref="logo"]'),
      title: q('[data-ref="title"]'),
      badge: q('[data-ref="badge"]'),
      badgeText: q('[data-ref="badge-text"]'),
      arc: q('[data-ref="arc"]'),
      water: q('[data-ref="water"]'),
      percent: q('[data-ref="percent"]'),
      liter: q('[data-ref="liter"]'),
      maxvol: q('[data-ref="maxvol"]'),
      distance: q('[data-ref="distance"]'),
      diag: q('[data-ref="diag"]')
    };

    // Falls das Logo-Bild nicht geladen werden kann, den Titel-Text anzeigen
    if (this._refs.logo) {
      this._refs.logo.addEventListener('error', () => {
        this._refs.logo.style.display = 'none';
        if (this._refs.title) this._refs.title.style.display = 'inline';
      });
    }
  }

  // ---- Werte aktualisieren (ohne Neuaufbau) -----------------------------

  _apply(v) {
    const r = this._refs;
    if (!r || !r.water) return;
    const cfg = this._config;

    // Blauer Bogen: 31 % -> 31 % von 75 (der Bogen umfasst 270° = 75 der pathLength 100)
    const fillLen = (v.finalPercent / 100) * 75;
    r.arc.style.strokeDasharray = fillLen.toFixed(2) + ' ' + (100 - fillLen).toFixed(2);

    // Wasserstand: Oberfläche bei y = 332 - Anteil * 264; Gruppe wird entsprechend verschoben
    const ty = 132 - (v.finalPercent / 100) * 264;
    r.water.style.transform = 'translateY(' + ty.toFixed(1) + 'px)';

    if (r.percent) r.percent.textContent = v.finalPercent;
    if (r.liter) r.liter.textContent = v.finalLiter.toLocaleString();
    if (r.maxvol) r.maxvol.textContent = v.maxVolumeVal.toLocaleString();
    if (r.distance) r.distance.textContent = v.finalDistance.toLocaleString() + ' ' + cfg.unit_distance;

    if (r.badge) r.badge.classList.toggle('disconnected', !v.connected);
    if (r.badgeText) r.badgeText.textContent = v.connected ? 'Verbunden' : 'Kein Signal';

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
          <div class="diag-hint">Prüfe die Namen unter <b>Entwicklerwerkzeuge → Zustände</b>. "nicht gefunden" = Name falsch, "unavailable/unknown" = Gerät offline.</div>
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
    return 4;
  }

  static getConfigElement() {
    return document.createElement('zisterne-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'TankWatch',
      fill_percent: '',
      fill_liter: '',
      max_volume: '',
      sensor_distance: '',
      cistern_height: 200,
      wave_speed: 8,
      water_color: '#2f80c9',
      animations: true
    };
  }
}

// ---------------------------------------------------------------------------
// Konfigurations-Editor (GUI)
// ---------------------------------------------------------------------------

const ZISTERNE_LABELS = {
  title: 'Titel',
  logo: 'Logo-Bild (URL, z. B. /local/tankvision-logo.png)',
  center_label: 'Text in der Mitte',
  fill_percent: 'Füllstand-Sensor (%)',
  fill_liter: 'Füllmengen-Sensor (Liter)',
  max_volume: 'Max-Volumen-Sensor (Liter)',
  sensor_distance: 'Abstands-Sensor (cm)',
  cistern_height: 'Zisternenhöhe (cm)',
  wave_speed: 'Wellen-Tempo (Sekunden)',
  water_color: 'Wasserfarbe (Hex, z. B. #2f80c9)',
  animations: 'Animationen',
  shadow: 'Schatten',
  show_diagnostics: 'Diagnose-Hinweis anzeigen'
};

const ZISTERNE_HELPERS = {
  logo: 'Leer lassen, um stattdessen den Titel-Text anzuzeigen.',
  fill_percent: 'Beste Quelle. Wenn gesetzt, wird direkt dieser Prozentwert verwendet.',
  max_volume: 'Sensor ODER feste Zahl (feste Zahl nur per YAML).',
  cistern_height: 'Nur nötig, wenn du ausschließlich den Abstands-Sensor nutzt.'
};

const ZISTERNE_SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: 'logo', selector: { text: {} } },
  { name: 'center_label', selector: { text: {} } },
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
      { name: 'shadow', selector: { boolean: {} } },
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

if (!customElements.get('zisterne-card')) {
  customElements.define('zisterne-card', ZisterneCard);
}
if (!customElements.get('tankvision-card')) {
  customElements.define('tankvision-card', ZisterneCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'tankvision-card',
  name: 'TankVision Card',
  description: 'Runde Füllstandsanzeige für Zisterne oder Tank – mit grafischem Editor',
  preview: true
});
