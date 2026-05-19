#!/home/jadson/anaconda3/bin/python3
import axelrod as axl
import csv
import json
import os
import subprocess
import shutil

WORKERS_DIR = "/home/jadson/Documentos/scp_game/axelrod_workers"
CSV_PATH = "/home/jadson/Documentos/scp_game/axelrod_full_ranking.csv"

strategies = axl.strategies
n = len(strategies)
BATCH = 10

os.makedirs(WORKERS_DIR, exist_ok=True)
for f in os.listdir(WORKERS_DIR):
    if f.startswith("result_"):
        os.unlink(os.path.join(WORKERS_DIR, f))

print(f"Estratégias: {n} | Batch: {BATCH} por vez", flush=True)

done = 0
for start in range(0, n, BATCH):
    end = min(start + BATCH, n)
    batch_indices = list(range(start, end))

    procs = []
    for i in batch_indices:
        p = subprocess.Popen(
            ["/home/jadson/anaconda3/bin/python3",
             "/home/jadson/Documentos/scp_game/run_worker.py", str(i)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        procs.append((i, p))

    for i, p in procs:
        out, err = p.communicate()
        if p.returncode != 0:
            print(f"  ERRO worker {i}: {err.decode()[:200]}", flush=True)
        else:
            print(f"  {out.decode().strip()}", flush=True)
        done += 1

    print(f"  Progresso: {done}/{n} ({100*done/n:.1f}%)", flush=True)

print("\nMontando ranking...", flush=True)

results = []
for i in range(n):
    path = f"{WORKERS_DIR}/result_{i:03d}.json"
    if os.path.exists(path):
        with open(path) as f:
            results.append(json.load(f))
    else:
        print(f"  AVISO: {path} não encontrado", flush=True)

results.sort(key=lambda x: x["median_score"], reverse=True)

with open(CSV_PATH, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["Rank", "Nome", "Median_Score_Per_Turn", "Mean_Score_Per_Turn"])
    for rank, r in enumerate(results, 1):
        writer.writerow([rank, r["name"], r["median_score"], r["mean_score"]])

print(f"\nCSV salvo: {CSV_PATH} ({len(results)} linhas)", flush=True)
print("\n=== TOP 20 ===", flush=True)
for rank, r in enumerate(results[:20], 1):
    print(f"  {rank}. {r['name']} — median: {r['median_score']:.4f}, mean: {r['mean_score']:.4f}", flush=True)

print("\n=== BOTTOM 5 ===", flush=True)
for rank, r in enumerate(results[-5:], len(results) - 4):
    print(f"  {rank}. {r['name']} — median: {r['median_score']:.4f}, mean: {r['mean_score']:.4f}", flush=True)

shutil.rmtree(WORKERS_DIR, ignore_errors=True)
print("\nCONCLUÍDO!", flush=True)
