const { MercadoPagoConfig, Preference } = require('mercadopago');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: 'userId e email obrigatorios' });

  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          id: 'tipcerto-anual',
          title: 'TipCerto — Assinatura Anual',
          description: 'Acesso ilimitado ao TipCerto por 12 meses',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 115.00
        }],
        payer: { email },
        external_reference: userId,
        back_urls: {
          success: `https://arroba-sand.vercel.app/?pagamento=sucesso`,
          failure: `https://arroba-sand.vercel.app/?pagamento=falha`,
          pending: `https://arroba-sand.vercel.app/?pagamento=pendente`
        },
        auto_return: 'approved',
        notification_url: `https://arroba-sand.vercel.app/api/mp-webhook`,
        statement_descriptor: 'TIPCERTO',
        expires: false
      }
    });

    return res.status(200).json({ checkoutUrl: result.init_point });
  } catch (err) {
    console.error('MP checkout error:', err);
    return res.status(500).json({ error: 'Erro ao criar preferencia', detail: err.message });
  }
};
