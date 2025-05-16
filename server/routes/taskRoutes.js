// backend/routes/taskRoutes.js

const express = require('express')
const {
  authMiddleware,
  authorizeRoles,
} = require('../middlewares/authMiddleware')
const {
  createTask,
  getTasks,
  getTask,
  updateTaskStatus,
  deleteTask,
  bidOnTask,
  acceptBid,
  completeTask,
  updateTaskDetails,
  createComment,
  replyToComment,
  getTasksWeb,
  getTaskData,
} = require('../controllers/taskController')
const taskUpload = require('../middlewares/taskUpload')

const router = express.Router()

// Routes for Task management
router.post(
  '/',
  authMiddleware,
  authorizeRoles('user'),
  taskUpload.array('images', 5),
  createTask
) // Only users can create tasks
router.get('/', authMiddleware, getTasks) // Get all tasks
router.get('/alltasks/web', authMiddleware, getTasksWeb) // Get all tasks for web
router.get('/:id', authMiddleware, getTask) // Get task by ID
router.get('/:id/data', authMiddleware, getTaskData) // Get task by ID
router.put(
  '/:id/status',
  authMiddleware,
  authorizeRoles('admin', 'user'),
  updateTaskStatus
) // Update task status
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('user', 'admin'),
  deleteTask
) // Delete task

// Routes for bidding on tasks
router.post('/:id/bid', authMiddleware, authorizeRoles('provider'), bidOnTask) // Only providers can bid

// Route for accepting a bid and assigning the provider
router.put(
  '/:id/acceptBid/:bidId',
  authMiddleware,
  authorizeRoles('user'),
  acceptBid
) // Only task creators can accept a bid

// Route for marking task as completed and providing a review
router.put(
  '/:id/completeTask',
  authMiddleware,
  authorizeRoles('user'),
  completeTask
) // Only task creators can complete task

// Route for updating task details
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('user'),
  taskUpload.array('images', 5),
  updateTaskDetails
)
// GET /api/provider/:providerId
// get review for provider
router.get('/provider/:providerId', async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedProvider: req.params.providerId,
      status: 'Completed',
      review: { $exists: true },
    }).populate(
      'user',
      'name email profilePhoto location skills isVerified role averageRating totalReviews'
    )

    const reviews = tasks.map((task) => ({
      rating: task.review.rating,
      comment: task.review.comment,
      reviewer: task.user, // the task poster becomes the reviewer
    }))

    res.json(reviews)
  } catch (err) {
    console.error(err)
    res.status(500).json({ msg: 'Failed to fetch reviews' })
  }
})

// POST Comment
router.post('/:taskId/comment', authMiddleware, createComment)

// POST Reply to a Comment
router.post('/:taskId/comment/:commentId/reply', authMiddleware, replyToComment)

module.exports = router
