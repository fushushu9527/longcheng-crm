/* report.js — 报备录入：微信解析 + 手动表单 */
(function () {
  let parsed = [];
  let curType = 'info';

  const TYPE_BADGE = { info: 'cyan', convert: 'purple', firstVisit: 'green', revisit: 'orange' };
  const TITLES = {
    info: '龙城·营峰天境信息报备',
    convert: '龙城·营峰天境信息转换报备',
    firstVisit: '龙城·营峰天境客户首访报备',
    revisit: '龙城·营峰天境客户再访报备'
  };
  const SAMPLE = `龙城·营峰天境信息报备
信息编码：X0002
信息来源：抖音
客户姓名：李先生
客户电话：13800001111
客户微信：li123
客户意向：三房户型
报备人员：小王
报备时间：今天 10:30

龙城·营峰天境信息转换报备
信息编码：X0002
邀约形式：电话
邀约次数：2
拟访时间：明天 14:00
邀约人员：小王
邀约时间：今天 16:00`;

  document.addEventListener('app:ready', init);

  function init() {
    App.$('#btn-sample').onclick = () => { App.$('#raw').value = SAMPLE; };
    App.$('#btn-parse').onclick = doParse;
    App.$('#type-chips').addEventListener('click', e => {
      const chip = e.target.closest('[data-type]');
      if (!chip) return;
      App.$$('#type-chips .chip').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      curType = chip.dataset.type;
      buildManualFields();
    });
    App.$('#manual-form').addEventListener('submit', submitManual);
    buildManualFields();
  }

  /* ---------------- 粘贴解析 ---------------- */
  function doParse() {
    const text = App.$('#raw').value;
    if (!text.trim()) { App.toast('请先粘贴报备内容', 'error'); return; }
    parsed = App.parseWechat(text);
    if (!parsed.length) {
      App.toast('未识别到报备标题，请用下方手动方式', 'error');
      App.$('#preview').innerHTML = '';
      return;
    }
    renderPreview();
    App.toast(`识别到 ${parsed.length} 条报备，请核对后提交`);
  }

  function previewCard(p) {
    if (p.unknown) {
      const opts = Object.values(App.REPORT_TYPES).map(t => `<option value="${t.key}">${t.name}</option>`).join('');
      return `<div class="card">
        <div class="card-head"><h3>未识别的内容</h3></div>
        <div class="flex gap8">
          <select class="input" id="force-type" style="flex:none;width:130px">${opts}</select>
          <button class="btn btn-primary btn-sm" id="force-parse">按此类型解析</button>
        </div>
        <div class="tl-body mt8">${App.esc(p.raw)}</div></div>`;
    }
    const def = App.REPORT_TYPES[p.type];
    const c = App.findCustomer(p.fields);
    const rows = Object.keys(p.fields).map(k => {
      const label = (def.fields.find(f => f[0] === k) || [k, [k]])[1][0];
      return `<tr><td class="nowrap" style="width:42%">${label}</td><td>${App.esc(p.fields[k])}</td></tr>`;
    }).join('');
    return `<div class="card">
      <div class="card-head">
        <span class="badge ${TYPE_BADGE[p.type]}">${def.name}</span>
        <span class="card-note right">${c ? '归属客户：' + App.esc(c.name) + '（' + App.esc(c.stage) + '）' : '未找到客户，将自动新建'}</span>
      </div>
      <div class="table-wrap"><table class="data-table" style="min-width:auto"><tbody>${rows}</tbody></table></div>
    </div>`;
  }

  function renderPreview() {
    App.$('#preview').innerHTML = '<div class="grid">' + parsed.map(previewCard).join('') + '</div>' +
      (parsed.some(p => !p.unknown) ? '<button class="btn btn-green btn-block mt16" id="btn-submit-all" data-edit>确认无误，全部归档</button>' : '');
    const forceBtn = App.$('#force-parse');
    if (forceBtn) forceBtn.onclick = () => {
      const t = App.$('#force-type').value;
      const idx = parsed.findIndex(p => p.unknown);
      parsed[idx] = App.parseAsType(parsed[idx].raw, t);
      renderPreview();
    };
    const btnAll = App.$('#btn-submit-all');
    if (btnAll) btnAll.onclick = submitAll;
  }

  async function submitAll() {
    if (!App.requireEditor()) return;
    const btn = App.$('#btn-submit-all');
    btn.disabled = true; btn.textContent = '提交中…（网络慢时会自动重试，请勿关闭）';
    let ok = 0, fail = 0;
    try {
      for (const p of parsed) {
        if (p.unknown) { fail++; continue; }
        try {
          const r = await App.applyReport(p);
          if (r.ok) ok++; else fail++;
        } catch (e) {
          fail++;
          App.toast('「' + (p.fields.name || p.fields.code || '报备') + '」暂存本机：' + e.message, 'error');
        }
      }
    } finally {
      btn.disabled = false; btn.textContent = '确认无误，全部归档';
    }
    if (fail === 0) {
      App.toast(`已归档 ${ok} 条`, 'success');
      parsed = [];
      App.$('#raw').value = '';
      App.$('#preview').innerHTML = '';
    } else {
      App.toast(`已归档 ${ok} 条；${fail} 条已暂存本机，网络恢复后自动同步`, ok ? 'error' : 'error');
    }
  }

  /* ---------------- 手动表单 ---------------- */
  function dtNow() {
    const d = new Date();
    return `${App.todayStr()}T${App.pad(d.getHours())}:${App.pad(d.getMinutes())}`;
  }

  function widget(fkey) {
    if (fkey === 'source')
      return `<select class="input" data-fk="source"><option value="">请选择</option>${App.data.settings.sources.map(s => `<option>${s}</option>`).join('')}</select>`;
    if (fkey === 'level')
      return `<select class="input" data-fk="level"><option value="">请选择</option>${App.data.settings.levels.map(s => `<option>${s}</option>`).join('')}</select>`;
    if (fkey === 'time')
      return `<input class="input" type="datetime-local" data-fk="time" value="${dtNow()}">`;
    if (fkey === 'profile')
      return `<textarea class="input" data-fk="profile" placeholder="多个标签用顿号分隔"></textarea>`;
    return `<input class="input" data-fk="${fkey}" placeholder="请填写">`;
  }

  function buildManualFields() {
    const def = App.REPORT_TYPES[curType];
    App.$('#manual-fields').innerHTML = def.fields.map(([fkey, aliases]) => `
      <div class="form-row"><label>${aliases[0]}${['code', 'name'].includes(fkey) ? '<span class="req">*</span>' : ''}</label>
      ${widget(fkey)}</div>`).join('');
  }

  function buildRaw(type, fields) {
    const lines = [TITLES[type]];
    for (const [fkey, aliases] of App.REPORT_TYPES[type].fields) {
      if (fields[fkey]) lines.push(`${aliases[0]}：${fields[fkey]}`);
    }
    return lines.join('\n');
  }

  async function submitManual(e) {
    e.preventDefault();
    if (!App.requireEditor()) return;
    const fields = {};
    App.$$('#manual-form [data-fk]').forEach(el => { if (el.value) fields[el.dataset.fk] = el.value.replace('T', ' '); });
    if (!fields.code || !fields.name && curType === 'info') {
      App.toast('请至少填写编码和客户姓名', 'error'); return;
    }
    const r = await App.applyReport({ type: curType, fields, raw: buildRaw(curType, fields) });
    if (r.ok) {
      App.toast((r.isNew ? '已新建客户并归档' : '已归档到客户') + '：' + r.customer.name, 'success');
      App.$('#manual-form').reset();
      buildManualFields();
    } else App.toast(r.msg, 'error');
  }
})();
