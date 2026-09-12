require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors()); // Allows your frontend to talk to this backend
app.use(express.json()); // Allows parsing of JSON data from the frontend

// ==========================================
// 1. MONGODB DATABASE SETUP
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Real-Time Calendar'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Define what a "Booking" looks like in the database
const bookingSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true }, 
    phone: { type: String, required: true },
    service: { type: String, required: true },
    date: { type: String, required: true }, // Stored as "YYYY-MM-DD HH:MM"
    createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

// ==========================================
// 2. EMAIL NOTIFICATION SETUP
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// 3. API ROUTES
// ==========================================

// ROUTE 1: Check Availability (Frontend calls this to disable booked times)
app.get('/api/availability', async (req, res) => {
    try {
        const bookings = await Booking.find({}, 'date'); 
        const bookedSlots = bookings.map(b => b.date); 
        res.status(200).json(bookedSlots);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Laden der Verfügbarkeit.' });
    }
});

// ROUTE 2: Process a New Booking
app.post('/api/book', async (req, res) => {
    const { name, email, phone, service, date } = req.body;

    try {
        // A. Check if the time slot is already taken
        const existingBooking = await Booking.findOne({ date });
        if (existingBooking) {
            return res.status(400).json({ error: 'Dieser Termin ist leider schon vergeben.' });
        }

        // B. Save the new booking to MongoDB
        const newBooking = new Booking({ name, email, phone, service, date });
        await newBooking.save();

        // C. Send Confirmation Email to the Customer
        const customerMailOptions = {
            from: `"GM Studio" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Terminbestätigung - GM Studio',
            html: `
                <h2>Hallo ${name},</h2>
                <p>Dein Termin bei GM Studio ist bestätigt!</p>
                <ul>
                    <li><strong>Service:</strong> ${service}</li>
                    <li><strong>Datum & Zeit:</strong> ${date} Uhr</li>
                </ul>
                <p>Wir freuen uns auf dich!<br>Dein GM Studio Team</p>
                <p><small>EKATERINBURG, ST. KIM, 45</small></p>
            `
        };

        // D. Send Alert Email to YOU (The Admin)
        const adminMailOptions = {
            from: `"GM Studio System" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, 
            subject: `Neue Buchung: ${service} am ${date}`,
            html: `
                <h2>Neue Terminbuchung!</h2>
                <ul>
                    <li><strong>Kunde:</strong> ${name}</li>
                    <li><strong>Telefon:</strong> ${phone}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Service:</strong> ${service}</li>
                    <li><strong>Datum & Zeit:</strong> ${date}</li>
                </ul>
            `
        };

        // Send both emails simultaneously
        await Promise.all([
            transporter.sendMail(customerMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);

        // E. Tell the frontend it was successful
        res.status(200).json({ message: 'Dein Termin wurde erfolgreich gebucht!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Serverfehler. Bitte versuche es später erneut.' });
    }
});

// ==========================================
// 4. START THE SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});