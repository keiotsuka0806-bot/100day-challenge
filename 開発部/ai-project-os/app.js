// ─── State ───────────────────────────────────────────────
let projects = {};       // { key: ProjectObject }
let current = null;      // 現在開いているプロジェクト
let activeStepId = null;

// ─── DOM refs ────────────────────────────────────────────
const homeScreen     = document.getElementById('home-screen');
const workflowScreen = document.getElementById('workflow-screen');
const nameInput      = document.getElementById('project-name');
const descInput      = document.getElementById('project-desc');
const generateBtn    = document.getElementById('generate-btn');
const backBtn        = document.getElementById('back-btn');
const stepsNav       = document.getElementById('steps-nav');
const detailMain     = document.getElementById('detail-main');
const promptAside    = document.getElementById('prompt-aside');
const wfProjectName  = document.getElementById('wf-project-name');
const wfProjectDesc  = document.getElementById('wf-project-desc');
const progressFill   = document.getElementById('progress-fill');
const progressText   = document.getElementById('progress-text');
const savedSection   = document.getElementById('saved-section');
const projectList    = document.getElementById('project-list');

// ─── Init ─────────────────────────────────────────────────
(function init() {
  load();
  renderSaved();
  generateBtn.addEventListener('click', onGenerate);
  backBtn.addEventListener('click', goHome);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') descInput.focus(); });
})();

// ─── Storage ──────────────────────────────────────────────
function load() {
  try { projects = JSON.parse(localStorage.getItem('ai_project_os_v1') || '{}'); } catch { projects = {}; }
}
function save() {
  localStorage.setItem('ai_project_os_v1', JSON.stringify(projects));
}

// ─── Helpers ──────────────────────────────────────────────
function slugify(s) {
  return s.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}
function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function resolveVars(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
function countDone(p) {
  return WORKFLOW_STEPS.filter(s => p.steps[s.id] === '完了').length;
}

// ─── Home ─────────────────────────────────────────────────
function onGenerate() {
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  if (!name) { nameInput.focus(); nameInput.style.borderColor = '#f87171'; return; }
  nameInput.style.borderColor = '';

  const slug = slugify(name);
  const date = today();
  const key  = `${date}-${slug}`;

  if (!projects[key]) {
    projects[key] = { key, name, description: desc, slug, date, steps: {} };
    WORKFLOW_STEPS.forEach(s => { projects[key].steps[s.id] = '未着手'; });
    save();
  }
  openProject(key);
}

function goHome() {
  workflowScreen.classList.remove('active');
  homeScreen.classList.add('active');
  current = null;
  activeStepId = null;
  renderSaved();
}

function renderSaved() {
  const keys = Object.keys(projects);
  if (!keys.length) { savedSection.style.display = 'none'; return; }
  savedSection.style.display = 'block';
  projectList.innerHTML = keys.reverse().map(k => {
    const p = projects[k];
    const done = countDone(p);
    return `<div class="project-card" onclick="openProject('${k}')">
      <div>
        <div class="project-card-name">${esc(p.name)}</div>
        <div class="project-card-meta">${p.date}</div>
      </div>
      <div class="project-card-progress">${done} / ${WORKFLOW_STEPS.length} 完了</div>
    </div>`;
  }).join('');
}

// ─── Workflow ──────────────────────────────────────────────
function openProject(key) {
  current = projects[key];
  activeStepId = null;

  wfProjectName.textContent = current.name;
  wfProjectDesc.textContent = current.description || '';

  homeScreen.classList.remove('active');
  workflowScreen.classList.add('active');

  renderSteps();
  updateProgress();
  resetPanels();

  // 最初の未完了ステップを自動選択
  const first = WORKFLOW_STEPS.find(s => current.steps[s.id] !== '完了');
  if (first) selectStep(first.id);
}

function renderSteps() {
  stepsNav.innerHTML = WORKFLOW_STEPS.map(s => {
    const status = current.steps[s.id];
    const isActive = s.id === activeStepId;
    return `<div class="step-item s-${status} ${isActive ? 'active' : ''}" onclick="selectStep('${s.id}')">
      <div class="step-dot"></div>
      <div class="step-meta">
        <div class="step-phase">${s.phase}</div>
        <div class="step-label">${s.icon} ${s.name}</div>
      </div>
      <span class="step-badge">${status}</span>
    </div>`;
  }).join('');
}

function updateProgress() {
  const done  = countDone(current);
  const total = WORKFLOW_STEPS.length;
  progressFill.style.width = `${(done / total) * 100}%`;
  progressText.textContent  = `${done} / ${total} 完了`;
}

function resetPanels() {
  detailMain.innerHTML  = '<div class="empty-hint">← ステップを選んでください</div>';
  promptAside.innerHTML = '<div class="prompt-empty">ステップを選ぶと<br>実行プロンプトが<br>表示されます</div>';
}

// ─── Step detail ──────────────────────────────────────────
function selectStep(id) {
  activeStepId = id;
  renderSteps();

  const step   = WORKFLOW_STEPS.find(s => s.id === id);
  const status = current.steps[id];

  renderDetail(step, status);
  renderPrompt(step);
}

function renderDetail(step, status) {
  const statuses = ['未着手', '進行中', '完了'];
  detailMain.innerHTML = `
    <div class="detail-icon">${step.icon}</div>
    <div class="detail-title">${step.name}</div>
    <div class="purpose-box">${esc(step.purpose)}</div>

    <div class="detail-section">
      <div class="section-label">やること</div>
      <ul class="task-list">
        ${step.tasks.map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>

    <div class="detail-section">
      <div class="section-label">完了条件</div>
      <ul class="criteria-list">
        ${step.completionCriteria.map(c => `<li>${esc(c)}</li>`).join('')}
      </ul>
    </div>

    <div class="detail-section">
      <div class="section-label">ステータスを変更</div>
      <div class="status-row">
        ${statuses.map(s => `
          <button class="status-btn ${s === status ? 'on' : ''}"
                  onclick="setStatus('${step.id}', '${s}')">${s}</button>
        `).join('')}
      </div>
    </div>`;
}

function setStatus(stepId, newStatus) {
  current.steps[stepId] = newStatus;
  projects[current.key]  = current;
  save();
  renderSteps();
  updateProgress();
  // detail を再描画してボタン状態を更新
  const step = WORKFLOW_STEPS.find(s => s.id === stepId);
  renderDetail(step, newStatus);
}

// ─── Prompt panel ─────────────────────────────────────────
function renderPrompt(step) {
  const vars = {
    projectName:        current.name,
    projectDescription: current.description,
    projectSlug:        current.slug,
    date:               current.date
  };

  const blocksHtml = step.prompts.map((p, i) => {
    const text = resolveVars(p.text, vars);
    const cls  = p.type === 'command' ? 'prompt-cmd' : 'prompt-ai-block';
    return `<div class="prompt-block">
      <div class="prompt-block-label">${esc(p.label)}</div>
      <div class="${cls}">${esc(text)}</div>
    </div>`;
  }).join('');

  promptAside.innerHTML = `
    <div class="prompt-header">
      <span class="prompt-header-label">実行プロンプト</span>
      <button class="btn-copy" id="copy-btn" onclick="copyPrompts('${step.id}')">コピー</button>
    </div>
    <div class="prompt-scroll">${blocksHtml}</div>`;
}

function copyPrompts(stepId) {
  const step = WORKFLOW_STEPS.find(s => s.id === stepId);
  const vars = {
    projectName:        current.name,
    projectDescription: current.description,
    projectSlug:        current.slug,
    date:               current.date
  };

  const text = step.prompts.map(p =>
    `# ${p.label}\n\n${resolveVars(p.text, vars)}`
  ).join('\n\n---\n\n');

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    if (!btn) return;
    btn.textContent = 'コピー済み ✓';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('done'); }, 2000);
  });
}
