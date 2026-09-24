import Base
import ./build_guard.bend as G
import ./LAWS.bend as Laws

# Three facts about build ids the checker cannot see on its own: an id equals
# itself, 1n+a is greater than a, and a is less than 1n+a. Nat.cmp is
# structural, so all three fall to induction.
def cmp_refl(a: Nat) -> {EQ{} == Nat.cmp(a, a) : Cmp}:
  match a:
    case 0n:
      {==}
    case 1n+p:
      cmp_refl(p)

def cmp_succ(a: Nat) -> {GT{} == Nat.cmp(1n+a, a) : Cmp}:
  match a:
    case 0n:
      {==}
    case 1n+p:
      cmp_succ(p)

def cmp_pred(a: Nat) -> {LT{} == Nat.cmp(a, 1n+a) : Cmp}:
  match a:
    case 0n:
      {==}
    case 1n+p:
      cmp_pred(p)

def Laws.same_build_swaps(b):
  %cmp_refl(b) : {G.decide_if(Cmp.is_eq(_)) == G.Swap{} : G.Verdict}
  {==}

def Laws.newer_build_reloads(b):
  %cmp_pred(b) : {G.decide_if(Cmp.is_eq(_)) == G.Reload{} : G.Verdict}
  {==}

def Laws.older_build_reloads(b):
  %cmp_succ(b) : {G.decide_if(Cmp.is_eq(_)) == G.Reload{} : G.Verdict}
  {==}

def Laws.untagged_swaps(b):
  {==}

def Laws.head_and_shell_agree_same(b):
  %cmp_refl(b) : {G.shown_by(G.decide_if(Cmp.is_eq(_)), b, b) == b : Nat}
  {==}

def Laws.head_and_shell_agree_newer(b):
  %cmp_pred(b) : {G.shown_by(G.decide_if(Cmp.is_eq(_)), b, 1n+b) == b : Nat}
  {==}
