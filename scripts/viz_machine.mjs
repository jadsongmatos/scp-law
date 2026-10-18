import fs from 'fs';
import path from 'path';

const machineJson = JSON.parse(
  fs.readFileSync(path.resolve('public/state_machine.json'), 'utf-8')
);

function generateDot(mj) {
  const lines = [];
  lines.push('digraph G {');
  lines.push('  rankdir=TB;');
  lines.push('  nodesep=0.5;');
  lines.push('  ranksep=0.6;');
  lines.push('  node [shape=box style="rounded,filled" fillcolor="#1a1a2e" fontcolor="#e0e0e0" color="#e94560" fontname="monospace"];');
  lines.push('  edge [color="#e94560" fontcolor="#e0e0e0" fontsize=9 fontname="monospace"];');
  lines.push('  bgcolor="transparent";');
  lines.push('');

  const initDotId = `state_${mj.initial}`;
  lines.push(`  __init__ [label="" shape=point color="#00ff88" width=0.2];`);
  lines.push(`  __init__ -> ${initDotId} [label="inicio" fontsize=8 color="#00ff88"];`);
  lines.push('');

  for (const [stateName] of Object.entries(mj.states)) {
    const dotId = `state_${stateName}`;
    const isInitial = stateName === mj.initial;
    const borderColor = isInitial ? '#00ff88' : '#e94560';
    const peripheries = isInitial ? 3 : 1;
    lines.push(`  ${dotId} [label="${stateName}" color="${borderColor}" peripheries=${peripheries}];`);
  }
  lines.push('');

  for (const [stateName, stateDef] of Object.entries(mj.states)) {
    const dotId = `state_${stateName}`;
    const events = stateDef.events || {};

    const categorized = {
      navegacao: [],
      inventario: [],
      contatos: [],
      deducao: [],
      sistema: [],
    };

    const transitions = [];

    for (const [eventName, eventDef] of Object.entries(events)) {
      const target = eventDef.target;
      const actions = eventDef.actions || [];
      const params = eventDef.params ? Object.keys(eventDef.params).join(', ') : '';
      const actionShort = actions.length > 0
        ? actions.map(a => a.length > 40 ? a.slice(0, 37) + '...' : a).join(' | ')
        : '';
      let label = eventName;
      if (actionShort) label += `\\n[${actionShort}]`;
      if (params) label += `\\n(${params})`;

      if (target && target !== stateName) {
        transitions.push({ target, label });
        continue;
      }

      if (['MOVE_ROOM'].includes(eventName)) {
        categorized.navegacao.push(label);
      } else if (['PICKUP_ITEM', 'UNLOCK_OBJECT', 'INTERACTED_WITH', 'UPDATE_LOCAL_ROOMS'].includes(eventName)) {
        categorized.inventario.push(label);
      } else if (['DISCOVER_CONTACT', 'CALL_CONTACT', 'CUT_OFF_CONTACT', 'RECORD_PD_ACTION', 'SET_MURPHY_COMMENTARY'].includes(eventName)) {
        categorized.contatos.push(label);
      } else if (['READ_HINT', 'READ_INTERVIEW_CLUE', 'UPDATE_DEDUCTION_GRID', 'SET_DEDUCTION_RESULT', 'SET_COMPLETED', 'INCREMENT_DEDUCTION_ATTEMPTS', 'UNLOCK_DIRETORA_PHONE'].includes(eventName)) {
        categorized.deducao.push(label);
      } else if (['RESTORE_STATE'].includes(eventName)) {
        categorized.sistema.push(label);
      }
    }

    for (const [cat, labels] of Object.entries(categorized)) {
      if (labels.length === 0) continue;
      const labelText = labels.join('\\n---\\n');
      lines.push(`  ${dotId} -> ${dotId} [label="${cat.toUpperCase()}\\n${labelText}" style=dashed fontsize=7];`);
    }

    for (const t of transitions) {
      const targetDotId = `state_${t.target}`;
      lines.push(`  ${dotId} -> ${targetDotId} [label="${t.label}" style=solid fontsize=8 color="#ffcc00"];`);
    }
  }

  // Context summary
  lines.push('');
  const ctxGroups = [
    { label: 'Navegacao', fields: ['currentRoomId','visitedRooms'] },
    { label: 'Inventario', fields: ['inventory','unlockedObjects','interactedItems','localRooms'] },
    { label: 'Contatos', fields: ['discoveredContacts','calledContacts','pdCutoffContacts','pdChoiceHistory','phoneRecordings','murphyCommentaryMap','diretoraPhoneUnlocked'] },
    { label: 'Deducao', fields: ['readHints','readInterviewClues','deductionGrid','deductionResult','deductionAttempts','gameCompleted'] },
  ];

  for (const g of ctxGroups) {
    const fieldList = g.fields.map(f => {
      const ctx = mj.context.find(c => c.field === f);
      if (!ctx) return f;
      const t = ctx.type.length > 20 ? ctx.type.slice(0, 17) + '...' : ctx.type;
      return `${f}: ${t}`;
    }).join('\\l');
    lines.push(`  ctx_${g.label.toLowerCase()} [label="Contexto: ${g.label}\\l${fieldList}\\l" shape=note style=filled fillcolor="#0d0d1a" fontsize=7];`);
  }

  lines.push('}');
  return lines.join('\n');
}

const dot = generateDot(machineJson);
const outPath = path.resolve('public/machine_graph.dot');
fs.writeFileSync(outPath, dot, 'utf-8');
console.log(`OK: ${outPath} (${dot.length} chars)`);
console.log('Render: dot -Tpng public/machine_graph.dot -o public/machine_graph.png');
