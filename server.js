// server.js - VERSÃO FINAL CORRIGIDA
const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
const port = 3000;

// Configuração do cliente Mercado Pago com seu Access Token
const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-5838002077752911-080807-3635a6e6d53be95420768210fcd0fc20-14971085'
});

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Rota para criar o pagamento
app.post('/create_payment', async (req, res) => {
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Valor inválido' });
    }

    // --- CORREÇÃO APLICADA AQUI ---
    // Substituímos os dados de teste por dados genéricos de um comprador.
    const payment_data = {
        transaction_amount: amount,
        description: 'Pagamento de Serviço/Produto',
        payment_method_id: 'pix',
        payer: {
            email: 'pagador@email.com', // E-mail genérico
            first_name: 'Pagador',
            last_name: 'Silva',
            identification: {
                type: 'CPF',
                number: '01234567890' // Um CPF com formato válido (não precisa ser real)
            },
        },
        notification_url: 'https://seusite.com/notifications'
    };

    try {
        const payment = new Payment(client);
        const result = await payment.create({ body: payment_data });

        const qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
        const qrCode = result.point_of_interaction.transaction_data.qr_code;

        res.json({
            qrCodeBase64: qrCodeBase64,
            qrCode: qrCode
        });

    } catch (error) {
        console.error('Erro ao criar pagamento:', error);
        res.status(500).json({ error: 'Erro ao gerar o pagamento' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
