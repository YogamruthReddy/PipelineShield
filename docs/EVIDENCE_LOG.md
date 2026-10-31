# PipelineShield Change & Evidence Log 📋

This log records verifiable milestones, test results, visual evidence, and implementation boundaries across PipelineShield. Every major change records what was built, why, exact verification outputs, and known limitations.

---

## 📝 Evidence Entry Template

```markdown
### Milestone: [Short Title]
- **Date**: YYYY-MM-DD
- **Author**: [Contributor Name]
- **Branch**: `feat/...` or `fix/...`
- **Commit SHA**: `<short-sha>`

#### 1. Purpose & Summary
[Concise summary of what was changed and the problem solved]

#### 2. Local Verification Commands & Exact Results
| Check | Command | Result | Exit Code |
|---|---|:---:|:---:|
| Dashboard Lint | `npm run lint --prefix dashboard` | PASS (0 errors, 0 warnings) | 0 |
| Dashboard Contract | `npm run test:contract --prefix dashboard` | PASS (10/10) | 0 |
| Dashboard Navigation | `npm run test:nav --prefix dashboard` | PASS (7/7) | 0 |
| Dashboard Webpack Build | `npm run build --prefix dashboard -- --webpack` | PASS (static pages compiled) | 0 |
| Report Verifier | `python scripts/verify_dashboard_report.py` | PASS (5/5) | 0 |
| Python Engine Tests | `pytest engine/tests -q` | PASS (261/261) | 0 |
| Git Whitespace Hygiene | `git diff --check` | PASS (clean) | 0 |

#### 3. Visual Evidence & Demo Walkthrough
- Scenarios tested: [e.g. Vulnerable PR (BLOCK), Clean Baseline (PASS), Advisory Warnings (WARN), Scanner Error (ERROR)]
- Screenshots / UI Walkthrough captured: [file references or description]

#### 4. Scope Boundaries & Known Limitations
- Implemented: [Exact functional capabilities completed]
- Demonstration / Synthetic: [Features currently driven by static sample datasets]
- Pending / Future Work: [Unbuilt integrations, live GitHub Actions stream ingestion, etc.]
```

---

## 📜 Verified Milestone Records

### Milestone: Repeatable Contribution, Verification & Release Workflow
- **Date**: 2026-10-31
- **Branch**: `feat/multi-view-secops-dashboard`
- **Scope**: Repeatable contribution process, CI workflow triggers, navigation test automation, and evidence standard

#### 1. Purpose & Summary
- Established `CONTRIBUTING.md` governing branch naming, atomic conventional commits, local verification commands, PR evidence requirements, and process-protection of `main`.
- Updated `.github/workflows/security-gate.yml` to trigger on pushes to `main`, `feat/**`, `fix/**`, and `chore/**`, plus all pull requests to `main`, with concurrency cancellation.
- Integrated `npm run test:nav` into the CI `dashboard-build` job to automatically test multi-criteria filtering, sorting, and gate classification on every run.
- Established `docs/EVIDENCE_LOG.md` to record verified outputs, visual evidence, and implementation boundaries for every major change.

#### 2. Verification Results
| Check | Command | Result | Exit Code |
|---|---|:---:|:---:|
| Dashboard Lint | `npm run lint --prefix dashboard` | PASS (0 errors, 0 warnings) | 0 |
| Dashboard Contract | `npm run test:contract --prefix dashboard` | PASS (10/10) | 0 |
| Dashboard Navigation | `npm run test:nav --prefix dashboard` | PASS (7/7) | 0 |
| Dashboard Webpack Build | `npm run build --prefix dashboard -- --webpack` | PASS (static pages generated) | 0 |
| Report Verifier | `python scripts/verify_dashboard_report.py` | PASS (5/5) | 0 |
| Python Engine Tests | `pytest engine/tests -q` | PASS (261/261) | 0 |
| Git Whitespace Hygiene | `git diff --check` | PASS (clean) | 0 |

#### 3. Scope Boundaries & Known Limitations
- **Local Verification vs. Remote CI**: The CI workflow configuration has been verified locally and linted, but its execution on GitHub runners and the exact status-check names will only be verified after pushing to the remote repository.
- **Manual Repository Settings**: GitHub branch-protection rules on `main` (mandatory PR review, required status checks, linear history) and Vercel deployment protections require manual configuration in the GitHub web interface.

---

### Milestone: Three-Tier Typography Architecture & UI/UX Elevation
- **Date**: 2026-10-31
- **Branch**: `feat/multi-view-secops-dashboard`
- **Scope**: Typography standardization and executive console UX polish

#### 1. Purpose & Summary
- Established a cohesive, self-hosted three-font hierarchy:
  - **Inter**: Interface text, navigation, headings, body, labels, buttons, tables, and form controls.
  - **IBM Plex Mono**: Technical data (CVE/CWE IDs, file paths, hashes, package versions, exit codes, timestamps, and code evidence blocks).
  - **Lora**: Limited editorial presentation title and section openers.
- Replaced fragmented layout with an Executive Verdict Hero Card, interactive Severity Spectrum bar with click-to-filter, top-bar scenario dataset switcher dropdown, and 4-tab finding detail slide-over drawer (Overview, Code Evidence, Remediation CLI, Policy Gate Decision Trace).

#### 2. Verification Results
| Check | Command | Result | Exit Code |
|---|---|:---:|:---:|
| Dashboard Lint | `npm run lint --prefix dashboard` | PASS (0 errors, 0 warnings) | 0 |
| Dashboard Contract | `npm run test:contract --prefix dashboard` | PASS (10/10) | 0 |
| Dashboard Navigation | `npm run test:nav --prefix dashboard` | PASS (7/7) | 0 |
| Dashboard Webpack Build | `npm run build --prefix dashboard -- --webpack` | PASS (static pages generated) | 0 |
| Report Verifier | `python scripts/verify_dashboard_report.py` | PASS (5/5) | 0 |
| Python Engine Tests | `pytest engine/tests -q` | PASS (261/261) | 0 |
| Git Whitespace Hygiene | `git diff --check` | PASS (clean) | 0 |

#### 3. Visual & Interactive Evidence
- **Scenario Datasets**: Verified all 4 core evaluation states (`Vulnerable PR (BLOCK)`, `Clean Baseline (PASS)`, `Advisory Warnings (WARN)`, `Scanner Failure (ERROR)`) via top navigation dropdown.
- **Interactive Filtering**: Severity segmented bar and KPI cards correctly filter the findings workspace on click.
- **Finding Drawer**: 4 tabs verified with code block line highlighting and copyable `npm update` remediation commands.

#### 4. Scope Boundaries & Known Limitations
- **Implemented**: Local interactive DevSecOps dashboard with multi-criteria search/filter, schema-validated JSON report ingestion, PDF/print styling, dark/light theme toggle, and self-hosted fonts.
- **Synthetic Demonstration**: Active scenarios (`Vulnerable PR`, `Clean Baseline`, etc.) use bundled schema-compliant synthetic datasets when no external report JSON is uploaded.
- **Pending Integration**: Direct WebSocket/REST ingestion from live running GitHub Actions workflows is not yet implemented (reports are ingested via file upload or local CI outputs).

---

### Milestone: Multi-View DevSecOps Dashboard & Light-First Theme
- **Date**: 2026-10-31
- **Branch**: `feat/multi-view-secops-dashboard`
- **Scope**: Navigation restructuring, light-first palette, brand emblem, and view modularity

#### 1. Purpose & Summary
- Transitioned single-page report into a multi-view console with persistent collapsible sidebar and top command bar across 7 views: Overview, Security Findings, Scanners, Policy Rules, Reports & Exports, CI/CD Runs, and Settings.
- Integrated brand emblem logo (`dashboard/public/shield-icon.png`) and multi-size favicons.
- Implemented light-first theme tokens with Tailwind v4 custom dark-mode variant scoping (`@variant dark (&:where(.dark, .dark *));`) to prevent OS-level dark theme override on clean loads.

#### 2. Verification Results
- `npm run lint`: PASS (0 errors)
- `npm run test:contract`: PASS (10/10)
- `npm run test:nav`: PASS (7/7)
- `python scripts/verify_dashboard_report.py`: PASS (5/5)
- `pytest engine/tests -q`: PASS (261/261)

---

### Milestone: Cross-Platform Contract Verification Baseline
- **Date**: 2026-10-31
- **Branch**: `fix/cross-platform-test-contract` (merged to `main` at commit `f6906bc`)
- **Scope**: Windows/POSIX cross-platform CLI compatibility in contract test harness

#### 1. Purpose & Summary
- Resolved platform-specific Python execution path in Node.js test harness (`scripts/test_dashboard_contract.mjs`) by dynamically locating active virtual environment binary (`engine/.venv/Scripts/python.exe` on Windows vs `engine/.venv/bin/python` on Linux/macOS).
- Validated shared report schema integrity across all scanner outputs.

#### 2. Verification Results
- 10/10 contract tests passed across Windows and Linux environments.
- 261/261 Python engine tests passed.

