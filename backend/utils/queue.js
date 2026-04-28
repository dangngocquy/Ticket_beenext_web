/**
 * Simple Queue system to process tasks sequentially
 * Ensures ticket number generation is atomic and no duplicates occur
 */

class Queue {
  constructor(name = "default") {
    this.name = name;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Enqueue a task and return a promise that resolves when the task completes
   */
  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  /**
   * Process tasks sequentially from the queue
   */
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status (for debugging)
   */
  getStatus() {
    return {
      name: this.name,
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }
}

// Export singleton queues for different purposes
module.exports = {
  Queue,
  // Dedicated queue for ticket number generation
  ticketNumberQueue: new Queue("ticket-number"),
  // Dedicated queue for ticket update operations (prevent race conditions)
  ticketUpdateQueue: new Queue("ticket-update"),
  // Dedicated queue for ticket deletion operations
  ticketDeleteQueue: new Queue("ticket-delete"),
  // Dedicated queue for history update operations
  historyUpdateQueue: new Queue("history-update"),
  // Dedicated queue for history deletion operations
  historyDeleteQueue: new Queue("history-delete"),
  // Dedicated queue for customer update operations
  customerUpdateQueue: new Queue("customer-update"),
  // Dedicated queue for customer deletion operations
  customerDeleteQueue: new Queue("customer-delete"),
  // Dedicated queue for user update operations
  userUpdateQueue: new Queue("user-update"),
  // Dedicated queue for user deletion operations
  userDeleteQueue: new Queue("user-delete"),
  // Helper to create a named queue
  createQueue: (name) => new Queue(name),
};
