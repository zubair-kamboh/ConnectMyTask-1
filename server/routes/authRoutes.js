const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { check, validationResult } = require('express-validator')
const User = require('../models/User')
const upload = require('../middlewares/upload')
const { authMiddleware } = require('../middlewares/authMiddleware')
const { sendRegistrationEmail } = require('../utils/mail')

const router = express.Router()

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  upload.single('profilePhoto'),
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({
      min: 6,
    }),
    check('role', 'Role must be either user or provider').isIn([
      'user',
      'provider',
    ]),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const { name, email, password, role, skills } = req.body
    const location = {
      state: req.body['location.state'],
      city: req.body['location.city'],
      suburb: req.body['location.suburb'],
    }
    console.log(location)
    try {
      let user = await User.findOne({ email })
      if (user) return res.status(400).json({ msg: 'User already exists' })

      const profilePhoto = req.file?.path || ''

      user = new User({
        name,
        email,
        password,
        role,
        profilePhoto,
        location,
        skills: role === 'provider' ? skills.split(',') : [],
      })
      await user.save()

      const token = jwt.sign(
        { id: user._id, role: user.role, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      // sendRegistrationEmail(user.email, user.name);

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePhoto: user.profilePhoto,
          location: user.location,
          skills: user.skills,
          isVerified: user.isVerified,
          averageRating: user.averageRating,
          totalReviews: user.totalReviews,
        },
      })
    } catch (err) {
      console.error(err.message)
      res.status(500).send('Server error')
    }
  }
)

// @route   GET /api/auth/profile/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/profile/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ msg: 'User not found' })

    res.json(user)
  } catch (err) {
    console.error(err.message)
    res.status(500).send('Server error')
  }
})

// @route   PUT /api/auth/profile/:userId
// @desc    Update user profile
// @access  Private
router.put(
  '/profile/:userId',
  authMiddleware,
  upload.single('profilePhoto'),
  async (req, res) => {
    try {
      const { userId } = req.params

      // Allow only the user themselves or an admin to update
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Unauthorized' })
      }

      const user = await User.findById(userId)
      if (!user) return res.status(404).json({ msg: 'User not found' })

      const { name, location, skills } = req.body

      if (name) user.name = name
      if (location) user.location = location
      if (skills && user.role === 'provider') {
        user.skills = skills.split(',').map((s) => s.trim())
      }
      if (req.file?.path) {
        user.profilePhoto = req.file.path
      }

      await user.save()

      res.json({
        msg: 'Profile updated successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePhoto: user.profilePhoto,
          location: user.location,
          skills: user.skills,
          isVerified: user.isVerified,
          averageRating: user.averageRating,
          totalReviews: user.totalReviews,
        },
      })
    } catch (err) {
      console.error(err.message)
      res.status(500).json({ msg: 'Server error' })
    }
  }
)

// @route   POST /api/auth/login
// @desc    Login user and return token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const { email, password } = req.body

    try {
      const user = await User.findOne({ email })
      if (!user) return res.status(400).json({ msg: 'Invalid credentials' })

      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' })

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      res.json({
        token,
        user: { id: user._id, name: user.name, email, role: user.role },
      })
    } catch (err) {
      console.error(err.message)
      res.status(500).send('Server error')
    }
  }
)

module.exports = router
