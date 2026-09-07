# m.nong.cloud deployment — 2026-08-30

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
