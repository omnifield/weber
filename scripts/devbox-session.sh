#!/usr/bin/env sh
# devbox-session.sh — вход в роль-сессию weber в devbox-контейнере
# (канон containers-only; зеркало .devcontainer/devcontainer.json — правишь там, правь тут).
#
# usage: ./scripts/devbox-session.sh <scope> [cmd...]
#   scope: main (architect) | <zone> — хуки-интерпретаторы придут с харнессом из brainer
#   cmd:   команда в контейнере (дефолт — интерактивный claude)
#
# Запускается из WSL2-шелла (Ubuntu): на хосте только docker.
set -eu

SCOPE="${1:?usage: devbox-session.sh <scope> [cmd...]}"
shift
NAME=weber-devbox
IMAGE=ghcr.io/omnifield/devbox:v2026.07.10
# Рабочая копия — от пути самого скрипта (не прибивать: место клона свободно).
WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"

if ! docker inspect "$NAME" >/dev/null 2>&1; then
  docker run -d --name "$NAME" \
    -v "$WORKSPACE:/workspaces/weber" -w /workspaces/weber \
    -v omnifield-secrets:/home/vscode/.secrets \
    -v omnifield-pnpm-store:/home/vscode/.local/share/pnpm/store \
    -e CLAUDE_CONFIG_DIR=/home/vscode/.secrets/claude \
    -e NPM_CONFIG_USERCONFIG=/home/vscode/.secrets/npmrc \
    -e GIT_CONFIG_GLOBAL=/home/vscode/.secrets/gitconfig \
    -e GH_CONFIG_DIR=/home/vscode/.secrets/gh \
    --add-host=host.docker.internal:host-gateway \
    "$IMAGE" sleep infinity
  # Fail-fast PAT-проба (класс Д3): без неё pnpm install на свежем volume висит без намёка.
  docker exec "$NAME" bash -c \
    'sudo chown -R vscode:vscode /home/vscode/.local/share/pnpm/store /home/vscode/.secrets && (timeout 20 npm whoami --registry=https://npm.pkg.github.com >/dev/null 2>&1 || { echo "x нет валидного PAT в $NPM_CONFIG_USERCONFIG (volume omnifield-secrets) — занос кредов: devopser devbox/README §Пост-шаги"; exit 1; }) && pnpm install'
elif [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != "true" ]; then
  docker start "$NAME" >/dev/null
fi

if [ "$#" -eq 0 ]; then
  set -- claude
fi
# -t только на живом терминале: скрипт зовут и не-интерактивно (оркестратор/CI).
TTY_FLAGS='-i'
[ -t 0 ] && TTY_FLAGS='-it'
exec docker exec $TTY_FLAGS -e "OMNIFIELD_SCOPE=$SCOPE" "$NAME" "$@"