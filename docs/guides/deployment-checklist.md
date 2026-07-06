# Deployment Checklist

## Contracts

1. Set `DEPLOYER_PRIVATE_KEY`, `ETHEREUM_RPC_URL`, `BASE_RPC_URL`, and `BSC_RPC_URL`.
2. Run `npm test`.
3. Deploy per chain:
   - `npm run deploy:ethereum`
   - `npm run deploy:base`
   - `npm run deploy:bsc`
4. Run `npm run export:abi`.
5. Update docs with deployed contract addresses.
6. After stability review, renounce ownership.

## API

1. Provision PostgreSQL.
2. Set `DATABASE_URL`.
3. Set chain RPC URLs and locker addresses.
4. Run `npm run prisma:migrate`.
5. Run `npm run seed`.
6. Run `npm run index` as a recurring job.
7. Start API with `npm start`.

## Frontend

1. Set `VITE_API_BASE_URL`.
2. Build with `npm run build`.
3. Deploy the `dist` directory.
4. Confirm search, lock pages, wallet creation, and management actions.

## Docs

1. Update contract addresses.
2. Update API base URL.
3. Publish docs with the current warning badge policy.
