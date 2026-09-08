#!/usr/bin/env bash
# PostToolUse (Write|Edit) guard: no em dashes (U+2014) or en dashes (U+2013)
# in user-facing copy. Comments are exempt (this repo uses them heavily in
# comments by design). Blocks with exit 2 so the model recasts the sentence.
set -euo pipefail

f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$f" ] || exit 0
[ -f "$f" ] || exit 0

case "$f" in
  *packages/*/src/*.ts|*packages/*/src/*.tsx) ;;
  *) exit 0 ;;
esac
case "$f" in
  *.test.ts|*.test.tsx|*.d.ts) exit 0 ;;
esac

hits=$(perl -CSDA -ne '
  my $l = $_;
  next if $l =~ m{^\s*(//|\*|\*/|/\*)};   # whole-line or JSDoc-continuation comment
  $l =~ s{//.*$}{};                        # strip trailing line comment
  $l =~ s{/\*.*?\*/}{}g;                   # strip inline block comment
  print "  line $.: ", $_ if $l =~ /[\x{2014}\x{2013}]/;
' "$f") || true

[ -z "$hits" ] || {
  {
    echo "Em/en dash in user-facing copy is not allowed: $f"
    echo "$hits"
    echo "Recast each line without the dash (a period, comma, colon, semicolon, or parentheses), and check the grammar. This is a hard rule."
  } >&2
  exit 2
}
exit 0
