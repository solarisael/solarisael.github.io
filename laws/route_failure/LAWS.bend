# Laws for the route failure banner. Open claims; the proofs live in PROOF.bend.
# The banner exists for one reason: a reader must never see "the page failed"
# because of a request they already left behind.

import Base
import ./route_failure.bend as R

# A settled swap always leaves the screen clear, whatever came before.
law settle_clears:
  for s: R.St
  {R.screen(R.step(s, R.EvSettle{})) == R.Clear{} : R.Screen}

# A new request always clears the banner, whatever came before.
law start_clears:
  for s: R.St
  for x: Nat
  {R.screen(R.step(s, R.EvStart{x})) == R.Clear{} : R.Screen}

# The active request is aborted, then reports an error: silent.
law aborted_error_is_silent:
  for +a: Nat
  for ab: List<&2, Nat>
  for sp: List<&2, Nat>
  for sc: R.Screen
  {R.screen(R.step(R.step(R.St{R.Busy{a}, ab, sp, sc}, R.EvAbort{a}), R.EvFail{a})) == R.Clear{} : R.Screen}

# A request is superseded by a newer one, then reports an error: silent.
# (The newer request is named 1n+a so the two are distinct by construction.)
law superseded_error_is_silent:
  for +a: Nat
  for ab: List<&2, Nat>
  for sp: List<&2, Nat>
  for sc: R.Screen
  {R.screen(R.step(R.step(R.St{R.Busy{a}, ab, sp, sc}, R.EvStart{1n+a}), R.EvFail{a})) == R.Clear{} : R.Screen}

# The live request fails with nothing stale remembered: the banner shows.
law live_error_shows:
  for +a: Nat
  for sc: R.Screen
  {R.screen(R.step(R.St{R.Busy{a}, [], [], sc}, R.EvFail{a})) == R.Failure{} : R.Screen}
