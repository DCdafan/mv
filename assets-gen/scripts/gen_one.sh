#!/bin/bash
# usage: gen_one.sh "name<TAB>aspect<TAB>prompt"
line="$1"
name=$(echo "$line" | cut -f1); aspect=$(echo "$line" | cut -f2); prompt=$(echo "$line" | cut -f3)
# 输出到脚本所在目录的 ../photos
out="$(cd "$(dirname "$0")/.." && pwd)/photos/$name.png"
mkdir -p "$(dirname "$out")"
[ -s "$out" ] && exit 0
for try in 1 2; do
  # 去掉可能失效的 CODEX_API_KEY 环境变量，使用 codex 自己的登录
  env -u CODEX_API_KEY codex exec -C "$(dirname "$out")" -s workspace-write -c model_reasoning_effort="low" --skip-git-repo-check \
    "Use your image generation tool to create ONE image: $prompt. Aspect: $aspect. No text, no watermark. Then copy the generated PNG to exactly this path: $out . Do nothing else." >/dev/null 2>&1
  [ -s "$out" ] && { echo "OK $name"; exit 0; }
done
echo "FAIL $name"
