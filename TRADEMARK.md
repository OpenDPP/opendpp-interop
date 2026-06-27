# Trademark & Conformance Policy

**"OpenDPP"** and the OpenDPP logo are trademarks of **Opendpp UAB**. This policy
explains how you may — and may not — use them. It is independent of the software
license: nothing here narrows your Apache-2.0 rights to the **code**.

## The code is open; the name is not

All code in **this repository** is licensed under the **Apache License, Version 2.0**.
Apache-2.0 **§6 grants no trademark rights** — "This License does not grant permission
to use the trade names, trademarks, service marks, or product names of the Licensor."
So you are free to use, modify, fork, and redistribute this code; you are **not** free
to use the "OpenDPP" name or marks to identify your fork, product, or service.

> Note: "OpenDPP" the **product** (the hosted Digital Product Passport node operated by
> Opendpp UAB) is **not** open-source — only the client/standards artifacts in the public
> `OpenDPP/*` repositories are. Please don't describe OpenDPP as "open-source software."

### Forks must rename

If you redistribute a modified version you must:

- choose a **different name** that is not confusingly similar to "OpenDPP";
- **not** present your fork as "OpenDPP", "official", or endorsed by Opendpp UAB;
- keep the `LICENSE`, `NOTICE`, and copyright notices intact (Apache-2.0 §4).

**Nominative use is fine.** You may make accurate references — "compatible with OpenDPP",
"built from the OpenDPP interop kit", "validates against the OpenDPP schemas" — as long as
they don't imply endorsement or official status.

## "OpenDPP-conformant" is a certification claim

**"OpenDPP-conformant"**, **"OpenDPP-verified"**, and similar conformance claims are
**reserved**. They may be used **only** for output (a passport, AAS file, or verifiable
credential) that passes the **canonical validator operated by Opendpp UAB** and resolves
against the **live OpenDPP trust anchor** (the hosted resolver and `did:web` issuer
identity). Passing the **offline** validator in this repository is a useful self-check —
but it is **not** a conformance certification; the canonical authority is the hosted node.

This keeps every "conformant" claim a pointer back to a single, accountable EU operator —
which is the whole purpose of the mark.

## Enforcement posture

We are **friendly-first**. Forks, alternative validators, and independent clients are
welcome — they grow the ecosystem. We will raise a formal trademark concern only for
**genuine confusion** (a fork passing itself off as OpenDPP) or **false certification**
(an "OpenDPP-conformant" claim for output that never validated against the hosted
authority).

Questions or permission requests: **info@opendpp-node.eu**, or open an issue.
