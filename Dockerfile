# syntax = docker/dockerfile:1.1.7-experimental

FROM registry-1.docker.io/library/node:14.5.0-stretch-slim AS declare-node-stage

FROM declare-node-stage AS create-working-directory
ENV WORKDIR='/opt/app'
WORKDIR ${WORKDIR}

FROM create-working-directory AS enable-package-caching
ENV DEBIAN_FRONTEND='noninteractive'
RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

FROM enable-package-caching AS prepare-node-environment
ENV NODE_OPTIONS='--max_old_space_size=6144'

FROM prepare-node-environment AS install-system-dependencies
ENV BASIC_DEPS='ca-certificates apt-transport-https curl' \
    BUILD_DEPS='build-essential g++ python make git gnupg' \
    CWEBP_DEPS='libglu1 libxi6 libjpeg62 libpng16-16'
ENV DEPS="${BASIC_DEPS} ${BUILD_DEPS} ${CWEBP_DEPS}"

RUN --mount=type=cache,target=/var/cache/apt,id=apt-cache_cache,sharing=locked \
    --mount=type=cache,target=/var/cache/debconf,id=debconf-cache_cache,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,id=apt-lib_cache,sharing=locked \
    apt -y update && apt -y install --no-install-recommends ${DEPS}

FROM install-system-dependencies AS install-latest-npm
RUN --mount=type=cache,target=/root/.npm,id=npm_cache,sharing=locked \
    --mount=type=cache,target=/tmp,id=npm_releases,sharing=locked \
    npm --prefer-offline install npm --global --silent

FROM install-latest-npm AS list-npm-settings
ARG INVALIDATE_CACHE
RUN npm config list --json > npm.json

FROM install-latest-npm AS prepare-export-environment
ARG CLIENT_ID
ARG CLIENT_EMAIL
ARG PRIVATE_KEY
ARG PROJECT_ID
ARG DATASET_NAME
ENV NODE_ENV='production'

FROM prepare-export-environment AS install-project-dependencies
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm,id=npm_cache,sharing=locked \
    --mount=type=cache,target=/tmp,id=npm_releases,sharing=locked \
    npm --prefer-offline ci --silent

FROM install-project-dependencies as export-wanted-passports
ENV TABLE='wanted_passports'
ENV SOURCE_ID='ab09ed00-4f51-4f6c-a2f7-1b2fb118be0f'
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=bind,source=/opt/app/node_modules,target=node_modules,from=install-project-dependencies \
    --mount=type=bind,source=scripts,target=scripts \
    --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=config.js,target=config.js \
    --mount=type=bind,source=schema.js,target=schema.js \
    npm run export

FROM install-project-dependencies as export-invalid-passports
ENV TABLE='invalid_passports'
ENV SOURCE_ID='44e1d462-5de4-40e5-b722-46f2aa9a1e81'
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=bind,source=/opt/app/node_modules,target=node_modules,from=install-project-dependencies \
    --mount=type=bind,source=scripts,target=scripts \
    --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=config.js,target=config.js \
    --mount=type=bind,source=schema.js,target=schema.js \
    npm run export

FROM install-project-dependencies as export-wanted-intern-passports
ENV TABLE='wanted_intern_passports'
ENV SOURCE_ID='b465b821-db5d-4b8b-8131-12682fab2203'
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=bind,source=/opt/app/node_modules,target=node_modules,from=install-project-dependencies \
    --mount=type=bind,source=scripts,target=scripts \
    --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=config.js,target=config.js \
    --mount=type=bind,source=schema.js,target=schema.js \
    npm run export

FROM install-project-dependencies as export-invalid-intern-passports
ENV TABLE='invalid_intern_passports'
ENV SOURCE_ID='672e0841-e1a2-47ec-b8d4-22839c71f4b3'
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=bind,source=/opt/app/node_modules,target=node_modules,from=install-project-dependencies \
    --mount=type=bind,source=scripts,target=scripts \
    --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=config.js,target=config.js \
    --mount=type=bind,source=schema.js,target=schema.js \
    npm run export

FROM scratch AS copy-reports
COPY --from=export-wanted-passports /tmp /tmp
COPY --from=export-invalid-passports /tmp /tmp
COPY --from=export-wanted-intern-passports /tmp /tmp
COPY --from=export-invalid-intern-passports /tmp /tmp