import axelrod as axl
import csv
import numpy as np
from collections import defaultdict

players = [s() for s in axl.strategies]
print(f"Estratégias: {len(players)}", flush=True)

tournament = axl.Tournament(players, turns=1000, repetitions=3)

player_scores = defaultdict(list)

chunks = list(tournament.match_generator.build_match_chunks())
total_chunks = len(chunks)
print(f"Total de chunks: {total_chunks}", flush=True)

GAME = axl.Game()
R, S, T, P = GAME.RPST()

for i, chunk in enumerate(chunks):
    results = tournament._play_matches(chunk, build_results=False)
    for index_pair, interactions in results.items():
        p1_idx, p2_idx = index_pair
        for interaction_data in interactions:
            moves = interaction_data[0]  # list of (C,D) tuples
            p1_moves = [m[0] for m in moves]
            p2_moves = [m[1] for m in moves]
            turns = len(moves)

            p1_score = 0
            p2_score = 0
            for m1, m2 in zip(p1_moves, p2_moves):
                if m1 == axl.Action.C and m2 == axl.Action.C:
                    p1_score += R; p2_score += R
                elif m1 == axl.Action.C and m2 == axl.Action.D:
                    p1_score += S; p2_score += T
                elif m1 == axl.Action.D and m2 == axl.Action.C:
                    p1_score += T; p2_score += S
                else:
                    p1_score += P; p2_score += P

            p1_name = str(players[p1_idx])
            p2_name = str(players[p2_idx])
            player_scores[p1_name].append(p1_score / turns)
            player_scores[p2_name].append(p2_score / turns)

    if (i + 1) % 3000 == 0:
        pct = 100 * (i + 1) / total_chunks
        print(f"  Chunks: {i+1}/{total_chunks} ({pct:.1f}%)", flush=True)

print(f"Chunks processados: {total_chunks}", flush=True)

ranking = []
for name in player_scores:
    scores = player_scores[name]
    median_score = float(np.median(scores))
    mean_score = float(np.mean(scores))
    ranking.append((name, median_score, mean_score))

ranking.sort(key=lambda x: x[1], reverse=True)

with open('/home/jadson/Documentos/scp_game/axelrod_full_ranking.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Rank', 'Nome', 'Median_Score_Per_Turn', 'Mean_Score_Per_Turn'])
    for rank, (name, median_s, mean_s) in enumerate(ranking, 1):
        writer.writerow([rank, name, round(median_s, 4), round(mean_s, 4)])

print(f"\nCSV salvo! ({len(ranking)} linhas)", flush=True)
print("\n=== TOP 20 ===", flush=True)
for rank, (name, median_s, mean_s) in enumerate(ranking[:20], 1):
    print(f"  {rank}. {name} — median: {median_s:.4f}, mean: {mean_s:.4f}", flush=True)

print("\n=== BOTTOM 5 ===", flush=True)
for rank, (name, median_s, mean_s) in enumerate(ranking[-5:], len(ranking) - 4):
    print(f"  {rank}. {name} — median: {median_s:.4f}, mean: {mean_s:.4f}", flush=True)

print("\nCONCLUÍDO!", flush=True)
