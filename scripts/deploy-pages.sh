#!/usr/bin/env bash
# Builds the web preview and publishes it to the gh-pages branch,
# which GitHub Pages serves at https://tgoff3492.github.io/glass-studio/
set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf dist
npx expo export --platform web

# GitHub Pages serves 404.html for unknown paths; reusing the app page lets
# links like /glass-studio/kiln open the right tab.
cp dist/index.html dist/404.html
# Stop GitHub's Jekyll step from hiding the _expo folder.
touch dist/.nojekyll

remote="$(git remote get-url origin)"
sha="$(git rev-parse --short HEAD)"

cd dist
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name || echo deploy)" \
    -c user.email="$(git -C .. config user.email || echo deploy@localhost)" \
    commit -q -m "Deploy web preview from ${sha}"
git push -q -f "$remote" gh-pages
echo "Published. It can take a minute or two to appear at https://tgoff3492.github.io/glass-studio/"
