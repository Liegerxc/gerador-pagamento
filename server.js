// server.js
const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const port = 3000;

// --- CONFIGURAÇÃO DE CREDENCIAIS ---
// ATENÇÃO: Substitua pelo seu Access Token real.
// Jamais exponha essa chave no código do frontend.
mercadopago.configure({
    access_token: 'APP_USR-5838002077752911-080807-3635a6e6d53be95420768210fcd0fc20-14971085'
});

app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serve os arquivos da pasta 'public'

// --- ROTA PARA CRIAR O PAGAMENTO ---
app.post('/create_payment', async (req, res) => {
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Valor inválido' });
    }

    const payment_data = {
        transaction_amount: amount,
        description: 'Pagamento de Serviço/Produto',
        payment_method_id: 'pix',
        payer: {
            email: 'test_user_123456@testuser.com', // E-mail de teste ou do cliente
            first_name: 'Test',
            last_name: 'User',
            identification: {
                type: 'CPF',
                number: '19119119100' // CPF de teste ou do cliente
            },
        },
        notification_url: 'https://seusite.com/notifications' // URL para receber notificações de pagamento
    };

    try {
        const data = await mercadopago.payment.create(payment_data);
        const qrCodeBase64 = data.body.point_of_interaction.transaction_data.qr_code_base64;
        const qrCode = data.body.point_of_interaction.transaction_data.qr_code;

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