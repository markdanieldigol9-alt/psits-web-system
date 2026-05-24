// Placeholder PayMongo integration scaffold.
// Keeps manual verification working while providing a clean place to add PayMongo later.

function getPayMongoConfig() {
  return {
    publicKey: process.env.PAYMONGO_PUBLIC_KEY || '',
    secretKey: process.env.PAYMONGO_SECRET_KEY || '',
    enabled: Boolean(process.env.PAYMONGO_SECRET_KEY),
  };
}

async function createPaymentIntent(_params) {
  const cfg = getPayMongoConfig();
  if (!cfg.enabled) {
    return {
      ok: false,
      message: 'PayMongo is not configured. Set PAYMONGO_SECRET_KEY to enable.',
    };
  }

  try {
    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(cfg.secretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: _params.amount * 100, // PayMongo expects amounts in cents
            payment_method_allowed: ['card', 'paymaya', 'gcash'],
            payment_method_options: { card: { request_three_d_secure: 'any' } },
            currency: 'PHP',
            description: _params.description || 'PSITS Payment',
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, message: data.errors?.[0]?.detail || 'PayMongo error' };
    }

    return {
      ok: true,
      data: data.data,
      clientKey: data.data.attributes.client_key,
    };
  } catch (error) {
    console.error('PayMongo Request Error:', error);
    return {
      ok: false,
      message: 'Failed to communicate with PayMongo API',
    };
  }
}

module.exports = {
  getPayMongoConfig,
  createPaymentIntent,
};

