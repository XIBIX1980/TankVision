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
 * Logo: ist als Bild direkt in dieser Datei eingebettet und wird automatisch
 * statt des Titel-Textes angezeigt. Über die Option 'logo' kann ein eigener
 * Bildpfad gesetzt oder das Feld geleert werden (dann erscheint der Titel-Text).
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
      logo: 'data:image/png;base64,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',
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
  logo: 'Logo ist eingebettet. Eigenen Bildpfad setzen oder leeren für Titel-Text.',
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
