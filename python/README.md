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

## Required config (Space → Settings → Variables and secrets)

| Name                     | Kind              | Value                                                         |
| ------------------------ | ----------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`           | Variable (public) | Supabase project URL                                          |
| `NEXT_PUBLIC_ML_API_URL` | Variable (public) | This Space's own URL                                          |
| `SUPABASE_ANON_KEY`      | Secret            | Supabase **publishable** key (`sb_publishable_…`) — see below |

### Use the publishable key, never a secret/service-role key

`fetch_data.py` issues a single `SELECT` against `ml_training_data` and writes
nothing, so read-only access is all this Space ever needs. Give it the
**publishable** key from Supabase → Settings → API → "Publishable and secret
API keys" → `Publishable key`.

Do **not** paste `sb_secret_…`, nor the legacy `service_role` JWT. Those bypass
RLS on every table. A Space is third-party hosting: in July 2026 Hugging Face
disclosed a breach that reached internal datasets and service credentials, and
whether Space secrets were exposed was never confirmed either way. Assume
anything stored here can leak, and keep the blast radius to "read one table".

The variable is still named `SUPABASE_ANON_KEY` because `fetch_data.py:26` reads
that name. Don't rename it without changing the code.

Prefer the new-style keys over the legacy `anon`/`service_role` JWTs for one
concrete reason: publishable and secret keys rotate independently, while the
legacy pair is derived from the project's JWT secret — rotating that invalidates
both keys _and_ every issued user JWT at once. When a third party holds the key,
you want to be able to swap just that one.

### This depends on RLS allowing anon reads

Training works today because RLS permits anon `SELECT` on `ml_training_data`
(verified 2026-07-30: 27,664 rows fetched with a publishable key). That table is
therefore effectively public. It holds hands, played cards, roles and generated
player ids — no personal data — so this is an accepted trade-off, not an
oversight.

If you ever tighten RLS to block anon on that table, **this Space stops being
able to train** and the only fix is handing it a stronger key, which is the
thing this section exists to prevent. Weigh that before changing the policy.

## The Space is a separate git repository

This directory is the source of truth, but the Space has its own git history and
**nothing syncs automatically**. Pushing to GitHub does not update the Space.

As of 2026-07-30 the deployed Space was several dependency bumps behind: it built
`supabase==2.30.0` / `fastapi==0.136.3` from its own copy of `requirements.txt`
while this repo was already on `2.31.0` / `0.139.2`. Dependabot updates the files
here; it cannot reach the Space. **Security patches do not arrive on their own.**

To deploy, push this directory to the Space's git remote (or edit through the HF
web UI). After any dependency change here, remember the Space needs a separate
push, or it will keep running the old versions indefinitely.

Automating this via GitHub Actions would mean storing an HF write token as a
repository secret. That was deliberately not done — see the breach note above.

## Local development

```bash
cd python
cp .env.example .env  # fill in SUPABASE_URL / SUPABASE_ANON_KEY
uv sync --group dev
uv run python -m model.train  # train once to produce models/card_predictor.skops
uv run python app.py          # serve on http://localhost:7860
```

`scripts/run-sim.js` in the repo root pulls the same credentials from Vercel's
**development** environment, so the training data this Space reads is whatever
`pnpm sim` has accumulated there. Production has no Supabase configuration at
all, so no gameplay from the live site reaches this dataset.

## Model accuracy is not data-limited

At 27,664 rows: accuracy 27.94%, top-3 52.46%. At ~526 games it was 26% / 52%.
Fifty times the data moved it barely at all, exactly as the note in
`src/lib/ai/aiStrategy.ts` predicted — a 52-class Random Forest splits its 200
trees' votes across too many candidates. Collecting more games is not the lever;
changing the model or reframing the task is.
