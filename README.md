# ZipRotas · Painel da loja

Painel em tempo real para o restaurante ver onde cada motoboy está.

```
npm start            # com 5 motoboys simulados na loja demo
npm run start:real   # sem simulação
```

- Login da loja: http://localhost:3000/login.html
- App do motoboy: http://localhost:3000/motoboy.html?loja=CODIGO (o código aparece no painel)

## Conta de demonstração

- E-mail: `loja@demo.test`
- Senha: `zip-demo-4821`
- Código da loja (para os motoboys): `DEMO42`

As contas ficam em `data/restaurants.json` (senhas com hash scrypt). Para mudar o endereço
da loja demo, edite `lat`/`lng` nesse arquivo e reinicie. As sessões ficam na memória: reiniciar
o servidor desloga todo mundo.
