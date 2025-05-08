require('dotenv').config()
const express = require('express')
const connectDB = require('./config/db')
const taskRoutes = require('./routes/taskRoutes')
const authRoutes = require('./routes/authRoutes')
const locationRoutes = require('./routes/locationRoutes')
const cors = require('cors')

const app = express()

// Middleware
app.use(cors()) // Enable CORS for all routes
app.use(express.json())

// Connect to Database
connectDB()

// Routes
app.use('/api/locations', locationRoutes) // Use location routes for Australian locations
app.use('/api/auth', authRoutes) // Use auth routes for login, register, etc.
app.use('/api/tasks', taskRoutes) // Use task routes for task management

const port = 3300

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port hi ${port}`)
})
