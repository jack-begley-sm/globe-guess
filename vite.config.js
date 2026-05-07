export default {
  base: process.env.GITHUB_ACTIONS ? '/globe-guess/' : './',
  server: {
    host: '0.0.0.0',
    port: 5173
  }
}