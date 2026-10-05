/* ============================================================
   core.js — 数据层 / GitHub API / 权限 / 解析 / 统计 / UI
   全局对象 window.App
   ============================================================ */
(function () {
  const LS = {
    owner: 'lc_github_owner', repo: 'lc_github_repo', branch: 'lc_github_branch',
    token: 'lc_github_token', localData: 'lc_local_data_'
  };

  // 安全存储：localStorage 不可用（隐私模式等）时降级为内存
  const memStore = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return k in memStore ? memStore[k] : null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { memStore[k] = String(v); return false; } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { delete memStore[k]; } }
  };

  const App = {
    cfg: { owner: '', repo: '', branch: 'main', token: '' },
    data: { settings: null, customers: null, daily: null, recordings: null },
    online: false,   // 是否能通过 http 加载数据
    ready: false
  };
  window.App = App;
  App.store = store;

  /* ---------------- 小工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  App.$ = $; App.$$ = $$;

  App.pad = n => String(n).padStart(2, '0');
  App.todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}-${App.pad(d.getDate())}`;
  };
  App.weekday = (dateStr) => {
    const d = dateStr ? new Date(dateStr.replace(/-/g, '/')) : new Date();
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  };
  App.nowStr = () => {
    const d = new Date();
    return `${App.todayStr()} ${App.pad(d.getHours())}:${App.pad(d.getMinutes())}`;
  };
  App.esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  App.initial = name => (name || '?').trim().charAt(0);

  // 把微信里的模糊时间规范化为 YYYY-MM-DD HH:mm
  App.normTime = (t, baseDate) => {
    if (!t) return App.nowStr();
    t = t.trim()
      .replace(/[年月./]/g, '-').replace(/日/g, ' ')
      .replace(/-+/g, '-').replace(/\s+/g, ' ');
    const today = App.todayStr();
    const year = today.slice(0, 4);
    // 形如 “0928 -11:24 / 0928-11:24”：4 位月日 + 时分
    const q0 = t.match(/(\d{4})\s*-\s*(\d{1,2}):(\d{2})(?!\d)/);
    if (q0 && !/^\d{4}-\d{1,2}-\d{1,2}/.test(t)) {
      return `${year}-${q0[1].slice(0, 2)}-${q0[1].slice(2, 4)} ${App.pad(+q0[2])}:${q0[3]}`;
    }
    if (/今天|今日/.test(t)) t = t.replace(/今天|今日/, today);
    else if (/明天|明日/.test(t)) {
      const d = new Date(); d.setDate(d.getDate() + 1);
      t = t.replace(/明天|明日/, `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}-${App.pad(d.getDate())}`);
    } else if (/昨天|昨日/.test(t)) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      t = t.replace(/昨天|昨日/, `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}-${App.pad(d.getDate())}`);
    }
    let m = t.match(/(\d{1,2})-(\d{1,2})(?:\s|$)/);
    if (m && !/^\d{4}/.test(t.trim())) t = `${year}-${App.pad(+m[1])}-${App.pad(+m[2])} ` + t.replace(m[0], '');
    m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return App.nowStr();
    let rest = t.replace(/^\s*\d{4}-\d{1,2}-\d{1,2}/, '').trim();
    rest = /^\d{1,2}:\d{1,2}/.test(rest) ? rest : (rest || '09:00');
    return `${m[1]}-${App.pad(+m[2])}-${App.pad(+m[3])} ${rest}`;
  };
  App.dateOf = t => (t || '').slice(0, 10);

  /* ---------------- 配置 / 权限 ---------------- */
  App.loadCfg = function () {
    App.cfg.owner = store.get(LS.owner) || '';
    App.cfg.repo = store.get(LS.repo) || '';
    App.cfg.branch = store.get(LS.branch) || 'main';
    App.cfg.token = store.get(LS.token) || '';
  };
  App.isEditor = () => !!App.cfg.token;
  App.canSaveRemote = () => App.cfg.token && App.cfg.owner && App.cfg.repo;

  /* ---------------- 数据加载 ---------------- */
  async function fetchJson(path) {
    const res = await fetch(path + (path.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  const FILES = {
    settings: 'data/settings.json',
    customers: 'data/customers.json',
    daily: 'data/daily.json',
    recordings: 'data/recordings.json'
  };

  App.boot = async function () {
    App.loadCfg();
    const jobs = Object.keys(FILES).map(async key => {
      try {
        App.data[key] = await fetchJson(FILES[key]);
        App.online = true;
      } catch (e) {
        // file:// 本地预览：回退 localStorage
        const raw = store.get(LS.localData + key);
        App.data[key] = raw ? JSON.parse(raw) : defaultData(key);
      }
    });
    await Promise.all(jobs);
    if (!App.data.settings) App.data.settings = defaultData('settings');
    App.ready = true;
    App.renderChrome();
    document.dispatchEvent(new CustomEvent('app:ready'));
    App.flushPending();   // 网络恢复后自动补提交暂存的数据
  };

  function defaultData(key) {
    if (key === 'settings') return {
      projectName: '龙城·营峰天境', owner: '', repo: 'longcheng-crm', branch: 'main',
      staff: ['线上运营专员', '线下推广专员', '专职置业顾问', '财务专员', '办证专员'],
      sources: ['抖音', '微信', '老带新', '自然到访', '渠道推荐', '其他'],
      stages: ['新线索', '已邀约', '已首访', '方案沟通', '再访跟进', '逼定中', '已成交', '已流失'],
      levels: ['A', 'B', 'C'], feishuUrl: '', updatedAt: ''
    };
    if (key === 'customers') return { customers: [], seq: 0 };
    if (key === 'daily') return { days: {}, forcedPlans: [] };
    return { recordings: [] };
  }

  /* ---------------- 保存：GitHub API 或本地 ---------------- */
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  App.githubApi = async function (path, options) {
    options = options || {};
    const tries = options.tries != null ? options.tries : 2;
    let lastErr;
    for (let i = 0; i <= tries; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch('https://api.github.com' + path, {
          method: options.method || 'GET',
          headers: Object.assign({
            'Authorization': 'Bearer ' + App.cfg.token,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }, options.headers),
          body: options.body,
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!res.ok) {
          let msg = 'GitHub API 错误 ' + res.status;
          try { const j = await res.json(); msg = j.message || msg; } catch (e) {}
          const retriable = res.status === 409 || res.status === 429 || res.status >= 500;
          if (!retriable || i === tries) throw new Error(msg);
          lastErr = new Error(msg);
        } else {
          return res.status === 204 ? null : await res.json();
        }
      } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') e = new Error('连接 GitHub 超时（当前网络较慢）');
        lastErr = e;
        if (i === tries) throw e;
      }
      await new Promise(r => setTimeout(r, 700 * (i + 1)));
    }
    throw lastErr;
  };

  // 统一可靠文件提交：杜绝“GET 超时被误判文件不存在 → PUT 缺 sha → 422 永久失败”
  App.commitFile = async function (file, content, message) {
    const owner = App.cfg.owner, repo = App.cfg.repo, branch = App.cfg.branch;
    let lastErr;
    for (let round = 0; round < 4; round++) {
      // 1) 取当前 sha：只有明确 404 才视为新文件
      let sha = null, exists = true;
      try {
        const cur = await App.githubApi(
          `/repos/${owner}/${repo}/contents/${file}?ref=${branch}`, { tries: 2 });
        sha = cur.sha;
      } catch (e) {
        if (/Not Found|404/i.test(e.message)) { exists = false; }
        else { lastErr = e; await new Promise(r => setTimeout(r, 700 * (round + 1))); continue; }
      }
      // 2) 提交（sha 缺失/过期/冲突会在下一轮重新 GET）
      try {
        const payload = { message, content: toBase64(content), branch };
        if (exists) payload.sha = sha;
        await App.githubApi(`/repos/${owner}/${repo}/contents/${file}`, {
          method: 'PUT', tries: 1, body: JSON.stringify(payload)
        });
        return true;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 700 * (round + 1)));
      }
    }
    throw lastErr || new Error('提交失败');
  };

  // 待同步队列：API 暂时失败时留存，网络恢复后自动补提交
  const PENDING_KEY = 'lc_pending_sync';
  App.queuePending = function (key, content, errMsg) {
    let q = [];
    try { q = JSON.parse(store.get(PENDING_KEY) || '[]'); } catch (e) {}
    q = q.filter(x => x.key !== key);
    q.push({ key, content, ts: App.nowStr(), lastError: errMsg || '' });
    store.set(PENDING_KEY, JSON.stringify(q));
  };
  // 记录某条待同步项的最新失败原因
  App.markPendingError = function (key, msg) {
    let q = [];
    try { q = JSON.parse(store.get(PENDING_KEY) || '[]'); } catch (e) { return; }
    const it = q.find(x => x.key === key);
    if (it) { it.lastError = msg || ''; it.ts = App.nowStr(); store.set(PENDING_KEY, JSON.stringify(q)); }
  };
  App.removePending = function (key) {
    let q = [];
    try { q = JSON.parse(store.get(PENDING_KEY) || '[]'); } catch (e) {}
    q = q.filter(x => x.key !== key);
    store.set(PENDING_KEY, JSON.stringify(q));
  };
  App.pendingCount = function () {
    try { return JSON.parse(store.get(PENDING_KEY) || '[]').length; } catch (e) { return 0; }
  };
  // 防回滚：仓库版本若比队列快照更新（客户 seq 更大 / 录音更多），丢弃旧快照而非覆盖
  App.pendingConflictGuard = async function (file, item) {
    try {
      const cur = await App.githubApi(
        `/repos/${App.cfg.owner}/${App.cfg.repo}/contents/${file}?ref=${App.cfg.branch}`, { tries: 2 });
      const bytes = Uint8Array.from(atob(cur.content), c => c.charCodeAt(0));
      const repoObj = JSON.parse(new TextDecoder().decode(bytes));
      const pendObj = JSON.parse(item.content);
      if (file === FILES.customers)
        return (+repoObj.seq || 0) > (+pendObj.seq || 0) || repoObj.customers.length > pendObj.customers.length;
      if (file === FILES.recordings)
        return (repoObj.recordings || []).length > (pendObj.recordings || []).length;
    } catch (e) { /* 取不到不拦截，交给 commitFile */ }
    return false;
  };

  App.flushPending = async function (opts) {
    opts = opts || {};
    if (!App.canSaveRemote()) {
      if (opts.manual) App.toast('未配置 GitHub 连接，请先到设置页保存令牌', 'warn');
      return { flushed: 0, failed: 0, errors: [] };
    }
    let q = [];
    try { q = JSON.parse(store.get(PENDING_KEY) || '[]'); } catch (e) { return { flushed: 0, failed: 0, errors: [] }; }
    if (!q.length) {
      if (opts.manual) App.toast('没有待同步的数据', 'success');
      return { flushed: 0, failed: 0, errors: [] };
    }
    let flushed = 0, failed = 0; const errs = [];
    for (const item of q.slice()) {
      const file = FILES[item.key];
      if (!file) { App.markPendingError(item.key, '未知数据类型'); errs.push(item.key + '：未知数据类型'); failed++; continue; }
      try {
        if (await App.pendingConflictGuard(file, item)) {
          App.removePending(item.key);
          errs.push(item.key + '：仓库数据已更新，自动跳过旧版本');
          continue;
        }
        await App.commitFile(file, item.content, `sync: 补同步${item.key} ${App.nowStr()}`);
        App.removePending(item.key);
        flushed++;
      } catch (e) {
        App.markPendingError(item.key, e.message);
        errs.push(item.key + '：' + e.message);
        failed++;
      }
    }
    if (flushed) App.toast(`已补同步 ${flushed} 项` + (failed ? `，${failed} 项仍失败（原因见设置页）` : ''), failed ? 'warn' : 'success');
    else if (failed) App.toast('同步失败：' + (errs[0] || '').slice(0, 40), 'warn');
    if (typeof App.renderChrome === 'function') App.renderChrome();
    return { flushed, failed, errors: errs };
  };

  // 保存一个数据键
  App.saveData = async function (key) {
    const obj = App.data[key];
    if (key === 'settings') obj.updatedAt = App.nowStr();
    const file = FILES[key];
    const content = JSON.stringify(obj, null, 2);
    if (App.canSaveRemote()) {
      try {
        await App.commitFile(file, content, `data: 更新${key} ${App.nowStr()}`);
        App.removePending(key);
      } catch (e) {
        App.queuePending(key, content, e.message);   // 数据留存本机，稍后自动补同步
        throw e;
      }
    } else {
      store.set(LS.localData + key, content);
    }
    return true;
  };

  // 保存全部（客户/日报/录音常一起变动）
  App.saveAll = async function (keys) {
    keys = keys || ['customers', 'daily', 'recordings', 'settings'];
    for (const k of keys) await App.saveData(k);
  };

  /* ---------------- UI：Toast / Modal / Confirm ---------------- */
  App.toast = function (msg, type) {
    let wrap = $('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>'
    };
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = (icons[type] || '') + '<span>' + App.esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2400);
  };

  App.openModal = function (title, bodyHtml) {
    let mask = $('#app-modal');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'app-modal'; mask.className = 'modal-mask';
      mask.innerHTML = '<div class="modal"><div class="modal-head"><h3></h3><button class="icon-btn" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div class="modal-body"></div></div>';
      document.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask || e.target.closest('[data-close]')) App.closeModal(); });
    }
    mask.querySelector('h3').textContent = title;
    mask.querySelector('.modal-body').innerHTML = bodyHtml;
    mask.classList.add('show');
    return mask;
  };
  App.closeModal = function () { const m = $('#app-modal'); if (m) m.classList.remove('show'); };

  App.confirm = function (msg) {
    return new Promise(resolve => {
      const mask = App.openModal('请确认',
        '<p style="color:var(--text-2);font-size:.92rem">' + App.esc(msg) + '</p>' +
        '<div class="modal-foot"><button class="btn" data-no>取消</button><button class="btn btn-primary" data-yes>确定</button></div>');
      mask.querySelector('[data-no]').onclick = () => { App.closeModal(); resolve(false); };
      mask.querySelector('[data-yes]').onclick = () => { App.closeModal(); resolve(true); };
    });
  };

  /* ---------------- 导航外壳状态 ---------------- */
  App.renderChrome = function () {
    const pill = $('.mode-pill');
    if (pill) {
      if (App.isEditor()) {
        pill.classList.add('editor');
        pill.innerHTML = '<span class="dot"></span>可编辑';
      } else {
        pill.classList.remove('editor');
        pill.innerHTML = '<span class="dot"></span>只读模式';
      }
    }
    // 待同步提示（有数据暂存本机时显示，点击立即重试）
    const navRight = $('.nav-right');
    let pendEl = navRight ? $('.pending-pill', navRight) : null;
    const pc = App.pendingCount();
    if (pc > 0 && navRight) {
      if (!pendEl) {
        pendEl = document.createElement('a');
        pendEl.className = 'pending-pill';
        pendEl.addEventListener('click', async () => {
          if (pendEl.dataset.busy === '1') return;
          pendEl.dataset.busy = '1';
          pendEl.textContent = '同步中…';
          await App.flushPending({ manual: true });
          pendEl.dataset.busy = '';
          App.renderChrome();
        });
        navRight.insertBefore(pendEl, pill);
      }
      pendEl.textContent = '待同步 ' + pc;
    } else if (pendEl) pendEl.remove();
    // 非编辑者：禁用所有 [data-edit] 元素
    if (!App.isEditor()) {
      $$('[data-edit]').forEach(el => {
        el.setAttribute('disabled', 'disabled');
        el.classList.add('locked');
        el.title = '只读模式：仅管理员可编辑';
      });
    }
  };

  App.requireEditor = function () {
    if (!App.isEditor()) {
      App.toast('请先到「设置」页填写 GitHub 令牌解锁编辑', 'error');
      setTimeout(() => { location.href = 'settings.html'; }, 1200);
      return false;
    }
    return true;
  };

  App.stageBadge = function (s) {
    const map = { '新线索': 'cyan', '已邀约': 'purple', '已首访': 'blue', '方案沟通': 'blue', '再访跟进': 'orange', '逼定中': 'gold', '已成交': 'green', '已流失': 'red' };
    return s ? `<span class="badge ${map[s] || ''}">${App.esc(s)}</span>` : '';
  };
  App.levelBadge = function (l) {
    const map = { A: 'red', B: 'orange', C: 'cyan' };
    return l ? `<span class="badge ${map[l] || ''}">${l}类</span>` : '';
  };
  App.customerRow = function (c) {
    return `<a class="customer-row" href="customer.html?id=${c.id}">
      <span class="avatar lv-${c.intentLevel || ''}">${App.esc(App.initial(c.name))}</span>
      <span class="cr-main">
        <span class="cr-name">${App.esc(c.name)} ${App.levelBadge(c.intentLevel)} ${App.stageBadge(c.stage)}</span>
        <span class="cr-sub">到访${c.visitCount}次 · ${App.esc(c.source || '来源未知')} · ${App.esc(c.intentProduct || '意向未定')}</span>
      </span>
      <span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></span>
    </a>`;
  };

  /* ---------------- 微信报备文本解析 ---------------- */
  const REPORT_TYPES = {
    info: {
      key: 'info', name: '信息报备',
      re: [/信息报备/], not: [/转换/, /首访/, /再访/],
      fields: [
        ['code', ['信息编码']], ['source', ['信息来源']], ['name', ['客户姓名']],
        ['phone', ['客户电话']], ['wechat', ['客户微信']], ['intent', ['客户意向']],
        ['reporter', ['报备人员']], ['time', ['报备时间']]
      ]
    },
    convert: {
      key: 'convert', name: '转换报备',
      re: [/信息转换报备/, /转换报备/], not: [],
      fields: [
        ['code', ['信息编码']], ['inviteForm', ['邀约形式']], ['inviteCount', ['邀约次数']],
        ['planVisitTime', ['拟访时间']], ['operator', ['邀约人员']], ['time', ['邀约时间']]
      ]
    },
    firstVisit: {
      key: 'firstVisit', name: '首访报备',
      re: [/首访报备/], not: [],
      fields: [
        ['code', ['到访编码']], ['source', ['信息来源']], ['name', ['客户姓名']],
        ['phone', ['客户电话']], ['wechat', ['客户微信']], ['time', ['首访时间']],
        ['profession', ['客户职业']], ['profile', ['客户画像']], ['intent', ['客户意向']],
        ['level', ['意向等级']], ['receiver', ['首访接待', '首防接待']]
      ]
    },
    revisit: {
      key: 'revisit', name: '再访报备',
      re: [/再访报备/], not: [],
      fields: [
        ['code', ['到访编码']], ['visitCount', ['接待次数']], ['time', ['接待时间']],
        ['operator', ['接待人员']], ['intent', ['客户意向']], ['levelChange', ['等级变化']],
        ['finalResult', ['最终结果']]
      ]
    },
    // 一体化报备：一条含 信息+首访+再访+成交，走专门的 parseInternal
    internal: {
      key: 'internal', name: '内部客户报备',
      re: [/内部客户报备/], not: [], fields: []
    }
  };
  App.REPORT_TYPES = REPORT_TYPES;

  const TYPE_ORDER = ['internal', 'convert', 'firstVisit', 'revisit', 'info'];

  function detectType(title) {
    for (const k of TYPE_ORDER) {
      const t = REPORT_TYPES[k];
      if (t.re.some(r => r.test(title)) && !t.not.some(r => r.test(title))) return k;
    }
    return null;
  }

  function parseBlock(block, forceType) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const title = lines[0];
    const type = forceType || detectType(title);
    if (!type) return { unknown: true, title, raw: block };
    if (type === 'internal') return parseInternal(block);
    const def = REPORT_TYPES[type];
    const fields = {};
    for (const line of lines.slice(1)) {
      const idx = line.search(/[：:]/);
      if (idx < 0) continue;
      const label = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).replace(/^[：:]\s*/, '').trim();
      for (const [fkey, aliases] of def.fields) {
        if (aliases.some(a => a === label || label.includes(a))) {
          if (val) fields[fkey] = val;
          break;
        }
      }
    }
    return { type, title, fields, raw: block };
  }

  // 拆分联系方式：“182龙城大卖7075，微信已私发” → phone/wechat（表情遮挡仅留数字，待补全）
  function splitContact(v) {
    const out = {};
    const parts = String(v).split(/[,，;；]/);
    const wxPart = parts.find(x => /微信/.test(x));
    if (wxPart) {
      const tail = wxPart.split('微信').pop().trim();
      out.wechat = /已私发|私发|已发/.test(tail) ? '已私发' : (tail || '已私发');
    }
    const digits = String(v).replace(/微信[^,，;；]*/g, '').replace(/\D/g, '');
    if (digits) out.phone = digits;
    return out;
  }

  // 解析一体化「内部客户报备」：头部信息 + 首次到访 + 再次到访 + 成交
  function parseInternal(block) {
    const lines = block.split(/\r?\n/);
    const head = {}, zones = { first: null, revisit: null, deal: null };
    let zone = 'head', cur = head;
    const kv = line => {
      const t = line.trim();
      const i = t.search(/[：:]/);
      if (i < 0) return null;
      return [t.slice(0, i).trim(), t.slice(i + 1).replace(/^[：:]\s*/, '').trim()];
    };
    for (const line of lines) {
      const t = line.trim();
      if (/首次到访时间/.test(t)) { zone = 'first'; zones.first = {}; cur = zones.first; }
      else if (/再次到访时间/.test(t)) { zone = 'revisit'; zones.revisit = {}; cur = zones.revisit; }
      else if (/客户成交时间/.test(t)) { zone = 'deal'; zones.deal = {}; cur = zones.deal; }
      const p = kv(line);
      if (!p || !p[1]) continue;
      const label = p[0], v = p[1];
      if (zone === 'head') {
        if (/信息编码/.test(label)) head.code = v;
        else if (/个人累计信息/.test(label)) head.personalSeq = v;
        else if (/项目累计信息/.test(label)) head.projectSeq = v;
        else if (/信息来源/.test(label)) head.source = v;
        else if (/姓名称呼|姓名/.test(label)) head.name = v;
        else if (/大概画像|画像/.test(label)) head.profile = v;
        else if (/联系方式/.test(label)) Object.assign(head, splitContact(v));
        else if (/报备时间/.test(label)) head.reportTime = v;
        else if (/报备人员/.test(label)) head.reporter = v;
      } else if (zone === 'first') {
        if (/首次到访时间/.test(label)) cur.time = v;
        else if (/首次接待人员/.test(label)) cur.receiver = v;
        else if (/接待时长/.test(label)) cur.duration = v;
        else if (/意向等级/.test(label)) cur.level = v;
        else if (/反馈意见/.test(label)) cur.feedback = v;
        else if (/个人到访累计/.test(label)) cur.personalVisit = v;
        else if (/项目到访累计/.test(label)) cur.projectVisit = v;
      } else if (zone === 'revisit') {
        if (/再次到访时间/.test(label)) cur.time = v;
        else if (/再次到访次数/.test(label)) cur.count = v;
        else if (/再次接待人员/.test(label)) cur.receiver = v;
        else if (/接待时长/.test(label)) cur.duration = v;
        else if (/意向等级/.test(label)) cur.level = v;
        else if (/反馈意见/.test(label)) cur.feedback = v;
      } else if (zone === 'deal') {
        if (/成交时间/.test(label)) cur.time = v;
        else if (/成交房号/.test(label)) cur.room = v;
        else if (/签单人员/.test(label)) cur.signer = v;
      }
    }
    return { type: 'internal', title: '内部客户报备', fields: { head, first: zones.first, revisit: zones.revisit, deal: zones.deal }, raw: block };
  }

  // 解析整段粘贴文本，可能含多条报备
  App.parseWechat = function (text) {
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let cur = [];
    for (const line of lines) {
      const t = line.trim();
      // 新块标题不含冒号；含冒号的是字段行（如“信息报备时间：”），不得误判为新块
      if (t && !/[：:]/.test(t) && detectType(t)) {
        if (cur.length) blocks.push(cur.join('\n'));
        cur = [line];
      } else if (cur.length) cur.push(line);
    }
    if (cur.length) blocks.push(cur.join('\n'));
    const out = blocks.map(b => parseBlock(b)).filter(Boolean);
    return out;
  };

  // 手动选定类型后解析
  App.parseAsType = function (text, type) {
    return parseBlock(text.trim(), type);
  };

  App.splitTags = function (s) {
    if (!s) return [];
    return String(s).split(/[、,，;；\s]+/).map(t => t.trim()).filter(Boolean);
  };

  /* ---------------- 统计引擎 ---------------- */
  const DAY_METRICS = ['collected', 'converted', 'visited', 'levelA', 'levelB', 'levelC', 'forced', 'deals'];

  function emptyDay() {
    return { collected: 0, converted: 0, visited: 0, levelA: 0, levelB: 0, levelC: 0, forced: 0, deals: 0, byStaff: {} };
  }
  function bump(day, name, metric) {
    name = (name || '未填写').trim();
    if (!day.byStaff[name]) day.byStaff[name] = { collected: 0, converted: 0, visited: 0, forced: 0, deals: 0 };
    day.byStaff[name][metric]++;
    day[metric]++;
  }

  // 从客户时间线自动统计每日数据
  App.buildAutoStats = function () {
    const days = {};
    const get = d => { if (!days[d]) days[d] = emptyDay(); return days[d]; };
    for (const c of App.data.customers.customers) {
      for (const e of (c.timeline || [])) {
        const d = App.dateOf(App.normTime(e.time));
        const day = get(d);
        const f = e.fields || {};
        if (e.type === '信息报备') bump(day, f.reporter || e.operator, 'collected');
        else if (e.type === '转换报备') bump(day, f.operator || e.operator, 'converted');
        else if (e.type === '首访报备') {
          bump(day, f.receiver || e.operator, 'visited');
          const lv = (f.level || c.intentLevel || '').toUpperCase();
          if (lv === 'A') day.levelA++; else if (lv === 'B') day.levelB++; else if (lv === 'C') day.levelC++;
        } else if (e.type === '再访报备') {
          bump(day, f.operator || e.operator, 'visited');
          let lv = (c.intentLevel || '').toUpperCase();
          const m = (f.levelChange || '').match(/([ABC])\s*$/);
          if (m) lv = m[1];
          if (lv === 'A') day.levelA++; else if (lv === 'B') day.levelB++; else if (lv === 'C') day.levelC++;
        } else if (/逼定/.test(e.type)) bump(day, e.operator, 'forced');
        else if (/成交|认购|签约/.test(e.type)) bump(day, e.operator, 'deals');
      }
    }
    return days;
  };

  // 某日数据（自动统计 + 手动覆盖）
  App.getDay = function (date) {
    const auto = App.buildAutoStats()[date] || emptyDay();
    const man = (App.data.daily.days[date] || {}).manual || {};
    const merged = Object.assign({}, auto);
    for (const k of DAY_METRICS) if (man[k] !== undefined && man[k] !== '') merged[k] = +man[k];
    merged.notes = man.notes || '';
    merged.date = date;
    return merged;
  };

  App.allDates = function () {
    const set = new Set(Object.keys(App.buildAutoStats()));
    Object.keys(App.data.daily.days).forEach(d => set.add(d));
    return [...set].sort();
  };

  App.sumDays = function (dates) {
    const tot = emptyDay();
    for (const d of dates) {
      const day = App.getDay(d);
      for (const k of DAY_METRICS) tot[k] += day[k] || 0;
      for (const [n, s] of Object.entries(day.byStaff)) {
        if (!tot.byStaff[n]) tot.byStaff[n] = { collected: 0, converted: 0, visited: 0, forced: 0, deals: 0 };
        for (const k in s) tot.byStaff[n][k] += s[k];
      }
    }
    return tot;
  };

  App.cumulative = function (upto) {
    let dates = App.allDates();
    if (upto) dates = dates.filter(d => d <= upto);
    return App.sumDays(dates);
  };
  App.today = function () { return App.getDay(App.todayStr()); };

  App.recentDates = function (n) {
    const out = []; const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d); x.setDate(d.getDate() - i);
      out.push(`${x.getFullYear()}-${App.pad(x.getMonth() + 1)}-${App.pad(x.getDate())}`);
    }
    return out;
  };

  App.rank = function (day, metric) {
    return Object.entries(day.byStaff)
      .map(([name, s]) => ({ name, v: s[metric] }))
      .filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  };
  App.top2 = function (day, metric) {
    const r = App.rank(day, metric);
    return [r[0] ? `${r[0].name}${r[0].v ? '·' + r[0].v : ''}` : '—',
            r[1] ? `${r[1].name}${r[1].v ? '·' + r[1].v : ''}` : '—'];
  };
  App.rate = function (a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; };

  // 客户阶段 / 等级分布
  App.stageDist = function () {
    const dist = {};
    for (const c of App.data.customers.customers) dist[c.stage] = (dist[c.stage] || 0) + 1;
    return dist;
  };
  App.levelDist = function () {
    const d = { A: 0, B: 0, C: 0 };
    for (const c of App.data.customers.customers) if (d[c.intentLevel] !== undefined) d[c.intentLevel]++;
    return d;
  };
  /* === ANCHOR_STATS === */
  /* ---------------- 业务逻辑层 ---------------- */
  // 判断是否真实联系方式（排除“已私发/已加/未填写”等状态词）
  function isRealContact(v) {
    v = String(v == null ? '' : v).trim();
    return !!v && !/^(已私发|已发|私发|已加|已加微信|加了|未填写|暂无|没有|无|未知|待定|-)$/.test(v);
  }
  App.isRealContact = isRealContact;

  // opts.codeOnly：信息报备只按编码匹配（编码=报备个案唯一标识，避免同名/同状态词误合并）
  function matchCustomer(fields, opts) {
    opts = opts || {};
    const cs = App.data.customers.customers;
    let c = null;
    if (fields.code) c = cs.find(x => (x.timeline || []).some(e => (e.fields || {}).code === fields.code));
    if (!c && !opts.codeOnly) {
      if (isRealContact(fields.phone)) c = cs.find(x => x.phone && x.phone === fields.phone);
      if (!c && isRealContact(fields.wechat)) c = cs.find(x => x.wechat && x.wechat === fields.wechat);
      if (!c && fields.name) c = cs.find(x => x.name === fields.name);
    }
    return c;
  }
  App.findCustomer = matchCustomer;

  App.mergeTags = function (c, tags) {
    for (const t of tags) if (!c.tags.includes(t)) c.tags.push(t);
  };

  App.newCustomer = function (fields) {
    App.data.customers.seq = (App.data.customers.seq || 0) + 1;
    return {
      id: 'C' + String(App.data.customers.seq).padStart(4, '0'),
      name: fields.name || '未命名', phone: fields.phone || '', wechat: fields.wechat || '',
      source: fields.source || '', profession: fields.profession || '', industry: fields.industry || '',
      intentProduct: fields.intent || fields.intentProduct || '', budget: fields.budget || '',
      tags: App.splitTags(fields.profile) || [], intentLevel: (fields.level || '').toUpperCase(),
      stage: '新线索', reporter: fields.reporter || '', firstReportAt: App.nowStr(),
      visitCount: 0, lastVisitAt: '', finalResult: '', note: '',
      timeline: [], painPoints: []
    };
  };

  // 应用一条报备（自动建档/合并/流转）
  App.applyReport = async function (item) {
    const type = item.type, fields = item.fields || {}, raw = item.raw || '';
    if (type === 'internal') return await App.applyInternal(item);
    let c = matchCustomer(fields, { codeOnly: type === 'info' });
    let isNew = false;
    if (!c) {
      if (type === 'info' || type === 'firstVisit') {
        c = App.newCustomer(fields); isNew = true;
        App.data.customers.customers.push(c);
      } else {
        return { ok: false, msg: '未找到编码对应的客户，请先提交该客户的信息报备' };
      }
    }
    const time = App.normTime(fields.time);
    const operator = fields.reporter || fields.operator || fields.receiver || '';
    c.timeline.push({ time, type: REPORT_TYPES[type].name, operator, raw, fields });

    if (fields.name) c.name = fields.name;
    if (fields.phone) c.phone = fields.phone;
    if (fields.wechat) c.wechat = fields.wechat;
    if (fields.source) c.source = fields.source;
    if (fields.profession) c.profession = fields.profession;
    if (fields.intent) c.intentProduct = fields.intent;
    if (fields.budget) c.budget = fields.budget;
    if (fields.profile) App.mergeTags(c, App.splitTags(fields.profile));
    if (fields.level) c.intentLevel = fields.level.toUpperCase();

    if (type === 'info') {
      if (!c.stage || c.stage === '新线索') c.stage = '新线索';
      if (!c.firstReportAt) c.firstReportAt = time;
      if (!c.reporter) c.reporter = operator;
    } else if (type === 'convert') {
      c.stage = '已邀约';
    } else if (type === 'firstVisit') {
      c.visitCount = Math.max(c.visitCount, parseInt(fields.visitCount) || 1);
      c.lastVisitAt = time;
      if (['新线索', '已邀约', ''].includes(c.stage)) c.stage = '方案沟通';
    } else if (type === 'revisit') {
      c.visitCount = Math.max(c.visitCount, parseInt(fields.visitCount) || (c.visitCount + 1));
      c.lastVisitAt = time;
      if (!/成交|流失/.test(c.stage)) c.stage = '再访跟进';
      if (fields.levelChange) { const m = fields.levelChange.match(/([ABC])\s*$/); if (m) c.intentLevel = m[1]; }
      if (fields.finalResult) {
        c.finalResult = fields.finalResult;
        if (/成交|认购|签约/.test(fields.finalResult)) c.stage = '已成交';
        else if (/放弃|流失|不考虑|无意向/.test(fields.finalResult)) c.stage = '已流失';
      }
    }
    await App.saveData('customers');
    return { ok: true, isNew, customer: c };
  };

  // 应用一体化内部报备：一条消息按区块落成多个阶段事件
  App.applyInternal = async function (item) {
    const f = item.fields || {}, h = f.head || {};
    if (!h.code) return { ok: false, msg: '缺少客户信息编码' };
    let c = matchCustomer({ code: h.code }, { codeOnly: true });
    let isNew = false;
    if (!c) {
      c = App.newCustomer({ name: h.name, phone: h.phone, wechat: h.wechat, source: h.source, reporter: h.reporter, profile: h.profile });
      isNew = true;
      App.data.customers.customers.push(c);
    }
    const headTime = App.normTime(h.reportTime);
    c.timeline.push({
      time: headTime, type: '信息报备', operator: h.reporter || '', raw: item.raw,
      fields: { code: h.code, source: h.source, name: h.name, phone: h.phone, wechat: h.wechat, intent: '住宅', reporter: h.reporter, time: h.reportTime, personalSeq: h.personalSeq, projectSeq: h.projectSeq }
    });
    if (h.name) c.name = h.name;
    if (h.phone) c.phone = h.phone;
    if (h.wechat) c.wechat = h.wechat;
    if (h.source) c.source = h.source;
    if (h.profile) App.mergeTags(c, App.splitTags(h.profile));
    if (h.reporter && !c.reporter) c.reporter = h.reporter;
    if (!c.firstReportAt) c.firstReportAt = headTime;
    if (f.first) {
      const x = f.first, t = App.normTime(x.time);
      c.timeline.push({ time: t, type: '首访报备', operator: x.receiver || '', raw: item.raw, fields: { code: h.code, name: h.name, time: x.time, receiver: x.receiver, level: x.level, profile: h.profile, duration: x.duration, feedback: x.feedback } });
      c.visitCount = Math.max(c.visitCount, 1);
      c.lastVisitAt = t;
      if (x.level) c.intentLevel = x.level.toUpperCase();
      if (['新线索', '已邀约', ''].includes(c.stage)) c.stage = '方案沟通';
      if (x.feedback) c.painPoints.push({ time: t, point: x.feedback, solution: '', status: '跟进中' });
    }
    if (f.revisit) {
      const x = f.revisit, t = App.normTime(x.time);
      const add = parseInt(x.count) || 1;
      c.timeline.push({ time: t, type: '再访报备', operator: x.receiver || '', raw: item.raw, fields: { code: h.code, time: x.time, operator: x.reporter, visitCount: x.count, levelChange: x.level, finalResult: x.feedback, duration: x.duration } });
      c.visitCount = Math.max(c.visitCount, c.visitCount + add);
      c.lastVisitAt = t;
      if (x.level) c.intentLevel = x.level.toUpperCase();
      if (!/成交|流失/.test(c.stage)) c.stage = '再访跟进';
      if (x.feedback) { c.finalResult = x.feedback; c.painPoints.push({ time: t, point: x.feedback, solution: '', status: '跟进中' }); }
    }
    if (f.deal && f.deal.time) {
      const x = f.deal, t = App.normTime(x.time);
      c.timeline.push({ time: t, type: '成交', operator: x.signer || '', raw: item.raw, fields: { room: x.room, signer: x.signer } });
      c.stage = '已成交';
      c.finalResult = '已成交' + (x.room ? '，房号' + x.room : '');
    }
    await App.saveData('customers');
    return { ok: true, isNew, customer: c };
  };

  // 通用时间线事件（沟通记录 / 逼定 / 成交）
  App.addTimelineEvent = async function (c, event) {
    c.timeline.push({
      time: App.normTime(event.time), type: event.type,
      operator: event.operator || '', raw: event.body || '', fields: event.fields || {}
    });
    if (/逼定/.test(event.type)) c.stage = '逼定中';
    if (/成交|认购|签约/.test(event.type)) c.stage = '已成交';
    await App.saveData('customers');
  };

  App.updateCustomer = async function (id, patch) {
    const c = App.data.customers.customers.find(x => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    await App.saveData('customers');
  };

  App.deleteCustomer = async function (id) {
    App.data.customers.customers = App.data.customers.customers.filter(x => x.id !== id);
    await App.saveData('customers');
  };

  App.addPainPoint = async function (c, point) {
    c.painPoints.push({
      time: App.nowStr(), point: point.point, solution: point.solution || '',
      status: point.status || '未解决'
    });
    await App.saveData('customers');
  };
  App.updatePainPoint = async function (c, idx, patch) {
    Object.assign(c.painPoints[idx], patch);
    await App.saveData('customers');
  };

  // 录音登记（同时挂到客户时间线）
  App.addRecording = async function (rec, customer) {
    App.data.recordings.recordings.unshift(rec);
    if (customer) {
      customer.timeline.push({
        time: rec.createdAt, type: '沟通记录', operator: '',
        raw: '录音：' + rec.name + (rec.summary ? '\n摘要：' + rec.summary : ''),
        fields: { recordingUrl: rec.url }
      });
    }
    await App.saveAll(['recordings', 'customers']);
  };

  // 上传文件到仓库（录音等，返回可访问URL）
  App.uploadRepoFile = async function (repoPath, file) {
    if (!App.canSaveRemote()) throw new Error('未配置 GitHub 连接，无法上传文件');
    const b64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result.split(',')[1]);
      fr.onerror = reject; fr.readAsDataURL(file);
    });
    let sha = null;
    try {
      const cur = await App.githubApi(`/repos/${App.cfg.owner}/${App.cfg.repo}/contents/${repoPath}?ref=${App.cfg.branch}`);
      sha = cur.sha;
    } catch (e) {}
    await App.githubApi(`/repos/${App.cfg.owner}/${App.cfg.repo}/contents/${repoPath}`, {
      method: 'PUT',
      body: JSON.stringify({ message: 'upload: ' + repoPath, content: b64, branch: App.cfg.branch, sha })
    });
    return `https://raw.githubusercontent.com/${App.cfg.owner}/${App.cfg.repo}/${App.cfg.branch}/${repoPath}`;
  };

  // 启动
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})();
