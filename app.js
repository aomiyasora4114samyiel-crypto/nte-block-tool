"use strict";

const COLORS = {
  GRID: "#111111",
  UNUSED: "#666666",
  SET: "#6f42a8",
  WANTED: "#ed7430",
  FILLER: "#4aa3df",
  OUTLINE: "#ff1f2d"
};
const RAINBOW = "__RAINBOW__";

const CHARACTER_PATTERNS = [
  [[0,0],[2,3],[3,2],[3,3],[4,4]],
  [[0,2],[3,0],[3,4],[4,0],[4,4]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,4],[1,4],[2,2],[3,0],[4,0]]
];

const SET_EFFECT_BLOCKS = {
  "失われた光(光)": [
    [[0,0],[0,1]],
    [[0,0],[1,0],[1,1]],
    [[0,0],[0,1],[1,1]],
    [[0,0],[1,0],[2,0],[3,0]]
  ],
  "ディアボロス(闇)": [
    [[0,0],[1,0]],
    [[0,0],[1,0],[0,1]],
    [[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[0,3]]
  ],
  "悪魔の血：呪い(魂)": [
    [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[0,1]],
    [[1,0],[2,0],[0,1],[1,1]]
  ],
  "ストリート拳王(相)": [
    [[0,0],[0,1]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[0,1],[1,1]],
    [[1,0],[1,1],[0,1],[0,2]]
  ],
  "森に棲む蛍の心(霊)": [
    [[0,0],[0,1]],
    [[0,0],[1,0],[2,0]],
    [[0,0],[1,0],[1,1]],
    [[1,0],[2,0],[0,1],[1,1]]
  ],
  "深紅の双生蝶(呪)": [
    [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]],
    [[0,1],[1,0],[1,1]],
    [[1,0],[1,1],[0,1],[0,2]]
  ],
  "音速ヘッジホッグ(サポ)": [
    [[0,0],[1,0],[1,1]],
    [[0,0],[1,0],[0,1]],
    [[0,0],[0,1],[1,1]],
    [[0,1],[1,0],[1,1]]
  ],
  "静寂な山荘(精)": [
    [[0,0],[0,1]],
    [[0,0],[1,0]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[1,0],[2,0],[0,1],[1,1]]
  ]
};

const WANTED_GROUPS = [
  { label: "Ⅱ型", shapes: [
    [[0,0],[0,1]],
    [[0,0],[1,0]]
  ]},
  { label: "Ⅲ型", shapes: [
    [[0,0],[1,0],[1,1]],
    [[0,0],[0,1],[1,0]],
    [[0,0],[0,1],[1,1]],
    [[0,1],[1,0],[1,1]],
    [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[0,2]]
  ]},
  { label: "Ⅳ型", shapes: [
    [[0,1],[1,0],[1,1],[2,0]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[0,3]]
  ]}
];

const state = {
  selectedCharacterIndex: 2,
  wantedSelected: [], // [groupIndex, shapeIndex]
  calculatedPlacements: []
};

const boardCanvas = document.getElementById("boardCanvas");
const boardCtx = boardCanvas.getContext("2d");
const gearType = document.getElementById("gearType");
const equipmentSelect = document.getElementById("equipmentSelect");
const calculateButton = document.getElementById("calculateButton");
const characterPatterns = document.getElementById("characterPatterns");
const setEffectBlocks = document.getElementById("setEffectBlocks");
const wantedSlots = document.getElementById("wantedSlots");
const wantedDialog = document.getElementById("wantedDialog");
const wantedGroups = document.getElementById("wantedGroups");
const wantedCountText = document.getElementById("wantedCountText");
const status = document.getElementById("status");

function normalizeShape(shape) {
  const minR = Math.min(...shape.map(([r]) => r));
  const minC = Math.min(...shape.map(([,c]) => c));
  return shape.map(([r,c]) => [r - minR, c - minC]).sort(coordSort);
}

function coordSort(a,b) { return a[0] - b[0] || a[1] - b[1]; }
function coordKey(r,c) { return `${r},${c}`; }
function shapeKey(shape) { return normalizeShape(shape).map(([r,c]) => `${r},${c}`).join("|"); }
function sameShape(a,b) { return shapeKey(a) === shapeKey(b); }

function setStatus(message = "", kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function clearCalculation() {
  state.calculatedPlacements = [];
  setStatus("");
  drawBoard();
}

function renderEquipmentOptions() {
  for (const name of Object.keys(SET_EFFECT_BLOCKS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    equipmentSelect.append(option);
  }
}

function renderCharacterPatterns() {
  characterPatterns.replaceChildren();
  CHARACTER_PATTERNS.forEach((pattern, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pattern-button${index === state.selectedCharacterIndex ? " selected" : ""}`;
    button.setAttribute("aria-label", `キャラ装備型 ${index + 1}`);
    const grid = document.createElement("span");
    grid.className = "pattern-grid";
    const unused = new Set(pattern.map(([r,c]) => coordKey(r,c)));
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("span");
        cell.className = `pattern-cell${unused.has(coordKey(r,c)) ? " unused" : ""}`;
        grid.append(cell);
      }
    }
    button.append(grid);
    button.addEventListener("click", () => {
      state.selectedCharacterIndex = index;
      clearCalculation();
      renderCharacterPatterns();
    });
    characterPatterns.append(button);
  });
}

function createShapeCanvas(shape, fill, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.className = "shape-canvas";
  canvas.width = size;
  canvas.height = size;
  drawShapePreview(canvas, shape, fill);
  return canvas;
}

function drawShapePreview(canvas, shape, fill) {
  const ctx = canvas.getContext("2d");
  const norm = normalizeShape(shape);
  const rows = Math.max(...norm.map(([r]) => r)) + 1;
  const cols = Math.max(...norm.map(([,c]) => c)) + 1;
  const pad = 5;
  const cell = Math.floor(Math.min((canvas.width - pad*2)/cols, (canvas.height-pad*2)/rows));
  const w = cell * cols;
  const h = cell * rows;
  const ox = Math.round((canvas.width - w)/2);
  const oy = Math.round((canvas.height - h)/2);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (const [r,c] of norm) {
    ctx.fillStyle = fill;
    ctx.fillRect(ox+c*cell, oy+r*cell, cell, cell);
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox+c*cell+.5, oy+r*cell+.5, cell-1, cell-1);
  }
}

function renderSetEffects() {
  setEffectBlocks.replaceChildren();
  const shapes = SET_EFFECT_BLOCKS[equipmentSelect.value] || [];
  for (const shape of shapes) setEffectBlocks.append(createShapeCanvas(shape, COLORS.SET, 72));
}

function getWantedShape([groupIndex, shapeIndex]) {
  return WANTED_GROUPS[groupIndex].shapes[shapeIndex];
}

function wantedBlockCount(groupIndex, shapeIndex) {
  return state.wantedSelected.filter(([g,s]) => g === groupIndex && s === shapeIndex).length;
}

function addWanted(groupIndex, shapeIndex) {
  if (state.wantedSelected.length >= 7) return;
  state.wantedSelected.push([groupIndex, shapeIndex]);
  clearCalculation();
  renderWantedSlots();
  renderWantedDialog();
}

function removeWanted(groupIndex, shapeIndex) {
  for (let i = state.wantedSelected.length - 1; i >= 0; i--) {
    const [g,s] = state.wantedSelected[i];
    if (g === groupIndex && s === shapeIndex) {
      state.wantedSelected.splice(i, 1);
      break;
    }
  }
  clearCalculation();
  renderWantedSlots();
  renderWantedDialog();
}

function renderWantedSlots() {
  wantedSlots.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement("div");
    slot.className = "wanted-slot";
    if (i < state.wantedSelected.length) {
      slot.append(createShapeCanvas(getWantedShape(state.wantedSelected[i]), COLORS.WANTED, 72));
    }
    wantedSlots.append(slot);
  }
}

function renderWantedDialog() {
  wantedGroups.replaceChildren();
  WANTED_GROUPS.forEach((group, groupIndex) => {
    const groupEl = document.createElement("section");
    groupEl.className = "wanted-group";
    groupEl.dataset.count = String(group.shapes.length);

    const label = document.createElement("div");
    label.className = "wanted-group-label";
    label.textContent = group.label;

    const items = document.createElement("div");
    items.className = "wanted-group-items";

    group.shapes.forEach((shape, shapeIndex) => {
      const count = wantedBlockCount(groupIndex, shapeIndex);
      const item = document.createElement("div");
      item.className = `wanted-item${count ? " selected" : ""}`;
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", `${group.label} 希望ブロック ${shapeIndex+1} を追加`);
      item.append(createShapeCanvas(shape, COLORS.WANTED, 72));
      item.addEventListener("click", () => addWanted(groupIndex, shapeIndex));
      item.addEventListener("keydown", ev => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); addWanted(groupIndex, shapeIndex); }
      });

      if (count) {
        const countBadge = document.createElement("span");
        countBadge.className = "count-badge";
        countBadge.textContent = String(count);
        item.append(countBadge);

        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "minus-badge";
        minus.textContent = "−";
        minus.setAttribute("aria-label", "1個減らす");
        minus.addEventListener("click", ev => {
          ev.stopPropagation();
          removeWanted(groupIndex, shapeIndex);
        });
        item.append(minus);
      }
      items.append(item);
    });

    groupEl.append(label, items);
    wantedGroups.append(groupEl);
  });
  wantedCountText.textContent = `${state.wantedSelected.length} / 7`;
}

function allBlockShapesBySize() {
  const result = {2: [], 3: [], 4: []};
  const seen = {2: new Set(), 3: new Set(), 4: new Set()};
  for (const group of WANTED_GROUPS) {
    for (const shape of group.shapes) {
      const norm = normalizeShape(shape);
      const n = norm.length;
      const key = shapeKey(norm);
      if (result[n] && !seen[n].has(key)) {
        seen[n].add(key);
        result[n].push(norm);
      }
    }
  }
  return result;
}

function gearFillSizes(remaining) {
  const preferred = gearType.value === "Ⅲ型" ? 3 : 2;
  let best = null;
  for (let n2 = 0; n2 <= Math.floor(remaining/2); n2++) {
    for (let n3 = 0; n3 <= Math.floor(remaining/3); n3++) {
      for (let n4 = 0; n4 <= Math.floor(remaining/4); n4++) {
        if (2*n2 + 3*n3 + 4*n4 !== remaining) continue;
        const counts = {2:n2, 3:n3, 4:n4};
        const score = [counts[preferred], -(n2+n3+n4), n4, n3, n2];
        if (!best || compareScore(score, best.score) > 0) best = {score, counts};
      }
    }
  }
  return best?.counts ?? null;
}

function compareScore(a,b) {
  for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function wantedRemainingAfterSet(setShapes) {
  const remaining = state.wantedSelected.map(k => normalizeShape(getWantedShape(k)));
  const overlapIndices = new Set();
  setShapes.forEach((setShape, setIndex) => {
    const i = remaining.findIndex(w => sameShape(w, setShape));
    if (i >= 0) {
      remaining.splice(i, 1);
      overlapIndices.add(setIndex);
    }
  });
  return {remaining, overlapIndices};
}

function placementCells(shape, top, left) {
  return shape.map(([r,c]) => [top+r, left+c]);
}

function possiblePositions(shape, allowedSet) {
  const norm = normalizeShape(shape);
  const rows = Math.max(...norm.map(([r]) => r))+1;
  const cols = Math.max(...norm.map(([,c]) => c))+1;
  const out = [];
  for (let top=0; top<=5-rows; top++) {
    for (let left=0; left<=5-cols; left++) {
      const cells = placementCells(norm, top, left);
      if (cells.every(([r,c]) => allowedSet.has(coordKey(r,c)))) out.push({top,left,cells});
    }
  }
  return out;
}

function solveExactCover(pieces, allowedSet) {
  const prepared = pieces.map((piece, idx) => {
    const shape = normalizeShape(piece.shape);
    return {...piece, idx, shape, positions: possiblePositions(shape, allowedSet)};
  });
  if (prepared.some(p => p.positions.length === 0)) return null;
  prepared.sort((a,b) => a.positions.length - b.positions.length);

  const occupied = new Set();
  const answer = Array(prepared.length).fill(null);

  function isFree(position) {
    return position.cells.every(([r,c]) => !occupied.has(coordKey(r,c)));
  }

  function dfs(depth) {
    if (depth === prepared.length) return occupied.size === allowedSet.size;

    let bestJ = -1;
    let bestValid = null;
    for (let j=depth; j<prepared.length; j++) {
      const valid = prepared[j].positions.filter(isFree);
      if (valid.length === 0) return false;
      if (!bestValid || valid.length < bestValid.length) {
        bestJ = j;
        bestValid = valid;
        if (valid.length === 1) break;
      }
    }

    [prepared[depth], prepared[bestJ]] = [prepared[bestJ], prepared[depth]];
    const piece = prepared[depth];
    const valid = piece.positions.filter(isFree).sort((a,b) => a.top-b.top || a.left-b.left);

    for (const position of valid) {
      for (const [r,c] of position.cells) occupied.add(coordKey(r,c));
      answer[depth] = { shape: piece.shape, top: position.top, left: position.left, color: piece.color };
      if (dfs(depth+1)) return true;
      for (const [r,c] of position.cells) occupied.delete(coordKey(r,c));
      answer[depth] = null;
    }

    [prepared[depth], prepared[bestJ]] = [prepared[bestJ], prepared[depth]];
    return false;
  }

  return dfs(0) ? answer.filter(Boolean) : null;
}

function combinations(n, k) {
  const out = [];
  function walk(start, picked) {
    if (picked.length === k) { out.push([...picked]); return; }
    for (let i=start; i<n; i++) { picked.push(i); walk(i+1,picked); picked.pop(); }
  }
  walk(0, []);
  return out;
}

function product(arr, repeat) {
  if (repeat === 0) return [[]];
  let out = [[]];
  for (let i=0;i<repeat;i++) {
    const next=[];
    for (const prefix of out) for (const item of arr) next.push([...prefix,item]);
    out = next;
  }
  return out;
}

function calculateBlocks() {
  calculateButton.disabled = true;
  setStatus("計算中…");
  requestAnimationFrame(() => {
    try {
      const setShapes = (SET_EFFECT_BLOCKS[equipmentSelect.value] || []).map(normalizeShape);
      const unused = new Set(CHARACTER_PATTERNS[state.selectedCharacterIndex].map(([r,c]) => coordKey(r,c)));
      const allowedSet = new Set();
      for (let r=0;r<5;r++) for (let c=0;c<5;c++) if (!unused.has(coordKey(r,c))) allowedSet.add(coordKey(r,c));

      const setArea = setShapes.reduce((sum,s) => sum+s.length,0);
      const remainingArea = allowedSet.size - setArea;
      const fillCounts = gearFillSizes(remainingArea);
      if (!fillCounts) throw new Error("残り枠をⅡ/Ⅲ/Ⅳ型で構成できません。");

      const {remaining: wantedRemaining, overlapIndices} = wantedRemainingAfterSet(setShapes);
      const shapesBySize = allBlockShapesBySize();
      const wantedBySize = {2:[],3:[],4:[]};
      for (const shape of wantedRemaining) if (wantedBySize[shape.length]) wantedBySize[shape.length].push(shape);

      const perSizeOptions = [];
      for (const n of [2,3,4]) {
        const need = fillCounts[n];
        const wanted = wantedBySize[n];
        const maxTake = Math.min(need, wanted.length);
        const options = [];
        for (let take=maxTake; take>=0; take--) {
          for (const inds of combinations(wanted.length, take)) {
            const selected = inds.map(i => wanted[i]);
            const blueCount = need - take;
            if (blueCount === 0) options.push({selected, blue:[]});
            else for (const blueShapes of product(shapesBySize[n], blueCount)) options.push({selected, blue:blueShapes});
          }
        }
        perSizeOptions.push(options);
      }

      const candidates = [];
      for (const o2 of perSizeOptions[0]) for (const o3 of perSizeOptions[1]) for (const o4 of perSizeOptions[2]) {
        const opts=[o2,o3,o4];
        const orangeArea = opts.reduce((sum,o) => sum + o.selected.reduce((s,shape)=>s+shape.length,0),0);
        candidates.push({orangeArea, opts});
      }
      candidates.sort((a,b) => b.orangeArea-a.orangeArea);

      let bestArea=-1, bestSolution=null;
      for (const candidate of candidates) {
        if (bestSolution && candidate.orangeArea < bestArea) break;
        const pieces = setShapes.map((shape,i) => ({shape, color: overlapIndices.has(i) ? RAINBOW : COLORS.SET}));
        for (const opt of candidate.opts) {
          for (const shape of opt.selected) pieces.push({shape, color:COLORS.WANTED});
          for (const shape of opt.blue) pieces.push({shape, color:COLORS.FILLER});
        }
        if (pieces.reduce((sum,p)=>sum+p.shape.length,0) !== allowedSet.size) continue;
        const solution = solveExactCover(pieces, allowedSet);
        if (solution) { bestArea=candidate.orangeArea; bestSolution=solution; break; }
      }

      state.calculatedPlacements = bestSolution || [];
      drawBoard();
      if (bestSolution) {
        const rainbowCount = bestSolution.filter(p => p.color === RAINBOW).length;
        setStatus(`配置完了：希望採用 ${bestArea}マス / セット&希望 ${rainbowCount}個`, "ok");
      } else {
        setStatus("この条件では20マスを完全充填できる配置が見つかりませんでした。", "error");
      }
    } catch (err) {
      console.error(err);
      state.calculatedPlacements=[];
      drawBoard();
      setStatus(err.message || "計算中にエラーが発生しました。", "error");
    } finally {
      calculateButton.disabled=false;
    }
  });
}

function resizeCanvasForDpr(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(rect.width*dpr));
  const h = Math.max(1, Math.round(rect.height*dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {width:rect.width,height:rect.height};
}

function drawBoard() {
  const {width,height} = resizeCanvasForDpr(boardCanvas, boardCtx);
  const cellW = width/5, cellH=height/5;
  boardCtx.clearRect(0,0,width,height);
  boardCtx.fillStyle="#fff";
  boardCtx.fillRect(0,0,width,height);

  const unused = new Set(CHARACTER_PATTERNS[state.selectedCharacterIndex].map(([r,c])=>coordKey(r,c)));
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) if (unused.has(coordKey(r,c))) {
    boardCtx.fillStyle=COLORS.UNUSED;
    boardCtx.fillRect(c*cellW,r*cellH,cellW,cellH);
  }

  for (const piece of state.calculatedPlacements) drawPieceFill(piece, cellW, cellH);

  // 各マスの「節」を細い黒線で残す。
  // ブロック内部も1マス単位で視認できるようにし、
  // 外形のゲーミングカラーより細くする。
  boardCtx.strokeStyle=COLORS.GRID;
  boardCtx.lineWidth=Math.max(1, Math.min(cellW,cellH)*0.012);
  boardCtx.beginPath();
  for (let i=0;i<=5;i++) {
    boardCtx.moveTo(i*cellW,0); boardCtx.lineTo(i*cellW,height);
    boardCtx.moveTo(0,i*cellH); boardCtx.lineTo(width,i*cellH);
  }
  boardCtx.stroke();

  for (const piece of state.calculatedPlacements) drawPieceOutline(piece, cellW, cellH);
}

function drawPieceFill(piece, cellW, cellH) {
  const absCells = piece.shape.map(([r,c]) => [piece.top+r,piece.left+c]);
  if (piece.color === RAINBOW) {
    const minR=Math.min(...absCells.map(([r])=>r)), maxR=Math.max(...absCells.map(([r])=>r));
    const minC=Math.min(...absCells.map(([,c])=>c)), maxC=Math.max(...absCells.map(([,c])=>c));
    const x1=minC*cellW, y1=minR*cellH, x2=(maxC+1)*cellW, y2=(maxR+1)*cellH;
    boardCtx.fillStyle=makeGamingGradient(x1,y1,x2,y2);
  } else boardCtx.fillStyle=piece.color;

  for (const [r,c] of absCells) boardCtx.fillRect(c*cellW,r*cellH,cellW,cellH);
}

function makeGamingGradient(x1, y1, x2, y2) {
  const gradient = boardCtx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0.00,"#a020f0");
  gradient.addColorStop(0.14,"#3155ff");
  gradient.addColorStop(0.28,"#00eaff");
  gradient.addColorStop(0.43,"#20ff74");
  gradient.addColorStop(0.58,"#fff200");
  gradient.addColorStop(0.72,"#ff8a00");
  gradient.addColorStop(0.86,"#ff1744");
  gradient.addColorStop(1.00,"#ff28d7");
  return gradient;
}

function makeOutlineGradient(x1, y1, x2, y2) {
  const gradient = boardCtx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0.00,"#8b1cff");
  gradient.addColorStop(0.22,"#b018f5");
  gradient.addColorStop(0.45,"#e000d8");
  gradient.addColorStop(0.68,"#ff1493");
  gradient.addColorStop(0.84,"#ff315f");
  gradient.addColorStop(1.00,"#c218d4");
  return gradient;
}

function drawPieceOutline(piece, cellW, cellH) {
  const relSet = new Set(piece.shape.map(([r,c])=>coordKey(r,c)));

  // ブロックごとに左上→右下へ流れる赤紫～マゼンタ系の外形線。
  const absCells = piece.shape.map(([r,c]) => [piece.top+r,piece.left+c]);
  const minR = Math.min(...absCells.map(([r])=>r));
  const maxR = Math.max(...absCells.map(([r])=>r));
  const minC = Math.min(...absCells.map(([,c])=>c));
  const maxC = Math.max(...absCells.map(([,c])=>c));

  boardCtx.strokeStyle = makeOutlineGradient(
    minC*cellW,
    minR*cellH,
    (maxC+1)*cellW,
    (maxR+1)*cellH
  );
  boardCtx.lineWidth=Math.max(3, Math.min(cellW,cellH)*0.055);
  boardCtx.lineCap="square";
  boardCtx.lineJoin="miter";
  boardCtx.beginPath();

  for (const [r,c] of piece.shape) {
    const rr=piece.top+r, cc=piece.left+c;
    const x1=cc*cellW, x2=(cc+1)*cellW, y1=rr*cellH, y2=(rr+1)*cellH;
    if (!relSet.has(coordKey(r-1,c))) { boardCtx.moveTo(x1,y1); boardCtx.lineTo(x2,y1); }
    if (!relSet.has(coordKey(r+1,c))) { boardCtx.moveTo(x1,y2); boardCtx.lineTo(x2,y2); }
    if (!relSet.has(coordKey(r,c-1))) { boardCtx.moveTo(x1,y1); boardCtx.lineTo(x1,y2); }
    if (!relSet.has(coordKey(r,c+1))) { boardCtx.moveTo(x2,y1); boardCtx.lineTo(x2,y2); }
  }
  boardCtx.stroke();
}

function init() {
  renderEquipmentOptions();
  renderCharacterPatterns();
  renderSetEffects();
  renderWantedSlots();
  renderWantedDialog();
  drawBoard();

  gearType.addEventListener("change", clearCalculation);
  equipmentSelect.addEventListener("change", () => { clearCalculation(); renderSetEffects(); });
  calculateButton.addEventListener("click", calculateBlocks);
  document.getElementById("openWantedButton").addEventListener("click", () => {
    renderWantedDialog();
    if (typeof wantedDialog.showModal === "function") wantedDialog.showModal();
    else wantedDialog.setAttribute("open", "");
  });
  window.addEventListener("resize", drawBoard, {passive:true});
}

init();
