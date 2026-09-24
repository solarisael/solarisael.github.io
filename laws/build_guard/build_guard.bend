# A model of src/scripts/build_guard.js: the check that keeps <head> and the
# route shell from two different builds. htmx swaps only #sol_page_shell, so
# an open tab keeps its old head. When the incoming shell names another build,
# the guard refuses the swap and reloads the whole page instead.
# Build ids are named by Nat here; in the browser they are strings.

import Base

# The shell that arrives in the response: tagged with its build id, or not.
type Incoming is Data:
  Tagged{id: Nat}
  Untagged{}

type Verdict is Data:
  Swap{}
  Reload{}

# Same build: swap. Another build: reload. No tag: swap, as before the guard.
def decide_if(same: Bool) -> Verdict:
  match same:
    case True{}:
      Swap{}
    case False{}:
      Reload{}

def decide(+head: Nat, incoming: Incoming) -> Verdict:
  match incoming:
    case Tagged{id}:
      decide_if(Nat.is_eq(head, id))
    case Untagged{}:
      Swap{}

# The build whose shell the reader sees under the kept head.
def shown_by(v: Verdict, +head: Nat, +id: Nat) -> Nat:
  match v:
    case Swap{}:
      id
    case Reload{}:
      head

def shown(+head: Nat, inc: Incoming) -> Nat:
  match inc:
    case Tagged{+id}:
      shown_by(decide(head, Tagged{id}), head, id)
    case Untagged{}:
      head
