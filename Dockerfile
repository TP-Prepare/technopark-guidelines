# Образ рендера схем: Chromium, шрифты и Node из образа Playwright той же версии, что
# playwright-core рендерера (bun.lock), плюс bun. Локально и в CI рендер идёт в нём,
# чтобы PNG совпадали байт в байт. Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §7.
FROM mcr.microsoft.com/playwright:v1.61.1-noble

# В образе есть npm, но нет unzip, поэтому bun ставится из npm.
# Путь к Chromium содержит номер сборки и зависит от архитектуры (chrome-linux64 на amd64,
# chrome-linux на arm64): прячем его за постоянным.
RUN npm install -g bun@1.3.13 \
 && ln -s "$(ls -d /ms-playwright/chromium-*/chrome-linux*/chrome | head -n 1)" /usr/local/bin/chromium \
 && test -x /usr/local/bin/chromium

ENV CHROMIUM_PATH=/usr/local/bin/chromium PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chromium DIAGRAMS_IN_CONTAINER=1
