#!/usr/bin/env bash
# Revisa las migraciones agregadas entre el último despliegue y el commit a desplegar
# (despliegue-continuo, D5). Falla si alguna borra datos y ningún mensaje de commit del rango
# lleva [migracion-destructiva], o si no puede determinar el rango: falla cerrada.
#   infra/scripts/revisar-migraciones.sh <base> <commit>
set -euo pipefail

BASE="${1:?Falta la base (último commit desplegado)}"
SHA="${2:?Falta el commit a desplegar}"

git merge-base --is-ancestor "$BASE" "$SHA" \
  || { echo "La base $BASE no es ancestro de $SHA"; exit 1; }

# Solo líneas agregadas en migraciones nuevas: no coincide con «ON DELETE» ni con «-- DropTable».
nuevas=$(git diff --diff-filter=A --unified=0 "$BASE" "$SHA" -- 'apps/api/prisma/migrations/*/migration.sql')
if grep -iqE '^\+.*\b(DROP (TABLE|COLUMN)|TRUNCATE|DELETE FROM)\b' <<<"$nuevas"; then
  mensajes=$(git log --format=%B "$BASE..$SHA")
  if ! grep -qF '[migracion-destructiva]' <<<"$mensajes"; then
    echo "Hay una migración nueva que borra datos y ningún commit de $BASE..$SHA lleva [migracion-destructiva]:"
    git diff --diff-filter=A --name-only "$BASE" "$SHA" -- 'apps/api/prisma/migrations/*/migration.sql'
    exit 1
  fi
  echo "Migración destructiva aceptada con [migracion-destructiva]."
else
  echo "Sin migraciones destructivas nuevas entre $BASE y $SHA."
fi
