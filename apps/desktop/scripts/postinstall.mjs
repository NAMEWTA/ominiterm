import { execFileSync } from "node:child_process";

if (process.env.OMINITERM_SKIP_INSTALL_APP_DEPS === "1") {
  process.exit(0);
}

const env = {
  ...process.env,
  OMINITERM_SKIP_INSTALL_APP_DEPS: "1",
};

if (process.platform === "win32") {
  execFileSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", "pnpm exec electron-builder install-app-deps"],
    {
      stdio: "inherit",
      env,
    },
  );
} else {
  execFileSync("pnpm", ["exec", "electron-builder", "install-app-deps"], {
    stdio: "inherit",
    env,
  });
}
