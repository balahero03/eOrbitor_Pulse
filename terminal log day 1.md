balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "claude.md added"
[main (root-commit) 80762ab] claude.md added
 1 file changed, 957 insertions(+)
 create mode 100644 CLAUDE.md
balahero03@balahero03:~/eOrbitor_Pulse$ git push
Enumerating objects: 3, done.
Counting objects: 100% (3/3), done.
Delta compression using up to 12 threads
Compressing objects: 100% (2/2), done.
Writing objects: 100% (3/3), 10.36 KiB | 10.36 MiB/s, done.
Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
To https://github.com/balahero03/eOrbitor_Pulse.git
 * [new branch]      main -> main
balahero03@balahero03:~/eOrbitor_Pulse$ npm install

added 175 packages, and audited 176 packages in 26s

33 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "LEADS MODULE - COMPLETED"
[main ccc0251] LEADS MODULE - COMPLETED
 44 files changed, 8217 insertions(+), 957 deletions(-)
 create mode 100644 .env.local.example
 create mode 100644 .gitignore
 delete mode 100644 CLAUDE.md
 create mode 100644 COMPLETION_REPORT.txt
 create mode 100644 IMPLEMENTATION_STATUS.md
 create mode 100644 LEADS_MODULE_GUIDE.md
 create mode 100644 LOGGING.md
 create mode 100644 PHASE1_SUMMARY.txt
 create mode 100644 PROJECT_SPEC.md
 create mode 100644 SETUP.md
 create mode 100644 START_HERE.md
 create mode 100644 SUMMARY.txt
 create mode 100644 app/(auth)/login/page.tsx
 create mode 100644 app/(dashboard)/customers/page.tsx
 create mode 100644 app/(dashboard)/dashboard/page.tsx
 create mode 100644 app/(dashboard)/layout.tsx
 create mode 100644 app/(dashboard)/leads/[id]/page.tsx
 create mode 100644 app/(dashboard)/leads/new/page.tsx
 create mode 100644 app/(dashboard)/leads/page.tsx
 create mode 100644 app/(dashboard)/orders/page.tsx
 create mode 100644 app/(dashboard)/pipeline/page.tsx
 create mode 100644 app/(dashboard)/quotations/page.tsx
 create mode 100644 app/(dashboard)/reports/page.tsx
 create mode 100644 app/(dashboard)/settings/page.tsx
 create mode 100644 app/(dashboard)/support/page.tsx
 create mode 100644 app/(dashboard)/tasks/page.tsx
 create mode 100644 app/api/auth/login/route.ts
 create mode 100644 app/api/auth/me/route.ts
 create mode 100644 app/api/dashboard/route.ts
 create mode 100644 app/api/leads/[id]/route.ts
 create mode 100644 app/api/leads/route.ts
 create mode 100644 app/globals.css
 create mode 100644 app/layout.tsx
 create mode 100644 eOrbitor_logo.jpg
 create mode 100644 lib/logger.ts
 create mode 100644 next.config.js
 create mode 100644 package-lock.json
 create mode 100644 package.json
 create mode 100644 postcss.config.js
 create mode 100644 prisma/schema.prisma
 create mode 100644 prisma/seed.js
 create mode 100644 public/eOrbitor_logo.jpg
 create mode 100644 tailwind.config.js
 create mode 100644 tsconfig.json
balahero03@balahero03:~/eOrbitor_Pulse$ git push
Enumerating objects: 71, done.
Counting objects: 100% (71/71), done.
Delta compression using up to 12 threads
Compressing objects: 100% (51/51), done.
Writing objects: 100% (70/70), 610.81 KiB | 24.43 MiB/s, done.
Total 70 (delta 9), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (9/9), done.
To https://github.com/balahero03/eOrbitor_Pulse.git
   80762ab..ccc0251  main -> main
balahero03@balahero03:~/eOrbitor_Pulse$ git add.
git: 'add.' is not a git command. See 'git --help'.

The most similar command is
        add
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "Phase 2 module done"
[main d00b128] Phase 2 module done
 18 files changed, 3808 insertions(+), 20 deletions(-)
 create mode 100644 CUSTOMERS_MODULE_GUIDE.md
 create mode 100644 PHASE2_SUMMARY.txt
 create mode 100644 PHASE3_SUMMARY.txt
 create mode 100644 PIPELINE_MODULE_GUIDE.md
 create mode 100644 app/(dashboard)/customers/[id]/page.tsx
 create mode 100644 app/(dashboard)/customers/new/page.tsx
 create mode 100644 app/(dashboard)/pipeline/[id]/page.tsx
 create mode 100644 app/(dashboard)/pipeline/new/page.tsx
 create mode 100644 app/api/customers/[id]/contacts/[contactId]/route.ts
 create mode 100644 app/api/customers/[id]/contacts/route.ts
 create mode 100644 app/api/customers/[id]/route.ts
 create mode 100644 app/api/customers/route.ts
 create mode 100644 app/api/deals/[id]/move/route.ts
 create mode 100644 app/api/deals/[id]/route.ts
 create mode 100644 app/api/deals/route.ts
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "phase 3 module done"
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "Phase 4 Done"
[main 6690ae8] Phase 4 Done
 11 files changed, 2414 insertions(+), 11 deletions(-)
 create mode 100644 PHASE4_SUMMARY.txt
 create mode 100644 QUOTATIONS_MODULE_GUIDE.md
 create mode 100644 app/(dashboard)/quotations/[id]/page.tsx
 create mode 100644 app/(dashboard)/quotations/new/page.tsx
 create mode 100644 app/api/products/route.ts
 create mode 100644 app/api/quotations/[id]/approve/route.ts
 create mode 100644 app/api/quotations/[id]/route.ts
 create mode 100644 app/api/quotations/[id]/send/route.ts
 create mode 100644 app/api/quotations/route.ts
balahero03@balahero03:~/eOrbitor_Pulse$ npm install

added 1 package, and audited 177 packages in 5s

33 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
balahero03@balahero03:~/eOrbitor_Pulse$ npm run dev

> eorbitor-pulse@1.0.0 dev
> next dev

  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000

 ✓ Starting...

   We detected TypeScript in your project and reconfigured your tsconfig.json file for you. Strict-mode is set to false by default.
   The following suggested values were added to your tsconfig.json. These values can be changed to fit your project's needs:

        - allowJs was set to true

   The following mandatory changes were made to your tsconfig.json:

        - isolatedModules was set to true (requirement for SWC / Babel)

 ✓ Ready in 1128ms
 ○ Compiling /_not-found ...
 ✓ Compiled /_not-found in 1459ms (454 modules)
 GET / 404 in 1581ms
 ✓ Compiled in 100ms (235 modules)
 ✓ Compiled in 117ms (235 modules)
 GET / 404 in 20ms
 GET / 404 in 14ms
 ✓ Compiled in 110ms (235 modules)
 ✓ Compiled in 175ms (454 modules)
 ✓ Compiled in 75ms (235 modules)
 ✓ Compiled in 82ms (454 modules)
 GET / 404 in 60ms
 ✓ Compiled in 116ms (233 modules)
 ✓ Compiled in 74ms (233 modules)
 ✓ Compiled in 82ms (233 modules)
 ✓ Compiled in 79ms (233 modules)
 ✓ Compiled in 68ms (233 modules)
 ✓ Compiled in 73ms (233 modules)
 ✓ Compiled in 77ms (233 modules)
^C

balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "phase 5 added"
[main e004007] phase 5 added
 17 files changed, 2230 insertions(+), 15 deletions(-)
 create mode 100644 PHASE5_SUMMARY.txt
 create mode 100644 app/(dashboard)/orders/[id]/page.tsx
 create mode 100644 app/(dashboard)/orders/new/page.tsx
 create mode 100644 app/api/followups/[id]/route.ts
 create mode 100644 app/api/followups/route.ts
 create mode 100644 app/api/orders/[id]/confirm/route.ts
 create mode 100644 app/api/orders/[id]/fulfill/route.ts
 create mode 100644 app/api/orders/[id]/payment/route.ts
 create mode 100644 app/api/orders/[id]/route.ts
 create mode 100644 app/api/orders/route.ts
 create mode 100644 app/api/tasks/[id]/complete/route.ts
 create mode 100644 app/api/tasks/[id]/route.ts
 create mode 100644 app/api/tasks/route.ts
 create mode 100644 next-env.d.ts
balahero03@balahero03:~/eOrbitor_Pulse$ git push
Enumerating objects: 109, done.
Counting objects: 100% (109/109), done.
Delta compression using up to 12 threads
Compressing objects: 100% (77/77), done.
Writing objects: 100% (95/95), 68.05 KiB | 4.86 MiB/s, done.
Total 95 (delta 34), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (34/34), completed with 4 local objects.
To https://github.com/balahero03/eOrbitor_Pulse.git
   ccc0251..e004007  main -> main
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "phase 6 done"
[main 1607f90] phase 6 done
 13 files changed, 4016 insertions(+), 10 deletions(-)
 create mode 100644 PHASE6_SUMMARY.txt
 create mode 100644 app/(dashboard)/followups/[id]/page.tsx
 create mode 100644 app/(dashboard)/followups/new/page.tsx
 create mode 100644 app/(dashboard)/followups/page.tsx
 create mode 100644 app/(dashboard)/tasks/[id]/page.tsx
 create mode 100644 app/(dashboard)/tasks/new/page.tsx
 create mode 100644 "app/\\(dashboard\\)/followups/\\[id\\]/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/followups/new/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/followups/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/tasks/\\[id\\]/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/tasks/new/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/tasks/page.tsx"
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "Phase 7 done"
[main 0faccc4] Phase 7 done
 22 files changed, 4827 insertions(+), 44 deletions(-)
 create mode 100644 PHASE7_SUMMARY.txt
 create mode 100644 app/(dashboard)/inventory/page.tsx
 create mode 100644 app/(dashboard)/products/[id]/page.tsx
 create mode 100644 app/(dashboard)/products/new/page.tsx
 create mode 100644 app/(dashboard)/products/page.tsx
 create mode 100644 app/(dashboard)/vendors/[id]/page.tsx
 create mode 100644 app/(dashboard)/vendors/new/page.tsx
 create mode 100644 app/(dashboard)/vendors/page.tsx
 create mode 100644 "app/\\(dashboard\\)/inventory/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/products/\\[id\\]/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/products/new/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/products/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/vendors/\\[id\\]/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/vendors/new/page.tsx"
 create mode 100644 "app/\\(dashboard\\)/vendors/page.tsx"
 create mode 100644 app/api/inventory/route.ts
 create mode 100644 app/api/products/[id]/route.ts
 create mode 100644 app/api/vendors/[id]/products/route.ts
 create mode 100644 app/api/vendors/[id]/route.ts
 create mode 100644 app/api/vendors/route.ts
balahero03@balahero03:~/eOrbitor_Pulse$ git add .
balahero03@balahero03:~/eOrbitor_Pulse$ git commit -m "Phase 8 done"
[main f25e512] Phase 8 done
 8 files changed, 1499 insertions(+), 12 deletions(-)
 create mode 100644 PHASE8_SUMMARY.txt
 create mode 100644 app/(dashboard)/support/[id]/page.tsx
 create mode 100644 app/(dashboard)/support/new/page.tsx
 create mode 100644 app/api/tickets/[id]/resolve/route.ts
 create mode 100644 app/api/tickets/[id]/route.ts
 create mode 100644 app/api/tickets/route.ts
balahero03@balahero03:~/eOrbitor_Pulse$ git push
Enumerating objects: 86, done.
Counting objects: 100% (86/86), done.
Delta compression using up to 12 threads
Compressing objects: 100% (61/61), done.
Writing objects: 100% (76/76), 51.15 KiB | 6.39 MiB/s, done.
Total 76 (delta 32), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (32/32), completed with 4 local objects.
To https://github.com/balahero03/eOrbitor_Pulse.git
   e004007..f25e512  main -> main
balahero03@balahero03:~/eOrbitor_Pulse$ npm install

up to date, audited 177 packages in 1s

33 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
balahero03@balahero03:~/eOrbitor_Pulse$ npm run dev

> eorbitor-pulse@1.0.0 dev
> next dev

  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000

 ✓ Starting...
 ✓ Ready in 1393ms
NormalizeError: Requested and resolved page mismatch: //(dashboard/)/followups/page /(dashboard/)/followups/page
    at normalizePagePath (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/shared/lib/page-path/normalize-page-path.js:20:19)
    at AppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/built/app/app-bundle-path-normalizer.js:31:73)
    at /home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/normalizers.js:19:77
    at Array.reduce (<anonymous>)
    at DevAppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/normalizers.js:19:33)
    at DevAppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/built/app/app-bundle-path-normalizer.js:44:22)
    at DevAppPageRouteMatcherProvider.transform (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-providers/dev/dev-app-page-route-matcher-provider.js:39:60)
    at DevAppPageRouteMatcherProvider.matchers (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-providers/helpers/cached-route-matcher-provider.js:23:37)
    at async Promise.all (index 0)
    at async DevRouteMatcherManager.reload (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-managers/default-route-matcher-manager.js:39:39)
    at async DevRouteMatcherManager.reload (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-managers/dev-route-matcher-manager.js:112:9)
 ⨯ unhandledRejection: NormalizeError: Requested and resolved page mismatch: //(dashboard/)/followups/page /(dashboard/)/followups/page
    at normalizePagePath (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/shared/lib/page-path/normalize-page-path.js:20:19)
    at AppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/built/app/app-bundle-path-normalizer.js:31:73)
    at /home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/normalizers.js:19:77
    at Array.reduce (<anonymous>)
    at DevAppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/normalizers.js:19:33)
    at DevAppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/built/app/app-bundle-path-normalizer.js:44:22)
    at DevAppPageRouteMatcherProvider.transform (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-providers/dev/dev-app-page-route-matcher-provider.js:39:60)
    at DevAppPageRouteMatcherProvider.matchers (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-providers/helpers/cached-route-matcher-provider.js:23:37)
    at async Promise.all (index 0)
    at async DevRouteMatcherManager.reload (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-managers/default-route-matcher-manager.js:39:39)
    at async DevRouteMatcherManager.reload (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-managers/dev-route-matcher-manager.js:112:9)
 ⨯ unhandledRejection: NormalizeError: Requested and resolved page mismatch: //(dashboard/)/followups/page /(dashboard/)/followups/page
    at normalizePagePath (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/shared/lib/page-path/normalize-page-path.js:20:19)
    at AppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/built/app/app-bundle-path-normalizer.js:31:73)
    at /home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/normalizers.js:19:77
    at Array.reduce (<anonymous>)
    at DevAppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/normalizers.js:19:33)
    at DevAppBundlePathNormalizer.normalize (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/normalizers/built/app/app-bundle-path-normalizer.js:44:22)
    at DevAppPageRouteMatcherProvider.transform (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-providers/dev/dev-app-page-route-matcher-provider.js:39:60)
    at DevAppPageRouteMatcherProvider.matchers (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-providers/helpers/cached-route-matcher-provider.js:23:37)
    at async Promise.all (index 0)
    at async DevRouteMatcherManager.reload (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-managers/default-route-matcher-manager.js:39:39)
    at async DevRouteMatcherManager.reload (/home/balahero03/eOrbitor_Pulse/node_modules/next/dist/server/future/route-matcher-managers/dev-route-matcher-manager.js:112:9)
 ○ Compiling /_not-found ...
 ⨯ ./app/globals.css.webpack[javascript/auto]!=!./node_modules/next/dist/build/webpack/loaders/css-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[2]!./node_modules/next/dist/build/webpack/loaders/postcss-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[3]!./app/globals.css
Error: ENOENT: no such file or directory, stat '/home/balahero03/eOrbitor_Pulse/app//(dashboard/)/followups/page.tsx'
Import trace for requested module:
./app/globals.css.webpack[javascript/auto]!=!./node_modules/next/dist/build/webpack/loaders/css-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[2]!./node_modules/next/dist/build/webpack/loaders/postcss-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[3]!./app/globals.css
./app/globals.css
 ⨯ ./app/globals.css.webpack[javascript/auto]!=!./node_modules/next/dist/build/webpack/loaders/css-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[2]!./node_modules/next/dist/build/webpack/loaders/postcss-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[3]!./app/globals.css
Error: ENOENT: no such file or directory, stat '/home/balahero03/eOrbitor_Pulse/app//(dashboard/)/followups/page.tsx'
Import trace for requested module:
./app/globals.css.webpack[javascript/auto]!=!./node_modules/next/dist/build/webpack/loaders/css-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[2]!./node_modules/next/dist/build/webpack/loaders/postcss-loader/src/index.js??ruleSet[1].rules[14].oneOf[12].use[3]!./app/globals.css
./app/globals.css
 GET / 500 in 2904ms
^C

balahero03@balahero03:~/eOrbitor_Pulse$ node --version
v24.14.0
balahero03@balahero03:~/eOrbitor_Pulse$ psql --version
Command 'psql' not found, but can be installed with:
sudo apt install postgresql-client-common
balahero03@balahero03:~/eOrbitor_Pulse$ ^C
balahero03@balahero03:~/eOrbitor_Pulse$ sudo apt install postgresql-client-common
[sudo] password for balahero03: 
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
The following NEW packages will be installed:
  postgresql-client-common
0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
Need to get 36.4 kB of archives.
After this operation, 134 kB of additional disk space will be used.
Get:1 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql-client-common all 257build1.1 [36.4 kB]
Fetched 36.4 kB in 1s (24.4 kB/s)               
Selecting previously unselected package postgresql-client-common.
(Reading database ... 268899 files and directories currently installed.)
Preparing to unpack .../postgresql-client-common_257build1.1_all.deb ...
Unpacking postgresql-client-common (257build1.1) ...
Setting up postgresql-client-common (257build1.1) ...
Processing triggers for man-db (2.12.0-4build2) ...
balahero03@balahero03:~/eOrbitor_Pulse$ psql --version
Warning: No existing cluster is suitable as a default target. Please see man pg_wrapper(1) how to specify one.
Error: You must install at least one postgresql-client-<version> package
balahero03@balahero03:~/eOrbitor_Pulse$ psql --version
Warning: No existing cluster is suitable as a default target. Please see man pg_wrapper(1) how to specify one.
Error: You must install at least one postgresql-client-<version> package
balahero03@balahero03:~/eOrbitor_Pulse$ ^C
balahero03@balahero03:~/eOrbitor_Pulse$ ^[[200~sudo apt update
sudo: command not found
balahero03@balahero03:~/eOrbitor_Pulse$ sudo apt install postgresql postgresql-client~
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
E: Unable to locate package postgresql-client~
balahero03@balahero03:~/eOrbitor_Pulse$ Fv
Fv: command not found
balahero03@balahero03:~/eOrbitor_Pulse$ psql --version
Warning: No existing cluster is suitable as a default target. Please see man pg_wrapper(1) how to specify one.
Error: You must install at least one postgresql-client-<version> package
balahero03@balahero03:~/eOrbitor_Pulse$ sudo apt update
sudo apt install postgresql postgresql-client
Get:1 https://dl.google.com/linux/chrome/deb stable InRelease [1,825 B]                            
Get:2 https://dl.google.com/linux/chrome-stable/deb stable InRelease [1,825 B]                     
Hit:3 http://archive.ubuntu.com/ubuntu noble InRelease                                             
Get:4 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]                          
Get:5 https://dl.google.com/linux/chrome/deb stable/main amd64 Packages [1,220 B]                  
Get:6 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]                            
Get:7 https://dl.google.com/linux/chrome-stable/deb stable/main amd64 Packages [1,220 B]           
Get:8 http://security.ubuntu.com/ubuntu noble-security/universe Sources [261 kB]                   
Get:9 http://archive.ubuntu.com/ubuntu noble-backports InRelease [126 kB]                         
Get:10 http://security.ubuntu.com/ubuntu noble-security/multiverse Sources [21.5 kB]             
Get:11 http://security.ubuntu.com/ubuntu noble-security/main Sources [209 kB]                    
Get:12 http://security.ubuntu.com/ubuntu noble-security/main amd64 Packages [1,698 kB]     
Get:13 http://security.ubuntu.com/ubuntu noble-security/main Translation-en [267 kB]        
Get:14 http://security.ubuntu.com/ubuntu noble-security/main amd64 Components [42.5 kB]            
Get:15 http://security.ubuntu.com/ubuntu noble-security/main Icons (48x48) [14.7 kB]               
Get:16 http://security.ubuntu.com/ubuntu noble-security/main Icons (64x64) [21.1 kB]               
Hit:17 https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev antigravity-debian InRelease
Get:18 http://security.ubuntu.com/ubuntu noble-security/universe amd64 Packages [1,189 kB]
Get:19 http://archive.ubuntu.com/ubuntu noble-updates/multiverse Sources [26.3 kB]    
Get:20 http://archive.ubuntu.com/ubuntu noble-updates/restricted Sources [63.4 kB]
Get:21 http://archive.ubuntu.com/ubuntu noble-updates/main Sources [387 kB]       
Get:22 http://security.ubuntu.com/ubuntu noble-security/universe Translation-en [229 kB]
Get:23 http://security.ubuntu.com/ubuntu noble-security/universe amd64 Components [74.3 kB]     
Get:24 http://security.ubuntu.com/ubuntu noble-security/multiverse Translation-en [8,784 B]
Get:25 http://archive.ubuntu.com/ubuntu noble-updates/universe Sources [377 kB]         
Get:26 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 Packages [2,007 kB]
Get:27 http://archive.ubuntu.com/ubuntu noble-updates/main Translation-en [355 kB]
Get:28 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 Components [177 kB]
Get:29 http://archive.ubuntu.com/ubuntu noble-updates/restricted amd64 Packages [3,202 kB]
Get:30 http://archive.ubuntu.com/ubuntu noble-updates/restricted Translation-en [740 kB]
Get:31 http://archive.ubuntu.com/ubuntu noble-updates/universe amd64 Packages [1,690 kB]
Get:32 http://archive.ubuntu.com/ubuntu noble-updates/universe Translation-en [328 kB]
Get:33 http://archive.ubuntu.com/ubuntu noble-updates/universe amd64 Components [386 kB]
Get:34 http://archive.ubuntu.com/ubuntu noble-updates/multiverse Translation-en [10.9 kB]
Get:35 http://archive.ubuntu.com/ubuntu noble-updates/multiverse amd64 Components [940 B]
Get:36 http://archive.ubuntu.com/ubuntu noble-backports/main amd64 Components [5,744 B]
Get:37 http://archive.ubuntu.com/ubuntu noble-backports/universe amd64 Components [10.6 kB]
Fetched 14.2 MB in 6s (2,460 kB/s)         
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
9 packages can be upgraded. Run 'apt list --upgradable' to see them.
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
The following additional packages will be installed:
  libcommon-sense-perl libjson-perl libjson-xs-perl libllvm17t64 libpq5 libtypes-serialiser-perl
  postgresql-16 postgresql-client-16 postgresql-common
Suggested packages:
  postgresql-doc postgresql-doc-16
The following NEW packages will be installed:
  libcommon-sense-perl libjson-perl libjson-xs-perl libllvm17t64 libpq5 libtypes-serialiser-perl
  postgresql postgresql-16 postgresql-client postgresql-client-16 postgresql-common
0 upgraded, 11 newly installed, 0 to remove and 9 not upgraded.
Need to get 43.6 MB of archives.
After this operation, 175 MB of additional disk space will be used.
Do you want to continue? [Y/n] y
Get:1 http://archive.ubuntu.com/ubuntu noble/main amd64 libjson-perl all 4.10000-1 [81.9 kB]
Get:2 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql-common all 257build1.1 [161 kB]
Get:3 http://archive.ubuntu.com/ubuntu noble/main amd64 libcommon-sense-perl amd64 3.75-3build3 [20.4 kB]
Get:4 http://archive.ubuntu.com/ubuntu noble/main amd64 libtypes-serialiser-perl all 1.01-1 [11.6 kB]
Get:5 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 libjson-xs-perl amd64 4.040-0ubuntu0.24.04.1 [83.7 kB]
Get:6 http://archive.ubuntu.com/ubuntu noble/main amd64 libllvm17t64 amd64 1:17.0.6-9ubuntu1 [26.2 MB]
Get:7 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 libpq5 amd64 16.14-0ubuntu0.24.04.1 [147 kB]
Get:8 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql-client-16 amd64 16.14-0ubuntu0.24.04.1 [1,300 kB]
Get:9 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql-16 amd64 16.14-0ubuntu0.24.04.1 [15.6 MB]
Get:10 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql all 16+257build1.1 [11.6 kB]
Get:11 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql-client all 16+257build1.1 [11.6 kB]
Fetched 43.6 MB in 32s (1,342 kB/s)                                                                
Preconfiguring packages ...
Selecting previously unselected package libjson-perl.
(Reading database ... 268935 files and directories currently installed.)
Preparing to unpack .../00-libjson-perl_4.10000-1_all.deb ...
Unpacking libjson-perl (4.10000-1) ...
Selecting previously unselected package postgresql-common.
Preparing to unpack .../01-postgresql-common_257build1.1_all.deb ...
Adding 'diversion of /usr/bin/pg_config to /usr/bin/pg_config.libpq-dev by postgresql-common'
Unpacking postgresql-common (257build1.1) ...
Selecting previously unselected package libcommon-sense-perl:amd64.
Preparing to unpack .../02-libcommon-sense-perl_3.75-3build3_amd64.deb ...
Unpacking libcommon-sense-perl:amd64 (3.75-3build3) ...
Selecting previously unselected package libtypes-serialiser-perl.
Preparing to unpack .../03-libtypes-serialiser-perl_1.01-1_all.deb ...
Unpacking libtypes-serialiser-perl (1.01-1) ...
Selecting previously unselected package libjson-xs-perl.
Preparing to unpack .../04-libjson-xs-perl_4.040-0ubuntu0.24.04.1_amd64.deb ...
Unpacking libjson-xs-perl (4.040-0ubuntu0.24.04.1) ...
Selecting previously unselected package libllvm17t64:amd64.
Preparing to unpack .../05-libllvm17t64_1%3a17.0.6-9ubuntu1_amd64.deb ...
Unpacking libllvm17t64:amd64 (1:17.0.6-9ubuntu1) ...
Selecting previously unselected package libpq5:amd64.
Preparing to unpack .../06-libpq5_16.14-0ubuntu0.24.04.1_amd64.deb ...
Unpacking libpq5:amd64 (16.14-0ubuntu0.24.04.1) ...
Selecting previously unselected package postgresql-client-16.
Preparing to unpack .../07-postgresql-client-16_16.14-0ubuntu0.24.04.1_amd64.deb ...
Unpacking postgresql-client-16 (16.14-0ubuntu0.24.04.1) ...
Selecting previously unselected package postgresql-16.
Preparing to unpack .../08-postgresql-16_16.14-0ubuntu0.24.04.1_amd64.deb ...
Unpacking postgresql-16 (16.14-0ubuntu0.24.04.1) ...
Selecting previously unselected package postgresql.
Preparing to unpack .../09-postgresql_16+257build1.1_all.deb ...
Unpacking postgresql (16+257build1.1) ...
Selecting previously unselected package postgresql-client.
Preparing to unpack .../10-postgresql-client_16+257build1.1_all.deb ...
Unpacking postgresql-client (16+257build1.1) ...
Setting up libpq5:amd64 (16.14-0ubuntu0.24.04.1) ...
Setting up libcommon-sense-perl:amd64 (3.75-3build3) ...
Setting up libllvm17t64:amd64 (1:17.0.6-9ubuntu1) ...
Setting up libtypes-serialiser-perl (1.01-1) ...
Setting up libjson-perl (4.10000-1) ...
Setting up libjson-xs-perl (4.040-0ubuntu0.24.04.1) ...
Setting up postgresql-client-16 (16.14-0ubuntu0.24.04.1) ...
update-alternatives: using /usr/share/postgresql/16/man/man1/psql.1.gz to provide /usr/share/man/man1/psql.1.gz (psql.1.gz) in auto mode
Setting up postgresql-common (257build1.1) ...
debconf: unable to initialize frontend: Dialog
debconf: (Dialog frontend requires a screen at least 13 lines tall and 31 columns wide.)
debconf: falling back to frontend: Readline

Creating config file /etc/postgresql-common/createcluster.conf with new version
Building PostgreSQL dictionaries from installed myspell/hunspell packages...
  en_au
  en_ca
  en_gb
  en_us
  en_za
Removing obsolete dictionary files:
Created symlink /etc/systemd/system/multi-user.target.wants/postgresql.service → /usr/lib/systemd/system/postgresql.service.
Setting up postgresql-client (16+257build1.1) ...
Setting up postgresql-16 (16.14-0ubuntu0.24.04.1) ...
debconf: unable to initialize frontend: Dialog
debconf: (Dialog frontend requires a screen at least 13 lines tall and 31 columns wide.)
debconf: falling back to frontend: Readline
Creating new PostgreSQL cluster 16/main ...
/usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/16/main --auth-local peer --auth-host scram-sha-256 --no-instructions
The files belonging to this database system will be owned by user "postgres".
This user must also own the server process.

The database cluster will be initialized with this locale configuration:
  provider:    libc
  LC_COLLATE:  en_US.UTF-8
  LC_CTYPE:    en_US.UTF-8
  LC_MESSAGES: en_US.UTF-8
  LC_MONETARY: en_IN.UTF-8
  LC_NUMERIC:  en_IN.UTF-8
  LC_TIME:     en_IN.UTF-8
The default database encoding has accordingly been set to "UTF8".
The default text search configuration will be set to "english".

Data page checksums are disabled.

fixing permissions on existing directory /var/lib/postgresql/16/main ... ok
creating subdirectories ... ok
selecting dynamic shared memory implementation ... posix
selecting default max_connections ... 100
selecting default shared_buffers ... 128MB
selecting default time zone ... Asia/Kolkata
creating configuration files ... ok
running bootstrap script ... ok
performing post-bootstrap initialization ... ok
syncing data to disk ... ok
Setting up postgresql (16+257build1.1) ...
Processing triggers for man-db (2.12.0-4build2) ...
Processing triggers for libc-bin (2.39-0ubuntu8.7) ...
balahero03@balahero03:~/eOrbitor_Pulse$ psql --version
psql (PostgreSQL) 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
balahero03@balahero03:~/eOrbitor_Pulse$ ^[[200~sudo apt-get update
sudo: command not found
balahero03@balahero03:~/eOrbitor_Pulse$ sudo apt-get install postgresql postgresql-contrib
Reading package lists... Doneql^[[201~
Building dependency tree... Done
Reading state information... Done
postgresql is already the newest version (16+257build1.1).
The following NEW packages will be installed:
  postgresql-contrib
0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
Need to get 11.6 kB of archives.
After this operation, 17.4 kB of additional disk space will be used.
Do you want to continue? [Y/n] sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresqlAbort.
balahero03@balahero03:~/eOrbitor_Pulse$ sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
Hit:1 http://security.ubuntu.com/ubuntu noble-security InRelease                                   
Hit:2 http://archive.ubuntu.com/ubuntu noble InRelease                                             
Hit:3 http://archive.ubuntu.com/ubuntu noble-updates InRelease                                     
Hit:4 http://archive.ubuntu.com/ubuntu noble-backports InRelease                                   
Hit:5 https://dl.google.com/linux/chrome/deb stable InRelease                                      
Hit:6 https://dl.google.com/linux/chrome-stable/deb stable InRelease
Hit:7 https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev antigravity-debian InRelease
Reading package lists... Done
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
postgresql is already the newest version (16+257build1.1).
The following NEW packages will be installed:
  postgresql-contrib
0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
Need to get 11.6 kB of archives.
After this operation, 17.4 kB of additional disk space will be used.
Do you want to continue? [Y/n] y
Get:1 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 postgresql-contrib all 16+257build1.1 [11.6 kB]
Fetched 11.6 kB in 1s (8,665 B/s)             
Selecting previously unselected package postgresql-contrib.
(Reading database ... 270860 files and directories currently installed.)
Preparing to unpack .../postgresql-contrib_16+257build1.1_all.deb ...
Unpacking postgresql-contrib (16+257build1.1) ...
Setting up postgresql-contrib (16+257build1.1) ...
balahero03@balahero03:~/eOrbitor_Pulse$ V