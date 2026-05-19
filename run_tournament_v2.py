import axelrod as axl
import csv
import numpy as np
from collections import defaultdict
import sys

players = [s() for s in axl.strategies]
print(f"Estratégias: {len(players)}", flush=True)

tournament = axl.Tournament(players, turns=1000, repetitions=3)

# Use Axelrod's Match class directly - much more efficient
game = axl.Game()

player_scores = defaultdict(list)

n = len(players)
match_count = 0
total_matches = n * (n - 1) // 2 + n  # include self-matches

for i in range(n):
    for j in range(i, n):
        for rep in range(3):
            match = axl.Match((players[i], players[j]), turns=1000, game=game)
            result = match.play()
            scores = match.final_score_per_turn()
            p1_name = str(players[i])
            p2_name = str(players[j])
            player_scores[p1_name].append(scores[0])
            player_scores[p2_name].append(scores[1])

        # Reset players for next match
        players[i].reset()
        players[j].reset()

    match_count += 1
    if (i + 1) % 10 == 0:
        pct = 100 * (i + 1) / n
        print(f"  Jogador {i+1}/{n} ({pct:.1f}%)", flush=True)

print(f"Partidas processadas", flush=True)

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
