// server.js - VERSÃO COM IDENTIFICADOR POR CELULAR
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
const db = new Low(adapter, { payments: [] });

const app = express();
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
        await db.read();

        const { amount, identifier } = req.body; // 'identifier' agora será o número de celular
        const parsedAmount = parseFloat(amount);

        // MUDANÇA: Validação simples para o número de celular
        if (!identifier || identifier.trim().length < 10) { // Verifica se tem pelo menos 10 dígitos
            return res.status(400).json({ error: 'O número de celular é obrigatório e deve ser válido.' });
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Valor inválido.' });
        }
        
        // MUDANÇA: Descrição do pagamento atualizada
        const payment_data = {
            transaction_amount: parsedAmount,
            description: `Pagamento referente ao celular: ${identifier}`,
            payment_method_id: 'pix',
            payer: { email: 'pagador@email.com' },
            notification_url: 'https://gerador-pagamento.onrender.com/webhook' // Use a sua URL do Render
        };

        const result = await payment.create({ body: payment_data });

        db.data.payments.push({
            mp_id: result.id,
            identifier: identifier, // Salva o número de celular como identificador
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

// ROTA DE WEBHOOK (sem alterações)
app.post('/webhook', async (req, res) => {
    const webhookData = req.body;

    if (webhookData.type === 'payment') {
        try {
            const paymentId = webhookData.data.id;
            const paymentInfo = await payment.get({ id: paymentId });
            
            await db.read();
            const paymentInDb = db.data.payments.find(p => p.mp_id == paymentId);

            if (paymentInDb && paymentInfo.status === 'approved' && paymentInDb.status !== 'approved') {
                paymentInDb.status = 'approved';
                paymentInDb.paid_at = new Date().toISOString();
                await db.write();
            }
        } catch (error) {
            console.error('Erro no webhook:', error);
            return res.sendStatus(500);
        }
    }
    res.sendStatus(200);
});

// ROTA PARA BUSCAR A LISTA DE PAGAMENTOS (sem alterações)
app.get('/get_payments', async (req, res) => {
    await db.read();
    const sortedPayments = [...db.data.payments].reverse();
    res.json(sortedPayments);
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
