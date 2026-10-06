require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(express.json());
app.use(cors());

// Pulls securely from Render Environment Variables
const resend = new Resend(process.env.RESEND_API_KEY);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Real-Time Calendar'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Booking Schema
const appointmentSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    service: String,
    date: String
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// Booking Endpoint
app.post('/api/book', async (req, res) => {
    try {
        const { name, email, phone, service, date } = req.body;

        // 1. Check for conflicts
        const existingAppointment = await Appointment.findOne({ date: date });
        if (existingAppointment) {
            return res.status(400).json({ error: "Dieser Termin ist leider schon vergeben." });
        }

        // 2. Save appointment
        const newAppointment = new Appointment({ name, email, phone, service, date });
        await newAppointment.save();

        // 3. Send email notification via Resend HTTP API
        const emailData = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'bproducts69@gmail.com',
            subject: 'Neuer Termin gebucht! (GM Studio)',
            html: `
                <h2>Neuer Termin im GM Studio!</h2>
                <p><strong>Kunde:</strong> ${name || 'Nicht angegeben'}</p>
                <p><strong>Telefon:</strong> ${phone || 'Nicht angegeben'}</p>
                <p><strong>E-Mail:</strong> ${email || 'Nicht angegeben'}</p>
                <p><strong>Service:</strong> ${service || 'Haarschnitt'}</p>
                <p><strong>Datum & Uhrzeit:</strong> ${date}</p>
            `
        });

        console.log("Email sent successfully:", emailData);
        res.status(200).json({ message: "Termin erfolgreich gebucht!" });

    } catch (error) {
        console.error("Booking error:", error);
        res.status(500).json({ error: "Serverfehler. Bitte versuche es später erneut." });
    }
});

// Fetch appointments endpoint
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find();
        res.status(200).json(appointments);
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Laden der Termine." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});