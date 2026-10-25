import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Virtual adapters (WSL, Docker, VMware, VirtualBox, VPNs) aren't reachable from guests' phones
const VIRTUAL = /vEthernet|WSL|Hyper-V|Docker|VMware|VMnet|VirtualBox|vbox|Loopback|Bluetooth|Tailscale|ZeroTier|utun|veth|br-|docker/i
const WIFI = /Wi-?Fi|Wireless|WLAN|^wlan|^wlp|^en0$/i // Windows "Wi-Fi", Linux wlan0/wlp*, macOS en0
const WIRED = /Ethernet|^eth\d|^enp|^en\d/i

/**
 * This PC's IPv4 addresses on the local network, best first: the Wi-Fi adapter ("Wireless LAN
 * adapter Wi-Fi" in ipconfig), then Ethernet, then anything else that isn't virtual.
 * Read fresh on every call, so a new Wi-Fi address is picked up without restarting.
 */
function lanAddresses(): string[] {
  const found: { address: string; score: number }[] = []
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue
      const privateRange = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)
      const score = (WIFI.test(name) ? 4 : WIRED.test(name) ? 2 : 0) + (privateRange ? 1 : 0)
      found.push({ address: a.address, score })
    }
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.address)
}

/** GET /__afos/lan → ["192.168.100.20", …] from the dev/preview server, computed per request. */
function lanAddressEndpoint(): Plugin {
  const handler = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (s: string) => void }, next: () => void) => {
    if (req.url !== '/__afos/lan') return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(lanAddresses()))
  }
  return {
    name: 'afos-lan-address',
    configureServer: (server) => { server.middlewares.use(handler) },
    configurePreviewServer: (server) => { server.middlewares.use(handler) },
  }
}

export default defineConfig(({ mode }) => {
  // Non-VITE_ values are read here only to configure the dev proxy; they never reach the browser.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = `http://localhost:${env.API_PORT || 3001}`
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  }

  return {
    plugins: [react(), lanAddressEndpoint()],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      // Fallback when /__afos/lan isn't available (e.g. the build served by the API)
      __LAN_ADDRESSES__: JSON.stringify(lanAddresses()),
    },
    server: {
      host: '0.0.0.0',
      proxy,
    },
    preview: { proxy },
  }
})
