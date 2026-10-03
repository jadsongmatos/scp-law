#!/usr/bin/env python3
"""Gera doc_dialogos.dot com todas as arvores de dialogo dos contatos.
Cada no mostra as rotas de entrada possiveis (dependente do historico)."""

import json, os

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME_DATA = os.path.join(PROJECT, 'src', 'game_data.json')
OUTPUT = os.path.join(PROJECT, 'doc_dialogos.dot')

with open(GAME_DATA, encoding='utf-8') as f:
    data = json.load(f)

contacts = data['PHONE_CONTACTS']
rooms = data['GAME_ROOMS']

contact_locations = {}
for rid, room in rooms.items():
    for item in room.get('interactables', []):
        cid = item.get('phoneCallId')
        if cid:
            contact_locations.setdefault(cid, []).append(room['name'].split('\u2014')[0].strip()[:35])
contact_locations['padre_miguel'] = ['Igreja (presencial)']
contact_locations['dra_cunha'] = ['Hospital (presencial)']
contact_locations['fazendeiro'] = ['Fazenda (presencial)']

PD_LABEL = {'C': 'Cooperar', 'D': 'Trair', 'E': 'Encerrar'}
PD_COLOR = {'C': '#22c55e', 'D': '#ef4444', 'E': '#a855f7'}

def esc(s):
    return s.replace('"', '\\"').replace('\\n', ' ')

lines = ['digraph Dialogos {']
lines.append('  rankdir=TB;')
lines.append('  bgcolor="#1a1a1a";')
lines.append('  fontname="JetBrains Mono";')
lines.append('  fontcolor="#d4d4d4";')
lines.append('  ranksep=4;')
lines.append('  nodesep=1.5;')
lines.append('  pad=1.0;')
lines.append('  splines=polyline;')
lines.append('  overlap=false;')
lines.append('  node [fontname="JetBrains Mono" fontsize=9 shape=box style=rounded margin="0.2,0.1"];')
lines.append('  edge [fontname="JetBrains Mono" fontsize=8];')
lines.append('')

for cid, contact in contacts.items():
    name = contact['name']
    strategy = contact.get('axelrodStrategy', '?')
    loc = ', '.join(contact_locations.get(cid, [contact.get('number', '')]))
    dialogue = contact.get('dialogue', {})

    lines.append(f'  subgraph "cluster_{cid}" {{')
    lines.append(f'    label="\u00ab{name}\u00bb  |  {strategy}  |  {loc}";')
    lines.append(f'    fontcolor="#fbbf24"; color="#fbbf24"; style=rounded; bgcolor="#222222"; labelloc=t; fontsize=11; pencolor="#fbbf24";')
    lines.append(f'    margin=40; pad=25;')
    lines.append('')

    for nid, node in dialogue.items():
        node_id = f'{cid}_{nid}'
        speaker = node.get('speaker', name)[:30]
        node_lines = node.get('lines', [])
        choices = node.get('choices', [])
        terminal = len(choices) == 0

        label = f'\u00ab{speaker}\u00bb\\n'
        for l in node_lines:
            label += esc(l) + '\\n'

        if choices:
            label += '\\n\u2500\u2500\u2500 escolhas: \u2500\u2500\u2500'
            for ch in choices:
                act = ch.get('pdAction', '?')
                txt = esc(ch.get('text', '')[:60])
                label += f'\\n[{act}] {txt}'
        else:
            label += '\\n── [TERMINAL] ──'

        entries = set()
        for src, src_node in dialogue.items():
            for c in src_node.get('choices', []):
                if c.get('goto') == nid:
                    entries.add(src)
        if nid != 'initial' and entries:
            label += f'\\n\\n◀ ENTRA DE: {", ".join(sorted(entries))}'

        if nid == 'initial':
            fillcolor = '#4a1a1a'; fontcolor = '#fca5a5'
        elif terminal:
            fillcolor = '#1e3a5f'; fontcolor = '#93c5fd'
        else:
            nid_lower = nid.lower()
            if any(w in nid_lower for w in ['confronto', 'acusacao', 'briga', 'emburrado', 'corte', 'rompante']):
                fillcolor = '#3a2a1a'; fontcolor = '#fcd5c5'
            elif 'info' in nid_lower or 'detalhe' in nid_lower:
                fillcolor = '#2a3a1a'; fontcolor = '#b5fca5'
            else:
                fillcolor = '#1f2937'; fontcolor = '#d4d4d4'

        lines.append(f'    "{node_id}" [label="{label}" fillcolor="{fillcolor}" fontcolor="{fontcolor}" color="#555"];')

        for ch in choices:
            target = ch.get('goto', '')
            if target and target in dialogue:
                target_node = dialogue[target]
                target_lines = target_node.get('lines', [])
                target_speaker = target_node.get('speaker', name)[:20]
                act = ch.get('pdAction', '?')
                lbl = PD_LABEL.get(act, act)
                color = PD_COLOR.get(act, '#888')
                txt = esc(ch.get('text', '')[:70])
                npc_preview = ''
                if target_lines:
                    preview = esc(target_lines[0][:80])
                    if len(target_lines[0]) > 80: preview += '\u2026'
                    npc_preview = f'\\n\u21b3 {esc(target_speaker)}: \u00ab{preview}\u00bb'
                lines.append(f'    "{node_id}" -> "{cid}_{target}" [label="{lbl}: {txt}{npc_preview}" fontcolor="{color}" color="{color}" fontsize=8];')

    lines.append('  }')
    lines.append('')

lines.append('  subgraph cluster_legend {')
lines.append('    label="Legenda"; fontcolor="#888"; color="#555"; style=rounded; bgcolor="#111"; margin=20;')
lines.append('    legend_colors [label="Vermelho=initial | Verde=info | Bege=confronto | Azul=terminal\\n◀ ENTRA DE = de quais nos se chega neste ponto" fillcolor="#4a1a1a:#2a3a1a:#3a2a1a:#1e3a5f" fontcolor="#fca5a5:#b5fca5:#fcd5c5:#93c5fd" shape=box style="rounded,filled" margin="0.3,0.2"];')
for act, lbl in PD_LABEL.items():
    lines.append(f'  legend_{act} [label="  {act} = {lbl}" fontcolor="{PD_COLOR[act]}" color="{PD_COLOR[act]}" shape=plaintext fontsize=10];')
lines.append('  }')
lines.append('}')

with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print(f'Generated {OUTPUT} ({len(lines)} lines)')