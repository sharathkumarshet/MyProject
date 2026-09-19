# Landscape Simulator

A deterministic, frontend-only landscape design and scoring MVP built with React, TypeScript, Vite, Tailwind CSS, and Three.js.

## Setting up on a new machine

Steps to go from a fresh checkout (any OS) to a running dev server.

### 1. Install Git and Node.js 20

- **Git**: install from [git-scm.com](https://git-scm.com/downloads) (Windows) or via your package
  manager / Xcode Command Line Tools (macOS/Linux).
- **Node.js 20**: install one way per platform:
  - **Windows**: install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases), then
    in a new PowerShell/CMD window:
    ```powershell
    nvm install 20
    nvm use 20
    ```
    (Alternatively, just install Node 20 directly from [nodejs.org](https://nodejs.org/) — no nvm
    required on Windows.)
  - **macOS/Linux**: install [nvm](https://github.com/nvm-sh/nvm) via its install script, then:
    ```bash
    nvm install 20
    nvm use 20
    nvm alias default 20
    ```
    Make sure your shell's startup file (`~/.zshrc`, `~/.bashrc`, etc.) sources nvm — the installer
    normally adds this automatically:
    ```bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    ```
    If a **new** terminal ever reports `npm: command not found`, that snippet is missing from your
    shell startup file — add it once and reopen the terminal.
- Verify with `node -v` (should print v20.x) and `npm -v` in a **new** terminal window.

### 2. Get the code

```bash
git clone <this-repo-url>
cd landscape-simulator
```

(If you're copying an existing folder instead of cloning, just `cd` into it.)

### 3. Install dependencies and run

```bash
npm install
npm run dev
```

Then visit http://localhost:5173 — on Windows this works the same in PowerShell, CMD, or
Git Bash.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```
