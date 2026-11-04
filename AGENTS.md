<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep trade evaluation and atomic roster swaps in the browser-safe trade domain module, separate from the league screen, so acceptance rules can be tested without UI rendering.
- Keep staff contracts and attribute modifiers in the browser-safe staff domain; persist staff IDs in the existing league save and apply modifiers only to match copies so base rosters and player values stay unchanged.
- Keep season-stat accumulation and rate calculations (batAvg, era) in the browser-safe stats domain module; the match engine only records per-game lines and league screens merge them into the save.
- Keep rookie draft order, pool generation and pick application in the browser-safe draft domain module so draft rules stay testable without UI.
- Keep season-end prize money and title awards in the browser-safe awards domain module; the league screen applies the settlement once when the user starts the draft.
- League saves stay in localStorage and, when the user signs in with Google, sync whole-save JSON to the per-user `league_saves` row (RLS owner-only) via the browser client hook; on sign-in the cloud copy wins if it exists.
- Keep 1st/2nd-team (farm) limits, recall waits and farm growth in the browser-safe farm domain module; the league screen runs farmTick after each market tick so rosters used for matches only hold 1st-team players.
- Market scouting reports come from one batched AI Gateway server function (scouting.functions.ts) that only receives visible stats and the shown value range, never exact hidden player values; reports are cached per listing in localStorage so each listing is requested once.
