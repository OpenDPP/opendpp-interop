# Contributing to the OpenDPP interop kit

Thanks for helping improve OpenDPP's public interoperability boundary. Issues and PRs are welcome —
this short guide keeps them landing smoothly.

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

## What PRs *are* welcome

- **Validator** improvements — bug fixes, clearer error output, a new validation "door"
  (`validate/validate.mjs`), or tests. It must stay **offline** and dependency-light.
- **Docs** — fixes and clarifications to `README.md`, `CONFORMANCE.md`, `CHANGELOG.md`, or this file.
- **Vendored schema copies** (`schemas/`) — only to re-sync with the **upstream** canonical source.
  Bump the pinned ref and update [`NOTICE`](./NOTICE) and [`schemas/README.md`](./schemas/README.md)
  together; don't locally diverge from upstream.
- **Samples** — additional or refreshed artifacts, **only** when they are faithful, reproducible
  outputs of the live service (each should be reproducible via the `curl` in its `*-VALIDATION.md`).

## Keep non-normative claims honest

Some content here is **NON-NORMATIVE** and must stay clearly labelled as such: OpenDPP's own SHACL
shapes (`shapes/`), the CIRPASS-2 EU-registry pointer interop, and the IDTA `semanticId` **identity**
check (identity ≠ structural conformance). Never describe any of it as "certified", "EU-official", or
a CIRPASS-2/EU conformance suite. See [`CONFORMANCE.md`](./CONFORMANCE.md) and [`NOTICE`](./NOTICE).

## Before you open a PR

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

- **CI must stay green** — sample validation, the negative controls, JSON sanity, and the gitleaks
  secret scan all run on every PR.
- **No secrets / private keys** — the samples carry only public demo data and public verification
  keys (see [`SECURITY.md`](./SECURITY.md)); push protection will also block key material.
- Fill in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md) checklist and link any issue
  (`Fixes #N`).

## Reporting security issues

Do **not** open a public issue for a vulnerability — follow [`SECURITY.md`](./SECURITY.md).

## License of contributions

This kit's own content is [Apache-2.0](./LICENSE); vendored third-party schemas keep their upstream
terms ([`NOTICE`](./NOTICE)). By submitting a contribution you agree it is licensed under the same
terms as the file(s) it touches (inbound = outbound). Please also follow our
[Code of Conduct](./CODE_OF_CONDUCT.md).
