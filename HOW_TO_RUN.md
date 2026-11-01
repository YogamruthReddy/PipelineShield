# How to Run PipelineShield 🛡️

A comprehensive, step-by-step guide to running **PipelineShield** across every environment:
1. **[Prerequisites & System Requirements](#1-prerequisites--system-requirements)**
2. **[Fastest Local Quickstart (Dashboard & Demo Scenarios)](#2-fastest-local-quickstart-dashboard--demo-scenarios)**
3. **[Running the Python Policy Engine & CLI Locally](#3-running-the-python-policy-engine--cli-locally)**
4. **[Running Scanners Locally (Trivy & Semgrep)](#4-running-scanners-locally-trivy--semgrep)**
5. **[Running with Live GitHub CI Ingestion](#5-running-with-live-github-ci-ingestion)**
6. **[Running with GitHub Webhooks (Real-Time Push Sync)](#6-running-with-github-webhooks-real-time-push-sync)**
7. **[Running the Optional Local AI Advisory Copilot (Ollama)](#7-running-the-optional-local-ai-advisory-copilot-ollama)**
8. **[Running in CI/CD (GitHub Actions Pipeline)](#8-running-in-cicd-github-actions-pipeline)**
9. **[Running the Complete Verification & Test Suites (451 Tests)](#9-running-the-complete-verification--test-suites-451-tests)**
10. **[Viewing the Presentation Deck (`/ppt`)](#10-viewing-the-presentation-deck-ppt)**
11. **[Troubleshooting & Common Questions](#11-troubleshooting--common-questions)**

---

## 1. Prerequisites & System Requirements

| Tool | Recommended Version | Purpose | Installation Guide |
| :--- | :--- | :--- | :--- |
| **Python** | `3.11` or `3.12` | Policy Engine, CLI & pytest test suite | [python.org](https://www.python.org/) |
| **Node.js** | `20+` or `22 LTS` (with `npm 10+`) | Next.js Security Dashboard & TypeScript verification | [nodejs.org](https://nodejs.org/) |
| **Git** | `2.40+` | Version control & GitHub CI workflow triggers | [git-scm.com](https://git-scm.com/) |
| **Trivy** *(Optional locally)* | `v0.58+` (CI uses `0.76.1`) | Vulnerability, misconfiguration, and secrets scanning | [aquasecurity.github.io/trivy](https://aquasecurity.github.io/trivy/) |
| **Semgrep** *(Optional locally)* | `1.183+` | SAST and security pattern scanning | `pip install semgrep` |
| **Ollama** *(Optional)* | Latest | Local advisory AI security assistant | [ollama.ai](https://ollama.ai/) |

---

## 2. Fastest Local Quickstart (Dashboard & Demo Scenarios)

If you just want to inspect the **PipelineShield Security Dashboard** without installing security scanners:

### Windows (PowerShell)
```powershell
# Navigate to the dashboard directory
cd dashboard

# Install frontend dependencies
npm.cmd install

# Start the Next.js development server
npm.cmd run dev
```

### Linux / macOS (Bash)
```bash
# Navigate to the dashboard directory
cd dashboard

# Install frontend dependencies
npm install

# Start the Next.js development server
npm run dev
```

Now open **[http://localhost:3000](http://localhost:3000)** in your browser:
- Use the **Demo Scenarios** selector in the top bar to inspect:
  - 🔴 **Vulnerable PR (Scenario 1)** — Blocks on critical CVEs and leaked credentials.
  - 🟢 **Clean Baseline (Scenario 2)** — Passes all security checks cleanly.
  - 🟡 **Advisory Warnings (Scenario 3)** — Non-blocking warnings.
  - ⚠️ **Scanner Failure (Scenario 4)** — Fail-closed behavior on scanner crashes.
- Click **"Load Report"** to upload any local evaluation report (`reports/security-summary.json`).

---

## 3. Running the Python Policy Engine & CLI Locally

The Python engine is responsible for normalizing scanner outputs, applying the declarative security rules in [`config/policy.yaml`](config/policy.yaml), and emitting authoritative gate decisions (`PASS`, `WARN`, `BLOCK`, `ERROR`).

### Step 1: Set up the Python Virtual Environment

#### Windows (PowerShell)
```powershell
# From project root:
cd engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[test]"
cd ..
```

#### Linux / macOS (Bash)
```bash
# From project root:
cd engine
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[test]"
cd ..
```

### Step 2: Run Policy Evaluation on Sample Data

PipelineShield comes with built-in example scan datasets in `examples/`:

#### A. Clean Codebase (Produces Exit Code `0` - PASS):
```bash
python -m pipelineshield.cli `
  --policy config/policy.yaml `
  --findings examples/clean_scan.json `
  --output reports/clean_summary.json `
  --summary-md reports/clean_summary.md
```
*(On Linux/macOS, replace the PowerShell line continuations `` ` `` with `\`)*

#### B. Vulnerable Codebase with Multi-Scanner Inputs (Produces Exit Code `1` - BLOCK):
```bash
python -m pipelineshield.cli `
  --policy config/policy.yaml `
  --trivy examples/trivy_sample.json `
  --semgrep examples/semgrep_sample.json `
  --dependency-review examples/dependency_review_sample.json `
  --output reports/vuln_summary.json `
  --summary-md reports/vuln_summary.md
```

#### C. Malformed / Invalid Input (Produces Exit Code `2` - ERROR):
```bash
python -m pipelineshield.cli `
  --policy config/policy.yaml `
  --findings engine/tests/fixtures/malformed.json
```

### CLI Exit Codes Explained:
- `0`: Gate Passed (or Warnings within allowed thresholds). Pull Request can merge.
- `1`: Gate Blocked (Policy violation: Critical/High finding, banned license, or fail threshold met). Pull Request blocked.
- `2`: Configuration or Parse Failure (Malformed file, missing required policy, or scanner error). Fail-closed enforcement.

---

## 4. Running Scanners Locally (Trivy & Semgrep)

To scan your actual repository code on your workstation:

### Step 1: Create reports directory
```bash
mkdir -p reports
```

### Step 2: Run Trivy Vulnerability & Secret Scan
```bash
# Scans filesystem for vulnerabilities, misconfigurations, and secrets
trivy fs --scanners vuln,misconfig,secret --exit-code 0 --format json --output reports/trivy.json .
```

### Step 3: Run Semgrep SAST Scan
```bash
# Scans code for OWASP Top 10, insecure patterns, and exposed secrets
semgrep scan --config "p/security-audit" --config "p/secrets" --config "p/owasp-top-ten" --json --output reports/semgrep.json
```

### Step 4: Evaluate with PipelineShield CLI
```bash
python -m pipelineshield.cli `
  --policy config/policy.yaml `
  --trivy reports/trivy.json `
  --semgrep reports/semgrep.json `
  --output reports/security-summary.json `
  --summary-md reports/summary.md
```

You can now open `dashboard` and upload `reports/security-summary.json` to inspect your scan findings with full file paths and remediation advice.

---

## 5. Running with Live GitHub CI Ingestion

The dashboard can directly fetch and render real gate evaluation reports produced by your remote GitHub Actions workflow runs:

```
[Dashboard UI] ──► GET /api/latest-report ──► GitHub Actions API ──► In-memory ZIP extract ──► Verified UI
```

### Configuration Steps:
1. Navigate to `dashboard/` and copy the environment template:
   ```bash
   cp .env.example .env.local
   ```
2. Open `dashboard/.env.local` and configure your GitHub credentials:
   ```env
   # GitHub Personal Access Token (classic or fine-grained)
   GITHUB_TOKEN=ghp_yourTokenHere

   # Target repository (defaults to YogamruthReddy/PipelineShield)
   GITHUB_REPOSITORY=YogamruthReddy/PipelineShield
   ```
   **Required Token Scopes:**
   - **Fine-grained PAT**: Repository Access: `Selected Repositories` -> Permissions: `Actions: Read-only`, `Metadata: Read-only`.
   - **Classic PAT**: `repo` (for private repos) or `public_repo` (for public repos).

3. Start or reload the dashboard:
   ```bash
   npm run dev
   ```
4. Click the **"Sync CI Run"** button in the dashboard navigation bar.
5. The dashboard extracts the `security_summary_report.json` artifact entirely in memory (with a 10MB archive cap and 5MB uncompressed file cap for Zip-Slip protection) and marks the run with an emerald **"Live CI Run #<id>"** badge with a direct link to the GitHub Actions workflow.

---

## 6. Running with GitHub Webhooks (Real-Time Push Sync)

PipelineShield includes a cryptographic webhook receiver (`POST /api/webhook/github`) that automatically updates dashboard state when a remote `workflow_run.completed` event fires.

### Local Development Setup (Using a Tunnel):
Because GitHub cannot send webhooks to `http://localhost:3000`, expose your local server using a secure tunnel:

1. In a terminal, start the dashboard:
   ```bash
   cd dashboard && npm run dev
   ```
2. In a second terminal, launch a tunnel:
   - Using **Cloudflare Tunnel**:
     ```bash
     cloudflared tunnel --url http://localhost:3000
     ```
   - OR using **ngrok**:
     ```bash
     ngrok http 3000
     ```
3. In your GitHub repository:
   - Go to **Settings** ➔ **Webhooks** ➔ **Add webhook**.
   - **Payload URL**: `https://<YOUR-TUNNEL-URL>/api/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Set a random secret string (e.g. `ps_local_secret_12345`).
   - **Which events would you like to trigger this webhook?**: Choose **"Let me select individual events"** ➔ Check **Workflow runs**.
4. Add the secret to `dashboard/.env.local`:
   ```env
   GITHUB_WEBHOOK_SECRET=ps_local_secret_12345
   ```
5. Test the webhook logic locally anytime with:
   ```bash
   npm run test:webhook --prefix dashboard
   ```

---

## 7. Running the Optional Local AI Advisory Copilot (Ollama)

PipelineShield includes an optional, privacy-preserving **Local AI Security Assistant** that generates natural-language remediation guidance directly on your local machine:

> **Strict Architectural Boundary**: The AI assistant is strictly advisory and read-only. It cannot override deterministic policy engine verdicts (`PASS`/`BLOCK`). All prompts are scrubbed of secrets and credentials before being processed.

### Step 1: Install & Start Ollama
Download and install Ollama from [ollama.ai](https://ollama.ai/). Then start the local server:
```bash
ollama serve
```

### Step 2: Pull the Recommended Lightweight Model
```bash
ollama pull qwen2.5:3b
```
*(Alternatively, `llama3.2:3b` or `mistral:7b` can be used)*

### Step 3: Configure Dashboard Environment
In `dashboard/.env.local`:
```env
LOCAL_AI_URL=http://127.0.0.1:11434
LOCAL_AI_MODEL=qwen2.5:3b
LOCAL_AI_TIMEOUT_MS=30000
```

### Step 4: Verify Local AI Integration
Run the automated safety and rate-limit test:
```bash
npm run test:ai --prefix dashboard
```
When running the dashboard, select any finding and click **"Generate AI Advisory"** to receive local, zero-cloud remediation guidance.

---

## 8. Running in CI/CD (GitHub Actions Pipeline)

PipelineShield is pre-configured to run automatically in GitHub Actions on every pull request and push to monitored branches (`main`, `feat/**`, `fix/**`).

### The CI Pipeline Workflow (`.github/workflows/security-gate.yml`)
1. **Job 1: `engine-test`**:
   - Sets up Python 3.11.
   - Installs `engine` with test dependencies.
   - Runs `pytest` with coverage (enforces 94% coverage threshold).
   - Uploads `reports/coverage.xml`.
2. **Job 2: `dashboard-build`**:
   - Sets up Node.js 22 and Python 3.11.
   - Executes shared contract verification (`npm run test:contract`).
   - Runs ESLint with zero allowed warnings (`npm run lint`).
   - Builds production Next.js assets (`npm run build`).
3. **Job 3: `security-gate`** *(Depends on Job 1 & Job 2 passing)*:
   - Downloads Trivy v0.76.1 verified against official SHA-256 checksum.
   - Installs Semgrep v1.183.0.
   - Checks if PR event: executes GitHub Dependency Review Action (`actions/dependency-review-action`).
   - Runs `pipelineshield.cli` against configured `policy.yaml`.
   - Emits Markdown step summary into the GitHub Actions run log.
   - Uploads `reports/` as `security-summary-reports` artifact (14-day retention).
   - If findings violate policy thresholds, exits with code `1`, blocking the pull request.

### Triggering CI Manually:
- Push any commit to a feature branch:
  ```bash
  git push origin feat/your-feature
  ```
- Or open a Pull Request targeting `main`.
- Or trigger manually in GitHub under **Actions** ➔ **CI Security Gate** ➔ **Run workflow**.

---

## 9. Running the Complete Verification & Test Suites (451 Tests)

PipelineShield features a comprehensive automated testing matrix totaling **451 tests** across Python and TypeScript.

### A. Python Engine Tests (261 Tests, 94% Coverage)
```powershell
# Windows
cd engine
.\.venv\Scripts\Activate.ps1
pytest --cov=pipelineshield --cov-report=term-missing
cd ..
```
```bash
# Linux / macOS
cd engine
source .venv/bin/activate
pytest --cov=pipelineshield --cov-report=term-missing
cd ..
```

### B. Dashboard & Integration Tests (190 Automated Checks)
From the project root or inside `dashboard/`:

| Command | What It Verifies |
| :--- | :--- |
| `npm run test:contract --prefix dashboard` | Shared TypeScript contract against all real CLI report permutations |
| `npm run test:nav --prefix dashboard` | UI route navigation and state transitions |
| `npm run test:ingestion --prefix dashboard` | Live GitHub API ingestion & in-memory zip decompression |
| `npm run test:ai --prefix dashboard` | Local AI fallback, timeout handling, and prompt secret sanitization |
| `npm run test:webhook --prefix dashboard` | GitHub HMAC-SHA256 signature verification & payload parsing |
| `npm run test:phase1 --prefix dashboard` | Reliability & contract boundary regression suite |
| `npm run test:phase2 --prefix dashboard` | Actionable findings presentation and filtering |
| `npm run test:actions --prefix dashboard` | Contextual remediation actions & security boundaries |
| `npm run test:github --prefix dashboard` | GitHub Workspace integration checks |
| `npm run test:review --prefix dashboard` | Code review workspace end-to-end assertions |
| `npm run lint --prefix dashboard` | Next.js ESLint static analysis (0 errors, 0 warnings) |
| `npm run build --prefix dashboard` | Production Next.js compilation |

---

## 10. Viewing the Presentation Deck (`/ppt`)

The project includes an interactive, 10-slide academic & technical presentation deck in `ppt/`:

- **Option A (Via Running Dashboard)**:
  With the dev server running (`npm run dev`), open:
  **[http://localhost:3000/ppt/index.html](http://localhost:3000/ppt/index.html)**
- **Option B (Direct Browser File)**:
  Double click `ppt/index.html` or open in any web browser.
- **Option C (Remote Showcase)**:
  The deck is synchronized to: [https://github.com/YogamruthReddy/presentation.git](https://github.com/YogamruthReddy/presentation.git)

---

## 11. Troubleshooting & Common Questions

### Q1: `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded...` on Windows
- **Cause**: PowerShell script execution policy blocks unsigned `.ps1` wrapper files.
- **Fix**: Use `npm.cmd` instead of `npm`, e.g. `npm.cmd run dev` or `npm.cmd install`.

### Q2: `EPERM: operation not permitted` during `npm run build`
- **Cause**: An active Next.js development server (`npm run dev`) holds file locks on `.next/server/`.
- **Fix**: Stop the running dev server (`Ctrl+C`), remove the build folder (`rm -r dashboard/.next`), and re-run `npm run build`.

### Q3: Dependency Review is skipped in local CLI or on direct pushes
- **Reason**: GitHub Dependency Review Action requires a Git diff between a base branch and a PR head (`github.event_name == 'pull_request'`). On non-PR runs (push, dispatch, local CLI), PipelineShield automatically falls back cleanly to Trivy and Semgrep without failing.

### Q4: "Live CI Run" shows "GITHUB_TOKEN is missing or unauthorized"
- **Fix**: Ensure `dashboard/.env.local` contains a valid PAT with `actions:read` permissions and that the repository name matches your fork/upstream (`GITHUB_REPOSITORY=owner/repo`). You can always use the manual **"Load Report"** button to load any JSON artifact from disk.

### Q5: Local AI says "Ollama service unavailable"
- **Fix**: Ensure Ollama is running locally via `ollama serve` and that the model has been downloaded (`ollama pull qwen2.5:3b`). If Ollama is not installed, the dashboard seamlessly displays a friendly notice while keeping 100% of standard features functional.

---

*PipelineShield — Deterministic DevSecOps Gatekeeper. For architecture details, see [docs/architecture.md](docs/architecture.md).*

