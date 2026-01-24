<!doctype html>
<html lang="en">
<head>
  <link rel="icon" href="./favicon.ico">
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Login — Allegations of Bribery</title>
  <link rel="stylesheet" href="./css/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="brand">
      <img src="./assets/ladyjusticebribed.png" alt="logo" class="logo" />
      <div>
        <h1>Allegations of Bribery</h1>
        <p class="muted">Login</p>
      </div>
    </div>
    <nav class="nav">
      <a class="btn ghost" href="./index.html">Home</a>
      <a class="btn ghost" href="./signup.html">Register</a>
    </nav>
  </header>

  <main class="container">
    <section class="card">
      <h2>Login</h2>
      <p class="muted" id="msg"></p>

      <label class="label">Email</label>
      <input id="email" class="input" type="email" autocomplete="email" />

      <label class="label">Password</label>
      <input id="password" class="input" type="password" autocomplete="current-password" />

      <div class="row gap">
        <button id="loginBtn" class="btn primary">Login</button>
      </div>

      <p class="muted">No account? <a href="./signup.html">Register here</a>.</p>
    </section>
  </main>

  <script type="module" src="./js/login.js"></script>
</body>
</html>