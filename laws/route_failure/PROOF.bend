import Base
import ./route_failure.bend as R
import ./LAWS.bend as Laws

# Two facts about request names the checker cannot see on its own:
# a name equals itself, and 1n+a never equals a. Nat.cmp is structural, so
# both fall to induction.
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

# Bool.and inspects its left side; when that side is stuck, this lemma lets
# the right False{} decide.
def and_false(b: Bool) -> {False{} == Bool.and(b, False{}) : Bool}:
  match b:
    case False{}:
      {==}
    case True{}:
      {==}

def Laws.settle_clears(s):
  match s:
    case R.St{r, ab, sp, sc}:
      {==}

def Laws.start_clears(s, x):
  match s:
    case R.St{r, ab, sp, sc}:
      match r:
        case R.Idle{}:
          {==}
        case R.Busy{a}:
          {==}

def Laws.aborted_error_is_silent(a, ab, sp, sc):
  %cmp_refl(a) : {R.screen(R.step(R.abort_if(Cmp.is_eq(_), a, a, ab, sp, sc), R.EvFail{a})) == R.Clear{} : R.Screen}
  %cmp_refl(a) : {R.screen(R.fail_if(Bool.and(Bool.not(Bool.or(Bool.or(Cmp.is_eq(_), R.member(a, ab)), R.member(a, sp))), True{}), R.Idle{}, a <> ab, sp, R.Clear{})) == R.Clear{} : R.Screen}
  {==}

def Laws.superseded_error_is_silent(a, ab, sp, sc):
  %cmp_succ(a) : {R.screen(R.fail_if(Bool.and(Bool.not(Bool.or(R.member(a, ab), Bool.or(Cmp.is_eq(Nat.cmp(a, a)), R.member(a, sp)))), Cmp.is_eq(_)), R.Busy{1n+a}, ab, a <> sp, R.Clear{})) == R.Clear{} : R.Screen}
  %and_false(Bool.not(Bool.or(R.member(a, ab), Bool.or(Cmp.is_eq(Nat.cmp(a, a)), R.member(a, sp))))) : {R.screen(R.fail_if(_, R.Busy{1n+a}, ab, a <> sp, R.Clear{})) == R.Clear{} : R.Screen}
  {==}

def Laws.live_error_shows(a, sc):
  %cmp_refl(a) : {R.screen(R.fail_if(Cmp.is_eq(_), R.Busy{a}, [], [], sc)) == R.Failure{} : R.Screen}
  {==}
