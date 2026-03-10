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
    grades = health["grade_distribution"]
    nodes = report["meta"]["total_nodes"]

    badge = {
        "schemaVersion": 1,
        "label": "NEØ Readiness",
        "message": f"{score}/100 · {nodes} nodes · {findings} findings",
        "color": grade_color(score),
        "namedLogo": "data:image/svg+xml;base64,",
        "style": "flat-square",
        "labelColor": "0d0d0d",
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(badge, f, indent=2)

    print(f"Badge: {score}/100 ({grade_color(score)}) — {output_path}")

if __name__ == "__main__":
    main()
