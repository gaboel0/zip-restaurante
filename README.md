# ZipRotas · Painel da loja

App web para o restaurante acompanhar onde cada motoboy está, em tempo real.
Este repositório é só o app do restaurante.

**Stack:** Vue 3 + Vue Router + Vite (front-end em `client/`), three.js (cena 3D do login),
anime.js (animações), Leaflet + OpenStreetMap (mapa), Node sem framework (`server.js`).

## Rodar

```
npm install
npm run dev     # desenvolvimento: API na 3000 + Vite com hot reload em http://localhost:5173
npm run build   # gera dist/
npm start       # produção: serve dist/ + API em http://localhost:3000
```

`npm start` liga 5 motoboys simulados na loja demo. `npm run start:real` desliga a simulação.

### Demonstração sem servidor (artefato)

```
npm run artifact   # gera artifact/zip-restaurante-demo.html (um único arquivo)
```

Build em modo `demo`: login, motoboys e mapa rodam no navegador (`client/src/lib/demoBackend.js`
e `demoMapLayer.js`), sem chamadas de rede. Qualquer e-mail e senha entram. Esse código não entra
no build normal (`npm run build`).

### Hospedagem

O `server.js` precisa ficar rodando (login, sessões, tempo real). Hospedar só o `dist/` (ex.: Vercel
sem backend) deixa o app sem API: o front mostra "Servidor indisponível" e não abre o painel.

## Contas mockadas

Criadas automaticamente na primeira execução (definidas em `SEED_ACCOUNTS`, no `server.js`).
As duas têm 5 motoboys simulados.

| Conta | E-mail | Senha |
|---|---|---|
| Admin | `admin@ziprotas.com` | definida em `ADMIN_PASSWORD` no arquivo `.env` |
| Loja demo | `loja@demo.test` | `zip-demo-4821` |

Para ter a conta admin, copie `.env.example` para `.env` e preencha `ADMIN_PASSWORD`.
O `.env` não vai para o git.

Novas lojas se cadastram em `/cadastro` (nome, e-mail, senha com no mínimo 8 caracteres e,
opcionalmente, a localização atual como endereço da loja).

As contas ficam em `data/restaurants.json` (senhas com hash scrypt). O endereço da loja
(`lat`/`lng`) também fica lá. As sessões ficam na memória: reiniciar o servidor desloga todo mundo.

## Posição dos motoboys

O app do motoboy não faz parte deste repositório. Ele (ou qualquer outro sistema) envia a posição para:

```
POST /api/location
{ "code": "<código da loja>", "id": "<id do motoboy>", "name": "...", "lat": -23.56, "lng": -46.68,
  "speed": 0, "heading": 0, "status": "disponivel" | "entrega" | "pausa" }
```

## Estrutura

```
client/src/
  views/LoginView.vue      tela de login (cena 3D + animações)
  views/PainelView.vue     painel com lista, filtros e mapa
  components/CityScene.vue cena three.js do login
  components/LiveMap.vue   mapa Leaflet com movimento suave dos motoboys
  components/DriverCard.vue, StatTile.vue, BrandLogo.vue
  lib/api.js, useStream.js, motion.js
server.js                  API, login, tempo real (SSE) e simulador
```
