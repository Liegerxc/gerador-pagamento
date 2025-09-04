// server.js - VERSÃO COM NOTIFICAÇÕES TELEGRAM
import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MongoClient } from 'mongodb';
import TelegramBot from 'node-telegram-bot-api'; // Importa a biblioteca

// --- CONFIGURAÇÃO TELEGRAM ---
const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot;
if (token && chatId) {
    bot = new TelegramBot(token);
}

// ... (Resto do código de conexão com DB e etc.)

// ROTA DE WEBHOOK (COM A MUDANÇA)
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
                
                // --- LÓGICA DE NOTIFICAÇÃO ---
                if (updatedPayment && bot) {
                    const paymentDoc = updatedPayment;
                    const message = `
✅ *Pagamento Aprovado!*

*Valor:* R$ ${paymentDoc.amount.toFixed(2).replace('.', ',')}
*Identificador:* ${paymentDoc.identifier}
                    `;
                    
                    // Envia a mensagem formatada para seu chat
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

// ... (Resto do server.js sem alterações)
startServer();
