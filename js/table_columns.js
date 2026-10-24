/* ============================================================================
   ISABI Systems — Interactive Table Column Manager (js/table_columns.js)
   Features:
   - Hide / Show any table column (via toolbar Columns popover or header quick-hide)
   - Widen / Narrow any table column (drag header edge resizer or click − / + buttons)
   - Dynamic tfoot / tbody colspan alignment when columns are hidden
   - Ephemeral by design: automatically reverts to default on view/table switch or
     page reload, plus 1-click "↺ Default" reset button & double-click resizer reset
   ============================================================================ */

(function () {
  'use strict';

  const MIN_COL_W = 34;
  const MAX_COL_W = 780;
  const STEP_COL_W = 24;

  // Ephemeral in-memory map (never written to localStorage so reload always starts at default)
  // tableId -> { hiddenCols: Set<number>, colWidths: Map<number, number>, baseWidths: number[] }
  const TABLE_COL_STATE = new Map();
  let currentScopeSig = '';
  let openPopoverTableId = '';
  let lastResizeEndAt = 0;
  let globalListenersWired = false;

  const ICONS = {
    cols: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.8"/><line x1="6" y1="2.5" x2="6" y2="13.5"/><line x1="10.5" y1="2.5" x2="10.5" y2="13.5"/></svg>',
    reset: '<svg viewBox="0 0 16 16" width="11.5" height="11.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9L2.5 5.8"/><polyline points="2.5 2.4 2.5 5.8 5.9 5.8"/></svg>',
    hide: '<svg viewBox="0 0 16 16" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2l12 12"/><path d="M6.5 6.6a2 2 0 0 0 2.9 2.8"/><path d="M4.2 4.3C2.8 5.3 1.8 6.6 1.3 8c1.1 2.8 3.7 4.7 6.7 4.7 1.3 0 2.5-.4 3.6-1"/><path d="M9.9 3.6A6.5 6.5 0 0 1 14.7 8c-.5 1.2-1.3 2.3-2.3 3.1"/></svg>',
    narrow: '<svg viewBox="0 0 12 12" width="9.5" height="9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="6" x2="9.5" y2="6"/></svg>',
    widen: '<svg viewBox="0 0 12 12" width="9.5" height="9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="2.5" x2="6" y2="9.5"/><line x1="2.5" y1="6" x2="9.5" y2="6"/></svg>'
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slug(str) {
    return String(str || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  }

  function clampWidth(w) {
    const n = Math.round(Number(w) || 96);
    return Math.max(MIN_COL_W, Math.min(MAX_COL_W, n));
  }

  function buildScopeSignature(stateObj) {
    if (!stateObj) return 'default';
    const v = String(stateObj.view || 'overview');
    const uk = String(stateObj.activeUnivRegKey || '');
    const tk = String(stateObj.activeTableKey || '');
    const pp = String(stateObj.pbiPage || '');
    const st = String(stateObj.activeStatement || '');
    const tv = stateObj.tableViews ? JSON.stringify(stateObj.tableViews) : '';
    return [v, uk, tk, pp, st, tv].join('|');
  }

  function getOrCreateState(tableId, createIfMissing) {
    if (!TABLE_COL_STATE.has(tableId)) {
      if (!createIfMissing) return null;
      TABLE_COL_STATE.set(tableId, {
        hiddenCols: new Set(),
        colWidths: new Map(),
        baseWidths: []
      });
    }
    return TABLE_COL_STATE.get(tableId);
  }

  function isStateCustomized(st) {
    if (!st) return false;
    return (st.hiddenCols && st.hiddenCols.size > 0) || (st.colWidths && st.colWidths.size > 0);
  }

  function getTableId(table, idx) {
    if (table.dataset.colMgrId) return table.dataset.colMgrId;
    if (table.id) {
      table.dataset.colMgrId = 'tbl_id_' + table.id;
      return table.dataset.colMgrId;
    }
    const sortTh = table.querySelector('thead th[data-sort-view]');
    if (sortTh) {
      table.dataset.colMgrId = 'tbl_sv_' + sortTh.getAttribute('data-sort-view');
      return table.dataset.colMgrId;
    }
    const sgBox = table.closest('.pa-subgrid-box');
    if (sgBox) {
      const sgId = sgBox.getAttribute('data-subgrid-id') || slug((sgBox.querySelector('.pa-subgrid-title') || {}).textContent) || idx;
      table.dataset.colMgrId = 'tbl_sg_' + sgId;
      return table.dataset.colMgrId;
    }
    const hostPanel = table.closest('.pbi-panel, .panel-card, .panel, [id]');
    const pId = (hostPanel && hostPanel.id) ? hostPanel.id : 'panel';
    const titleEl = hostPanel ? hostPanel.querySelector('.pbi-panel-title, .panel-title, .ph h3, h3') : null;
    const tSlug = titleEl ? slug(titleEl.textContent) : ('idx_' + idx);
    table.dataset.colMgrId = `tbl_${pId}_${tSlug}`;
    return table.dataset.colMgrId;
  }

  function extractHeaderLabels(table) {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return [];
    const ths = Array.from(headRow.children).filter(el => el.tagName === 'TH' || el.tagName === 'TD');
    return ths.map((th, i) => {
      if (th.dataset.colCleanLabel) return th.dataset.colCleanLabel;
      const clone = th.cloneNode(true);
      clone.querySelectorAll('.tbl-col-resizer, .tbl-th-tools, .th-filter-btn, .sr-only, i').forEach(el => el.remove());
      const raw = clone.textContent.replace(/[▲▼▾⧩]/g, '').replace(/\s+/g, ' ').trim();
      const label = raw || ('Column ' + (i + 1));
      th.dataset.colCleanLabel = label;
      return label;
    });
  }

  function indexTableCells(table) {
    if (table._cellsIndexed) return;
    table._cellsIndexed = true;
    const rows = Array.from(table.querySelectorAll('thead tr, tbody tr, tfoot tr'));
    rows.forEach(tr => {
      let colCursor = 0;
      Array.from(tr.children).forEach(cell => {
        if (cell.tagName !== 'TH' && cell.tagName !== 'TD') return;
        let origSpan = Number(cell.getAttribute('data-col-orig-span') || 0);
        if (!origSpan || origSpan < 1) {
          origSpan = Math.max(1, Number(cell.getAttribute('colspan') || 1));
          cell.setAttribute('data-col-orig-span', String(origSpan));
        }
        cell.setAttribute('data-col-start', String(colCursor));
        colCursor += origSpan;
      });
    });
  }

  function snapshotBaseWidthsIfNeeded(table, st) {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const ths = Array.from(headRow.children).filter(el => el.tagName === 'TH' || el.tagName === 'TD');
    if (!Array.isArray(table._naturalWidths) || table._naturalWidths.length !== ths.length) {
      const natWidths = ths.map(th => Math.round(th.getBoundingClientRect().width || 0));
      if (natWidths.some(w => w >= MIN_COL_W)) table._naturalWidths = natWidths;
    }
    const nat = Array.isArray(table._naturalWidths) && table._naturalWidths.length === ths.length ? table._naturalWidths : null;
    if (!st.baseWidths || st.baseWidths.length !== ths.length) {
      st.baseWidths = ths.map((th, i) => {
        const w = (nat && nat[i] >= MIN_COL_W) ? nat[i] : Math.round(th.getBoundingClientRect().width || 0);
        return w >= MIN_COL_W ? w : 96;
      });
    } else {
      ths.forEach((th, i) => {
        if (!st.baseWidths[i] || st.baseWidths[i] < MIN_COL_W) {
          const w = (nat && nat[i] >= MIN_COL_W) ? nat[i] : Math.round(th.getBoundingClientRect().width || 0);
          if (w >= MIN_COL_W) st.baseWidths[i] = w;
        }
      });
    }
  }

  function applyTableColumnState(table) {
    if (!table) return;
    const tableId = table.dataset.colMgrId;
    if (!tableId) return;
    const labels = extractHeaderLabels(table);
    const colCount = labels.length;
    if (colCount < 2) return;

    const st = getOrCreateState(tableId, false);
    const hiddenSet = (st && st.hiddenCols) ? st.hiddenCols : new Set();
    const widthMap = (st && st.colWidths) ? st.colWidths : new Map();

    if (hiddenSet.size === 0 && widthMap.size === 0 && !table._hadColCustom) {
      return;
    }
    table._hadColCustom = hiddenSet.size > 0 || widthMap.size > 0;
    indexTableCells(table);

    // Never allow all columns to be hidden; keep at least 1 visible
    if (hiddenSet.size >= colCount) {
      const firstHidden = hiddenSet.values().next().value;
      hiddenSet.delete(firstHidden);
    }

    // 1. Apply column visibility & adjust colspans across thead, tbody, tfoot
    const allRows = Array.from(table.querySelectorAll('thead tr, tbody tr, tfoot tr'));
    allRows.forEach(tr => {
      Array.from(tr.children).forEach(cell => {
        if (cell.tagName !== 'TH' && cell.tagName !== 'TD') return;
        const start = Number(cell.getAttribute('data-col-start') || 0);
        const origSpan = Number(cell.getAttribute('data-col-orig-span') || 1);
        if (origSpan <= 1) {
          const isHidden = hiddenSet.has(start);
          cell.classList.toggle('tbl-col-hidden', isHidden);
        } else {
          let visSpan = 0;
          for (let c = start; c < start + origSpan; c++) {
            if (!hiddenSet.has(c)) visSpan++;
          }
          if (visSpan <= 0) {
            cell.classList.add('tbl-col-hidden');
            cell.setAttribute('colspan', '1');
          } else {
            cell.classList.remove('tbl-col-hidden');
            cell.setAttribute('colspan', String(visSpan));
          }
        }
      });
    });

    // 2. Apply custom column widths
    const hasCustomWidths = widthMap.size > 0;
    let cg = table.querySelector(':scope > colgroup.tbl-col-mgr-colgroup');
    if (!hasCustomWidths) {
      table.classList.remove('has-col-resize');
      table.style.removeProperty('width');
      table.style.removeProperty('min-width');
      if (cg) cg.remove();
      table.querySelectorAll('.tbl-col-resized').forEach(cell => {
        cell.classList.remove('tbl-col-resized');
        cell.style.removeProperty('--col-custom-w');
      });
    } else {
      snapshotBaseWidthsIfNeeded(table, st);
      if (!cg) {
        cg = document.createElement('colgroup');
        cg.className = 'tbl-col-mgr-colgroup';
        table.insertBefore(cg, table.firstChild);
      }
      let totalVisWidth = 0;
      const colHtml = [];
      for (let ci = 0; ci < colCount; ci++) {
        const isHidden = hiddenSet.has(ci);
        const w = clampWidth(widthMap.has(ci) ? widthMap.get(ci) : (st.baseWidths[ci] || 96));
        if (!isHidden) totalVisWidth += w;
        colHtml.push(`<col style="${isHidden ? 'display:none;width:0px' : `width:${w}px`}">`);
      }
      cg.innerHTML = colHtml.join('');
      table.classList.add('has-col-resize');
      table.style.width = Math.max(180, totalVisWidth) + 'px';
      table.style.minWidth = '0px';

      const bodyAndHeadRows = Array.from(table.querySelectorAll('thead tr, tbody tr, tfoot tr'));
      bodyAndHeadRows.forEach(tr => {
        Array.from(tr.children).forEach(cell => {
          const origSpan = Number(cell.getAttribute('data-col-orig-span') || 1);
          if (origSpan !== 1) {
            cell.classList.remove('tbl-col-resized');
            cell.style.removeProperty('--col-custom-w');
            return;
          }
          const ci = Number(cell.getAttribute('data-col-start') || 0);
          const w = clampWidth(widthMap.has(ci) ? widthMap.get(ci) : (st.baseWidths[ci] || 96));
          cell.classList.add('tbl-col-resized');
          cell.style.setProperty('--col-custom-w', w + 'px');
        });
      });
    }

    updateToolbarControlUI(table);
  }

  function toggleColumnVisible(table, colIdx, forceVisible) {
    if (!table) return false;
    const tableId = table.dataset.colMgrId;
    const labels = extractHeaderLabels(table);
    const colCount = labels.length;
    const st = getOrCreateState(tableId, true);
    snapshotBaseWidthsIfNeeded(table, st);
    const currentlyHidden = st.hiddenCols.has(colIdx);
    const wantVisible = forceVisible != null ? Boolean(forceVisible) : currentlyHidden;

    if (!wantVisible) {
      const visibleCount = colCount - st.hiddenCols.size;
      if (visibleCount <= 1) return false; // Keep at least 1 column visible
      st.hiddenCols.add(colIdx);
    } else {
      st.hiddenCols.delete(colIdx);
    }

    if (!isStateCustomized(st)) {
      TABLE_COL_STATE.delete(tableId);
    }
    applyTableColumnState(table);
    return true;
  }

  function setColumnWidth(table, colIdx, targetWidthPx) {
    if (!table) return;
    const tableId = table.dataset.colMgrId;
    const st = getOrCreateState(tableId, true);
    snapshotBaseWidthsIfNeeded(table, st);
    const clamped = clampWidth(targetWidthPx);
    st.colWidths.set(colIdx, clamped);
    applyTableColumnState(table);
  }

  function nudgeColumnWidth(table, colIdx, deltaPx) {
    if (!table) return;
    const tableId = table.dataset.colMgrId;
    const st = getOrCreateState(tableId, true);
    snapshotBaseWidthsIfNeeded(table, st);
    const headRow = table.querySelector('thead tr');
    const ths = headRow ? Array.from(headRow.children) : [];
    const measured = ths[colIdx] ? Math.round(ths[colIdx].getBoundingClientRect().width || 0) : 0;
    const baseW = (st.baseWidths && st.baseWidths[colIdx] >= MIN_COL_W) ? st.baseWidths[colIdx] : (measured >= MIN_COL_W ? measured : 96);
    const curW = st.colWidths.has(colIdx) ? st.colWidths.get(colIdx) : baseW;
    setColumnWidth(table, colIdx, curW + deltaPx);
  }

  function resetSingleColumnWidth(table, colIdx) {
    if (!table) return;
    const tableId = table.dataset.colMgrId;
    const st = getOrCreateState(tableId, false);
    if (!st) return;
    st.colWidths.delete(colIdx);
    if (!isStateCustomized(st)) {
      TABLE_COL_STATE.delete(tableId);
    }
    applyTableColumnState(table);
  }

  function resetTableToDefault(table) {
    if (!table) return;
    const tableId = table.dataset.colMgrId;
    if (tableId) TABLE_COL_STATE.delete(tableId);
    applyTableColumnState(table);
  }

  function resetAllTablesToDefault() {
    TABLE_COL_STATE.clear();
    openPopoverTableId = '';
    document.querySelectorAll('table[data-col-mgr-id]').forEach(table => {
      applyTableColumnState(table);
    });
  }

  function renderPopoverInnerHtml(table) {
    const tableId = table.dataset.colMgrId;
    const labels = extractHeaderLabels(table);
    const colCount = labels.length;
    const st = getOrCreateState(tableId, false);
    const hiddenSet = (st && st.hiddenCols) ? st.hiddenCols : new Set();
    const widthMap = (st && st.colWidths) ? st.colWidths : new Map();
    const visibleCount = colCount - hiddenSet.size;
    const customized = isStateCustomized(st);

    const headRow = table.querySelector('thead tr');
    const ths = headRow ? Array.from(headRow.children) : [];

    return `
      <div class="tbl-col-pop-head">
        <div class="tbl-col-pop-title">
          <strong>Columns (${visibleCount}/${colCount})</strong>
          <small>Hide/show or widen/narrow · reverts to default</small>
        </div>
        <button type="button" class="tbl-col-pop-reset" data-col-pop-reset="${esc(tableId)}" ${customized ? '' : 'disabled'} title="Revert all hidden columns and column widths back to default">
          ${ICONS.reset}<span>Default</span>
        </button>
      </div>
      <div class="tbl-col-pop-list" role="group" aria-label="Table columns">
        ${labels.map((lbl, ci) => {
          const isHidden = hiddenSet.has(ci);
          const hasCustomW = widthMap.has(ci);
          const measuredW = ths[ci] && !isHidden ? Math.round(ths[ci].getBoundingClientRect().width || 0) : ((st && st.baseWidths && st.baseWidths[ci]) || 0);
          const dispW = hasCustomW ? `${widthMap.get(ci)}px` : (measuredW ? `${measuredW}px` : 'Auto');
          const disableHide = !isHidden && visibleCount <= 1;
          return `
            <div class="tbl-col-pop-row ${isHidden ? 'is-hidden' : ''} ${hasCustomW ? 'is-resized' : ''}" data-col-idx="${ci}">
              <label class="tbl-col-pop-chk">
                <input type="checkbox" data-col-toggle-idx="${ci}" ${isHidden ? '' : 'checked'} ${disableHide ? 'disabled' : ''}>
                <span class="tbl-col-pop-name" title="${esc(lbl)}">${esc(lbl)}</span>
              </label>
              <div class="tbl-col-pop-size">
                <button type="button" class="tbl-col-sz-btn" data-col-narrow-idx="${ci}" ${isHidden ? 'disabled' : ''} title="Narrow ${esc(lbl)} (−${STEP_COL_W}px)" aria-label="Narrow ${esc(lbl)}">−</button>
                <button type="button" class="tbl-col-sz-val ${hasCustomW ? 'custom' : ''}" data-col-reset-w-idx="${ci}" ${isHidden ? 'disabled' : ''} title="${hasCustomW ? 'Click to revert this column width to default' : 'Current column width'}">${esc(dispW)}</button>
                <button type="button" class="tbl-col-sz-btn" data-col-widen-idx="${ci}" ${isHidden ? 'disabled' : ''} title="Widen ${esc(lbl)} (+${STEP_COL_W}px)" aria-label="Widen ${esc(lbl)}">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="tbl-col-pop-foot">
        <span>Drag any column border to resize · Double-click border or click <b>Default</b> to revert</span>
      </div>
    `;
  }

  function updateToolbarControlUI(table) {
    const tableId = table.dataset.colMgrId;
    if (!tableId) return;
    const mgrWrap = document.querySelector(`.tbl-col-mgr-wrap[data-for-table="${CSS.escape(tableId)}"]`);
    if (!mgrWrap) return;

    const labels = extractHeaderLabels(table);
    const colCount = labels.length;
    const st = getOrCreateState(tableId, false);
    const hiddenCount = (st && st.hiddenCols) ? st.hiddenCols.size : 0;
    const resizedCount = (st && st.colWidths) ? st.colWidths.size : 0;
    const customized = hiddenCount > 0 || resizedCount > 0;
    const visibleCount = colCount - hiddenCount;

    const triggerBtn = mgrWrap.querySelector('.tbl-col-trigger-btn');
    const resetBtn = mgrWrap.querySelector('.tbl-col-inline-reset');
    const popover = mgrWrap.querySelector('.tbl-col-popover');

    if (triggerBtn) {
      triggerBtn.classList.toggle('is-customized', customized);
      const countBadge = hiddenCount > 0
        ? ` <span class="tbl-col-badge">${visibleCount}/${colCount}</span>`
        : (resizedCount > 0 ? ` <span class="tbl-col-badge">${resizedCount}W</span>` : '');
      triggerBtn.innerHTML = `${ICONS.cols}<span class="tbl-col-btn-lbl">Columns</span>${countBadge}`;
    }

    if (resetBtn) {
      resetBtn.hidden = !customized;
    }

    if (popover && !popover.hidden) {
      const existingRows = popover.querySelectorAll('.tbl-col-pop-row');
      if (existingRows.length !== colCount) {
        popover.innerHTML = renderPopoverInnerHtml(table);
      } else {
        const hiddenSet = (st && st.hiddenCols) ? st.hiddenCols : new Set();
        const widthMap = (st && st.colWidths) ? st.colWidths : new Map();
        const headRow = table.querySelector('thead tr');
        const ths = headRow ? Array.from(headRow.children) : [];
        const titleStrong = popover.querySelector('.tbl-col-pop-title strong');
        if (titleStrong) titleStrong.textContent = `Columns (${visibleCount}/${colCount})`;
        const popReset = popover.querySelector('.tbl-col-pop-reset');
        if (popReset) popReset.disabled = !customized;
        existingRows.forEach((rowEl, ci) => {
          const isHidden = hiddenSet.has(ci);
          const hasCustomW = widthMap.has(ci);
          const measuredW = ths[ci] && !isHidden ? Math.round(ths[ci].getBoundingClientRect().width || 0) : ((st && st.baseWidths && st.baseWidths[ci]) || 0);
          const dispW = hasCustomW ? `${widthMap.get(ci)}px` : (measuredW ? `${measuredW}px` : 'Auto');
          const disableHide = !isHidden && visibleCount <= 1;
          rowEl.classList.toggle('is-hidden', isHidden);
          rowEl.classList.toggle('is-resized', hasCustomW);
          const chk = rowEl.querySelector('[data-col-toggle-idx]');
          if (chk) {
            chk.checked = !isHidden;
            chk.disabled = disableHide;
          }
          const narrowBtn = rowEl.querySelector('[data-col-narrow-idx]');
          if (narrowBtn) narrowBtn.disabled = isHidden;
          const widenBtn = rowEl.querySelector('[data-col-widen-idx]');
          if (widenBtn) widenBtn.disabled = isHidden;
          const valBtn = rowEl.querySelector('[data-col-reset-w-idx]');
          if (valBtn) {
            valBtn.disabled = isHidden;
            valBtn.classList.toggle('custom', hasCustomW);
            valBtn.textContent = dispW;
            valBtn.title = hasCustomW ? 'Click to revert this column width to default' : 'Current column width';
          }
        });
      }
    }
  }

  function findOrAttachControlHost(table) {
    const wrap = table.closest('.table-wrap, .table-scroll, .rdl-table-wrap');
    if (!wrap) return null;

    // Look for an immediately preceding toolbar or header inside the same card/panel
    const prev = wrap.previousElementSibling;
    if (prev && prev.classList.contains('table-toolbar')) {
      return { host: prev.lastElementChild || prev, prepend: true };
    }
    if (prev && prev.classList.contains('col-filter-bar') && prev.previousElementSibling && prev.previousElementSibling.classList.contains('table-toolbar')) {
      const tb = prev.previousElementSibling;
      return { host: tb.lastElementChild || tb, prepend: true };
    }
    const parentCard = wrap.parentElement;
    if (parentCard) {
      const tb = parentCard.querySelector(':scope > .table-toolbar');
      if (tb) {
        return { host: tb.lastElementChild || tb, prepend: true };
      }
      const pbiHdr = parentCard.querySelector(':scope > .pbi-panel-hdr');
      if (pbiHdr) {
        return { host: pbiHdr, prepend: false };
      }
      const panelHead = parentCard.querySelector(':scope > .panel-head');
      if (panelHead) {
        return { host: panelHead, prepend: false };
      }
      const sgBar = parentCard.querySelector(':scope > .pa-subgrid-bar');
      if (sgBar) {
        const tools = sgBar.querySelector('.pa-subgrid-tools') || sgBar;
        return { host: tools, prepend: true };
      }
      const ph = parentCard.querySelector(':scope > .ph');
      if (ph) {
        return { host: ph, prepend: false };
      }
      const rdlBar = parentCard.querySelector('.rdl-toolbar-right, .rdl-tb-right');
      if (rdlBar) {
        return { host: rdlBar, prepend: true };
      }
    }
    const rdlShell = table.closest('.rdl-viewer-shell');
    if (rdlShell) {
      const rdlBar = rdlShell.querySelector('.rdl-tb-right');
      if (rdlBar && table === rdlShell.querySelector('table.rdl-table')) {
        return { host: rdlBar, prepend: true };
      }
    }
    return null;
  }

  function mountTableControls(table, idx) {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const ths = Array.from(headRow.children).filter(el => el.tagName === 'TH' || el.tagName === 'TD');
    if (ths.length < 2) return;

    const tableId = getTableId(table, idx);
    extractHeaderLabels(table);

    // 1. Enhance every <th> with a drag resizer + hover quick-actions (narrow / widen / hide)
    const thead = table.querySelector('thead');
    if (thead && thead.dataset.colMgrCaptureWired !== '1') {
      thead.dataset.colMgrCaptureWired = '1';
      thead.addEventListener('click', e => {
        if (Date.now() - lastResizeEndAt < 260 || e.target.closest('.tbl-col-resizer')) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);
    }

    ths.forEach((th, ci) => {
      th.setAttribute('data-col-idx', String(ci));
      if (!th.querySelector('.tbl-th-tools')) {
        const tools = document.createElement('span');
        tools.className = 'tbl-th-tools';
        tools.setAttribute('aria-hidden', 'true');
        tools.innerHTML =
          `<button type="button" class="tbl-th-tool-btn" data-th-narrow="${ci}" tabindex="-1" title="Narrow column (−${STEP_COL_W}px)">${ICONS.narrow}</button>` +
          `<button type="button" class="tbl-th-tool-btn" data-th-widen="${ci}" tabindex="-1" title="Widen column (+${STEP_COL_W}px)">${ICONS.widen}</button>` +
          `<button type="button" class="tbl-th-tool-btn hide" data-th-hide="${ci}" tabindex="-1" title="Hide this column">${ICONS.hide}</button>`;
        tools.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          const btn = e.target.closest('button');
          if (!btn) return;
          if (btn.hasAttribute('data-th-narrow')) {
            nudgeColumnWidth(table, ci, -STEP_COL_W);
          } else if (btn.hasAttribute('data-th-widen')) {
            nudgeColumnWidth(table, ci, STEP_COL_W);
          } else if (btn.hasAttribute('data-th-hide')) {
            toggleColumnVisible(table, ci, false);
          }
        });
        th.appendChild(tools);
      }

      if (!th.querySelector('.tbl-col-resizer')) {
        const resizer = document.createElement('span');
        resizer.className = 'tbl-col-resizer';
        resizer.setAttribute('aria-hidden', 'true');
        resizer.title = 'Drag left or right to narrow or widen column · Double-click to revert to default width';

        resizer.addEventListener('dblclick', e => {
          e.stopPropagation();
          e.preventDefault();
          lastResizeEndAt = Date.now();
          resetSingleColumnWidth(table, ci);
        });

        resizer.addEventListener('pointerdown', e => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          const st = getOrCreateState(tableId, true);
          snapshotBaseWidthsIfNeeded(table, st);
          const startX = e.clientX;
          const startW = Math.round(th.getBoundingClientRect().width || st.baseWidths[ci] || 96);
          resizer.classList.add('dragging');
          document.body.classList.add('is-col-resizing');
          try { resizer.setPointerCapture(e.pointerId); } catch (_) {}

          const onMove = moveEv => {
            const delta = moveEv.clientX - startX;
            setColumnWidth(table, ci, startW + delta);
          };
          const onUp = upEv => {
            lastResizeEndAt = Date.now();
            resizer.classList.remove('dragging');
            document.body.classList.remove('is-col-resizing');
            try { resizer.releasePointerCapture(upEv.pointerId); } catch (_) {}
            resizer.removeEventListener('pointermove', onMove);
            resizer.removeEventListener('pointerup', onUp);
            resizer.removeEventListener('pointercancel', onUp);
          };
          resizer.addEventListener('pointermove', onMove);
          resizer.addEventListener('pointerup', onUp);
          resizer.addEventListener('pointercancel', onUp);
        });

        th.appendChild(resizer);
      }
    });

    // 2. Mount toolbar "Columns" + "↺ Default" control
    const targetInfo = findOrAttachControlHost(table);
    if (targetInfo && targetInfo.host) {
      const host = targetInfo.host;
      let existing = host.querySelector(`.tbl-col-mgr-wrap[data-for-table="${CSS.escape(tableId)}"]`);
      if (!existing) {
        // Remove any stale col-mgr-wrap inside this host if table key changed (e.g. Universal Registry or 34-Table Hub tab switch)
        host.querySelectorAll(':scope > .tbl-col-mgr-wrap').forEach(el => el.remove());

        const mgr = document.createElement('div');
        mgr.className = 'tbl-col-mgr-wrap';
        mgr.setAttribute('data-for-table', tableId);
        mgr.innerHTML = `
          <button type="button" class="btn btn-ghost-bar tbl-col-inline-reset" data-col-inline-reset="${esc(tableId)}" hidden title="Revert hidden columns and column widths back to default">
            ${ICONS.reset}<span>Default</span>
          </button>
          <button type="button" class="btn btn-ghost-bar tbl-col-trigger-btn" data-col-trigger="${esc(tableId)}" aria-haspopup="dialog" aria-expanded="false" title="Hide or show columns &amp; widen or narrow column widths">
            ${ICONS.cols}<span class="tbl-col-btn-lbl">Columns</span>
          </button>
          <div class="tbl-col-popover" data-col-popover="${esc(tableId)}" hidden></div>
        `;

        const triggerBtn = mgr.querySelector('.tbl-col-trigger-btn');
        const inlineResetBtn = mgr.querySelector('.tbl-col-inline-reset');
        const popover = mgr.querySelector('.tbl-col-popover');

        triggerBtn.addEventListener('click', e => {
          e.stopPropagation();
          const willOpen = popover.hidden;
          closeAllColumnPopovers(willOpen ? tableId : '');
          if (willOpen) {
            openPopoverTableId = tableId;
            popover.innerHTML = renderPopoverInnerHtml(table);
            popover.hidden = false;
            triggerBtn.setAttribute('aria-expanded', 'true');
          }
        });

        inlineResetBtn.addEventListener('click', e => {
          e.stopPropagation();
          resetTableToDefault(table);
        });

        popover.addEventListener('click', e => {
          e.stopPropagation();
          const resetBtn = e.target.closest('[data-col-pop-reset]');
          if (resetBtn) {
            resetTableToDefault(table);
            return;
          }
          const narrowBtn = e.target.closest('[data-col-narrow-idx]');
          if (narrowBtn) {
            const ci = Number(narrowBtn.getAttribute('data-col-narrow-idx'));
            nudgeColumnWidth(table, ci, -STEP_COL_W);
            return;
          }
          const widenBtn = e.target.closest('[data-col-widen-idx]');
          if (widenBtn) {
            const ci = Number(widenBtn.getAttribute('data-col-widen-idx'));
            nudgeColumnWidth(table, ci, STEP_COL_W);
            return;
          }
          const resetWBtn = e.target.closest('[data-col-reset-w-idx]');
          if (resetWBtn) {
            const ci = Number(resetWBtn.getAttribute('data-col-reset-w-idx'));
            resetSingleColumnWidth(table, ci);
          }
        });

        popover.addEventListener('change', e => {
          e.stopPropagation();
          const chk = e.target.closest('[data-col-toggle-idx]');
          if (chk) {
            const ci = Number(chk.getAttribute('data-col-toggle-idx'));
            toggleColumnVisible(table, ci, chk.checked);
          }
        });

        if (targetInfo.prepend && host.firstChild) {
          host.insertBefore(mgr, host.firstChild);
        } else {
          host.appendChild(mgr);
        }
        existing = mgr;
      }

      if (openPopoverTableId === tableId) {
        const pop = existing.querySelector('.tbl-col-popover');
        const trig = existing.querySelector('.tbl-col-trigger-btn');
        if (pop && trig) {
          pop.innerHTML = renderPopoverInnerHtml(table);
          pop.hidden = false;
          trig.setAttribute('aria-expanded', 'true');
        }
      }
    }

    // 3. Apply any active in-memory column state for this table
    applyTableColumnState(table);
  }

  function closeAllColumnPopovers(exceptTableId) {
    document.querySelectorAll('.tbl-col-mgr-wrap').forEach(wrap => {
      const tid = wrap.getAttribute('data-for-table') || '';
      if (exceptTableId && tid === exceptTableId) return;
      const pop = wrap.querySelector('.tbl-col-popover');
      const trig = wrap.querySelector('.tbl-col-trigger-btn');
      if (pop) pop.hidden = true;
      if (trig) trig.setAttribute('aria-expanded', 'false');
    });
    if (!exceptTableId) openPopoverTableId = '';
  }

  function ensureGlobalListeners() {
    if (globalListenersWired) return;
    globalListenersWired = true;
    document.addEventListener('click', e => {
      if (!openPopoverTableId) return;
      if (!e.target.closest('.tbl-col-mgr-wrap')) {
        closeAllColumnPopovers('');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && openPopoverTableId) {
        closeAllColumnPopovers('');
      }
    });
  }

  function enhanceAllTables(rootContainer, stateObj) {
    ensureGlobalListeners();
    if (stateObj) {
      const nextSig = buildScopeSignature(stateObj);
      if (currentScopeSig && currentScopeSig !== nextSig) {
        // User navigated to a different view / table / system view -> automatically revert back to default
        TABLE_COL_STATE.clear();
        openPopoverTableId = '';
      }
      currentScopeSig = nextSig;
    }

    const root = rootContainer || document;
    const selector = 'table.ledger-table, table.m-grid, table.rdl-table';
    const tables = Array.from(root.querySelectorAll(selector)).filter(t => {
      if (t.id === 'kioskRecentTable' || t.id === 'kioskAttFeedTable') return false;
      if (t.closest('.thermal-paper-roll')) return false;
      return Boolean(t.querySelector('thead tr th'));
    });

    tables.forEach((table, idx) => {
      mountTableControls(table, idx);
    });
  }

  window.MFG_TABLE_COLS = {
    enhanceAllTables,
    toggleColumnVisible,
    setColumnWidth,
    nudgeColumnWidth,
    resetSingleColumnWidth,
    resetTableToDefault,
    resetAllTablesToDefault,
    getStateForTable: table => table ? getOrCreateState(table.dataset.colMgrId, false) : null
  };
})();
