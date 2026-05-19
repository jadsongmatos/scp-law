import sys
sys.path.insert(0, "/home/jadson/anaconda3/lib/python3.13/site-packages")
import axelrod as axl
import csv
import numpy as np
import json
import sys
import os

idx = int(sys.argv[1])
total = len(axl.strategies)
strategies = axl.strategies
my_strategy = strategies[idx]
my_player = my_strategy()
my_name = str(my_player)

game = axl.Game()
scores = []

for j in range(total):
    for rep in range(3):
        opponent = strategies[j]()
        match = axl.Match((my_player, opponent), turns=1000, game=game)
        match.play()
        spt = match.final_score_per_turn()
        scores.append(spt[0])
        my_player.reset()

result = {
    "name": my_name,
    "index": idx,
    "median_score": round(float(np.median(scores)), 4),
    "mean_score": round(float(np.mean(scores)), 4),
}

out_dir = "/home/jadson/Documentos/scp_game/axelrod_workers"
os.makedirs(out_dir, exist_ok=True)
with open(f"{out_dir}/result_{idx:03d}.json", "w") as f:
    json.dump(result, f)

print(f"[{idx+1}/{total}] {my_name} — median: {result['median_score']}, mean: {result['mean_score']}")
