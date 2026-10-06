#!/usr/bin/env python3
"""Audita dialogos com OR-Tools CP-SAT.

Modela cada arvore como variaveis booleanas (no visitavel) e restricoes
(para chegar em X, e preciso chegar em Y antes).
"""

import json, os
from collections import defaultdict, deque
from collections import defaultdict

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False
    print('[WARN] ortools nao instalado. Instale com: pip install ortools')
    print('       Usando fallback sem CP-SAT...\n')

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME_DATA = os.path.join(PROJECT, 'src', 'game_data.json')

with open(GAME_DATA, encoding='utf-8') as f:
    data = json.load(f)

contacts = data['PHONE_CONTACTS']

PD_ACTION_MAP = {'C': 'Cooperar', 'D': 'Trair', 'E': 'Encerrar'}

def audit_contact(cid, contact):
    name = contact['name']
    strategy = contact.get('axelrodStrategy', '?')
    dialogue = contact.get('dialogue', {})

    issues = []
    nodes = list(dialogue.keys())
    if not nodes:
        return [('FATAL', 'dialogo vazio')]

    node_idx = {n: i for i, n in enumerate(nodes)}
    n = len(nodes)

    # 1. basicos
    if 'initial' not in nodes:
        issues.append(('FATAL', f"sem no 'initial'"))

    # goto quebrado
    for nid, node in dialogue.items():
        for ch in node.get('choices', []):
            t = ch.get('goto', '')
            if t and t not in dialogue:
                issues.append(('FATAL', f"{nid} -> {t} (nao existe)"))

    # sem falas
    for nid, node in dialogue.items():
        if not node.get('lines'):
            issues.append(('WARN', f"no {nid} sem falas"))

    # sem pdAction
    for nid, node in dialogue.items():
        for i, ch in enumerate(node.get('choices', [])):
            if not ch.get('pdAction'):
                issues.append(('WARN', f"no {nid} escolha {i} sem pdAction: {ch.get('text','')[:30]}"))

    # 2. CP-SAT: sao todos os nos TERMINAIS alcancaveis?
    if HAS_ORTOOLS:
        model = cp_model.CpModel()
        # x[i] = 1 se o no i for visitavel em algum caminho partindo de 'initial'
        x = [model.NewBoolVar(f'v_{nodes[i]}') for i in range(n)]
        model.Add(x[node_idx['initial']] == 1)

        # restricao: x[j] = 1 se existe aresta de algum no i com x[i]=1
        for nid, node in dialogue.items():
            i = node_idx[nid]
            for ch in node.get('choices', []):
                t = ch.get('goto')
                if t and t in node_idx:
                    j = node_idx[t]
                    model.AddImplication(x[i], x[j])

        solver = cp_model.CpSolver()

        # Minimizar nao-visitados
        model.Minimize(sum(1 - x_i for x_i in x))

        status = solver.Solve(model)
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            unreachable = [nodes[i] for i in range(n) if not solver.Value(x[i])]
            if unreachable:
                issues.append(('ERR', f'nos INACIAVEIS: {unreachable}'))

            # Verificar se todos os terminals sao alcancaveis
            terminals = [nid for nid, node in dialogue.items() if not node.get('choices')]
            unreachable_terminals = [t for t in terminals if t in unreachable or not solver.Value(x[node_idx[t]])]
            if unreachable_terminals:
                issues.append(('ERR', f'terminais inacanciaveis: {unreachable_terminals}'))

        # Minimizar visitas (descobrir se todos os nos sao TODOS visitados em algum caminho)
        model2 = cp_model.CpModel()
        x2 = [model2.NewBoolVar(f'v_{nodes[i]}') for i in range(n)]
        model2.Add(x2[0] == 1)
        for nid, node in dialogue.items():
            i = node_idx[nid]
            for ch in node.get('choices', []):
                t = ch.get('goto')
                if t and t in node_idx:
                    j = node_idx[t]
                    model2.Add(x2[j] >= x2[i])

        model2.Minimize(sum(1 - x2[i] for i in range(n)))
        status2 = solver.Solve(model2)
        if status2 == cp_model.OPTIMAL or status2 == cp_model.FEASIBLE:
            visited_count = sum(solver.Value(x2[i]) for i in range(n))
            if visited_count < n:
                issues.append(('INFO', f'max {visited_count}/{n} nosreachable'))

    # Extras: estrategia
    flawed = False
    if strategy == 'HardProber':
        for nid, node in dialogue.items():
            choices = node.get('choices', [])
            actions = {ch.get('pdAction') for ch in choices if ch.get('pdAction')}
            if 'D' in actions and 'C' not in actions:
                pass  # alguns nos H prob ambos tem C/D
    # Cycles
    cycles = []
    for start in dialogue:
        q = deque([(start, [start])])
        while q:
            cn, path = q.popleft()
            for ch in dialogue[cn].get('choices', []):
                t = ch.get('goto')
                if t == start and len(path) >= 1:
                    cycles.append(path + [t])
                elif t and t not in path:
                    q.append((t, path + [cn]))
    if cycles:
        unique = list({tuple(c) for c in cycles})
        cycle_strs = [' → '.join(c) for c in unique]
        issues.append(('INFO', f'ciclos: {cycle_strs}'))

    return {'name': name, 'strategy': strategy, 'issues': issues}

print('╔══════════════════════════════════════════════╗')
print('║       AUDITORIA CP-SAT DE DIALOGOS          ║')
print('╚══════════════════════════════════════════════╝\n')

for cid, contact in contacts.items():
    result = audit_contact(cid, contact)
    issues = result['issues']
    if issues:
        print(f'▌ {result["name"]} ({result["strategy"]}) ')
        for typ, msg in issues:
            marker = {'FATAL': '✗', 'ERR': '¤', 'WARN': '△', 'INFO': '◎'}.get(typ, '?')
            print(f'    {marker} [{typ}] {msg}')
        print()
    else:
        print(f'    ✓ {result["name"]} ({result["strategy"]})')
print('\nLegend: ✗=fatal, ¤=error, △=warning, ◎=info')