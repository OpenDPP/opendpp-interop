---
name: Conformance gap
about: A place where OpenDPP's AAS or UNTP/VC output doesn't conform to the standard
title: "[conformance] "
labels: conformance
---

**Which projection?** AAS (`aas+json` / AASX) · UNTP `vc+jwt` · embedded `vc+ld+json`

**What you fetched** (URL + `Accept` header), e.g.:
```bash
curl -sL -H 'Accept: application/vc+jwt' https://opendpp-node.eu/01/<gtin>
```

**Expected** (cite the standard + clause: IDTA-01001-3-1 / UNTP DPP v0.7.0 / W3C VCDM / `did:web` / etc.):

**Actual** (the output, or the validator error):
```
node validate/validate.mjs <aas|untp> your-output.json
```

**Anything else** (spec version, tooling):
