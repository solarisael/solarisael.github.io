# Laws for the build guard. Open claims; the proofs live in PROOF.bend.
# The guard exists for one reason: the head and the shell a reader sees must
# come from the same build. A tab left open across a deploy must reload, not
# morph a new shell under an old head.

import Base
import ./build_guard.bend as G

# The shell comes from the build the head came from: swap as usual.
law same_build_swaps:
  for +b: Nat
  {G.decide(b, G.Tagged{b}) == G.Swap{} : G.Verdict}

# A deploy landed while the tab was open: the new shell forces a reload.
law newer_build_reloads:
  for +b: Nat
  {G.decide(b, G.Tagged{1n+b}) == G.Reload{} : G.Verdict}

# The response is older than the head (a stale cache): reload as well.
law older_build_reloads:
  for +b: Nat
  {G.decide(1n+b, G.Tagged{b}) == G.Reload{} : G.Verdict}

# A shell with no build id is not refused: the guard only acts on evidence.
law untagged_swaps:
  for b: Nat
  {G.decide(b, G.Untagged{}) == G.Swap{} : G.Verdict}

# Same build: the reader sees the head's build in the shell.
law head_and_shell_agree_same:
  for +b: Nat
  {G.shown(b, G.Tagged{b}) == b : Nat}

# Newer build: the reload keeps the reader on one build, never a mix.
law head_and_shell_agree_newer:
  for +b: Nat
  {G.shown(b, G.Tagged{1n+b}) == b : Nat}
