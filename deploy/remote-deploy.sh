#!/usr/bin/env bash
set -Eeuo pipefail

deploy_path=${1:?Deployment path is required}
expected_sha=${2:?Expected commit SHA is required}

cd "$deploy_path"

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Deployment checkout has local changes; refusing to overwrite them." >&2
  exit 1
fi

git fetch --prune origin main
git checkout main
git merge --ff-only origin/main

actual_sha=$(git rev-parse HEAD)
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "Expected $expected_sha but checked out $actual_sha." >&2
  exit 1
fi

APP_VERSION="$actual_sha" docker compose up -d --build --remove-orphans

for attempt in {1..20}; do
  health=$(curl --fail --silent --show-error http://127.0.0.1:8080/healthz || true)
  if [[ "$health" == *"$actual_sha"* ]]; then
    docker compose ps
    echo "Deployed $actual_sha"
    exit 0
  fi
  sleep 2
done

docker compose logs --tail=100 starfall >&2
echo "Deployment health check failed for $actual_sha." >&2
exit 1
