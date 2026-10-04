# GitHub Kameleon

A pixel chameleon creeps along a branch under your contribution graph. It eats each week with its tongue and turns the colour of the brightest day it just ate. Once it reaches the end, your year grows back and it starts again.

![Kameleon](https://raw.githubusercontent.com/Kameleon21/gh-kameleon/main/kameleon.svg)

The output is a single animated SVG, about 70 KB. It uses only CSS animation, so it plays inside a GitHub README.

## Add to Your Profile

1. Create `.github/workflows/kameleon.yml` in your profile repository (`USERNAME/USERNAME`):

```yaml
name: Generate Kameleon

on:
  schedule:
    - cron: "0 0 * * *" # Daily at midnight
  workflow_dispatch: # Manual trigger

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: Kameleon21/gh-kameleon@main

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: Update kameleon animation
          file_pattern: kameleon.svg
```

2. Add to your `README.md`:

```markdown
![Kameleon](https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_USERNAME/main/kameleon.svg)
```

3. Manually trigger the workflow once, or wait for the daily run.

## Options

| Input          | Description                                                 | Default                   |
| -------------- | ----------------------------------------------------------- | ------------------------- |
| `username`     | GitHub username                                             | Repository owner          |
| `output`       | Output file path                                            | `kameleon.svg`            |
| `step`         | Seconds spent on each week (lower is faster)                | `0.3`                     |
| `tagline`      | Text shown next to your username                            | `you are what you commit` |
| `github_token` | Token used to read the contribution calendar                | `github.token`            |

## Run Locally

Requires [Bun](https://bun.sh). It uses `GITHUB_TOKEN` if set, otherwise your `gh` CLI login.

```bash
bun src/cli.ts --username YOUR_USERNAME --output kameleon.svg
```

## Inspired By

- [gh-space-shooter](https://github.com/czl9707/gh-space-shooter)
- [gh-snake-contributions](https://github.com/Kameleon21/gh-snake-contributions)
