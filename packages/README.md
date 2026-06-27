# `packages/` — published `@opendpp/*` client libraries

Apache-2.0 npm packages in the **OpenDPP open client surface**. They are published to npm **from this
public repo** (so npm provenance attestations work) but **developed in — and mirror-managed from —**
the OpenDPP backend (`OpenDPP/opendpp-node`, `packages/*`).

> ⚠️ **Do not hand-edit `packages/<name>/` here.** The source of truth is `opendpp-node`; an automated
> mirror keeps these copies in sync (`opendpp-node/.github/workflows/interop-publish.yml`). Edits made
> directly here are overwritten on the next mirror.

## Packages

| Package | Source of truth | Published by |
|---|---|---|
| [`gs1`](./gs1) — `@opendpp/gs1` | `opendpp-node/packages/gs1` | [`publish-gs1.yml`](../.github/workflows/publish-gs1.yml) on a `gs1-<semver>` tag |
| [`csv`](./csv) — `@opendpp/csv` | `opendpp-node/packages/csv` | [`publish-csv.yml`](../.github/workflows/publish-csv.yml) on a `csv-<semver>` tag |
| [`webhooks`](./webhooks) — `@opendpp/webhooks` | `opendpp-node/packages/webhooks` | [`publish-webhooks.yml`](../.github/workflows/publish-webhooks.yml) on a `webhooks-<semver>` tag |

Each `publish-<pkg>.yml` is keyless (OIDC trusted publishing) and fires on its own `<pkg>-<semver>` tag;
the tag must match that package's `package.json` version. Release + one-time setup runbook:
`opendpp-node/docs/operations/integrations/Interop-Package-Publishing.md`.
