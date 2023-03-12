const cors = require("cors");
const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const mongoURI = process.env.MONGO_URI;

app.use(cors());
app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
}));
app.use(express.json({limit: '50mb'}));

// MongoDB connection
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

// Mongoose schema for TaskList
const taskListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  active: { type: Boolean, default: true }
});

// Mongoose schema for Task
const taskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  dueDate: { type: Date, required: true },
  period: { type: String, required: true },
  periodType: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
  taskList: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskList', required: true }
});

// Mongoose model for TaskList
const TaskList = mongoose.model('TaskList', taskListSchema);

// Mongoose model for Task
const Task = mongoose.model('Task', taskSchema);


app.get("/", (req, res) => {
  res.status(200).end("hello world!");
});

// Create task list
app.post('/api/createtasklist', async (req, res) => {
  console.log(req.body)
  const { name, description, active } = req.body;

  try {
    const taskList = await TaskList.create({ name, description, active });
    res.status(201).json(taskList);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Create task
app.post('/api/createtask', async (req, res) => {
  const { name, description, dueDate, period, periodType, taskListId } = req.body;

  // Convert Indian date format to ISO date format
  const isoDueDate = moment(dueDate, 'DD-MM-YYYY').toISOString();

  // Validate period and due date
  const periodMoment = moment(period, 'MMM YYYY');
  if (!periodMoment.isValid()) {
    return res.status(400).json({ message: 'Invalid period format' });
  }
  const endOfPeriod = periodMoment.endOf(periodType);
  if (moment(isoDueDate).isBefore(endOfPeriod)) {
    return res.status(400).json({ message: `Due date should be after end of ${periodType} period` });
  }

  try {
    const task = await Task.create({ name, description, dueDate: isoDueDate, period, periodType, taskList: taskListId });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// List tasks
app.get('/api/tasklist', async (req, res) => {
  const { page = 1, limit = 10, searchText } = req.query;

  // Build query
  const query = {};
  if (searchText) {
    query.$or = [
      { name: { $regex: searchText, $options: 'i' } },
      { description: { $regex: searchText, $options: 'i' } },
    ];
  }

  try {
    // Count total number of tasks
    const count = await Task.countDocuments(query);

    // Fetch tasks for the requested page and limit
    const tasks = await Task.find(query)
      .populate('taskList', 'name')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .exec();

    // Format tasks response
    const formattedTasks = tasks.map(task => {
      return {
        name: task.name,
        description: task.description,
        periodType: task.periodType,
        period: task.period,
        dueDate: moment(task.dueDate).format('DD-MM-YYYY'),
        taskListName: task.taskList.name,
      };
    });

    // Send tasks response with count
    res.status(200).json({
      tasks: formattedTasks,
      count: count,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});