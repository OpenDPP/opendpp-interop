<!-- Thanks for contributing to the OpenDPP interop kit! -->

**What & why**

<!-- What does this change and why? Link any issue (Fixes #N). -->

**Scope check** (this repo is the public interop boundary — see CONTRIBUTING):

- [ ] This is a fix to the **validator**, a **sample**, a **schema copy**, or the **docs**.
- [ ] It does **not** try to change OpenDPP product behaviour (that lives in the private product; conformance gaps → a "Conformance gap" issue instead).

**Checks**

- [ ] `cd validate && npm ci` then the samples still validate (`node validate/validate.mjs aas|untp …`).
- [ ] If I changed a sample, it is still a faithful, reproducible output of the live service.
- [ ] No secrets / private keys added (the CI secret-scan will also check).
