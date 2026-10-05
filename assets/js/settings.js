/* settings.js — 连接配置 / 飞书 / 人员 / 备份 */
(function () {
  document.addEventListener('app:ready', init);

  function init() {
    App.$('#gh-owner').value = App.cfg.owner;
    App.$('#gh-repo').value = App.cfg.repo || 'longcheng-crm';
    App.$('#gh-branch').value = App.cfg.branch || 'main';
    App.$('#gh-token').value = App.cfg.token;
    App.$('#feishu-url').value = App.data.settings.feishuUrl || '';
    App.$('#cfg-staff').value = App.data.settings.staff.join('\n');
    App.$('#cfg-sources').value = App.data.settings.sources.join('\n');

    App.$('#btn-save-cfg').onclick = saveCfg;
    App.$('#btn-test').onclick = testConn;
    App.$('#btn-save-feishu').onclick = saveFeishu;
    App.$('#btn-open-feishu').onclick = () => {
      const u = App.$('#feishu-url').value.trim();
      if (u) window.open(u, '_blank', 'noopener'); else App.toast('请先填写飞书链接', 'error');
    };
    App.$('#btn-save-cfglist').onclick = saveCfgList;
    App.$('#btn-export').onclick = exportData;
    App.$('#btn-import').onclick = () => App.$('#import-file').click();
    App.$('#import-file').onchange = importData;

    App.$('#btn-flush').onclick = async () => {
      const b = App.$('#btn-flush'); b.textContent = '同步中…'; b.disabled = true;
      await App.flushPending({ manual: true });
      b.textContent = '立即同步全部'; b.disabled = false;
      renderPending(); renderStatus();
    };
    renderPending();
    renderStatus();
  }

  const PENDING_NAMES = { settings: '系统设置', customers: '客户数据', daily: '日报数据', recordings: '录音数据' };
  function renderPending() {
    let q = [];
    try { q = JSON.parse(App.store.get('lc_pending_sync') || '[]'); } catch (e) {}
    const el = App.$('#pending-list');
    if (!q.length) { el.innerHTML = '<div class="muted">当前没有待同步数据。</div>'; return; }
    el.innerHTML = q.map(x => `
      <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
        <div><b>${PENDING_NAMES[x.key] || x.key}</b> <span class="muted">${App.esc(x.ts || '')}</span></div>
        <div class="muted">${x.lastError ? '失败原因：' + App.esc(x.lastError) : '等待同步'}</div>
        <div class="flex gap8" style="margin-top:6px">
          <button class="btn btn-sm" data-pk="${x.key}">同步此项</button>
          <button class="btn btn-sm" data-pd="${x.key}">删除</button>
        </div>
      </div>`).join('');
    el.querySelectorAll('[data-pk]').forEach(b => b.onclick = async () => {
      b.textContent = '同步中…';
      await App.flushPending({ manual: true });
      renderPending(); renderStatus();
    });
    el.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => {
      App.removePending(b.dataset.pd); renderPending(); App.renderChrome();
    });
  }

  function saveCfg() {
    const owner = App.$('#gh-owner').value.trim();
    const repo = App.$('#gh-repo').value.trim();
    const branch = App.$('#gh-branch').value.trim() || 'main';
    const token = App.$('#gh-token').value.trim();
    if (!owner || !token) { App.toast('至少填写用户名和令牌', 'error'); return; }
    App.store.set('lc_github_owner', owner);
    App.store.set('lc_github_repo', repo);
    App.store.set('lc_github_branch', branch);
    App.store.set('lc_github_token', token);
    App.loadCfg();
    App.renderChrome();
    App.toast('连接配置已保存', 'success');
    renderStatus();
  }

  async function testConn() {
    // 临时使用表单中的值
    const token = App.$('#gh-token').value.trim() || App.cfg.token;
    if (!token) { App.toast('请填写令牌', 'error'); return; }
    App.$('#btn-test').textContent = '测试中…';
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error('令牌无效或网络错误 (' + res.status + ')');
      const j = await res.json();
      App.toast('连接成功：' + j.login + '（' + (j.name || '') + '）', 'success');
      if (!App.$('#gh-owner').value.trim()) App.$('#gh-owner').value = j.login;
    } catch (e) { App.toast(e.message, 'error'); }
    finally { App.$('#btn-test').textContent = '测试连接'; }
  }

  async function saveFeishu() {
    if (!App.requireEditor()) return;
    App.data.settings.feishuUrl = App.$('#feishu-url').value.trim();
    await App.saveData('settings');
    App.toast('飞书链接已保存', 'success');
  }

  async function saveCfgList() {
    if (!App.requireEditor()) return;
    const staff = App.$('#cfg-staff').value.split('\n').map(s => s.trim()).filter(Boolean);
    const sources = App.$('#cfg-sources').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!staff.length || !sources.length) { App.toast('人员和来源不能为空', 'error'); return; }
    App.data.settings.staff = staff;
    App.data.settings.sources = sources;
    await App.saveData('settings');
    App.toast('已保存', 'success');
  }

  function exportData() {
    const pack = {
      settings: App.data.settings, customers: App.data.customers,
      daily: App.data.daily, recordings: App.data.recordings,
      exportedAt: App.nowStr()
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `longcheng-crm-backup-${App.todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    App.toast('已导出备份文件');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const pack = JSON.parse(fr.result);
        if (!pack.customers) throw new Error('不是有效的备份文件');
        App.data.settings = pack.settings;
        App.data.customers = pack.customers;
        App.data.daily = pack.daily;
        App.data.recordings = pack.recordings;
        if (App.canSaveRemote()) {
          await App.saveAll();
          App.toast('已导入并同步到 GitHub', 'success');
        } else {
          ['settings', 'customers', 'daily', 'recordings'].forEach(k =>
            App.store.set('lc_local_data_' + k, JSON.stringify(App.data[k])));
          App.toast('已导入（本地模式）', 'success');
        }
        setTimeout(() => location.reload(), 900);
      } catch (err) { App.toast(err.message, 'error'); }
    };
    fr.readAsText(file);
  }

  function renderStatus() {
    const lines = [];
    lines.push('运行模式：' + (App.online ? '线上（GitHub Pages）' : '本地预览（file://）'));
    lines.push('编辑权限：' + (App.isEditor() ? '已解锁（管理员）' : '只读（访客）'));
    if (App.cfg.owner) lines.push('连接：' + App.cfg.owner + '/' + App.cfg.repo + '@' + App.cfg.branch);
    lines.push('客户数：' + App.data.customers.customers.length + '　录音数：' + App.data.recordings.recordings.length);
    App.$('#status-text').innerHTML = lines.map(App.esc).join('<br>');
  }
})();
