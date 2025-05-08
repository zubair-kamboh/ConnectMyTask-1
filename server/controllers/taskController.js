// backend/controllers/taskController.js

const Task = require('../models/Task')
const User = require('../models/User')
const {
  sendTaskCreationEmail,
  sendBidNotificationEmail,
  sendBidAcceptedEmail,
  sendTaskCompletionEmail,
} = require('../utils/mail')

// Create a new task
const createTask = async (req, res) => {
  const { title, description, budget, deadline, category } = req.body
  const location = {
    state: req.body['location.state'],
    city: req.body['location.city'],
    suburb: req.body['location.suburb'],
  }
  const imageUrls = req.files.map((file) => file.path) // Cloudinary returns .path as URL
  console.log(req.body)
  try {
    const newTask = new Task({
      title,
      description,
      budget,
      deadline,
      user: req.user.id, // Set the logged-in user who is posting the task
      location,
      images: imageUrls, // save image urls
      category,
    })
    const savedTask = await newTask.save()
    // sendTaskCreationEmail(req.user.email, req.user.name, savedTask.title); // Send email notification to the user
    res.status(201).json(savedTask)
  } catch (error) {
    console.error(error.message)
    res.status(500).send('Server error')
  }
}

// Get all tasks
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('user', 'name email') // Populate user details
      .populate('bids.provider', 'name email')
      .populate('assignedProvider') // Populate bids provider
    res.json(tasks)
  } catch (error) {
    console.error(error.message)
    res.status(500).send('Server error')
  }
}

// Get a single task by ID
const getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(
      'user',
      'name email'
    )
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' })
    }
    res.json(task)
  } catch (error) {
    console.error(error.message)
    res.status(500).send('Server error')
  }
}

// Update task status (active, completed, cancelled)
const updateTaskStatus = async (req, res) => {
  const { status } = req.body

  try {
    let task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' })
    }

    // Only the task poster or admin can update status
    if (task.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ msg: 'Not authorized to update task status' })
    }

    task.status = status
    await task.save()
    res.json(task)
  } catch (error) {
    console.error(error.message)
    res.status(500).send('Server error')
  }
}

// Delete a task
const deleteTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id)
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' })
    }

    // Only the user who posted the task or an admin can delete the task
    if (task.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to delete task' })
    }

    // Use deleteOne() to remove the task
    await Task.deleteOne({ _id: req.params.id })

    res.json({ msg: 'Task deleted' })
  } catch (error) {
    console.error(error.message)
    res.status(500).send('Server error')
  }
}

// Bid on a task
const bidOnTask = async (req, res) => {
  const { price, estimatedTime } = req.body

  try {
    const task = await Task.findById(req.params.id).populate('user', 'email')
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' })
    }

    // Add the bid to the task's bids array
    task.bids.push({
      provider: req.user.id,
      price,
      estimatedTime,
    })

    await task.save()
    // sendBidNotificationEmail(task.user.email, task.title, req.user.name); // Send email notification to the task poster
    res.json(task)
  } catch (error) {
    console.error(error.message)
    res.status(500).send('Server error')
  }
}

// Accept a bid and assign a provider to the task, updating the task status to "In Progress"
const acceptBid = async (req, res) => {
  const { id, bidId } = req.params
  try {
    // Find the task by ID
    const task = await Task.findById(id).populate('bids.provider', 'email')
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' })
    }

    // Ensure the user is the one who posted the task
    if (task.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: 'Only the task poster can accept a bid' })
    }

    // Find the bid in the task's bids array
    const bid = task.bids.find((bid) => bid._id.toString() === bidId)
    if (!bid) {
      return res.status(404).json({ msg: 'Bid not found' })
    }

    // Set the assigned provider and update the task status
    task.assignedProvider = bid.provider
    task.status = 'In Progress'

    await task.save()
    // sendBidAcceptedEmail(
    //   bid.provider.email,
    //   task.title
    // ); // Send email notification to the provider

    res.json({ msg: 'Bid accepted', task })
  } catch (err) {
    console.error(err.message)
    res.status(500).send('Server error')
  }
}

// Complete Task and Provide a Review
const completeTask = async (req, res) => {
  const { id } = req.params
  const { rating, comment } = req.body

  try {
    // Find the task by ID
    const task = await Task.findById(id)
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' })
    }

    // Ensure the user is the one who posted the task
    if (task.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: 'Only the task poster can mark a task as completed' })
    }

    // Check if task is already completed
    if (task.status === 'Completed') {
      return res.status(400).json({ msg: 'Task is already completed' })
    }

    // Mark task as completed and add the review
    task.status = 'Completed'
    task.review = {
      rating,
      comment,
    }

    // Find the provider of the task
    const provider = await User.findById(task.assignedProvider)
    if (!provider) {
      return res.status(404).json({ msg: 'Assigned provider not found' })
    }

    // Update the provider's average rating and total reviews
    provider.totalReviews += 1
    provider.averageRating = (
      (provider.averageRating * (provider.totalReviews - 1) + rating) /
      provider.totalReviews
    ).toFixed(1) // Recalculate average rating

    await provider.save() // Save updated provider info

    await task.save() // Save the task with updated status and review
    // sendTaskCompletionEmail(
    //   provider.email,
    //   task.title
    // ); // Send email notification to the provider

    res.json({ msg: 'Task marked as completed and review added', task })
  } catch (err) {
    console.error(err.message)
    res.status(500).send('Server error')
  }
}

module.exports = {
  createTask,
  getTasks,
  getTask,
  updateTaskStatus,
  deleteTask,
  bidOnTask,
  acceptBid,
  completeTask,
}
