#!/usr/bin/env python3
"""
interview.py — Motor de entrevistas baseado em Dilema do Prisioneiro
usando axelrod-python para simular personalidades NPC no jogo Murphy Law.

Uso:
  python3 -m scripts.puzzle.interview --simulate zeca C C D
  python3 -m scripts.puzzle.interview --tournament --turns 10
  python3 -m scripts.puzzle.interview --validate src/game_data.json
  python3 -m scripts.puzzle.interview --generate-clue-map --output clue_map.json
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import axelrod as axl

from scripts.shared.config import GAME_DATA_PATH

C = axl.Action.C
D = axl.Action.D

PAYOFF_MATRIX = {
    (C, C): (3, 3),
    (C, D): (0, 5),
    (D, C): (5, 0),
    (D, D): (1, 1),
}

TOURNAMENT_RANKING = [
    {"strategy": "SoftGrudger",      "rank": 0, "score": 2.7270, "coop": 0.784, "wins": 3.0},
    {"strategy": "Grudger",          "rank": 1, "score": 2.6698, "coop": 0.501, "wins": 4.0},
    {"strategy": "TitForTat",        "rank": 2, "score": 2.6252, "coop": 0.751, "wins": 0.0},
    {"strategy": "Forgiver",         "rank": 3, "score": 2.6187, "coop": 0.509, "wins": 4.0},
    {"strategy": "WinStayLoseShift", "rank": 4, "score": 2.3591, "coop": 0.737, "wins": 1.0},
    {"strategy": "TitFor2Tats",      "rank": 5, "score": 2.3454, "coop": 0.779, "wins": 0.0},
    {"strategy": "Defector",         "rank": 6, "score": 2.2767, "coop": 0.000, "wins": 11.0},
]

NOIR_ARCHETYPES = {
    "SoftGrudger": {
        "archetype": "Cúmplice Relutante",
        "description": "Coopera, mas após uma traição pune brevemente antes de perdoar. Rancor temporário.",
        "cutoff": "threshold",
        "cutoff_threshold": 3,
        "noir_voice": "Ressentida, mas não vingativa. Pune e depois relembra. A memória é curta, mas o golpe é preciso.",
        "tournament_rank": 0,
        "tournament_score": 2.7270,
    },
    "Grudger": {
        "archetype": "Aliado Implacável",
        "description": "Coopera até ser traído uma vez. Depois, nunca mais.",
        "cutoff": "always",
        "cutoff_threshold": 1,
        "noir_voice": "Leal até o fim — mas o fim é definitivo. Uma traição e a porta se fecha.",
        "tournament_rank": 1,
        "tournament_score": 2.6698,
    },
    "TitForTat": {
        "archetype": "Informante Justo",
        "description": "Reciprocidade imediata. Coopera se você cooperar, trai se você trair.",
        "cutoff": "always",
        "cutoff_threshold": 1,
        "noir_voice": "Cauteloso, calculista. Mede cada palavra. Olhos que avaliam.",
        "tournament_rank": 2,
        "tournament_score": 2.6252,
    },
    "Forgiver": {
        "archetype": "Detetive Leniente",
        "description": "Coopera e perdoa traições com probabilidade de 10%. Quase sempre dá outra chance.",
        "cutoff": "never",
        "cutoff_threshold": 0,
        "noir_voice": "Compreensivo. Vê bem onde outros vêem mal. Perdoa quase tudo — quase.",
        "tournament_rank": 3,
        "tournament_score": 2.6187,
    },
    "WinStayLoseShift": {
        "archetype": "Informante Pragmático",
        "description": "Mantém o que funciona, muda o que não funciona. Sem cortes permanentes.",
        "cutoff": "never",
        "cutoff_threshold": 0,
        "noir_voice": "Pragmática. Adapta-se ao resultado. Se ganhou, repete. Se perdeu, muda.",
        "tournament_rank": 4,
        "tournament_score": 2.3591,
    },
    "TitFor2Tats": {
        "archetype": "Parceiro Cauteloso",
        "description": "Tolera uma traição. Na segunda, corta.",
        "cutoff": "threshold",
        "cutoff_threshold": 2,
        "noir_voice": "Paciente, mas com limites. Dá uma segunda chance. Nunca uma terceira.",
        "tournament_rank": 5,
        "tournament_score": 2.3454,
    },
    "Defector": {
        "archetype": "Suspeito Hostil",
        "description": "Sempre trai. Nunca coopera de verdade. Nunca corta — não precisa.",
        "cutoff": "never",
        "cutoff_threshold": 0,
        "noir_voice": "Manipuladora. Cada palavra é uma armadilha. Cooperação é encenação.",
        "tournament_rank": 6,
        "tournament_score": 2.2767,
    },
}

STRATEGY_CLASS_MAP = {
    "SoftGrudger": axl.SoftGrudger,
    "Grudger": axl.Grudger,
    "TitForTat": axl.TitForTat,
    "Forgiver": axl.Forgiver,
    "WinStayLoseShift": axl.WinStayLoseShift,
    "TitFor2Tats": axl.TitFor2Tats,
    "Defector": axl.Defector,
}

NPC_CONTACTS = {
    "dra_cunha": {
        "name": "Dra. Cunha",
        "strategy": "SoftGrudger",
        "medium": "telefone",
        "hint_rooms": ["diretoria"],
        "clue_reward": "Prontuário médico — prova de extorsão com ameaça",
    },
    "santos": {
        "name": "Polizist Santos",
        "strategy": "Grudger",
        "medium": "telefone",
        "hint_rooms": ["delegacia"],
        "clue_reward": "Relatório interno — conexão Volkspolizeistation 8 com o crime",
    },
    "zeca": {
        "name": "Zeca do Gasthof",
        "strategy": "TitForTat",
        "medium": "telefone",
        "hint_rooms": ["bar"],
        "clue_reward": "Lagerhaus 7 — endereço do armazém ligado ao caso",
    },
    "diretora_elvira": {
        "name": "Diretora Elvira Campos",
        "strategy": "Forgiver",
        "medium": "telefone",
        "hint_rooms": ["escola"],
        "clue_reward": "Registros da Volksschule — horários e movimentação suspeita",
    },
    "seu_jonas": {
        "name": "Seu Jonas",
        "strategy": "WinStayLoseShift",
        "medium": "carta",
        "hint_rooms": ["beco"],
        "clue_reward": "Testamento não registrado — motivação financeira escondida",
    },
}


@dataclass
class InterviewResult:
    contact_id: str
    player_moves: list
    npc_moves: list
    interactions: list[tuple]
    player_score: int = 0
    npc_score: int = 0
    clue_earned: bool = False
    cutoff_triggered: bool = False
    cutoff_reason: str = ""
    round_details: list = field(default_factory=list)

    def __post_init__(self):
        for pair in self.interactions:
            payoff = PAYOFF_MATRIX[pair]
            self.player_score += payoff[0]
            self.npc_score += payoff[1]


def simulate_interview(
    contact_id: str,
    player_moves: list[str],
    turns: Optional[int] = None,
    noise: float = 0.0,
) -> InterviewResult:
    contact = NPC_CONTACTS[contact_id]
    strategy_name = contact["strategy"]
    strategy_cls = STRATEGY_CLASS_MAP[strategy_name]
    npc_player = strategy_cls()

    if turns is None:
        turns = len(player_moves)

    player_action_seq = []
    for move_str in player_moves:
        if move_str.upper() in ("C", "COOPERATE", "COOPERAR"):
            player_action_seq.append(C)
        elif move_str.upper() in ("D", "DEFECT", "TRAIR"):
            player_action_seq.append(D)
        else:
            raise ValueError(f"Jogada inválida: {move_str!r}. Use C ou D.")

    class ScriptedPlayer(axl.Player):
        name = "MurphyLawPlayer"
        classifier = {
            "memory_depth": 0,
            "stochastic": False,
            "long_run_time": False,
            "inspects_source": False,
            "manipulates_source": False,
            "manipulates_state": False,
        }

        def __init__(self, moves):
            super().__init__()
            self._scripted = list(moves)

        def strategy(self, opponent):
            idx = len(self.history)
            if idx < len(self._scripted):
                return self._scripted[idx]
            return C

    murphy = ScriptedPlayer(player_action_seq)

    game = axl.Game()
    if noise > 0:
        match = axl.Match(
            (murphy, npc_player),
            turns=turns,
            game=game,
            noise=noise,
        )
    else:
        match = axl.Match(
            (murphy, npc_player),
            turns=turns,
            game=game,
        )

    interactions = match.play()

    archetype_data = NOIR_ARCHETYPES[strategy_name]
    player_defections = sum(1 for p_move, _ in interactions if p_move == D)

    cutoff_triggered = False
    cutoff_reason = ""
    if archetype_data["cutoff"] == "always" and player_defections >= 1:
        cutoff_triggered = True
        cutoff_reason = f"{strategy_name}: qualquer traição causa corte permanente"
    elif archetype_data["cutoff"] == "threshold" and player_defections >= archetype_data["cutoff_threshold"]:
        cutoff_triggered = True
        cutoff_reason = f"{strategy_name}: {player_defections} traições ≥ limite {archetype_data['cutoff_threshold']}"

    clue_earned = not cutoff_triggered

    round_details = []
    for i, (p_move, n_move) in enumerate(interactions):
        payoff = PAYOFF_MATRIX[(p_move, n_move)]
        round_details.append({
            "round": i + 1,
            "player_move": "C" if p_move == C else "D",
            "npc_move": "C" if n_move == C else "D",
            "player_payoff": payoff[0],
            "npc_payoff": payoff[1],
        })

    return InterviewResult(
        contact_id=contact_id,
        player_moves=[m.upper() for m in player_moves],
        npc_moves=["C" if m == C else "D" for _, m in interactions],
        interactions=interactions,
        clue_earned=clue_earned,
        cutoff_triggered=cutoff_triggered,
        cutoff_reason=cutoff_reason,
        round_details=round_details,
    )


def run_tournament(strategies: Optional[list[str]] = None, turns: int = 10,
                   repetitions: int = 5) -> dict:
    if strategies is None:
        strategies = list(STRATEGY_CLASS_MAP.keys())

    players = [STRATEGY_CLASS_MAP[s]() for s in strategies]
    players.append(axl.Cooperator())
    players.append(axl.Random())

    names = strategies + ["Cooperator", "Random"]

    tournament = axl.Tournament(players, turns=turns, repetitions=repetitions)
    results = tournament.play(progress_bar=False)

    rankings = []
    for i, name in enumerate(names):
        player_idx = i
        ranked = results.ranked_names
        rank = next(r for r, n in enumerate(ranked) if n == players[player_idx].name)
        rankings.append({
            "strategy": name,
            "rank": rank + 1,
            "score": float(results.scores[player_idx][0]) if results.scores else 0,
            "wins": results.wins[player_idx] if player_idx < len(results.wins) else 0,
        })

    return {
        "turns": turns,
        "repetitions": repetitions,
        "rankings": sorted(rankings, key=lambda r: r["rank"]),
    }


def validate_game_data(game_data_path: str) -> list[dict]:
    with open(game_data_path, encoding="utf-8") as f:
        data = json.load(f)

    issues = []
    contacts_data = data.get("PHONE_CONTACTS", {})

    for contact_id, contact in contacts_data.items():
        strategy = contact.get("axelrodStrategy", "")
        if strategy not in STRATEGY_CLASS_MAP:
            issues.append({
                "contact": contact_id,
                "severity": "error",
                "message": f"Estratégia desconhecida: {strategy!r}",
                "expected": list(STRATEGY_CLASS_MAP.keys()),
            })

        dialogue = contact.get("dialogue", {})
        for node_id, node in dialogue.items():
            choices = node.get("choices", [])
            if len(choices) == 0:
                continue
            if len(choices) != 3:
                issues.append({
                    "contact": contact_id,
                    "node": node_id,
                    "severity": "warning",
                    "message": f"Node tem {len(choices)} escolhas, esperado 3 (C/D/E)",
                })
            for choice in choices:
                pd_action = choice.get("pdAction", "")
                if pd_action and pd_action not in ("C", "D", "E"):
                    issues.append({
                        "contact": contact_id,
                        "node": node_id,
                        "severity": "error",
                        "message": f"pdAction inválido: {pd_action!r}",
                        "expected": ["C", "D", "E"],
                    })
                if choice.get("hint"):
                    issues.append({
                        "contact": contact_id,
                        "node": node_id,
                        "severity": "warning",
                        "message": "Campo 'hint' encontrado — PISTA badge não deve ser inline",
                    })

    for contact_id in NPC_CONTACTS:
        if contact_id not in contacts_data:
            issues.append({
                "contact": contact_id,
                "severity": "warning",
                "message": f"Contato {contact_id!r} esperado mas ausente de PHONE_CONTACTS",
            })

    return issues


def generate_interview_clue_interactables(clue_map: Optional[dict] = None) -> list[dict]:
    if clue_map is None:
        clue_map = generate_clue_map()

    from scripts.shared.geometry import find_free_position

    interactables = []
    for contact_id, cdata in clue_map["npc_contacts"].items():
        hint_rooms = cdata["hint_rooms"]
        clue_reward = cdata["clue_reward"]
        strategy = cdata["strategy"]
        archetype = cdata["archetype"]
        cutoff_rule = cdata["cutoff_rule"]
        cutoff_threshold = cdata["cutoff_threshold"]

        room_id = hint_rooms[0] if hint_rooms else "escritorio"

        cutoff_desc = {
            "always": "Qualquer traição encerra a parceria.",
            "threshold": f"Traição {cutoff_threshold}x encerra a parceria.",
            "never": "Este contato nunca encerra a conversa.",
        }[cutoff_rule]

        document_lines = [
            "═══════════════════════════════════════",
            f" INFORMAÇÃO CONFIDENCIAL — {cdata['name'].upper()}",
            "═══════════════════════════════════════",
            "",
            f"Fonte: {cdata['name']} ({archetype})",
            f"Estratégia comportamental: {strategy}",
            f"Canal: {cdata['medium']}",
            "",
            f"REGISTO DA ENTREVISTA:",
            f"{clue_reward}",
            "",
            "── NOTA DO ARQUIVO ──",
            f"Esta informação só é acessível se a",
            f"entrevista com {cdata['name']} for bem-sucedida.",
            f"Perfil do contato: {cutoff_desc}",
            "",
            f"[Restrição: interview_gate={contact_id}]",
        ]

        interactables.append({
            "id": f"interview_clue_{contact_id}",
            "room": room_id,
            "x": 50.0,
            "y": 50.0,
            "icon": "FileKey",
            "type": "terminal_read",
            "label": f"Pista de {cdata['name'].split()[-1]} — Entrevista",
            "width": 10.0,
            "height": 10.0,
            "description": f"Um envelope selado. Só abre se {cdata['name'].split()[-1]} cooperar.",
            "interviewGate": contact_id,
            "documentData": {
                "title": f"ENTREVISTA: {cdata['name'].upper()}",
                "content": document_lines,
            },
        })

    return interactables


def merge_interview_clues_into_game_data(
    game_data_path: str,
    output_path: Optional[str] = None,
) -> dict:
    from scripts.shared.geometry import find_free_position

    if output_path is None:
        output_path = game_data_path

    clue_map = generate_clue_map()
    interactables = generate_interview_clue_interactables(clue_map)

    with open(game_data_path, encoding="utf-8") as f:
        data = json.load(f)

    rooms = data["GAME_ROOMS"]

    existing_ids = set()
    for room_data in rooms.values():
        for item in room_data.get("interactables", []):
            existing_ids.add(item.get("id", ""))

    for item in interactables:
        if item["id"] in existing_ids:
            for room_data in rooms.values():
                room_items = room_data.get("interactables", [])
                for i, existing in enumerate(room_items):
                    if existing.get("id") == item["id"]:
                        room_items[i] = item
                        break
            continue

        room_id = item.pop("room")
        if room_id in rooms:
            existing = rooms[room_id].get("interactables", [])
            x, y = find_free_position(room_id, item.get("width", 10.0), item.get("height", 10.0), existing)
            item["x"] = x
            item["y"] = y
            rooms[room_id]["interactables"].append(item)

    data["_interviewClueMap"] = clue_map

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return data


def generate_clue_map() -> dict:
    clue_map = {
        "description": "Mapa de pistas desbloqueadas por entrevistas bem-sucedidas",
        "payoff_matrix": {f"{k[0]},{k[1]}": list(v) for k, v in PAYOFF_MATRIX.items()},
        "npc_contacts": {},
    }

    for contact_id, contact in NPC_CONTACTS.items():
        strategy_name = contact["strategy"]
        archetype = NOIR_ARCHETYPES[strategy_name]

        all_c_result = simulate_interview(contact_id, ["C"] * 5)
        first_d_result = simulate_interview(contact_id, ["D"] + ["C"] * 4)
        two_d_result = simulate_interview(contact_id, ["D", "D"] + ["C"] * 3)

        clue_map["npc_contacts"][contact_id] = {
            "name": contact["name"],
            "strategy": strategy_name,
            "archetype": archetype["archetype"],
            "noir_voice": archetype["noir_voice"],
            "medium": contact["medium"],
            "hint_rooms": contact["hint_rooms"],
            "clue_reward": contact["clue_reward"],
            "cutoff_rule": archetype["cutoff"],
            "cutoff_threshold": archetype["cutoff_threshold"],
            "simulation": {
                "all_cooperate": {
                    "player_score": all_c_result.player_score,
                    "npc_score": all_c_result.npc_score,
                    "npc_response_pattern": all_c_result.npc_moves,
                    "clue_earned": all_c_result.clue_earned,
                    "cutoff": all_c_result.cutoff_triggered,
                },
                "first_defect_then_cooperate": {
                    "player_score": first_d_result.player_score,
                    "npc_score": first_d_result.npc_score,
                    "npc_response_pattern": first_d_result.npc_moves,
                    "clue_earned": first_d_result.clue_earned,
                    "cutoff": first_d_result.cutoff_triggered,
                    "cutoff_reason": first_d_result.cutoff_reason,
                },
                "two_defects_then_cooperate": {
                    "player_score": two_d_result.player_score,
                    "npc_score": two_d_result.npc_score,
                    "npc_response_pattern": two_d_result.npc_moves,
                    "clue_earned": two_d_result.clue_earned,
                    "cutoff": two_d_result.cutoff_triggered,
                    "cutoff_reason": two_d_result.cutoff_reason,
                },
            },
        }

    return clue_map


def _format_result(result: InterviewResult) -> str:
    contact = NPC_CONTACTS[result.contact_id]
    archetype = NOIR_ARCHETYPES[contact["strategy"]]

    lines = []
    lines.append(f"═══ ENTREVISTA: {contact['name']} ═══")
    lines.append(f"  Estratégia: {contact['strategy']} — {archetype['archetype']}")
    lines.append(f"  {archetype['noir_voice']}")
    lines.append("")

    for rd in result.round_details:
        p_label = "Cooperar" if rd["player_move"] == "C" else "Trair"
        n_label = "Cooperar" if rd["npc_move"] == "C" else "Trair"
        lines.append(
            f"  Rodada {rd['round']}: "
            f"Murphy={p_label}({rd['player_payoff']})  "
            f"NPC={n_label}({rd['npc_payoff']})"
        )

    lines.append("")
    lines.append(f"  Placar final — Murphy: {result.player_score}  NPC: {result.npc_score}")
    lines.append(f"  Pista desbloqueada: {'SIM' if result.clue_earned else 'NÃO'}")
    if result.cutoff_triggered:
        lines.append(f"  CORTE PERMANENTE: {result.cutoff_reason}")
    if result.clue_earned:
        lines.append(f"  Recompensa: {contact['clue_reward']}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Motor de entrevistas PD para Murphy Law — usa axelrod-python"
    )

    sub = parser.add_subparsers(dest="command", required=True)

    sim = sub.add_parser("simulate", help="Simula uma entrevista com um contato NPC")
    sim.add_argument("contact", choices=list(NPC_CONTACTS.keys()), help="ID do contato")
    sim.add_argument("moves", nargs="+", help="Sequência de jogadas (C/D)")
    sim.add_argument("--noise", type=float, default=0.0, help="Probabilidade de ruído (0-1)")

    tour = sub.add_parser("tournament", help="Torneiro entre estratégias NPC")
    tour.add_argument("--turns", type=int, default=10, help="Rodadas por partida")
    tour.add_argument("--repetitions", type=int, default=5, help="Repetições")

    val = sub.add_parser("validate", help="Valida game_data.json contra schema PD")
    val.add_argument("game_data", nargs="?", default=str(GAME_DATA_PATH))

    cmap = sub.add_parser("generate-clue-map", help="Gera mapa de pistas por entrevista")
    cmap.add_argument("--output", "-o", default="clue_map.json", help="Arquivo de saída")

    explore = sub.add_parser("explore", help="Explora estratégias axelrod disponíveis")
    explore.add_argument("--filter-memory", type=int, help="Filtrar por memory_depth")
    explore.add_argument("--stochastic", action="store_true", help="Incluir estocásticas")
    explore.add_argument("--limit", type=int, default=20, help="Máximo de estratégias")

    merge = sub.add_parser("merge-interview-clues", help="Mescla pistas de entrevista no game_data.json")
    merge.add_argument("game_data", nargs="?", default=str(GAME_DATA_PATH))
    merge.add_argument("--output", "-o", help="Arquivo de saída (padrão: sobrescreve input)")

    args = parser.parse_args()

    if args.command == "simulate":
        result = simulate_interview(args.contact, args.moves, noise=args.noise)
        print(_format_result(result))

    elif args.command == "tournament":
        result = run_tournament(turns=args.turns, repetitions=args.repetitions)
        print("═══ TORNEIO NPC — MURPHY LAW ═══")
        print()
        for r in result["rankings"]:
            print(f"  #{r['rank']} {r['strategy']:<22} score={r['score']:.1f}  wins={r['wins']}")
        print()
        print(f"  Rodadas: {result['turns']}  Repetições: {result['repetitions']}")

    elif args.command == "validate":
        issues = validate_game_data(args.game_data)
        if not issues:
            print("✓ game_data.json validado — sem problemas encontrados")
        else:
            errors = [i for i in issues if i["severity"] == "error"]
            warnings = [i for i in issues if i["severity"] == "warning"]
            print(f"✗ {len(errors)} erros, {len(warnings)} avisos")
            for issue in issues:
                prefix = "ERRO" if issue["severity"] == "error" else "AVISO"
                contact = issue.get("contact", "?")
                node = issue.get("node", "")
                loc = f"{contact}/{node}" if node else contact
                print(f"  [{prefix}] {loc}: {issue['message']}")

    elif args.command == "generate-clue-map":
        clue_map = generate_clue_map()
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(clue_map, f, indent=2, ensure_ascii=False)
        print(f"✓ Mapa de pistas gerado: {args.output}")
        for cid, cdata in clue_map["npc_contacts"].items():
            status = "✓ pista" if cdata["simulation"]["all_cooperate"]["clue_earned"] else "✗ sem pista"
            cutoff = " (corte no 1° D)" if cdata["cutoff_rule"] == "always" else \
                     f" (corte após {cdata['cutoff_threshold']} D)" if cdata["cutoff_rule"] == "threshold" else \
                     " (sem corte)"
            print(f"  {cdata['name']:<25} [{cdata['strategy']}] {status}{cutoff}")

    elif args.command == "explore":
        filters = {}
        if args.filter_memory is not None:
            filters["memory_depth"] = args.filter_memory
        if not args.stochastic:
            filters["stochastic"] = False

        filtered = axl.filtered_strategies(filters)
        print(f"═══ ESTRATÉGIAS AXELROD ═══")
        print(f"  Filtros: {filters}")
        print(f"  Encontradas: {len(filtered)} (limitado a {args.limit})")
        print()
        for i, strat_cls in enumerate(filtered[:args.limit]):
            inst = strat_cls()
            cls = inst.classifier
            mem = cls.get("memory_depth", "?")
            sto = "estocástica" if cls.get("stochastic") else "determinística"
            print(f"  {i+1:3d}. {inst.name:<35} mem={mem}  {sto}")

    elif args.command == "merge-interview-clues":
        output = args.output or args.game_data
        merge_interview_clues_into_game_data(args.game_data, output)
        print(f"✓ Pistas de entrevista mescladas em {output}")


if __name__ == "__main__":
    main()
