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
const summonCost = 18;
const specialCost = 50;
const winWave = 6;
const maxLevel = 4;
const initialUnlockedSlots = 9;

const ingredients = {
  soda: { key: "soda", name: "苏打水", mark: "苏", color: "#5bd2d5", weight: 2.2 },
  whiskey: { key: "whiskey", name: "威士忌", mark: "威", color: "#f3be58", weight: 1.2 },
  gin: { key: "gin", name: "金酒", mark: "金", color: "#b7ef67", weight: 1.25 },
  tonic: { key: "tonic", name: "汤力水", mark: "汤", color: "#d8b4fe", weight: 1.25 },
  tequila: { key: "tequila", name: "龙舌兰", mark: "龙", color: "#f47796", weight: 1 },
  ginger: { key: "ginger", name: "姜汁汽水", mark: "姜", color: "#e0a94f", weight: 1.1 },
  lime: { key: "lime", name: "青柠", mark: "柠", color: "#9be15d", weight: 0.95 },
};

const comboRecipes = [
  { inputs: ["whiskey", "soda"], name: "Highball", mark: "高", damage: 4, speed: 620, color: "#f3be58", note: "威士忌 + 苏打水" },
  { inputs: ["tequila", "soda"], name: "Paloma", mark: "帕", damage: 4, speed: 560, color: "#f47796", splash: 28, note: "龙舌兰 + 苏打水" },
  { inputs: ["gin", "tonic"], name: "金汤力", mark: "汤", damage: 5, speed: 680, color: "#b7ef67", slow: 0.62, note: "金酒 + 汤力水" },
  { inputs: ["gin", "ginger"], name: "Gin Ginger", mark: "姜", damage: 4, speed: 500, color: "#e0a94f", note: "金酒 + 姜汁汽水" },
  { inputs: ["whiskey", "ginger"], name: "Whisky Ginger", mark: "士", damage: 5, speed: 700, color: "#f0a348", slow: 0.72, note: "威士忌 + 姜汁汽水" },
  { inputs: ["tequila", "lime"], name: "青柠龙舌兰", mark: "青", damage: 7, speed: 860, color: "#9be15d", note: "龙舌兰 + 青柠" },
  { inputs: ["soda", "lime"], name: "青柠苏打", mark: "泡", damage: 3, speed: 460, color: "#5bd2d5", slow: 0.8, note: "苏打水 + 青柠" },
];

const comboMap = new Map(comboRecipes.map((recipe) => [recipeKey(recipe.inputs), recipe]));

const enemyKinds = [
  { name: "酒蒙子", mark: "醉", hp: 5, speed: 21, damage: 1 },
  { name: "劝酒怪", mark: "劝", hp: 8, speed: 17, damage: 2 },
  { name: "宿醉影", mark: "晕", hp: 12, speed: 14, damage: 3 },
];

let slots = [];
let units = [];
let combos = [];
let enemies = [];
let projectiles = [];
let draggedId = null;
let dragState = null;
let dragGhost = null;
let state;
let lastTime = 0;
let toastTimer = 0;
let rafId = 0;
let idCounter = 0;

function recipeKey(keys) {
  return [...keys].sort().join("+");
}

function newState() {
  return {
    hp: maxHp,
    spark: 76,
    score: 0,
    wave: 1,
    unlockedSlots: initialUnlockedSlots,
    actionCount: 0,
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
  combos = [];
  enemies = [];
  projectiles = [];
  draggedId = null;
  dragState = null;
  removeDragGhost();
  lastTime = performance.now();
  buildBoard();
  buildLanes();
  renderRecipes();
  placeUnit(0, "soda", 1);
  placeUnit(1, "soda", 1);
  placeUnit(3, "gin", 1);
  placeUnit(4, "tonic", 1);
  placeUnit(6, "whiskey", 1);
  resultEl.classList.add("hidden");
  showToast("相同素材拖到一起升级；不同素材相邻会组成双格鸡尾酒。");
  updateCombos();
  updateHud();
  rafId = requestAnimationFrame(loop);
}

function buildBoard() {
  boardEl.innerHTML = "";
  slots = Array.from({ length: rows * cols }, (_, index) => ({ index }));
  slots.forEach((slot) => {
    const el = document.createElement("div");
    el.className = `slot${isSlotLocked(slot.index) ? " locked" : ""}`;
    el.dataset.index = slot.index;
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
  comboRecipes.forEach((recipe) => {
    const item = document.createElement("div");
    item.className = "recipe";
    item.innerHTML = `<strong>${recipe.name}</strong><span>${recipe.note} · 双格组合</span>`;
    recipeListEl.appendChild(item);
  });
}

function isSlotLocked(slotIndex) {
  return slotIndex >= state.unlockedSlots;
}

function placeUnit(slotIndex, key, level = 1) {
  const ingredient = ingredients[key];
  if (!ingredient || isSlotLocked(slotIndex) || units.some((unit) => unit.slot === slotIndex)) return false;
  units.push({
    id: createId("unit"),
    slot: slotIndex,
    key,
    level,
    cooldown: Math.random() * getUnitSpeed(level),
    comboId: null,
  });
  updateCombos();
  renderUnits();
  return true;
}

function renderUnits() {
  boardEl.querySelectorAll(".unit,.combo-bridge").forEach((el) => el.remove());
  boardEl.querySelectorAll(".slot").forEach((slot) => {
    const index = Number(slot.dataset.index);
    slot.classList.toggle("locked", isSlotLocked(index));
    slot.classList.remove("over", "mixable");
  });

  renderComboBridges();

  units.forEach((unit) => {
    const ingredient = ingredients[unit.key];
    const slotEl = boardEl.querySelector(`[data-index="${unit.slot}"]`);
    const combo = combos.find((item) => item.id === unit.comboId);
    const el = document.createElement("div");
    el.className = `unit ingredient-card level-${unit.level}${combo ? " combo-member" : ""}`;
    el.draggable = false;
    el.dataset.id = unit.id;
    el.style.background = ingredient.color;
    el.innerHTML = `
      <div class="mark">${ingredient.mark}</div>
      <div class="name">${ingredient.name}</div>
      <div class="level-badge">Lv.${unit.level}</div>
      ${combo ? `<div class="combo-badge">${combo.recipe.name}</div>` : ""}
    `;
    el.addEventListener("pointerdown", (event) => startUnitDrag(event, unit.id));
    slotEl.appendChild(el);
  });
}

function renderComboBridges() {
  combos.forEach((combo) => {
    const [a, b] = combo.slots;
    const aEl = boardEl.querySelector(`[data-index="${a}"]`);
    const bEl = boardEl.querySelector(`[data-index="${b}"]`);
    if (!aEl || !bEl) return;
    const bridge = document.createElement("div");
    bridge.className = `combo-bridge ${Math.abs(a - b) === 1 ? "horizontal" : "vertical"}`;
    bridge.textContent = combo.recipe.mark;
    const anchor = a < b ? aEl : bEl;
    anchor.appendChild(bridge);
  });
}

function startUnitDrag(event, unitId) {
  if (state.over) return;
  if (event.button !== undefined && event.button !== 0) return;

  const unit = units.find((item) => item.id === unitId);
  if (!unit) return;

  event.preventDefault();
  draggedId = unitId;
  const sourceEl = event.currentTarget;
  dragState = {
    unitId,
    sourceEl,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    sourceSlot: unit.slot,
    hasMoved: false,
  };

  document.body.classList.add("is-dragging");
  sourceEl.classList.add("dragging");
  sourceEl.setPointerCapture?.(event.pointerId);
  createDragGhost(sourceEl, event.clientX, event.clientY);

  sourceEl.addEventListener("pointermove", onUnitDragMove);
  sourceEl.addEventListener("pointerup", onUnitDragEnd, { once: true });
  sourceEl.addEventListener("pointercancel", onUnitDragCancel, { once: true });
}

function onUnitDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();

  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  if (Math.hypot(dx, dy) > 4) dragState.hasMoved = true;

  moveDragGhost(event.clientX, event.clientY);
  highlightDropSlot(getSlotFromPoint(event.clientX, event.clientY));
}

function onUnitDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();

  const targetSlotEl = getSlotFromPoint(event.clientX, event.clientY);
  const sourceId = dragState.unitId;
  const sourceSlot = dragState.sourceSlot;
  const hasMoved = dragState.hasMoved;
  cleanupDrag();

  if (!hasMoved || !targetSlotEl) {
    renderUnits();
    return;
  }

  const targetSlot = Number(targetSlotEl.dataset.index);
  if (targetSlot === sourceSlot || isSlotLocked(targetSlot)) {
    renderUnits();
    return;
  }

  moveOrMerge(sourceId, targetSlot);
}

function onUnitDragCancel(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  cleanupDrag();
  renderUnits();
}

function createDragGhost(sourceEl, x, y) {
  removeDragGhost();
  const rect = sourceEl.getBoundingClientRect();
  dragGhost = sourceEl.cloneNode(true);
  dragGhost.classList.remove("dragging");
  dragGhost.classList.add("drag-ghost");
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.height = `${rect.height}px`;
  document.body.appendChild(dragGhost);
  moveDragGhost(x, y);
}

function moveDragGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = `${x}px`;
  dragGhost.style.top = `${y}px`;
}

function removeDragGhost() {
  dragGhost?.remove();
  dragGhost = null;
}

function getSlotFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest?.(".slot") || null;
}

function highlightDropSlot(slotEl) {
  boardEl.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("over", "mixable"));
  if (!slotEl || !dragState) return;
  const targetSlot = Number(slotEl.dataset.index);
  if (isSlotLocked(targetSlot)) return;
  slotEl.classList.add("over");

  const source = units.find((unit) => unit.id === dragState.unitId);
  const target = units.find((unit) => unit.slot === targetSlot);
  if (!source || !target || source.id === target.id) return;
  const canUpgrade = source.key === target.key && source.level === target.level && source.level < maxLevel;
  const canCombo = source.key !== target.key && areAdjacent(source.slot, target.slot) && findCombo(source.key, target.key);
  if (canUpgrade || canCombo) slotEl.classList.add("mixable");
}

function cleanupDrag() {
  if (!dragState) return;
  const { sourceEl, pointerId } = dragState;
  sourceEl.removeEventListener("pointermove", onUnitDragMove);
  sourceEl.releasePointerCapture?.(pointerId);
  sourceEl.classList.remove("dragging");
  boardEl.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("over", "mixable"));
  document.body.classList.remove("is-dragging");
  removeDragGhost();
  draggedId = null;
  dragState = null;
}

function findCombo(a, b) {
  return comboMap.get(recipeKey([a, b]));
}

function moveOrMerge(sourceId, targetSlot) {
  const dragged = units.find((unit) => unit.id === sourceId);
  if (!dragged) return;

  const occupant = units.find((unit) => unit.slot === targetSlot);
  if (!occupant) {
    dragged.slot = targetSlot;
    afterBoardChange("移动成功。靠近不同素材可以组成鸡尾酒。");
    return;
  }

  if (occupant.id === dragged.id) {
    renderUnits();
    return;
  }

  if (occupant.key === dragged.key && occupant.level === dragged.level && occupant.level < maxLevel) {
    const nextLevel = occupant.level + 1;
    units = units.filter((unit) => unit.id !== dragged.id && unit.id !== occupant.id);
    units.push({
      id: createId("unit"),
      slot: targetSlot,
      key: occupant.key,
      level: nextLevel,
      cooldown: 120,
      comboId: null,
    });
    afterBoardChange(`${ingredients[occupant.key].name} 升到 Lv.${nextLevel}`);
    return;
  }

  const oldSlot = dragged.slot;
  dragged.slot = occupant.slot;
  occupant.slot = oldSlot;
  afterBoardChange("已交换位置。相邻配方会自动组成双格鸡尾酒。");
}

function afterBoardChange(message) {
  const before = combos.length;
  state.actionCount += 1;
  updateCombos();
  renderUnits();
  unlockByProgress();
  const formed = combos.length > before;
  if (formed) {
    const newest = combos[combos.length - 1];
    showToast(`组成 ${newest.recipe.name}，双格攻击增强。`);
    return;
  }
  showToast(message);
}

function updateCombos() {
  const cooldowns = new Map(combos.map((combo) => [combo.id, combo.cooldown]));
  units.forEach((unit) => {
    unit.comboId = null;
  });

  const next = [];
  const used = new Set();
  const sortedUnits = [...units].sort((a, b) => a.slot - b.slot);
  sortedUnits.forEach((unit) => {
    if (used.has(unit.id)) return;
    const mate = sortedUnits.find((candidate) => {
      if (used.has(candidate.id) || candidate.id === unit.id) return false;
      return areAdjacent(unit.slot, candidate.slot) && findCombo(unit.key, candidate.key);
    });
    if (!mate) return;
    const recipe = findCombo(unit.key, mate.key);
    const ids = [unit.id, mate.id].sort();
    const id = `${recipeKey([unit.key, mate.key])}:${ids.join("-")}`;
    unit.comboId = id;
    mate.comboId = id;
    used.add(unit.id);
    used.add(mate.id);
    next.push({
      id,
      recipe,
      unitIds: [unit.id, mate.id],
      slots: [unit.slot, mate.slot].sort((a, b) => a - b),
      cooldown: cooldowns.get(id) ?? Math.random() * recipe.speed,
    });
  });
  combos = next;
}

function areAdjacent(a, b) {
  const ar = Math.floor(a / cols);
  const ac = a % cols;
  const br = Math.floor(b / cols);
  const bc = b % cols;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function unlockByProgress() {
  if (state.unlockedSlots >= slots.length) return;
  if (state.actionCount % 2 !== 0) return;
  state.unlockedSlots += 1;
  renderUnits();
  showToast("新地块解锁，可以扩展布阵。");
}

function summon() {
  if (state.over) return;
  const free = slots.filter((slot) => !isSlotLocked(slot.index) && !units.some((unit) => unit.slot === slot.index));
  if (!free.length) {
    showToast("调酒区满了，先升级、换位或等地块解锁。");
    return;
  }
  if (state.spark < summonCost) {
    showToast("调酒力不够，等一小会儿。");
    return;
  }
  state.spark -= summonCost;
  const slot = free[Math.floor(Math.random() * free.length)];
  placeUnit(slot.index, randomIngredientKey(), 1);
  updateHud();
}

function randomIngredientKey() {
  const pool = Object.values(ingredients);
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item.key;
  }
  return pool[0].key;
}

function useSpecial() {
  if (state.over) return;
  if (state.spark < specialCost) {
    showToast("调酒力不够发动全场冰镇。");
    return;
  }
  state.spark -= specialCost;
  enemies.forEach((enemy) => {
    enemy.hp -= 4;
    enemy.slowUntil = performance.now() + 2500;
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
  updateCombosAttack(delta);
  updateEnemies(delta, now);
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
  state.spawnTimer = Math.max(440, 1260 - state.wave * 80);
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
    speed: kind.speed + state.wave * 0.9,
    damage: kind.damage,
    mark: kind.mark,
    name: kind.name,
    slowUntil: 0,
  });
}

function updateUnits(delta, now) {
  units.forEach((unit) => {
    if (unit.comboId) return;
    unit.cooldown -= delta;
    if (unit.cooldown > 0) return;
    const lane = Math.floor(unit.slot / cols);
    const target = getTargetInLanes([lane]);
    if (!target) return;
    const damage = unit.level;
    const color = ingredients[unit.key].color;
    unit.cooldown = getUnitSpeed(unit.level);
    fireProjectile(getUnitCenter(unit.slot), getEnemyCenter(target), target.id, damage, color, { slow: unit.key === "soda" ? 0.88 : 0 });
  });
}

function updateCombosAttack(delta) {
  combos.forEach((combo) => {
    combo.cooldown -= delta;
    if (combo.cooldown > 0) return;
    const pairUnits = combo.unitIds.map((id) => units.find((unit) => unit.id === id)).filter(Boolean);
    if (pairUnits.length < 2) return;
    const lanes = [...new Set(pairUnits.map((unit) => Math.floor(unit.slot / cols)))];
    const target = getTargetInLanes(lanes);
    if (!target) return;
    const levelBonus = pairUnits.reduce((sum, unit) => sum + unit.level, 0);
    const damage = combo.recipe.damage + levelBonus;
    const source = getComboCenter(pairUnits);
    combo.cooldown = combo.recipe.speed;
    fireProjectile(source, getEnemyCenter(target), target.id, damage, combo.recipe.color, combo.recipe);
  });
}

function getTargetInLanes(lanes) {
  return enemies
    .filter((enemy) => lanes.includes(enemy.lane))
    .sort((a, b) => a.x - b.x)[0];
}

function fireProjectile(source, target, targetId, damage, color, effect = {}) {
  projectiles.push({
    id: createId("shot"),
    x: source.x,
    y: source.y,
    startX: source.x,
    startY: source.y,
    targetId,
    targetX: target.x,
    targetY: target.y,
    progress: 0,
    damage,
    color,
    slow: effect.slow || 0,
    splash: effect.splash || 0,
  });
}

function updateEnemies(delta, now) {
  enemies.forEach((enemy) => {
    const chilled = enemy.slowUntil > now;
    const speed = chilled ? enemy.speed * 0.46 : enemy.speed;
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
  if (projectile.slow) target.slowUntil = performance.now() + 1200 + projectile.slow * 1000;
  if (projectile.splash) {
    enemies.forEach((enemy) => {
      if (enemy.id === target.id || enemy.lane !== target.lane) return;
      if (Math.abs(enemy.x - target.x) <= projectile.splash) enemy.hp -= Math.ceil(projectile.damage * 0.42);
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
    if (state.unlockedSlots < slots.length) {
      state.unlockedSlots += 1;
      renderUnits();
      showToast("守住一轮，解锁新地块。");
    } else {
      showToast("这一轮稳住了，补一点调酒力。");
    }
  }
}

function startNextWave() {
  state.wave += 1;
  state.spawnedInWave = 0;
  state.toSpawn = 4 + state.wave * 2;
  state.spawnTimer = 700;
  showToast(`第 ${state.wave} 轮闹场开始`);
}

function renderGame() {
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

function getUnitSpeed(level) {
  return Math.max(500, 940 - level * 95);
}

function createId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function getUnitCenter(slotIndex) {
  const lane = Math.floor(slotIndex / cols);
  return { x: -26, y: getLaneY(lane) };
}

function getComboCenter(pairUnits) {
  const lanes = pairUnits.map((unit) => Math.floor(unit.slot / cols));
  return { x: -22, y: lanes.reduce((sum, lane) => sum + getLaneY(lane), 0) / lanes.length };
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
  if (state.over) return;
  state.over = true;
  resultKickerEl.textContent = won ? "营业成功" : "吧台失守";
  resultTitleEl.textContent = won ? "组合守住了夜场" : "酒劲冲破防线";
  resultTextEl.textContent = won
    ? `你用升级素材和双格鸡尾酒守住了 ${winWave} 轮。`
    : `清醒了 ${state.score} 个闹场客人，再调一次布阵节奏。`;
  resultEl.classList.remove("hidden");
  updateHud();
}

preventIOSGestureZoom();

summonBtn.addEventListener("click", summon);
specialBtn.addEventListener("click", useSpecial);
restartBtn.addEventListener("click", init);
resultRestartBtn.addEventListener("click", init);

document.querySelector(".game").addEventListener("contextmenu", (event) => event.preventDefault());

function preventIOSGestureZoom() {
  let lastTouchEnd = 0;
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) event.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

init();
