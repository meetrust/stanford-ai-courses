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
    const svgEdges = [...document.querySelectorAll('#depfig path.flowchart-link')].map(pth => { const m = pth.id.match(/L_([A-Za-z0-9]+)_([A-Za-z0-9]+)_\d+$/); return m ? m[1] + '>' + m[2] + (/dotted/.test(pth.getAttribute('class')) ? '?' : '') : '?'; }).sort().join(',');
    const listEdges = edges.map(e => e.f + '>' + e.t + (e.opt ? '?' : '')).sort().join(',');
    if (svgEdges !== listEdges) out.data.push('graph edges VS list: ' + svgEdges + ' VS ' + listEdges);
    // ---- 3. element sizes by role ----
    const groups = { 'tile .el': '.el', 'btn': '.dos-act .btn', 'rel chip': '.rel', 'track-chip': '.track-chip', 'lvl': '.lvl', 'status pill': '.st', 'tk': '.tk', 'spec chip': '.specs div', 'filter btn': '.fbtn', 'phase node': '.phases .pn', 'metro stop': '.stops i', 'node box': '#depfig g.node rect', 'edge label': '#depfig g.edgeLabel p' };
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
    return out;
  });
  console.log('== TEXT ==\n' + (r.text.join('\n') || 'none'));
  console.log('== DATA ==\n' + (r.data.join('\n') || 'none'));
  console.log('== SIZES (heights px) ==');
  Object.entries(r.sizes).forEach(([k, v]) => console.log('  ' + k.padEnd(14) + v));
  console.log('== TRUNCATED ==\n' + (r.trunc.join('\n') || 'none'));
  console.log('== ICON BOXES ==');
  Object.entries(r.icons).forEach(([k, v]) => console.log('  ' + k.padEnd(14) + v));
  await b.close();
})();
