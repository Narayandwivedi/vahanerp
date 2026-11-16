/**
 * POST /:id/alerts { off }: stop (or bring back) the alerts of one document or service schedule.
 */
const alertSwitch = (Model) => async (req, res) => {
  const doc = await Model.findOne({ _id: req.params.id, userId: req.userId });
  if (!doc) return res.status(404).json({ message: "Not found" });
  doc.alertsOff = req.body?.off !== false;
  await doc.save();
  res.json({ success: true, alertsOff: doc.alertsOff });
};

module.exports = { alertSwitch };
