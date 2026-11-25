# Security policy

## Reporting a vulnerability

Please do not report security problems in public issues.

Report them privately on GitHub instead: open the **Security** tab of this repository and choose
**Report a vulnerability**. Only the maintainers can see the report. We will reply there, work on the
fix with you and credit you in the published advisory unless you prefer otherwise.

Please include the affected product (web, VS Code extension or desktop app), its version, the steps
to reproduce and what an attacker could achieve.

## What counts as a vulnerability

Dev Toolora promises that nothing you paste, select or open leaves your device. Anything that
breaks that promise is in scope, for example:

- a tool sending input, files or results over the network;
- script injection in the web app, the VS Code webview or the desktop app;
- a crafted file that runs code or reads other files when a tool opens it;
- a way around the content security policy.

## Supported versions

Security fixes go into the latest release only.
