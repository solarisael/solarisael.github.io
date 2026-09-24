# A model of src/scripts/route_failure.js: the banner that tells the reader a
# page swap failed. The JS tracks one active request, remembers requests it
# aborted or superseded, and must never raise the banner for a stale request.
# Requests are named by Nat here; in the browser they are XHR objects.

import Base

type Route is Data:
  Idle{}
  Busy{xhr: Nat}

type Screen is Data:
  Clear{}
  Failure{}

type St is Data:
  St{route: Route, aborted: List<&2, Nat>, superseded: List<&2, Nat>, screen: Screen}

type Ev is Data:
  EvStart{xhr: Nat}
  EvAbort{xhr: Nat}
  EvDone{xhr: Nat}
  EvFail{xhr: Nat}
  EvSettle{}
  EvRestoreFail{}
  EvRestore{}

def member(+x: Nat, xs: List<&2, Nat>) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{h, t}:
      Bool.or(Nat.is_eq(x, h), member(x, t))

def screen(s: St) -> Screen:
  match s:
    case St{_, _, _, sc}:
      sc

def route(s: St) -> Route:
  match s:
    case St{r, _, _, _}:
      r

# htmx:beforeRequest on a route swap: a still-active request is superseded.
def start(r: Route, ab: List<&2, Nat>, sp: List<&2, Nat>, x: Nat) -> St:
  match r:
    case Idle{}:
      St{Busy{x}, ab, sp, Clear{}}
    case Busy{a}:
      St{Busy{x}, ab, a <> sp, Clear{}}

# htmx:abort / sendAbort for the active request only.
def abort_if(hit: Bool, +a: Nat, +x: Nat, ab: List<&2, Nat>, sp: List<&2, Nat>, sc: Screen) -> St:
  match hit:
    case True{}:
      St{Idle{}, x <> ab, sp, Clear{}}
    case False{}:
      St{Busy{a}, ab, sp, sc}

def abort(r: Route, ab: List<&2, Nat>, sp: List<&2, Nat>, sc: Screen, +x: Nat) -> St:
  match r:
    case Idle{}:
      St{Idle{}, ab, sp, sc}
    case Busy{+a}:
      abort_if(Nat.is_eq(a, x), a, x, ab, sp, sc)

# htmx:afterRequest with detail.successful for the active request.
def done_if(hit: Bool, +a: Nat, ab: List<&2, Nat>, sp: List<&2, Nat>, sc: Screen) -> St:
  match hit:
    case True{}:
      St{Idle{}, ab, sp, Clear{}}
    case False{}:
      St{Busy{a}, ab, sp, sc}

def done(r: Route, ab: List<&2, Nat>, sp: List<&2, Nat>, sc: Screen, x: Nat) -> St:
  match r:
    case Idle{}:
      St{Idle{}, ab, sp, sc}
    case Busy{+a}:
      done_if(Nat.is_eq(a, x), a, ab, sp, sc)

# htmx:responseError / sendError / timeout. Shown only for a live request:
# not aborted, not superseded, and either nothing is active or it is the
# active one. Mirrors is_ignored_route_error in the JS, negated.
def live_for(r: Route, +x: Nat) -> Route & Bool:
  match r:
    case Idle{}:
      (Idle{}, True{})
    case Busy{+a}:
      (Busy{a}, Nat.is_eq(a, x))

def fail_if(show: Bool, r: Route, ab: List<&2, Nat>, sp: List<&2, Nat>, sc: Screen) -> St:
  match show:
    case True{}:
      St{r, ab, sp, Failure{}}
    case False{}:
      St{r, ab, sp, sc}

def fail_with(rl: Route & Bool, +ab: List<&2, Nat>, +sp: List<&2, Nat>, sc: Screen, +x: Nat) -> St:
  match rl:
    case (r2, live):
      stale = Bool.or(member(x, ab), member(x, sp))
      fail_if(Bool.and(Bool.not(stale), live), r2, ab, sp, sc)

def fail(r: Route, +ab: List<&2, Nat>, +sp: List<&2, Nat>, sc: Screen, +x: Nat) -> St:
  fail_with(live_for(r, x), ab, sp, sc, x)

def step(s: St, e: Ev) -> St:
  match s e:
    case St{r, ab, sp, sc} EvStart{x}:
      start(r, ab, sp, x)
    case St{r, ab, sp, sc} EvAbort{x}:
      abort(r, ab, sp, sc, x)
    case St{r, ab, sp, sc} EvDone{x}:
      done(r, ab, sp, sc, x)
    case St{r, ab, sp, sc} EvFail{x}:
      fail(r, ab, sp, sc, x)
    case St{r, ab, sp, sc} EvSettle{}:
      St{Idle{}, ab, sp, Clear{}}
    case St{r, ab, sp, sc} EvRestoreFail{}:
      St{Idle{}, ab, sp, Failure{}}
    case St{r, ab, sp, sc} EvRestore{}:
      St{Idle{}, ab, sp, Clear{}}
