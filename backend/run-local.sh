#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env.local ]]; then
  echo '请依据 .env.example 创建 .env.local；不要放线上凭据。' >&2
  exit 1
fi
set -a
source .env.local
set +a
if [[ "${DATABASE_URL:-}" != jdbc:postgresql://127.0.0.1:*/* || "${DATABASE_USER:-}" != xq_app || "${SPRING_PROFILES_ACTIVE:-}" != local || "${SERVER_ADDRESS:-}" != 127.0.0.1 ]]; then
  echo '此启动器只允许本机数据库、非管理员运行账号及 local 配置。' >&2
  exit 1
fi
if [[ ! -f target/platform-1.0.0.jar ]]; then
  echo '请先使用 Java 21 执行 mvn package。' >&2
  exit 1
fi
exec java -jar target/platform-1.0.0.jar
