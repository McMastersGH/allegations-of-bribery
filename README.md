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
      # Allegations of Bribery

      This repository powers the Allegations of Bribery website (static frontend + client-side integrations).

      ## Development

      - Site front-end files are in the repo root (`*.html`) and `js/`, `css/`, and `assets/` folders.
      - Run linters from the repository root: `npm run lint` (requires `eslint` installed via `npm install`).

      ## Ads & Sponsorships

      This site supports advertisements and paid sponsorships. During development the site displays non-serving placeholders; when you're ready to serve real ads you can enable an ad provider (e.g. Google AdSense) or accept direct sponsorships.

      To enable AdSense:

      1. Sign up at https://www.google.com/adsense and follow their site verification steps.
      2. Once approved, update `js/config.js` with your client ID and set `ENABLE_ADS = true`.
      3. Replace the ad placeholder contents (the `ad-slot` elements) with the AdSense `<ins class="adsbygoogle" ...>` markup they provide.

      Direct sponsorships:

      - There's a simple sponsor contact page at `sponsor.html` and a Node.js scaffold at `scripts/sponsor-server.js`. The server accepts POSTs to `/sponsor` and forwards submissions to a configured recipient email via SMTP.
      - Configure SMTP using the environment variables documented in `scripts/sponsor-server.js` before running.

      Privacy & disclosure:

      - Ads and sponsorships may involve third-party networks which collect data for ad targeting. See `privacy.html` for a recommended disclosure; contact the site operator to request removal or opt-out from sponsorship communications.

      If you'd like, I can populate non-serving sample AdSense markup in the placeholders or help deploy the sponsor endpoint to a serverless provider.