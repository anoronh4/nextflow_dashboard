# Example data

Synthetic traces for trying the dashboard and for the screenshots in the main README. They contain
no real samples or runs.

| File | What it is |
|------|------------|
| `execution_trace_demo-run-1.txt` | A sarek-like somatic pipeline (FASTQC → BWA-MEM2 → GATK → Strelka/Manta → VEP) over 12 made-up samples `DEMO-01`…`DEMO-12`, on a 224-CPU cluster limit. Two tasks fail and are retried with more memory. |
| `execution_trace_demo-run-2.txt` | The same pipeline a week later, with FASTQC and FASTP cached. |
| `generate_demo_traces.py` | Generates both files. Seeded, so `python3 generate_demo_traces.py <dir>` reproduces them exactly. |
| `images/` | The README images: `overview.png` is a browser screenshot; the rest come from the dashboard's large-text PNG export with the run filter set to `demo-run-1`. |

Load both traces (drag them onto the drop zone or pick them with the file chooser), then use the
**Run** filter to look at one run at a time. The runs are a week apart, so the time-based charts are
easier to read one run at a time.
