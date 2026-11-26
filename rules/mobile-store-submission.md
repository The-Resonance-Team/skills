---
id: "mobile-store-submission"
name: "Mobile Store Submission — rejection prevention for iOS and Android"
kind: "rule"
description: "Applies to repos that build a native iOS or Android app and submit it to the Apple App Store or Google Play. Include this module only for those apps. `rules/miniapp.md` covers Zalo Mini App. `rules/frontend.md` covers web clients."
scope: "Native iOS/Android store submission and rejection prevention"
priority: "mandatory"
---
# Mobile Store Submission — rejection prevention for iOS and Android

<!-- rule: module-context -->
0. **Module context** — Apply this context when the module applies.

Applies to repos that build a native iOS or Android app and submit it to the Apple App Store or Google Play. Include this module only for those apps. `rules/miniapp.md` covers Zalo Mini App. `rules/frontend.md` covers web clients.

> **Docs (read before a submission)**: [primary: Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [primary: Google Play policy center](https://play.google/developer-content-policy/) · [playbook: pre-submission checklist](https://mjmirza.github.io/app-store-compliance/PRE-SUBMISSION-CHECKLIST.html) · [playbook: Apple rejection map](https://mjmirza.github.io/app-store-compliance/APPLE.html) · [playbook: Google Play rejection map](https://mjmirza.github.io/app-store-compliance/GOOGLE-PLAY.html) · [playbook: appeal playbook](https://mjmirza.github.io/app-store-compliance/MISTAKE-PATTERNS.html) · [playbook: privacy guide](https://mjmirza.github.io/app-store-compliance/MOBILE-PRIVACY-MONITOR-2026.html) · [playbook: by app type](https://mjmirza.github.io/app-store-compliance/BY-APP-TYPE.html). Token-lean raw markdown: `https://raw.githubusercontent.com/mjmirza/app-store-compliance/main/docs/{PRE-SUBMISSION-CHECKLIST,APPLE,GOOGLE-PLAY,MISTAKE-PATTERNS,MOBILE-PRIVACY-MONITOR-2026,BY-APP-TYPE}.md`. The playbook is a secondary source. It is not affiliated with Apple or Google. It uses the OpenRoots Agent License 2.3, a non-OSI license. Cite the playbook. Copy no text from it into repo files.

## Before a submission

<!-- rule: complete-the-checklist-for-e -->
1. **Complete the checklist for each target store** — Read the playbook pre-submission checklist before each store submission. Use the Apple section for iOS. Use the Google Play section for Android. Record the result.
<!-- rule: do-not-submit-with-an-open-f -->
2. **Do not submit with an open failure** — Fix every failed checklist item before you upload the build. Do not submit while a known failure is open.

## After a rejection

<!-- rule: map-each-rejection-to-one-gu -->
3. **Map each rejection to one guideline and one fix** — When a store rejects a build, record the exact store guideline, the trigger, and the fix. Use the Apple or Google Play rejection map for the first pass. Use the appeal playbook when you contest the decision.
<!-- rule: primary-sources-govern-every -->
4. **Primary sources govern every rule claim** — Use the Apple App Review Guidelines and the Google Play policy center for any statement about a store rule. Use the playbook only as a practitioner aid. When the two source types disagree, follow the store source.
