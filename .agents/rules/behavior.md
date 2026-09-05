# Strict Instruction Following

Always follow my instructions strictly without anticipating extra steps.
For example, if I only ask to commit code, do not automatically push the code. Wait for my explicit instruction before proceeding to the next step.

## Testing Rules
- **NEVER run browser tests or launch browser subagents unless explicitly instructed by the user.** (Do NOT test in the browser until told to do so).
- **Backend API verification (PowerShell scripts, curl, dotnet test) IS allowed and encouraged when needed** to verify endpoints, calculations, and data integrity.

## Design & Architecture Rules
- **Strictly follow `HRMS-DESIGN.md`:** Use the Register ledger design system tokens, `Fraunces` / `IBM Plex` typography, and paper/ruled surfaces.
- **NEVER use cheap/pastel colors:** No tacky bright pink/salmon pills for buttons. Keep buttons and status indicators refined, minimal, and administrative (ghost/outline with subtle hover states).
- **Daily attendance activity details must open as a centered modal dialog**, never as a right-side sliding drawer.
- **Do NOT create redundant `IService` interfaces for single-implementation internal services.** Keep internal services as direct concrete classes.
- **Platform Owner panel must remain at `/ops_console`** with 404 stealth cloaking and network/key protection.
