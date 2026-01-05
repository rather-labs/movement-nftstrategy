# Movement Local Devnet Setup

These notes walk you through running a Movement local devnet (full node, DA sequencer, faucet) and wiring your project to it for Move development and testing. Follow the steps in order; most commands assume you are in the `movement` repo unless stated otherwise.

# Clone Movement Repository

```bash
git clone https://github.com/movementlabsxyz/movement.git
cd movement
```

# Configure .env file

In `movement` repo root:

```bash
sed -i 's/^CONTAINER_REV=.*/CONTAINER_REV=4030f83/' .env || true
```

or if CONTAINER_REV isn't present:

```bash
echo "CONTAINER_REV=4030f83" >> .env
```

# Initialize Docker images

```bash
docker compose --env-file .env \
  -f docker/compose/movement-full-node/docker-compose.yml \
  -f docker/compose/movement-full-node/docker-compose.local.yml \
  -f docker/compose/movement-full-node/docker-compose.da-sequencer.yml \
  -f docker/compose/movement-full-node/docker-compose.faucet.yml \
  pull

docker compose --env-file .env \
  -f docker/compose/movement-full-node/docker-compose.yml \
  -f docker/compose/movement-full-node/docker-compose.local.yml \
  -f docker/compose/movement-full-node/docker-compose.da-sequencer.yml \
  -f docker/compose/movement-full-node/docker-compose.faucet.yml \
  up -d
```

# Verify your endpoints are live

Movement’s local stack exposes the Aptos REST API on 30731 and the faucet on 30732.

```bash
curl -s http://127.0.0.1:30731/v1 | head
curl -s http://127.0.0.1:30732/ | head
```

And check containers:

```bash
docker compose --env-file .env \
  -f docker/compose/movement-full-node/docker-compose.yml \
  -f docker/compose/movement-full-node/docker-compose.local.yml \
  -f docker/compose/movement-full-node/docker-compose.da-sequencer.yml \
  -f docker/compose/movement-full-node/docker-compose.faucet.yml \
  ps
```

# Initialize Movement Network on your project

Within your Movement project run the following command:

```bash
movement init \
--network custom \
--rest-url http://127.0.0.1:30731/v1 \
--faucet-url http://127.0.0.1:30732 \
--profile local-dev \
--assume-yes
```

Provide a private key or let the system create one for you.

Your config.yaml should look like this:

```yaml
profiles:
  local-dev:
    network: Custom
    private_key: ed25519-priv-0x...
    public_key: ed25519-pub-0x...
    account: ...
    rest_url: "http://127.0.0.1:30731/v1"
    faucet_url: "http://127.0.0.1:30732/"
```

# Useful commands

## Check balances

- Show local keys

```bash
movement account list --profile local-dev
```

- Show account balance

```bash
movement account balance --account 0x{ACCOUNT} --profile local-dev
```

- Create account

You can create a local account using a wallet you already created in your testing wallet (e.g. Nighly), therefore working with the private key associated to it, or create a new private and public key and derive the address (first option is faster).

```bash
movement account create --profile local-dev --account 0x{ACCOUNT}
```

# Publish Module

Pin the framework to match the node's commit — update your Move.toml to use the same aptos-core revision as the running node (the framework docs mention 9dfc8e7a3d622597dfd81cc4ba480a5377f87a41 for "elsa"):

```toml
[dependencies.AptosFramework]
git = "https://github.com/movementlabsxyz/aptos-core.git"
rev = "9dfc8e7a3d622597dfd81cc4ba480a5377f87a41"
subdir = "aptos-move/framework/aptos-framework"
```

Additionally refer to the `bytecode-version` the local node is running with. For example:

```bash
movement move publish --profile local-dev --assume-yes --bytecode-version 6
```

Not specifying the correct `bytecode-version` will make the command fail with `CODE_DESERIALIZATION_ERROR`

---

Created by Mauro Cocco, Software Engineer, Rather Labs Inc. — Free to use and share.
