const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const conf = JSON.parse(fs.readFileSync(path.join(__dirname,'..', '..', 'conf.json'), 'utf-8'));

const mailSender = (destinatario, password, reinvio) => {
    return new Promise((resolve, reject) => {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: conf.mailSender,
                pass: conf.mailPassword
            }
        });
        let mailOptions;
        if(reinvio){
            mailOptions = {
                from: conf.mailSender,
                to: destinatario,
                subject: 'Reinvio credenziali',
                html: `
                <p>Ciao,</p>
                <p>di seguito le tue credenziali:</p>
                <p>email: ${destinatario}</p>
                <p>password: ${password}</p>
                <i>Attenzione, questa email è stata generata in modo automatico. Qualsiasi risposta non verrà letta!</i>

                `
            };
        }else{
            mailOptions = {
                from: conf.mailSender,
                to: destinatario,
                subject: 'Conferma iscrizione',
                html: `
                <p>Ciao, la tua iscrizione è stata confermata con successo!</p>
                <p>Di seguito le tue credenziali:</p>
                <p>email: ${destinatario}</p>
                <p>password: ${password}</p>
                <i>Attenzione, questa email è stata generata in modo automatico. Qualsiasi risposta non verrà letta!</i>
                `
            };
        }
         
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject(error);
            } else {
                resolve("Email inviata con successo!");
            }
        });
    });
}


module.exports = mailSender;