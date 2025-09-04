// server.js - VERSÃO COM BANCO DE DADOS E WEBHOOK
import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import path from 'path';

// Configuração do DB
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, { payments: [] }); // Dados padrão: um array vazio de pagamentos

const app = express();
// A porta é fornecida pelo Render, ou 3000 para teste local
const port = process.env.PORT || 3000; 

// Configuração do cliente Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-5838002077752911-080807-3635a6e6d53be95420768210fcd0fc20-14971085'
});
const payment = new Payment(client);

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// ROTA PARA CRIAR O PAGAMENTO
app.post('/create_payment', async (req, res) => {
    try {
        await db.read(); // Sempre leia os dados mais recentes do arquivo

        const { amount, identifier } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!identifier || identifier.trim() === '') {
            return res.status(400).json({ error: 'A identificação é obrigatória.' });
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Valor inválido.' });
        }

        const payment_data = {
            transaction_amount: parsedAmount,
            description: `Pagamento para: ${identifier}`,
            payment_method_id: 'pix',
            payer: { email: 'pagador@email.com' },
            // IMPORTANTE: URL do webhook para este serviço no Render
            notification_url: 'https://gerador-pagamento.onrender.com/webhook'
        };

        const result = await payment.create({ body: payment_data });

        // Salva o pagamento no nosso banco de dados
        db.data.payments.push({
            mp_id: result.id,
            identifier: identifier,
            amount: parsedAmount,
            status: 'pending',
            created_at: new Date().toISOString(),
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });
        await db.write();

        res.json({
            qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
            qrCode: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error('Erro ao criar pagamento:', error);
        res.status(500).json({ error: 'Erro interno ao gerar o pagamento.' });
    }
});

// ROTA DE WEBHOOK (que o Mercado Pago vai chamar)
app.post('/webhook', async (req, res) => {
    const webhookData = req.body;

    if (webhookData.type === 'payment') {
        try {
            const paymentId = webhookData.data.id;
            const paymentInfo = await payment.get({ id: paymentId });
            
            await db.read();
            const paymentInDb = db.data.payments.find(p => p.mp_id == paymentId);

            if (paymentInDb && paymentInfo.status === 'approved') {
                paymentInDb.status = 'approved'; // Atualiza o status
                paymentInDb.paid_at = new Date().toISOString();
                await db.write();
            }
        } catch (error) {
            console.error('Erro no webhook:', error);
            return res.sendStatus(500);
        }
    }
    // Responda ao Mercado Pago para confirmar o recebimento
    res.sendStatus(200);
});

// ROTA PARA BUSCAR A LISTA DE PAGAMENTOS
app.get('/get_payments', async (req, res) => {
    await db.read();
    // Retorna a lista ordenada, dos mais recentes para os mais antigos
    const sortedPayments = [...db.data.payments].reverse();
    res.json(sortedPayments);
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
