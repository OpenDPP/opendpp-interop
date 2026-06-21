# Security Policy

This repository is the **public interop boundary** of OpenDPP — the official/vendored schemas,
live-reproducible samples, the offline conformance validator, and the public OpenAPI contract. The
running service and the product backend are **separate** (see [README](./README.md) →
"Relationship to the product").

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security problem.**

| Where the issue is | How to report |
| --- | --- |
| **This kit** — the validator (`validate/`), CI/release workflows, a vendored schema copy, or a sample | Use GitHub **private vulnerability reporting**: the repository **Security** tab → **Report a vulnerability**. |
| **The live OpenDPP service** (`https://opendpp-node.eu`) or the product backend | Disclose responsibly via <https://opendpp-node.eu/security>. |

If you're unsure which applies, use <https://opendpp-node.eu/security> and we'll route it.

Please include enough to reproduce: affected file/endpoint, version (`openapi.json` `info.version`
or the validator commit), and a minimal proof of concept. We aim to acknowledge within a few business
days. We'll keep you updated through remediation and credit you in the release notes unless you'd
prefer otherwise.

## Supported versions

The kit version tracks the OpenDPP API contract it carries (`openapi.json` `info.version`, git-tagged
`v<x.y.z>`). Security fixes land on **`main`** and ship in the next tagged release; please verify
against the latest release or `main` before reporting.

## Scope notes

- **No secrets in this repo.** The `samples/` are synthetic demo data fetched from the public demo
  service. The `did:web` document holds only the **public** verification key; the JWT / base58 proof
  values are signatures over public demo data, not private keys (see [NOTICE](./NOTICE)). CI runs a
  secret scan with push protection, but please still confirm no key material is added in a PR.
- **Vendored schemas keep their upstream terms.** A correctness problem in a vendored third-party
  schema (`schemas/`) is best fixed upstream first — see [`schemas/README.md`](./schemas/README.md)
  and [NOTICE](./NOTICE) for the canonical sources and pinned refs.
- The validator runs **offline** and pulls no network resources at validation time; report any
  behaviour that contradicts that (e.g. an unexpected outbound request) as a security issue.
