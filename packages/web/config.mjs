const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://code.klaut.pro" : `https://${stage}.code.klaut.pro`,
  console: stage === "production" ? "https://code.klaut.pro/auth" : `https://${stage}.code.klaut.pro/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/klaut-pro/klautcode",
  discord: "https://code.klaut.pro/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
