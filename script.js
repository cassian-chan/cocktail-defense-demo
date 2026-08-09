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
const maxEnemyHp = 20;
const maxSpark = 100;
const summonCost = 16;
const specialCost = 50;
const winWave = 6;

const ingredients = {
  whiskey: { key: "whiskey", name: "威士忌", mark: "威", color: "#f3be58", weight: 1 },
  soda: { key: "soda", name: "苏打水", mark: "苏", color: "#5bd2d5", weight: 2 },
  gin: { key: "gin", name: "金酒", mark: "金", color: "#b7ef67", weight: 1.25 },
  tonic: { key: "tonic", name: "汤力水", mark: "汤", color: "#d8b4fe", weight: 1.25 },
  tequila: { key: "tequila", name: "龙舌兰", mark: "龙", color: "#f47796", weight: 1 },
  ginger: { key: "ginger", name: "姜汁汽水", mark: "姜", color: "#e0a94f", weight: 1.1 },
  lime: { key: "lime", name: "青柠", mark: "柠", color: "#9be15d", weight: 0.9 },
};

const cocktails = [
  { inputs: ["whiskey", "soda"], name: "Highball", mark: "高", hp: 8, damage: 2, speed: 13, attackSpeed: 780, color: "#f3be58", note: "威士忌 + 苏打水" },
  { inputs: ["tequila", "soda"], name: "Paloma", mark: "帕", hp: 9, damage: 2, speed: 12, attackSpeed: 720, color: "#f47796", note: "龙舌兰 + 苏打水" },
  { inputs: ["gin", "tonic"], name: "金汤力", mark: "汤", hp: 8, damage: 3, speed: 11, attackSpeed: 820, color: "#b7ef67", note: "金酒 + 汤力水" },
  { inputs: ["gin", "ginger"], name: "Gin Ginger", mark: "姜", hp: 7, damage: 2, speed: 16, attackSpeed: 640, color: "#e0a94f", note: "金酒 + 姜汁汽水" },
  { inputs: ["whiskey", "ginger"], name: "Whisky Ginger", mark: "士", hp: 10, damage: 2, speed: 10, attackSpeed: 760, color: "#f0a348", note: "威士忌 + 姜汁汽水" },
  { inputs: ["tequila", "lime"], name: "青柠龙舌兰", mark: "青", hp: 6, damage: 4, speed: 15, attackSpeed: 920, color: "#9be15d", note: "龙舌兰 + 青柠" },
  { inputs: ["soda", "lime"], name: "青柠苏打", mark: "泡", hp: 6, damage: 1, speed: 18, attackSpeed: 520, color: "#5bd2d5", note: "苏打水 + 青柠" },
];

const recipeMap = new Map(cocktails.map((recipe) => [recipeKey(recipe.inputs), recipe]));

const enemyKinds = [
  { name: "酒蒙子", mark: "醉", hp: 5, speed: 9, damage: 1, attackSpeed: 880 },
  { name: "劝酒怪", mark: "劝", hp: 8, speed: 7, damage: 2, attackSpeed: 980 },
  { name: "宿醉影", mark: "晕", hp: 11, speed: 6, damage: 3, attackSpeed: 1120 },
];

let slots = [];
let units = [];
let allies = [];
let enemies = [];
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
    enemyHp: maxEnemyHp,
    spark: 72,
    mixes: 0,
    wave: 1,
    spawnTimer: 900,
    spawnedInWave: 0,
    toSpawn: 4,
    wavePause: 0,
    over: false,
  };
}

function init() {
  cancelAnimationFrame(rafId);
  state = newState();
  units = [];
  allies = [];
  enemies = [];
  draggedId = null;
  dragState = null;
  removeDragGhost();
  lastTime = performance.now();
  buildBoard();
  buildLanes();
  renderRecipes();
  placeIngredient(0, "whiskey");
  placeIngredient(1, "soda");
  placeIngredient(3, "gin");
  placeIngredient(4, "tonic");
  placeIngredient(6, "tequila");
  placeIngredient(7, "ginger");
  resultEl.classList.add("hidden");
  showToast("拖动素材到另一种素材上，按配方调出鸡尾酒出战。");
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
  cocktails.forEach((recipe) => {
    const item = document.createElement("div");
    item.className = "recipe";
    item.innerHTML = `<strong>${recipe.name}</strong><span>${recipe.note} · 攻击 ${recipe.damage}</span>`;
    recipeListEl.appendChild(item);
  });
}

function placeIngredient(slotIndex, key) {
  const ingredient = ingredients[key];
  if (!ingredient || units.some((unit) => unit.slot === slotIndex)) return false;
  units.push({
    id: createId("unit"),
    slot: slotIndex,
    key,
  });
  renderUnits();
  return true;
}

function renderUnits() {
  boardEl.querySelectorAll(".unit").forEach((el) => el.remove());
  boardEl.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("over", "mixable"));
  units.forEach((unit) => {
    const ingredient = ingredients[unit.key];
    const slotEl = boardEl.querySelector(`[data-index="${unit.slot}"]`);
    const el = document.createElement("div");
    el.className = "unit ingredient-card";
    el.draggable = false;
    el.dataset.id = unit.id;
    el.style.background = ingredient.color;
    el.innerHTML = `
      <div class="mark">${ingredient.mark}</div>
      <div class="name">${ingredient.name}</div>
    `;
    el.addEventListener("pointerdown", (event) => startUnitDrag(event, unit.id));
    slotEl.appendChild(el);
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
  if (targetSlot === sourceSlot) {
    renderUnits();
    return;
  }

  moveOrMix(sourceId, targetSlot);
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
  slotEl.classList.add("over");
  const targetSlot = Number(slotEl.dataset.index);
  const source = units.find((unit) => unit.id === dragState.unitId);
  const target = units.find((unit) => unit.slot === targetSlot);
  if (source && target && source.id !== target.id && findRecipe(source.key, target.key)) {
    slotEl.classList.add("mixable");
  }
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

function findRecipe(a, b) {
  return recipeMap.get(recipeKey([a, b]));
}

function moveOrMix(sourceId, targetSlot) {
  const dragged = units.find((unit) => unit.id === sourceId);
  if (!dragged) return;

  const occupant = units.find((unit) => unit.slot === targetSlot);
  if (!occupant) {
    dragged.slot = targetSlot;
    renderUnits();
    return;
  }

  if (occupant.id === dragged.id) {
    renderUnits();
    return;
  }

  const recipe = findRecipe(dragged.key, occupant.key);
  if (recipe) {
    const lane = Math.floor(targetSlot / cols);
    units = units.filter((unit) => unit.id !== dragged.id && unit.id !== occupant.id);
    spawnAlly(recipe, lane);
    state.mixes += 1;
    state.spark = Math.min(maxSpark, state.spark + 10);
    renderUnits();
    showToast(`${ingredients[dragged.key].name} + ${ingredients[occupant.key].name} = ${recipe.name}`);
    return;
  }

  const oldSlot = dragged.slot;
  dragged.slot = occupant.slot;
  occupant.slot = oldSlot;
  renderUnits();
  showToast("这个组合暂时没有酒单，已交换位置。");
}

function spawnAlly(recipe, lane) {
  allies.push({
    id: createId("ally"),
    lane,
    x: 8,
    hp: recipe.hp,
    maxHp: recipe.hp,
    damage: recipe.damage,
    speed: recipe.speed,
    attackSpeed: recipe.attackSpeed,
    cooldown: 120,
    mark: recipe.mark,
    name: recipe.name,
    color: recipe.color,
    engagedId: null,
  });
}

function summon() {
  if (state.over) return;
  const free = slots.filter((slot) => !units.some((unit) => unit.slot === slot.index));
  if (!free.length) {
    showToast("调酒区满了，先拖动素材组合或换位。");
    return;
  }
  if (state.spark < summonCost) {
    showToast("调酒力不够，等一小会儿。");
    return;
  }
  state.spark -= summonCost;
  const slot = free[Math.floor(Math.random() * free.length)];
  placeIngredient(slot.index, randomIngredientKey());
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
    enemy.hp -= 3;
    enemy.slowUntil = performance.now() + 2500;
  });
  showToast("全场冰镇发动，酒蒙子推进变慢。");
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
  state.spark = Math.min(maxSpark, state.spark + delta * 0.014);
  updateSpawns(delta);
  updateBattle(delta, now);
  clearDefeated();
  checkWaveEnd(delta);
  updateHud();
}

function updateSpawns(delta) {
  if (state.wavePause > 0) return;
  state.spawnTimer -= delta;
  if (state.spawnedInWave >= state.toSpawn || state.spawnTimer > 0) return;
  spawnEnemy();
  state.spawnedInWave += 1;
  state.spawnTimer = Math.max(620, 1450 - state.wave * 90);
}

function spawnEnemy() {
  const kindIndex = Math.min(enemyKinds.length - 1, Math.floor((state.wave - 1) / 2));
  const kind = enemyKinds[Math.floor(Math.random() * (kindIndex + 1))];
  const lane = Math.floor(Math.random() * laneCount);
  const hp = kind.hp + Math.ceil(state.wave * 1.15);
  enemies.push({
    id: createId("enemy"),
    lane,
    x: 92,
    hp,
    maxHp: hp,
    damage: kind.damage,
    speed: kind.speed + state.wave * 0.45,
    attackSpeed: kind.attackSpeed,
    cooldown: 260,
    mark: kind.mark,
    name: kind.name,
    slowUntil: 0,
    engagedId: null,
  });
}

function updateBattle(delta, now) {
  allies.forEach((ally) => {
    const target = findClosestEnemy(ally);
    ally.engagedId = target && Math.abs(target.x - ally.x) <= 9 ? target.id : null;
    if (ally.engagedId) {
      attack(ally, target, delta);
      return;
    }
    ally.x += (ally.speed * delta) / 1000;
  });

  enemies.forEach((enemy) => {
    const target = findClosestAlly(enemy);
    enemy.engagedId = target && Math.abs(target.x - enemy.x) <= 9 ? target.id : null;
    if (enemy.engagedId) {
      attack(enemy, target, delta);
      return;
    }
    const chilled = enemy.slowUntil > now;
    const speed = chilled ? enemy.speed * 0.48 : enemy.speed;
    enemy.x -= (speed * delta) / 1000;
  });

  allies
    .filter((ally) => ally.x >= 100)
    .forEach((ally) => {
      state.enemyHp -= 2;
      state.spark = Math.min(maxSpark, state.spark + 8);
      showToast(`${ally.name}冲散了对面吧台`);
    });
  allies = allies.filter((ally) => ally.x < 100);

  enemies
    .filter((enemy) => enemy.x <= 0)
    .forEach((enemy) => {
      state.hp -= enemy.damage;
      showToast(`${enemy.name}闯进了吧台`);
    });
  enemies = enemies.filter((enemy) => enemy.x > 0);

  if (state.enemyHp <= 0) endGame(true);
  if (state.hp <= 0) endGame(false);
}

function findClosestEnemy(ally) {
  return enemies
    .filter((enemy) => enemy.lane === ally.lane && enemy.x >= ally.x - 2)
    .sort((a, b) => a.x - b.x)[0];
}

function findClosestAlly(enemy) {
  return allies
    .filter((ally) => ally.lane === enemy.lane && ally.x <= enemy.x + 2)
    .sort((a, b) => b.x - a.x)[0];
}

function attack(attacker, target, delta) {
  attacker.cooldown -= delta;
  if (attacker.cooldown > 0) return;
  target.hp -= attacker.damage;
  attacker.cooldown = attacker.attackSpeed;
}

function clearDefeated() {
  const defeatedEnemies = enemies.filter((enemy) => enemy.hp <= 0).length;
  const defeatedAllies = allies.filter((ally) => ally.hp <= 0).length;
  enemies = enemies.filter((enemy) => enemy.hp > 0);
  allies = allies.filter((ally) => ally.hp > 0);
  if (defeatedEnemies > 0) {
    state.spark = Math.min(maxSpark, state.spark + defeatedEnemies * 7);
  }
  if (defeatedAllies > 0) {
    state.spark = Math.min(maxSpark, state.spark + defeatedAllies * 3);
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
      state.enemyHp -= 4;
      if (state.enemyHp <= 0) endGame(true);
    }
    state.wavePause = 1400;
    state.spark = Math.min(maxSpark, state.spark + 24);
    showToast("这一轮压住了，补充调酒力。");
  }
}

function startNextWave() {
  state.wave += 1;
  state.spawnedInWave = 0;
  state.toSpawn = 3 + state.wave * 2;
  state.spawnTimer = 700;
  showToast(`第 ${state.wave} 轮对战开始`);
}

function renderGame() {
  lanesEl.querySelectorAll(".enemy,.ally").forEach((el) => el.remove());
  allies.forEach((ally) => {
    const el = document.createElement("div");
    el.className = "ally";
    el.style.left = `${ally.x}%`;
    el.style.top = `${getLaneY(ally.lane)}%`;
    el.style.background = `linear-gradient(180deg, ${ally.color}, #243032)`;
    el.title = ally.name;
    el.innerHTML = `<b>${ally.mark}</b><em>${ally.name}</em><small><i style="width:${Math.max(0, (ally.hp / ally.maxHp) * 100)}%"></i></small>`;
    lanesEl.appendChild(el);
  });
  enemies.forEach((enemy) => {
    const el = document.createElement("div");
    el.className = "enemy";
    el.style.left = `${enemy.x}%`;
    el.style.top = `${getLaneY(enemy.lane)}%`;
    el.title = enemy.name;
    el.innerHTML = `<b>${enemy.mark}</b><em>${enemy.name}</em><small><i style="width:${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%"></i></small>`;
    lanesEl.appendChild(el);
  });
}

function createId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
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
  scoreEl.textContent = Math.max(0, Math.ceil(state.enemyHp));
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
  resultKickerEl.textContent = won ? "调酒胜利" : "吧台失守";
  resultTitleEl.textContent = won ? "组合打穿对局" : "酒蒙子压过来了";
  resultTextEl.textContent = won
    ? `你调出了 ${state.mixes} 杯组合酒，把对面吧台打散了。`
    : `你完成了 ${state.mixes} 次有效组合，再调一次配方节奏。`;
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
