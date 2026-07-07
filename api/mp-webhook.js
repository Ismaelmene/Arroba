const { MercadoPagoConfig, Payment } = require('mercadopago');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function initFirebase() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;

  // Só processa pagamentos aprovados
  if (type !== 'payment') return res.status(200).json({ ok: true });

  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: data.id });

    if (payment.status !== 'approved') return res.status(200).json({ ok: true });

    const userId = payment.external_reference;
    if (!userId) return res.status(200).json({ ok: true });

    // Calcular data de expiração (1 ano a partir de agora)
    const expira = new Date();
    expira.setFullYear(expira.getFullYear() + 1);

    // Atualizar Firestore
    initFirebase();
    const db = getFirestore();
    const usersRef = db.collection('users');
    const snap = await usersRef.where('uid', '==', userId).get();

    if (!snap.empty) {
      snap.forEach(async d => {
        await usersRef.doc(d.id).update({
          status: 'ativo',
          assinaturaExpira: expira,
          ultimoPagamento: FieldValue.serverTimestamp(),
          mpPaymentId: String(payment.id)
        });
      });
    }

    console.log(`Usuario ${userId} ativado ate ${expira.toISOString()}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
