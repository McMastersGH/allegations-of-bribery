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