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
