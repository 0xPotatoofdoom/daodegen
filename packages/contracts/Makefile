# Makefile for DaoDeGen Contract Deployment

# Network configurations
ANVIL_RPC := http://localhost:8545
SEPOLIA_RPC := $(or $(UNICHAIN_SEPOLIA_RPC),https://sepolia.unichain.org)
MAINNET_RPC := $(or $(UNICHAIN_RPC),https://mainnet.unichain.org)

# Default to anvil for local development
RPC_URL := $(ANVIL_RPC)
PRIVATE_KEY := 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 # Anvil test key

# Load environment variables if .env exists
ifneq ($(wildcard .env),)
    include .env
    export
endif

.PHONY: help build test clean deploy-local deploy-sepolia deploy-mainnet verify-all

help: ## Show this help message
	@echo "DaoDeGen Contract Deployment"
	@echo ""
	@echo "Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build all contracts
	forge build

test: ## Run all tests
	forge test -vv

clean: ## Clean build artifacts
	forge clean

# Local deployment (anvil)
deploy-local: ## Deploy to local anvil network
	@echo "Deploying to local network..."
	forge script script/DeployLocal.s.sol:DeployLocal \
		--rpc-url $(ANVIL_RPC) \
		--private-key $(PRIVATE_KEY) \
		--broadcast

# Unichain Sepolia testnet deployment
deploy-sepolia: ## Deploy to Unichain Sepolia testnet
	@echo "Deploying to Unichain Sepolia..."
	@if [ -z "$(SEPOLIA_PRIVATE_KEY)" ]; then \
		echo "Error: SEPOLIA_PRIVATE_KEY not set in .env file"; \
		exit 1; \
	fi
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(SEPOLIA_RPC) \
		--private-key $(SEPOLIA_PRIVATE_KEY) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

# Unichain Mainnet deployment
deploy-mainnet: ## Deploy to Unichain mainnet
	@echo "Deploying to Unichain Mainnet..."
	@if [ -z "$(MAINNET_PRIVATE_KEY)" ]; then \
		echo "Error: MAINNET_PRIVATE_KEY not set in .env file"; \
		exit 1; \
	fi
	@echo "WARNING: This will deploy to MAINNET. Are you sure? (y/N)"
	@read -r confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "Aborted."; exit 1)
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(MAINNET_RPC) \
		--private-key $(MAINNET_PRIVATE_KEY) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

# PrayerBurn deployment (standalone -- does not redeploy core contracts)
deploy-prayerburn-sepolia: ## Deploy PrayerBurn to Unichain Sepolia
	@echo "Deploying PrayerBurn to Unichain Sepolia..."
	@if [ -z "$(SEPOLIA_PRIVATE_KEY)" ]; then \
		echo "Error: SEPOLIA_PRIVATE_KEY not set in .env file"; \
		exit 1; \
	fi
	forge script script/DeployPrayerBurn.s.sol:DeployPrayerBurn \
		--rpc-url $(SEPOLIA_RPC) \
		--private-key $(SEPOLIA_PRIVATE_KEY) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

deploy-prayerburn-mainnet: ## Deploy PrayerBurn to Unichain mainnet
	@echo "Deploying PrayerBurn to Unichain Mainnet..."
	@if [ -z "$(MAINNET_PRIVATE_KEY)" ]; then \
		echo "Error: MAINNET_PRIVATE_KEY not set in .env file"; \
		exit 1; \
	fi
	@echo "WARNING: This will deploy to MAINNET. Are you sure? (y/N)"
	@read -r confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "Aborted."; exit 1)
	forge script script/DeployPrayerBurn.s.sol:DeployPrayerBurn \
		--rpc-url $(MAINNET_RPC) \
		--private-key $(MAINNET_PRIVATE_KEY) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

# Manual verification (if auto-verify failed)
verify-token: ## Verify DaoDeGenToken on Etherscan
	@if [ -z "$(TOKEN_ADDRESS)" ]; then \
		echo "Error: TOKEN_ADDRESS not set"; \
		exit 1; \
	fi
	forge verify-contract \
		--chain-id 1301 \
		--constructor-args $$(cast abi-encode "constructor(address)" $(INITIAL_HOLDER)) \
		$(TOKEN_ADDRESS) \
		src/DaoDeGenToken.sol:DaoDeGenToken \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

verify-nft: ## Verify VerseNFT on Etherscan
	@if [ -z "$(NFT_ADDRESS)" ]; then \
		echo "Error: NFT_ADDRESS not set"; \
		exit 1; \
	fi
	forge verify-contract \
		--chain-id 1301 \
		--constructor-args $$(cast abi-encode "constructor(string,uint256)" "$(BASE_URI)" $(MINT_PRICE)) \
		$(NFT_ADDRESS) \
		src/VerseNFT.sol:VerseNFT \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

verify-jar: ## Verify DaoDeGenJar on Etherscan
	@if [ -z "$(JAR_ADDRESS)" ]; then \
		echo "Error: JAR_ADDRESS not set"; \
		exit 1; \
	fi
	forge verify-contract \
		--chain-id 1301 \
		--constructor-args $$(cast abi-encode "constructor(address,address,uint256)" $(TOKEN_ADDRESS) $(NFT_ADDRESS) $(BURN_AMOUNT)) \
		$(JAR_ADDRESS) \
		src/DaoDeGenJar.sol:DaoDeGenJar \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

verify-prayerburn: ## Verify PrayerBurn on Etherscan
	@if [ -z "$(PRAYER_BURN_ADDRESS)" ]; then \
		echo "Error: PRAYER_BURN_ADDRESS not set"; \
		exit 1; \
	fi
	forge verify-contract \
		--chain-id 1301 \
		--constructor-args $$(cast abi-encode "constructor(address,address,uint256,uint256)" $(TOKEN_ADDRESS) $(JAR_ADDRESS) 100000000000000000000 60) \
		$(PRAYER_BURN_ADDRESS) \
		src/PrayerBurn.sol:PrayerBurn \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

# Development helpers
anvil: ## Start local anvil node
	anvil --host 0.0.0.0

mine-hook: ## Mine a hook address with correct permissions
	@echo "Mining hook address..."
	forge script script/Deploy.s.sol:Deploy \
		--sig "mineHookAddress(address,address,uint256)" \
		$(POOL_MANAGER) $(JAR_ADDRESS) 0x400000

# Contract interactions
mint-nft: ## Mint an NFT (local only)
	cast send $(NFT_ADDRESS) \
		"mint()" \
		--value 0.001ether \
		--private-key $(PRIVATE_KEY) \
		--rpc-url $(RPC_URL)

check-balances: ## Check token and NFT balances
	@echo "Checking balances..."
	@echo "Token balance:" $$(cast call $(TOKEN_ADDRESS) "balanceOf(address)" $(WALLET_ADDRESS) --rpc-url $(RPC_URL))
	@echo "NFT balance:" $$(cast call $(NFT_ADDRESS) "balanceOf(address)" $(WALLET_ADDRESS) --rpc-url $(RPC_URL))

# Gas optimization
gas-report: ## Generate gas usage report
	forge test --gas-report

# Documentation
docs: ## Generate contract documentation
	forge doc --build