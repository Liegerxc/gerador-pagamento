// server.js - VERSÃO FINAL COM MONGODB ATLAS
import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MongoClient } from 'mongodb';

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
// Pega a URL de conexão das variáveis de ambiente do Render
const connectionString = process.env.DATABASE_URL;
const mongoClient = new MongoClient(connectionString);

let paymentsCollection;

// Conecta ao MongoDB ao iniciar o servidor
async function connectDb() {
    try {
        await mongoClient.connect();
        console.log("Conectado ao MongoDB Atlas com sucesso!");
        const db = mongoClient.db("pagamentosDb"); // Nome do banco de dados
        paymentsCollection = db.collection("payments"); // Nome da coleção (tabela)
    } catch (error) {
        console.error("Falha ao conectar ao MongoDB", error);
        process.exit(1); // Encerra a aplicação se não conseguir conectar ao DB
    }
}
connectDb();


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
            notification_url: 'https://gerador-pagamento.onrender.com/webhook' // Use a sua URL do Render
        };

        const result = await payment.create({ body: payment_data });

        // Insere o registro no MongoDB
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
            
            if (paymentInfo.status === 'approved') {
                // Atualiza o documento no MongoDB
                await paymentsCollection.updateOne(
                    { mp_id: Number(paymentId) },
                    { $set: { status: 'approved', paid_at: new Date() } }
                );
            }
        } catch (error) {
            console.error('Erro no webhook:', error);
            return res.sendStatus(500);
        }
    }
    res.sendStatus(200);
});

// ROTA PARA BUSCAR A LISTA DE PAGAMENTOS
app.get('/get_payments', async (req, res) => {
    try {
        // Busca os pagamentos no MongoDB, ordenando pelos mais recentes
        const payments = await paymentsCollection.find({}).sort({ created_at: -1 }).toArray();
        res.json(payments);
    } catch (error) {
        console.error('Erro ao ler pagamentos:', error);
        res.status(500).json({ error: 'Não foi possível ler os registros.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
