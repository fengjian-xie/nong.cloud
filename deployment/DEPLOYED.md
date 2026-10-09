# m.nong.cloud deployment — 2026-08-30

Latest verified release: 2026-10-07 (Beijing time), V4.1 five-site update plus the static mini-program browser prototype. See the V4.1 section below and `output/releases/2026-10-06-architecture-v4.1/deployment/live-release.json` for actual releases and backups. Server/public-resource checks passed; live browser interaction QA remains incomplete because in-app Browser repeatedly timed out. Temporary SSH authorization was revoked, reauthentication was denied, and the local key pair was deleted. Earlier release notes are historical; their access keys must not be reused.

## V4.1 actual release — 2026-10-07 (Beijing time)

Five sites are live, and the separately approved browser prototype is available at https://work.nong.cloud/miniapp-preview/. It serves static demo templates, scripts and images; it is not a WeChat publication, real camera, contract or payment workflow.

| Site | Active release | Retained rollback backup |
| --- | --- | --- |
| nong.cloud | `/var/www/xiangqiao-home/releases/20261006T161647Z` | `/var/backups/xiangqiao-home/20261006T161647Z` |
| m.nong.cloud | `/var/www/fuan-releases/20261006T162212Z` | `/var/backups/fuan-deploy/20261006T162212Z` |
| nc.nong.cloud | `/var/www/xiangqiao-cloud-farm/releases/20261006T162435Z` | `/var/backups/xiangqiao-cloud-farm/20261006T162435Z` |
| api.nong.cloud | `/var/www/xiangqiao-api-portal/releases/20261006T163020Z` | `/var/backups/xiangqiao-api-portal/20261006T163020Z` |
| work.nong.cloud and miniapp-preview | `/var/www/xiangqiao-work/releases/20261006T163119Z` | `/var/backups/xiangqiao-work/20261006T163119Z` |

Admin navigation is organized into nine centers. Only its managed frontend references and `/manage` whitelist were changed; the original backend proxy and TLS tail remain byte-identical. Work-site config changed only by adding the bounded `/miniapp-preview/` static block; its remaining bytes, API policy and TLS were preserved. The other three site configs and original business files are unchanged. No DNS, SSH configuration, port, WeChat release or real business transaction was changed.

Every upload was SHA-256 verified, extracted with its actual guarded extractor, backed up and activated sequentially. `nginx -t`, certificate checks, server HTML/assets, other-site protection and API baselines passed. Forty external HTTPS checks verified five-site entry bytes/resources, eight new admin deep links, the prototype directory and bootstrap resources, and original 401/503 API boundaries. The duplicate `_` vhost warning is pre-existing and unchanged.

Local verification: 324 web tests, 39 native-prototype tests, 64 deployment/security regression tests, and lint passed. The actual preview runtime also passed a DOM regression under `/miniapp-preview/`. In-app Browser terminal and public-page calls timed out and reset its runtime; therefore no new live-browser screenshots or interaction acceptance are claimed. Safari, WeChat device behavior and real backend/hardware flows remain unverified.

The uploaded immutable packages and script fingerprints are in `output/releases/2026-10-06-architecture-v4.1/deployment/release-manifest.json`. The first prototype tar was rejected for a macOS metadata entry before any deployment; only the safe `miniapp-preview-v2.tar.gz` was published. Latest native handoff source: `xiangqiao-miniapp-v4.1-online-r2.zip` in that deployment directory. Original V4/V4.1 ZIPs are retained as pre-deployment archives and were not overwritten.

Final cleanup: only the exact temporary authorization `xiangqiao-web-v41-20261006-EXIlzn` was removed, preserving the inode, ownership, permissions and all other lines. The resulting authorization checksum returned to its pre-grant value, `a5235dac82813937e4f52cb100c38005e9601bb8f12c1dff978ed721ea914676`. A new strict-host-checked login returned exit255 / Permission denied. The task-generated local private and public files were then deleted and absence verified. Releases and rollback backups remain recoverable; the temporary key is no longer retained.

- URL: https://m.nong.cloud
- Server: 8.141.88.22 (`iZ2ze1g23bw8f6jdqb0g95Z`)
- Active release: `/var/www/fuan-releases/20260830-083659-150332`
- Before-release config backup: `/var/backups/fuan-deploy/20260830-083659-150332/m.nong.cloud.conf`
- Server upload directory: `/root/fuan-release-upload.FsdWCV`
- Corrected local package: `admin-web/fuan-deploy-20260830-fixed.zip`
- Package SHA256: `8c161d1ce4817156bdfcc158ca5f82f281db6d9171d6202bf241f435ecda4021`

## Result

Deployment succeeded after replacing the homepage's incorrect file alias with
`root` plus `try_files /index.html =404`. The previous alias caused Nginx to look
for `index.htmlindex.html` and return 500. The original failed attempt was rolled
back. Do not reuse the original server-uploaded `fuan-deploy-20260830.zip`.

Nginx serves the frontend UI routes and `/fuan-ui/assets/`. Its original catch-all
proxy to port 8080 is retained for API and other paths. TLS configuration is
unchanged. The separate nong.cloud configuration hash remained:
`63d7b7e6d394397552a0cd73f62f8125554581d90a57ae7475b5a13af0e55d10`.

## Verification

- Four local deployment regression/integrity tests passed.
- `nginx -t` passed; the pre-existing duplicate `_` name warning on port 80 remains.
- Server-side HTTPS HTML, asset bytes, and MP4 byte-range checks passed.
- Public HTTPS returned the expected `index-Ci7NBTbg.js` and `index-Dkc0Ee55.css` references.
- nong.cloud root returned 200 before and after; unauthenticated `/api/v1/` returned 401 before and after. No authenticated backend workflow was tested.
- Independent headless browser: demo login, dashboard, member list/detail, plot list/detail, and service list/detail all rendered without page errors.
- Browser test: `deployment/verify-live.cjs`; screenshot: `deployment/live-service-detail.png`.

This is the current mock-data frontend demonstration, not a production backend
or a published WeChat mini-program. The dedicated SSH private key is stored outside
the repository in the user's `.ssh` folder. Its authorized public key has the
OpenSSH `restrict` option; root command execution remains available for deployment.

The deployment script deliberately rejects an existing managed release. For the
next update, inspect the live configuration and this backup before choosing an
update/rollback procedure; do not blindly rerun an old installer.

## Independent API portal — 2026-10-04

The documentation/local-sandbox portal is live at https://api.nong.cloud/ on
the same server. It uses `/var/www/xiangqiao-api-portal/current`, the dedicated
`/etc/nginx/conf.d/api.nong.cloud.conf`, and its own automatically renewed TLS
certificate. The production API gateway is not implemented; draft API paths
return explicit JSON 503 responses.

The existing m.nong.cloud and nong.cloud vhosts, releases, and
`/var/www/xiangqiao-api/join.php` were preserved. User-approved temporary SSH
access for this deployment was revoked and tested to fail reauthentication;
the temporary local private key was deleted. Do not assume it remains usable.
See `API-SITE.md` for exact release/backup paths, verification, and update limits.

## Independent brand homepage — 2026-10-04

https://nong.cloud/ now serves the new Xiangqiao brand homepage using
`/var/www/xiangqiao-home/current` and isolated `/brand-site/` assets.
The original nong.cloud app files, API proxy and other routes were retained.
The nong.cloud config intentionally changed to SHA256
`d835421d967c4eb219f2e9cf49da16e378d1cfde239eb4a9c4a69ea609d69981`;
the m.nong.cloud and api.nong.cloud configs did not change.
The original certificate was reused. See `HOME-SITE.md` for precise release,
backup, verification and safe-update boundaries.

## Unified five-site release — 2026-10-04 (previous)

The following entries are live. Admin, farm, and subject-workspace business flows
are explicitly labeled frontend demonstrations; the API site is documentation
and a browser-local sandbox, not a production gateway.

| Entry | URL | Current release | Backup directory |
| --- | --- | --- | --- |
| 乡桥农事中心 | https://nong.cloud/ | `/var/www/xiangqiao-home/releases/20261004T080421Z` | `/var/backups/xiangqiao-home/20261004T080421Z` |
| 管理后台 | https://m.nong.cloud/ | `/var/www/fuan-releases/20261004T075518Z` | `/var/backups/fuan-deploy/20261004T075518Z` |
| 乡桥农场 | https://nc.nong.cloud/ | `/var/www/xiangqiao-cloud-farm/releases/20261004T072003Z` | `/var/backups/xiangqiao-cloud-farm/20261004T072003Z` |
| 开放API | https://api.nong.cloud/ | `/var/www/xiangqiao-api-portal/releases/20261004T080208Z` | `/var/backups/xiangqiao-api-portal/20261004T080208Z` |
| 用户工作台 | https://work.nong.cloud/ | `/var/www/xiangqiao-work/releases/20261004T075626Z` | `/var/backups/xiangqiao-work/20261004T075626Z` |

Current admin archive SHA256:
`2ca99c21453508f262fd9c0a89c3eb8ee63ff59b75f55a3da8f1be91255a0920`.
Admin configuration SHA256:
`ac2162c1a5fcf90ef14806bead4333ad3941fda464d2b8438ef45477c539e2e6`.
The original admin proxy to 127.0.0.1:8080 and TLS/HTTP tail were preserved;
only the managed frontend release paths and UI whitelist changed.
Original nong.cloud API still returns unauthenticated 401. Draft API paths
return JSON 503. Original join.php content and parent directory permissions were
preserved. The existing duplicate `_` vhost warning was not changed.

Mini-program: 乡桥, public AppID `wx8e467f0ee6022a34`; recorded only, no WeChat
configuration/release or real account interoperability performed. Old
`nongfu.tech` navigation was removed, not its DNS or registration.

### Multi-identity workspace

Eight demo accounts cover 11 identities and 38 role modules. One account can
switch among its bound identities without logging in again. Refresh restores
the active identity; unavailable-identity deep links are blocked; logout clears
the entire demo account session. The farmer/service-team sample supports both
identities. Formal server-side membership, tenant/object authorization and audit
requirements are specified in `WORK-SITE.md`; local selection is not security.

### Final verification

- 178 frontend tests and 29 deployment regression/integrity tests passed.
- Lint, TypeScript, and all five standalone site builds passed.
- Approved independent unsigned-in Chrome: all five sites rendered without
  blank screens, framework overlays, or relevant console errors. Tested
  desktop/tablet/mobile widths; no horizontal overflow.
- Admin: 72 meaningful pages, demo login, card detail, 11 roles and 38 modules.
- Workspace: 8 accounts, bound-identity switching, refresh, unauthorized deep
  links, logout, and a browser-local service-order collaboration example.
- Farm: filters, honest camera-unavailable state, tabs, favorites, consent,
  local intent persistence, cancellation, storage-unavailable fallback.
- Homepage: five correct entry links, business tabs/keyboard, company anchor,
  mobile menu, all seven user photographs. API: catalog and local sandbox.
- Zero real POST requests during these browser demonstrations. No real
  contract, payment, business order, camera, hardware or production-data flow.
- Safari was not actually run; Chrome responsive QA does not establish full
  Safari compatibility. Browser mock authorization is not production RBAC.

Further release metadata and guarded update/rollback limits are in
`HOME-SITE.md`, `API-SITE.md`, `CLOUD-FARM-SITE.md` and `WORK-SITE.md`.
Never blindly rerun first-install scripts against these active sites.

### Temporary access cleanup (verified)

The temporary root SSH authorization for this release was removed after live
verification. Only its exact public-key line was removed; other authorizations
were preserved, and the original authorized_keys bytes were restored.
A fresh strict-host-checked SSH connection with that key failed with exit255,
`Permission denied`. The task-generated local private and public key files were
then deleted and their absence checked. No credentials are in source or site
archives. Future server work needs a newly authorized access method.
Published releases and rollback backups were retained; no existing business
data was deleted. Only task-owned local QA previews were stopped.
