import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const gameData = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/game_data.json'), 'utf-8'));
const ROOMS = gameData.GAME_ROOMS;
const CONTACTS = gameData.PHONE_CONTACTS;
const PERM = ['isqueiro', 'gravador_cassete'];
const roomKeys = Object.keys(ROOMS);
const contactKeys = Object.keys(CONTACTS);

// ═══════════════════════════════════════════════════════════
// PUZZLE CSP SOLVER (ported from puzzleSolver.ts)
// ═══════════════════════════════════════════════════════════

const CAT_KW = 'suspeito|local|arma|motivo|horario';

function parseAllHints(gd) {
  const its = Object.values(gd.GAME_ROOMS).flatMap(r => r.interactables ?? []);
  const byId = id => its.find(i => i.id === id);
  const content = it => it?.documentData?.content ?? [];
  const listAfter = (lines, label) => {
    const line = lines.find(l => label.test(l));
    if (!line) throw new Error('Missing line for ' + label);
    return line.replace(label, '').split(',').map(s => s.trim()).filter(Boolean);
  };
  const resolveRoom = (label, rooms) => {
    const t = label.trim().replace(/\.$/, '').trim();
    const exact = rooms.indexOf(t);
    if (exact >= 0) return exact;
    const cand = rooms.map((r, i) => ({ r, i })).filter(({ r }) => t.startsWith(r) || r.startsWith(t));
    if (cand.length === 1) return cand[0].i;
    throw new Error('Cannot resolve room ' + label);
  };

  const dedTerm = byId('puzzle_deduction_terminal');
  const dlines = content(dedTerm);
  const rooms = listAfter(dlines, /^\s*Locais:\s*/);
  const categories = { suspeito: listAfter(dlines, /^\s*Suspeitos:\s*/), local: listAfter(dlines, /^\s*Locais do crime:\s*/), arma: listAfter(dlines, /^\s*Armas:\s*/), motivo: listAfter(dlines, /^\s*Motivos:\s*/), horario: listAfter(dlines, /^\s*Hor[áa]rios:\s*/) };

  // Solution from puzzle_solution_terminal
  const sol = {};
  const solTerm = byId('puzzle_solution_terminal');
  let roomIdx = -1;
  for (const raw of content(solTerm)) {
    const header = raw.match(/^►\s*(.+?):\s*$/);
    if (header) { roomIdx = resolveRoom(header[1], rooms); continue; }
    const kv = raw.match(/^\s*(Suspeito|Local|Arma|Motivo|Hor[áa]rio):\s*(.+?)\s*$/);
    if (kv && roomIdx >= 0) {
      const catMap = { Suspeito:'suspeito', Local:'local', Arma:'arma', Motivo:'motivo', Horario:'horario', Horário:'horario' };
      const cat = catMap[kv[1]];
      if (!sol[cat]) sol[cat] = {};
      sol[cat][kv[2].trim()] = roomIdx;
    }
  }

  // Parse each hint (puzzle_hint_N + interview_clue_*)
  const hints = {};
  for (const it of its) {
    if (!/^(puzzle_hint_\d+|interview_clue_)/.test(it.id)) continue;
    const lines = content(it);
    const joined = lines.join('\n');
    const typeM = joined.match(/\[Tipo de restri[çc][ãa]o:\s*([a-z_]+)\]/);
    if (!typeM) throw new Error('Hint without type: ' + it.id);
    const type = typeM[1];
    const sentence = lines.find(l => new RegExp(`^O\\s+(${CAT_KW})\\s`).test(l.trim()));
    if (!sentence) throw new Error('Hint without sentence: ' + it.id);
    const pairs = [...sentence.matchAll(new RegExp(`(${CAT_KW})\\s+'([^']+)'`, 'g'))].map(m => ({ cat: m[1], val: m[2] }));
    let hint;
    if (type === 'exact' || type === 'not_exact') {
      const roomM = sentence.match(/est[áa] no (.+?)\.\s*$/);
      hint = { type, cat: pairs[0].cat, val: pairs[0].val, room: resolveRoom(roomM[1], rooms) };
    } else if (type === 'between_ordered' || type === 'between_unordered') {
      hint = { type, c_mid: pairs[0].cat, v_mid: pairs[0].val, c1: pairs[1].cat, v1: pairs[1].val, c2: pairs[2].cat, v2: pairs[2].val };
    } else {
      hint = { type, c1: pairs[0].cat, v1: pairs[0].val, c2: pairs[1].cat, v2: pairs[1].val };
    }
    hints[it.id] = hint;
  }

  // Build ordered hint list
  const orderedIds = Object.keys(hints).sort((a, b) => {
    const aNum = a.startsWith('puzzle') ? parseInt(a.split('_')[2]) : 100 + a.split('_')[2].charCodeAt(0);
    const bNum = b.startsWith('puzzle') ? parseInt(b.split('_')[2]) : 100 + b.split('_')[2].charCodeAt(0);
    return aNum - bNum;
  });
  return { hints, categories, rooms, solution: sol, orderedIds, nRooms: rooms.length };
}

function solvePuzzle(categories, hintList, nRooms, maxSolutions) {
  const cats = Object.keys(categories);
  const cells = [];
  for (const c of cats) for (const v of categories[c]) cells.push([c, v]);
  const cellsOf = hintList.map(h => {
    switch (h.type) {
      case 'exact': case 'not_exact': return [[h.cat, h.val]];
      case 'between_ordered': case 'between_unordered': return [[h.c1, h.v1], [h.c_mid, h.v_mid], [h.c2, h.v2]];
      default: return [[h.c1, h.v1], [h.c2, h.v2]];
    }
  });
  const assign = {};
  const usedByCat = {};
  for (const c of cats) { assign[c] = {}; usedByCat[c] = new Set(); }
  const solutions = [];

  const bound = (c, v) => assign[c][v] !== undefined;
  const satisfied = (h, a) => {
    const at = (c, v) => a[c][v];
    switch (h.type) {
      case 'exact': return at(h.cat, h.val) === h.room;
      case 'not_exact': return at(h.cat, h.val) !== h.room;
      case 'same_room': return at(h.c1, h.v1) === at(h.c2, h.v2);
      case 'not_same_room': return at(h.c1, h.v1) !== at(h.c2, h.v2);
      case 'adjacent': return Math.abs(at(h.c1, h.v1) - at(h.c2, h.v2)) === 1;
      case 'not_adjacent': return Math.abs(at(h.c1, h.v1) - at(h.c2, h.v2)) !== 1;
      case 'left_of': return at(h.c1, h.v1) < at(h.c2, h.v2);
      case 'between_ordered': { const p1=at(h.c1,h.v1), pm=at(h.c_mid,h.v_mid), p2=at(h.c2,h.v2); return p1<pm && pm<p2; }
      case 'between_unordered': { const p1=at(h.c1,h.v1), pm=at(h.c_mid,h.v_mid), p2=at(h.c2,h.v2); return (p1<pm&&pm<p2)||(p2<pm&&pm<p1); }
      default: return true;
    }
  };

  const stillConsistent = (jc, jv) => {
    for (let i = 0; i < hintList.length; i++) {
      const refs = cellsOf[i];
      if (!refs.some(([c, v]) => c === jc && v === jv)) continue;
      if (!refs.every(([c, v]) => bound(c, v))) continue;
      if (!satisfied(hintList[i], assign)) return false;
    }
    return true;
  };

  const backtrack = (idx) => {
    if (solutions.length >= maxSolutions) return;
    if (idx === cells.length) {
      const snap = {};
      for (const c of cats) { snap[c] = {}; for (const v of categories[c]) snap[c][v] = assign[c][v]; }
      solutions.push(snap);
      return;
    }
    const [cat, val] = cells[idx];
    for (let room = 0; room < nRooms; room++) {
      if (usedByCat[cat].has(room)) continue;
      assign[cat][val] = room;
      usedByCat[cat].add(room);
      if (stillConsistent(cat, val)) backtrack(idx + 1);
      delete assign[cat][val];
      usedByCat[cat].delete(room);
      if (solutions.length >= maxSolutions) return;
    }
  };
  backtrack(0);
  return solutions;
}

function solutionsEqual(a, b) {
  for (const cat of Object.keys(a)) {
    for (const val of Object.keys(a[cat])) {
      if (a[cat][val] !== b[cat][val]) return false;
    }
  }
  return true;
}

// Pre-parse puzzle at startup
const PUZZLE = parseAllHints(gameData);

function checkWin(hintIds, clueIds) {
  const allIds = [...hintIds, ...clueIds];
  if (allIds.length === 0) return false;
  const activeHints = allIds.map(id => PUZZLE.hints[id]).filter(Boolean);
  if (activeHints.length === 0) return false;
  const sols = solvePuzzle(PUZZLE.categories, activeHints, PUZZLE.nRooms, 2);
  if (sols.length !== 1) return false;
  return solutionsEqual(sols[0], PUZZLE.solution);
}

// ═══════════════════════════════════════════════════════════
// MINIMAL CONTEXT
// ═══════════════════════════════════════════════════════════

function initCtx() {
  return { r:'escritorio', i:['isqueiro','gravador_cassete'], v:['escritorio'], d:[], k:[], co:[], ph:{}, h:[], ic:[], u:[], x:[], dt:false, win:false };
}

function cloneArr(a) { const r=[]; for(let i=0;i<a.length;i++) r.push(a[i]); return r; }

function cloneCtx(c) {
  const ph2={}; for(const k of Object.keys(c.ph)) ph2[k]=cloneArr(c.ph[k]);
  return { r:c.r, i:cloneArr(c.i), v:cloneArr(c.v), d:cloneArr(c.d), k:cloneArr(c.k), co:cloneArr(c.co), ph:ph2, h:cloneArr(c.h), ic:cloneArr(c.ic), u:cloneArr(c.u), x:cloneArr(c.x), dt:c.dt, win:c.win };
}

function hashOf(c) {
  const items=c.i.filter(x=>!PERM.includes(x)).sort().join(',');
  const visited=[...c.v].sort().join(',');
  const unlocked=[...c.u].sort().join(',');
  const hints=[...c.h].sort().join(',');
  const clues=[...c.ic].sort().join(',');
  return `${c.r}|${items}|${visited}|${unlocked}|${hints}|${clues}|${c.win?1:0}`;
}

function labelOf(c) {
  const rn=ROOMS[c.r]?.name||c.r;
  const items=c.i.filter(x=>!PERM.includes(x)).length;
  const pct=c.win?'100%':`${Math.round((c.h.length+c.ic.length)/28*50)}%`;
  return `${rn}\\nI:${items} V:${c.v.length}/${roomKeys.length} H:${c.h.length} C:${c.ic.length} T:${c.k.length} ${pct}${c.dt?'*':''}`;
}

function arrAdd(a,v) { if(a.includes(v)) return a; const b=cloneArr(a); b.push(v); return b; }

function cutoff(hist, strat) {
  const ds=hist.filter(a=>a==='D').length;
  const last=hist[hist.length-1];
  if(['Grudger','TitForTat','HardProber','Detective'].includes(strat)) return last==='D';
  if(strat==='EugineNier') return ds>=5;
  if(strat==='SoftGrudger') return ds>=3;
  if(['SneakyTitForTat','WinStayLoseShift','Forgiver'].includes(strat)) return false;
  if(strat==='RandomStrategy') return last==='D';
  return false;
}

// Dialogue deltas (cached per contact)
function exploreDialogueDeltas(cid) {
  const ct = CONTACTS[cid];
  if (!ct) return [];
  const strat = ct.axelrodStrategy;
  const results = [];
  const seen = new Set();
  const q = [{ ph:{}, co:[], dt:false, depth:0, node:'initial' }];
  seen.add('initial');
  while (q.length) {
    const d = q.shift();
    if (d.depth > 20) continue;
    const nd = ct.dialogue[d.node];
    if (!nd || !nd.choices.length) {
      results.push({ ph:d.ph, co:d.co, dt:d.dt });
      continue;
    }
    for (const ch of nd.choices) {
      const nph = {}; for(const k of Object.keys(d.ph)) nph[k]=cloneArr(d.ph[k]);
      let nco2 = d.co;
      let ndt = d.dt;
      if (ch.pdAction && ch.pdAction !== 'E') {
        if (!nph[cid]) nph[cid] = [];
        nph[cid].push(ch.pdAction);
      }
      const tn = ct.dialogue[ch.goto];
      const isTerm = !tn || !tn.choices.length;
      if (ch.pdAction==='D' && isTerm && cutoff(nph[cid]||[], strat)) nco2=arrAdd(nco2, cid);
      if (cid==='diretora_elvira' && d.node==='de_confirma' && ch.goto==='de_end_e' && ch.pdAction==='C') ndt=true;
      const key = ch.goto + '|' + JSON.stringify(nph[cid]||[]);
      if (!seen.has(key)) { seen.add(key); q.push({ ph:nph, co:nco2, dt:ndt, depth:d.depth+1, node:ch.goto }); }
    }
  }
  return results;
}

function applyDialDelta(c, cid, delta) {
  const n = cloneCtx(c);
  n.k = arrAdd(n.k, cid);
  n.d = arrAdd(n.d, cid);
  n.ph = {...n.ph};
  for (const k of Object.keys(delta.ph)) n.ph[k] = cloneArr(delta.ph[k]);
  for (const coid of delta.co) { if (!n.co.includes(coid)) n.co.push(coid); }
  if (delta.dt) n.dt = true;
  // Dialogues don't change puzzle state
  return n;
}

// Enumerate available actions
function enumerateActions(c) {
  const room = ROOMS[c.r];
  if (!room) return [];
  const acts = [];
  for (const obj of room.interactables) {
    if (obj.type==='travel' && obj.targetRoom) {
      if (obj.requiredItem && !c.i.includes(obj.requiredItem) && !c.u.includes(obj.id)) continue;
      if (obj.targetRoom==='escola' && !c.v.includes('casa_mae')) continue;
      if (!ROOMS[obj.targetRoom]) continue;
      acts.push({ l:`M:${obj.targetRoom}`, t:'travel', fn:c2=>{ const n=cloneCtx(c2); n.r=obj.targetRoom; n.v=arrAdd(n.v,obj.targetRoom); return n; } });
    }
    if (obj.type==='pickup' && obj.pickupItem) {
      if (c.x.includes(obj.id) || c.i.includes(obj.pickupItem)) continue;
      acts.push({ l:`P:${obj.pickupItem}`, t:'pickup', fn:c2=>{ const n=cloneCtx(c2); n.i=arrAdd(n.i,obj.pickupItem); n.x=arrAdd(n.x,obj.id); return n; } });
    }
    if (obj.type==='terminal_read') {
      const isH=obj.id?.startsWith('puzzle_hint_'), isIC=obj.id?.startsWith('interview_clue_');
      if (!isH && !isIC) continue;
      if (obj.requiredItem && !c.i.includes(obj.requiredItem) && !c.u.includes(obj.id)) continue;
      if (obj.interviewGate && c.co.includes(obj.interviewGate)) continue;
      if ((isH && c.h.includes(obj.id)) || (isIC && c.ic.includes(obj.id))) continue;
      acts.push({ l:`R:${obj.id}`, t:'read', fn:c2=>{
        const n=cloneCtx(c2);
        if (obj.requiredItem && c2.i.includes(obj.requiredItem) && !c2.u.includes(obj.id)) n.u=arrAdd(n.u,obj.id);
        if (isH) n.h=arrAdd(n.h,obj.id);
        if (isIC) n.ic=arrAdd(n.ic,obj.id);
        n.win = checkWin(n.h, n.ic);
        return n;
      }});
    }
    if (obj.requiredItem && !c.u.includes(obj.id) && obj.type!=='travel') {
      for (const itemId of c.i) {
        if (itemId===obj.requiredItem)
          acts.push({ l:`U:${itemId}->${obj.id}`, t:'use', fn:c2=>{ const n=cloneCtx(c2); n.u=arrAdd(n.u,obj.id); return n; } });
      }
    }
  }
  for (const [cid,ct] of Object.entries(CONTACTS)) {
    if (ct.discoveredFrom==='auto' && !c.d.includes(cid) && !c.co.includes(cid))
      acts.push({ l:`A:${cid}`, t:'discover', fn:c2=>{ const n=cloneCtx(c2); n.d=arrAdd(n.d,cid); return n; } });
  }
  const seen=new Set();
  return acts.filter(a=>{const k=a.l;if(seen.has(k))return false;seen.add(k);return true;});
}

// ═══════════════════════════════════════════════════════════
// DFS EXPLORATION
// ═══════════════════════════════════════════════════════════

const MAX_STATES = parseInt(process.env.MAX_STATES || '300000', 10);
const MAX_DEPTH = 500;

function explore() {
  const start = initCtx();
  const startH = hashOf(start);
  const nodes = new Map();
  const edges = [];
  const dialCache = {};

  nodes.set(startH, { label:labelOf(start), win:false, room:'escritorio', depth:0 });
  const stack = [{ c:start, hash:startH, depth:0, exploredDial:new Set() }];

  while (stack.length && nodes.size < MAX_STATES) {
    const { c, hash:curH, depth, exploredDial } = stack.pop();
    if (depth >= MAX_DEPTH) continue;
    const room = ROOMS[c.r];
    if (!room) continue;

    // Phase 1: discover contacts
    const freshContacts = [];
    for (const obj of room.interactables) {
      if (obj.type!=='phone_call' || !obj.phoneCallId) continue;
      const cid = obj.phoneCallId;
      if (!CONTACTS[cid] || c.co.includes(cid) || exploredDial.has(cid)) continue;
      if (obj.requiredItem && !c.i.includes(obj.requiredItem) && !c.u.includes(obj.id)) continue;
      exploredDial.add(cid);
      freshContacts.push(cid);
    }

    // Phase 2: dialogue (cached deltas)
    for (const cid of freshContacts) {
      if (nodes.size >= MAX_STATES) break;
      if (!dialCache[cid]) dialCache[cid] = exploreDialogueDeltas(cid);
      const deltas = dialCache[cid];
      for (const delta of deltas) {
        if (nodes.size >= MAX_STATES) break;
        const oc = applyDialDelta(c, cid, delta);
        const oh = hashOf(oc);
        if (!nodes.has(oh)) {
          nodes.set(oh, { label:labelOf(oc), win:oc.win, room:oc.r, depth:depth+5 });
          edges.push({ from:curH, to:oh, l:`D:${cid}`, t:'dialogue' });
          stack.push({ c:oc, hash:oh, depth:depth+5, exploredDial:new Set(exploredDial) });
        }
      }
    }

    // Phase 3: actions
    const acts = enumerateActions(c);
    for (const a of acts) {
      if (nodes.size >= MAX_STATES) break;
      const nxt = a.fn(c);
      const h = hashOf(nxt);
      if (h === curH) continue;
      if (!nodes.has(h)) {
        nodes.set(h, { label:labelOf(nxt), win:nxt.win, room:nxt.r, depth:depth+1 });
        if (nodes.size % 10000 === 0) process.stderr.write(`  [${nodes.size}] win:${nxt.win}\n`);
        edges.push({ from:curH, to:h, l:a.l, t:a.t });
        stack.push({ c:nxt, hash:h, depth:depth+1, exploredDial:new Set(exploredDial) });
      }
    }
  }
  return { nodes, edges };
}

// ═══════════════════════════════════════════════════════════
// DOT GENERATION
// ═══════════════════════════════════════════════════════════

function genDot(nodes, edges) {
  const hashToId=new Map(); let id=0;
  for (const h of nodes.keys()) hashToId.set(h,`n${id++}`);
  const clusters={};
  for (const [h,ni] of nodes) { if(!clusters[ni.room]) clusters[ni.room]=[]; clusters[ni.room].push(h); }
  const colors={ escritorio:'#00ff88',rua_chuva:'#4488ff',bar:'#ffaa00',escola:'#88ff88',diretoria:'#ff4488',delegacia:'#8888ff',beco:'#884422',armazem:'#888888',igreja:'#ffcc00',fazenda:'#44ff88',hospital:'#ff8888',casa_mae:'#cc44ff' };
  let cid=0;
  const l=['digraph G {','  rankdir=LR;','  nodesep=0.12;','  ranksep=0.15;','  bgcolor="#0d0d1a";','  node [shape=point style=filled width=0.05 height=0.05 fontcolor=transparent];','  edge [fontsize=4 fontname="monospace" penwidth=0.3];',''];
  for (const [room,hashes] of Object.entries(clusters)) {
    const name=(ROOMS[room]?.name||room).replace(/[^\w\u00C0-\u024F ]/g,'').slice(0,25);
    const col=colors[room]||'#888';
    l.push(`  subgraph cluster_${cid++} {`);
    l.push(`    label="${name}"; style="filled"; fillcolor="#0a0a14"; color="${col}"; fontcolor="${col}"; fontname="monospace"; fontsize=7;`);
    for (const hash of hashes) {
      const nid=hashToId.get(hash), ni=nodes.get(hash);
      const tc=ni.win?'#ffcc00':(colors[room]||'#e94560');
      const sz=ni.win?'0.12':'0.05';
      l.push(`    ${nid} [color="${tc}" width=${sz} height=${sz} tooltip="${ni.label.replace(/"/g,'&quot;')}"];`);
    }
    l.push('  }');
  }
  l.push('');
  for (const edge of edges) {
    const f=hashToId.get(edge.from), t=hashToId.get(edge.to);
    if (!f||!t||f===t) continue;
    let col='#666', style='solid';
    if (edge.t==='travel') col='#4488ff';
    else if (edge.t==='pickup') col='#ffaa00';
    else if (edge.t==='dialogue') { col='#44cc44'; style='bold'; }
    else if (edge.t==='discover') col='#cc44ff';
    else if (edge.t==='use') col='#ff8844';
    else if (edge.t==='read') { col='#44aaff'; style='dotted'; }
    l.push(`  ${f} -> ${t} [label="${edge.l}" color="${col}" style="${style}"];`);
  }
  l.push('}');
  return l.join('\n');
}

// ═══════════════════════════════════════════════════════════

console.log(`Bot SCP Law | Salas:${roomKeys.length} Contatos:${contactKeys.length} Hints:${PUZZLE.orderedIds.length}`);
console.time('dfs');
const { nodes, edges } = explore();
console.timeEnd('dfs');
let md=0, w=0;
for (const ni of nodes.values()) { if(ni.depth>md) md=ni.depth; if(ni.win) w++; }
console.log(`Estados:${nodes.size} Arestas:${edges.length} Prof:${md} Vitoria:${w}`);
const dot = genDot(nodes, edges);
fs.writeFileSync(path.join(repoRoot, 'public/game_graph.dot'), dot, 'utf-8');
console.log(`DOT: ${(dot.length/1024).toFixed(0)} KB`);
