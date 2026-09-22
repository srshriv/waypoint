import { Job } from "./job.model.js";

export const jobRepository = {
	create: (input) => Job.create(input),

	/**
	 * Claims the next due job in one atomic step. The filter deliberately also matches jobs
	 * already marked `running` whose lease has expired: that is the recovery path for a worker
	 * that died or was restarted mid-run, so its job is picked up again rather than stranded.
	 * Returns null when nothing is due.
	 */
	claim: (workerId, leaseExpiresAt, now = new Date()) =>
		Job.findOneAndUpdate(
			{
				status: { $in: ["pending", "running"] },
				nextRunAt: { $lte: now },
				$or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }],
			},
			{
				$set: { status: "running", lockedBy: workerId, leaseExpiresAt },
				$inc: { attempts: 1 },
			},
			{ new: true, sort: { nextRunAt: 1 } },
		).lean(),

	/** Extends the lease while a long step is still running. */
	heartbeat: (id, workerId, leaseExpiresAt) =>
		Job.findOneAndUpdate({ _id: id, lockedBy: workerId }, { $set: { leaseExpiresAt } }, { new: true }).lean(),

	succeed: (id, workerId) =>
		Job.findOneAndUpdate(
			{ _id: id, lockedBy: workerId },
			{ $set: { status: "succeeded", leaseExpiresAt: null, lockedBy: null, lastError: "" } },
			{ new: true },
		).lean(),

	/** Schedules a retry: back to `pending`, not due until `nextRunAt`, lease dropped. */
	retryAt: (id, workerId, nextRunAt, lastError) =>
		Job.findOneAndUpdate(
			{ _id: id, lockedBy: workerId },
			{ $set: { status: "pending", nextRunAt, leaseExpiresAt: null, lockedBy: null, lastError } },
			{ new: true },
		).lean(),

	fail: (id, workerId, lastError) =>
		Job.findOneAndUpdate(
			{ _id: id, lockedBy: workerId },
			{ $set: { status: "failed", leaseExpiresAt: null, lockedBy: null, lastError } },
			{ new: true },
		).lean(),

	/** Queue depth by status, for the dashboard's worker panel. */
	countByStatus: () => Job.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
	/** Jobs that have taken more than one attempt, which is the backoff path being exercised. */
	countRetried: () => Job.countDocuments({ attempts: { $gt: 1 } }),
	/** The oldest job still waiting, so a backed-up queue is visible rather than inferred. */
	oldestPending: () => Job.findOne({ status: "pending" }).sort({ nextRunAt: 1 }).select({ nextRunAt: 1, attempts: 1 }).lean(),
};
