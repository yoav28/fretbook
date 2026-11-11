# Fretbook

Self-hosted tabs, chord sheets, and sheet music for bass and guitar. This branch keeps the app focused on finding a song and playing it.

- **Song library**: search and sort songs, narrow by instrument or favourites, and edit tags.
- **Import and edit**: bring in tabs from Songsterr, Ultimate Guitar, Guitar Pro, MusicXML, MIDI, ASCII tab, or ChordPro. Start a blank tab or chord sheet, or add multiple files at once.
- **Tab player**: play the score with the built-in synth or sync it to an audio file or YouTube recording. Tap bar positions or run Auto-sync to align the score.
- **Player views**: choose tab, note highway, or split view. Turn on the fretboard to follow the selected track's notes, tuning, and capo.
- **Loops**: set A/B points, save named sections, and jump back to them while playing.
- **Chord sheets**: transpose a song, review and strum chord diagrams, and print the sheet.

Standard notation and tab are rendered by [alphaTab](https://alphatab.net).
Fretbook grew out of [Mr-P4p3r/bass-tab-sync](https://github.com/Mr-P4p3r/bass-tab-sync) and still imports its `songs/` folders.

## Run it

### Docker

```sh
docker compose up --build
```

Open `http://localhost:8137`. The database and audio live in the `fretbook-data` volume. A `./songs` folder is mounted read-only for bass-tab-sync imports.

Prebuilt images for amd64 and arm64 are published to GHCR. Each release (`vX.Y.Z`, listed in [CHANGELOG.md](CHANGELOG.md) and on the [releases page](https://github.com/liftedkilt/fretbook/releases)) gets the tags `X.Y.Z` and `X.Y`; every push to `main` gets `latest`, `main` and `sha-<commit>`.

```sh
docker pull ghcr.io/liftedkilt/fretbook:latest   # newest main
docker pull ghcr.io/liftedkilt/fretbook:0.1.3    # a release; pin this one
```

**Upgrading.** Back up the `/data` volume, read the [changelog](CHANGELOG.md), then `docker compose pull && docker compose up -d`. Migrations run on start and are not reversible; see [Upgrading](https://liftedkilt.github.io/fretbook/self-hosting/upgrading/).

### Locally

Python 3.12, Node 22, and ffmpeg (only for downloading YouTube audio).

```sh
./run.sh            # creates .venv, builds the web app, starts on http://127.0.0.1:8137
```

For development, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

The full documentation is at **<https://liftedkilt.github.io/fretbook/>**, built from [`docs/`](docs/) on every release:

- [Docker Compose](https://liftedkilt.github.io/fretbook/self-hosting/docker-compose/), [reverse proxy and HTTPS](https://liftedkilt.github.io/fretbook/self-hosting/reverse-proxy/) (Caddy, Traefik, nginx, Zoraxy; HTTPS is needed for the microphone), [sign-in with OIDC](https://liftedkilt.github.io/fretbook/self-hosting/oidc/) (Pocket ID, Authelia, Authentik, Keycloak), [the job worker](https://liftedkilt.github.io/fretbook/self-hosting/worker/), [backups and restore](https://liftedkilt.github.io/fretbook/self-hosting/backups/), [upgrading](https://liftedkilt.github.io/fretbook/self-hosting/upgrading/).
- [Importing songs](https://liftedkilt.github.io/fretbook/guides/importing/), [playing and syncing](https://liftedkilt.github.io/fretbook/guides/playing/), and [installing it for offline use](https://liftedkilt.github.io/fretbook/guides/offline/).
- [Configuration reference](https://liftedkilt.github.io/fretbook/reference/configuration/): every `FRETBOOK_*` variable. It is generated from `fretbook/config.py` (see [`docs/reference/configuration.md`](docs/reference/configuration.md)).

Without sign-in, anyone who can reach the port can use the library, so keep a no-login server on a trusted network or behind an authenticating proxy. To report a vulnerability, see [SECURITY.md](SECURITY.md).

To build the docs locally: `pip install -r requirements-docs.txt && mkdocs serve`. `cd web && npm run docs:screenshots` regenerates the screenshots.

## More

- [ROADMAP.md](ROADMAP.md): what is planned, and what is already being built.
- [CONTRIBUTING.md](CONTRIBUTING.md): development setup, checks, working on an issue, dependency updates, and adding a locale.
- [AGENTS.md](AGENTS.md) ([CLAUDE.md](CLAUDE.md)): how coding agents pick up, claim, and finish issues, plus the [PR template](.github/pull_request_template.md) and [issue templates](.github/ISSUE_TEMPLATE/).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is built, the stored score format, and API conventions.

## License

MIT. See [LICENSE](LICENSE).
