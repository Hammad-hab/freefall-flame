#!/usr/bin/env python3
"""Download NASA Space Apps 'Flame in Freefall' reference papers.
Usage: python download_papers.py   (creates ./flame_papers/)
Stdlib only. Failures (e.g. NTRS records with no PDF) are listed at the end.
"""
import os
import urllib.request

OUT = "flame_papers"

# NTRS record id -> short name
NTRS = {
    "20210011385": "BASS-II_summary_report",
    "20150019858": "BASS-II_CSA-CP_CDM_sensors",
    "20170008805": "Saffire_large-scale_flammability_results",
    "20170001636": "Saffire_objectives_development_status",
    "20170000230": "Saffire_ICES_objectives_hardware",
    "20170002628": "Saffire_I-III_overview_slides",
    "20180005168": "Saffire_I-III_results_slides",
    "20210017780": "Saffire_IV-V_preliminary_results",
    "20150000894": "Saffire_poster",
    "20130000422": "SAME-2_particle_morphology_size",
    "20120012884": "SAME-R_preliminary_results",
    "20150010172": "SAME-R_particle_morphology",
    "20150023456": "FLEX_detailed_results_TP-2015-216046",
    "20130014061": "FLEX_methanol_droplet_combustion",
    "20140006750": "FLEX_cool_flame_alkane_droplets",
    "20120015928": "FLEX_decisive_step_forward",
    "20120017940": "ISS_combustion_experiments_overview",
    "20210021781": "ACME_JASMAC_paper",
    "20210022542": "ACME_JASMAC-33_slides",
    "20220015583": "ACME_US_National_Combustion_Meeting",
    "20210015913": "ACME_poster_Stocker",
}

OTHER = {
    "SAME_core_ac_uk_moment_method.pdf": "https://core.ac.uk/download/33145886.pdf",
    "SAME_fact_sheet_NASA.pdf": "https://www.nasa.gov/wp-content/uploads/2025/07/smoke-aerosol-measurement-experiment-same.pdf",
    "PSI_system_overview_2015.pdf": "https://www.nationalacademies.org/cdn/materials/9fba0b5f-33a8-4c0c-951b-67dcb346b388",
}

jobs = {
    f"{name}_{rid}.pdf": f"https://ntrs.nasa.gov/api/citations/{rid}/downloads/{rid}.pdf"
    for rid, name in NTRS.items()
}
jobs.update(OTHER)

os.makedirs(OUT, exist_ok=True)
failed = []
for fname, url in jobs.items():
    path = os.path.join(OUT, fname)
    if os.path.exists(path):
        continue
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if not data.startswith(b"%PDF"):
            raise ValueError("not a PDF")
        with open(path, "wb") as f:
            f.write(data)
        print("ok  ", fname)
    except Exception as e:
        print("FAIL", fname, e)
        failed.append((fname, url))

print(f"\n{len(jobs) - len(failed)}/{len(jobs)} downloaded")
for fname, url in failed:
    print("  failed:", url)
