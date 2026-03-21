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
	 git archive --format zip --output net-sniffer.zip HEAD
	 @echo "Package created: net-sniffer.zip"

