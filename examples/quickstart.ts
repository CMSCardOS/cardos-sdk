import { CardOS, CardOSError } from 'cardos';

const cardos = new CardOS({ apiKey: process.env.CARDOS_API_KEY! }); // cms_sk_test_… = sandbox

async function main() {
  const products = await cardos.products.list();
  const product = products.find((p) => !p.kyc_required) ?? products[0];

  // Top up + (sandbox) confirm, then issue a card
  const dep = await cardos.deposits.create({ externalUserRef: '123456', amount: '100' });
  if (cardos.mode === 'test') await cardos.deposits.confirmSandbox(dep.deposit_id);

  const card = await cardos.cards.issue({ externalUserRef: '123456', product: product?.product_code });
  console.log('issued', card.card_id, await cardos.balance.get('123456'));
}

main().catch((e) => {
  if (e instanceof CardOSError) console.error(`CardOS ${e.status} ${e.code ?? ''}: ${e.message}`);
  else console.error(e);
  process.exit(1);
});
