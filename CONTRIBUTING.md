# Contributing to the OpenDPP interop kit

Thanks for helping improve OpenDPP's public interoperability boundary. **Issues are very welcome and
are the door that matters here** — this short guide explains why, and how to make one land.

> ### 🔁 This repo is a generated mirror — pull requests are closed automatically
>
> Everything here is authored in the private `opendpp-node` backend and synced: the conformance kit
> (`openapi.json`, `schemas/`, `samples/`, `validate/`, `shapes/`, and these docs) and the
> `@opendpp/*` sources under `packages/`. A change made in a PR here cannot flow back to the source
> of truth and would be overwritten on the next sync, so fork PRs are closed by an automated
> responder with a pointer back to this file. **Nothing is lost by opening an issue instead** — it
> gets fixed at the source and synced here, which is the only change that sticks.

## What this repository is (and isn't)

This repo is the **public contract**: the official/vendored schemas, the offline conformance
validator, live-reproducible samples, the field mappings, and the public `openapi.json`. The OpenDPP
**product backend is a separate, private repository** — it is the source of truth for the API
behaviour, the emitters, and the spec.

That split drives the one rule that matters most:

> ### 🚫 `openapi.json` and `samples/` are **mirrored from the backend — do not hand-edit them.**
>
> They are generated/exported from the live OpenDPP service and committed verbatim. A PR that
> hand-edits the spec or a sample to "fix" or extend it will be redirected, because the change has to
> happen in the backend first or it will simply be overwritten on the next refresh (the weekly
> [drift check](./.github/workflows/drift-check.yml) compares `openapi.json` against the live spec).
>
> Found the live service emitting something non-conformant, or want a field the contract doesn't
> expose? That's a **product** change — open a
> [**Conformance gap** issue](./.github/ISSUE_TEMPLATE/conformance-gap.md), not a PR here.

That rule now applies to the *whole* repository, not just the spec and samples — see the mirror note
at the top.

## What to open an issue about

These are all genuinely wanted — they were the categories that used to arrive as PRs, and they now
arrive as issues and get fixed upstream:

- **Validator** improvements — bugs, unclear error output, a missing validation "door"
  (`validate/validate.mjs`), a gap in its tests. It must stay **offline** and dependency-light.
- **Docs** — anything wrong or unclear in `README.md`, `CONFORMANCE.md`, `CHANGELOG.md`, or this file.
- **Vendored schema copies** (`schemas/`) — tell us when an **upstream** canonical source has moved;
  we re-sync the pinned ref together with [`NOTICE`](./NOTICE) and
  [`schemas/README.md`](./schemas/README.md), and never locally diverge from upstream.
- **Samples** — a sample that no longer reproduces against the live service, or one you think is
  missing (each should be reproducible via the `curl` in its `*-VALIDATION.md`).
- **Conformance gaps** — the live service emitting something non-conformant. Use the
  [Conformance gap](./.github/ISSUE_TEMPLATE/conformance-gap.md) template.

## Keep non-normative claims honest

Some content here is **NON-NORMATIVE** and must stay clearly labelled as such: OpenDPP's own SHACL
shapes (`shapes/`), the CIRPASS-2 EU-registry pointer interop, and the IDTA `semanticId` **identity**
check (identity ≠ structural conformance). Never describe any of it as "certified", "EU-official", or
a CIRPASS-2/EU conformance suite. See [`CONFORMANCE.md`](./CONFORMANCE.md) and [`NOTICE`](./NOTICE).

## Reproducing before you report

Not required, but it makes an issue immediately actionable — and it is exactly what CI runs:

```bash
cd validate
npm ci

# the samples must still validate against the official schemas + the non-normative doors
node validate.mjs aas      ../samples/battery-aas-environment.json
node validate.mjs untp     ../samples/battery-vc-credential.json
node validate.mjs registry ../samples/battery-registry-pointer-model.json
node validate.mjs shacl    ../samples/battery-passport.jsonld
node validate.mjs sdjwt    ../samples/battery-vc.sdjwt
# (CI runs the full set, plus the forged-SD-JWT and tampered-SHACL negative controls)
```

- **CI runs the full set on every push**, plus the forged-SD-JWT and tampered-SHACL negative
  controls, JSON sanity, and a gitleaks secret scan — so "it validates locally" and "it validates in
  CI" should agree. If they don't, that itself is worth an issue.
- **Never paste secrets or private keys** into an issue — the samples carry only public demo data and
  public verification keys (see [`SECURITY.md`](./SECURITY.md)).

## Reporting security issues

Do **not** open a public issue for a vulnerability — follow [`SECURITY.md`](./SECURITY.md).

## License of contributions

This kit's own content is [Apache-2.0](./LICENSE); vendored third-party schemas keep their upstream
terms ([`NOTICE`](./NOTICE)). By submitting a contribution you agree it is licensed under the same
terms as the file(s) it touches (inbound = outbound). Please also follow our
[Code of Conduct](./CODE_OF_CONDUCT.md).
