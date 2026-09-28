/* customer.js — 客户详情 360 视图 */
(function () {
  const id = new URLSearchParams(location.search).get('id');
  let c = null;

  document.addEventListener('app:ready', render);

  function render() {
    c = App.data.customers.customers.find(x => x.id === id);
    const root = App.$('#detail-root');
    if (!c) {
      root.innerHTML = `<div class="empty"><div class="e-title">未找到该客户</div>
        <a class="btn btn-primary mt16" href="customers.html">返回客户列表</a></div>`;
      return;
    }
    root.innerHTML = `
      <a class="btn btn-sm mb16" href="customers.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>返回列表</a>

      ${headerHtml()}
      ${actionsHtml()}
      ${infoHtml()}
      ${tagsHtml()}
      ${painHtml()}
      ${timelineBlockHtml()}
      ${dangerHtml()}`;
    bindEvents();
  }

  /* ---------------- 头部 ---------------- */
  function headerHtml() {
    return `<div class="card flex aic gap12 mb16">
      <span class="avatar lv-${c.intentLevel || ''}" style="width:58px;height:58px;font-size:1.4rem">${App.esc(App.initial(c.name))}</span>
      <div style="flex:1;min-width:0">
        <div class="flex aic gap8" style="font-size:1.25rem;font-weight:750">${App.esc(c.name)} ${App.levelBadge(c.intentLevel)}</div>
        <div class="mt8 flex gap8" style="flex-wrap:wrap">${App.stageBadge(c.stage)}
          <span class="badge">到访 ${c.visitCount} 次</span></div>
        <div class="muted xs mt8">最近到访：${c.lastVisitAt || '—'}　建档：${c.firstReportAt || '—'}</div>
      </div>
    </div>`;
  }

  function actionsHtml() {
    const btn = (act, label, svg, cls) =>
      `<button class="btn ${cls || ''} btn-sm" data-act="${act}" data-edit>${svg}${label}</button>`;
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    return `<div class="card mb16">
      <div class="card-head"><h3>快捷操作</h3></div>
      <div class="flex gap8" style="flex-wrap:wrap">
        ${btn('chat', '沟通记录', svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'))}
        ${btn('force', '逼定', svg('<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>'), 'btn-gold')}
        ${btn('deal', '成交', svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'), 'btn-green')}
        ${btn('stage', '变更阶段', svg('<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>'))}
        ${btn('edit', '编辑资料', svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'))}
        <a class="btn btn-sm right" href="recordings.html?customer=${c.id}">${svg('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>')}添加录音</a>
      </div>
    </div>`;
  }

  /* ---------------- 基本信息 ---------------- */
  function infoRow(label, val) {
    return `<div class="flex aic" style="padding:9px 0;border-bottom:1px solid var(--border-soft)">
      <span class="muted small" style="width:88px;flex:none">${label}</span>
      <span class="small" style="flex:1">${val && val !== '' ? App.esc(val) : '<span class="muted">未填写</span>'}</span></div>`;
  }
  function infoHtml() {
    return `<div class="card mb16"><div class="card-head"><h3>基本信息</h3></div>
      ${infoRow('手机号', c.phone)}${infoRow('微信号', c.wechat)}${infoRow('客户来源', c.source)}
      ${infoRow('职业', c.profession)}${infoRow('行业领域', c.industry)}
      ${infoRow('意向产品', c.intentProduct)}${infoRow('预算范围', c.budget)}
      ${infoRow('报备人员', c.reporter)}${infoRow('最终结果', c.finalResult)}
      ${infoRow('备注', c.note)}</div>`;
  }

  /* ---------------- 画像标签 ---------------- */
  function tagsHtml() {
    return `<div class="card mb16">
      <div class="card-head"><h3>客户画像</h3>
        <button class="btn btn-sm right" data-act="add-tag" data-edit>添加标签</button></div>
      <div>${c.tags.length ? c.tags.map((t, i) =>
        `<span class="tag">${App.esc(t)}<button data-act="del-tag" data-i="${i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button></span>`).join('')
        : '<span class="muted small">暂无画像标签</span>'}</div></div>`;
  }

  /* ---------------- 痛点跟踪 ---------------- */
  const PS = { '未解决': 'red', '跟进中': 'orange', '已解决': 'green' };
  function painHtml() {
    const items = c.painPoints.map((p, i) => `
      <div style="border:1px solid var(--border-soft);border-radius:9px;padding:11px 12px;margin-bottom:9px">
        <div class="flex aic gap8" style="flex-wrap:wrap">
          <span class="semibold small" style="flex:1;min-width:120px">${App.esc(p.point)}</span>
          <span class="badge ${PS[p.status] || ''}">${App.esc(p.status)}</span></div>
        ${p.solution ? `<div class="small muted mt8">应对：${App.esc(p.solution)}</div>` : ''}
        <div class="flex gap8 mt8">
          <button class="btn btn-sm" data-act="pain-status" data-i="${i}" data-edit>更新状态</button>
          <button class="btn btn-sm btn-danger right" data-act="pain-del" data-i="${i}" data-edit>删除</button></div>
      </div>`).join('');
    return `<div class="card mb16">
      <div class="card-head"><h3>痛点跟踪</h3>
        <button class="btn btn-sm right" data-act="add-pain" data-edit>新增痛点</button></div>
      ${items || '<span class="muted small">暂无痛点记录</span>'}</div>`;
  }

  /* ---------------- 时间轴 ---------------- */
  function tlItemHtml(e) {
    const cls = { '信息报备': 't-info', '转换报备': 't-convert', '首访报备': 't-firstVisit', '再访报备': 't-revisit' }[e.type]
      || (/逼定/.test(e.type) ? 't-deal' : 't-chat');
    const rec = e.fields && e.fields.recordingUrl;
    return `<div class="tl-item ${cls}">
      <div class="tl-time">${App.esc(e.time)}${e.operator ? ' · ' + App.esc(e.operator) : ''}</div>
      <div class="tl-title">${App.esc(e.type)}</div>
      <div class="tl-body">${App.esc(e.raw || '')}
        ${rec ? `<audio controls preload="none" src="${App.esc(rec)}" style="width:100%;margin-top:9px"></audio>` : ''}</div>
    </div>`;
  }
  function timelineBlockHtml() {
    const list = c.timeline.slice().reverse();
    return `<div class="card mb16"><div class="card-head"><h3>跟进时间轴</h3>
      <span class="card-note right">${c.timeline.length} 条记录</span></div>
      <div class="timeline">${list.map(tlItemHtml).join('') || '<span class="muted small">暂无记录</span>'}</div></div>`;
  }

  function dangerHtml() {
    return `<div class="card mb16" style="border-color:rgba(245,72,59,.3)">
      <div class="flex aic gap12">
        <div style="flex:1"><div class="semibold small">删除该客户</div>
          <div class="muted xs mt8">将同时删除其全部报备、痛点与跟进记录，不可恢复</div></div>
        <button class="btn btn-danger btn-sm" data-act="delete" data-edit>删除</button></div></div>`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    rootOnclick();
  }
  function rootOnclick() {
    App.$('#detail-root').addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      const i = b.dataset.i;
      if (act === 'chat') eventModal('沟通记录', 'chat');
      else if (act === 'force') eventModal('逼定记录', 'forced');
      else if (act === 'deal') eventModal('成交登记', 'deal');
      else if (act === 'stage') stageModal();
      else if (act === 'edit') editModal();
      else if (act === 'add-tag') tagModal();
      else if (act === 'del-tag') {
        c.tags.splice(+i, 1); await App.saveData('customers'); render();
      } else if (act === 'add-pain') painModal();
      else if (act === 'pain-status') painStatusModal(+i);
      else if (act === 'pain-del') {
        if (await App.confirm('确定删除这条痛点记录？')) { c.painPoints.splice(+i, 1); await App.saveData('customers'); render(); }
      } else if (act === 'delete') {
        if (await App.confirm(`确定删除客户「${c.name}」及其全部记录？`)) {
          await App.deleteCustomer(c.id);
          location.href = 'customers.html';
        }
      }
    });
  }

  /* ---------------- 各类弹窗 ---------------- */
  function dtNow() {
    const d = new Date();
    return `${App.todayStr()}T${App.pad(d.getHours())}:${App.pad(d.getMinutes())}`;
  }

  function eventModal(title, kind) {
    if (!App.requireEditor()) return;
    const typeName = kind === 'chat' ? '沟通记录' : kind === 'forced' ? '逼定' : '成交';
    const mask = App.openModal(title, `
      <div class="form-row"><label>时间</label><input class="input" type="datetime-local" id="ev-time" value="${dtNow()}"></div>
      ${kind === 'chat' ? `<div class="form-row"><label>沟通方式</label>
        <select class="input" id="ev-ch"><option>微信</option><option>电话</option><option>面谈</option><option>其他</option></select></div>` : ''}
      <div class="form-row"><label>跟进人</label><input class="input" id="ev-op"></div>
      <div class="form-row"><label>${kind === 'chat' ? '沟通内容' : '情况说明'}</label>
        <textarea class="input" id="ev-body" style="min-height:110px"></textarea></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="ev-save">保存</button></div>`);
    mask.querySelector('#ev-save').onclick = async () => {
      const body = mask.querySelector('#ev-body').value.trim();
      const op = mask.querySelector('#ev-op').value.trim();
      const time = mask.querySelector('#ev-time').value.replace('T', ' ');
      if (!body) { App.toast('请填写内容', 'error'); return; }
      let fullBody = body;
      if (kind === 'chat') fullBody = '方式：' + mask.querySelector('#ev-ch').value + '\n' + body;
      await App.addTimelineEvent(c, { time, type: typeName, operator: op, body: fullBody });
      App.closeModal(); App.toast('已添加', 'success'); render();
    };
  }

  function stageModal() {
    if (!App.requireEditor()) return;
    const opts = App.data.settings.stages.map(s => `<option ${s === c.stage ? 'selected' : ''}>${s}</option>`).join('');
    const mask = App.openModal('变更客户阶段', `
      <div class="form-row"><label>当前阶段</label><select class="input" id="st-val">${opts}</select></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="st-save">保存</button></div>`);
    mask.querySelector('#st-save').onclick = async () => {
      await App.updateCustomer(c.id, { stage: mask.querySelector('#st-val').value });
      App.closeModal(); App.toast('阶段已更新', 'success'); render();
    };
  }

  function editModal() {
    if (!App.requireEditor()) return;
    const f = (label, id, val, tag) =>
      `<div class="form-row"><label>${label}</label><input class="input" id="${id}" value="${App.esc(val || '')}"></div>`;
    const mask = App.openModal('编辑基本信息', `
      <div class="form-grid two-col">
        ${f('客户姓名', 'e-name', c.name)}${f('手机号', 'e-phone', c.phone)}
        ${f('微信号', 'e-wechat', c.wechat)}
        <div class="form-row"><label>客户来源</label><select class="input" id="e-source">
          ${App.data.settings.sources.map(s => `<option ${s === c.source ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        ${f('职业', 'e-profession', c.profession)}${f('行业领域', 'e-industry', c.industry)}
        ${f('意向产品', 'e-intent', c.intentProduct)}${f('预算范围', 'e-budget', c.budget)}
        ${f('报备人员', 'e-reporter', c.reporter)}
        <div class="form-row"><label>意向等级</label><select class="input" id="e-level">
          <option value="">未评级</option>${['A', 'B', 'C'].map(l => `<option ${l === c.intentLevel ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      ${f('备注', 'e-note', c.note)}
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="e-save">保存</button></div>`);
    mask.querySelector('#e-save').onclick = async () => {
      await App.updateCustomer(c.id, {
        name: mask.querySelector('#e-name').value.trim() || c.name,
        phone: mask.querySelector('#e-phone').value.trim(),
        wechat: mask.querySelector('#e-wechat').value.trim(),
        source: mask.querySelector('#e-source').value,
        profession: mask.querySelector('#e-profession').value.trim(),
        industry: mask.querySelector('#e-industry').value.trim(),
        intentProduct: mask.querySelector('#e-intent').value.trim(),
        budget: mask.querySelector('#e-budget').value.trim(),
        reporter: mask.querySelector('#e-reporter').value.trim(),
        intentLevel: mask.querySelector('#e-level').value,
        note: mask.querySelector('#e-note').value.trim()
      });
      App.closeModal(); App.toast('资料已更新', 'success'); render();
    };
  }

  function tagModal() {
    if (!App.requireEditor()) return;
    const mask = App.openModal('添加画像标签', `
      <div class="form-row"><label>标签（多个用顿号分隔）</label>
        <input class="input" id="tag-val" placeholder="如：价格敏感、注重学区"></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="tag-save">添加</button></div>`);
    mask.querySelector('#tag-save').onclick = async () => {
      const tags = App.splitTags(mask.querySelector('#tag-val').value);
      if (!tags.length) { App.toast('请输入标签', 'error'); return; }
      App.mergeTags(c, tags);
      await App.saveData('customers');
      App.closeModal(); render();
    };
  }

  function painModal() {
    if (!App.requireEditor()) return;
    const mask = App.openModal('新增痛点', `
      <div class="form-row"><label>客户痛点<span class="req">*</span></label>
        <input class="input" id="p-point" placeholder="如：担心交房时间"></div>
      <div class="form-row"><label>应对方案</label><input class="input" id="p-sol"></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="p-save">保存</button></div>`);
    mask.querySelector('#p-save').onclick = async () => {
      const point = mask.querySelector('#p-point').value.trim();
      if (!point) { App.toast('请填写痛点', 'error'); return; }
      await App.addPainPoint(c, { point, solution: mask.querySelector('#p-sol').value.trim(), status: '跟进中' });
      App.closeModal(); render();
    };
  }

  function painStatusModal(i) {
    if (!App.requireEditor()) return;
    const p = c.painPoints[i];
    const mask = App.openModal('更新痛点状态', `
      <div class="form-row"><label>「${App.esc(p.point)}」状态</label>
        <select class="input" id="ps-val">${['未解决', '跟进中', '已解决'].map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="ps-save">保存</button></div>`);
    mask.querySelector('#ps-save').onclick = async () => {
      await App.updatePainPoint(c, i, { status: mask.querySelector('#ps-val').value });
      App.closeModal(); render();
    };
  }
})();
