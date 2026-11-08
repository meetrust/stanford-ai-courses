// Text + data + size audit for the course map page (run against a local copy with local Mermaid).
const { chromium } = require('playwright');
const url = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +(process.argv[3] || 1440), height: 900 } });
  await p.goto(url); await p.waitForTimeout(3500);
  const r = await p.evaluate(() => {
    const out = { text: [], data: [], sizes: {} };
    // ---- 1. text lint over visible text nodes (outside the Mermaid svg) ----
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement.closest('svg, script, style, pre')) continue;
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (!t || seen.has(t)) continue; seen.add(t);
      const add = (k) => out.text.push(k + ' :: ' + t);
      if (/[一-鿿][A-Za-z0-9]|[A-Za-z0-9][一-鿿]/.test(t)) add('CJK-Latin no space');
      if (/[一-鿿][,:;!?()]|[,:;!?(][一-鿿]/.test(t)) add('half-width punct');
      if (/"/.test(t)) add('ASCII quote');
      if (/  /.test(t)) add('double space');
      if (/[一-鿿][ \u00a0\u3000]+[一-鿿]/.test(t)) add('space between CJK');
      if (/[^\s，。、；：！？）」”》][ \u00a0]+[，。、；：！？）」”》]|[，。、；：！？）」”》][ \u00a0]+[^\s·（「“《]|[（「“《][ \u00a0]+\S/.test(t)) add('space next to full-width punct');
      if (/[▶↗↑⇢→]/.test(t)) add('glyph icon');
    }
    // ---- 2. cross-section data consistency ----
    const codes = ['CS221','CS229','CS336','CS229M','CS230','CS234','CS224U','CS224N','CME295','CS236'];
    codes.forEach(c => {
      const id = 'c-' + c.toLowerCase();
      const tile = document.querySelector('.el[href="#' + id + '"]');
      const dos = document.getElementById(id);
      const row = [...document.querySelectorAll('#matrix tbody tr')].find(tr => tr.querySelector('th').textContent.trim() === c);
      const tUnits = [...tile.querySelector('.el-head').childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim();
      const dUnits = [...dos.querySelectorAll('.specs div')].find(d => d.querySelector('dt').textContent === 'UNITS').querySelector('dd').textContent.trim();
      const mUnits = row.querySelector('td.units').textContent.trim();
      const dTerm = [...dos.querySelectorAll('.specs div')].find(d => d.querySelector('dt').textContent === 'TERM').querySelector('dd').textContent.trim();
      const mTerm = row.children[3].textContent.trim();
      const tVideo = tile.querySelectorAll('.el-av i')[0].classList.contains('on');
      const tCode = tile.querySelectorAll('.el-av i')[1].classList.contains('on');
      const dVideo = dos.dataset.video === '1', dCode = dos.dataset.code === '1';
      const mVideo = !!row.children[5].querySelector('a'), mCode = !!row.children[6].querySelector('a');
      const bVideo = !!dos.querySelector('.dos-act a.btn.video'), bCode = !!dos.querySelector('.dos-act a.btn:not(.video)');
      const dNo = dos.querySelector('.dos-no').textContent.replace('NO.', ''), tNo = tile.querySelector('.el-head b').textContent;
      const urlsD = [...dos.querySelectorAll('.dos-act a')].map(a => a.href).sort().join('|');
      const urlsM = [...row.querySelectorAll('a')].map(a => a.href).sort().join('|');
      const chk = (k, ok, info) => { if (!ok) out.data.push(c + ' ' + k + ' ' + (info || '')); };
      chk('units', tUnits === dUnits && dUnits === mUnits, [tUnits, dUnits, mUnits].join(' / '));
      chk('term', dTerm === mTerm, dTerm + ' / ' + mTerm);
      chk('video flag', tVideo === dVideo && dVideo === mVideo && mVideo === bVideo);
      chk('code flag', tCode === dCode && dCode === mCode && mCode === bCode);
      chk('number', dNo === tNo, dNo + ' / ' + tNo);
      chk('urls', urlsD === urlsM, urlsD + ' VS ' + urlsM);
      const trackD = getComputedStyle(dos).getPropertyValue('--c').trim(), trackT = getComputedStyle(tile).getPropertyValue('--c').trim(), trackM = getComputedStyle(row).getPropertyValue('--c').trim();
      chk('track colour', trackD === trackT && trackT === trackM, [trackD, trackT, trackM].join(' / '));
    });
    // relations vs graph edges
    const edges = [...document.querySelectorAll('#edgeList button')].map(b => ({ f: b.dataset.f, t: b.dataset.t, opt: b.closest('li').classList.contains('opt') }));
    codes.forEach(c => {
      const dos = document.getElementById('c-' + c.toLowerCase());
      const dd = dos.querySelectorAll('.rels dd');
      const pre = [...dd[0].querySelectorAll('.rel')].map(a => a.textContent + (a.classList.contains('opt') ? '?' : '')).sort().join(',');
      const nxt = [...dd[1].querySelectorAll('.rel')].map(a => a.textContent + (a.classList.contains('opt') ? '?' : '')).sort().join(',');
      const gPre = edges.filter(e => e.t === c).map(e => e.f + (e.opt ? '?' : '')).sort().join(',');
      const gNxt = edges.filter(e => e.f === c).map(e => e.t + (e.opt ? '?' : '')).sort().join(',');
      if (pre !== gPre) out.data.push(c + ' 前置 ' + pre + ' VS graph ' + gPre);
      if (nxt !== gNxt) out.data.push(c + ' 后续 ' + nxt + ' VS graph ' + gNxt);
    });
    // graph svg edges vs edge list
    const svgEdges = [...document.querySelectorAll('#depfig .cg-edges path.e')].map(pth => pth.dataset.f + '>' + pth.dataset.t + (pth.classList.contains('dash') ? '?' : '')).sort().join(',');
    const labelEdges = [...document.querySelectorAll('#depfig .cg-label')].map(l => l.dataset.f + '>' + l.dataset.t + (l.classList.contains('dash') ? '?' : '')).sort().join(',');
    const listEdges = edges.map(e => e.f + '>' + e.t + (e.opt ? '?' : '')).sort().join(',');
    if (svgEdges !== listEdges) out.data.push('graph edges VS list: ' + svgEdges + ' VS ' + listEdges);
    if (labelEdges !== listEdges) out.data.push('graph labels VS list: ' + labelEdges + ' VS ' + listEdges);
    // ---- 3. element sizes by role ----
    const groups = { 'tile .el': '.el', 'btn': '.dos-act .btn', 'rel chip': '.rel', 'track-chip': '.track-chip', 'lvl': '.lvl', 'status pill': '.st', 'tk': '.tk', 'spec chip': '.specs div', 'filter btn': '.fbtn', 'phase node': '.phases .pn', 'metro stop': '.stops i', 'node box': '#depfig .cg-node', 'edge label': '#depfig .cg-label' };
    Object.entries(groups).forEach(([k, sel]) => {
      const hs = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null || e.closest('svg')).map(e => Math.round(e.getBoundingClientRect().height));
      out.sizes[k] = [...new Set(hs)].sort((a, b) => a - b).join(',') + '  (n=' + hs.length + ')';
    });
    const ic = {};
    document.querySelectorAll('.el-av .i, .legend-row .k .i, .btn .ic .i, .btn .ext .i, .st .i, .edges .ar .i, .totop .i, .nav .n').forEach(e => {
      const k = (e.closest('.el-av') ? 'tile' : e.closest('.legend-row') ? 'legend' : e.closest('.ic') ? 'btn-ic' : e.closest('.ext') ? 'btn-ext' : e.closest('.st') ? 'pill' : e.closest('.ar') ? 'edge-arrow' : e.closest('.totop') ? 'totop' : 'nav-num');
      const r = e.getBoundingClientRect();
      (ic[k] = ic[k] || new Set()).add(Math.round(r.width) + 'x' + Math.round(r.height));
    });
    out.trunc = [...document.querySelectorAll('.btn .lbl small, .el-name, .stops small, .lvl, .track-chip')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
    out.icons = Object.fromEntries(Object.entries(ic).map(([k, v]) => [k, [...v].join(' ')]));
    // ---- visible text below 12px (brand mark and nav numbers excepted), SVG text measured after scaling ----
    out.small = [];
    { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t;
      while ((t = w.nextNode())) {
        const p = t.parentElement; if (!p || !t.nodeValue.trim() || p.closest('script,style,.sr-only,.brand-mark,.n')) continue;
        const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || !p.getBoundingClientRect().width) continue;
        let fs = parseFloat(s.fontSize); if (p.ownerSVGElement) fs *= p.getScreenCTM().a;
        if (fs < 11.95) out.small.push(fs.toFixed(1) + 'px :: ' + t.nodeValue.trim().slice(0, 20));
      } }
    // ---- single-character last lines in Chinese text (vertical labels excepted) ----
    out.orphans = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!/block|list-item|table-cell|flex|grid/.test(cs.display) || cs.writingMode !== 'horizontal-tb' || !el.getBoundingClientRect().width) continue;
      if (![...el.childNodes].some(k => k.nodeType === 3 && k.nodeValue.trim())) continue;
      const lines = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t;
      while ((t = w.nextNode())) {
        let q = t.parentElement, nested = false;
        while (q && q !== el) { if (/block|list-item|table|flex|grid/.test(getComputedStyle(q).display)) { nested = true; break; } q = q.parentElement; }
        if (nested) continue;
        for (let i = 0; i < t.nodeValue.length; i++) {
          const c = t.nodeValue[i]; if (/\s/.test(c)) continue;
          const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getClientRects()[0]; if (!b || !b.width) continue;
          const y = Math.round(b.top + b.height / 2), L = lines[lines.length - 1];
          if (L && Math.abs(L.y - y) < 6) L.s += c; else lines.push({ y, s: c });
        }
      }
      if (lines.length < 2) continue;
      const core = lines[lines.length - 1].s.replace(/[，。、；：！？）」”》,.;:!?)\]]/g, '');
      if (core.length === 1 && /[一-鿿]/.test(core)) out.orphans.push(lines[lines.length - 2].s.slice(-10) + ' | ' + lines[lines.length - 1].s);
    }
    // ---- glyph icons hidden in CSS: content of ::before / ::after / ::marker and list-style strings ----
    // Reads every rule through the CSSOM, so escapes such as content: "\25B6" and rules that match
    // nothing right now (hover, hidden states) are caught too; then checks what is actually rendered.
    out.cssGlyphs = [];
    { const GLYPH = /[←-⇿⌀-⏿─-➿⟰-⟿⤀-⥿⬀-⯿️]|[\u{1F000}-\u{1FAFF}]/u;
      const props = ['content', 'list-style-type', 'list-style'];
      const walk = (rules, where) => { for (const rule of rules) {
        if (rule.cssRules) walk(rule.cssRules, where);
        if (!rule.style) continue;
        for (const prop of props) {
          const v = rule.style.getPropertyValue(prop);
          if (v && GLYPH.test(v)) out.cssGlyphs.push(where + ' ' + (rule.selectorText || rule.cssText.split('{')[0].trim()) + ' { ' + prop + ': ' + v + ' }');
        }
      } };
      for (const sh of document.styleSheets) {
        const where = sh.href ? sh.href.split('/').pop() : '<style>';
        let rules; try { rules = sh.cssRules; } catch (e) { if (!/fonts\.googleapis/.test(sh.href || '')) out.cssGlyphs.push('unreadable stylesheet ' + sh.href); continue; }
        walk(rules, where);
      }
      for (const el of document.querySelectorAll('[style]')) for (const prop of props) {
        const v = el.style.getPropertyValue(prop);
        if (v && GLYPH.test(v)) out.cssGlyphs.push('inline style on <' + el.tagName.toLowerCase() + '> { ' + prop + ': ' + v + ' }');
      }
      const rendered = {};
      for (const el of document.querySelectorAll('body *')) for (const ps of ['::before', '::after', '::marker']) {
        const v = getComputedStyle(el, ps).content;
        if (v && v !== 'none' && v !== 'normal' && GLYPH.test(v)) {
          const k = el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : '') + ps + ' ' + v;
          rendered[k] = (rendered[k] || 0) + 1;
        }
      }
      Object.entries(rendered).forEach(([k, n]) => out.cssGlyphs.push('rendered ' + k + ' ×' + n));
    }
    return out;
  });
  console.log('== TEXT ==\n' + (r.text.join('\n') || 'none'));
  console.log('== SMALL TEXT (<12px) ==\n' + (r.small.join('\n') || 'none'));
  console.log('== ORPHAN LINES ==\n' + (r.orphans.join('\n') || 'none'));
  console.log('== CSS GLYPHS (pseudo-element content, list-style) ==\n' + (r.cssGlyphs.join('\n') || 'none'));
  console.log('== DATA ==\n' + (r.data.join('\n') || 'none'));
  console.log('== SIZES (heights px) ==');
  Object.entries(r.sizes).forEach(([k, v]) => console.log('  ' + k.padEnd(14) + v));
  console.log('== TRUNCATED ==\n' + (r.trunc.join('\n') || 'none'));
  console.log('== ICON BOXES ==');
  Object.entries(r.icons).forEach(([k, v]) => console.log('  ' + k.padEnd(14) + v));
  await b.close();
})();
