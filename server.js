// server.js - VERSÃO FINAL CORRIGIDA COM NOTIFICAÇÕES TELEGRAM
import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MongoClient } from 'mongodb';
import TelegramBot from 'node-telegram-bot-api';

// --- CONFIGURAÇÃO TELEGRAM ---
const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot;
if (token && chatId) {
    bot = new TelegramBot(token);
    console.log("Bot do Telegram configurado.");
} else {
    console.log("Variáveis do Telegram não encontradas. As notificações não serão enviadas.");
}

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("Erro Crítico: A variável de ambiente DATABASE_URL não está definida.");
    process.exit(1);
}
const mongoClient = new MongoClient(connectionString);
let paymentsCollection;

// --- INICIALIZAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
const port = process.env.PORT || 3000;

const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-5838002077752911-080807-3635a6e6d53be95420768210fcd0fc20-14971085'
});
const payment = new Payment(client);

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// --- DEFINIÇÃO DAS ROTAS ---

// ROTA PARA CRIAR O PAGAMENTO
app.post('/create_payment', async (req, res) => {
    try {
        const { amount, identifier } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!identifier || identifier.trim().length < 10) {
            return res.status(400).json({ error: 'O número de celular é obrigatório.' });
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Valor inválido.' });
        }
        
        const payment_data = {
            transaction_amount: parsedAmount,
            description: `Pagamento referente ao celular: ${identifier}`,
            payment_method_id: 'pix',
            payer: { email: 'pagador@email.com' },
            notification_url: 'https://gerador-pagamento.onrender.com/webhook'
        };

        const result = await payment.create({ body: payment_data });

        await paymentsCollection.insertOne({
            mp_id: result.id,
            identifier: identifier,
            amount: parsedAmount,
            status: 'pending',
            created_at: new Date()
        });

        res.json({
            qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
            qrCode: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error('Erro ao criar pagamento:', error);
        res.status(500).json({ error: 'Erro interno ao gerar o pagamento.' });
    }
});

// ROTA DE WEBHOOK
app.post('/webhook', async (req, res) => {
    const webhookData = req.body;
    if (webhookData.type === 'payment') {
        try {
            const paymentId = webhookData.data.id;
            const paymentInfo = await payment.get({ id: paymentId });
            const mpIdAsNumber = Number(paymentId);
            
            if (paymentInfo.status === 'approved') {
                const updatedPayment = await paymentsCollection.findOneAndUpdate(
                    { mp_id: mpIdAsNumber, status: { $ne: 'approved' } },
                    { $set: { status: 'approved', paid_at: new Date() } },
                    { returnDocument: 'after' }
                );
                
                if (updatedPayment && bot) {
                    const paymentDoc = updatedPayment;
                    const message = `
✅ *Pagamento Aprovado!*

*Valor:* R$ ${paymentDoc.amount.toFixed(2).replace('.', ',')}
*Identificador:* ${paymentDoc.identifier}
                    `;
                    
                    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                        .catch(err => console.error("Erro ao enviar notificação Telegram:", err));
                }
            }
        } catch (error) {
            console.error('Erro no webhook:', error);
        }
    }
    res.sendStatus(200);
});

// ROTA PARA BUSCAR A LISTA DE PAGAMENTOS
app.get('/get_payments', async (req, res) => {
    try {
        const payments = await paymentsCollection.find({}).sort({ created_at: -1 }).toArray();
        res.json(payments);
    } catch (error) {
        console.error('Erro ao ler pagamentos:', error);
        res.status(500).json({ error: 'Não foi possível ler os registros.' });
    }
});

// --- FUNÇÃO PARA INICIAR O SERVIDOR ---
async function startServer() {
    try {
        await mongoClient.connect();
        console.log("Conectado ao MongoDB Atlas com sucesso!");
        const db = mongoClient.db("pagamentosDb");
        paymentsCollection = db.collection("payments");

        app.listen(port, () => {
            console.log(`Servidor rodando na porta ${port} e pronto para receber requisições.`);
        });

    } catch (error) {
        console.error("Falha CRÍTICA ao iniciar o servidor:", error);
        process.exit(1);
    }
}

// Executa a função principal para iniciar tudo
startServer();
