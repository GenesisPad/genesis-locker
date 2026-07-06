# Developer Setup

## Contracts

```bash
cd contracts
npm install
npm test
```

## API

```bash
cd api
npm install
cp .env.example .env
npm run prisma:migrate
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```
