import { execSync } from 'node:child_process'

const isCloudflarePages =
  process.env.CF_PAGES === '1' ||
  process.env.CF_PAGES === 'true' ||
  typeof process.env.CF_PAGES_URL === 'string' ||
  typeof process.env.CF_PAGES_BRANCH === 'string'

const run = (cmd) => {
  execSync(cmd, { stdio: 'inherit' })
}

// Cloudflare Pages deploy only needs the PWA assets build.
// Building API/assistant in Pages CI can exceed timeouts.
if (isCloudflarePages) {
  run('npm run build:base')
  run('npm run build -w packages/pwa')
} else {
  run('npm run build:base')
  run('npm run build:apps')
}

