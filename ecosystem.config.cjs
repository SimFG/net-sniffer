module.exports = {
  apps: [
    {
      name: "net-sniffer-dev",
      script: "bun",
      args: "run dev",
      cwd: __dirname,
      env: {
        NODE_ENV: "development"
      },
      watch: ["."],
      ignore_watch: ["node_modules", "dist", ".git"]
    }
  ]
};

