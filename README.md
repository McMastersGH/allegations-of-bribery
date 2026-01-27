<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Allegations of Bribery</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container header-row">
      <div>
        <h1 class="site-title">Allegations of Bribery</h1>
        <div class="site-subtitle">Public read. Approved authors only.</div>
      </div>

      <nav class="nav">
        <a href="index.html" class="active">Home</a>
        <a href="dashboard.html">Dashboard</a>
        <a href="admin.html">Admin</a>
        <a href="login.html" id="authLink">Sign in</a>
        <button id="signOutBtn" class="btn secondary hidden">Sign out</button>
      </nav>
    </div>
  </header>

  <main class="container">
    <section class="card">
      <div class="card-header">
        <h2>Latest Posts</h2>
        <div class="muted" id="whoami"></div>
      </div>
      <div class="card-body">
        ```markdown
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Allegations of Bribery</title>
          <link rel="stylesheet" href="css/styles.css" />
        </head>
        <body>
          <header class="site-header">
            <div class="container header-row">
              <div>
                <h1 class="site-title">Allegations of Bribery</h1>
                <div class="site-subtitle">Public read. Approved authors only.</div>
              </div>

              <nav class="nav">
                <a href="index.html" class="active">Home</a>
                <a href="dashboard.html">Dashboard</a>
                <a href="admin.html">Admin</a>
                <a href="login.html" id="authLink">Sign in</a>
                <button id="signOutBtn" class="btn secondary hidden">Sign out</button>
              </nav>
            </div>
          </header>

          <main class="container">
            <section class="card">
              <div class="card-header">
                <h2>Latest Posts</h2>
                <div class="muted" id="whoami"></div>
              </div>
              <div class="card-body">
                <div class="row gap">
                  <input id="searchInput" class="input" placeholder="Search titles or content..." />
                  <button id="refreshBtn" class="btn">Refresh</button>
                </div>

                <div id="posts" class="list"></div>
                <div id="emptyState" class="muted hidden">No posts found.</div>
                <div id="errorBox" class="error hidden"></div>
              </div>
            </section>
          </main>

          <footer class="container footer">
            <div class="muted">Powered by Supabase + GitHub Pages</div>
          </footer>

          <script type="module" src="js/index.js"></script>
        </body>
        </html>
        ```

        **Repository Cleanup**

        - **Commit:** "Remove testing files and purge node_modules and package-lock.json from history"
        - **What changed:** testing files and helper scripts were removed; `package-lock.json` removed; `node_modules` purged from Git history; `.gitignore` added to ignore `node_modules` and local env files.

        **Action for collaborators**

        - Easiest (recommended): re-clone the repository:

          git clone <repo-url>

        - Or reset an existing local clone (destructive — will discard local changes):

          git fetch origin
          git reset --hard origin/main
          git clean -fdx

        If you have local branches or unpushed commits, save them (e.g., `git format-patch`) before resetting.

        **Removing node_modules from GitHub releases (if present)**

        I cannot remove release assets here without an authenticated API call. To remove any `node_modules` attachments from releases, run the following using a GitHub Personal Access Token (`repo` scope) or the GitHub CLI:

        - Using GitHub API (example):

          # list releases
          curl -H "Authorization: token $GITHUB_TOKEN" \
            https://api.github.com/repos/OWNER/REPO/releases

          # for each asset ID you want to delete:
          curl -X DELETE -H "Authorization: token $GITHUB_TOKEN" \
            https://api.github.com/repos/OWNER/REPO/releases/assets/ASSET_ID

        - Or with GitHub CLI (if authenticated):

          gh release list
          # view release to find asset ids
          gh release view TAG --json assets
          # delete a release asset by id via API helper
          gh api --method DELETE /repos/OWNER/REPO/releases/assets/ASSET_ID

        Be careful: deleting release assets is irreversible. Tell me if you want me to run these (I will need GH CLI auth or a PAT).