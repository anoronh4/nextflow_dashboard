"""Generate the synthetic sarek-like demo traces in this folder (no real data).

Usage: python3 generate_demo_traces.py <output_dir>
Deterministic (seeded), so rerunning reproduces the committed files exactly.
"""
import random, datetime as dt, sys, heapq
random.seed(7)
PFX = "NFCORE_SAREK:SAREK:"
# name, cpus, mem GB, mean %cpu, mean rss GB, mean minutes, write GB
PROCS = [
  ("FASTQC",                  6,  36,  180,  2.1,  12, 0.2),
  ("FASTP",                  12,  24,  880,  3.2,  22, 18),
  ("BWAMEM2_MEM",            24,  96, 2050, 41.0, 125, 45),
  ("SAMTOOLS_SORT",           8,  32,  340, 11.5,  28, 40),
  ("GATK4_MARKDUPLICATES",    8,  64,  115, 27.0,  62, 38),
  ("GATK4_BASERECALIBRATOR",  4,  32,   98,  7.5,  41, 0.1),
  ("GATK4_APPLYBQSR",         4,  32,   97,  5.8,  36, 36),
  ("STRELKA_SOMATIC",        16,  48, 1280,  9.8,  52, 1.2),
  ("MANTA_SOMATIC",          16,  48, 1060, 13.6,  44, 0.8),
  ("ENSEMBLVEP_VEP",          8,  16,  390,  8.7,  26, 0.6),
]
SAMPLES = [f"DEMO-{i:02d}" for i in range(1, 13)]
CAP = 224  # cluster CPUs available to this pipeline

def fmt_dur(m):
    s = int(m*60); h, s = divmod(s, 3600); mi, s = divmod(s, 60)
    return " ".join(x for x in [f"{h}h" if h else "", f"{mi}m" if mi else "", f"{s}s"] if x)
def ts(t0, m): return (t0 + dt.timedelta(minutes=m)).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

def run(t0, cached_upto=None, fail=()):
    """Greedy list-scheduler under a CPU cap; each sample is a chain (Strelka/Manta in parallel)."""
    rows, tid = [], 0
    # per-sample ready time of the next step
    jobs = []  # (ready, sample_idx, step_idx)
    for i, s in enumerate(SAMPLES): jobs.append((i*1.5, i, 0))
    heapq.heapify(jobs)
    running = []  # (end, cpus)
    used = 0; now = 0
    done_bqsr = {}
    while jobs:
        ready, si, pi = heapq.heappop(jobs)
        name, cpus, mem, pcpu, rss, mins, wgb = PROCS[pi]
        s = SAMPLES[si]
        k = random.uniform(0.7, 1.35) * (1.25 if si in (3, 8) else 1)  # two "big" samples
        cached = cached_upto is not None and pi <= cached_upto
        start = ready
        if not cached:
            # wait for capacity
            running.sort()
            while used + cpus > CAP:
                end, c = running.pop(0); used -= c; start = max(start, end)
            start = max(start, ready) + random.uniform(0.2, 2.5)
        dur = 0.05 if cached else mins * k
        status = "CACHED" if cached else "COMPLETED"
        if (s, name) in fail:
            tid += 1
            fdur = dur * 0.4
            rows.append([tid, f"{PFX}{name}", f"{s}@{name.lower()}", "FAILED", cpus, f"{mem} GB",
                         ts(t0, ready), ts(t0, start), ts(t0, start+fdur), fmt_dur(fdur+0.3), fmt_dur(fdur),
                         f"{pcpu*random.uniform(.8,1.1):.1f}%", f"{min(rss*k*1.6, mem*0.99):.1f} GB",
                         f"{wgb*k*0.3:.2f} GB", f"{wgb*k*0.5:.2f} GB"])
            if not cached: running.append((start+fdur, cpus)); used += cpus
            start = start + fdur + random.uniform(1, 6)
            mem = mem * 2
        tid += 1
        rows.append([tid, f"{PFX}{name}", f"{s}@{name.lower()}", status, cpus, f"{mem} GB",
                     ts(t0, ready), ts(t0, start), ts(t0, start+dur), fmt_dur(dur+0.3), fmt_dur(dur),
                     f"{pcpu*random.uniform(.8,1.1):.1f}%", f"{rss*k*random.uniform(.85,1.15):.1f} GB",
                     f"{wgb*k:.2f} GB", f"{wgb*k*1.7:.2f} GB"])
        if not cached: running.append((start+dur, cpus)); used += cpus
        end = start + dur
        nxt = []
        if pi == 6: nxt = [7, 8]                    # BQSR → Strelka + Manta in parallel
        elif pi in (7, 8):
            done_bqsr.setdefault(si, []).append(end)
            if len(done_bqsr[si]) == 2: nxt = [9]; end = max(done_bqsr[si])
        elif pi < 6: nxt = [pi + 1]
        for n in nxt: heapq.heappush(jobs, (end, si, n))
    # reference task (filtered out by the dashboard's isRealSample)
    tid += 1
    rows.insert(0, [tid, f"{PFX}PREPARE_GENOME:BWAMEM2_INDEX", "genome.fa", "CACHED" if cached_upto is not None else "COMPLETED",
                    1, "60 GB", ts(t0,-60), ts(t0,-59), ts(t0,-5), "54m", "54m", "99.0%", "38.0 GB", "4.10 GB", "4.20 GB"])
    return rows

hdr = ["task_id","process","tag","status","cpus","memory","submit","start","complete","duration","realtime","%cpu","peak_rss","write_bytes","wchar"]
for fname, rows in [
    ("execution_trace_demo-run-1.txt", run(dt.datetime(2026,3,2,21,0), fail={("DEMO-04","GATK4_MARKDUPLICATES"),("DEMO-09","BWAMEM2_MEM")})),
    ("execution_trace_demo-run-2.txt", run(dt.datetime(2026,3,9,20,30), cached_upto=1)),
]:
    with open(f"{sys.argv[1]}/{fname}", "w") as f:
        f.write("\t".join(hdr) + "\n" + "\n".join("\t".join(map(str, r)) for r in rows) + "\n")
    print(fname, len(rows), "rows")
