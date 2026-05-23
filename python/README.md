---
title: Napoleon ML Trainer
emoji: 🃏
colorFrom: indigo
colorTo: red
sdk: docker
app_file: app.py
app_port: 7860
pinned: false
---

# Napoleon ML Trainer

Train and serve a card-prediction model for the [Napoleon 4-player game](https://github.com/ksleep98/napoleon-game-4players).

- **UI**: `/` (Gradio) — train and test predictions interactively
- **API**: `POST /api/predict-card` — used by the Next.js app
- **Health**: `GET /api/health`

## Required Secrets (Space → Settings → Variables and secrets)

| Name                | Value                                            |
| ------------------- | ------------------------------------------------ |
| `SUPABASE_URL`      | Supabase project URL                             |
| `SUPABASE_ANON_KEY` | Supabase anon key (or service role for training) |

## Local development

```bash
cd python
cp .env.example .env  # fill in SUPABASE_URL / SUPABASE_ANON_KEY
uv sync --group dev
uv run python -m model.train  # train once to produce models/card_predictor.skops
uv run python app.py          # serve on http://localhost:7860
```
