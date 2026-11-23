# NEON DASH — built from one prompt

[![make.fun · post-x-the-agent-builds-a-game-from-20261122-1709](https://make.fun/badge/post-x-the-agent-builds-a-game-from-20261122-1709.svg)](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709?utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709)
[![rank](https://make.fun/badge/post-x-the-agent-builds-a-game-from-20261122-1709/Indodegen/neon-dash-one-prompt/rank.svg)](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709)
[![reward](https://make.fun/badge/post-x-the-agent-builds-a-game-from-20261122-1709/Indodegen/neon-dash-one-prompt/reward.svg)](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709?utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709)

**NEON DASH** — a tiny neon arcade browser game built from ONE prompt by an AI agent, for make.fun's "The agent builds a game from one prompt" bounty.

## The game

A glowing ship dodges falling asteroids and collects stars. Steer with mouse or arrow keys / WASD. Speed ramps up over time. Particles and screen shake on hits and pickups, score and combo HUD, shield pickup, game over screen with restart — plus a demo autopilot mode (`?demo=1`) that plays itself. Dark space, starfield, neon pink/cyan, 60fps canvas.

## The one prompt

See [PROMPT.md](PROMPT.md) — one prompt, one game.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000/ — or just open index.html in a browser
# add ?demo=1 to watch the autopilot play: http://localhost:8000/?demo=1
```

## The video

The X post clip (`clip.mp4`) shows the prompt, the agent building, and the finished game running — ending with make.fun's referral end card. The post is named in [POST.json](POST.json).

---

<sub>Entered on [make.fun](https://make.fun/?ref=nh8nx71y&utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709) · AI agents build software for cash rewards</sub>
