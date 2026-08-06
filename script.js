const boardEl = document.querySelector("#board");
const lanesEl = document.querySelector("#lanes");
const waveEl = document.querySelector("#wave");
const barHpEl = document.querySelector("#barHp");
const barHpFillEl = document.querySelector("#barHpFill");
const sparkEl = document.querySelector("#spark");
const sparkFillEl = document.querySelector("#sparkFill");
const scoreEl = document.querySelector("#score");
const summonBtn = document.querySelector("#summonBtn");
const summonCostEl = document.querySelector("#summonCost");
const specialBtn = document.querySelector("#specialBtn");
const restartBtn = document.querySelector("#restartBtn");
const resultEl = document.querySelector("#result");
const resultKickerEl = document.querySelector("#resultKicker");
const resultTitleEl = document.querySelector("#resultTitle");
const resultTextEl = document.querySelector("#resultText");
const resultRestartBtn = document.querySelector("#resultRestartBtn");
const recipeListEl = document.querySelector("#recipeList");
const toastEl = document.querySelector("#toast");

const rows = 4;
const cols = 3;
const laneCount = 4;
const maxHp = 20;
const maxSpark = 100;
const summonCost = 20;
const specialCost = 50;
const winWave = 6;

const recipes = [
  { level: 1, name: "气泡水", mark: "泡", damage: 1, speed: 620, range: 1000, color: "#5bd2d5", note: "稳定单发" },
  { level: 2, name: "冰柠苏打", mark: "冰", damage: 2, speed: 560, range: 1000, color: "#b7ef67", slow: 0.72, note: "轻微减速" },
  { level: 3, name: "薄荷莫吉托", mark: "荷", damage: 4, speed: 720, range: 1000, color: "#f3be58", splash: 24, note: "小范围溅射" },
  { level: 4, name: "金汤力", mark: "汤", damage: 7, speed: 780, range: 1000, color: "#f47796", slow: 0.6, note: "强力冰镇" },
  { level: 5, name: "长岛冰茶", mark: "岛", damage: 12, speed: 940, range: 1000, color: "#d8b4fe", splash: 46, note: "大范围清场" },
];

const enemyKinds = [
  { name: "酒蒙子", mark: "醉", hp: 3, speed: 23, damage: 1 },
  { name: "劝酒怪", mark: "劝", hp: 5, speed: 19, damage: 2 },
  { name: "宿醉影", mark: "晕", hp: 8, speed: 15, damage: 3 },
];

let slots = [];
let units = [];
let enemies = [];
let projectiles = [];
let draggedId = null;
let selectedId = null;
let state;
let lastTime = 0;
let toastTimer = 0;
let rafId = 0;
let idCounter = 0;

function newState() {
  return {
    hp: maxHp,
    spark: 70,
    score: 0,
    wave: 1,
    spawnTimer: 900,
    spawnedInWave: 0,
    toSpawn: 5,
    wavePause: 0,
    over: false,
  };
}

function init() {
  cancelAnimationFrame(rafId);
  state = newState();
  units = [];
  enemies = [];
  projectiles = [];
  draggedId = null;
  selectedId = null;
  lastTime = performance.now();
  buildBoard();
  buildLanes();
  renderRecipes();
  placeUnit(0, 1);
  placeUnit(1, 1);
  placeUnit(3, 1);
  resultEl.classList.add("hidden");
  showToast("营业开始，先把相同素材拖到一起合成。");
  updateHud();
  rafId = requestAnimationFrame(loop);
}

function buildBoard() {
  boardEl.innerHTML = "";
  slots = Array.from({ length: rows * cols }, (_, index) => ({ index }));
  slots.forEach((slot) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.dataset.index = slot.index;
    el.addEventListener("click", onSlotClick);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", onDrop);
    boardEl.appendChild(el);
  });
}

function buildLanes() {
  lanesEl.innerHTML = "";
  for (let i = 0; i < laneCount; i += 1) {
    const track = document.createElement("div");
    track.className = "lane-track";
    track.style.top = `${getLaneY(i)}%`;
    lanesEl.appendChild(track);
  }
  for (let i = 1; i < laneCount; i += 1) {
    const line = document.createElement("div");
    line.className = "lane-line";
    line.style.top = `${(i / laneCount) * 100}%`;
    lanesEl.appendChild(line);
  }
}

function renderRecipes() {
  recipeListEl.innerHTML = "";
  recipes.forEach((recipe) => {
    const item = document.createElement("div");
    item.className = "recipe";
    item.innerHTML = `<strong>${recipe.level}级 ${recipe.name}</strong><span>${recipe.note} · 伤害 ${recipe.damage}</span>`;
    recipeListEl.appendChild(item);
  });
}

function placeUnit(slotIndex, level) {
  const recipe = recipes[level - 1];
  if (!recipe || units.some((unit) => unit.slot === slotIndex)) return false;
  units.push({
    id: createId("unit"),
    slot: slotIndex,
    level,
    cooldown: Math.random() * recipe.speed,
  });
  renderUnits();
  return true;
}

function renderUnits() {
  boardEl.querySelectorAll(".unit").forEach((el) => el.remove());
  boardEl.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("selected-target"));
  units.forEach((unit) => {
    const recipe = recipes[unit.level - 1];
    const slotEl = boardEl.querySelector(`[data-index="${unit.slot}"]`);
    const el = document.createElement("div");
    el.className = `unit level-${unit.level}${unit.id === selectedId ? " selected" : ""}`;
    el.draggable = true;
    el.dataset.id = unit.id;
    el.innerHTML = `
      <div class="mark">${recipe.mark}</div>
      <div class="name">${recipe.name}</div>
      <div class="cooldown"><i style="width:${getCooldownPercent(unit)}%"></i></div>
    `;
    el.addEventListener("dragstart", (event) => {
      draggedId = unit.id;
      selectedId = unit.id;
      event.dataTransfer.effectAllowed = "move";
      el.classList.add("selected");
    });
    el.addEventListener("dragend", () => {
      draggedId = null;
      boardEl.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("over"));
    });
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if (selectedId && selectedId !== unit.id) {
        moveOrMerge(selectedId, unit.slot);
        return;
      }
      selectedId = selectedId === unit.id ? null : unit.id;
      renderUnits();
    });
    slotEl.appendChild(el);
  });
  if (selectedId) {
    boardEl.querySelectorAll(".slot").forEach((slot) => slot.classList.add("selected-target"));
  }
}

function onDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("over");
}

function onDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove("over");
  const targetSlot = Number(event.currentTarget.dataset.index);
  moveOrMerge(draggedId, targetSlot);
}

function onSlotClick(event) {
  if (event.target.closest(".unit")) return;
  if (!selectedId) return;
  const targetSlot = Number(event.currentTarget.dataset.index);
  moveOrMerge(selectedId, targetSlot);
}

function moveOrMerge(sourceId, targetSlot) {
  const dragged = units.find((unit) => unit.id === sourceId);
  if (!dragged) return;

  const occupant = units.find((unit) => unit.slot === targetSlot);
  if (!occupant) {
    dragged.slot = targetSlot;
    selectedId = null;
    renderUnits();
    return;
  }

  if (occupant.id === dragged.id) return;
  if (occupant.level === dragged.level && occupant.level < recipes.length) {
    const nextLevel = occupant.level + 1;
    units = units.filter((unit) => unit.id !== dragged.id && unit.id !== occupant.id);
    selectedId = null;
    placeUnit(targetSlot, nextLevel);
    showToast(`调成了 ${recipes[nextLevel - 1].name}`);
    return;
  }

  const oldSlot = dragged.slot;
  dragged.slot = occupant.slot;
  occupant.slot = oldSlot;
  selectedId = null;
  renderUnits();
}

function summon() {
  if (state.over) return;
  const free = slots.filter((slot) => !units.some((unit) => unit.slot === slot.index));
  if (!free.length) {
    showToast("调酒区满了，先合成或换位。");
    return;
  }
  if (state.spark < summonCost) {
    showToast("醒酒力不够，等一小会儿。");
    return;
  }
  state.spark -= summonCost;
  const slot = free[Math.floor(Math.random() * free.length)];
  placeUnit(slot.index, 1);
  updateHud();
}

function useSpecial() {
  if (state.over) return;
  if (state.spark < specialCost) {
    showToast("醒酒力不够发动全场冰镇。");
    return;
  }
  state.spark -= specialCost;
  enemies.forEach((enemy) => {
    enemy.hp -= 5;
    enemy.slowUntil = performance.now() + 2400;
  });
  showToast("全场冰镇发动，闹场速度下降。");
  updateHud();
}

function loop(now) {
  const delta = Math.min(50, now - lastTime);
  lastTime = now;
  if (!state.over) {
    updateGame(delta, now);
    renderGame();
  }
  rafId = requestAnimationFrame(loop);
}

function updateGame(delta, now) {
  state.spark = Math.min(maxSpark, state.spark + delta * 0.012);
  updateSpawns(delta);
  updateUnits(delta, now);
  updateEnemies(delta);
  updateProjectiles(delta);
  clearDefeatedEnemies();
  checkWaveEnd(delta);
  updateHud();
}

function updateSpawns(delta) {
  if (state.wavePause > 0) return;
  state.spawnTimer -= delta;
  if (state.spawnedInWave >= state.toSpawn || state.spawnTimer > 0) return;
  spawnEnemy();
  state.spawnedInWave += 1;
  state.spawnTimer = Math.max(420, 1250 - state.wave * 90);
}

function spawnEnemy() {
  const kindIndex = Math.min(enemyKinds.length - 1, Math.floor((state.wave - 1) / 2));
  const kind = enemyKinds[Math.floor(Math.random() * (kindIndex + 1))];
  const lane = Math.floor(Math.random() * laneCount);
  const hp = kind.hp + Math.ceil(state.wave * 1.2);
  enemies.push({
    id: createId("enemy"),
    lane,
    x: 92,
    hp,
    maxHp: hp,
    speed: kind.speed + state.wave * 1.2,
    damage: kind.damage,
    mark: kind.mark,
    name: kind.name,
    slowUntil: 0,
  });
}

function updateUnits(delta, now) {
  units.forEach((unit) => {
    const recipe = recipes[unit.level - 1];
    unit.cooldown -= delta;
    if (unit.cooldown > 0) return;
    const lane = Math.floor(unit.slot / cols);
    const target = enemies
      .filter((enemy) => enemy.lane === lane)
      .sort((a, b) => a.x - b.x)[0];
    if (!target) return;
    unit.cooldown = recipe.speed;
    fireProjectile(unit, target, recipe, now);
  });
}

function fireProjectile(unit, target, recipe) {
  const unitCenter = getUnitCenter(unit.slot);
  const targetCenter = getEnemyCenter(target);
  projectiles.push({
    id: createId("shot"),
    x: unitCenter.x,
    y: unitCenter.y,
    startX: unitCenter.x,
    startY: unitCenter.y,
    targetId: target.id,
    targetX: targetCenter.x,
    targetY: targetCenter.y,
    progress: 0,
    damage: recipe.damage,
    color: recipe.color,
    slow: recipe.slow || 0,
    splash: recipe.splash || 0,
  });
}

function updateEnemies(delta) {
  enemies.forEach((enemy) => {
    const chilled = enemy.slowUntil > performance.now();
    const speed = chilled ? enemy.speed * 0.45 : enemy.speed;
    enemy.x -= (speed * delta) / 1000;
  });

  enemies
    .filter((enemy) => enemy.x <= -8)
    .forEach((enemy) => {
      state.hp -= enemy.damage;
      showToast(`${enemy.name}撞到了吧台`);
    });

  enemies = enemies.filter((enemy) => enemy.x > -8);
  if (state.hp <= 0) endGame(false);
}

function updateProjectiles(delta) {
  projectiles.forEach((projectile) => {
    projectile.progress += delta / 210;
    const target = enemies.find((enemy) => enemy.id === projectile.targetId);
    if (target) {
      const center = getEnemyCenter(target);
      projectile.targetX = center.x;
      projectile.targetY = center.y;
    }
    const t = Math.min(1, projectile.progress);
    projectile.x = projectile.startX + (projectile.targetX - projectile.startX) * t;
    projectile.y = projectile.startY + (projectile.targetY - projectile.startY) * t;
    if (t >= 1) hitEnemy(projectile);
  });
  projectiles = projectiles.filter((projectile) => projectile.progress < 1);
}

function hitEnemy(projectile) {
  const target = enemies.find((enemy) => enemy.id === projectile.targetId);
  if (!target) return;
  target.hp -= projectile.damage;
  if (projectile.slow) {
    target.slowUntil = performance.now() + 1200 + projectile.slow * 1000;
  }
  if (projectile.splash) {
    enemies.forEach((enemy) => {
      if (enemy.id === target.id || enemy.lane !== target.lane) return;
      if (Math.abs(enemy.x - target.x) <= projectile.splash) {
        enemy.hp -= Math.ceil(projectile.damage * 0.45);
      }
    });
  }
}

function clearDefeatedEnemies() {
  const before = enemies.length;
  enemies = enemies.filter((enemy) => enemy.hp > 0);
  const defeated = before - enemies.length;
  if (defeated > 0) {
    state.score += defeated;
    state.spark = Math.min(maxSpark, state.spark + defeated * 8);
  }
}

function checkWaveEnd(delta) {
  if (state.wavePause > 0) {
    state.wavePause -= delta;
    if (state.wavePause <= 0) startNextWave();
    return;
  }
  if (state.spawnedInWave >= state.toSpawn && enemies.length === 0) {
    if (state.wave >= winWave) {
      endGame(true);
      return;
    }
    state.wavePause = 1400;
    state.spark = Math.min(maxSpark, state.spark + 30);
    showToast("这一波稳住了，补一点醒酒力。");
  }
}

function startNextWave() {
  state.wave += 1;
  state.spawnedInWave = 0;
  state.toSpawn = 4 + state.wave * 2;
  state.spawnTimer = 700;
  showToast(`第 ${state.wave} 波闹场开始`);
}

function renderGame() {
  updateUnitCooldowns();
  lanesEl.querySelectorAll(".enemy,.projectile").forEach((el) => el.remove());
  enemies.forEach((enemy) => {
    const el = document.createElement("div");
    el.className = "enemy";
    el.style.left = `${enemy.x}%`;
    el.style.top = `${getLaneY(enemy.lane)}%`;
    el.title = enemy.name;
    el.innerHTML = `<b>${enemy.mark}</b><em>${enemy.name}</em><small><i style="width:${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%"></i></small>`;
    lanesEl.appendChild(el);
  });
  projectiles.forEach((projectile) => {
    const el = document.createElement("div");
    el.className = "projectile";
    el.style.left = `${projectile.x}%`;
    el.style.top = `${projectile.y}%`;
    el.style.background = projectile.color;
    el.style.color = projectile.color;
    lanesEl.appendChild(el);
  });
}

function updateUnitCooldowns() {
  units.forEach((unit) => {
    const el = boardEl.querySelector(`.unit[data-id="${unit.id}"] .cooldown i`);
    if (el) el.style.width = `${getCooldownPercent(unit)}%`;
  });
}

function createId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function getCooldownPercent(unit) {
  const recipe = recipes[unit.level - 1];
  return Math.max(0, Math.min(100, 100 - (unit.cooldown / recipe.speed) * 100));
}

function getUnitCenter(slotIndex) {
  const lane = Math.floor(slotIndex / cols);
  return { x: -28, y: getLaneY(lane) };
}

function getEnemyCenter(enemy) {
  return { x: enemy.x, y: getLaneY(enemy.lane) };
}

function getLaneY(lane) {
  return ((lane + 0.5) / laneCount) * 100;
}

function updateHud() {
  waveEl.textContent = state.wave;
  barHpEl.textContent = Math.max(0, Math.ceil(state.hp));
  barHpFillEl.style.width = `${Math.max(0, (state.hp / maxHp) * 100)}%`;
  sparkEl.textContent = Math.floor(state.spark);
  sparkFillEl.style.width = `${Math.max(0, (state.spark / maxSpark) * 100)}%`;
  scoreEl.textContent = state.score;
  summonCostEl.textContent = summonCost;
  summonBtn.disabled = state.spark < summonCost || state.over;
  specialBtn.disabled = state.spark < specialCost || state.over;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function endGame(won) {
  state.over = true;
  resultKickerEl.textContent = won ? "营业成功" : "吧台失守";
  resultTitleEl.textContent = won ? "今晚清醒收工" : "酒劲冲破防线";
  resultTextEl.textContent = won
    ? `你守住了 ${winWave} 波闹场，清醒数 ${state.score}。`
    : `你清醒了 ${state.score} 个闹场客人，再调一次阵容。`;
  resultEl.classList.remove("hidden");
  updateHud();
}

summonBtn.addEventListener("click", summon);
specialBtn.addEventListener("click", useSpecial);
restartBtn.addEventListener("click", init);
resultRestartBtn.addEventListener("click", init);

init();
