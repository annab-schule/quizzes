# Git Hooks

Damit die Hooks aktiv sind, einmalig ausführen:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-push
```

Danach läuft `tests/test-quizzes.js` automatisch vor jedem `git push`.
