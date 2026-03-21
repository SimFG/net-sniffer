.PHONY: install dev stop logs package

install:
	 bun install

dev:
	 pm2 start ecosystem.config.cjs --only net-sniffer-dev || pm2 start ecosystem.config.cjs

stop:
	 pm2 delete net-sniffer-dev || true

logs:
	 pm2 logs net-sniffer-dev

package:
	 @echo "Packaging extension..."
	 zip -r net-sniffer.zip . -x "*.git*" "node_modules/*" "*.zip" "Makefile" "ecosystem.config.cjs" "dev-server.js" "package.json" "bun.lockb" "AGENT.md" "pics/*"
	 @echo "Package created: net-sniffer.zip"

