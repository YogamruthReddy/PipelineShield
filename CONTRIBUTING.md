# Contributing to PipelineShield 🛡️

Thank you for contributing to PipelineShield! This guide establishes a repeatable, traceable, and verifiable contribution, review, and release workflow for every change across the project.

---

## 🎯 Core Principles

1. **`main` is Protected by Process**: No direct pushes, force-pushes, auto-merges, or auto-deployments are permitted on `main`. Every change originates from a dedicated feature or fix branch and enters `main` exclusively through a peer-reviewed Pull Request with all CI checks passing.
2. **Focused & Atomic Changes**: Keep each branch and commit limited to a single logical problem or capability. Avoid mixing unrelated refactors, styling changes, and functional additions.
3. **Truthful Evidence**: Never fabricate or assume CI results, screenshots, live GitHub telemetry, or completed features. Distinguish implemented product functionality from synthetic demonstration datasets and future integrations.
4. **Verifiable Before Committing**: Every commit records verified work. Run the full local verification suite before committing and opening a Pull Request.

---

## 🌿 Branch Naming Conventions

All branches must branch from the latest `main` branch using structured, descriptive prefixes:

| Branch Pattern | Purpose | Example |
|---|---|---|
| `feat/<feature-name>` | New user-facing feature or enhancement | `feat/multi-view-secops-dashboard` |
| `fix/<bug-description>` | Bug fix or contract alignment | `fix/cross-platform-test-contract` |
| `chore/<task>` | Dependency updates, tooling, or build setup | `chore/update-pnpm-lock` |
| `docs/<topic>` | Documentation, guides, or evidence logs | `docs/contributing-workflow` |
| `test/<suite>` | Adding or refactoring test coverage | `test/navigation-state-invariants` |

```bash
# Branching from fresh main
git checkout main
git pull origin main
git checkout -b feat/my-scoped-feature
```

---

## ✍️ Commit Conventions

Commits record incremental, verifiable work on feature branches. A commit records changes locally; it does not merge or deploy.

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```text
<type>(<scope>): <concise description in imperative mood>

[optional body explaining WHAT changed and WHY]

[optional footer referencing issues or contracts]
```

### Supported Types
- `feat`: New feature or user capability
- `fix`: Bug fix or contract bug resolution
- `docs`: Documentation changes only
- `test`: Adding or updating test suites
- `refactor`: Code changes that neither fix a bug nor add a feature
- `chore`: Tooling, build configuration, or dependency updates

---

## 🧪 Local Verification Suite

Run all required checks locally before committing or opening a Pull Request.

### Required Checks (Must Pass with Exit Code 0)

| Scope | Check Description | Exact Command | Required Exit Code |
|---|---|---|:---:|
| **Dashboard** | ESLint & React Rules | `npm run lint --prefix dashboard` | `0` |
| **Dashboard** | Shared Contract Tests | `npm run test:contract --prefix dashboard` | `0` |
| **Dashboard** | Navigation & Filter Tests | `npm run test:nav --prefix dashboard` | `0` |
| **Dashboard** | Production Webpack Build | `npm run build --prefix dashboard -- --webpack` | `0` |
| **Engine** | CLI & Dashboard Verifier | `python scripts/verify_dashboard_report.py` | `0` |
| **Engine** | Pytest Policy & Scanners | `pytest engine/tests -q` | `0` |
| **Git** | Whitespace & Hygiene | `git diff --check` | `0` |

### Optional / Deep Diagnostic Checks

```bash
# Python Engine coverage breakdown (HTML & terminal)
pytest --cov=pipelineshield --cov-report=term-missing engine/tests

# Run local Trivy filesystem scan
trivy fs --scanners vuln,misconfig,secret .

# Run local Semgrep static code analysis
semgrep scan --config p/security-audit
```

---

## 🚀 Pull Request Process

1. **Push Feature Branch**:
   ```bash
   git push origin <your-feature-branch>
   ```
2. **Open Pull Request Against `main`**:
   - Set base branch to `main`.
   - Set compare branch to your feature branch.
   - Title matches conventional commit format (e.g. `feat: implement multi-view secops dashboard`).
3. **Fill Out the PR Evidence Template**:
   Every Pull Request must include the standard evidence template:
   - **Summary of Changes**: What was implemented and why.
   - **Verification Results**: Exact commands executed and their output/exit codes.
   - **Visual Evidence & Demo Scenarios**: Screenshots or demonstration walkthroughs.
   - **Limitations & Scope Boundaries**: Explicitly list what is implemented vs synthetic mock vs planned for future releases.
4. **CI Review**:
   GitHub Actions workflow (`CI Security Gate`) will automatically execute on the PR:
   - `engine-test`: Python 3.11 unit tests and coverage upload.
   - `dashboard-build`: Shared TypeScript contract tests, navigation tests, ESLint, and Next.js production build.
   - `security-gate`: Trivy, Semgrep, and Dependency Review security policy enforcement.
5. **Address Feedback**:
   Push follow-up commits to the same branch. Never force-push over review history.

---

## 🔒 Protection of `main` & Merge Policy

- **No Direct Commits**: Direct commits to `main` are disallowed.
- **Never Auto-Merge**: Pull Requests must be reviewed and merged manually with explicit human approval.
- **Merge Criteria**:
  1. All GitHub Actions CI jobs are green (`PASS`).
  2. Peer review approval is documented.
  3. No unresolved conversation threads remain.
  4. Repository merge strategy: **Squash and merge** or **Rebase and merge** to preserve linear history.

---

## 📦 Staged Release & Deployment Approval

- **Deployment Boundary**: Local development and PR verification never deploy to production.
- **Explicit Approval Required**: Deployment (e.g. to Vercel or cloud environments) occurs **only after** PR approval and merge into `main`, and **only with explicit maintainer approval**.
- **Audit Record**: Every release or deployment must record:
  - Deployed Git commit SHA
  - Target environment URL
  - Verification check results of the live endpoint
  - Date and authorizing maintainer

---

## 📑 Presentation & Evidence Materials

- **Separate Deliverable**: The project presentation is a separate explanatory deliverable explaining problem, end-to-end flow, architecture, and verified product evidence.
- **Milestone-Driven**: Update presentation content only when a meaningful milestone changes the working product or its verified status.
- **Honest Evidence**: Use screenshots and metrics captured from the verified dashboard state. Never present demo scenarios as live GitHub telemetry streams. Maintain the Evidence Log in `docs/EVIDENCE_LOG.md`.

