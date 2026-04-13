#!/usr/bin/env python3
"""Generate shields.io endpoint badge JSON from stack-report.json.

Usage: python generate-badge.py stack-report.json reports/readiness-badge.json

Output format follows https://shields.io/endpoint — serves as dynamic badge:
  ![Readiness](https://img.shields.io/endpoint?url=<raw-github-url>&style=flat-square)
"""
import json
import os
import sys

def grade_color(score: float) -> str:
    if score >= 80: return "brightgreen"
    if score >= 65: return "green"
    if score >= 50: return "yellow"
    if score >= 35: return "orange"
    return "red"

def compute_precision(report: dict) -> tuple[int, str, list[str]]:
    health = report.get("ecosystem_health", {})
    meta = report.get("meta", {})
    total_nodes = max(int(meta.get("total_nodes", 0) or 0), 1)
    average_readiness = float(health.get("average_readiness", 0) or 0)
    grades = health.get("grade_distribution", {})
    severities = health.get("findings_by_severity", {})

    grade_weights = {"A": 100, "B": 86, "C": 72, "D": 58, "F": 40}
    graded_nodes = sum(int(count or 0) for count in grades.values())
    if graded_nodes > 0:
        grade_quality = sum(grade_weights.get(grade, 0) * int(count or 0) for grade, count in grades.items()) / graded_nodes
    else:
        grade_quality = average_readiness

    finding_penalty = (
        int(severities.get("critical", 0) or 0) * 6
        + int(severities.get("high", 0) or 0) * 4
        + int(severities.get("medium", 0) or 0) * 2
        + int(severities.get("low", 0) or 0) * 1
        + float(severities.get("info", 0) or 0) * 0.5
    ) / total_nodes

    precision = round(max(0, min(100, (0.68 * average_readiness) + (0.22 * grade_quality) + 12 - (finding_penalty * 4))))
    label = "high" if precision >= 90 else "solid" if precision >= 75 else "watch" if precision >= 60 else "fragile"
    notes = [
        f"readiness={average_readiness:.1f}",
        f"grade={grade_quality:.1f}",
        f"finding_penalty={finding_penalty:.2f}",
    ]
    return precision, label, notes

def main():
    if len(sys.argv) < 3:
        print("Usage: generate-badge.py <report.json> <output-badge.json>")
        sys.exit(1)

    report_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(report_path) as f:
        report = json.load(f)

    health = report["ecosystem_health"]
    score = health["average_readiness"]
    findings = health["total_findings"]
    nodes = report["meta"]["total_nodes"]
    precision, precision_label, precision_notes = compute_precision(report)

    badge = {
        "schemaVersion": 1,
        "label": "NEØ Readiness",
        "message": f"{score}/100 · precision {precision}% · {nodes} nodes · {findings} findings",
        "color": grade_color(score),
        "precision": f"{precision}%",
        "precisionScore": precision,
        "precisionLabel": precision_label,
        "precisionNotes": precision_notes,
        "namedLogo": "data:image/svg+xml;base64,",
        "style": "flat-square",
        "labelColor": "0d0d0d",
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(badge, f, indent=2)

    print(f"Badge: {score}/100 ({grade_color(score)}) precision {precision}% ({precision_label}) — {output_path}")

if __name__ == "__main__":
    main()
